package files_service

import (
	"bytes"
	"context"
	"errors"
	"io"
	"regexp"
	"testing"
	"time"

	"it-project-showcase/backend/internal/objectstorage"
	file_repo "it-project-showcase/backend/internal/storage/repositories/file"

	"github.com/DATA-DOG/go-sqlmock"
)

type memoryObjects struct {
	put      []byte
	deleted  []string
	putCalls int
}

func (m *memoryObjects) Put(_ context.Context, _ string, reader io.Reader, _ int64, _ string) error {
	m.putCalls++
	value, err := io.ReadAll(reader)
	m.put = value
	return err
}
func (m *memoryObjects) Get(context.Context, string) (io.ReadCloser, error) {
	return nil, errors.New("not implemented")
}
func (m *memoryObjects) Delete(_ context.Context, key string) error {
	m.deleted = append(m.deleted, key)
	return nil
}

var _ objectstorage.Storage = (*memoryObjects)(nil)

func TestUploadDetectsContentAndPersistsChecksum(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	objects := &memoryObjects{}
	service := Init(file_repo.Init(db), objects, 1024)
	data := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO files (storage_key,original_name,mime_type,size_bytes,checksum_sha256,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING file_id, storage_key, original_name, mime_type, size_bytes, checksum_sha256, uploaded_by, created_at`)).WithArgs(sqlmock.AnyArg(), "avatar.png", "image/png", int64(len(data)), "4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6", "user-1").WillReturnRows(sqlmock.NewRows([]string{"file_id", "storage_key", "original_name", "mime_type", "size_bytes", "checksum_sha256", "uploaded_by", "created_at"}).AddRow("file-1", "ab/key.png", "avatar.png", "image/png", len(data), "checksum", "user-1", time.Now()))
	file, err := service.Upload(context.Background(), "user-1", "avatar.png", int64(len(data)), bytes.NewReader(data))
	if err != nil {
		t.Fatal(err)
	}
	if file.FileID != "file-1" {
		t.Fatalf("file id = %q", file.FileID)
	}
	if !bytes.Equal(objects.put, data) {
		t.Fatalf("stored bytes = %v", objects.put)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatal(err)
	}
}

func TestUploadDeletesObjectWhenMetadataFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	objects := &memoryObjects{}
	service := Init(file_repo.Init(db), objects, 1024)
	data := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}
	mock.ExpectQuery("INSERT INTO files").WillReturnError(errors.New("database unavailable"))
	_, err = service.Upload(context.Background(), "user-1", "avatar.png", int64(len(data)), bytes.NewReader(data))
	if err == nil {
		t.Fatal("error = nil")
	}
	if len(objects.deleted) != 1 {
		t.Fatalf("deleted objects = %d, want 1", len(objects.deleted))
	}
}

func TestCompanyLogoRejectsPDFBeforeObjectStorage(t *testing.T) {
	objects := &memoryObjects{}
	service := Init(nil, objects, 1024)
	data := []byte("%PDF-1.7\n")
	_, err := service.UploadCompanyLogo(context.Background(), "user", "company", "document.pdf", int64(len(data)), bytes.NewReader(data))
	if !errors.Is(err, ErrUnsupportedType) {
		t.Fatalf("error = %v", err)
	}
	if objects.putCalls != 0 {
		t.Fatal("unsupported object was stored")
	}
}
