package catalogs_service

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"it-project-showcase/backend/internal/models"
	catalog_repo "it-project-showcase/backend/internal/storage/repositories/catalog"

	"github.com/jackc/pgx/v5/pgconn"
)

var (
	ErrUnsupportedCatalog = errors.New("unsupported catalog")
	ErrInvalidItem        = errors.New("invalid catalog item")
	ErrItemExists         = errors.New("catalog item already exists")
)

type Service struct{ repo *catalog_repo.Repository }

func Init(repo *catalog_repo.Repository) *Service { return &Service{repo: repo} }
func (s *Service) List(ctx context.Context, catalog string) ([]models.CatalogItem, error) {
	if !catalog_repo.IsSupported(catalog) {
		return nil, ErrUnsupportedCatalog
	}
	return s.repo.List(ctx, catalog)
}
func (s *Service) Create(ctx context.Context, catalog, name, kind string) (*models.CatalogItem, error) {
	if !catalog_repo.IsSupported(catalog) {
		return nil, ErrUnsupportedCatalog
	}
	name, kind = strings.TrimSpace(name), strings.TrimSpace(kind)
	if name == "" || utf8.RuneCountInString(name) > 150 || utf8.RuneCountInString(kind) > 100 {
		return nil, ErrInvalidItem
	}
	item, err := s.repo.Create(ctx, catalog, name, kind)
	if err == nil {
		return item, nil
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		return nil, ErrItemExists
	}
	return nil, err
}
