package shared

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestStandardRouteErrors(t *testing.T) {
	tests := []struct {
		name    string
		handler http.HandlerFunc
		status  int
		code    string
	}{
		{"not found", NotFound, http.StatusNotFound, "route_not_found"},
		{"method not allowed", MethodNotAllowed, http.StatusMethodNotAllowed, "method_not_allowed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			test.handler(recorder, httptest.NewRequest(http.MethodGet, "/", nil))
			if recorder.Code != test.status || !strings.Contains(recorder.Body.String(), test.code) {
				t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
			}
		})
	}
}
