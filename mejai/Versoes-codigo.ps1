param([switch]$Criar,[switch]$Listar)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
$base=$PSScriptRoot;$root=Join-Path $base 'runtime\versoes-codigo'
function Allowed([string]$relative){return $relative -match '^(?:[^\\/]+\.(?:mjs|ps1|cmd)|(?:lib|plugins)[\\/][^\\/]+\.(?:mjs|ps1))$'}
try{
 if($Criar){
  $folder=Join-Path $root ((Get-Date -Format yyyyMMdd-HHmmss)+'-'+[Guid]::NewGuid().ToString('N').Substring(0,6));[IO.Directory]::CreateDirectory($folder)|Out-Null
  $manifest=@()
  $files=@(Get-ChildItem -LiteralPath $base -File -Force)
  foreach($sub in @('plugins','lib')){$files+=@(Get-ChildItem -LiteralPath (Join-Path $base $sub) -File -Force)}
  foreach($file in $files){$relative=$file.FullName.Substring($base.Length+1);if(-not(Allowed $relative)){continue};if($file.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Redirected file.'};$target=Join-Path $folder $relative;[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))|Out-Null;Copy-Item -LiteralPath $file.FullName -Destination $target;$manifest+=@{path=$relative;sha256=(Get-FileHash $target -Algorithm SHA256).Hash}}
  [IO.File]::WriteAllText((Join-Path $folder 'manifest.json'),(ConvertTo-Json -InputObject $manifest -Depth 5),[Text.UTF8Encoding]::new($false));Write-Output $folder;exit
 }
 $versions=@(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue|Sort-Object Name -Descending)
 if($Listar){$versions.Name;exit}
 if(@(Get-Process opencode -ErrorAction SilentlyContinue|Where-Object {$_.Path -eq (Join-Path $base 'runtime\opencode.exe')}).Count){throw 'Stop the agent before restoring code.'}
 $selected=$versions|Select-Object Name,FullName|Out-GridView -Title 'MEJAI: choose a code version to restore' -OutputMode Single
 if(-not $selected){exit}
 $manifest=Get-Content -LiteralPath (Join-Path $selected.FullName 'manifest.json') -Raw|ConvertFrom-Json
 foreach($entry in $manifest){
  if(-not(Allowed $entry.path)){throw 'Path is not allowed in the manifest.'}
  $src=Join-Path $selected.FullName $entry.path
  if((Get-FileHash -LiteralPath $src -Algorithm SHA256).Hash -ne $entry.sha256){throw 'Code copy was modified: integrity check failed.'}
  foreach($candidate in @($src,(Join-Path $base $entry.path),[IO.Path]::GetDirectoryName((Join-Path $base $entry.path)))){if((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Redirected path; restore blocked.'}}
  if($src.EndsWith('.ps1')){$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile($src,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Copy contains a PowerShell error.'}}
  if($src.EndsWith('.mjs')){& (Join-Path $base 'runtime\node\node.exe') --check $src;if($LASTEXITCODE -ne 0){throw 'Copy contains a JavaScript error.'}}
 }
 if([Windows.Forms.MessageBox]::Show('Restore the selected code? Conversations, rules, connections, models and JSON settings will be preserved.','MEJAI','YesNo','Warning') -ne 'Yes'){exit}
 & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Criar|Out-Null
 if($LASTEXITCODE -ne 0){throw 'Could not preserve the current code.'}
 foreach($entry in $manifest){$target=Join-Path $base $entry.path;$attrs=if(Test-Path -LiteralPath $target){[IO.File]::GetAttributes($target)}else{[IO.FileAttributes]::Normal};if(Test-Path -LiteralPath $target){[IO.File]::SetAttributes($target,[IO.FileAttributes]::Normal)};try{Copy-Item -LiteralPath (Join-Path $selected.FullName $entry.path) -Destination $target -Force}finally{[IO.File]::SetAttributes($target,$attrs)}}
 [Windows.Forms.MessageBox]::Show('Code restored. Run Maintenance tests before opening the chat.','MEJAI')|Out-Null
}catch{if($Criar -or $Listar){throw};[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Could not restore','OK','Error')|Out-Null}
