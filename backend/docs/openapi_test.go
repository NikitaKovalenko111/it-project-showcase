package apidocs

import (
	"bufio"
	"bytes"
	"strings"
	"testing"

	"github.com/goccy/go-yaml"
)

func TestOpenAPIContract(t *testing.T) {
	pathKeys := map[string]bool{}
	scanner := bufio.NewScanner(bytes.NewReader(OpenAPI))
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "  /") && strings.HasSuffix(line, ":") {
			path := strings.TrimSuffix(strings.TrimSpace(line), ":")
			if pathKeys[path] {
				t.Fatalf("duplicate path key %q", path)
			}
			pathKeys[path] = true
		}
	}
	var document map[string]any
	if err := yaml.Unmarshal(OpenAPI, &document); err != nil {
		t.Fatalf("parse openapi.yaml: %v", err)
	}
	if document["openapi"] != "3.0.3" {
		t.Fatalf("openapi version = %v", document["openapi"])
	}
	paths, ok := document["paths"].(map[string]any)
	if !ok || len(paths) < 45 {
		t.Fatalf("documented paths = %d, want at least 45", len(paths))
	}
	required := []string{
		"/auth/login", "/cases/{case_id}/comments", "/reports", "/teams/{team_id}/join-applications",
		"/cases/{case_id}/leaderboard", "/internships", "/portfolio/me/files", "/students/{student_id}/rating",
		"/cases/{case_id}/nda-versions", "/notifications/stream",
	}
	for _, path := range required {
		if _, exists := paths[path]; !exists {
			t.Errorf("required path %q is not documented", path)
		}
	}
	operationIDs := map[string]string{}
	for path, rawPath := range paths {
		pathItem, ok := rawPath.(map[string]any)
		if !ok {
			continue
		}
		for method, rawOperation := range pathItem {
			operation, ok := rawOperation.(map[string]any)
			if !ok {
				continue
			}
			operationID, _ := operation["operationId"].(string)
			if operationID == "" {
				t.Errorf("%s %s has no operationId", method, path)
				continue
			}
			if previous, duplicate := operationIDs[operationID]; duplicate {
				t.Errorf("duplicate operationId %q at %s and %s %s", operationID, previous, method, path)
			}
			operationIDs[operationID] = method + " " + path
		}
	}
	validateReferences(t, document, document)
}

func validateReferences(t *testing.T, root map[string]any, value any) {
	t.Helper()
	switch current := value.(type) {
	case map[string]any:
		if reference, ok := current["$ref"].(string); ok && strings.HasPrefix(reference, "#/") {
			var target any = root
			for _, segment := range strings.Split(strings.TrimPrefix(reference, "#/"), "/") {
				object, ok := target.(map[string]any)
				if !ok {
					t.Fatalf("reference %q does not resolve", reference)
				}
				target, ok = object[segment]
				if !ok {
					t.Fatalf("reference %q does not resolve at %q", reference, segment)
				}
			}
		}
		for _, child := range current {
			validateReferences(t, root, child)
		}
	case []any:
		for _, child := range current {
			validateReferences(t, root, child)
		}
	}
}
