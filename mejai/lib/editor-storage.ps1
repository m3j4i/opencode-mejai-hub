function Test-EditorContent([string]$Tipo,[string]$Value) {
  if($Tipo -eq 'navegador') {
    $obj=ConvertFrom-Json -InputObject $Value -ErrorAction Stop
    if($null -eq $obj -or $obj.engine -notin @('camoufox','chromium')) {throw 'The engine field must be camoufox or chromium.'}
  } elseif([string]::IsNullOrWhiteSpace($Value)) {throw 'Rules cannot be empty.'}
}
function Save-EditorContent([string]$File,[string]$Tipo,[string]$Expected,[string]$Value) {
  Test-EditorContent $Tipo $Value
  if([IO.File]::ReadAllText($File,[Text.Encoding]::UTF8) -cne $Expected) {throw 'The file changed outside this editor. Reopen it to preserve the other edit.'}
  $temporary=$File+'.'+[Guid]::NewGuid().ToString('N')+'.tmp'
  $attributes=[IO.File]::GetAttributes($File)
  try {
    [IO.File]::WriteAllText($temporary,$Value,[Text.UTF8Encoding]::new($false))
    [IO.File]::SetAttributes($File,$attributes -band (-bnot [IO.FileAttributes]::Hidden))
    [IO.File]::Replace($temporary,$File,[NullString]::Value)
  } finally {
    [IO.File]::SetAttributes($File,$attributes)
    if([IO.File]::Exists($temporary)){[IO.File]::Delete($temporary)}
  }
}

