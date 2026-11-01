package migrator

import (
	"testing"
	"testing/fstest"
)

func TestDiscoverSortsVersionedMigrations(t *testing.T) {
	migrationFS := fstest.MapFS{
		"000002_second.up.sql": {Data: []byte("SELECT 2;")},
		"000001_first.up.sql":  {Data: []byte("SELECT 1;")},
		"README.md":            {Data: []byte("ignored")},
	}

	items, err := discover(migrationFS)
	if err != nil {
		t.Fatalf("discover() error = %v", err)
	}
	if len(items) != 2 {
		t.Fatalf("discover() returned %d migrations, want 2", len(items))
	}
	if items[0].version != 1 || items[1].version != 2 {
		t.Fatalf("migration order = [%d, %d], want [1, 2]", items[0].version, items[1].version)
	}
	if items[0].checksum == "" {
		t.Fatal("migration checksum is empty")
	}
}

func TestDiscoverRejectsDuplicateVersions(t *testing.T) {
	migrationFS := fstest.MapFS{
		"000001_first.up.sql":  {Data: []byte("SELECT 1;")},
		"000001_second.up.sql": {Data: []byte("SELECT 2;")},
	}

	if _, err := discover(migrationFS); err == nil {
		t.Fatal("discover() accepted duplicate migration versions")
	}
}

func TestDiscoverNormalizesLineEndingsForChecksum(t *testing.T) {
	lf, err := discover(fstest.MapFS{
		"000001_first.up.sql": {Data: []byte("SELECT 1;\nSELECT 2;\n")},
	})
	if err != nil {
		t.Fatalf("discover() LF error = %v", err)
	}
	crlf, err := discover(fstest.MapFS{
		"000001_first.up.sql": {Data: []byte("SELECT 1;\r\nSELECT 2;\r\n")},
	})
	if err != nil {
		t.Fatalf("discover() CRLF error = %v", err)
	}
	if lf[0].checksum != crlf[0].checksum {
		t.Fatalf("checksums differ for LF and CRLF: %s != %s", lf[0].checksum, crlf[0].checksum)
	}
}
