package users_service

import (
	"context"
	"errors"
	"it-project-showcase/backend/internal/models"
	"strings"
	"testing"
)

func TestRepresentativeProfileRejectsInvalidPatch(t *testing.T) {
	longExperience, longTopics := strings.Repeat("Я", 4001), strings.Repeat("Я", 2001)
	for _, input := range []models.RepresentativeProfilePatch{{}, {ExperienceAndInterests: &longExperience}, {HelpTopics: &longTopics}} {
		_, err := Init(nil).UpdateRepresentativeProfile(context.Background(), "user", input)
		if !errors.Is(err, ErrInvalidRepresentativeProfile) {
			t.Fatalf("error = %v", err)
		}
	}
}

func TestSetStatusRejectsUnknownStatusBeforeRepository(t *testing.T) {
	err := Init(nil).SetStatus(context.Background(), "user", "unknown", "")
	if !errors.Is(err, ErrInvalidStatus) {
		t.Fatalf("error = %v", err)
	}
}
