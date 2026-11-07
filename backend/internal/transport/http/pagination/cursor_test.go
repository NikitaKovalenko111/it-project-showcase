package pagination

import (
	"encoding/base64"
	"net/url"
	"testing"
)

func TestParseCursorQueryDefaults(t *testing.T) {
	query, err := ParseCursorQuery(url.Values{}, "cases")
	if err != nil {
		t.Fatalf("ParseCursorQuery() error = %v", err)
	}
	if query.Limit != DefaultLimit {
		t.Fatalf("limit = %d, want %d", query.Limit, DefaultLimit)
	}
	if query.Cursor != nil {
		t.Fatalf("cursor = %#v, want nil", query.Cursor)
	}
}

func TestCursorRoundTrip(t *testing.T) {
	expected := Cursor{
		Scope:    "cases",
		Position: "2026-11-01T12:30:00.123456789Z",
		ID:       "9d3bdc59-e28d-4f37-891b-e1105be486c7",
	}

	encoded, err := EncodeCursor(expected)
	if err != nil {
		t.Fatalf("EncodeCursor() error = %v", err)
	}
	actual, err := DecodeCursor(encoded)
	if err != nil {
		t.Fatalf("DecodeCursor() error = %v", err)
	}
	if actual != expected {
		t.Fatalf("decoded cursor = %#v, want %#v", actual, expected)
	}
}

func TestParseCursorQueryWithLimitAndCursor(t *testing.T) {
	encoded, err := EncodeCursor(Cursor{Scope: "cases", Position: "position", ID: "id-1"})
	if err != nil {
		t.Fatalf("EncodeCursor() error = %v", err)
	}

	query, err := ParseCursorQuery(url.Values{
		"limit":  {"50"},
		"cursor": {encoded},
	}, "cases")
	if err != nil {
		t.Fatalf("ParseCursorQuery() error = %v", err)
	}
	if query.Limit != 50 || query.Cursor == nil || query.Cursor.Position != "position" || query.Cursor.ID != "id-1" {
		t.Fatalf("unexpected query: %#v", query)
	}
}

func TestParseCursorQueryRejectsInvalidValues(t *testing.T) {
	tests := []struct {
		name      string
		values    url.Values
		wantField string
		wantCode  string
	}{
		{name: "zero limit", values: url.Values{"limit": {"0"}}, wantField: "limit", wantCode: "out_of_range"},
		{name: "large limit", values: url.Values{"limit": {"101"}}, wantField: "limit", wantCode: "out_of_range"},
		{name: "non integer limit", values: url.Values{"limit": {"many"}}, wantField: "limit", wantCode: "invalid_integer"},
		{name: "duplicate limit", values: url.Values{"limit": {"10", "20"}}, wantField: "limit", wantCode: "multiple_values"},
		{name: "invalid cursor", values: url.Values{"cursor": {"invalid"}}, wantField: "cursor", wantCode: "invalid_cursor"},
		{name: "empty cursor", values: url.Values{"cursor": {""}}, wantField: "cursor", wantCode: "invalid_cursor"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := ParseCursorQuery(test.values, "cases")
			queryErr, ok := err.(*QueryError)
			if !ok {
				t.Fatalf("error = %T %v, want *QueryError", err, err)
			}
			if queryErr.Field != test.wantField || queryErr.Code != test.wantCode {
				t.Fatalf("query error = %#v, want field=%q code=%q", queryErr, test.wantField, test.wantCode)
			}
		})
	}
}

func TestDecodeCursorRejectsUnknownFieldsAndVersion(t *testing.T) {
	tests := []string{
		`{"v":1,"s":"cases","p":"position","id":"id-1","extra":true}`,
		`{"v":2,"s":"cases","p":"position","id":"id-1"}`,
		`{"v":1,"s":"cases","p":"","id":"id-1"}`,
	}

	for _, payload := range tests {
		encoded := base64.RawURLEncoding.EncodeToString([]byte(payload))
		if _, err := DecodeCursor(encoded); err == nil {
			t.Fatalf("DecodeCursor() accepted payload %s", payload)
		}
	}
}

func TestParseCursorQueryRejectsCursorFromAnotherScope(t *testing.T) {
	encoded, err := EncodeCursor(Cursor{Scope: "student-projects", Position: "position", ID: "id-1"})
	if err != nil {
		t.Fatalf("EncodeCursor() error = %v", err)
	}

	_, err = ParseCursorQuery(url.Values{"cursor": {encoded}}, "cases")
	queryErr, ok := err.(*QueryError)
	if !ok || queryErr.Code != "invalid_cursor" {
		t.Fatalf("error = %T %v, want invalid_cursor", err, err)
	}
}
