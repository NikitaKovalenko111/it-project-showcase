package opportunity_handler

import (
	"net/http"

	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
)

func (h *Handler) StartInternshipApplications(mux *http.ServeMux, student, representative, workflow func(http.Handler) http.Handler) {
	mux.Handle("POST /{program_id}/applications", student(http.HandlerFunc(h.ApplyInternship)))
	mux.Handle("GET /{program_id}/applications", representative(http.HandlerFunc(h.ListInternshipApplications)))
	mux.Handle("GET /applications/mine", student(http.HandlerFunc(h.ListMyInternshipApplications)))
	mux.Handle("PATCH /applications/{application_id}/status", workflow(http.HandlerFunc(h.DecideInternshipApplication)))
}

func (h *Handler) ApplyInternship(w http.ResponseWriter, r *http.Request) {
	var input struct {
		CoverLetter  string `json:"cover_letter"`
		ResumeFileID string `json:"resume_file_id"`
	}
	if !decode(w, r, &input) {
		return
	}
	item, err := h.service.ApplyInternship(r.Context(), user(r), r.PathValue("program_id"), input.CoverLetter, input.ResumeFileID)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, 201, item)
}

func (h *Handler) ListInternshipApplications(w http.ResponseWriter, r *http.Request) {
	h.listInternshipApplications(w, r, false)
}

func (h *Handler) ListMyInternshipApplications(w http.ResponseWriter, r *http.Request) {
	h.listInternshipApplications(w, r, true)
}

func (h *Handler) listInternshipApplications(w http.ResponseWriter, r *http.Request, mine bool) {
	query, err := pagination.ParsePageQuery(r.URL.Query())
	if err != nil {
		pagination.WriteQueryError(w, err)
		return
	}
	items, total, err := h.service.ListInternshipApplications(r.Context(), user(r), r.PathValue("program_id"), mine, query.PageSize, query.Offset)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, 200, pagination.NewPageResponse(items, query, total))
}

func (h *Handler) DecideInternshipApplication(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Status string `json:"status"`
	}
	if !decode(w, r, &input) {
		return
	}
	item, err := h.service.DecideInternshipApplication(r.Context(), user(r), r.PathValue("application_id"), input.Status)
	if err != nil {
		writeError(w, err)
		return
	}
	pkg.WriteJSON(w, 200, item)
}
