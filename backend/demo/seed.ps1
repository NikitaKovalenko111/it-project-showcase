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
$login = Invoke-RestMethod -NoProxy -Method Post -Uri "$api/auth/login" -ContentType 'application/json' -Body (
    @{ login = 'demo.student1'; password = 'DemoShowcase2026!' } | ConvertTo-Json -Compress
)
$headers = @{ Authorization = "Bearer $($login.access_token)" }
$temp = Join-Path ([IO.Path]::GetTempPath()) ('showcase-demo-' + [guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($temp) | Out-Null
try {
    [IO.File]::WriteAllText((Join-Path $temp 'demo-result.txt'), "Демонстрационный отчёт. Маршруты проверены на 40 синтетических заявках. Итоговый отчёт по ETL содержит 92 балла из 100.")
    [IO.File]::WriteAllBytes((Join-Path $temp 'demo-cover.png'), [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aHZ8AAAAASUVORK5CYII='))
    Copy-Item -LiteralPath (Join-Path $root 'frontend/public/demo/documents/resume-1.pdf') -Destination (Join-Path $temp 'demo-resume.pdf')
    foreach ($name in ('demo-result.txt', 'demo-cover.png', 'demo-resume.pdf')) {
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
    Invoke-DemoSql 'files.sql'
} finally {
    foreach ($name in ('demo-result.txt', 'demo-cover.png', 'demo-resume.pdf')) {
        $path = Join-Path $temp $name
        if (Test-Path -LiteralPath $path) { Remove-Item -LiteralPath $path }
    }
    [IO.Directory]::Delete($temp)
}
Write-Output "Demo database ready. Swagger: $api/docs" 
