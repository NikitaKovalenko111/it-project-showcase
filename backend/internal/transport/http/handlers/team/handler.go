package team_handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	teams_service "it-project-showcase/backend/internal/services/teams"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"strings"
	"time"
)

type Handler struct{ service *teams_service.Service }

func Init(service *teams_service.Service) *Handler { return &Handler{service: service} }

type createRequest struct {
	Name string `json:"name"`
}
type inviteRequest struct {
	StudentID string `json:"student_id"`
	RoleID    string `json:"role_id"`
}
type responseRequest struct {
	Status string `json:"status"`
}

func (h *Handler) StartTeams(mux *http.ServeMux, student func(http.Handler) http.Handler) {
	mux.Handle("POST /", student(http.HandlerFunc(h.Create)))
	mux.Handle("GET /{team_id}", student(http.HandlerFunc(h.Get)))
	mux.Handle("GET /mine", student(http.HandlerFunc(h.ListMine)))
	mux.Handle("POST /{team_id}/invitations", student(http.HandlerFunc(h.Invite)))
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	query, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	user, _ := middleware.UserIDFromContext(r.Context())
	items, total, err := h.service.ListMine(r.Context(), user, query.PageSize, query.Offset)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, 200, pagination.NewPageResponse(items, query, total))
}
func (h *Handler) StartInvitations(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListInvitations)
	mux.HandleFunc("PATCH /{invitation_id}", h.Respond)
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if !decode(w, r, &req) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Create(r.Context(), userID, req.Name)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Get(r.Context(), userID, r.PathValue("team_id"), hasRole(r, "admin"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) Invite(w http.ResponseWriter, r *http.Request) {
	var req inviteRequest
	if !decode(w, r, &req) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Invite(r.Context(), userID, r.PathValue("team_id"), req.StudentID, req.RoleID)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
func (h *Handler) ListInvitations(w http.ResponseWriter, r *http.Request) {
	for key, values := range r.URL.Query() {
		if (key != "status" && key != "limit" && key != "cursor") || len(values) != 1 {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
	}
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	scope := teamScope(status)
	query, err := pagination.ParseCursorQuery(r.URL.Query(), scope)
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	position, id := "", ""
	if query.Cursor != nil {
		position, id = query.Cursor.Position, query.Cursor.ID
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	items, err := h.service.ListInvitations(r.Context(), userID, status, query.Limit+1, position, id)
	if err != nil {
		if errors.Is(err, teams_service.ErrInvalidInput) || errors.Is(err, teams_service.ErrInvalidCursor) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
		writeError(w, r, err)
		return
	}
	page, err := pagination.NewCursorPage(items, query.Limit, func(item models.TeamInvitation) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: item.CreatedAt.UTC().Format(time.RFC3339Nano), ID: item.TeamInvitationID}, nil
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, page)
}
func (h *Handler) Respond(w http.ResponseWriter, r *http.Request) {
	var req responseRequest
	if !decode(w, r, &req) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Respond(r.Context(), userID, r.PathValue("invitation_id"), req.Status)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func decode(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 1<<20))
	decoder.DisallowUnknownFields()
	if decoder.Decode(target) != nil {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return false
	}
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return false
	}
	return true
}
func hasRole(r *http.Request, want string) bool {
	claims, ok := middleware.TokenClaimsFromContext(r.Context())
	if !ok || claims == nil {
		return false
	}
	for _, role := range claims.Roles {
		if role == want {
			return true
		}
	}
	return false
}
func teamScope(status string) string {
	sum := sha256.Sum256([]byte(status))
	return "team-invitations-" + hex.EncodeToString(sum[:8])
}
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, teams_service.ErrNotFound):
		pkg.WriteError(w, http.StatusNotFound, "team_not_found", "Team not found")
	case errors.Is(err, teams_service.ErrForbidden):
		pkg.WriteError(w, http.StatusForbidden, "team_access_denied", "Team access denied")
	case errors.Is(err, teams_service.ErrInvalidInput):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "validation_failed", "Team data is invalid")
	case errors.Is(err, teams_service.ErrInvalidTransition):
		pkg.WriteError(w, http.StatusConflict, "invalid_invitation_transition", "Invitation status transition is not allowed")
	case errors.Is(err, teams_service.ErrConflict):
		pkg.WriteError(w, http.StatusConflict, "team_invitation_conflict", "A pending invitation already exists")
	default:
		middleware.QueueErrorLog(r.Context(), "team request failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "team_request_failed", "Team request failed")
	}
}
