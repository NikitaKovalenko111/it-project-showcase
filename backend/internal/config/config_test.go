package config

import (
	"path/filepath"
	"testing"
	"time"
)

func TestLoadHTTPServerFromYAML(t *testing.T) {
	for _, name := range []string{
		"log_level",
		"http_address",
		"timeout",
		"idle_timeout",
		"cors_allowed_origins",
		"session_cleanup_interval",
		"db_host",
		"db_user",
		"db_port",
		"db_pass",
		"db_name",
		"ssl_mode",
		"minio_endpoint",
		"minio_access_key",
		"minio_secret_key",
		"minio_bucket",
		"minio_region",
		"minio_use_ssl",
		"max_file_size",
	} {
		t.Setenv(name, "")
	}

	cfg, err := Load(filepath.Join("..", "..", "config", "config_test.yaml"))
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.HTTP_ADDRESS != ":3005" {
		t.Errorf("HTTP_ADDRESS = %q, want %q", cfg.HTTP_ADDRESS, ":3005")
	}
	if cfg.TIMEOUT != 4*time.Second {
		t.Errorf("TIMEOUT = %s, want %s", cfg.TIMEOUT, 4*time.Second)
	}
	if cfg.IDLE_TIMEOUT != 60*time.Second {
		t.Errorf("IDLE_TIMEOUT = %s, want %s", cfg.IDLE_TIMEOUT, 60*time.Second)
	}
	if len(cfg.CORS_ALLOWED_ORIGINS) != 1 || cfg.CORS_ALLOWED_ORIGINS[0] != "http://localhost:5173" {
		t.Errorf("CORS_ALLOWED_ORIGINS = %v, want [http://localhost:5173]", cfg.CORS_ALLOWED_ORIGINS)
	}
	if cfg.SessionCleanupInterval != 30*time.Minute {
		t.Errorf("SessionCleanupInterval = %s, want %s", cfg.SessionCleanupInterval, 30*time.Minute)
	}
	if cfg.ObjectStorage.Endpoint != "localhost:9000" || cfg.ObjectStorage.Bucket != "test-bucket" || cfg.ObjectStorage.MaxFileSize != 20*1024*1024 {
		t.Errorf("ObjectStorage = %+v, want test MinIO configuration", cfg.ObjectStorage)
	}
}
