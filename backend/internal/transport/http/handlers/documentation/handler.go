package documentation_handler

import (
	"net/http"

	apidocs "it-project-showcase/backend/docs"
)

type Handler struct{}

func Init() *Handler { return &Handler{} }

func (h *Handler) Spec(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(apidocs.OpenAPI)
}

func (h *Handler) UI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; style-src https://unpkg.com; script-src https://unpkg.com; img-src data: https://validator.swagger.io; connect-src 'self'")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IT Project Showcase API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script>SwaggerUIBundle({url:"/api/v1/docs/openapi.yaml",dom_id:"#swagger-ui",deepLinking:true,displayRequestDuration:true,persistAuthorization:true})</script></body></html>`))
}
