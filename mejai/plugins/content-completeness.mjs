import fs from 'node:fs';
import path from 'node:path';
export function textArtifactPaths(command='') {
  if(!/\b(?:Set-Content|Add-Content|Out-File|WriteAllText|WriteAllLines)\b/i.test(command)&&!/(?:^|[;|]\s*)(?:echo|printf|cat)\b[\s\S]*>/.test(command))return [];
  return [...command.matchAll(/["']((?:[A-Za-z]:[\\/]|\/)[^"'\r\n]+\.(?:txt|md|srt|csv))["']/gi)].map(m=>m[1]).slice(0,10);
}
export function completenessWarning(file) {
  if(!/\.(?:txt|md|srt|csv)$/i.test(path.extname(file||'')))return null;
  try {
    if(fs.statSync(file).size>1024*1024)return null;
    const content=fs.readFileSync(file,'utf8');
    if(!/(?:\[TODO\]|\b(?:conte[uú]do|restante|trecho)\s+omitido\b|\.{3}\s*$|…\s*$)/im.test(content))return null;
    return 'CONFERENCIA_DE_CONTEUDO: the file contains ellipses or omission markers. A successful write does not prove completeness. Check whether they are intentional, compare the request and authorized source, and report unverified coverage. Never invent missing passages.';
  } catch {return null;}
}
