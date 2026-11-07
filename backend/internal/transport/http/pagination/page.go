package pagination

import (
	"math"
	"net/url"
)

const (
	DefaultPage     = 1
	DefaultPageSize = 20
	MaxPageSize     = 100
)

type PageQuery struct {
	Page     int
	PageSize int
	Offset   int64
}

func ParsePageQuery(values url.Values) (PageQuery, error) {
	page, err := parseInteger(values, "page", DefaultPage, 1, math.MaxInt)
	if err != nil {
		return PageQuery{}, err
	}
	pageSize, err := parseInteger(values, "page_size", DefaultPageSize, 1, MaxPageSize)
	if err != nil {
		return PageQuery{}, err
	}

	pageIndex := int64(page - 1)
	if pageIndex > math.MaxInt64/int64(pageSize) {
		return PageQuery{}, queryError("page", "out_of_range", "Query parameter \"page\" is too large")
	}

	return PageQuery{
		Page:     page,
		PageSize: pageSize,
		Offset:   pageIndex * int64(pageSize),
	}, nil
}
