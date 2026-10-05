param(
  [switch]$RunMigrations,
  [switch]$RunChecks
)

$ErrorActionPreference = "Stop"
$nodeVersion = node --version
if (-not $nodeVersion) { throw "Node.js 20.19+ or 22.12+ is required." }
$parsedNodeVersion = [Version]$nodeVersion.TrimStart("v")
$supportedNode = (($parsedNodeVersion.Major -eq 20) -and ($parsedNodeVersion -ge [Version]"20.19.0")) -or ($parsedNodeVersion -ge [Version]"22.12.0")
if (-not $supportedNode) { throw "Node.js 20.19+ or 22.12+ is required; found $nodeVersion." }
corepack enable
if (-not (Test-Path -LiteralPath ".env")) {
  Copy-Item -LiteralPath ".env.example" -Destination ".env"
  Write-Host "Created .env from .env.example. Review it before starting Uptrail."
} else {
  Write-Host "Existing .env preserved."
}
pnpm install --frozen-lockfile
if ($RunMigrations) { pnpm db:migrate }
if ($RunChecks) { pnpm check; pnpm test; pnpm build }
