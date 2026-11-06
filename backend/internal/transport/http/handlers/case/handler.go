package case_handler

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	cases_service "it-project-showcase/backend/internal/services/cases"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

type Handler struct{ service *cases_service.Service }

func Init(service *cases_service.Service) *Handler { return &Handler{service: service} }

func (h *Handler) Start(mux *http.ServeMux, representative, manager, admin func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /", h.List)
	mux.HandleFunc("GET /{case_id}", h.Get)
	mux.Handle("GET /moderation", admin(http.HandlerFunc(h.ListModeration)))
	mux.Handle("GET /{case_id}/manage", manager(http.HandlerFunc(h.GetManaged)))
	mux.Handle("POST /", representative(http.HandlerFunc(h.Create)))
	mux.Handle("PUT /{case_id}", representative(http.HandlerFunc(h.Update)))
	mux.Handle("POST /{case_id}/submit-moderation", representative(http.HandlerFunc(h.SubmitForModeration)))
	mux.Handle("PATCH /{case_id}/status", representative(http.HandlerFunc(h.SetStatus)))
	mux.Handle("PATCH /{case_id}/moderation", admin(http.HandlerFunc(h.Moderate)))
	mux.HandleFunc("GET /{case_id}/stages", h.ListStages)
	mux.Handle("POST /{case_id}/stages", representative(http.HandlerFunc(h.CreateStage)))
	mux.Handle("PATCH /{case_id}/stages/{stage_id}", representative(http.HandlerFunc(h.UpdateStage)))
	mux.Handle("PUT /{case_id}/stages/order", representative(http.HandlerFunc(h.ReorderStages)))
	mux.Handle("DELETE /{case_id}/stages/{stage_id}", representative(http.HandlerFunc(h.DeleteStage)))
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) ListStages(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	admin := false
	if claims, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, role := range claims.Roles {
			if role == "admin" {
				admin = true
			}
		}
	}
	items, err := h.service.ListStages(r.Context(), r.PathValue("case_id"), userID, true, admin)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (h *Handler) CreateStage(w http.ResponseWriter, r *http.Request) {
	var input models.CaseStageInput
	if !decodeJSON(w, r, &input) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.CreateStage(r.Context(), userID, r.PathValue("case_id"), input)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
func (h *Handler) DeleteStage(w http.ResponseWriter, r *http.Request) {
	u, _ := middleware.UserIDFromContext(r.Context())
	if err := h.service.DeleteStage(r.Context(), u, r.PathValue("case_id"), r.PathValue("stage_id")); err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteEmpty(w, http.StatusNoContent)
}

func (h *Handler) UpdateStage(w http.ResponseWriter, r *http.Request) {
	var input models.CaseStageInput
	if !decodeJSON(w, r, &input) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.UpdateStage(r.Context(), userID, r.PathValue("case_id"), r.PathValue("stage_id"), input)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) ReorderStages(w http.ResponseWriter, r *http.Request) {
	var input models.CaseStageOrderInput
	if !decodeJSON(w, r, &input) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	items, err := h.service.ReorderStages(r.Context(), userID, r.PathValue("case_id"), input.StageIDs)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request)           { h.list(w, r, false) }
func (h *Handler) ListModeration(w http.ResponseWriter, r *http.Request) { h.list(w, r, true) }

func (h *Handler) list(w http.ResponseWriter, r *http.Request, moderation bool) {
	filter, ok := parseFilter(w, r.URL.Query())
	if !ok {
		return
	}
	status := ""
	if moderation {
		status, ok = singleQuery(w, r.URL.Query(), "status")
		if !ok {
			return
		}
		if status == "" {
			status = "moderation"
		}
	}
	scope := cursorScope(r.URL.Query(), "cases")
	if moderation {
		scope = cursorScope(r.URL.Query(), "cases-moderation")
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
	var items []models.Case
	if moderation {
		items, err = h.service.ListForModeration(r.Context(), filter, status, query.Limit+1, position, id)
	} else {
		items, err = h.service.List(r.Context(), filter, query.Limit+1, position, id)
	}
	if err != nil {
		if errors.Is(err, cases_service.ErrInvalidFilter) || errors.Is(err, cases_service.ErrInvalidCursor) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return
		}
		writeCaseError(w, r, err)
		return
	}
	page, err := pagination.NewCursorPage(items, query.Limit, func(item models.Case) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: scope, Position: item.CreatedAt.UTC().Format(time.RFC3339Nano), ID: item.CaseID}, nil
	})
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, page)
}

