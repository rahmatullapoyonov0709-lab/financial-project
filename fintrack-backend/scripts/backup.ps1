param(
  [string]$OutDir = ".\\backups"
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

$databaseUrl = $env:DATABASE_URL
if (-not $databaseUrl) {
  $databaseUrl = Get-EnvValueFromFile -Path ".\\.env" -Key "DATABASE_URL"
}

if (-not $databaseUrl) {
  throw "DATABASE_URL topilmadi. .env yoki environment variable ni tekshiring."
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump topilmadi. PostgreSQL client tools o'rnatilganligini tekshiring."
}

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$file = Join-Path $OutDir "fintrack_backup_$timestamp.dump"

Write-Host "Backup yaratilmoqda: $file"
pg_dump --dbname "$databaseUrl" --format=custom --file "$file"

Write-Host "Backup muvaffaqiyatli yaratildi: $file"
