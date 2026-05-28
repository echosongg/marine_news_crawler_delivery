# 打包完整交付目录为 zip，用于上传到 GitHub Release
# 用法：在项目根目录执行  .\scripts\make-release-zip.ps1
#       或指定版本：     .\scripts\make-release-zip.ps1 -Version v1.0.0

param(
    [string]$Version = "v1.0.0"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Dist = Join-Path $Root "dist"
$ZipName = "marine_news_crawler_delivery-$Version.zip"
$ZipPath = Join-Path $Dist $ZipName

New-Item -ItemType Directory -Force -Path $Dist | Out-Null

if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

$Include = @(
    "marine_news_crawler.exe",
    "run.bat",
    "_internal",
    "app",
    ".cursor",
    "static"
)

# README 文件名含中文，单独复制
$Readme = Get-ChildItem -Path $Root -Filter "README*" -File | Select-Object -First 1

$TempDir = Join-Path $env:TEMP "marine_news_crawler_delivery_pack"
if (Test-Path $TempDir) { Remove-Item $TempDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $TempDir | Out-Null

foreach ($item in $Include) {
    $src = Join-Path $Root $item
    if (-not (Test-Path $src)) {
        Write-Warning "Skip missing: $item"
        continue
    }
    Copy-Item -Path $src -Destination (Join-Path $TempDir $item) -Recurse -Force
}

if ($Readme) {
    Copy-Item -Path $Readme.FullName -Destination (Join-Path $TempDir $Readme.Name) -Force
} else {
    Write-Warning "Skip missing: README"
}

# 创建空目录占位（用户首次运行时会自动生成内容）
foreach ($dir in @("logs", "output", "data")) {
    $targetDir = Join-Path $TempDir $dir
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    New-Item -ItemType File -Force -Path (Join-Path $targetDir ".gitkeep") | Out-Null
}

Compress-Archive -Path (Join-Path $TempDir "*") -DestinationPath $ZipPath -Force
Remove-Item $TempDir -Recurse -Force

$SizeMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Write-Host "Created: $ZipPath ($SizeMB MB)"
Write-Host "Upload this file to GitHub Releases as asset for tag $Version"
