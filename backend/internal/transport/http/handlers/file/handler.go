package file_handler

import (
	"errors"
	"io"
	"mime"
	"mime/multipart"
	"net/http"
	"strconv"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/models"
	files_service "it-project-showcase/backend/internal/services/files"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
	"it-project-showcase/backend/pkg"
)

type Handler struct{ service *files_service.Service }

func Init(service *files_service.Service) *Handler { return &Handler{service: service} }
func (h *Handler) Start(mux *http.ServeMux) {
	mux.HandleFunc("POST /", h.Upload)
	mux.HandleFunc("GET /{file_id}", h.Download)
	mux.HandleFunc("/", shared.NotFound)
}
func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	file, header, ok := h.multipartFile(w, r)
	if !ok {
		return
	}
	defer file.Close()
	defer r.MultipartForm.RemoveAll()
	userID, _ := middleware.UserIDFromContext(r.Context())
	created, err := h.service.Upload(r.Context(), userID, header.Filename, header.Size, file)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusCreated, created)
}
func (h *Handler) UploadCompanyLogo(w http.ResponseWriter, r *http.Request) {
	file, header, ok := h.multipartFile(w, r)
	if !ok {
		return
	}
	defer file.Close()
	defer r.MultipartForm.RemoveAll()
	userID, _ := middleware.UserIDFromContext(r.Context())
	created, err := h.service.UploadCompanyLogo(r.Context(), userID, r.PathValue("company_id"), header.Filename, header.Size, file)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, created)
}
func (h *Handler) UploadStudentPhoto(w http.ResponseWriter, r *http.Request) {
	file, header, ok := h.multipartFile(w, r)
	if !ok {
		return
	}
	defer file.Close()
	defer r.MultipartForm.RemoveAll()
	userID, _ := middleware.UserIDFromContext(r.Context())
	created, err := h.service.UploadStudentPhoto(r.Context(), userID, header.Filename, header.Size, file)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, created)
}
func (h *Handler) UploadUserAvatar(w http.ResponseWriter, r *http.Request) {
	file, header, ok := h.multipartFile(w, r)
	if !ok {
		return
	}
	defer file.Close()
	defer r.MultipartForm.RemoveAll()
	userID, _ := middleware.UserIDFromContext(r.Context())
	created, err := h.service.UploadUserAvatar(r.Context(), userID, header.Filename, header.Size, file)
	if err != nil {
		writeError(w, r, err)
		return
	}
	pkg.WriteJSON(w, http.StatusOK, created)
}
func (h *Handler) DownloadCompanyLogo(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadCompanyLogo(r.Context(), r.PathValue("company_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadCaseFile(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadPublicCaseFile(r.Context(), r.PathValue("case_id"), r.PathValue("file_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadCaseReviewFile(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadCaseReviewFile(r.Context(), r.PathValue("case_id"), r.PathValue("file_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}
func (h *Handler) DownloadProtectedCaseFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	admin := false
	if claims, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, role := range claims.Roles {
			if role == "admin" {
				admin = true
			}
		}
	}
	file, object, err := h.service.DownloadProtectedCaseFile(r.Context(), r.PathValue("case_id"), r.PathValue("file_id"), userID, admin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}
func (h *Handler) DownloadApplicationResume(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	claims, _ := middleware.TokenClaimsFromContext(r.Context())
	isAdmin := false
	for _, role := range claims.Roles {
		if role == "admin" {
			isAdmin = true
			break
		}
	}
	file, object, err := h.service.DownloadApplicationResume(r.Context(), r.PathValue("application_id"), userID, isAdmin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}
func (h *Handler) DownloadFeedbackFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	isAdmin := false
	if claims, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, role := range claims.Roles {
			isAdmin = isAdmin || role == "admin"
		}
	}
	file, object, err := h.service.DownloadFeedbackFile(r.Context(), r.PathValue("feedback_id"), r.PathValue("file_id"), userID, isAdmin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	w.Header().Set("Cache-Control", "private, no-store")
	switch file.MIMEType {
	case "image/png", "image/jpeg", "image/webp", "image/gif":
		writeDownload(w, r, file, object, true)
	default:
		writeDownload(w, r, file, object, false)
	}
}

func (h *Handler) DownloadInternshipResume(w http.ResponseWriter, r *http.Request) {
	user, _ := middleware.UserIDFromContext(r.Context())
	isAdmin := false
	if claims, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, role := range claims.Roles {
			isAdmin = isAdmin || role == "admin"
		}
	}
	file, object, err := h.service.DownloadInternshipResume(r.Context(), r.PathValue("application_id"), user, isAdmin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}

func (h *Handler) DownloadSubmissionFile(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	isAdmin := false
	if claims, ok := middleware.TokenClaimsFromContext(r.Context()); ok {
		for _, role := range claims.Roles {
			isAdmin = isAdmin || role == "admin"
		}
	}
	file, object, err := h.service.DownloadSubmissionFile(r.Context(), r.PathValue("submission_id"), r.PathValue("file_id"), userID, isAdmin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}
func (h *Handler) DownloadStudentProjectFile(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadStudentProjectFile(r.Context(), r.PathValue("project_id"), r.PathValue("file_id"), "published")
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	w.Header().Set("Cache-Control", "no-store")
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadStudentProjectReviewFile(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadStudentProjectFile(r.Context(), r.PathValue("project_id"), r.PathValue("file_id"), "moderation")
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}

func (h *Handler) DownloadStudentPhoto(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadStudentPhoto(r.Context(), r.PathValue("student_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	w.Header().Set("Cache-Control", "no-cache")
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadUserAvatar(w http.ResponseWriter, r *http.Request) {
	viewer, admin := eventFileActor(r)
	file, object, err := h.service.DownloadUserAvatar(r.Context(), r.PathValue("user_id"), viewer, admin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	w.Header().Set("Cache-Control", "private, no-store")
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadPortfolioFile(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadPublicPortfolioFile(r.Context(), r.PathValue("student_id"), r.PathValue("file_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	w.Header().Set("Cache-Control", "private, no-store")
	writeDownload(w, r, file, object, true)
}
func (h *Handler) DownloadCaseCover(w http.ResponseWriter, r *http.Request) {
	file, object, err := h.service.DownloadPublicCaseCover(r.Context(), r.PathValue("case_id"))
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, true)
}
func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	userID, _ := middleware.UserIDFromContext(r.Context())
	claims, claimsOK := middleware.TokenClaimsFromContext(r.Context())
	isAdmin := false
	if claimsOK {
		for _, role := range claims.Roles {
			if role == "admin" {
				isAdmin = true
				break
			}
		}
	}
	file, object, err := h.service.Download(r.Context(), r.PathValue("file_id"), userID, isAdmin)
	if err != nil {
		writeError(w, r, err)
		return
	}
	defer object.Close()
	writeDownload(w, r, file, object, false)
}
func (h *Handler) multipartFile(w http.ResponseWriter, r *http.Request) (multipart.File, *multipart.FileHeader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, h.service.MaxFileSize()+1024*1024)
	if err := r.ParseMultipartForm(1024 * 1024); err != nil {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
		var maxBytesError *http.MaxBytesError
		if !errors.As(err, &maxBytesError) {
			pkg.WriteError(w, http.StatusBadRequest, "invalid_multipart", "Invalid multipart request")
			return nil, nil, false
		}
		pkg.WriteError(w, http.StatusRequestEntityTooLarge, "file_too_large", "File exceeds the allowed size")
		return nil, nil, false
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
		pkg.WriteError(w, http.StatusBadRequest, "file_required", "Multipart field file is required")
		return nil, nil, false
	}
	return file, header, true
}
func writeDownload(w http.ResponseWriter, r *http.Request, file *models.File, reader io.Reader, public bool) {
	w.Header().Set("Content-Type", file.MIMEType)
	w.Header().Set("Content-Length", strconv.FormatInt(file.SizeBytes, 10))
	disposition := "attachment"
	if public {
		disposition = "inline"
		if w.Header().Get("Cache-Control") == "" {
			w.Header().Set("Cache-Control", "public, max-age=300")
		}
	} else {
		w.Header().Set("Cache-Control", "private, no-store")
	}
	w.Header().Set("Content-Disposition", mime.FormatMediaType(disposition, map[string]string{"filename": file.OriginalName}))
	w.Header().Set("ETag", `"`+file.ChecksumSHA256+`"`)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	if _, err := io.Copy(w, reader); err != nil {
		middleware.QueueErrorLog(r.Context(), "stream file failed", err)
	}
}
func writeError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, files_service.ErrNotFound):
		pkg.WriteError(w, http.StatusNotFound, "file_not_found", "File not found")
	case errors.Is(err, files_service.ErrEmpty), errors.Is(err, files_service.ErrInvalidName):
		pkg.WriteError(w, http.StatusUnprocessableEntity, "invalid_file", "File is invalid")
	case errors.Is(err, files_service.ErrTooLarge):
		pkg.WriteError(w, http.StatusRequestEntityTooLarge, "file_too_large", "File exceeds the allowed size")
	case errors.Is(err, files_service.ErrUnsupportedType):
		pkg.WriteError(w, http.StatusUnsupportedMediaType, "unsupported_file_type", "File type is not supported")
	case errors.Is(err, files_service.ErrCompanyAccess):
		pkg.WriteError(w, http.StatusForbidden, "company_access_denied", "Company access denied")
	default:
		middleware.QueueErrorLog(r.Context(), "file request failed", err)
		pkg.WriteError(w, http.StatusInternalServerError, "file_request_failed", "File request failed")
	}
}
