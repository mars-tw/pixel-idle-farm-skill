param(
  [string]$ConfigPath = (Join-Path $PSScriptRoot "..\art-config.json"),
  [string[]]$Only = @(),
  [switch]$DryRun,
  [string]$Model = ""
)

$ErrorActionPreference = "Stop"

function Join-Prompt {
  param(
    [string]$Main,
    [string]$Suffix
  )

  $parts = @()
  if ($Main.Trim()) { $parts += $Main.Trim() }
  if ($Suffix.Trim()) { $parts += $Suffix.Trim() }
  $parts += "Hard constraints: no text, no letters, no numbers, no logo, no watermark, no mockup border."
  return ($parts -join "`n")
}

$configFile = (Resolve-Path $ConfigPath).Path
$baseDir = Split-Path -Parent $configFile
$config = Get-Content -Raw -Encoding UTF8 -Path $configFile | ConvertFrom-Json
$modelName = if ($Model) { $Model } elseif ($config.model) { $config.model } else { "gpt-image-2" }
$outputDir = Join-Path $baseDir $config.outputDir
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$wanted = @{}
foreach ($token in $Only) {
  foreach ($part in ($token -split ",")) {
    $key = $part.Trim()
    if ($key) { $wanted[$key] = $true }
  }
}

$sheets = @($config.sheets)
if ($wanted.Count -gt 0) {
  $sheets = @($sheets | Where-Object { $wanted.ContainsKey($_.id) })
}

if ($sheets.Count -eq 0) {
  throw "No sheets matched. Check -Only or art-config.json."
}

foreach ($sheet in $sheets) {
  $prompt = Join-Prompt -Main $sheet.prompt -Suffix $config.styleSuffix
  $fileName = if ($sheet.file) { $sheet.file } else { "$($sheet.id).png" }
  $outFile = Join-Path $outputDir $fileName
  $size = if ($sheet.size) { $sheet.size } else { $config.size }
  $quality = if ($sheet.quality) { $sheet.quality } else { $config.quality }

  Write-Host ""
  Write-Host "== $($sheet.id) =="
  Write-Host "Model: $modelName"
  Write-Host "Size: $size"
  Write-Host "Quality: $quality"
  Write-Host "Output: $outFile"
  Write-Host "Prompt:"
  Write-Host $prompt

  if ($DryRun) {
    continue
  }

  if (-not $env:OPENAI_API_KEY) {
    throw "OPENAI_API_KEY is not set. Re-run with -DryRun to preview prompts."
  }

  $body = @{
    model = $modelName
    prompt = $prompt
    size = $size
    quality = $quality
  } | ConvertTo-Json -Depth 8

  $headers = @{
    Authorization = "Bearer $env:OPENAI_API_KEY"
  }

  $response = Invoke-RestMethod `
    -Method Post `
    -Uri "https://api.openai.com/v1/images/generations" `
    -Headers $headers `
    -ContentType "application/json" `
    -Body $body

  $first = @($response.data)[0]
  if ($first.b64_json) {
    [System.IO.File]::WriteAllBytes($outFile, [Convert]::FromBase64String($first.b64_json))
  } elseif ($first.url) {
    Invoke-WebRequest -Uri $first.url -OutFile $outFile
  } else {
    throw "Image response did not include b64_json or url."
  }

  Write-Host "Saved $outFile"
}
