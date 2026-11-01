# Database migrations

This directory is the single source of truth for the PostgreSQL schema.

Migration names use the format `NNNNNN_description.up.sql`, for example:

```text
000001_accounts.up.sql
000002_identity_profiles.up.sql
000003_catalogs_companies.up.sql
000004_files.up.sql
```

Rules:

- never edit a migration that has already been applied;
- create the next migration for every schema change;
- keep each migration transactional;
- use the `showcase` schema for application objects;
- do not put table DDL back into Go model files;
- migrations are forward-only until a rollback policy is agreed.

The server embeds these files, applies them in version order and records version, name, checksum and application time in `showcase.schema_migrations`.
