package auth_service

import (
	"net/mail"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
)

const (
	minUsernameLength = 3
	maxUsernameLength = 32
	minPasswordLength = 8
	maxPasswordLength = 72
	maxEmailLength    = 254
	maxShortText      = 150
	maxBioLength      = 2000
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9._-]+$`)

type ValidationError struct {
	Field   string
	Code    string
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

func ValidateRegisterRequest(input models.StudentRegistration) error {
	checks := []struct {
		field string
		value string
		max   int
	}{
		{"last_name", input.LastName, maxShortText},
		{"first_name", input.FirstName, maxShortText},
		{"institute", input.Institute, maxShortText},
		{"direction", input.Direction, maxShortText},
		{"group_name", input.GroupName, maxShortText},
		{"consent_version", input.ConsentVersion, 50},
	}
	if err := validateUsername(input.Username); err != nil {
		return err
	}
	if err := validateEmail(input.Email); err != nil {
		return err
	}
	if err := validatePassword(input.Password); err != nil {
		return err
	}
	for _, check := range checks {
		if strings.TrimSpace(check.value) == "" {
			return validationError(check.field, "required", check.field+" is required")
		}
		if utf8.RuneCountInString(check.value) > check.max {
			return validationError(check.field, "too_long", check.field+" is too long")
		}
	}
	if input.Course < 1 || input.Course > 8 {
		return validationError("course", "out_of_range", "course must be between 1 and 8")
	}
	if utf8.RuneCountInString(input.Bio) > maxBioLength {
		return validationError("bio", "too_long", "bio is too long")
	}
	for _, values := range [][]string{input.ProfessionalInterests, input.Competencies, input.Technologies} {
		if len(values) > 50 {
			return validationError("profile", "too_many_items", "profile lists may contain at most 50 items")
		}
	}
	for index, link := range input.Links {
		if strings.TrimSpace(link.Kind) == "" {
			return validationError("links", "invalid_link", "link kind is required")
		}
		parsed, err := url.ParseRequestURI(link.URL)
		if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
			return validationError("links", "invalid_link", "link at index "+strconv.Itoa(index)+" must be an http or https URL")
		}
	}
	return nil
}

func validateUsername(value string) error {
	length := utf8.RuneCountInString(value)
	if length < minUsernameLength || length > maxUsernameLength {
		return validationError("username", "invalid_length", "username must be between 3 and 32 characters")
	}
	if !usernamePattern.MatchString(value) {
		return validationError("username", "invalid_format", "username may contain only lowercase Latin letters, digits, dots, underscores, and hyphens")
	}
	return nil
}

func validateEmail(value string) error {
	if len(value) > maxEmailLength {
		return validationError("email", "too_long", "email is too long")
	}
	address, err := mail.ParseAddress(value)
	if err != nil || address.Address != value {
		return validationError("email", "invalid_format", "email has an invalid format")
	}
	return nil
}

func validatePassword(value string) error {
	if len(value) < minPasswordLength || len(value) > maxPasswordLength {
		return validationError("password", "invalid_length", "password must be between 8 and 72 characters")
	}
	var letter, digit bool
	for _, character := range value {
		if unicode.IsSpace(character) || unicode.IsControl(character) {
			return validationError("password", "invalid_format", "password must not contain spaces or control characters")
		}
		letter = letter || unicode.IsLetter(character)
		digit = digit || unicode.IsDigit(character)
	}
	if !letter || !digit {
		return validationError("password", "weak_password", "password must contain at least one letter and one digit")
	}
	return nil
}

func validationError(field, code, message string) error {
	return &ValidationError{Field: field, Code: code, Message: message}
}
