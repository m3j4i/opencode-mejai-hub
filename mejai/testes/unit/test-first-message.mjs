import assert from 'node:assert/strict';
import {createPreparation} from '../../first-message.mjs';
let requests=[],loaded=false,busy=false,offline=false,delayLoad=false,clock=0;
const config={model:'ollama/a/model:latest',provider:{ollama:{options:{baseURL:'http://ollama.test/v1'}}}};
const params={server:'http://agent.test',directory:'/kit/tasks',config};
const fetchImpl=async(url,options)=>{
 const route=new URL(url);requests.push({url,options});
 if(route.pathname==='/session/status')return Response.json(busy?{one:{type:'busy'}}:{});
 if(route.pathname==='/mcp')return Response.json({router:{status:'connected'}});
 if(route.pathname==='/experimental/tool')return Response.json([{id:'router_search'}]);
 if(route.pathname==='/api/ps'){if(offline)throw Error('offline');return Response.json({models:loaded?[{name:'a/model:latest'}]:[]});}
 if(route.pathname==='/api/generate'){
  assert.deepEqual(JSON.parse(options.body),{model:'a/model:latest'});
  if(delayLoad)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));
  return Response.json({done:true,response:'',load_duration:5000000});
 }
 throw Error('Unexpected request '+url);
};
const prep=createPreparation({fetchImpl,now:()=>clock});
await Promise.all([prep.begin(params),prep.begin(params)]);
assert.equal(requests.filter(r=>r.url.endsWith('/api/generate')).length,1);assert.equal(prep.state().status,'ready');
assert.equal(prep.state().steps.model.loadMs,5);
const count=requests.length;await prep.begin(params);assert.equal(requests.length,count);
clock+=31000;loaded=true;requests=[];await prep.begin(params);assert(!requests.some(r=>r.url.endsWith('/api/generate')));assert(prep.state().steps.model.alreadyLoaded);
clock+=31000;busy=true;requests=[];await prep.begin(params);assert.equal(requests.length,1);assert.equal(prep.state().status,'deferred');
clock+=31000;busy=false;offline=true;await prep.begin(params);assert.equal(prep.state().status,'partial');assert.equal(prep.state().steps.tools.status,'ready');
clock+=31000;offline=false;loaded=false;delayLoad=true;const pending=prep.begin(params);await new Promise(r=>setTimeout(r,10));prep.cancel();await pending;assert.equal(prep.state().status,'idle');
requests=[];await prep.begin({...params,config:{...config,model:'colibri/test',provider:{colibri:{options:{baseURL:'http://colibri.test/v1'}}}}});
assert(!requests.some(r=>r.url.includes('/api/generate')));
console.log('PASS first-message preparation: deduplicated loads, no prompt/options/keep_alive, resident model preserved, busy deferral, offline isolation, cancellation, no Colibri inference.');
