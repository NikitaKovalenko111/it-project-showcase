package platform_service

import (
	"bytes"
	"context"
	"database/sql"
	_ "embed"
	"encoding/csv"
	"errors"
	"fmt"
	"github.com/google/uuid"
	"github.com/phpdave11/gofpdf"
	"github.com/xuri/excelize/v2"
	"it-project-showcase/backend/internal/config"
	"it-project-showcase/backend/internal/models"
	platform_repo "it-project-showcase/backend/internal/storage/repositories/platform"
	"mime"
	"net/smtp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

var (
	ErrInvalid   = errors.New("invalid platform request")
	ErrForbidden = errors.New("platform access denied")
	ErrNotFound  = errors.New("platform resource not found")
	ErrCursor    = errors.New("invalid cursor")
)

type Service struct {
	repo  *platform_repo.Repository
	email config.Email
}

//go:embed assets/DejaVuSansCondensed.ttf
var pdfFont []byte

func Init(r *platform_repo.Repository, e config.Email) *Service { return &Service{r, e} }
func validID(x string) bool                                     { _, e := uuid.Parse(x); return e == nil }
func before(pos, id string) (*time.Time, error) {
	if pos == "" {
		return nil, nil
	}
	x, e := time.Parse(time.RFC3339Nano, pos)
	if e != nil || !validID(id) {
		return nil, ErrCursor
	}
	return &x, nil
}
func (s *Service) SetFavorite(ctx context.Context, u, kind, id string, on bool) error {
	if (kind != "case" && kind != "student_project") || !validID(id) {
		return ErrInvalid
	}
	return mapErr(s.repo.SetFavorite(ctx, u, kind, id, on))
}
func (s *Service) ListFavorites(ctx context.Context, u string, limit int, pos, id string) ([]models.Favorite, error) {
	b, e := before(pos, id)
	if e != nil {
		return nil, e
	}
	return s.repo.ListFavorites(ctx, u, limit, b, id)
}
func (s *Service) ListNotifications(ctx context.Context, u string, unread bool, limit int, pos, id string) ([]models.Notification, error) {
	b, e := before(pos, id)
	if e != nil {
		return nil, e
	}
	return s.repo.ListNotifications(ctx, u, unread, limit, b, id)
}
func (s *Service) ReadNotification(ctx context.Context, u, id string) error {
	if !validID(id) {
		return ErrNotFound
	}
	return mapErr(s.repo.ReadNotification(ctx, u, id))
}
func (s *Service) ReadAll(ctx context.Context, u string) error { return s.repo.ReadAll(ctx, u) }

func (s *Service) NotificationStreamStart(ctx context.Context, u, lastEventID string) (time.Time, string, error) {
	if lastEventID == "" {
		return s.repo.LatestNotificationMarker(ctx, u)
	}
	if !validID(lastEventID) {
		return time.Time{}, "", ErrInvalid
	}
	created, id, err := s.repo.NotificationMarker(ctx, u, lastEventID)
	return created, id, mapErr(err)
}

func (s *Service) NotificationsAfter(ctx context.Context, u string, after time.Time, afterID string) ([]models.Notification, error) {
	return s.repo.NotificationsAfter(ctx, u, after, afterID, 100)
}
func (s *Service) ListAudit(ctx context.Context, entity, action string, limit int, offset int64) ([]models.AuditLog, int64, error) {
	if len(entity) > 64 || len(action) > 32 {
		return nil, 0, ErrInvalid
	}
	return s.repo.ListAudit(ctx, entity, action, limit, offset)
}
func (s *Service) SearchStudents(ctx context.Context, q, d, t string, limit int, pos, id string) ([]models.StudentSearchItem, error) {
	if utf8.RuneCountInString(q) > 100 || utf8.RuneCountInString(d) > 200 || utf8.RuneCountInString(t) > 100 {
		return nil, ErrInvalid
	}
	b, e := before(pos, id)
	if e != nil {
		return nil, e
	}
	return s.repo.SearchStudents(ctx, strings.TrimSpace(q), strings.TrimSpace(d), strings.TrimSpace(t), limit, b, id)
}
func (s *Service) GetPortfolio(ctx context.Context, viewer, student string, admin bool) (*models.Portfolio, error) {
	if !validID(student) {
		return nil, ErrNotFound
	}
	if viewer == "" {
		viewer = "00000000-0000-4000-8000-000000000000"
	}
	x, e := s.repo.GetPortfolio(ctx, viewer, student, admin)
	return x, mapErr(e)
}
func (s *Service) UpdatePortfolio(ctx context.Context, u, visibility, headline, about string) (*models.Portfolio, error) {
	if (visibility != "public" && visibility != "private") || utf8.RuneCountInString(headline) > 200 || utf8.RuneCountInString(about) > 5000 {
		return nil, ErrInvalid
	}
	x, e := s.repo.UpdatePortfolio(ctx, u, visibility, strings.TrimSpace(headline), strings.TrimSpace(about))
	return x, mapErr(e)
}
func (s *Service) Analytics(ctx context.Context, u, company string, admin bool) (models.Analytics, error) {
	if company != "" && !validID(company) {
		return models.Analytics{}, ErrInvalid
	}
	x, e := s.repo.Analytics(ctx, u, company, admin)
	return x, mapErr(e)
}
func (s *Service) Export(ctx context.Context, u, kind, format, company string, admin bool) ([]byte, string, string, error) {
	if company != "" && !validID(company) {
		return nil, "", "", ErrInvalid
	}
	rows, e := s.repo.ExportRows(ctx, u, kind, company, admin)
	if e != nil {
		return nil, "", "", mapErr(e)
	}
	switch format {
	case "csv":
		b, e := csvBytes(rows)
		return b, "text/csv; charset=utf-8", kind + ".csv", e
	case "xlsx":
		b, e := xlsxBytes(rows)
		return b, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", kind + ".xlsx", e
	case "pdf":
		b, e := pdfBytes(rows, kind)
		return b, "application/pdf", kind + ".pdf", e
	default:
		return nil, "", "", ErrInvalid
	}
}
func csvBytes(rows []models.ExportRow) ([]byte, error) {
	var b bytes.Buffer
	b.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&b)
	w.Comma = ';'
	_ = w.Write([]string{"id", "title", "status", "owner", "created_at"})
	for _, x := range rows {
		_ = w.Write([]string{x.ID, x.Title, x.Status, x.Owner, x.CreatedAt.Format(time.RFC3339)})
	}
	w.Flush()
	return b.Bytes(), w.Error()
}
func xlsxBytes(rows []models.ExportRow) ([]byte, error) {
	f := excelize.NewFile()
	defer f.Close()
	sheet := "Export"
	_ = f.SetSheetName("Sheet1", sheet)
	headers := []any{"ID", "Title", "Status", "Owner", "Created at"}
	_ = f.SetSheetRow(sheet, "A1", &headers)
	for i, x := range rows {
		values := []any{x.ID, x.Title, x.Status, x.Owner, x.CreatedAt.Format(time.RFC3339)}
		cell, _ := excelize.CoordinatesToCellName(1, i+2)
		_ = f.SetSheetRow(sheet, cell, &values)
	}
	_ = f.SetColWidth(sheet, "A", "A", 38)
	_ = f.SetColWidth(sheet, "B", "B", 40)
	_ = f.SetColWidth(sheet, "C", "E", 22)
	buf, e := f.WriteToBuffer()
	if e != nil {
		return nil, e
	}
	return buf.Bytes(), nil
}
func pdfBytes(rows []models.ExportRow, kind string) ([]byte, error) {
	p := gofpdf.New("L", "mm", "A4", "")
	p.SetTitle(kind, false)
	p.AddUTF8FontFromBytes("DejaVu", "", pdfFont)
	p.AddPage()
	p.SetFont("DejaVu", "", 14)
	p.Cell(0, 10, "IT Project Showcase - "+kind)
	p.Ln(12)
	p.SetFont("DejaVu", "", 8)
	for _, x := range rows {
		line := fmt.Sprintf("%s | %s | %s | %s | %s", x.ID, x.Title, x.Status, x.Owner, x.CreatedAt.Format("2006-01-02"))
		p.Cell(0, 5, line)
		p.Ln(5)
	}
	var b bytes.Buffer
	e := p.Output(&b)
	return b.Bytes(), e
}
func (s *Service) RunEmailWorker(ctx context.Context) {
	if !s.email.Enabled {
		return
	}
	timer := time.NewTicker(s.email.PollInterval)
	defer timer.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
			s.dispatch(ctx)
		}
	}
}
func (s *Service) dispatch(ctx context.Context) {
	items, e := s.repo.ClaimEmails(ctx, 20)
	if e != nil {
		return
	}
	for _, x := range items {
		e = s.send(x)
		_ = s.repo.CompleteEmail(ctx, x.EmailID, e)
	}
}
func (s *Service) send(x models.OutboxEmail) error {
	addr := s.email.Host + ":" + strconv.Itoa(s.email.Port)
	var auth smtp.Auth
	if s.email.Username != "" {
		auth = smtp.PlainAuth("", s.email.Username, s.email.Password, s.email.Host)
	}
	msg := []byte("From: " + s.email.From + "\r\nTo: " + x.Recipient + "\r\nSubject: " + mime.QEncoding.Encode("UTF-8", x.Subject) + "\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + x.Body)
	return smtp.SendMail(addr, auth, s.email.From, []string{x.Recipient}, msg)
}
func mapErr(e error) error {
	if e == nil {
		return nil
	}
	if errors.Is(e, platform_repo.ErrForbidden) {
		return ErrForbidden
	}
	if errors.Is(e, sql.ErrNoRows) {
		return ErrNotFound
	}
	return e
}
