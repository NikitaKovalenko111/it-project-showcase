package transport

import (
	"net/http"
	"strings"

	"it-project-showcase/backend/internal/middleware"
	"it-project-showcase/backend/internal/transport/http/handlers"
	"it-project-showcase/backend/internal/transport/http/handlers/shared"
)

type HTTP struct {
	handlers  *handlers.Handlers
	authorize func(http.Handler) http.Handler
}

type protect func(http.Handler) http.Handler

func Init(handlers *handlers.Handlers, authorize func(http.Handler) http.Handler) *HTTP {
	return &HTTP{handlers: handlers, authorize: authorize}
}

func (h *HTTP) Start(mux *http.ServeMux) {
	api := mount(mux, "/api/v1", nil)

	admin := h.withRoles("admin")
	representative := h.withRoles("company_representative")
	manager := h.withRoles("company_representative", "admin")
	student := h.withRoles("student", "admin")
	workflow := h.withRoles("student", "company_representative", "admin")
	executionArea := h.withRoles("student", "company_representative", "university_staff", "admin")
	studentSearch := h.withRoles("company_representative", "university_staff", "admin")
	curator := h.withRoles("university_staff")
	reviewer := h.withRoles("admin", "university_staff")
	studentOnly := h.withRoles("student")

	h.handlers.System.Start(mount(api, "/system", nil))
	h.handlers.Documentation.Start(mount(api, "/docs", nil))
	h.handlers.Auth.Start(mount(api, "/auth", nil), h.authorize)

	users := mount(api, "/users", nil)
	h.handlers.Users.Start(users, admin)
	h.handlers.Files.StartUsers(users, h.authorize, h.optionalAuthorization)

	h.handlers.Catalogs.Start(mount(api, "/catalogs", nil), admin)

	companies := mount(api, "/companies", nil)
	h.handlers.Companies.Start(companies, representative, admin)
	h.handlers.Files.StartCompanies(companies, representative)

	cases := mount(api, "/cases", nil)
	h.handlers.Cases.Start(cases, representative, manager, admin, reviewer, h.optionalAuthorization)
	h.handlers.Cases.StartEventPlans(cases, representative, h.optionalAuthorization)
	h.handlers.Files.StartCases(cases, h.authorize, reviewer)
	h.handlers.Community.StartCases(cases, h.authorize, h.optionalAuthorization)
	h.handlers.Opportunities.StartCases(cases, representative, manager, studentOnly, h.optionalAuthorization)
	h.handlers.Executions.StartCases(cases, workflow)

	teams := mount(api, "/teams", nil)
	h.handlers.Teams.StartTeams(teams, student)
	h.handlers.Opportunities.StartTeams(teams, student)
	h.handlers.Teams.StartInvitations(mount(api, "/team-invitations", student))
	h.handlers.Opportunities.StartTeamApplications(mount(api, "/team-join-applications", student))
	h.handlers.Opportunities.StartTeamSearchProfile(mount(api, "/team-search-profile", student))
	h.handlers.Opportunities.StartTeamSearchProfiles(mount(api, "/team-search-profiles", student))

	applications := mount(api, "/applications", workflow)
	h.handlers.Applications.StartApplications(applications)
	h.handlers.Applications.StartRegistrations(mount(api, "/event-registrations", studentOnly))
	h.handlers.Files.StartApplications(applications)

	executions := mount(api, "/executions", executionArea)
	h.handlers.Applications.StartExecutions(executions)
	h.handlers.Executions.Start(executions)
	h.handlers.Results.StartExecutions(executions)
	h.handlers.Cases.StartEventRounds(executions, studentOnly, manager)
	h.handlers.Files.StartEventFiles(cases, executions, h.authorize)

	submissions := mount(api, "/submissions", workflow)
	h.handlers.Results.StartSubmissions(submissions)
	h.handlers.Files.StartSubmissions(submissions)
	h.handlers.Results.StartEvaluations(mount(api, "/evaluations", workflow))
	h.handlers.Results.StartAwards(mount(api, "/awards", workflow))

	projects := mount(api, "/student-projects", nil)
	h.handlers.StudentProjects.Start(projects, student, admin, reviewer, h.authorize, h.optionalAuthorization)
	h.handlers.Files.StartStudentProjects(projects, reviewer)
	h.handlers.Community.StartStudentProjects(projects, h.authorize, h.optionalAuthorization)

	h.handlers.Community.StartComments(mount(api, "/comments", nil), h.authorize, h.optionalAuthorization)
	h.handlers.Community.StartReports(mount(api, "/reports", nil), h.authorize, admin)
	feedback := mount(api, "/feedback", nil)
	h.handlers.Community.StartFeedback(feedback, h.authorize, admin)
	h.handlers.Files.StartFeedback(feedback, h.authorize)
	internships := mount(api, "/internships", nil)
	h.handlers.Opportunities.StartInternships(internships, representative, reviewer, h.authorize, h.optionalAuthorization)
	h.handlers.Opportunities.StartInternshipApplications(internships, studentOnly, representative, workflow)
	h.handlers.Files.StartInternships(internships, workflow, h.optionalAuthorization)
	h.handlers.Cases.StartViews(cases, h.authorize)

	h.handlers.Platform.StartFavorites(mount(api, "/favorites", h.authorize))
	h.handlers.Platform.StartNotifications(mount(api, "/notifications", h.authorize))
	h.handlers.Platform.StartAuditLogs(mount(api, "/audit-logs", admin))

	students := mount(api, "/students", nil)
	h.handlers.Platform.StartStudents(students, studentSearch)
	h.handlers.Opportunities.StartStudents(students, h.authorize, admin, curator)
	h.handlers.Users.StartStudents(students, studentOnly)
	h.handlers.Files.StartStudents(students)

	portfolio := mount(api, "/portfolio", student)
	h.handlers.Platform.StartPortfolio(portfolio)
	h.handlers.Opportunities.StartPortfolio(portfolio)
	h.handlers.Opportunities.StartApplicationDefaults(mount(api, "/application-defaults", student))
	h.handlers.Platform.StartAnalytics(mount(api, "/analytics", manager))
	h.handlers.Platform.StartExports(mount(api, "/exports", manager))
	h.handlers.Executions.StartNDAGrants(mount(api, "/nda-grants", representative))

	h.handlers.Companies.StartMemberInvitations(mount(api, "/company-member-invitations", h.authorize))
	h.handlers.Companies.StartStudentInvitations(mount(api, "/company-invitations", studentOnly))
	h.handlers.Files.Start(mount(api, "/files", h.authorize))

	api.HandleFunc("/", shared.NotFound)
}

func (h *HTTP) optionalAuthorization(next http.Handler) http.Handler {
	authenticated := h.authorize(next)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") == "" {
			next.ServeHTTP(w, r)
			return
		}
		authenticated.ServeHTTP(w, r)
	})
}

func (h *HTTP) withRoles(roles ...string) protect {
	return func(next http.Handler) http.Handler {
		return h.authorize(middleware.RequireAnyRole(roles...)(next))
	}
}

func mount(parent *http.ServeMux, prefix string, middleware protect) *http.ServeMux {
	prefix = "/" + strings.Trim(prefix, "/")
	child := http.NewServeMux()
	handler := http.Handler(http.StripPrefix(prefix, normalizeRoot(child)))
	if middleware != nil {
		handler = middleware(handler)
	}
	parent.Handle(prefix, handler)
	parent.Handle(prefix+"/", handler)
	return child
}

func normalizeRoot(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "" {
			clone := r.Clone(r.Context())
			urlCopy := *r.URL
			urlCopy.Path = "/"
			clone.URL = &urlCopy
			r = clone
		}
		next.ServeHTTP(w, r)
	})
}
