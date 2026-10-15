function Get-KitResetPlan([string]$Root) {
  $rootPath=[IO.Path]::GetFullPath($Root).TrimEnd('\')
  if(-not(Test-Path -LiteralPath (Join-Path $rootPath 'Iniciar.cmd')) -or -not(Test-Path -LiteralPath (Join-Path $rootPath 'runtime'))){throw 'Folder is not recognized as a kit.'}
  if((Get-Item -LiteralPath $rootPath -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Resetting a redirected folder is not allowed.'}
  $names=@('dados','tarefas','downloads','logs','navegador','navegador-camoufox')
  $names+=@(Get-ChildItem -LiteralPath $rootPath -Directory -Force | Where-Object {$_.Name -match '^arquivos-da-instalacao-anterior-\d{8}-\d{6}$'} | Select-Object -ExpandProperty Name)
  $files=New-Object 'System.Collections.Generic.List[object]'
  $directories=New-Object 'System.Collections.Generic.List[string]'
  $links=New-Object 'System.Collections.Generic.List[object]'
  # Installed provider packages and bundled helper binaries are code, not history.
  $preserve=@('dados\opencode-config\opencode\node_modules','dados\opencode-config\opencode\package.json','dados\opencode-config\opencode\package-lock.json','dados\opencode-config\opencode\.gitignore','dados\opencode-cache\opencode\bin','dados\organizacao-visual.json') | ForEach-Object {[IO.Path]::GetFullPath((Join-Path $rootPath $_))}
  $retained=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach($name in $names){
    $target=[IO.Path]::GetFullPath((Join-Path $rootPath $name))
    if(-not $target.StartsWith($rootPath+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destination is outside the kit.'}
    if(-not(Test-Path -LiteralPath $target)){continue}
    $stack=New-Object 'System.Collections.Generic.Stack[string]';$stack.Push($target)
    while($stack.Count){
      $current=$stack.Pop();$item=Get-Item -LiteralPath $current -Force
      if($current -in $preserve){$parent=[IO.Path]::GetDirectoryName($current);while($parent.Length -gt $rootPath.Length){[void]$retained.Add($parent);$parent=[IO.Path]::GetDirectoryName($parent)};continue}
      if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){$links.Add([pscustomobject]@{Path=$item.FullName;Directory=$item.PSIsContainer});continue}
      if($item.PSIsContainer){
        $directories.Add($item.FullName)
        foreach($child in Get-ChildItem -LiteralPath $current -Force -ErrorAction Stop){$stack.Push($child.FullName)}
      }else{$files.Add([pscustomobject]@{Path=$item.FullName;Length=[long]$item.Length})}
    }
  }
  [pscustomobject]@{Root=$rootPath;Targets=$names;Files=$files.ToArray();Links=$links.ToArray();Directories=@($directories | Where-Object {-not $retained.Contains($_)});Bytes=($files | Measure-Object Length -Sum).Sum}
}
function Invoke-KitDataReset([string]$Root) {
  # Build the full plan before any deletion. No wildcards, recursive deletion or external targets.
  $plan=Get-KitResetPlan $Root
  foreach($link in $plan.Links){
    $path=[IO.Path]::GetFullPath($link.Path)
    if(-not $path.StartsWith($plan.Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Link is outside the kit.'}
    $cursor=[IO.Path]::GetDirectoryName($path)
    while($cursor.Length -ge $plan.Root.Length){
      if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link parent is redirected; operation stopped.'}
      if($cursor -eq $plan.Root){break};$cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    if(-not((Get-Item -LiteralPath $path -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'The link changed since the preview.'}
    # Delete only the reparse point, never enumerate or recursively delete its target.
    if($link.Directory){[IO.Directory]::Delete($path,$false)}else{[IO.File]::Delete($path)}
  }
  foreach($entry in $plan.Files){
    $path=[IO.Path]::GetFullPath($entry.Path)
    if(-not $path.StartsWith($plan.Root+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Destination is outside the kit.'}
    $cursor=$path
    while($cursor.Length -gt $plan.Root.Length){
      if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Link detected during reset. Operation stopped.'}
      $cursor=[IO.Path]::GetDirectoryName($cursor)
    }
    Remove-Item -LiteralPath $path -Force -ErrorAction Stop
  }
  foreach($directory in ($plan.Directories | Sort-Object Length -Descending)){
    if((Get-Item -LiteralPath $directory -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Redirected directory; reset stopped.'}
    # Non-recursive removal fails if something new appeared; never delete unplanned content.
    [IO.Directory]::Delete($directory,$false)
  }
  foreach($name in @('dados','tarefas','downloads','logs')){[IO.Directory]::CreateDirectory((Join-Path $plan.Root $name)) | Out-Null}
  return [pscustomobject]@{Files=$plan.Files.Count;Links=$plan.Links.Count;Bytes=$plan.Bytes}
}
