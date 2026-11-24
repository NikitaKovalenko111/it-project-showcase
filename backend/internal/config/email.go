package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

type Email struct {
	Enabled      bool          `yaml:"enabled"`
	Host         string        `yaml:"host"`
	Port         int           `yaml:"port"`
	Username     string        `yaml:"username"`
	Password     string        `yaml:"password"`
	From         string        `yaml:"from"`
	PollInterval time.Duration `yaml:"poll_interval"`
}

func loadEmail(c *Config) error {
	if v := os.Getenv("smtp_enabled"); v != "" {
		x, e := strconv.ParseBool(v)
		if e != nil {
			return e
		}
		c.Email.Enabled = x
	}
	if v := os.Getenv("smtp_host"); v != "" {
		c.Email.Host = v
	}
	if v := os.Getenv("smtp_port"); v != "" {
		x, e := strconv.Atoi(v)
		if e != nil {
			return e
		}
		c.Email.Port = x
	}
	if v := os.Getenv("smtp_username"); v != "" {
		c.Email.Username = v
	}
	if v := os.Getenv("smtp_password"); v != "" {
		c.Email.Password = v
	}
	if v := os.Getenv("smtp_from"); v != "" {
		c.Email.From = v
	}
	if v := os.Getenv("smtp_poll_interval"); v != "" {
		x, e := time.ParseDuration(v)
		if e != nil {
			return e
		}
		c.Email.PollInterval = x
	}
	return nil
}
func validateEmail(c *Config) error {
	if !c.Email.Enabled {
		return nil
	}
	if c.Email.Host == "" || c.Email.Port < 1 || c.Email.From == "" {
		return fmt.Errorf("SMTP host, port and from are required when email is enabled")
	}
	if c.Email.PollInterval <= 0 {
		return fmt.Errorf("SMTP poll interval must be positive")
	}
	return nil
}
