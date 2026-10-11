param([switch]$Cuda)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.venv/Scripts/python.exe')) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Could not create Python environment.' }
}
if ($Cuda) {
    & ./.venv/Scripts/python.exe -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cu128
} else {
    & ./.venv/Scripts/python.exe -m pip install torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu
}
if ($LASTEXITCODE -ne 0) { throw 'PyTorch install failed.' }
& ./.venv/Scripts/python.exe -m pip install -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency install failed.' }
Push-Location frontend
try {
    npm ci
    if ($LASTEXITCODE -ne 0) { throw 'UI dependency install failed.' }
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'UI build failed.' }
} finally { Pop-Location }
Write-Host 'LeafLens is ready. Run ./scripts/start.ps1 and open http://127.0.0.1:8000'
