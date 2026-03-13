$ErrorActionPreference = 'Stop'

function Invoke-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message,
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  Write-Host $Message
  Invoke-Expression $Command

  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: $Command"
  }
}

Invoke-Step '[bootstrap] starting docker services' 'docker compose up -d'

Invoke-Step '[bootstrap] running management migrations' 'pnpm.cmd --filter management-api migrate'

Invoke-Step '[bootstrap] running app migrations' 'pnpm.cmd --filter app-api migrate'

Invoke-Step '[bootstrap] seeding management data' 'pnpm.cmd --filter management-api seed'

Invoke-Step '[bootstrap] seeding app data' 'pnpm.cmd --filter app-api seed'

Invoke-Step '[bootstrap] building shared' 'pnpm.cmd --filter @rotavans/shared build'
Invoke-Step '[bootstrap] building management-api' 'pnpm.cmd --filter management-api build'
Invoke-Step '[bootstrap] building app-api' 'pnpm.cmd --filter app-api build'
Invoke-Step '[bootstrap] building web' 'pnpm.cmd --filter web build'

Write-Host '[bootstrap] done'
