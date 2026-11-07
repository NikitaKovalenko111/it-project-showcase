package migrations

import "embed"

// Files contains all versioned database migrations bundled with the server.
//
//go:embed *.up.sql
var Files embed.FS
