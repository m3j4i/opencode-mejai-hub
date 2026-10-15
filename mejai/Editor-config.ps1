param([ValidateSet('regras','navegador')][string]$Tipo='regras',[switch]$Validar,[string]$Previa)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'lib\editor-storage.ps1')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[Windows.Forms.Application]::EnableVisualStyles()
$file=Join-Path $PSScriptRoot $(if($Tipo -eq 'navegador'){'navegador-preferencias.json'}else{'INSTRUCOES.md'})
$script:original=[IO.File]::ReadAllText($file,[Text.Encoding]::UTF8)
$script:dirty=$false
$script:painting=$false
$window=New-Object Windows.Forms.Form
$window.Text='MEJAI editor — '+[IO.Path]::GetFileName($file)
$window.Size=New-Object Drawing.Size(960,740); $window.MinimumSize=New-Object Drawing.Size(640,450)
$window.StartPosition='CenterScreen'; $window.BackColor=[Drawing.Color]::FromArgb(25,30,40)
$window.ForeColor=[Drawing.Color]::Gainsboro; $window.KeyPreview=$true
$toolbar=New-Object Windows.Forms.FlowLayoutPanel; $toolbar.Dock='Top'; $toolbar.Height=48
$editor=New-Object Windows.Forms.RichTextBox
$editor.Dock='Fill'; $editor.Font=New-Object Drawing.Font('Consolas',12)
$editor.BackColor=[Drawing.Color]::FromArgb(25,30,40); $editor.ForeColor=[Drawing.Color]::Gainsboro
$editor.BorderStyle='None'; $editor.WordWrap=($Tipo -eq 'regras'); $editor.AcceptsTab=$true; $editor.DetectUrls=$false
$editor.SelectionTabs=@(24,48,72,96,120,144,168,192)
$editor.Text=$script:original.Replace("`r`n","`n").Replace("`n","`r`n")
if($Tipo -eq 'navegador') {try{$editor.Text=($script:original | ConvertFrom-Json | ConvertTo-Json -Depth 50)}catch{}}
$status=New-Object Windows.Forms.Label; $status.Dock='Bottom'; $status.Height=30
$status.Padding=New-Object Windows.Forms.Padding(8,6,0,0)
$status.Text='UTF-8 • Ctrl+S saves • Tab indents • Ctrl+Z undoes'
function Check-Content([string]$value){ Test-EditorContent $Tipo $value }
function Color-Content {
 $script:painting=$true
 $start=$editor.SelectionStart; $length=$editor.SelectionLength
 try{
  $editor.SelectAll(); $editor.SelectionColor=[Drawing.Color]::Gainsboro
  $pattern=if($Tipo -eq 'navegador'){'"(?:\\.|[^"\\])*"|\b(?:true|false|null|\d+)\b'}else{'(?m)^#{1,6} .+$|(?m)^[A-ZÁÉÍÓÚÇ][A-ZÁÉÍÓÚÇ _-]+:'}
  foreach($match in [regex]::Matches($editor.Text,$pattern)){
   $editor.Select($match.Index,$match.Length)
   $editor.SelectionColor=if($match.Value.StartsWith('"')){[Drawing.Color]::FromArgb(152,210,158)}else{[Drawing.Color]::FromArgb(115,180,255)}
  }
 }finally{$editor.Select($start,$length);$script:painting=$false}
}
function Save-Content {
 try{
  Save-EditorContent $file $Tipo $script:original $editor.Text
  $script:original=$editor.Text; $script:dirty=$false
  $window.Text='MEJAI editor — '+[IO.Path]::GetFileName($file)
  $status.Text='Saved as UTF-8. Restart the agent when no tasks are running.'
 }catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Not saved','OK','Warning') | Out-Null}
}
foreach($caption in @('Save (Ctrl+S)','Format','Validate','Word wrap')){
 $button=New-Object Windows.Forms.Button; $button.Text=$caption; $button.Width=145; $button.Height=34
 $button.FlatStyle='Flat'; $button.ForeColor=[Drawing.Color]::Gainsboro
 $button.Add_Click({param($sender,$event)
  try{switch($sender.Text){
   'Save (Ctrl+S)' {Save-Content}
   'Format' {if($Tipo -eq 'navegador'){Check-Content $editor.Text;$editor.Text=($editor.Text | ConvertFrom-Json | ConvertTo-Json -Depth 50)};Color-Content}
   'Word wrap' {$editor.WordWrap=-not $editor.WordWrap}
   'Validate' {Check-Content $editor.Text;$status.Text='Valid content. No changes were saved.'}
  }}catch{[Windows.Forms.MessageBox]::Show($_.Exception.Message,'Check the content','OK','Warning') | Out-Null}
 });$toolbar.Controls.Add($button)
}
$editor.Add_TextChanged({if(-not $script:painting){$script:dirty=$true;$window.Text='* MEJAI editor — '+[IO.Path]::GetFileName($file)}})
$editor.Add_SelectionChanged({if(-not $script:painting -and $script:dirty){$line=$editor.GetLineFromCharIndex($editor.SelectionStart)+1;$status.Text="Line $line • Unsaved changes • Ctrl+S to save"}})
$window.Add_KeyDown({param($sender,$event) if($event.Control -and $event.KeyCode -eq 'S'){$event.SuppressKeyPress=$true;Save-Content}})
$window.Add_FormClosing({param($sender,$event) if($script:dirty -and [Windows.Forms.MessageBox]::Show('Discard unsaved changes?','Close editor','YesNo','Warning','Button2') -ne 'Yes'){$event.Cancel=$true}})
$window.Controls.Add($editor);$window.Controls.Add($toolbar);$window.Controls.Add($status)
Color-Content
if($Validar){
 Check-Content $script:original
 if($Tipo -eq 'navegador'){$rejected=$false;try{Check-Content '{"engine":"invalido"}'}catch{$rejected=$true};if(-not $rejected){throw 'Invalid JSON was not rejected'}}
 if($Previa){$window.Show();[Windows.Forms.Application]::DoEvents();$bitmap=New-Object Drawing.Bitmap($window.Width,$window.Height);$window.DrawToBitmap($bitmap,(New-Object Drawing.Rectangle(0,0,$window.Width,$window.Height)));$bitmap.Save($Previa);$bitmap.Dispose();$window.Hide()}
 Write-Output 'OK: editor, UTF-8 reading and validation; no files modified.';$script:dirty=$false;$window.Dispose();exit
}
[void]$window.ShowDialog();$window.Dispose()


