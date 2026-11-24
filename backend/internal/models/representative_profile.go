package models

type RepresentativeProfile struct {
	UserID                 string `json:"user_id"`
	ExperienceAndInterests string `json:"experience_and_interests"`
	HelpTopics             string `json:"help_topics"`
}

type RepresentativeProfilePatch struct {
	ExperienceAndInterests *string `json:"experience_and_interests"`
	HelpTopics             *string `json:"help_topics"`
}
