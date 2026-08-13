$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-NetTCPConnection -LocalPort 3100 -State Listen -ErrorAction SilentlyContinue)) {
  Write-Host 'Iniciando servidor COMPEX em http://localhost:3100 ...' -ForegroundColor Green
  npm start
} else {
  Write-Host 'O servidor COMPEX já está ativo em http://localhost:3100' -ForegroundColor Yellow
}
