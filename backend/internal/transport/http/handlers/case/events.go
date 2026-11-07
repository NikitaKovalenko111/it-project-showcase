package case_handler

import (
	"net/http"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/pkg"
)

func (h *Handler) StartEventPlans(mux *http.ServeMux, representative, optionalAuth func(http.Handler) http.Handler) {
	mux.Handle("GET /{case_id}/event-plan", optionalAuth(http.HandlerFunc(h.GetEventPlan)))
	mux.Handle("PUT /{case_id}/event-plan", representative(http.HandlerFunc(h.SetEventPlan)))
}

func (h *Handler) StartEventRounds(mux *http.ServeMux, student, manager func(http.Handler) http.Handler) {
	mux.Handle("POST /{execution_id}/rounds/{round_id}/submission", student(http.HandlerFunc(h.SubmitRound)))
	mux.Handle("PUT /{execution_id}/rounds/{round_id}/evaluation", manager(http.HandlerFunc(h.GradeRound)))
	mux.HandleFunc("GET /{execution_id}/round-submissions", h.ListRoundSubmissions)
}

func (h *Handler) GetEventPlan(w http.ResponseWriter, r *http.Request) {
	user, admin := eventActor(r)
	item, err := h.service.GetEventPlan(r.Context(), user, r.PathValue("case_id"), admin)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteJSON(w, 200, item)
}

func (h *Handler) SetEventPlan(w http.ResponseWriter, r *http.Request) {
	var input models.EventPlan
	if !decodeJSON(w, r, &input) {
		return
	}
	user, _ := eventActor(r)
	if err := h.service.SetEventPlan(r.Context(), user, r.PathValue("case_id"), input); err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteEmpty(w, 204)
}

func (h *Handler) SubmitRound(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Solutions []models.EventSolution `json:"solutions"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	user, _ := eventActor(r)
	if err := h.service.SubmitEventRound(r.Context(), user, r.PathValue("execution_id"), r.PathValue("round_id"), input.Solutions); err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteEmpty(w, 204)
}

func (h *Handler) GradeRound(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Scores []models.EventTaskScore `json:"scores"`
	}
	if !decodeJSON(w, r, &input) {
		return
	}
	user, admin := eventActor(r)
	if err := h.service.GradeEventRound(r.Context(), user, r.PathValue("execution_id"), r.PathValue("round_id"), admin, input.Scores); err != nil {
		writeCaseError(w, r, err)
		return
	}
	pkg.WriteEmpty(w, 204)
}

func (h *Handler) ListRoundSubmissions(w http.ResponseWriter, r *http.Request) {
	user, admin := eventActor(r)
	items, err := h.service.ListEventRoundSubmissions(r.Context(), user, r.PathValue("execution_id"), admin)
	if err != nil {
		writeCaseError(w, r, err)
		return
	}
	var total float64
	for _, item := range items {
		if item.TotalScore != nil {
			total += *item.TotalScore
		}
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": items, "total_score": total})
}

func eventActor(r *http.Request) (string, bool) {
	user, _ := middleware.UserIDFromContext(r.Context())
	claims, ok := middleware.TokenClaimsFromContext(r.Context())
	if ok {
		for _, role := range claims.Roles {
			if role == "admin" {
				return user, true
			}
		}
	}
	return user, false
}
