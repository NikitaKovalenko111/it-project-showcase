package pkg

import (
	"encoding/json"
	"net/http"

	"it-project-showcase/backend/internal/models"
)

func WriteJSON(w http.ResponseWriter, status int, data any) error {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	return json.NewEncoder(w).Encode(data)
}

func WriteEmpty(w http.ResponseWriter, status int) {
	w.WriteHeader(status)
}

func WriteError(w http.ResponseWriter, status int, code string, message string) {
	WriteErrorDetails(w, status, code, message, nil)
}

func WriteErrorDetails(w http.ResponseWriter, status int, code string, message string, details []models.ErrorDetail) {
	response := models.ErrorResponse{
		Error: models.APIError{
			Code:      code,
			Message:   message,
			Details:   details,
			RequestID: w.Header().Get("X-Request-ID"),
		},
	}

	WriteJSON(w, status, response)
}
