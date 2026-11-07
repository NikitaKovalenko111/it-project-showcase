package company_handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	companies_service "it-project-showcase/backend/internal/services/companies"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

const companyCursorScope = "companies"

type Handler struct{ service *companies_service.Service }

func Init(service *companies_service.Service) *Handler { return &Handler{service: service} }
func (h *Handler) Start(mux *http.ServeMux, representative, admin func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /", h.List)
	mux.Handle("GET /mine", representative(http.HandlerFunc(h.ListMine)))
	mux.HandleFunc("GET /{company_id}", h.Get)
	mux.Handle("GET /moderation", admin(http.HandlerFunc(h.ListModeration)))
	mux.Handle("POST /", representative(http.HandlerFunc(h.Create)))
	mux.Handle("PUT /{company_id}", representative(http.HandlerFunc(h.Update)))
	mux.Handle("PATCH /{company_id}/moderation", admin(http.HandlerFunc(h.Moderate)))
	mux.Handle("POST /{company_id}/submit-moderation", representative(http.HandlerFunc(h.Submit)))
	mux.Handle("POST /{company_id}/member-invitations", representative(http.HandlerFunc(h.InviteMember)))
	mux.Handle("POST /{company_id}/student-invitations", representative(http.HandlerFunc(h.InviteStudent)))
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) Submit(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	x, err := h.service.Submit(r.Context(), userID, r.PathValue("company_id"))
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, x)
}
func (h *Handler) InviteMember(w http.ResponseWriter, r *http.Request) {
	var q struct {
		UserID   string `json:"user_id"`
		Position string `json:"position"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, err := h.service.InviteMember(r.Context(), u, r.PathValue("company_id"), q.UserID, q.Position)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, x)
}
func (h *Handler) InviteStudent(w http.ResponseWriter, r *http.Request) {
	var q struct {
		StudentID string `json:"student_id"`
		CaseID    string `json:"case_id"`
		Kind      string `json:"kind"`
		Message   string `json:"message"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, err := h.service.SendStudentInvitation(r.Context(), u, r.PathValue("company_id"), q.StudentID, q.CaseID, q.Kind, q.Message)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, x)
}
func (h *Handler) RespondMemberInvitation(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Status string `json:"status"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, err := h.service.RespondMemberInvitation(r.Context(), u, r.PathValue("invitation_id"), q.Status)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, x)
}
func (h *Handler) RespondStudentInvitation(w http.ResponseWriter, r *http.Request) {
	var q struct {
		Status string `json:"status"`
	}
	if json.NewDecoder(r.Body).Decode(&q) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	x, err := h.service.RespondStudentInvitation(r.Context(), u, r.PathValue("invitation_id"), q.Status)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, x)
}
func (h *Handler) ListMemberInvitations(w http.ResponseWriter, r *http.Request) {
	h.listInvitations(w, r, true)
}
func (h *Handler) ListStudentInvitations(w http.ResponseWriter, r *http.Request) {
	h.listInvitations(w, r, false)
}
func (h *Handler) listInvitations(w http.ResponseWriter, r *http.Request, members bool) {
	status := r.URL.Query().Get("status")
	scope := "company-invitations-" + status
	if members {
		scope = "company-member-invitations-" + status
	}
	q, err := pagination.ParseCursorQuery(r.URL.Query(), scope)
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	u, _ := middleware.UserIDFromContext(r.Context())
	if members {
		items, e := h.service.ListMemberInvitations(r.Context(), u, status, q.Limit+1, pos, id)
		if e != nil {
			writeCompanyError(w, r, e)
			return
		}
		page, e := pagination.NewCursorPage(items, q.Limit, func(x models.CompanyMemberInvitation) (pagination.Cursor, error) {
			return pagination.Cursor{Scope: scope, Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.InvitationID}, nil
		})
		if e != nil {
			writeCompanyError(w, r, e)
			return
		}
		pkg.WriteJSON(w, 200, page)
		return
	}
	items, e := h.service.ListStudentInvitations(r.Context(), u, status, q.Limit+1, pos, id)
	if e != nil {
		writeCompanyError(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(items, q.Limit, func(x models.CompanyInvitation) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: x.SentAt.UTC().Format(time.RFC3339Nano), ID: x.InvitationID}, nil
	})
	if e != nil {
		writeCompanyError(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, false)
}
func (h *Handler) ListModeration(w http.ResponseWriter, r *http.Request) {
	h.list(w, r, true)
}
func (h *Handler) list(w http.ResponseWriter, r *http.Request, moderation bool) {
	scope := companyCursorScope
	moderationStatus := ""
	if moderation {
		moderationStatus = r.URL.Query().Get("status")
		if moderationStatus == "" {
			moderationStatus = "pending"
		}
		scope += "-moderation-" + moderationStatus
	}
	query, err := pagination.ParseCursorQuery(r.URL.Query(), scope)
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	position, id := "", ""
	if query.Cursor != nil {
		position, id = query.Cursor.Position, query.Cursor.ID
	}
	var items []models.Company
	if moderation {
		items, err = h.service.ListForModeration(r.Context(), moderationStatus, query.Limit+1, position, id)
	} else {
		items, err = h.service.List(r.Context(), query.Limit+1, position, id)
	}
	if err != nil {
		if errors.Is(err, companies_service.ErrInvalidCursor) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
		if errors.Is(err, companies_service.ErrInvalidStatus) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
		writeCompanyError(w, r, err)
		return
	}
	page, err := pagination.NewCursorPage(items, query.Limit, func(item models.Company) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: item.CreatedAt.UTC().Format(time.RFC3339Nano), ID: item.CompanyID}, nil
	})
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, page)
}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	company, err := h.service.Get(r.Context(), r.PathValue("company_id"))
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, company)
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	request, ok := decodeCompany(w, r)
	if !ok {
		return
	}
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		pkg.WriteError(w, http.StatusUnauthorized, "invalid_access_token", "Valid access token is required")
		return
	}
	company, err := h.service.Create(r.Context(), userID, request.model())
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, company)
}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	request, ok := decodeCompany(w, r)
	if !ok {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	company, err := h.service.Update(r.Context(), userID, r.PathValue("company_id"), request.model())
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, company)
}
func (h *Handler) Moderate(w http.ResponseWriter, r *http.Request) {
	var request ModerationRequest
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	company, err := h.service.Moderate(r.Context(), userID, r.PathValue("company_id"), request.Status, request.Comment)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, company)
}
func decodeCompany(w http.ResponseWriter, r *http.Request) (CompanyRequest, bool) {
	var request CompanyRequest
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return request, false
	}
	return request, true
}
func writeCompanyError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, companies_service.ErrNotFound):
		pkg.WriteError(w, http.StatusNotFound, "company_not_found", "Company not found")
	case errors.Is(err, companies_service.ErrForbidden):
		pkg.WriteError(w, http.StatusForbidden, "company_access_denied", "Company access denied")
	case errors.Is(err, companies_service.ErrInvalidInput):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "validation_failed", "Company data is invalid")
	case errors.Is(err, companies_service.ErrInvalidStatus):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "invalid_status", "Company status is invalid")
	case errors.Is(err, companies_service.ErrNameTaken):
		pkg.WriteError(w, http.StatusConflict, "company_name_taken", "Company name is already in use")
	default:
		middleware.QueueErrorLog(r.Context(), "company request failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "company_request_failed", "Company request failed")
	}
}

func (h *Handler) ListMine(w http.ResponseWriter, r *http.Request) {
	id, _ := middleware.UserIDFromContext(r.Context())
	items, err := h.service.ListMine(r.Context(), id)
	if err != nil {
		writeCompanyError(w, r, err)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": items})
}
