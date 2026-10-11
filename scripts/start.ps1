$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (!(Test-Path '.venv/Scripts/python.exe')) { throw 'Run scripts/setup.ps1 first.' }
if (!(Test-Path 'frontend/dist/index.html')) { throw 'Run scripts/setup.ps1 to build the interface first.' }
& ./.venv/Scripts/python.exe -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
