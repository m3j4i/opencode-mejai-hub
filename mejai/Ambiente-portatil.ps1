# Environment variables apply only to this process and its children; Windows and Ollama are unchanged.
$portableData = Join-Path $PSScriptRoot 'dados'
$env:XDG_DATA_HOME = Join-Path $portableData 'opencode-data'
$env:XDG_CONFIG_HOME = Join-Path $portableData 'opencode-config'
$env:XDG_CACHE_HOME = Join-Path $portableData 'opencode-cache'
$env:XDG_STATE_HOME = Join-Path $portableData 'opencode-state'
$env:TEMP = Join-Path $portableData 'temporarios'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $portableData 'npm-cache'
$env:PIP_CACHE_DIR = Join-Path $portableData 'pip-cache'
$env:PIP_DISABLE_PIP_VERSION_CHECK = '1'
$env:PYTHONIOENCODING = 'utf-8'
$env:PYTHONUTF8 = '1'
foreach ($portableDir in @($env:XDG_DATA_HOME,$env:XDG_CONFIG_HOME,$env:XDG_CACHE_HOME,$env:XDG_STATE_HOME,$env:TEMP,$env:npm_config_cache)) {
  New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
}
