package config

import (
	"fmt"
	"net/url"
	"os"
	"strings"
	"time"
)

type HTTP struct {
	HTTP_ADDRESS         string        `yaml:"http_address" env-required:"true"`
	TIMEOUT              time.Duration `yaml:"http_timeout" env-required:"true"`
	IDLE_TIMEOUT         time.Duration `yaml:"http_idle_timeout" env-required:"true"`
	CORS_ALLOWED_ORIGINS []string      `yaml:"cors_allowed_origins"`
}

func loadHTTP(cfg *Config) error {
	if v := os.Getenv("http_address"); v != "" {
		cfg.HTTP.HTTP_ADDRESS = v
	}

	if v := os.Getenv("timeout"); v != "" {
		timeout, err := time.ParseDuration(v)
		if err != nil {
			return fmt.Errorf("invalid TIMEOUT: %w", err)
		}
		cfg.HTTP.TIMEOUT = timeout
	}

	if v := os.Getenv("idle_timeout"); v != "" {
		timeout, err := time.ParseDuration(v)
		if err != nil {
			return fmt.Errorf("invalid TIMEOUT: %w", err)
		}
		cfg.HTTP.IDLE_TIMEOUT = timeout
	}

	if v := os.Getenv("cors_allowed_origins"); v != "" {
		cfg.HTTP.CORS_ALLOWED_ORIGINS = splitAndTrim(v)
	}

	return nil
}

func validateHTTP(cfg *Config) error {
	if cfg.HTTP.HTTP_ADDRESS == "" {
		return fmt.Errorf("HTTP_ADDRESS is required")
	}

	if cfg.HTTP.TIMEOUT == 0 {
		return fmt.Errorf("TIMEOUT is required")
	}

	if cfg.HTTP.IDLE_TIMEOUT == 0 {
		return fmt.Errorf("IDLE_TIMEOUT is required")
	}

	seenOrigins := make(map[string]struct{}, len(cfg.HTTP.CORS_ALLOWED_ORIGINS))
	for _, origin := range cfg.HTTP.CORS_ALLOWED_ORIGINS {
		if origin == "*" {
			return fmt.Errorf("CORS_ALLOWED_ORIGINS must not contain a wildcard")
		}
		parsed, err := url.ParseRequestURI(origin)
		if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" ||
			parsed.Path != "" || parsed.RawQuery != "" || parsed.Fragment != "" || parsed.User != nil {
			return fmt.Errorf("invalid CORS origin %q", origin)
		}
		if _, exists := seenOrigins[origin]; exists {
			return fmt.Errorf("duplicate CORS origin %q", origin)
		}
		seenOrigins[origin] = struct{}{}
	}

	return nil
}

func splitAndTrim(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}
