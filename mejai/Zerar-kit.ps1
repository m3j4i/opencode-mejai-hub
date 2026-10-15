param([switch]$SomentePrevia)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
. (Join-Path $PSScriptRoot 'lib\reset-core.ps1')
function Assert-KitClosed {
  $prefix=[IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')+'\'
  $active=@(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase)})
  if($active.Count){throw 'The agent or a kit tool is running. Stop the agent from the hub, wait for shutdown and retry. Ollama may remain running.'}
}
try{
  if(-not $SomentePrevia){Assert-KitClosed}
  $plan=Get-KitResetPlan $PSScriptRoot
  if($SomentePrevia){[pscustomobject]@{Files=$plan.Files.Count;MB=[Math]::Round($plan.Bytes/1MB,1);Targets=$plan.Targets;Ollama='Out of scope'} | ConvertTo-Json;exit}
  $form=New-Object Windows.Forms.Form
  $form.Text='Reset kit data';$form.ClientSize=New-Object Drawing.Size(650,420)
  $form.StartPosition='CenterScreen';$form.Font=New-Object Drawing.Font('Segoe UI',11)
  $label=New-Object Windows.Forms.Label;$label.Location=New-Object Drawing.Point(22,20);$label.Size=New-Object Drawing.Size(605,285)
  $label.Text="This action permanently deletes, ONLY from this folder:`r`n`r`n• Conversations, memory and history.`r`n• Work and downloads, including partial files.`r`n• Logins, saved connections and browser profiles.`r`n• Temporary files, logs and old local backups.`r`n`r`n$($plan.Files.Count) files, approximately $([Math]::Round($plan.Bytes/1MB,1)) MB.`r`n`r`nThe app, tools, custom rules and OCR helper models remain installed. Ollama and Qwen will NOT be changed.`r`n`r`nThere is no undo. Type RESET to confirm:"
  $input=New-Object Windows.Forms.TextBox;$input.Location=New-Object Drawing.Point(22,315);$input.Size=New-Object Drawing.Size(280,30)
  $delete=New-Object Windows.Forms.Button;$delete.Text='Reset data';$delete.Location=New-Object Drawing.Point(330,365);$delete.Size=New-Object Drawing.Size(140,35);$delete.Enabled=$false;$delete.DialogResult='OK'
  $cancel=New-Object Windows.Forms.Button;$cancel.Text='Cancel';$cancel.Location=New-Object Drawing.Point(485,365);$cancel.Size=New-Object Drawing.Size(140,35);$cancel.DialogResult='Cancel';$form.CancelButton=$cancel
  $input.Add_TextChanged({$delete.Enabled=$input.Text -ceq 'RESET'})
  $form.Controls.AddRange(@($label,$input,$delete,$cancel))
  $answer=$form.ShowDialog();$confirmed=$input.Text -ceq 'RESET';$form.Dispose()
  if($answer -ne 'OK' -or -not $confirmed){exit}
  Assert-KitClosed
  # Preserve presentation metadata, not personal data. Leave the app configured and usable.
  $visibilityFile=Join-Path $PSScriptRoot 'dados\organizacao-visual.json'
  $visibility=if(Test-Path -LiteralPath $visibilityFile){[IO.File]::ReadAllText($visibilityFile)}else{$null}
  $result=Invoke-KitDataReset $PSScriptRoot
  if($visibility){[IO.File]::WriteAllText($visibilityFile,$visibility,[Text.UTF8Encoding]::new($false))}
  [Windows.Forms.MessageBox]::Show("Kit data deleted. Open the chat from the hub to start without history.`r`nOllama and its models were preserved. External accounts need to be connected again.",'Reset completed') | Out-Null
}catch{
  if($SomentePrevia){throw}
  [Windows.Forms.MessageBox]::Show("$($_.Exception.Message)`r`n`r`nIf deletion had already started, the reset may be partial. Nothing outside the kit is targeted by this operation.",'Reset did not complete','OK','Warning') | Out-Null
}
