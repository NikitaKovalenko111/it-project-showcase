package objectstorage

import (
	"context"
	"fmt"
	"io"

	"it-project-showcase/backend/internal/config"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

type MinIO struct {
	client *minio.Client
	bucket string
}

func Connect(ctx context.Context, cfg config.ObjectStorage) (*MinIO, error) {
	client, err := minio.New(cfg.Endpoint, &minio.Options{Creds: credentials.NewStaticV4(cfg.AccessKey, cfg.SecretKey, ""), Secure: cfg.UseSSL, Region: cfg.Region})
	if err != nil {
		return nil, fmt.Errorf("create minio client: %w", err)
	}
	exists, err := client.BucketExists(ctx, cfg.Bucket)
	if err != nil {
		return nil, fmt.Errorf("check minio bucket: %w", err)
	}
	if !exists {
		if err := client.MakeBucket(ctx, cfg.Bucket, minio.MakeBucketOptions{Region: cfg.Region}); err != nil {
			existsAfterRace, checkErr := client.BucketExists(ctx, cfg.Bucket)
			if checkErr != nil || !existsAfterRace {
				return nil, fmt.Errorf("create minio bucket: %w", err)
			}
		}
	}
	return &MinIO{client: client, bucket: cfg.Bucket}, nil
}

func (s *MinIO) Put(ctx context.Context, key string, reader io.Reader, size int64, contentType string) error {
	_, err := s.client.PutObject(ctx, s.bucket, key, reader, size, minio.PutObjectOptions{ContentType: contentType})
	if err != nil {
		return fmt.Errorf("put minio object: %w", err)
	}
	return nil
}
func (s *MinIO) Get(ctx context.Context, key string) (io.ReadCloser, error) {
	object, err := s.client.GetObject(ctx, s.bucket, key, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("get minio object: %w", err)
	}
	if _, err := object.Stat(); err != nil {
		object.Close()
		return nil, fmt.Errorf("stat minio object: %w", err)
	}
	return object, nil
}
func (s *MinIO) Delete(ctx context.Context, key string) error {
	if err := s.client.RemoveObject(ctx, s.bucket, key, minio.RemoveObjectOptions{}); err != nil {
		return fmt.Errorf("delete minio object: %w", err)
	}
	return nil
}
