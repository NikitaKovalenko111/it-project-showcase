package opportunities_service

import (
	"context"
	"errors"
	"it-project-showcase/backend/internal/models"
	"strings"
	"testing"
)

func TestCompanyApplicationQueueRejectsInvalidFilters(t *testing.T) {
	for _, filter := range []models.InternshipApplicationFilter{
		{CompanyID: "invalid"}, {ProgramID: "invalid"}, {Kind: "hackathon"}, {Status: "pending"}, {Search: strings.Repeat("a", 201)},
	} {
		_, _, err := Init(nil).ListCompanyInternshipApplications(context.Background(), "user", filter, 20, 0)
		if !errors.Is(err, ErrInvalid) {
			t.Fatalf("filter %+v: %v", filter, err)
		}
	}
}

func TestSetCaseCoverValidatesIDsBeforeRepository(t *testing.T) {
	err := Init(nil).SetCaseCover(context.Background(), "user", "bad-case", "bad-file")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v", err)
	}
}

func TestRespondTeamApplicationRejectsUnknownStatus(t *testing.T) {
	err := Init(nil).RespondTeamApplication(context.Background(), "user", "5c76ce4e-b384-4f29-b462-eb9b8d5e8ba1", "pending")
	if !errors.Is(err, ErrInvalid) {
		t.Fatalf("error = %v", err)
	}
}
