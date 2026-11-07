package documentation_handler

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"

	apidocs "it-project-showcase/backend/docs"
)

type Handler struct{}

func Init() *Handler { return &Handler{} }

func (h *Handler) Start(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.UI)
	mux.HandleFunc("GET /openapi.yaml", h.Spec)
}

func (h *Handler) Spec(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/yaml; charset=utf-8")
	w.Header().Set("Cache-Control", "public, max-age=300")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(apidocs.OpenAPI)
}

func (h *Handler) UI(w http.ResponseWriter, _ *http.Request) {
	nonceBytes := make([]byte, 18)
	if _, err := rand.Read(nonceBytes); err != nil {
		http.Error(w, "failed to initialize API documentation", http.StatusInternalServerError)
		return
	}
	nonce := base64.RawStdEncoding.EncodeToString(nonceBytes)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", fmt.Sprintf("default-src 'none'; style-src https://unpkg.com 'unsafe-inline'; script-src https://unpkg.com 'nonce-%s'; img-src data: https://validator.swagger.io; connect-src 'self'", nonce))
	w.WriteHeader(http.StatusOK)
	_, _ = fmt.Fprintf(w, `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IT Project Showcase API</title><link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head><body><div id="swagger-ui"></div><script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script><script nonce="%s">SwaggerUIBundle({url:"/api/v1/docs/openapi.yaml",dom_id:"#swagger-ui",deepLinking:true,displayRequestDuration:true,persistAuthorization:true})</script></body></html>`, nonce)
}
