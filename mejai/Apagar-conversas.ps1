$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new()
$OutputEncoding = [Text.UTF8Encoding]::new()
Add-Type -AssemblyName System.Windows.Forms
$kitRoot = [IO.Path]::GetFullPath($PSScriptRoot)
$node = Join-Path $kitRoot 'runtime\node\node.exe'
$manager = Join-Path $kitRoot 'gerenciar-conversas.mjs'
function Call-Manager($Action, $Ids) {
  $errorFile=Join-Path ([IO.Path]::GetTempPath()) ('kit-cleanup-'+[Guid]::NewGuid().ToString('N')+'.err')
  $savedPreference=$ErrorActionPreference
  try {
    $ErrorActionPreference='Continue'
    if ($null -eq $Ids) { $result = & $node --disable-warning=ExperimentalWarning $manager $Action 2> $errorFile }
    else { $result = ConvertTo-Json -InputObject @($Ids) -Compress | & $node --disable-warning=ExperimentalWarning $manager $Action 2> $errorFile }
    $exitCode=$LASTEXITCODE
    $ErrorActionPreference=$savedPreference
    if ($exitCode -ne 0) { $detail=Get-Content -LiteralPath $errorFile -Raw; throw ("Failed action '$Action': "+$detail) }
    return ($result | ConvertFrom-Json)
  } finally { $ErrorActionPreference=$savedPreference; Remove-Item -LiteralPath $errorFile -Force -ErrorAction SilentlyContinue }
}
try {
  $listing = Call-Manager 'list' $null
  if (@($listing.sessions).Count -eq 0) { [Windows.Forms.MessageBox]::Show('There are no conversations to delete.','Kit conversations') | Out-Null; exit }
  $choices = @($listing.sessions | ForEach-Object { [pscustomobject]@{
    Conversation = $_.title
    Updated = [DateTimeOffset]::FromUnixTimeMilliseconds($_.time_updated).LocalDateTime.ToString('yyyy-MM-dd HH:mm')
    ID = $_.id
  }} | Out-GridView -Title 'Select conversations to delete (Ctrl/Shift for multiple). Includes old copies. Click OK.' -PassThru)
  if ($choices.Count -eq 0) { exit }
  $preview = Call-Manager 'plan' @($choices.ID)
  $titles = ($preview.sessions | Select-Object -First 12 | ForEach-Object { '- ' + $_.title }) -join "`r`n"
  $message = "Permanently delete $(@($preview.ids).Count) conversation(s), including derived sessions and copies in $(@($preview.files).Count) database(s)?`r`n`r`n$titles`r`n`r`nOpenCode will stop only if idle. Diagnostic logs and temporary tool outputs FROM ALL conversations will also be removed.`r`n`r`nTask files, downloads, models and settings will be preserved. There is no undo. Manual exports and copies outside the kit are not included."
  if ([Windows.Forms.MessageBox]::Show($message,'Confirm permanent deletion','YesNo','Warning','Button2') -ne 'Yes') { exit }
  $expected = Join-Path $kitRoot 'runtime\opencode.exe'
  $running = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $expected })
  foreach ($proc in $running) {
    if ($proc.CommandLine -notmatch 'serve.*--port\s+(\d+)') { throw 'An OpenCode process could not be verified. Close the kit before deleting.' }
    $port = [int]$Matches[1]
    $status = Invoke-RestMethod "http://127.0.0.1:$port/session/status" -TimeoutSec 5
    if (@($status.PSObject.Properties).Count -gt 0) { throw 'Tasks are running. Wait for completion or cancel them in OpenCode before deleting.' }
  }
  foreach ($proc in $running) { Stop-Process -Id $proc.ProcessId; Wait-Process -Id $proc.ProcessId -Timeout 10 -ErrorAction SilentlyContinue }
  $env:AGENTE_DELETE_CONFIRMED = 'yes'
  $result = Call-Manager 'erase' @($preview.ids)
  # Only known diagnostic/cache roots; never traverse junctions or delete task artifacts.
  function Clear-DiagnosticFiles([string]$Directory, [bool]$AllFiles) {
    if (-not (Test-Path -LiteralPath $Directory)) { return }
    $resolved = [IO.Path]::GetFullPath($Directory)
    if (-not $resolved.StartsWith($kitRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Path is outside the kit.' }
    if ((Get-Item -LiteralPath $resolved).Attributes -band [IO.FileAttributes]::ReparsePoint) { return }
    foreach ($entry in Get-ChildItem -LiteralPath $resolved -Force) {
      if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
      if ($entry.PSIsContainer) { Clear-DiagnosticFiles $entry.FullName $AllFiles }
      elseif ($AllFiles -or $entry.Extension -in @('.log','.jsonl')) { Remove-Item -LiteralPath $entry.FullName -Force }
    }
  }
  Clear-DiagnosticFiles (Join-Path $kitRoot 'logs') $false
  Clear-DiagnosticFiles (Join-Path $kitRoot 'dados\opencode-data\opencode\log') $true
  Clear-DiagnosticFiles (Join-Path $kitRoot 'dados\opencode-data\opencode\tool-output') $true
  [Windows.Forms.MessageBox]::Show("$($result.deleted) conversation(s) removed. Open Iniciar.cmd to return to the hub. Task files were preserved.",'Cleanup completed') | Out-Null
} catch {
  [Windows.Forms.MessageBox]::Show("Cleanup did not complete: $($_.Exception.Message)`r`nIf cleanup partially failed, run it again to check remaining copies.",'Cleanup failed','OK','Error') | Out-Null
} finally { Remove-Item Env:AGENTE_DELETE_CONFIRMED -ErrorAction SilentlyContinue }
