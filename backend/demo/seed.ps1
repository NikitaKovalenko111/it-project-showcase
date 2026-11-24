#requires -Version 5.1

$ErrorActionPreference = 'Stop'
$OutputEncoding = [Text.UTF8Encoding]::new($false)
Add-Type -AssemblyName System.Net.Http
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$compose = Join-Path $root 'compose.demo.yaml'
$composeArgs = @('--project-directory', $root, '-f', $compose)

function Invoke-DemoRequest {
    param(
        [string]$Method = 'GET',
        [string]$Route,
        [string]$Token,
        [string]$File,
        [hashtable]$Body,
        [int]$TimeoutSec = 30,
        [switch]$Json
    )

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    $request = $null
    $response = $null
    try {
        $client.Timeout = [TimeSpan]::FromSeconds($TimeoutSec)
        $request = [System.Net.Http.HttpRequestMessage]::new(
            [System.Net.Http.HttpMethod]::new($Method), "$api$Route")
        if ($Token) {
            $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
        }
        if ($File) {
            $request.Content = [System.Net.Http.MultipartFormDataContent]::new()
            $upload = [System.Net.Http.StreamContent]::new([IO.File]::OpenRead($File))
            $request.Content.Add($upload, 'file', [IO.Path]::GetFileName($File))
        } elseif ($Body) {
            $request.Content = [System.Net.Http.StringContent]::new(
                ($Body | ConvertTo-Json -Compress), [Text.Encoding]::UTF8, 'application/json')
        }
        $response = $client.SendAsync($request).GetAwaiter().GetResult()
        if (!$response.IsSuccessStatusCode) {
            $detail = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
            throw "$Method ${Route}: HTTP $([int]$response.StatusCode). $detail"
        }
        if ($Json) {
            $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json
        } else {
            [int]$response.StatusCode
        }
    } finally {
        if ($response) { $response.Dispose() }
        if ($request) { $request.Dispose() }
        $client.Dispose()
    }
}

function Invoke-DemoSql([string]$File) {
    Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $PSScriptRoot $File) |
        docker compose @composeArgs exec -T postgres psql -X -q -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw "Failed to apply $File" }
}

docker compose @composeArgs up -d --wait
if ($LASTEXITCODE -ne 0) {
    docker compose @composeArgs logs --tail 40 api
    throw 'Failed to start the demo services'
}

$mapping = (docker compose @composeArgs port api 3005) -join ''
if ($LASTEXITCODE -ne 0 -or $mapping -notmatch '^127\.0\.0\.1:\d{1,5}$') {
    throw "Demo API must be published on a loopback port. Compose returned '$mapping'."
}
$api = "http://$mapping/api/v1"
$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
    try {
        $status = Invoke-DemoRequest -Route '/system/health' -TimeoutSec 2
        if ($status -eq 200) { $ready = $true; break }
    } catch {
        Start-Sleep -Seconds 1
    }
}
if (!$ready) {
    docker compose @composeArgs logs --tail 40 api
    throw "Demo API did not become ready at $api"
}

Invoke-DemoSql 'seed.sql'
Invoke-DemoSql 'extras.sql'
Invoke-DemoSql 'uust-programs.sql'
Invoke-DemoSql 'catalog-expansion.sql'
function Connect-DemoUser([string]$Username) {
    Invoke-DemoRequest -Method Post -Route '/auth/login' -Json -Body @{
        login = $Username
        password = 'DemoShowcase2026!'
    }
}

function Get-DemoStudentMedia {
    docker compose @composeArgs exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c "
        SELECT u.username FROM showcase.students s JOIN showcase.users u USING (user_id)
        WHERE s.photo_file_id IS NOT NULL OR u.avatar_file_id IS NOT NULL"
    if ($LASTEXITCODE -ne 0) { throw 'Failed to check demo student photos' }
}

$studentsWithPhotos = @(Get-DemoStudentMedia)
foreach ($number in 1..20) {
    if ("demo.student$number" -in $studentsWithPhotos) { continue }
    $account = Connect-DemoUser "demo.student$number"
    $photo = Join-Path $PSScriptRoot ('media/student{0:00}.jpg' -f $number)
    Invoke-DemoRequest -Method Put -Route '/users/me/photo' -Token $account.access_token -File $photo | Out-Null
}

