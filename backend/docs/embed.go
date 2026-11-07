package apidocs

import _ "embed"

// OpenAPI is the canonical API contract served by the backend.
//
//go:embed openapi.yaml
var OpenAPI []byte
