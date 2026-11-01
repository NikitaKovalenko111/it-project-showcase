package middleware

import (
	"net/http"

	"it-project-showcase/backend/pkg"
)

const (
	corsAllowedMethods = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
	corsAllowedHeaders = "Authorization, Content-Type, Accept, X-Request-ID"
)

func CORS(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, origin := range allowedOrigins {
		allowed[origin] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin == "" {
				next.ServeHTTP(w, r)
				return
			}
			if _, ok := allowed[origin]; !ok {
				pkg.WriteError(w, http.StatusForbidden, "cors_origin_forbidden", "Origin is not allowed")
				return
			}

			header := w.Header()
			header.Set("Access-Control-Allow-Origin", origin)
			header.Add("Vary", "Origin")
			header.Set("Access-Control-Expose-Headers", RequestIDHeader)

			if r.Method == http.MethodOptions {
				header.Set("Access-Control-Allow-Methods", corsAllowedMethods)
				header.Set("Access-Control-Allow-Headers", corsAllowedHeaders)
				header.Set("Access-Control-Max-Age", "600")
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}
