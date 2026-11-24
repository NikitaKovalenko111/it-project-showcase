package user_handler

type UserStatusRequest struct {
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}

type StatusRequest struct {
	Status string `json:"status"`
}
