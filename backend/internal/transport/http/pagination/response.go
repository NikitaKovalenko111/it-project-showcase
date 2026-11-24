package pagination

import "errors"

type CursorResponse[T any] struct {
	Items      []T     `json:"items"`
	NextCursor *string `json:"next_cursor"`
}

type PageResponse[T any] struct {
	Items    []T   `json:"items"`
	Page     int   `json:"page"`
	PageSize int   `json:"page_size"`
	Total    int64 `json:"total"`
}

func NewCursorResponse[T any](items []T, nextCursor string) CursorResponse[T] {
	if items == nil {
		items = make([]T, 0)
	}

	var next *string
	if nextCursor != "" {
		next = &nextCursor
	}

	return CursorResponse[T]{
		Items:      items,
		NextCursor: next,
	}
}

func NewCursorPage[T any](items []T, limit int, cursorFor func(T) (Cursor, error)) (CursorResponse[T], error) {
	if limit < 1 || limit > MaxLimit {
		return CursorResponse[T]{}, errors.New("pagination limit is out of range")
	}
	if len(items) <= limit {
		return NewCursorResponse(items, ""), nil
	}
	if cursorFor == nil {
		return CursorResponse[T]{}, errors.New("cursor factory is required")
	}

	pageItems := items[:limit]
	cursor, err := cursorFor(pageItems[len(pageItems)-1])
	if err != nil {
		return CursorResponse[T]{}, err
	}
	encodedCursor, err := EncodeCursor(cursor)
	if err != nil {
		return CursorResponse[T]{}, err
	}

	return NewCursorResponse(pageItems, encodedCursor), nil
}

func NewPageResponse[T any](items []T, query PageQuery, total int64) PageResponse[T] {
	if items == nil {
		items = make([]T, 0)
	}

	return PageResponse[T]{
		Items:    items,
		Page:     query.Page,
		PageSize: query.PageSize,
		Total:    total,
	}
}
