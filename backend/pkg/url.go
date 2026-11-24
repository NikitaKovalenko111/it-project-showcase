package pkg

import (
	"net/url"
	"strings"
	"unicode"
)

func IsWebURL(value string) bool {
	parsed, err := url.ParseRequestURI(value)
	return err == nil && strings.IndexFunc(value, unicode.IsSpace) == -1 && parsed.Hostname() != "" && parsed.User == nil &&
		(parsed.Scheme == "http" || parsed.Scheme == "https")
}
