package pagination

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/url"
	"strings"
)

const (
	DefaultLimit  = 20
	MaxLimit      = 100
	MaxCursorSize = 2048
	cursorVersion = 1
)

type CursorQuery struct {
	Limit  int
	Cursor *Cursor
}

type Cursor struct {
	Scope    string
	Position string
	ID       string
}

type cursorPayload struct {
	Version  int    `json:"v"`
	Scope    string `json:"s"`
	Position string `json:"p"`
	ID       string `json:"id"`
}

func ParseCursorQuery(values url.Values, scope string) (CursorQuery, error) {
	if strings.TrimSpace(scope) == "" {
		return CursorQuery{}, errors.New("cursor scope is required")
	}

	limit, err := parseInteger(values, "limit", DefaultLimit, 1, MaxLimit)
	if err != nil {
		return CursorQuery{}, err
	}

	encodedCursor, exists, err := singleValue(values, "cursor")
	if err != nil {
		return CursorQuery{}, err
	}
	if !exists {
		return CursorQuery{Limit: limit}, nil
	}

	cursor, err := DecodeCursor(encodedCursor)
	if err != nil || cursor.Scope != scope {
		return CursorQuery{}, queryError("cursor", "invalid_cursor", "Query parameter \"cursor\" is invalid")
	}

	return CursorQuery{Limit: limit, Cursor: &cursor}, nil
}

func EncodeCursor(cursor Cursor) (string, error) {
	if strings.TrimSpace(cursor.Scope) == "" {
		return "", errors.New("cursor scope is required")
	}
	if strings.TrimSpace(cursor.Position) == "" {
		return "", errors.New("cursor position is required")
	}
	if strings.TrimSpace(cursor.ID) == "" {
		return "", errors.New("cursor id is required")
	}

	data, err := json.Marshal(cursorPayload{
		Version:  cursorVersion,
		Scope:    cursor.Scope,
		Position: cursor.Position,
		ID:       cursor.ID,
	})
	if err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

func DecodeCursor(value string) (Cursor, error) {
	if value == "" || len(value) > MaxCursorSize {
		return Cursor{}, errors.New("cursor is empty")
	}

	data, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return Cursor{}, errors.New("decode cursor")
	}

	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var payload cursorPayload
	if err := decoder.Decode(&payload); err != nil {
		return Cursor{}, errors.New("decode cursor payload")
	}
	if err := ensureJSONEnd(decoder); err != nil {
		return Cursor{}, err
	}
	if payload.Version != cursorVersion || strings.TrimSpace(payload.Scope) == "" ||
		strings.TrimSpace(payload.Position) == "" || strings.TrimSpace(payload.ID) == "" {
		return Cursor{}, errors.New("invalid cursor payload")
	}

	return Cursor{Scope: payload.Scope, Position: payload.Position, ID: payload.ID}, nil
}

func ensureJSONEnd(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) {
		return errors.New("cursor contains trailing data")
	}
	return nil
}
