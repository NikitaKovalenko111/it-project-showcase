#!/bin/sh
set -eu
umask 077

export PGPASSWORD="${POSTGRES_PASSWORD:?}"

export RCLONE_CONFIG_SRC_TYPE="s3"
export RCLONE_CONFIG_SRC_PROVIDER="Minio"
export RCLONE_CONFIG_SRC_ENV_AUTH="false"
export RCLONE_CONFIG_SRC_ENDPOINT="http://minio:9000"
export RCLONE_CONFIG_SRC_REGION="us-east-1"
export RCLONE_CONFIG_SRC_ACCESS_KEY_ID="${MINIO_ROOT_USER:?}"
export RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="${MINIO_ROOT_PASSWORD:?}"

DB_USER="${POSTGRES_USER:-showcase}"
DB_NAME="${POSTGRES_DB:-showcase}"
BUCKET="${MINIO_BUCKET:-showcase}"

TIMESTAMP="$(date -u +%Y-%m-%d_%H-%M-%S)"
mkdir -p /backups

TMP_DIR="$(mktemp -d /backups/.incomplete.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "[$TIMESTAMP] Starting backup"

# PostgreSQL
pg_dump \
  -h postgres \
  -p 5432 \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  -Fc \
  -f "$TMP_DIR/database.dump"

# Проверяем читаемость структуры архива.
pg_restore -l "$TMP_DIR/database.dump" > /dev/null

echo "PostgreSQL dump completed"

# MinIO
mkdir -p "$TMP_DIR/minio"

rclone copy \
  "src:${BUCKET}" \
  "$TMP_DIR/minio"

echo "MinIO backup completed"

# Только полностью завершённый набор признаём успешным.
FINAL_DIR="/backups/$TIMESTAMP"
if [ -e "$FINAL_DIR" ]; then
  echo "Backup directory already exists" >&2
  exit 1
fi

mv "$TMP_DIR" "$FINAL_DIR"
trap - EXIT

# Удаляем успешные копии старше 7 суток.
find /backups \
  -mindepth 1 \
  -maxdepth 1 \
  -type d \
  -name '20??-??-??_*' \
  -mtime +6 \
  -exec rm -rf -- {} +

echo "[$TIMESTAMP] Backup completed successfully"