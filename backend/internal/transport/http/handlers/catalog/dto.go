package catalog_handler

type CreateRequest struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}