$login = Connect-DemoUser 'demo.student1'
$temp = Join-Path ([IO.Path]::GetTempPath()) ('showcase-demo-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    [IO.File]::WriteAllText((Join-Path $temp 'demo-result.txt'), "Демонстрационный отчёт. Маршруты проверены на 40 синтетических заявках. Итоговый отчёт по ETL содержит 92 балла из 100.")
    Copy-Item -LiteralPath (Join-Path $root 'frontend/public/demo/documents/resume-1.pdf') -Destination (Join-Path $temp 'demo-resume.pdf')
    foreach ($name in ('demo-result.txt', 'demo-resume.pdf')) {
        $query = "SELECT file_id FROM showcase.files WHERE uploaded_by='$($login.user_id)' AND original_name='$name' AND status='active' LIMIT 1"
        $fileId = docker compose @composeArgs exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c $query
        if ($LASTEXITCODE -ne 0) { throw "Failed to check $name" }
        if (!$fileId) {
            $file = Invoke-DemoRequest -Method Post -Route '/files' -Token $login.access_token -File (Join-Path $temp $name) -Json
            $fileId = $file.file_id
        }
        $status = Invoke-DemoRequest -Route "/files/$fileId" -Token $login.access_token
        if ($status -ne 200) { throw "Failed to download $name" }
    }
    foreach ($entry in @(
        @{ File = 'task-tracker.jpg'; Account = $login },
        @{ File = 'campus-map.jpg'; Account = (Connect-DemoUser 'demo.student2') },
        @{ File = 'network-analysis.jpg'; Account = $login }
    )) {
        $account = $entry.Account
        $name = $entry.File
        $query = "SELECT file_id FROM showcase.files WHERE uploaded_by='$($account.user_id)' AND original_name='$name' AND status='active' LIMIT 1"
        $existing = docker compose @composeArgs exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -c $query
        if ($LASTEXITCODE -ne 0) { throw "Failed to check $name" }
        if (!$existing) {
            Invoke-DemoRequest -Method Post -Route '/files' -Token $account.access_token -File (Join-Path $PSScriptRoot "media/$name") | Out-Null
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
    $json = $query | docker compose @composeArgs exec -T postgres psql -X -q -A -t -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1
    if ($LASTEXITCODE -ne 0) { throw 'Failed to read demo image targets' }

    $sessions = @{}
    foreach ($entry in ($json | ConvertFrom-Json)) {
        $owner = $entry.owner
        if (!$sessions.ContainsKey($owner)) {
            $sessions[$owner] = Connect-DemoUser $owner
        }
        $session = $sessions[$owner]
        $file = Get-Item -LiteralPath (Join-Path $PSScriptRoot "media/$($entry.filename)")
        $entryId = [guid]$entry.id

        $ownerId = [guid]$session.user_id
        $filename = $file.Name.Replace("'", "''")
        $lookup = "SELECT file_id FROM showcase.files WHERE uploaded_by='$ownerId' AND original_name='$filename' AND status='active' ORDER BY created_at LIMIT 1"
        $fileId = docker compose @composeArgs exec -T postgres psql -X -A -t -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1 -c $lookup
        if ($LASTEXITCODE -ne 0) { throw "Failed to find $filename" }
        if (!$fileId) {
            $upload = Invoke-DemoRequest -Method Post -Route '/files' -Token $session.access_token -File $file.FullName -Json
            $fileId = $upload.file_id
        }
        $mediaId = [guid]$fileId
        $attach = switch ($entry.kind) {
            'company' { "UPDATE showcase.companies c SET logo_file_id='$mediaId' WHERE c.company_id='$entryId' AND c.logo_file_id IS NULL AND EXISTS (SELECT 1 FROM showcase.company_members m WHERE m.company_id=c.company_id AND m.user_id='$ownerId' AND m.status='active')" }
            'case' { "UPDATE showcase.cases SET cover_file_id='$mediaId' WHERE case_id='$entryId' AND created_by='$ownerId' AND cover_file_id IS NULL" }
            'project' { "UPDATE showcase.student_projects SET cover_file_id='$mediaId' WHERE project_id='$entryId' AND owner_id='$ownerId' AND cover_file_id IS NULL" }
        }
        docker compose @composeArgs exec -T postgres psql -X -q -U showcase_demo -d showcase_demo -v ON_ERROR_STOP=1 -c $attach
        if ($LASTEXITCODE -ne 0) { throw "Failed to attach $filename" }
    }
}

Add-DemoCatalogImages
Write-Output "Demo database ready. Swagger: $api/docs"
