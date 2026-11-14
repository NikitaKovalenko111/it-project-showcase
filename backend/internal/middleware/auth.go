package middleware

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"it-project-showcase/backend/pkg"
)

type authContextKey uint8

const accessTokenClaimsContextKey authContextKey = iota

type AccessRoleLookup func(context.Context, string) ([]string, error)

func Authorization(accessSecret string, logger *slog.Logger, lookups ...AccessRoleLookup) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString, ok := bearerToken(r.Header.Get("Authorization"))
			if !ok {
				logger.Warn("authorization failed", slog.String("error", "missing or malformed bearer token"))
				pkg.WriteError(w, http.StatusUnauthorized, "invalid_access_token", "Valid access token is required")
				return
			}

			claims, err := pkg.ValidateAccessToken(tokenString, accessSecret)
			if err != nil {
				logger.Warn("authorization failed", slog.Any("error", err))
				pkg.WriteError(w, http.StatusUnauthorized, "invalid_access_token", "Valid access token is required")
				return
			}

			if len(lookups) > 0 {
				current, err := lookups[0](r.Context(), claims.Subject)
				if err != nil {
					QueueErrorLog(r.Context(), "check current access roles", err)
					pkg.WriteError(w, http.StatusServiceUnavailable, "auth_unavailable", "Authorization unavailable")
					return
				}
				matched := len(current) > 0 && len(current) == len(claims.Roles)
				for _, role := range claims.Roles {
					if !slices.Contains(current, role) {
						matched = false
					}
				}
				if !matched {
					pkg.WriteError(w, http.StatusUnauthorized, "invalid_access_token", "Valid access token is required")
					return
				}
			}

			ctx := context.WithValue(r.Context(), accessTokenClaimsContextKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	claims, ok := TokenClaimsFromContext(ctx)
	if !ok || claims.Subject == "" {
		return "", false
	}

	return claims.Subject, true
}

func TokenClaimsFromContext(ctx context.Context) (*pkg.TokenClaims, bool) {
	claims, ok := ctx.Value(accessTokenClaimsContextKey).(*pkg.TokenClaims)

	return claims, ok
}

func RequireAnyRole(roles ...string) func(http.Handler) http.Handler {
	required := make(map[string]struct{}, len(roles))
	for _, role := range roles {
		required[role] = struct{}{}
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := TokenClaimsFromContext(r.Context())
			if !ok || !containsAnyRole(claims.Roles, required) {
				pkg.WriteError(w, http.StatusForbidden, "permission_denied", "Permission denied")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func containsAnyRole(actual []string, required map[string]struct{}) bool {
	for _, role := range actual {
		if _, ok := required[role]; ok {
			return true
		}
	}
	return false
}

func bearerToken(authorizationHeader string) (string, bool) {
	parts := strings.Fields(authorizationHeader)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") || parts[1] == "" {
		return "", false
	}

	return parts[1], true
}
