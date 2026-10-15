param([switch]$SemNavegador)
$ErrorActionPreference='Stop'
$arguments=@((Join-Path $PSScriptRoot 'mejai-cli.mjs'),'chat')
if($SemNavegador){$arguments+='--quiet'}
& (Join-Path $PSScriptRoot 'runtime/node/node.exe') @arguments
if($LASTEXITCODE){throw 'MEJAI could not start. Inspect the hub status.'}
