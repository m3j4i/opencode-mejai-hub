import {unwrapCommand} from '../../plugins/portable-shell.mjs';
import assert from 'node:assert/strict';import path from 'node:path';
import {evidenceFrom,approved} from '../../plugins/url-evidence-core.mjs';
import guard from '../../plugins/url-evidence.mjs';
import execution from '../../plugins/execution-checks.mjs';
import {modelEntry} from '../../sincronizar-modelos.mjs';
const messages=[{info:{role:'assistant'},parts:[{type:'tool',tool:'playwright_browser_snapshot',state:{status:'completed',output:'- Page URL: https://example.org/pasta/page\n- link [ref=e3]:\n  - /url: /downloads/file.zip\n  - /url: relative.zip'}}]}];
const known=evidenceFrom(messages);assert(approved('https://example.org/downloads/file.zip',known));assert(approved('https://example.org/pasta/relative.zip',known));assert(!approved('https://example.org/inventado.zip',known));
messages.push({info:{role:'assistant'},parts:[{type:'tool',tool:'playwright_browser_tool_call',state:{status:'completed',input:{name:'browser_evaluate'},output:'### Result\n["https://example.org/found.zip"]\n### Ran Playwright code\nconst fake="https://example.org/fake.zip";'}}]});
assert(approved('https://example.org/found.zip',evidenceFrom(messages)));assert(!approved('https://example.org/fake.zip',evidenceFrom(messages)));
const client={session:{messages:async()=>({data:messages})}};
const gates=await guard({client});await gates['tool.execute.before']({tool:'playwright_browser_download',sessionID:'s'},{args:{url:'https://example.org/downloads/file.zip'}});
await expectSourceWarning(gates,{tool:'playwright_browser_download',sessionID:'s'},{args:{url:'https://example.org/fake.zip'}});
const hooks=await execution({client,directory:process.cwd()});
await hooks['tool.execute.before']({tool:'bash'},{args:{command:'echo test | Head -2'}});
await assert.rejects(hooks['tool.execute.before']({tool:'bash'},{args:{command:'exa_web_search_exa query=test'}}),/FERRAMENTA_NAO_E_COMANDO/);
const command={args:{command:'curl -I https://example.org/'}};await hooks['tool.execute.before']({tool:'bash'},command);assert(unwrapCommand(command.args.command).includes('curl -I https://example.org/'));
const read={args:{filePath:process.platform==='win32'?'$env:TEMP\\test.txt':path.join(process.env.TEMP,'test.txt')}};await hooks['tool.execute.before']({tool:'read'},read);assert.equal(read.args.filePath,path.resolve(process.env.TEMP,'test.txt'));
assert.equal(modelEntry({name:'qwen'},{capabilities:['tools'],parameters:'num_ctx 131072'}).limit.context,131072);
messages.push({info:{role:'assistant'},parts:[{type:'tool',tool:'habilidades_call',state:{status:'completed',input:{server:'fetch',name:'fetch'},output:'{"links":[{"url":"https://example.org/routed"}]}'}}]});
assert(approved('https://example.org/routed',evidenceFrom(messages)));
await gates['tool.execute.before']({tool:'habilidades_call',sessionID:'s'},{args:{server:'fetch',name:'fetch',arguments:{url:'https://example.org/routed'}}});
await expectSourceWarning(gates,{tool:'habilidades_call',sessionID:'s'},{args:{server:'chrome-devtools',name:'new_page',arguments:{url:'https://example.org/inventado'}}});
await hooks['tool.execute.before']({tool:'habilidades_call'},{args:{server:'desktop-commander',name:'start_process',arguments:{command:'echo test | Head -2'}}});
console.log('PASS: links relativos reais, roteador, URLs sem origem sinalizadas, Head maiusculo, alias curl, MCP no shell, TEMP e contexto declarado de 128K.');
await expectSourceWarning(gates,{tool:'habilidades_call',sessionID:'s'},{args:{server:'tor-browser',name:'browser_tool_call',arguments:{name:'browser_navigate',arguments:{url:'https://example.org/inventado'}}}});
console.log('PASS: validacao de URL tambem em chamadas aninhadas do navegador Tor.');
const nested=[{info:{role:'assistant'},parts:[{type:'tool',tool:'habilidades_call',state:{status:'completed',input:{server:'tor-browser',name:'browser_tool_call',arguments:{name:'browser_evaluate',arguments:{function:'() => "https://example.org/not-visited"'}}},output:'### Result\n["https://example.org/real-result"]\n### Ran Playwright code\nconst fake="https://example.org/not-visited";'}}]}];
assert(approved('https://example.org/real-result',evidenceFrom(nested)));
assert(!approved('https://example.org/not-visited',evidenceFrom(nested)));
console.log('PASS: codigo gerado nao vira evidencia de URL em chamadas aninhadas.');
const description={description:'old'};await hooks['tool.definition']({toolID:'bash'},description);assert(description.description.includes(process.platform==='win32'?'PowerShell 7':'Bash on Linux'));
const transformed={messages:[{parts:[{type:'tool',tool:'bash',state:{input:{command:command.args.command}}}]}]};await hooks['experimental.chat.messages.transform']({},transformed);assert.equal(transformed.messages[0].parts[0].state.input.command,'curl -I https://example.org/');console.log('PASS: descricao correta do terminal e historico legivel para o modelo.');
const quotingFailure={output:'SyntaxError: unterminated string literal',metadata:{exit:1}};
await hooks['tool.execute.after']({tool:'bash',args:{command:wrapCommandForTest("python -c 'print(\"broken\")'")}},quotingFailure);
assert(quotingFailure.output.includes('RECUPERACAO_DE_ASPAS'));
function wrapCommandForTest(value){return value;}
const nonQuoting={output:'Erro: arquivo nao encontrado',metadata:{exit:1}};
await hooks['tool.execute.after']({tool:'bash',args:{command:'python script.py'}},nonQuoting);assert(!nonQuoting.output.includes('RECUPERACAO_DE_ASPAS'));
console.log('PASS: erro de aspas em python -c orienta uso de arquivo; outros erros preservados.');

await expectSourceWarning(gates,{tool:'playwright_browser_download_file',sessionID:'s'},{args:{url:'https://example.org/fake.zip'}});
console.log('PASS: nova transferencia tambem sinaliza origem desconhecida da URL.');
import fsExtra from 'node:fs';
const editDir=fsExtra.mkdtempSync(path.resolve('work/edit-eol-')),editFile=path.join(editDir,'sample.txt');
fsExtra.writeFileSync(editFile,'first\r\nsecond\r\n');
const editArgs={args:{filePath:editFile,oldString:'first\nsecond',newString:'first\nthird'}};
await hooks['tool.execute.before']({tool:'edit'},editArgs);assert.equal(editArgs.args.oldString,'first\r\nsecond');assert.equal(editArgs.args.newString,'first\r\nthird');
const wrong={args:{filePath:editFile,oldString:'not here',newString:'anything'}};
await hooks['tool.execute.before']({tool:'edit'},wrong);assert.equal(wrong.args.oldString,'not here');
console.log('PASS: edicao normaliza somente quebras de linha comprovadas, sem substituir texto diferente.');


async function expectSourceWarning(hooks,input,output){await hooks['tool.execute.before'](input,output);const result={output:'original result'};await hooks['tool.execute.after'](input,result);assert.match(result.output,/SOURCE_CHECK/);assert.match(result.output,/original result/);}
