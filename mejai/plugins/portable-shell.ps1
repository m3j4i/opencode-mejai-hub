param([Parameter(Mandatory=$true)][string]$EncodedCommand)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$PSNativeCommandUseErrorActionPreference = $false
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
$OutputEncoding = [Console]::OutputEncoding
$env:PYTHONIOENCODING = 'utf-8'
Remove-Item Alias:curl -ErrorAction SilentlyContinue
# Expose the existing bundled grep without putting unrelated Unix executables
# ahead of Windows commands in PATH. Native pipelines preserve grep flags.
$grepDirectory=Join-Path (Split-Path $PSScriptRoot -Parent) 'runtime/git/usr/bin'
if(Test-Path -LiteralPath (Join-Path $grepDirectory 'grep.exe')) {
  $env:PATH=$env:PATH+[IO.Path]::PathSeparator+$grepDirectory
}
function global:head {
  [CmdletBinding()]
  param([Parameter(Position=0)][Alias('n')][int]$Count=10,[Parameter(ValueFromPipeline=$true)]$InputObject)
  begin { $Count=[Math]::Abs($Count); $index=0 }
  process { if ($index++ -lt $Count) { $InputObject } }
}
$commandText = [Text.Encoding]::Unicode.GetString([Convert]::FromBase64String($EncodedCommand))
$commandText += "`n" + '$agenteCommandSucceeded=$?; if (-not $agenteCommandSucceeded) {if ($LASTEXITCODE) {exit $LASTEXITCODE}; exit 1}'
& ([ScriptBlock]::Create($commandText))
