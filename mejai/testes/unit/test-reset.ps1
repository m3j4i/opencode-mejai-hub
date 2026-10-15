$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '..\..\lib\reset-core.ps1')
$root=Join-Path $env:TEMP ('kit-reset-test-'+[Guid]::NewGuid().ToString('N'))
foreach($dir in @('runtime','dados','tarefas','downloads','logs','navegador','arquivos-da-instalacao-anterior-20260101-000000','ferramentas')){[IO.Directory]::CreateDirectory((Join-Path $root $dir)) | Out-Null;[IO.File]::WriteAllText((Join-Path $root "$dir\fixture.txt"),'test')}
[IO.File]::WriteAllText((Join-Path $root 'Iniciar.cmd'),'launcher')
[IO.File]::WriteAllText((Join-Path $root 'INSTRUCOES.md'),'rules')
$outside=$root+'-ollama';[IO.Directory]::CreateDirectory($outside) | Out-Null;[IO.File]::WriteAllText((Join-Path $outside 'qwen.bin'),'model')
New-Item -ItemType Junction -Path (Join-Path $root 'dados\external-cache') -Target $outside | Out-Null
$provider=Join-Path $root 'dados\opencode-config\opencode\node_modules';[IO.Directory]::CreateDirectory($provider) | Out-Null;[IO.File]::WriteAllText((Join-Path $provider 'provider.js'),'code')
$plan=Get-KitResetPlan $root
if($plan.Files.Count -ne 6){throw 'Unexpected plan'}
$result=Invoke-KitDataReset $root
if($result.Files -ne 6){throw 'Unexpected deletions'}
foreach($file in @('runtime\fixture.txt','ferramentas\fixture.txt','Iniciar.cmd','INSTRUCOES.md')){if(-not(Test-Path -LiteralPath (Join-Path $root $file))){throw 'App changed'}}
if(-not(Test-Path -LiteralPath (Join-Path $outside 'qwen.bin'))){throw 'External model changed'}
if(-not(Test-Path -LiteralPath (Join-Path $provider 'provider.js'))){throw 'Provider deleted'}
if($result.Links -ne 1 -or (Test-Path -LiteralPath (Join-Path $root 'dados\external-cache'))){throw 'Junction retained'}
foreach($dir in @('tarefas','downloads','logs')){if(@(Get-ChildItem (Join-Path $root $dir) -Force).Count){throw 'Data remained'}}
'PASS: reset only kit data; runtime/tools/rules and external Ollama fixture preserved; fresh folders recreated.'
