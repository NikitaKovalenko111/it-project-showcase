package documentation_handler

import (
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
)

func TestSpec(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init().Spec(recorder, httptest.NewRequest(http.MethodGet, "/docs/openapi.yaml", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if got := recorder.Header().Get("Content-Type"); !strings.Contains(got, "application/yaml") {
		t.Fatalf("content type = %q", got)
	}
	if !strings.Contains(recorder.Body.String(), "openapi: 3.0.3") {
		t.Fatal("response does not contain OpenAPI document")
	}
}

func TestUIReferencesVersionedSpec(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init().UI(recorder, httptest.NewRequest(http.MethodGet, "/docs", nil))
	if recorder.Code != http.StatusOK || !strings.Contains(recorder.Body.String(), "/api/v1/docs/openapi.yaml") {
		t.Fatalf("swagger UI response is invalid: status=%d", recorder.Code)
	}

	csp := recorder.Header().Get("Content-Security-Policy")
	nonceMatch := regexp.MustCompile(`script-src[^;]*'nonce-([^']+)'`).FindStringSubmatch(csp)
	if len(nonceMatch) != 2 {
		t.Fatalf("CSP does not allow the inline Swagger initializer: %q", csp)
	}
	if !strings.Contains(recorder.Body.String(), `nonce="`+nonceMatch[1]+`"`) {
		t.Fatal("Swagger initializer nonce does not match CSP")
	}
}
