$ErrorActionPreference='Stop'
. "$PSScriptRoot\..\..\lib\editor-storage.ps1"
$dir=Join-Path $env:TEMP ('editor-test-'+[Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($dir) | Out-Null
$file=Join-Path $dir 'settings.json'
[IO.File]::WriteAllText($file,'{"engine":"camoufox"}',[Text.UTF8Encoding]::new($false))
[IO.File]::SetAttributes($file,[IO.FileAttributes]::Hidden)
Save-EditorContent $file navegador '{"engine":"camoufox"}' '{"engine":"chromium"}'
if([IO.File]::ReadAllText($file) -ne '{"engine":"chromium"}'){throw 'Not saved'}
if(-not([IO.File]::GetAttributes($file) -band [IO.FileAttributes]::Hidden)){throw 'Hidden lost'}
foreach($value in @('{bad','{"engine":"wrong"}')){
 $failed=$false;try{Save-EditorContent $file navegador '{"engine":"chromium"}' $value}catch{$failed=$true}
 if(-not $failed -or [IO.File]::ReadAllText($file) -ne '{"engine":"chromium"}'){throw 'Invalid save accepted'}
}
$failed=$false;try{Save-EditorContent $file navegador 'outdated' '{"engine":"camoufox"}'}catch{$failed=$true}
if(-not $failed){throw 'Concurrent edit overwritten'}
'PASS: hidden-file save, invalid JSON, invalid engine, concurrent change protection.'
