// Package pagination contains the shared HTTP contract for paginated lists.
//
// Public, frequently changing lists use cursor pagination. Repositories must
// use a stable order with a unique tie-breaker and request Limit+1 rows. For
// example: ORDER BY created_at DESC, id DESC.
//
// Administrative tables may use page pagination when the UI needs page
// numbers and an exact total count.
package pagination
