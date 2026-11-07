# Database migrations

This directory is the single source of truth for the PostgreSQL schema.

Migration names use the format `NNNNNN_description.up.sql`, for example:

```text
000001_accounts.up.sql
000002_identity_profiles.up.sql
000003_catalogs_companies.up.sql
000004_files.up.sql
000005_cases.up.sql
000006_teams_applications_executions.up.sql
000007_complete_stages_6_to_9.up.sql
```

Rules:

- never edit a migration that has already been applied;
- create the next migration for every schema change;
- keep each migration transactional;
- use the `showcase` schema for application objects;
- do not put table DDL back into Go model files;
- migrations are forward-only until a rollback policy is agreed.

The server embeds these files, applies them in version order and records version, name, checksum and application time in `showcase.schema_migrations`.
`000008_results_and_student_projects.up.sql` adds stages 10–11: versioned submissions and files, evaluations with criterion scores, reviews, awards, reward fulfillment, certificates, and moderated student projects with members, catalogs, assets and server-owned likes.

`000009_platform_features.up.sql` adds stage 12 favorites, notifications and email outbox, audit log, portfolio visibility, invitation notifications and indexes for operational lists.

`000010_unweighted_evaluation_criteria.up.sql` removes criterion weights and stores the evaluation maximum as the sum of the dynamic `max_score` values.

`000011_sprint4_expansion.up.sql` adds tree comments and reports, team discovery and join applications, leaderboards, internships, curators, portfolio files, case covers, project visibility and tags, versioned NDA text, and locks evaluation criteria after draft.

`000012_case_formats_stage_editing_curator_access.up.sql` adds the company event format (`case`, `hackathon`, `olympiad`). Stage editing and curator access are implemented in application code against the existing stage and curator relations.

`000013_stage_order_and_company_reports.up.sql` enables atomic stage reordering, validates company report targets, adds unique comment likes and indexes outgoing team applications.

