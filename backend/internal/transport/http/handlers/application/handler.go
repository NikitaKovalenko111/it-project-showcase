package application_handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	applications_service "it-project-showcase/backend/internal/services/applications"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type Handler struct{ service *applications_service.Service }

func Init(service *applications_service.Service) *Handler { return &Handler{service: service} }

type createRequest struct {
	CaseID        string `json:"case_id"`
	ApplicantType string `json:"applicant_type"`
	TeamID        string `json:"team_id"`
	CoverLetter   string `json:"cover_letter"`
	ResumeFileID  string `json:"resume_file_id"`
	PortfolioURL  string `json:"portfolio_url"`
	GithubURL     string `json:"github_url"`
}
type statusRequest struct {
	Status string `json:"status"`
	Notes  string `json:"notes"`
}

func (h *Handler) StartApplications(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.List)
	mux.HandleFunc("POST /", h.Create)
	mux.HandleFunc("GET /{application_id}", h.Get)
	mux.HandleFunc("POST /{application_id}/consents", h.Consent)
	mux.HandleFunc("PATCH /{application_id}/status", h.SetStatus)
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) StartExecutions(mux *http.ServeMux) {
	mux.HandleFunc("GET /{$}", h.ListExecutions)
	mux.HandleFunc("GET /{execution_id}", h.GetExecution)
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if !hasRole(r, "student") {
		pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
		return
	}
	var req createRequest
	if !decode(w, r, &req) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Create(r.Context(), userID, models.ApplicationInput{CaseID: req.CaseID, ApplicantType: req.ApplicantType, TeamID: req.TeamID, CoverLetter: req.CoverLetter, ResumeFileID: req.ResumeFileID, PortfolioURL: req.PortfolioURL, GithubURL: req.GithubURL})
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	company, admin := hasRole(r, "company_representative"), hasRole(r, "admin")
	item, err := h.service.Get(r.Context(), userID, r.PathValue("application_id"), company, admin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	filter, ok := parseFilter(w, r.URL.Query())
	if !ok {
		return
	}
	scope := applicationScope(r.URL.Query())
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
	company, admin := hasRole(r, "company_representative"), hasRole(r, "admin")
	items, err := h.service.List(r.Context(), userID, company, admin, filter, query.Limit+1, position, id)
	if err != nil {
		if errors.Is(err, applications_service.ErrInvalidInput) || errors.Is(err, applications_service.ErrInvalidCursor) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
		writeError(w, r, err)
		return
	}
	page, err := pagination.NewCursorPage(items, query.Limit, func(item models.Application) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: item.SubmittedAt.UTC().Format(time.RFC3339Nano), ID: item.ApplicationID}, nil
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, page)
}
func (h *Handler) Consent(w http.ResponseWriter, r *http.Request) {
	if !hasRole(r, "student") {
		pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Consent(r.Context(), userID, r.PathValue("application_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	var req statusRequest
	if !decode(w, r, &req) {
		return
	}
	companyActor := req.Status != "withdrawn"
	if companyActor && !hasRole(r, "company_representative") {
		pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
		return
	}
	if !companyActor && !hasRole(r, "student") {
		pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.SetStatus(r.Context(), userID, r.PathValue("application_id"), req.Status, req.Notes, companyActor)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) ListExecutions(w http.ResponseWriter, r *http.Request) {
	values := r.URL.Query()
	for key := range values {
		if key != "limit" && key != "cursor" {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
	}
	const scope = "executions"
	query, err := pagination.ParseCursorQuery(values, scope)
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	position, id := "", ""
	if query.Cursor != nil {
		position, id = query.Cursor.Position, query.Cursor.ID
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	items, err := h.service.ListExecutions(r.Context(), userID, hasRole(r, "company_representative"), hasRole(r, "admin"), query.Limit+1, position, id)
	if err != nil {
		if errors.Is(err, applications_service.ErrInvalidCursor) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_cursor", "Query parameter cursor is invalid")
			return
		}
		writeError(w, r, err)
		return
	}
	page, err := pagination.NewCursorPage(items, query.Limit, func(item models.Execution) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: item.CreatedAt.UTC().Format(time.RFC3339Nano), ID: item.ExecutionID}, nil
	})
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, page)
}

func (h *Handler) GetExecution(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.GetExecution(r.Context(), userID, r.PathValue("execution_id"), hasRole(r, "company_representative"), hasRole(r, "admin"))
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
func parseFilter(w http.ResponseWriter, values url.Values) (models.ApplicationListFilter, bool) {
	allowed := map[string]bool{"limit": true, "cursor": true, "case_id": true, "status": true, "mine": true}
	for key, items := range values {
		if !allowed[key] || len(items) != 1 {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return models.ApplicationListFilter{}, false
		}
	}
	filter := models.ApplicationListFilter{CaseID: strings.TrimSpace(values.Get("case_id")), Status: strings.TrimSpace(values.Get("status"))}
	if raw := values.Get("mine"); raw != "" {
		value, err := strconv.ParseBool(raw)
		if err != nil {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return filter, false
		}
		filter.Mine = value
	}
	return filter, true
}
func applicationScope(values url.Values) string {
	copy := url.Values{}
	for key, items := range values {
		if key != "limit" && key != "cursor" {
			copy[key] = items
		}
	}
	sum := sha256.Sum256([]byte(copy.Encode()))
	return "applications-" + hex.EncodeToString(sum[:8])
}
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, applications_service.ErrNotFound):
		pkg.WriteError(w, http.StatusNotFound, "application_not_found", "Application not found")
	case errors.Is(err, applications_service.ErrForbidden):
		pkg.WriteError(w, http.StatusForbidden, "application_access_denied", "Application access denied")
	case errors.Is(err, applications_service.ErrInvalidInput):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "validation_failed", "Application data is invalid")
	case errors.Is(err, applications_service.ErrInvalidTransition):
		pkg.WriteError(w, http.StatusConflict, "invalid_application_transition", "Application status transition is not allowed")
	case errors.Is(err, applications_service.ErrCaseUnavailable):
		pkg.WriteError(w, http.StatusConflict, "case_not_accepting_applications", "Case is not accepting applications")
	case errors.Is(err, applications_service.ErrConsentPending):
		pkg.WriteError(w, http.StatusConflict, "application_consent_pending", "Every team member must accept the current case revision")
	case errors.Is(err, applications_service.ErrConflict):
		pkg.WriteError(w, http.StatusConflict, "application_already_exists", "An active application already exists")
	default:
		middleware.QueueErrorLog(r.Context(), "application request failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "application_request_failed", "Application request failed")
	}
}
