package pagination

import (
	"encoding/json"
	"errors"
	"net/http/httptest"
	"testing"
)

func TestNewCursorResponseUsesEmptyItemsAndNullCursor(t *testing.T) {
	response := NewCursorResponse[string](nil, "")
	data, err := json.Marshal(response)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}
	if actual, expected := string(data), `{"items":[],"next_cursor":null}`; actual != expected {
		t.Fatalf("response JSON = %s, want %s", actual, expected)
	}
}

func TestNewPageResponseUsesQueryMetadata(t *testing.T) {
	response := NewPageResponse[string](nil, PageQuery{Page: 2, PageSize: 50, Offset: 50}, 123)
	if response.Items == nil {
		t.Fatal("items must be an empty array, not nil")
	}
	if response.Page != 2 || response.PageSize != 50 || response.Total != 123 {
		t.Fatalf("response = %#v", response)
	}
}

func TestNewCursorPageTrimsExtraItemAndBuildsCursor(t *testing.T) {
	items := []string{"first", "second", "extra"}
	response, err := NewCursorPage(items, 2, func(item string) (Cursor, error) {
		return Cursor{Scope: "cases", Position: item, ID: "id-2"}, nil
	})
	if err != nil {
		t.Fatalf("NewCursorPage() error = %v", err)
	}
	if len(response.Items) != 2 || response.Items[1] != "second" {
		t.Fatalf("items = %v, want [first second]", response.Items)
	}
	if response.NextCursor == nil {
		t.Fatal("next cursor is nil")
	}
	decoded, err := DecodeCursor(*response.NextCursor)
	if err != nil {
		t.Fatalf("DecodeCursor() error = %v", err)
	}
	if decoded.Position != "second" || decoded.ID != "id-2" || decoded.Scope != "cases" {
		t.Fatalf("decoded cursor = %#v", decoded)
	}
}

func TestNewCursorPageDoesNotBuildCursorForLastPage(t *testing.T) {
	response, err := NewCursorPage([]string{"only"}, 20, nil)
	if err != nil {
		t.Fatalf("NewCursorPage() error = %v", err)
	}
	if response.NextCursor != nil {
		t.Fatalf("next cursor = %q, want nil", *response.NextCursor)
	}
}

func TestQueryErrorDetail(t *testing.T) {
	err := &QueryError{Field: "limit", Code: "out_of_range", Message: "invalid limit"}
	detail := err.Detail()
	if detail.Field != err.Field || detail.Code != err.Code || detail.Message != err.Message {
		t.Fatalf("detail = %#v, want values from %#v", detail, err)
	}
}

func TestWriteQueryErrorUsesAPIErrorEnvelope(t *testing.T) {
	recorder := httptest.NewRecorder()
	err := &QueryError{Field: "limit", Code: "out_of_range", Message: "invalid limit"}

	if !WriteQueryError(recorder, err) {
		t.Fatal("WriteQueryError() did not handle QueryError")
	}
	if recorder.Code != 400 {
		t.Fatalf("status = %d, want 400", recorder.Code)
	}

	var response struct {
		Error struct {
			Code    string `json:"code"`
			Details []struct {
				Field string `json:"field"`
				Code  string `json:"code"`
			} `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(recorder.Body).Decode(&response); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if response.Error.Code != "invalid_query" || len(response.Error.Details) != 1 ||
		response.Error.Details[0].Field != "limit" || response.Error.Details[0].Code != "out_of_range" {
		t.Fatalf("unexpected response: %#v", response)
	}

	if WriteQueryError(httptest.NewRecorder(), errors.New("other")) {
		t.Fatal("WriteQueryError() handled a non-query error")
	}
}
