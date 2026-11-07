package auth_handler

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	auth_service "it-project-showcase/backend/internal/services/auth"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/pkg"
)

type AuthHandler struct {
	authService *auth_service.AuthService
}

func Init(authService *auth_service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

func (h *AuthHandler) Start(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	h.StartPublic(mux)
	h.StartProtected(mux, authorize)
}

func (h *AuthHandler) StartPublic(mux *http.ServeMux) {
	mux.HandleFunc("POST /register", h.Register)
	mux.HandleFunc("POST /login", h.Login)
	mux.HandleFunc("POST /refresh", h.Refresh)
	mux.HandleFunc("/register", shared.MethodNotAllowed)
	mux.HandleFunc("/login", shared.MethodNotAllowed)
	mux.HandleFunc("/refresh", shared.MethodNotAllowed)
}

func (h *AuthHandler) StartProtected(mux *http.ServeMux, authorize func(http.Handler) http.Handler) {
	mux.Handle("POST /logout", authorize(http.HandlerFunc(h.Logout)))
	mux.Handle("GET /me", authorize(http.HandlerFunc(h.Me)))
	mux.HandleFunc("/logout", shared.MethodNotAllowed)
	mux.HandleFunc("/me", shared.MethodNotAllowed)
	mux.HandleFunc("/", shared.NotFound)
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req RegisterRequest

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.QueueErrorLog(r.Context(), "failed to decode register request", err)
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}

	userID, err := h.authService.RegisterUser(r.Context(), req.model())
	if err != nil {
		middleware.QueueErrorLog(r.Context(), "registration failed", err)
		if errors.Is(err, context.DeadlineExceeded) {
			pkg.WriteError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out")
			return
		}
		if errors.Is(err, auth_service.ErrUsernameTaken) {
			pkg.WriteError(w, http.StatusConflict, "username_taken", "Username is already in use")
			return
		}
		if errors.Is(err, auth_service.ErrEmailTaken) {
			pkg.WriteError(w, http.StatusConflict, "email_taken", "Email is already in use")
			return
		}
		var validationErr *auth_service.ValidationError
		if errors.As(err, &validationErr) {
			pkg.WriteErrorDetails(w, http.StatusUnprocessableEntity, "validation_failed", "Request validation failed", []models.ErrorDetail{{
				Field: validationErr.Field, Code: validationErr.Code, Message: validationErr.Message,
			}})
			return
		}

		pkg.WriteError(w, http.StatusInternalServerError, "registration_failed", "Failed to register user")
		return
	}

	response := RegisterResponse{
		UserID:  userID,
		Message: "User registered successfully",
	}

	pkg.WriteJSON(w, http.StatusCreated, response)
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.QueueErrorLog(r.Context(), "failed to decode login request", err)
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}

	userID, accessToken, refreshToken, err := h.authService.LoginUser(r.Context(), req.Login, req.Password)
	if err != nil {
		middleware.QueueErrorLog(r.Context(), "login failed", err)
		if errors.Is(err, context.DeadlineExceeded) {
			pkg.WriteError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out")
			return
		}
		if errors.Is(err, auth_service.ErrInvalidCredentials) {
			pkg.WriteError(w, http.StatusUnauthorized, "invalid_credentials", "Invalid login or password")
			return
		}
		if errors.Is(err, auth_service.ErrAccountBlocked) {
			pkg.WriteError(w, http.StatusForbidden, "account_blocked", "User account is blocked")
			return
		}
		if errors.Is(err, auth_service.ErrAccountLocked) {
			pkg.WriteError(w, http.StatusLocked, "account_temporarily_locked", "Too many failed login attempts")
			return
		}
		if errors.Is(err, auth_service.ErrRoleAwaitingApproval) {
			pkg.WriteError(w, http.StatusForbidden, "role_approval_pending", "Moderator approval is required")
			return
		}
		if errors.Is(err, auth_service.ErrRoleRejected) {
			pkg.WriteError(w, http.StatusForbidden, "role_request_rejected", "Moderator rejected the role request")
			return
		}

		pkg.WriteError(w, http.StatusInternalServerError, "login_failed", "Failed to login")
		return
	}

	pkg.WriteJSON(w, http.StatusOK, newTokenResponse(userID, accessToken, refreshToken))
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req RefreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.QueueErrorLog(r.Context(), "failed to decode refresh request", err)
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}

	userID, accessToken, refreshToken, err := h.authService.RefreshTokens(r.Context(), req.RefreshToken)
	if err != nil {
		middleware.QueueErrorLog(r.Context(), "token refresh failed", err)
		if errors.Is(err, context.DeadlineExceeded) {
			pkg.WriteError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out")
			return
		}
		if errors.Is(err, auth_service.ErrInvalidRefreshToken) {
			pkg.WriteError(w, http.StatusUnauthorized, "invalid_refresh_token", "Invalid refresh token")
			return
		}
		if errors.Is(err, auth_service.ErrAccountBlocked) {
			pkg.WriteError(w, http.StatusForbidden, "account_blocked", "User account is blocked")
			return
		}

		pkg.WriteError(w, http.StatusInternalServerError, "refresh_failed", "Failed to refresh tokens")
		return
	}

	pkg.WriteJSON(w, http.StatusOK, newTokenResponse(userID, accessToken, refreshToken))
}

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req LogoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		middleware.QueueErrorLog(r.Context(), "failed to decode logout request", err)
		pkg.WriteError(w, http.StatusBadRequest, "invalid_request", "Invalid request payload")
		return
	}

	if err := h.authService.Logout(r.Context(), req.RefreshToken); err != nil {
		middleware.QueueErrorLog(r.Context(), "logout failed", err)
		if errors.Is(err, context.DeadlineExceeded) {
			pkg.WriteError(w, http.StatusGatewayTimeout, "request_timeout", "Request timed out")
			return
		}
		if errors.Is(err, auth_service.ErrInvalidRefreshToken) {
			pkg.WriteError(w, http.StatusUnauthorized, "invalid_refresh_token", "Invalid refresh token")
			return
		}

		pkg.WriteError(w, http.StatusInternalServerError, "logout_failed", "Failed to logout")
		return
	}

	pkg.WriteEmpty(w, http.StatusNoContent)
}

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		pkg.WriteError(w, http.StatusUnauthorized, "invalid_access_token", "Valid access token is required")
		return
	}

	user, err := h.authService.CurrentUser(r.Context(), userID)
	if err != nil {
		middleware.QueueErrorLog(r.Context(), "get current user failed", err)
		if errors.Is(err, auth_service.ErrUserNotFound) {
			pkg.WriteError(w, http.StatusNotFound, "user_not_found", "User not found")
			return
		}
		pkg.WriteError(w, http.StatusInternalServerError, "current_user_failed", "Failed to get current user")
		return
	}

	pkg.WriteJSON(w, http.StatusOK, newMeResponse(user))
}

func newTokenResponse(userID, accessToken, refreshToken string) TokenResponse {
	return TokenResponse{
		UserID:       userID,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
	}
}
