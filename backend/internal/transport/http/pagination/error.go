package pagination

import (
	"fmt"

	"it-project-showcase/backend/internal/models"
)

type QueryError struct {
	Field   string
	Code    string
	Message string
}

func (e *QueryError) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Message)
}

func (e *QueryError) Detail() models.ErrorDetail {
	return models.ErrorDetail{
		Field:   e.Field,
		Code:    e.Code,
		Message: e.Message,
	}
}

func queryError(field, code, message string) error {
	return &QueryError{
		Field:   field,
		Code:    code,
		Message: message,
	}
}
