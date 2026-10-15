import assert from 'node:assert/strict';
import {evidenceFrom,approved} from '../../plugins/url-evidence-core.mjs';
import plugin from '../../plugins/url-evidence.mjs';
const messages=[{info:{role:'user'},parts:[{type:'text',text:'Abra https://example.com/start'}]},{info:{role:'assistant'},parts:[{type:'tool',tool:'exa_web_search_exa',state:{status:'completed',output:'Result: https://example.org/real-link'}},{type:'tool',tool:'bash',state:{status:'completed',output:'https://invented.test/fake'}}]}];
const known=evidenceFrom(messages);
assert(approved('https://example.org/real-link',known));
assert(approved('https://example.com/start',known));
assert(approved('https://example.org/',known));
assert(!approved('https://example.org/invented',known));
assert(!approved('https://invented.test/fake',known));
const hooks=await plugin({client:{session:{messages:async()=>({data:messages})}}});
await expectSourceWarning(hooks,{tool:'webfetch',sessionID:'s'},{args:{url:'https://example.org/invented'}});
await hooks['tool.execute.before']({tool:'playwright_browser_navigate',sessionID:'s'},{args:{url:'https://example.org/real-link'}});
await expectSourceWarning(hooks,{tool:'bash',sessionID:'s'},{args:{command:"python -c \"import requests; requests.get('https://invented.test/fake')\""}});
const isolated=await plugin({client:{session:{messages:async()=>({data:[]})}}});
await expectSourceWarning(isolated,{tool:'webfetch',sessionID:'other'},{args:{url:'https://example.org/real-link'}});
console.log('PASS: links descobertos e fornecidos aceitos; URL sem origem sinalizada em webfetch, navegador e comando HTTP; isolamento entre sessoes.');


async function expectSourceWarning(hooks,input,output){await hooks['tool.execute.before'](input,output);const result={output:'original result'};await hooks['tool.execute.after'](input,result);assert.match(result.output,/SOURCE_CHECK/);assert.match(result.output,/original result/);}
