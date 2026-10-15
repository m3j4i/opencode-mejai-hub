param([string]$KitPath)
$ErrorActionPreference = 'Stop'
try {
  if (-not $KitPath) {
    Add-Type -AssemblyName System.Windows.Forms
    $picker = New-Object System.Windows.Forms.FolderBrowserDialog
    $picker.Description = 'Selecione a pasta Agente-Local do Mejai Hub'
    if ($picker.ShowDialog() -ne 'OK') { exit 0 }
    $KitPath = $picker.SelectedPath
  }
  $node = Join-Path $KitPath 'runtime\node\node.exe'
  if (-not (Test-Path -LiteralPath $node)) { throw 'Selecione a pasta Agente-Local completa.' }
  & $node (Join-Path $PSScriptRoot 'apply-update.mjs') $KitPath
  if ($LASTEXITCODE -ne 0) { throw 'A atualizacao nao foi aplicada. Consulte a mensagem acima.' }
  Write-Host 'Atualizacao aplicada. Conversas e configuracoes preservadas.'
  & (Join-Path $KitPath 'Start-hub.ps1')
} catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  Read-Host 'Pressione Enter para fechar'
  exit 1
}
