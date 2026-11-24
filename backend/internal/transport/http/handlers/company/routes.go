package company_handler

import "net/http"

func (h *Handler) StartMemberInvitations(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListMemberInvitations)
	mux.HandleFunc("PATCH /{invitation_id}", h.RespondMemberInvitation)
}
func (h *Handler) StartStudentInvitations(mux *http.ServeMux) {
	mux.HandleFunc("GET /", h.ListStudentInvitations)
	mux.HandleFunc("PATCH /{invitation_id}", h.RespondStudentInvitation)
}
