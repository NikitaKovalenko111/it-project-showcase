package platform_handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	platform_service "it-project-showcase/backend/internal/services/platform"
	"it-project-showcase/backend/internal/transport/http/pagination"
	"it-project-showcase/backend/pkg"
	"mime"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Handler struct{ s *platform_service.Service }

func Init(s *platform_service.Service) *Handler { return &Handler{s} }
func user(r *http.Request) string               { u, _ := middleware.UserIDFromContext(r.Context()); return u }
func admin(r *http.Request) bool {
	x, ok := middleware.TokenClaimsFromContext(r.Context())
	if ok {
		for _, v := range x.Roles {
			if v == "admin" {
				return true
			}
		}
	}
	return false
}
func (h *Handler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParseCursorQuery(r.URL.Query(), "favorites")
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	xs, e := h.s.ListFavorites(r.Context(), user(r), q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(xs, q.Limit, func(x models.Favorite) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: "favorites", Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.ResourceID}, nil
	})
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) Favorite(w http.ResponseWriter, r *http.Request) {
	e := h.s.SetFavorite(r.Context(), user(r), r.PathValue("resource_type"), r.PathValue("resource_id"), r.Method == http.MethodPut)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, map[string]any{"favorite": r.Method == http.MethodPut})
}
func (h *Handler) ListNotifications(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParseCursorQuery(r.URL.Query(), "notifications")
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	unread := false
	if raw := r.URL.Query().Get("unread_only"); raw != "" {
		var parseErr error
		unread, parseErr = strconv.ParseBool(raw)
		if parseErr != nil {
			pkg.WriteError(w, 400, "invalid_query", "unread_only must be true or false")
			return
		}
	}
	xs, e := h.s.ListNotifications(r.Context(), user(r), unread, q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(xs, q.Limit, func(x models.Notification) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: "notifications", Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.NotificationID}, nil
	})
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) ReadNotification(w http.ResponseWriter, r *http.Request) {
	if e := h.s.ReadNotification(r.Context(), user(r), r.PathValue("notification_id")); e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteEmpty(w, 204)
}
func (h *Handler) ReadAll(w http.ResponseWriter, r *http.Request) {
	if e := h.s.ReadAll(r.Context(), user(r)); e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteEmpty(w, 204)
}

