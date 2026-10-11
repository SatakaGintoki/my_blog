$ErrorActionPreference = 'Stop'
$blogRoot = $PSScriptRoot
$blogPython = if ($env:BLOG_PYTHON) { $env:BLOG_PYTHON } else { Join-Path $blogRoot '.venv/Scripts/python.exe' }
if (-not (Test-Path -LiteralPath $blogPython)) {
    throw '请先执行 python -m venv .venv 并安装 requirements.txt。'
}
if (-not (Test-Path -LiteralPath (Join-Path $blogRoot 'frontend/node_modules'))) {
    throw '请先在 frontend 目录执行 npm ci。'
}
Push-Location $blogRoot
try {
    & $blogPython scripts/init_local.py
    if ($LASTEXITCODE -ne 0) { throw '本地配置初始化失败。' }
    $blogLogDirectory = Join-Path $blogRoot '.dev-logs'
    New-Item -ItemType Directory -Path $blogLogDirectory -Force | Out-Null
    $blogProcess = Start-Process -FilePath $blogPython -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000') -WorkingDirectory $blogRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $blogLogDirectory 'api.log') -RedirectStandardError (Join-Path $blogLogDirectory 'api-error.log') -PassThru
    Write-Host '博客：http://localhost:5173  |  设计预览：http://localhost:5173/preview'
    Write-Host '后台：http://localhost:5173/admin  |  Ctrl+C 停止开发服务'
    & npm run dev --prefix frontend -- --port 5173 --strictPort
} finally {
    if ($blogProcess -and -not $blogProcess.HasExited) { Stop-Process -Id $blogProcess.Id }
    Pop-Location
}
