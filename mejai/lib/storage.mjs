import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run = promisify(execFile);

// Unique sibling + rename: interrupted writes never truncate the active config.
// Windows also permits replacing hidden files this way, unlike open(..., 'w').
export async function writeTextAtomic(file, text) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, text, {encoding:'utf8', flag:'wx'});
    await fs.rename(temporary, file);
    // Atomic replacement creates a new file. Restore the hub's visibility choice.
    if(process.platform === 'win32') {
      let hidden = false;
      try {
        const entries = await readJSON(path.join(path.dirname(file),'dados/organizacao-visual.json'));
        hidden = entries.some(entry => entry.name === path.basename(file));
      } catch { /* No visual organization in this directory. */ }
      if(hidden) await run('attrib.exe',['+h',file],{windowsHide:true});
    }
  } finally {
    await fs.unlink(temporary).catch(error => {if(error.code !== 'ENOENT') throw error;});
  }
}

export async function readJSON(file) {
  return JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
}
