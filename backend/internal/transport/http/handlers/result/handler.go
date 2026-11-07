package result_handler

import (
	"encoding/json"
	"errors"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	results_service "it-project-showcase/backend/internal/services/results"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"net/http"
	"time"
)

type Handler struct{ s *results_service.Service }

func Init(s *results_service.Service) *Handler { return &Handler{s} }
func roles(r *http.Request) (bool, bool) {
	c, a := false, false
	if x, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, v := range x.Roles {
			c = c || v == "company_representative"
			a = a || v == "admin"
		}
	}
	return c, a
}
func user(r *http.Request) string { u, _ := middleware.UserIDFromContext(r.Context()); return u }
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(v) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return false
	}
	return true
}
func (h *Handler) StartExecutions(m *http.ServeMux) {
	m.HandleFunc("GET /{execution_id}/submissions", h.listSubmissions)
	m.HandleFunc("POST /{execution_id}/submissions", h.createSubmission)
	m.HandleFunc("GET /{execution_id}/awards", h.listAwards)
	m.HandleFunc("POST /{execution_id}/awards", h.createAward)
	m.HandleFunc("GET /{execution_id}/certificates", h.listCertificates)
	m.HandleFunc("POST /{execution_id}/certificates", h.createCertificate)
}
func (h *Handler) StartSubmissions(m *http.ServeMux) {
	m.HandleFunc("GET /{submission_id}", h.getSubmission)
	m.HandleFunc("GET /{submission_id}/evaluations", h.listEvaluations)
	m.HandleFunc("POST /{submission_id}/evaluations", h.createEvaluation)
	m.HandleFunc("GET /{submission_id}/reviews", h.listReviews)
	m.HandleFunc("POST /{submission_id}/reviews", h.addReview)
}
func (h *Handler) StartEvaluations(m *http.ServeMux) {
	m.HandleFunc("GET /{evaluation_id}", h.getEvaluation)
}
func (h *Handler) StartAwards(m *http.ServeMux) {
	m.HandleFunc("PATCH /{award_id}/fulfillment", h.updateFulfillment)
}
func (h *Handler) listSubmissions(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParseCursorQuery(r.URL.Query(), "submissions-"+r.PathValue("execution_id"))
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	c, a := roles(r)
	xs, e := h.s.ListSubmissions(r.Context(), user(r), r.PathValue("execution_id"), c, a, q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e, "submission")
		return
	}
	page, e := pagination.NewCursorPage(xs, q.Limit, func(x models.Submission) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: "submissions-" + r.PathValue("execution_id"), Position: x.SubmittedAt.UTC().Format(time.RFC3339Nano), ID: x.SubmissionID}, nil
	})
	if e != nil {
		h.err(w, r, e, "submission")
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) createSubmission(w http.ResponseWriter, r *http.Request) {
	var in models.SubmissionInput
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.CreateSubmission(r.Context(), user(r), r.PathValue("execution_id"), in)
	if e != nil {
		h.err(w, r, e, "submission")
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) getSubmission(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.GetSubmission(r.Context(), user(r), r.PathValue("submission_id"), c, a)
	if e != nil {
		h.err(w, r, e, "submission")
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) listEvaluations(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.ListEvaluations(r.Context(), user(r), r.PathValue("submission_id"), c, a)
	if e != nil {
		h.err(w, r, e, "evaluation")
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) createEvaluation(w http.ResponseWriter, r *http.Request) {
	var in models.EvaluationInput
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.CreateEvaluation(r.Context(), user(r), r.PathValue("submission_id"), in)
	if e != nil {
		h.err(w, r, e, "evaluation")
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) getEvaluation(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.GetEvaluation(r.Context(), user(r), r.PathValue("evaluation_id"), c, a)
	if e != nil {
		h.err(w, r, e, "evaluation")
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) addReview(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Decision string `json:"decision"`
		Body     string `json:"body"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.AddReview(r.Context(), user(r), r.PathValue("submission_id"), in.Decision, in.Body)
	if e != nil {
		h.err(w, r, e, "review")
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) listReviews(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.ListReviews(r.Context(), user(r), r.PathValue("submission_id"), c, a)
	if e != nil {
		h.err(w, r, e, "review")
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) listAwards(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.ListAwards(r.Context(), user(r), r.PathValue("execution_id"), c, a)
	if e != nil {
		h.err(w, r, e, "award")
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) createAward(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Title    string   `json:"title"`
		PlaceNo  *int     `json:"place_no"`
		Amount   *float64 `json:"amount"`
		Currency *string  `json:"currency"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.CreateAward(r.Context(), user(r), r.PathValue("execution_id"), in.Title, in.PlaceNo, in.Amount, in.Currency)
	if e != nil {
		h.err(w, r, e, "award")
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) updateFulfillment(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Status         string `json:"status"`
		Comment        string `json:"comment"`
		EvidenceFileID string `json:"evidence_file_id"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.UpdateFulfillment(r.Context(), user(r), r.PathValue("award_id"), in.Status, in.Comment, in.EvidenceFileID)
	if e != nil {
		h.err(w, r, e, "award")
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) listCertificates(w http.ResponseWriter, r *http.Request) {
	c, a := roles(r)
	x, e := h.s.ListCertificates(r.Context(), user(r), r.PathValue("execution_id"), c, a)
	if e != nil {
		h.err(w, r, e, "certificate")
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"items": x})
}
func (h *Handler) createCertificate(w http.ResponseWriter, r *http.Request) {
	var in struct {
		StudentID        string `json:"student_id"`
		FileID           string `json:"file_id"`
		VerificationCode string `json:"verification_code"`
	}
	if !decode(w, r, &in) {
		return
	}
	x, e := h.s.CreateCertificate(r.Context(), user(r), r.PathValue("execution_id"), in.StudentID, in.FileID, in.VerificationCode)
	if e != nil {
		h.err(w, r, e, "certificate")
		return
	}
	pkg.WriteJSON(w, 201, x)
}
func (h *Handler) err(w http.ResponseWriter, r *http.Request, e error, kind string) {
	switch {
	case errors.Is(e, results_service.ErrInvalid), errors.Is(e, results_service.ErrCursor):
		pkg.WriteError(w, 422, "validation_failed", "Result data is invalid")
	case errors.Is(e, results_service.ErrForbidden):
		pkg.WriteError(w, 403, "permission_denied", "Permission denied")
	case errors.Is(e, results_service.ErrConflict):
		pkg.WriteError(w, 409, "conflict", "Result conflicts with current state")
	case errors.Is(e, results_service.ErrNotFound):
		pkg.WriteError(w, 404, kind+"_not_found", "Resource not found")
	default:
		middleware.QueueErrorLog(r.Context(), "result request failed", e)
		pkg.WriteError(w, 500, "result_request_failed", "Result request failed")
	}
}
