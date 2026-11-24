package platform_handler

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListFavoritesRejectsInvalidCursorQuery(t *testing.T) {
	recorder := httptest.NewRecorder()
	Init(nil).ListFavorites(recorder, httptest.NewRequest(http.MethodGet, "/favorites?limit=bad", nil))
	if recorder.Code != http.StatusBadRequest {
		t.Fatalf("status = %d", recorder.Code)
	}
}
