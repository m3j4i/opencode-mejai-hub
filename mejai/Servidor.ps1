param([int]$Port=4096)
$ErrorActionPreference='Stop'
# Compatibility entry point; the shared hub owns the server and port.
& (Join-Path $PSScriptRoot 'runtime/node/node.exe') (Join-Path $PSScriptRoot 'mejai-cli.mjs') start --quiet
if($LASTEXITCODE){throw 'MEJAI could not start. Inspect the hub status.'}
