param([switch]$CheckOnly)
$ErrorActionPreference='Stop'
$logs=Join-Path $PSScriptRoot 'logs'
$log=Join-Path $logs 'hub-launcher.log'
try {
  New-Item -ItemType Directory -Path $logs -Force | Out-Null
  $node=Join-Path $PSScriptRoot 'runtime\node\node.exe'
  $cli=Join-Path $PSScriptRoot 'mejai-cli.mjs'
  if(-not(Test-Path -LiteralPath $node)){throw 'Bundled Node.js is missing. Restore the complete kit folder.'}
  $result=(& $node $cli hub --quiet 2>&1 | Out-String)
  if($LASTEXITCODE -ne 0){throw $result.Trim()}
  $connection=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'dados\hub-win32.json') -Raw | ConvertFrom-Json
  $health=Invoke-RestMethod ($connection.url+'/api/health') -TimeoutSec 5
  if($health.base -ne $PSScriptRoot){throw 'The running hub belongs to another kit folder.'}
  $headers=@{'X-Mejai-Token'=$connection.token}
  Invoke-RestMethod ($connection.url+'/api/config?name=LANGUAGE.md') -Headers $headers -TimeoutSec 5 | Out-Null
  $address=$connection.url+'/#'+$connection.token
  if(-not $CheckOnly){
    # Show the requested browser window normally. Only the background server is hidden.
    $launch=New-Object System.Diagnostics.ProcessStartInfo
    $launch.FileName=$address
    $launch.UseShellExecute=$true
    [Diagnostics.Process]::Start($launch) | Out-Null
  }
  ('{0:o} Hub ready; browser requested={1}' -f (Get-Date),(-not $CheckOnly)) | Add-Content -LiteralPath $log
  Write-Output 'MEJAI hub is ready.'
} catch {
  $message='MEJAI could not open: '+$_.Exception.Message
  if(Test-Path -LiteralPath $logs){('{0:o} {1}' -f (Get-Date),$message) | Add-Content -LiteralPath $log}
  if(-not $CheckOnly){Add-Type -AssemblyName System.Windows.Forms;[Windows.Forms.MessageBox]::Show($message+"`n`nDetails: "+$log,'MEJAI') | Out-Null}
  Write-Error $message
  exit 1
}