func (h *Handler) Get(w http.ResponseWriter, r *http.Request) {
	item, err := h.service.Get(r.Context(), r.PathValue("case_id"))
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) GetManaged(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	claims, _ := middleware.TokenClaimsFromContext(r.Context())
	admin := false
	for _, role := range claims.Roles {
		if role == "admin" {
			admin = true
		}
	}
	item, err := h.service.GetManaged(r.Context(), userID, r.PathValue("case_id"), admin)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	request, ok := decodeCase(w, r)
	if !ok {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Create(r.Context(), userID, request.model())
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	request, ok := decodeCase(w, r)
	if !ok {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Update(r.Context(), userID, r.PathValue("case_id"), request.model())
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) SubmitForModeration(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.SubmitForModeration(r.Context(), userID, r.PathValue("case_id"))
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) SetStatus(w http.ResponseWriter, r *http.Request) {
	var request StatusRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	if strings.TrimSpace(request.Status) != "cancelled" {
		pkg.WriteError(w, http.StatusUnprocessableEntity, "invalid_status", "Only transition to cancelled is allowed here")
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Cancel(r.Context(), userID, r.PathValue("case_id"))
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}
func (h *Handler) Moderate(w http.ResponseWriter, r *http.Request) {
	var request ModerationRequest
	if !decodeJSON(w, r, &request) {
		return
	}
	userID, _ := middleware.UserIDFromContext(r.Context())
	item, err := h.service.Moderate(r.Context(), userID, r.PathValue("case_id"), request.Decision, request.Comment)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, item)
}

func decodeCase(w http.ResponseWriter, r *http.Request) (CaseRequest, bool) {
	var request CaseRequest
	return request, decodeJSON(w, r, &request)
}
func decodeJSON(w http.ResponseWriter, r *http.Request, target any) bool {
	decoder := json.NewDecoder(io.LimitReader(r.Body, 2<<20))
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

func parseFilter(w http.ResponseWriter, values url.Values) (models.CaseListFilter, bool) {
	allowed := map[string]bool{"limit": true, "cursor": true, "search": true, "company_id": true, "direction_id": true, "difficulty": true, "participation_mode": true, "work_format": true, "type": true, "event_format": true, "has_reward": true, "status": true}
	for key := range values {
		if !allowed[key] {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return models.CaseListFilter{}, false
		}
	}
	get := func(key string) (string, bool) { return singleQuery(w, values, key) }
	var filter models.CaseListFilter
	var ok bool
	if filter.Search, ok = get("search"); !ok {
		return filter, false
	}
	if filter.CompanyID, ok = get("company_id"); !ok {
		return filter, false
	}
	if filter.DirectionID, ok = get("direction_id"); !ok {
		return filter, false
	}
	if filter.Difficulty, ok = get("difficulty"); !ok {
		return filter, false
	}
	if filter.ParticipationMode, ok = get("participation_mode"); !ok {
		return filter, false
	}
	if filter.WorkFormat, ok = get("work_format"); !ok {
		return filter, false
	}
	if filter.Type, ok = get("type"); !ok {
		return filter, false
	}
	if filter.EventFormat, ok = get("event_format"); !ok {
		return filter, false
	}
	reward, ok := get("has_reward")
	if !ok {
		return filter, false
	}
	if reward != "" {
		value, err := strconv.ParseBool(reward)
		if err != nil {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
			return filter, false
		}
		filter.HasReward = &value
	}
	filter.Search = strings.TrimSpace(filter.Search)
	return filter, true
}
func singleQuery(w http.ResponseWriter, values url.Values, key string) (string, bool) {
	items, exists := values[key]
	if !exists {
		return "", true
	}
	if len(items) != 1 {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_query", "Query parameters are invalid")
		return "", false
	}
	return strings.TrimSpace(items[0]), true
}
func cursorScope(values url.Values, prefix string) string {
	copy := url.Values{}
	for key, items := range values {
		if key != "limit" && key != "cursor" {
			copy[key] = append([]string(nil), items...)
		}
	}
	sum := sha256.Sum256([]byte(copy.Encode()))
	return prefix + "-" + hex.EncodeToString(sum[:8])
}

func writeCaseError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, cases_service.ErrNotFound):
		pkg.WriteError(w, http.StatusNotFound, "case_not_found", "Case not found")
	case errors.Is(err, cases_service.ErrForbidden):
		pkg.WriteError(w, http.StatusForbidden, "case_access_denied", "Case access denied")
	case errors.Is(err, cases_service.ErrInvalidInput):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "validation_failed", "Case data is invalid")
	case errors.Is(err, cases_service.ErrReferenceNotFound):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "case_reference_not_found", "A referenced catalog item or file is unavailable")
	case errors.Is(err, cases_service.ErrInvalidTransition):
		pkg.WriteError(w, http.StatusConflict, "invalid_case_transition", "Case status transition is not allowed")
	case errors.Is(err, cases_service.ErrStagesLocked):
		pkg.WriteError(w, http.StatusConflict, "case_stages_locked", "Case stages cannot be changed after an execution has been created")
	default:
		middleware.QueueErrorLog(r.Context(), "case request failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "case_request_failed", "Case request failed")
	}
}
