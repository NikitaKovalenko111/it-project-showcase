#requires -Version 5.1
$ErrorActionPreference = 'Stop'
# The shared importer targets the isolated Docker demo.
node (Join-Path $PSScriptRoot 'import.mjs') @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
