$ErrorActionPreference='Stop'
& (Join-Path $PSScriptRoot 'runtime/node/node.exe') (Join-Path $PSScriptRoot 'mejai-cli.mjs') stop --quiet
if($LASTEXITCODE){throw 'MEJAI could not stop. Inspect the hub status.'}
