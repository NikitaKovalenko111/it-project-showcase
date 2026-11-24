#!/usr/bin/env bash
set -euo pipefail

demo_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
root=$(cd -- "$demo_dir/../.." && pwd)
compose=(docker compose --project-directory "$root" -f "$root/compose.demo.yaml")
for dependency in docker curl node; do
    command -v "$dependency" >/dev/null || { echo "$dependency is required." >&2; exit 1; }
done

sql() {
    "${compose[@]}" exec -T postgres psql -X -qAt -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1 "$@"
}

if ! "${compose[@]}" up -d --wait; then
    "${compose[@]}" logs --tail 40 api
    exit 1
fi

mapping=$("${compose[@]}" port api 3005)
mapping=${mapping%$'\r'}
if [[ ! $mapping =~ ^127\.0\.0\.1:[0-9]{1,5}$ ]]; then
    echo "Demo API must be published on a loopback port. Compose returned '$mapping'." >&2
    exit 1
fi
api="http://$mapping/api/v1"

request() {
    curl --noproxy '*' --fail --silent --show-error --max-time 30 "$@"
}

for ((attempt = 1; ; attempt++)); do
    if request --max-time 2 "$api/system/health" >/dev/null 2>&1; then
        break
    fi
    if ((attempt == 30)); then
        "${compose[@]}" logs --tail 40 api
        echo "Demo API did not become ready at $api" >&2
        exit 1
    fi
    sleep 1
done

for fixture in seed extras uust-programs catalog-expansion; do
    sql < "$demo_dir/$fixture.sql"
done

login() {
    local session
    session=$(request --header 'Content-Type: application/json' \
        --data "{\"login\":\"$1\",\"password\":\"DemoShowcase2026!\"}" "$api/auth/login")
    node -e '
        const session = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
        console.log(session.user_id, session.access_token)
    ' <<< "$session"
}

upload() (
    local method=$1 route=$2 token=$3 path=$4
    cd -- "$(dirname -- "$path")"
    request --request "$method" --header "Authorization: Bearer $token" \
        --form "file=@$(basename -- "$path")" "$api$route"
)

students_with_photos=$(sql -c 'SELECT u.username FROM showcase.students s JOIN showcase.users u USING (user_id)
    WHERE s.photo_file_id IS NOT NULL OR u.avatar_file_id IS NOT NULL')
students_with_photos=${students_with_photos//$'\r'/}
for ((number = 1; number <= 20; number++)); do
    username="demo.student$number"
    if grep -Fxq -- "$username" <<< "$students_with_photos"; then
        continue
    fi
    session=$(login "$username")
    read -r _ token <<< "${session%$'\r'}"
    printf -v photo 'student%02d.jpg' "$number"
    upload PUT /users/me/photo "$token" "$demo_dir/media/$photo" >/dev/null
done

ensure_file() {
    local owner=$1 token=$2 path=$3 file_id
    file_id=$(sql -v "owner=$owner" -v "name=$(basename -- "$path")" <<'SQL'
SELECT file_id FROM showcase.files WHERE uploaded_by=:'owner' AND original_name=:'name'
    AND status='active' ORDER BY created_at LIMIT 1;
SQL
)
    if [[ -n $file_id ]]; then
        printf '%s\n' "${file_id%$'\r'}"
    else
        upload POST /files "$token" "$path" |
            node -e 'console.log(JSON.parse(require("node:fs").readFileSync(0, "utf8")).file_id)' | tr -d '\r'
    fi
}

temp=$(mktemp -d)
trap 'rm -f -- "$temp/demo-result.txt" "$temp/demo-resume.pdf" "$temp/verified-download"; rmdir -- "$temp"' EXIT
printf '%s' 'Демонстрационный отчёт. Маршруты проверены на 40 синтетических заявках. Итоговый отчёт по ETL содержит 92 балла из 100.' > "$temp/demo-result.txt"
cp -- "$root/frontend/public/demo/documents/resume-1.pdf" "$temp/demo-resume.pdf"

session=$(login demo.student1)
read -r student1_id student1_token <<< "${session%$'\r'}"
session=$(login demo.student2)
read -r student2_id student2_token <<< "${session%$'\r'}"
for name in demo-result.txt demo-resume.pdf; do
    file_id=$(ensure_file "$student1_id" "$student1_token" "$temp/$name")
    (
        cd -- "$temp"
        request --output verified-download --header "Authorization: Bearer $student1_token" "$api/files/$file_id"
    )
done
ensure_file "$student1_id" "$student1_token" "$demo_dir/media/task-tracker.jpg" >/dev/null
ensure_file "$student2_id" "$student2_token" "$demo_dir/media/campus-map.jpg" >/dev/null
ensure_file "$student1_id" "$student1_token" "$demo_dir/media/network-analysis.jpg" >/dev/null
sql < "$demo_dir/files.sql"

targets=$(sql < "$demo_dir/media-targets.sql" | node -e '
    const targets = JSON.parse(require("node:fs").readFileSync(0, "utf8"))
    targets.sort((a, b) => a.owner.localeCompare(b.owner))
    for (const { kind, id, owner, filename } of targets) {
        console.log([kind, id, owner, filename].join("\t"))
    }
' | tr -d '\r')
current_owner=
while IFS=$'\t' read -r kind item_id owner filename; do
    [[ -n $kind ]] || continue
    if [[ $owner != "$current_owner" ]]; then
        session=$(login "$owner")
        read -r owner_id token <<< "${session%$'\r'}"
        current_owner=$owner
    fi
    file_id=$(ensure_file "$owner_id" "$token" "$demo_dir/media/$filename")
    case "$kind" in
        company)
            attach="UPDATE showcase.companies c SET logo_file_id=:'file_id'
                WHERE c.company_id=:'item_id' AND c.logo_file_id IS NULL AND EXISTS (
                    SELECT 1 FROM showcase.company_members m
                    WHERE m.company_id=c.company_id AND m.user_id=:'owner_id' AND m.status='active');"
            ;;
        case)
            attach="UPDATE showcase.cases SET cover_file_id=:'file_id'
                WHERE case_id=:'item_id' AND created_by=:'owner_id' AND cover_file_id IS NULL;"
            ;;
        project)
            attach="UPDATE showcase.student_projects SET cover_file_id=:'file_id'
                WHERE project_id=:'item_id' AND owner_id=:'owner_id' AND cover_file_id IS NULL;"
            ;;
        *) echo "Unknown demo media target: $kind" >&2; exit 1 ;;
    esac
    sql -v "file_id=$file_id" -v "item_id=$item_id" -v "owner_id=$owner_id" <<< "$attach"
done <<< "$targets"

printf 'Demo database ready. Swagger: %s/docs\n' "$api"
