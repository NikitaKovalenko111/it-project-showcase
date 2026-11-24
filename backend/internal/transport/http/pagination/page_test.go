package pagination

import (
	"net/url"
	"testing"
)

func TestParsePageQueryDefaults(t *testing.T) {
	query, err := ParsePageQuery(url.Values{})
	if err != nil {
		t.Fatalf("ParsePageQuery() error = %v", err)
	}
	if query.Page != DefaultPage || query.PageSize != DefaultPageSize || query.Offset != 0 {
		t.Fatalf("query = %#v, want default page", query)
	}
}

func TestParsePageQueryCalculatesOffset(t *testing.T) {
	query, err := ParsePageQuery(url.Values{
		"page":      {"3"},
		"page_size": {"25"},
	})
	if err != nil {
		t.Fatalf("ParsePageQuery() error = %v", err)
	}
	if query.Page != 3 || query.PageSize != 25 || query.Offset != 50 {
		t.Fatalf("query = %#v, want page=3 page_size=25 offset=50", query)
	}
}

func TestParsePageQueryRejectsInvalidValues(t *testing.T) {
	tests := []url.Values{
		{"page": {"0"}},
		{"page": {"first"}},
		{"page_size": {"0"}},
		{"page_size": {"101"}},
		{"page_size": {"10", "20"}},
	}

	for _, values := range tests {
		if _, err := ParsePageQuery(values); err == nil {
			t.Fatalf("ParsePageQuery() accepted %v", values)
		}
	}
}
