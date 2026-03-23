param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile
)

$ErrorActionPreference = "Stop"

function Get-EnvValueFromFile {
  param(
    [string]$Path,
    [string]$Key
  )

  if (-not (Test-Path $Path)) { return $null }
  $line = Get-Content $Path | Where-Object { $_ -match "^$Key=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return $line.Substring($Key.Length + 1).Trim('"')
}

if (-not (Test-Path $BackupFile)) {
  throw "Backup fayli topilmadi: $BackupFile"
}

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
  $databaseUrl = Get-EnvValueFromFile -Path ".\\.env" -Key "DATABASE_URL"
}

if (-not $databaseUrl) {
  throw "DATABASE_URL topilmadi. .env yoki environment variable ni tekshiring."
}

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore topilmadi. PostgreSQL client tools o'rnatilganligini tekshiring."
}

Write-Host "Restore boshlandi: $BackupFile"
pg_restore --dbname "$databaseUrl" --clean --if-exists --no-owner "$BackupFile"

Write-Host "Restore muvaffaqiyatli yakunlandi."
