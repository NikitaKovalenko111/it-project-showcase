package files_service

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"it-project-showcase/backend/internal/models"
	"it-project-showcase/backend/internal/objectstorage"
	file_repo "it-project-showcase/backend/internal/storage/repositories/file"

	"github.com/google/uuid"
)

var (
	ErrNotFound        = errors.New("file not found")
	ErrEmpty           = errors.New("file is empty")
	ErrTooLarge        = errors.New("file is too large")
	ErrUnsupportedType = errors.New("unsupported file type")
	ErrInvalidName     = errors.New("invalid file name")
	ErrCompanyAccess   = errors.New("company access denied")
)
var allowedTypes = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "application/pdf": ".pdf", "text/plain; charset=utf-8": ".txt", "application/zip": ".zip"}
var logoTypes = map[string]string{"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}

type Service struct {
	repo    *file_repo.Repository
	objects objectstorage.Storage
	maxSize int64
}

func Init(repo *file_repo.Repository, objects objectstorage.Storage, maxSize int64) *Service {
	return &Service{repo: repo, objects: objects, maxSize: maxSize}
}
func (s *Service) MaxFileSize() int64 { return s.maxSize }

func (s *Service) Upload(ctx context.Context, uploader, name string, size int64, reader io.Reader) (*models.File, error) {
	return s.upload(ctx, uploader, "", name, size, reader, allowedTypes)
}
func (s *Service) UploadCompanyLogo(ctx context.Context, uploader, companyID, name string, size int64, reader io.Reader) (*models.File, error) {
	return s.upload(ctx, uploader, companyID, name, size, reader, logoTypes)
}
func (s *Service) UploadStudentPhoto(ctx context.Context, uploader, name string, size int64, reader io.Reader) (*models.File, error) {
	return s.upload(ctx, uploader, "student-photo", name, size, reader, logoTypes)
}
func (s *Service) upload(ctx context.Context, uploader, companyID, name string, size int64, reader io.Reader, types map[string]string) (*models.File, error) {
	if size <= 0 {
		return nil, ErrEmpty
	}
	if size > s.maxSize {
		return nil, ErrTooLarge
	}
	name = path.Base(strings.ReplaceAll(strings.TrimSpace(name), "\\", "/"))
	if name == "" || name == "." || len(name) > 255 || strings.ContainsAny(name, "\r\n\x00") {
		return nil, ErrInvalidName
	}
	header := make([]byte, 512)
	read, err := io.ReadFull(reader, header)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("read file header: %w", err)
	}
	header = header[:read]
	mimeType := http.DetectContentType(header)
	extension, ok := types[mimeType]
	if !ok {
		return nil, ErrUnsupportedType
	}
	key, err := objectKey(extension)
	if err != nil {
		return nil, err
	}
	hash := sha256.New()
	stream := io.TeeReader(io.MultiReader(bytes.NewReader(header), reader), hash)
	if err := s.objects.Put(ctx, key, stream, size, mimeType); err != nil {
		return nil, fmt.Errorf("store file object: %w", err)
	}
	metadata := models.File{StorageKey: key, OriginalName: name, MIMEType: mimeType, SizeBytes: size, UploadedBy: uploader}
	metadata.ChecksumSHA256 = hex.EncodeToString(hash.Sum(nil))
	var created *models.File
	var oldKey string
	if companyID == "" {
		created, err = s.repo.Create(ctx, metadata)
	} else if companyID == "student-photo" {
		created, oldKey, err = s.repo.CreateStudentPhoto(ctx, uploader, metadata)
		if errors.Is(err, sql.ErrNoRows) {
			err = ErrNotFound
		}
	} else {
		created, oldKey, err = s.repo.CreateCompanyLogo(ctx, uploader, companyID, metadata)
		if errors.Is(err, sql.ErrNoRows) {
			err = ErrCompanyAccess
		}
	}
	if err != nil {
		s.deleteObject(ctx, key)
		return nil, err
	}
	if oldKey != "" {
		s.deleteObject(ctx, oldKey)
	}
	return created, nil
}
func (s *Service) Download(ctx context.Context, fileID, userID string, isAdmin bool) (*models.File, io.ReadCloser, error) {
	if _, err := uuid.Parse(fileID); err != nil {
		return nil, nil, ErrNotFound
	}
	file, err := s.repo.GetAccessible(ctx, fileID, userID, isAdmin)
	return s.open(ctx, file, err)
}
func (s *Service) DownloadCompanyLogo(ctx context.Context, companyID string) (*models.File, io.ReadCloser, error) {
	if _, err := uuid.Parse(companyID); err != nil {
		return nil, nil, ErrNotFound
	}
	file, err := s.repo.GetPublicCompanyLogo(ctx, companyID)
	return s.open(ctx, file, err)
}
func (s *Service) DownloadPublicCaseFile(ctx context.Context, caseID, fileID string) (*models.File, io.ReadCloser, error) {
	if _, err := uuid.Parse(caseID); err != nil {
		return nil, nil, ErrNotFound
	}
	if _, err := uuid.Parse(fileID); err != nil {
		return nil, nil, ErrNotFound
	}
	file, err := s.repo.GetPublicCaseFile(ctx, caseID, fileID)
	return s.open(ctx, file, err)
}
func (s *Service) DownloadProtectedCaseFile(ctx context.Context, caseID, fileID, userID string, isAdmin bool) (*models.File, io.ReadCloser, error) {
	if _, err := uuid.Parse(caseID); err != nil {
		return nil, nil, ErrNotFound
	}
	if _, err := uuid.Parse(fileID); err != nil {
		return nil, nil, ErrNotFound
	}
	file, err := s.repo.GetProtectedCaseFile(ctx, caseID, fileID, userID, isAdmin)
	return s.open(ctx, file, err)
}
func (s *Service) DownloadApplicationResume(ctx context.Context, applicationID, userID string, isAdmin bool) (*models.File, io.ReadCloser, error) {
	if _, err := uuid.Parse(applicationID); err != nil {
		return nil, nil, ErrNotFound
	}
	file, err := s.repo.GetApplicationResume(ctx, applicationID, userID, isAdmin)
	return s.open(ctx, file, err)
}
func (s *Service) open(ctx context.Context, file *models.File, err error) (*models.File, io.ReadCloser, error) {
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil, ErrNotFound
		}
		return nil, nil, err
	}
	object, err := s.objects.Get(ctx, file.StorageKey)
	if err != nil {
		return nil, nil, fmt.Errorf("read file object: %w", err)
	}
	return file, object, nil
}
func (s *Service) deleteObject(parent context.Context, key string) {
	cleanupContext, cancel := context.WithTimeout(context.WithoutCancel(parent), 5*time.Second)
	defer cancel()
	_ = s.objects.Delete(cleanupContext, key)
}
func objectKey(extension string) (string, error) {
	value := make([]byte, 24)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate object key: %w", err)
	}
	encoded := hex.EncodeToString(value)
	return encoded[:2] + "/" + encoded[2:4] + "/" + encoded + extension, nil
}
