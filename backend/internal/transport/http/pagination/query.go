package pagination

import (
	"fmt"
	"net/url"
	"strconv"
)

func parseInteger(values url.Values, field string, defaultValue, minValue, maxValue int) (int, error) {
	items, exists := values[field]
	if !exists {
		return defaultValue, nil
	}
	if len(items) != 1 {
		return 0, queryError(field, "multiple_values", fmt.Sprintf("Query parameter %q must be specified once", field))
	}

	value, err := strconv.Atoi(items[0])
	if err != nil {
		return 0, queryError(field, "invalid_integer", fmt.Sprintf("Query parameter %q must be an integer", field))
	}
	if value < minValue || value > maxValue {
		return 0, queryError(
			field,
			"out_of_range",
			fmt.Sprintf("Query parameter %q must be between %d and %d", field, minValue, maxValue),
		)
	}

	return value, nil
}

func singleValue(values url.Values, field string) (string, bool, error) {
	items, exists := values[field]
	if !exists {
		return "", false, nil
	}
	if len(items) != 1 {
		return "", false, queryError(field, "multiple_values", fmt.Sprintf("Query parameter %q must be specified once", field))
	}

	return items[0], true, nil
}
