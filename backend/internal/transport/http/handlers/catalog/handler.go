package catalog_handler

import (
	"encoding/json"
	"errors"
	"net/http"

	"it-project-showcase/backend/internal/middleware"
	catalogs_service "it-project-showcase/backend/internal/services/catalogs"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/pkg"
)

type Handler struct{ service *catalogs_service.Service }

func Init(service *catalogs_service.Service) *Handler { return &Handler{service: service} }
func (h *Handler) Start(mux *http.ServeMux, admin func(http.Handler) http.Handler) {
	mux.HandleFunc("GET /{catalog}", h.List)
	mux.Handle("POST /{catalog}", admin(http.HandlerFunc(h.Create)))
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	items, err := h.service.List(r.Context(), r.PathValue("catalog"))
	if err != nil {
		if errors.Is(err, catalogs_service.ErrUnsupportedCatalog) {
			pkg.WriteError(w, http.StatusNotFound, "catalog_not_found", "Catalog not found")
			return
		}
		middleware.QueueErrorLog(r.Context(), "list catalog failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "catalog_list_failed", "Failed to list catalog")
		return
	}
	pkg.WriteJSON(w, http.StatusOK, map[string]any{"items": items})
}
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var request CreateRequest
	if json.NewDecoder(r.Body).Decode(&request) != nil {
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}
	item, err := h.service.Create(r.Context(), r.PathValue("catalog"), request.Name, request.Kind)
	if err != nil {
		switch {
		case errors.Is(err, catalogs_service.ErrUnsupportedCatalog):
			pkg.WriteError(w, http.StatusNotFound, "catalog_not_found", "Catalog not found")
		case errors.Is(err, catalogs_service.ErrInvalidItem):
			pkg.WriteError(w, http.StatusUnprocessableEntity, "validation_failed", "Catalog item is invalid")
		case errors.Is(err, catalogs_service.ErrItemExists):
			pkg.WriteError(w, http.StatusConflict, "catalog_item_exists", "Catalog item already exists")
		default:
			middleware.QueueErrorLog(r.Context(), "create catalog item failed", err)
			pkg.WriteError(w, http.StatusInternalServerError, "catalog_create_failed", "Failed to create catalog item")
		}
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, item)
}
