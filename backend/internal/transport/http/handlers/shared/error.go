package shared

import (
	"net/http"

	"it-project-showcase/backend/pkg"
)

func NotFound(w http.ResponseWriter, r *http.Request) {
	pkg.WriteError(w, http.StatusNotFound, "route_not_found", "Route not found")
}

func MethodNotAllowed(w http.ResponseWriter, r *http.Request) {
	pkg.WriteError(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
}