func (h *Handler) StreamNotifications(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		pkg.WriteError(w, 500, "sse_not_supported", "Streaming is not supported")
		return
	}
	lastEventID := strings.TrimSpace(r.Header.Get("Last-Event-ID"))
	created, markerID, err := h.s.NotificationStreamStart(r.Context(), user(r), lastEventID)
	if err != nil {
		h.err(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache, no-transform")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	controller := http.NewResponseController(w)
	claims, _ := middleware.TokenClaimsFromContext(r.Context())
	expires := time.NewTimer(time.Until(claims.ExpiresAt.Time))
	defer expires.Stop()
	_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Second))
	_, _ = fmt.Fprint(w, "retry: 3000\nevent: connected\ndata: {}\n\n")
	flusher.Flush()
	poll := time.NewTicker(2 * time.Second)
	defer poll.Stop()
	heartbeat := time.NewTicker(15 * time.Second)
	defer heartbeat.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case <-expires.C:
			_ = controller.SetWriteDeadline(time.Now().Add(5 * time.Second))
			_, _ = fmt.Fprint(w, "event: token_expired\ndata: {}\n\n")
			flusher.Flush()
			return
		case <-heartbeat.C:
			_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Second))
			if _, err = fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
				return
			}
			flusher.Flush()
		case <-poll.C:
			items, loadErr := h.s.NotificationsAfter(r.Context(), user(r), created, markerID)
			if loadErr != nil {
				middleware.QueueErrorLog(r.Context(), "load SSE notifications failed", loadErr)
				return
			}
			for _, item := range items {
				data, marshalErr := json.Marshal(item)
				if marshalErr != nil {
					middleware.QueueErrorLog(r.Context(), "encode SSE notification failed", marshalErr)
					return
				}
				_ = controller.SetWriteDeadline(time.Now().Add(30 * time.Second))
				if _, err = fmt.Fprintf(w, "id: %s\nevent: notification\ndata: %s\n\n", item.NotificationID, data); err != nil {
					return
				}
				created, markerID = item.CreatedAt, item.NotificationID
			}
			if len(items) > 0 {
				flusher.Flush()
			}
		}
	}
}
func (h *Handler) ListAudit(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParsePageQuery(r.URL.Query())
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	xs, total, e := h.s.ListAudit(r.Context(), r.URL.Query().Get("entity_type"), r.URL.Query().Get("action"), q.PageSize, q.Offset)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, pagination.NewPageResponse(xs, q, total))
}
func (h *Handler) SearchStudents(w http.ResponseWriter, r *http.Request) {
	q, e := pagination.ParseCursorQuery(r.URL.Query(), "student-search")
	if e != nil {
		pagination.WriteQueryError(w, e)
		return
	}
	pos, id := "", ""
	if q.Cursor != nil {
		pos, id = q.Cursor.Position, q.Cursor.ID
	}
	xs, e := h.s.SearchStudents(r.Context(), r.URL.Query().Get("search"), r.URL.Query().Get("direction"), r.URL.Query().Get("technology"), q.Limit+1, pos, id)
	if e != nil {
		h.err(w, r, e)
		return
	}
	page, e := pagination.NewCursorPage(xs, q.Limit, func(x models.StudentSearchItem) (pagination.Cursor, error) {
		return pagination.Cursor{Scope: "student-search", Position: x.CreatedAt.UTC().Format(time.RFC3339Nano), ID: x.UserID}, nil
	})
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, page)
}
func (h *Handler) GetPortfolio(w http.ResponseWriter, r *http.Request) {
	x, e := h.s.GetPortfolio(r.Context(), user(r), r.PathValue("student_id"), admin(r))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) GetMyPortfolio(w http.ResponseWriter, r *http.Request) {
	x, e := h.s.GetPortfolio(r.Context(), user(r), user(r), admin(r))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) UpdatePortfolio(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Visibility string `json:"visibility"`
		Headline   string `json:"headline"`
		About      string `json:"about"`
	}
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil {
		pkg.WriteError(w, 400, "invalid_request", "Invalid request payload")
		return
	}
	x, e := h.s.UpdatePortfolio(r.Context(), user(r), in.Visibility, in.Headline, in.About)
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Analytics(w http.ResponseWriter, r *http.Request) {
	x, e := h.s.Analytics(r.Context(), user(r), r.URL.Query().Get("company_id"), admin(r))
	if e != nil {
		h.err(w, r, e)
		return
	}
	pkg.WriteJSON(w, 200, x)
}
func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	data, contentType, name, e := h.s.Export(r.Context(), user(r), r.URL.Query().Get("resource"), r.URL.Query().Get("format"), r.URL.Query().Get("company_id"), admin(r))
	if e != nil {
		h.err(w, r, e)
		return
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(200)
	_, _ = w.Write(data)
}
func (h *Handler) err(w http.ResponseWriter, r *http.Request, e error) {
	switch {
	case errors.Is(e, platform_service.ErrInvalid), errors.Is(e, platform_service.ErrCursor):
		pkg.WriteError(w, 422, "validation_failed", "Request data is invalid")
	case errors.Is(e, platform_service.ErrForbidden):
		pkg.WriteError(w, 403, "permission_denied", "Permission denied")
	case errors.Is(e, platform_service.ErrNotFound):
		pkg.WriteError(w, 404, "resource_not_found", "Resource not found")
	default:
		middleware.QueueErrorLog(r.Context(), "platform request failed", e)
		pkg.WriteError(w, 500, "platform_request_failed", "Platform request failed")
	}
}
