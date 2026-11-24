package models

import "time"

type File struct {
	FileID         string    `json:"file_id"`
	StorageKey     string    `json:"-"`
	OriginalName   string    `json:"original_name"`
	MIMEType       string    `json:"mime_type"`
	SizeBytes      int64     `json:"size_bytes"`
	ChecksumSHA256 string    `json:"checksum_sha256"`
	UploadedBy     string    `json:"uploaded_by"`
	CreatedAt      time.Time `json:"created_at"`
}
