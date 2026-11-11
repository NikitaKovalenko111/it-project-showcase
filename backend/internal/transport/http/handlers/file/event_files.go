package file_handler

import (
	"it-project-showcase/backend/internal/middleware"
	"net/http"
	"strings"
)

func (h *Handler) StartEventFiles(cases, executions *http.ServeMux, authorize func(http.Handler) http.Handler) {
	cases.Handle("GET /{case_id}/rounds/{round_id}/tasks/{task_id}/files/{file_id}", authorize(http.HandlerFunc(h.DownloadEventTaskFile)))
	executions.HandleFunc("GET /{execution_id}/rounds/{round_id}/files/{file_id}", h.DownloadEventSolutionFile)
}

func (h *Handler) DownloadEventTaskFile(w http.ResponseWriter, r *http.Request) {
	user, admin := eventFileActor(r)
	file, object, err := h.service.DownloadEventTaskFile(r.Context(), user, r.PathValue("case_id"), strings.ToLower(r.PathValue("round_id")), strings.ToLower(r.PathValue("task_id")), r.PathValue("file_id"), admin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}

func (h *Handler) DownloadEventSolutionFile(w http.ResponseWriter, r *http.Request) {
	user, admin := eventFileActor(r)
	file, object, err := h.service.DownloadEventSolutionFile(r.Context(), user, r.PathValue("execution_id"), r.PathValue("round_id"), r.PathValue("file_id"), admin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}

func eventFileActor(r *http.Request) (string, bool) {
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
