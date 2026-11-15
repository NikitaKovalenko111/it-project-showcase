$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$compose = Join-Path $root 'compose.demo.yaml'
$port = if ($env:SHOWCASE_DEMO_PORT) { $env:SHOWCASE_DEMO_PORT } else { '13006' }
$api = "http://127.0.0.1:$port/api/v1"

function Invoke-DemoSql([string]$File) {
    Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot $File) |
        docker compose -f $compose exec -T postgres psql -X -q -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Failed to apply $File" }
}

$mapping = docker compose -f $compose port api 3005
if ($LASTEXITCODE -ne 0 -or $mapping -ne "127.0.0.1:$port") {
    throw 'Start the isolated demo with docker compose -f compose.demo.yaml up -d --build'
}
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $response = Invoke-WebRequest -NoProxy -Uri "$api/system/health" -TimeoutSec 2
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (!$ready) { throw "Demo API did not become ready at $api" }

Invoke-DemoSql 'seed.sql'
Invoke-DemoSql 'extras.sql'
Invoke-DemoSql 'uust-programs.sql'
Invoke-DemoSql 'catalog-expansion.sql'
function Connect-DemoStudent([int]$Number) {
    Invoke-RestMethod -NoProxy -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (
        @{ login = "demo.student$Number"; password = 'DemoShowcase2026!' } | ConvertTo-Json -Compress
    )
}

function Get-DemoStudentMedia {
    docker compose -f $compose exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c "
        SELECT u.username FROM showcase.students s JOIN showcase.users u USING (user_id)
        WHERE s.photo_file_id IS NOT NULL OR u.avatar_file_id IS NOT NULL"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to check demo student photos' }
}

$studentsWithPhotos = @(Get-DemoStudentMedia)
foreach ($number in 1..20) {
    if ("demo.student$number" -in $studentsWithPhotos) { continue }
    $account = Connect-DemoStudent $number
    $authorization = @{ Authorization = "Bearer $($account.access_token)" }
    $photo = Join-Path $PSScriptRoot ('media/student{0:00}.jpg' -f $number)
    Invoke-RestMethod -NoProxy -Method Put -Uri "$api/users/me/photo" -Headers $authorization -Form @{
        file = Get-Item -LiteralPath $photo
    } | Out-Null
}

$login = Connect-DemoStudent 1
$headers = @{ Authorization = "Bearer $($login.access_token)" }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('showcase-demo-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    [IO.File]::WriteAllText((Join-Path $temp 'demo-result.txt'), "Демонстрационный отчёт. Маршруты проверены на 40 синтетических заявках. Итоговый отчёт по ETL содержит 92 балла из 100.")
    Copy-Item -LiteralPath (Join-Path $root 'frontend/public/demo/documents/resume-1.pdf') -Destination (Join-Path $temp 'demo-resume.pdf')
    foreach ($name in ('demo-result.txt', 'demo-resume.pdf')) {
        $query = "SELECT file_id FROM showcase.files WHERE uploaded_by='$($login.user_id)' AND original_name='$name' AND status='active' LIMIT 1"
        $fileId = docker compose -f $compose exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c $query
        if ($LASTEXITCODE -ne 0) { throw "Failed to check $name" }
        if (!$fileId) {
            $file = Invoke-RestMethod -NoProxy -Method Post -Uri "$api/files" -Headers $headers -Form @{ file = Get-Item -LiteralPath (Join-Path $temp $name) }
            $fileId = $file.file_id
        }
        $download = Invoke-WebRequest -NoProxy -Uri "$api/files/$fileId" -Headers $headers
        if ($download.StatusCode -ne 200) { throw "Failed to download $name" }
    }
    foreach ($entry in @(
        @{ File = 'task-tracker.jpg'; Account = $login },
        @{ File = 'campus-map.jpg'; Account = (Connect-DemoStudent 2) },
        @{ File = 'network-analysis.jpg'; Account = $login }
    )) {
        $account = $entry.Account
        $name = $entry.File
        $query = "SELECT file_id FROM showcase.files WHERE uploaded_by='$($account.user_id)' AND original_name='$name' AND status='active' LIMIT 1"
        $existing = docker compose -f $compose exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c $query
        if ($LASTEXITCODE -ne 0) { throw "Failed to check $name" }
        if (!$existing) {
            Invoke-RestMethod -NoProxy -Method Post -Uri "$api/files" -Headers @{ Authorization = "Bearer $($account.access_token)" } -Form @{
                file = Get-Item -LiteralPath (Join-Path $PSScriptRoot "media/$name")
            } | Out-Null
        }
    }
    Invoke-DemoSql 'files.sql'
} finally {
    foreach ($name in ('demo-result.txt', 'demo-resume.pdf')) {
        $path = Join-Path $temp $name
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
    }
    [IO.Directory]::Delete($temp)
}
function Add-DemoCatalogImages {
    $query = Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot 'media-targets.sql')
    $json = $query | docker compose -f $compose exec -T postgres psql -X -q -A -t -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Failed to read demo image targets' }

    $sessions = @{}
    foreach ($entry in ($json | ConvertFrom-Json)) {
        $owner = $entry.owner
        if (!$sessions.ContainsKey($owner)) {
            $sessions[$owner] = Invoke-RestMethod -NoProxy -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (
                @{ login = $owner; password = 'DemoShowcase2026!' } | ConvertTo-Json -Compress
            )
        }
        $session = $sessions[$owner]
        $headers = @{ Authorization = "Bearer $($session.access_token)" }
        $file = Get-Item -LiteralPath (Join-Path $PSScriptRoot "media/$($entry.filename)")
        $entryId = [guid]$entry.id

        $ownerId = [guid]$session.user_id
        $filename = $file.Name.Replace("'", "''")
        $lookup = "SELECT file_id FROM showcase.files WHERE uploaded_by='$ownerId' AND original_name='$filename' AND status='active' ORDER BY created_at LIMIT 1"
        $fileId = docker compose -f $compose exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1 -c $lookup
        if ($LASTEXITCODE -ne 0) { throw "Failed to find $filename" }
        if (!$fileId) {
            $upload = Invoke-RestMethod -NoProxy -Method Post -Uri "$api/files" -Headers $headers -Form @{ file = $file }
            $fileId = $upload.file_id
        }
        $mediaId = [guid]$fileId
        $attach = switch ($entry.kind) {
            'company' { "UPDATE showcase.companies c SET logo_file_id='$mediaId' WHERE c.company_id='$entryId' AND c.logo_file_id IS NULL AND EXISTS (SELECT 1 FROM showcase.company_members m WHERE m.company_id=c.company_id AND m.user_id='$ownerId' AND m.status='active')" }
            'case' { "UPDATE showcase.cases SET cover_file_id='$mediaId' WHERE case_id='$entryId' AND created_by='$ownerId' AND cover_file_id IS NULL" }
            'project' { "UPDATE showcase.student_projects SET cover_file_id='$mediaId' WHERE project_id='$entryId' AND owner_id='$ownerId' AND cover_file_id IS NULL" }
        }
        docker compose -f $compose exec -T postgres psql -X -q -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1 -c $attach
        if ($LASTEXITCODE -ne 0) { throw "Failed to attach $filename" }
    }
}

Add-DemoCatalogImages
Write-Output "Demo database ready. Swagger: $api/docs"
