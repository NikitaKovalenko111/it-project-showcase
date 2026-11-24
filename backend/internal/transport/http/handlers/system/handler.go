package system_handler

import (
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/pkg"
	"net/http"
)

type SystemHandler struct {
}

func Init() *SystemHandler {
	return &SystemHandler{}
}

func (h *SystemHandler) Start(mux *http.ServeMux) {
	mux.HandleFunc("GET /health", h.Health)
	mux.HandleFunc("/health", shared.MethodNotAllowed)
	mux.HandleFunc("/", shared.NotFound)
}

func (h *SystemHandler) Health(w http.ResponseWriter, r *http.Request) {
	pkg.WriteEmpty(w, http.StatusOK)
}
