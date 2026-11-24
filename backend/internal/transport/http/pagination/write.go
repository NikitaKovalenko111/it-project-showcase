package pagination

import (
	"errors"
	"net/http"

	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/pkg"
)

func WriteQueryError(w http.ResponseWriter, err error) bool {
	var queryErr *QueryError
	if !errors.As(err, &queryErr) {
		return false
	}

	pkg.WriteErrorDetails(
		w,
		http.StatusBadRequest,
		"invalid_query",
		"Query parameters are invalid",
		[]models.ErrorDetail{queryErr.Detail()},
	)
	return true
}
