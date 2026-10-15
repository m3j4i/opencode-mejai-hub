import path from 'node:path';
export function wrapCommand(command,base){
 if(process.platform!=='win32')return command;
 const encoded=Buffer.from(command,'utf16le').toString('base64');
 return "& '"+path.join(base,'runtime/powershell/pwsh.exe').replaceAll("'","''")+"' -NoLogo -NoProfile -NonInteractive -File '"+path.join(base,'plugins/portable-shell.ps1').replaceAll("'","''")+"' -EncodedCommand "+encoded+'; exit $LASTEXITCODE';
}
export function unwrapCommand(command){
 const m=command.match(/-NoLogo -NoProfile -NonInteractive (?:-File '[^']*portable-shell\.ps1' )?-EncodedCommand ([A-Za-z0-9+/=]+); exit \$LASTEXITCODE$/);
 return m?Buffer.from(m[1],'base64').toString('utf16le'):command;
}
