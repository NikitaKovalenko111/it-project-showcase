package catalog_repo

import (
	"context"
	"database/sql"
	"fmt"

	"it-project-showcase/backend/internal/models"
)

type Repository struct{ db *sql.DB }

func Init(db *sql.DB) *Repository { return &Repository{db: db} }

type catalogDefinition struct {
	table, idColumn string
	hasKind         bool
}

var catalogs = map[string]catalogDefinition{
	"directions":   {"directions", "direction_id", false},
	"competencies": {"competencies", "competency_id", false},
	"technologies": {"technologies", "technology_id", true},
	"team-roles":   {"team_roles", "team_role_id", false},
}

func IsSupported(name string) bool { _, ok := catalogs[name]; return ok }

func (r *Repository) List(ctx context.Context, catalog string) ([]models.CatalogItem, error) {
	definition, ok := catalogs[catalog]
	if !ok {
		return nil, fmt.Errorf("unsupported catalog")
	}
	kindExpression := "''"
	if definition.hasKind {
		kindExpression = "COALESCE(kind, '')"
	}
	query := fmt.Sprintf("SELECT %s, name, %s, is_active, created_at FROM %s WHERE is_active = TRUE ORDER BY name", definition.idColumn, kindExpression, definition.table)
	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", catalog, err)
	}
	defer rows.Close()
	items := make([]models.CatalogItem, 0)
	for rows.Next() {
		var item models.CatalogItem
		if err := rows.Scan(&item.ID, &item.Name, &item.Kind, &item.IsActive, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan %s: %w", catalog, err)
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate %s: %w", catalog, err)
	}
	return items, nil
}

func (r *Repository) Create(ctx context.Context, catalog, name, kind string) (*models.CatalogItem, error) {
	definition, ok := catalogs[catalog]
	if !ok {
		return nil, fmt.Errorf("unsupported catalog")
	}
	item := &models.CatalogItem{Name: name, Kind: kind, IsActive: true}
	var query string
	var err error
	if definition.hasKind {
		query = fmt.Sprintf("INSERT INTO %s (name, kind) VALUES ($1, NULLIF($2, '')) RETURNING %s, created_at", definition.table, definition.idColumn)
		err = r.db.QueryRowContext(ctx, query, name, kind).Scan(&item.ID, &item.CreatedAt)
	} else {
		query = fmt.Sprintf("INSERT INTO %s (name) VALUES ($1) RETURNING %s, created_at", definition.table, definition.idColumn)
		err = r.db.QueryRowContext(ctx, query, name).Scan(&item.ID, &item.CreatedAt)
	}
	if err != nil {
		return nil, fmt.Errorf("create %s item: %w", catalog, err)
	}
	return item, nil
}
