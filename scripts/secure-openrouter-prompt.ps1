$ErrorActionPreference = "Stop"
$Host.UI.RawUI.WindowTitle = "UPTRAIL SECURE OPENROUTER KEY PROMPT"
Clear-Host
Write-Host "UPTRAIL SECURE OPENROUTER CONFIGURATION" -ForegroundColor Cyan
Write-Host "Copy the NEW replacement key from OpenRouter to the clipboard."
Write-Host "Do not open or edit this script. Do not paste the key into chat."
Write-Host ""

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
if (-not (Test-Path -LiteralPath $envPath -PathType Leaf)) {
  throw "The local .env file does not exist."
}

& git -C $projectRoot check-ignore --quiet .env
if ($LASTEXITCODE -ne 0) { throw ".env is not Git-ignored." }
$trackedEnv = & git -C $projectRoot ls-files -- .env
if ($trackedEnv) { throw ".env is tracked." }

Read-Host "After copying the complete NEW key, press Enter to import and clear the clipboard" | Out-Null
try {
  $apiKey = ([string](Get-Clipboard -Raw)).Trim()
} finally {
  Set-Clipboard -Value ""
}
if ([string]::IsNullOrWhiteSpace($apiKey) -or $apiKey -notmatch '^sk-or-v1-[A-Za-z0-9_-]+$') {
  Write-Host "Characters received: $($apiKey.Length)" -ForegroundColor Yellow
  Write-Host "OpenRouter prefix present: $($apiKey.StartsWith('sk-or-v1-'))" -ForegroundColor Yellow
  $apiKey = $null
  throw "The value does not have the expected OpenRouter key format."
}

$settings = [ordered]@{
  AI_BASE_URL   = "https://openrouter.ai/api/v1"
  AI_API_KEY    = $apiKey
  AI_CHAT_MODEL = "openrouter/free"
}
$seen = @{}
$updatedLines = [Collections.Generic.List[string]]::new()
foreach ($line in [IO.File]::ReadAllLines($envPath)) {
  if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=') {
    $name = $Matches[1]
    if ($settings.Contains($name)) {
      if (-not $seen.ContainsKey($name)) {
        $updatedLines.Add("$name=$($settings[$name])")
        $seen[$name] = $true
      }
      continue
    }
  }
  $updatedLines.Add($line)
}
foreach ($name in $settings.Keys) {
  if (-not $seen.ContainsKey($name)) {
    $updatedLines.Add("$name=$($settings[$name])")
  }
}
[IO.File]::WriteAllLines($envPath, $updatedLines, [Text.UTF8Encoding]::new($false))

$apiKey = $null
[GC]::Collect()
Write-Host ""
Write-Host "SUCCESS: configuration saved to the ignored .env file." -ForegroundColor Green
Write-Host "Return to Codex and reply: done"
Read-Host "Press Enter to close"
