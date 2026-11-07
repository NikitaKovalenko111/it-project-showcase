package config

import (
	"fmt"
	"os"
	"strconv"
)

type ObjectStorage struct {
	Endpoint    string `yaml:"endpoint"`
	AccessKey   string `yaml:"access_key"`
	SecretKey   string `yaml:"secret_key"`
	Bucket      string `yaml:"bucket"`
	UseSSL      bool   `yaml:"use_ssl"`
	Region      string `yaml:"region"`
	MaxFileSize int64  `yaml:"max_file_size"`
}

func loadObjectStorage(cfg *Config) error {
	if value := os.Getenv("minio_endpoint"); value != "" {
		cfg.ObjectStorage.Endpoint = value
	}
	if value := os.Getenv("minio_access_key"); value != "" {
		cfg.ObjectStorage.AccessKey = value
	}
	if value := os.Getenv("minio_secret_key"); value != "" {
		cfg.ObjectStorage.SecretKey = value
	}
	if value := os.Getenv("minio_bucket"); value != "" {
		cfg.ObjectStorage.Bucket = value
	}
	if value := os.Getenv("minio_region"); value != "" {
		cfg.ObjectStorage.Region = value
	}
	if value := os.Getenv("minio_use_ssl"); value != "" {
		parsed, err := strconv.ParseBool(value)
		if err != nil {
			return fmt.Errorf("invalid minio_use_ssl: %w", err)
		}
		cfg.ObjectStorage.UseSSL = parsed
	}
	if value := os.Getenv("max_file_size"); value != "" {
		parsed, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			return fmt.Errorf("invalid max_file_size: %w", err)
		}
		cfg.ObjectStorage.MaxFileSize = parsed
	}
	return nil
}

func validateObjectStorage(cfg *Config) error {
	if cfg.ObjectStorage.Endpoint == "" {
		return fmt.Errorf("minio endpoint is required")
	}
	if cfg.ObjectStorage.AccessKey == "" {
		return fmt.Errorf("minio access key is required")
	}
	if cfg.ObjectStorage.SecretKey == "" {
		return fmt.Errorf("minio secret key is required")
	}
	if cfg.ObjectStorage.Bucket == "" {
		return fmt.Errorf("minio bucket is required")
	}
	if cfg.ObjectStorage.MaxFileSize <= 0 {
		return fmt.Errorf("max file size must be positive")
	}
	return nil
}
