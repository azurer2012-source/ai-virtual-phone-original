const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root,'lib/tool-executor.ts'),'utf8');
const section = source.slice(source.indexOf("const OB_RETRY_KEY ="),source.indexOf('async function extractMcpToolResult'));
let now=0, initOk=false, sent=0, interval, visible='visible';
let sendError;
const store=new Map();
const server={id:'ob',enabled:true,url:'https://ob.test',discoveredTools:['hold','grow','trace','pulse','breath'].map(name=>({name}))};
const context={exports:{},Date:{now:()=>now},JSON,Set,Map,crypto:require('node:crypto').webcrypto,AbortSignal,
  localStorage:{getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},
  navigator:{locks:{request:async (key, options, fn)=>(fn||options)({})}},
  document:{get visibilityState(){return visible},addEventListener(){},removeEventListener(){}},
  window:{setInterval:fn=>{interval=fn;return 1},clearInterval(){},addEventListener(){},removeEventListener(){},dispatchEvent(){}},
  CustomEvent:class {},loadMcpServers:()=>[server],isOmbreToolset:()=>true,
  throwIfAborted:s=>s?.throwIfAborted(),mcpInitialize:async()=>({success:initOk}),isSseUrl:()=>false,
  getMcpSessionHeaders:()=>({}),mcpRequest:async()=>{sent++;return sendError?{error:sendError}:{result:{}}},
  _mcpSessions:new Map(),_mcpSseEndpoints:new Map(),isAbortError:e=>e.name==='AbortError',extractMcpToolResult:async()=>({success:true,data:'ok'}),
};
vm.runInNewContext(ts.transpileModule(section,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context);
const queue=()=>JSON.parse(store.get('float-ob-write-retries-v1')||'[]');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const api=context.exports;
 await api.executeMcpTool(server,'hold',{content:'remember'},undefined,true);
 assert.equal(queue().length,1);assert.equal(sent,0);
 await api.executeMcpTool(server,'hold',{content:'remember'},undefined,true);
 assert.equal(queue().length,1);
 await api.executeMcpTool(server,'hold',{delete:true},undefined,true);
 assert.equal(queue().length,1);
 await api.executeMcpTool(server,'breath',{},undefined,true);
 assert.equal(queue().length,1);
 const stop=api.startObWriteRetries();
 now=599999;interval();await flush();assert.equal(sent,0);
 now=600001;visible='hidden';interval();await flush();assert.equal(sent,0);
 visible='visible';initOk=true;interval();await flush();assert.equal(sent,1);assert.equal(queue().length,0);
 interval();await flush();assert.equal(sent,1);stop();
 sendError={code:401,message:'unknown delivery'};
 await api.executeMcpTool(server,'grow',{content:'sent'},undefined,true);
 assert.equal(sent,2);assert.equal(queue().length,0);
 initOk=false;
 await api.executeMcpTool(server,'grow',{content:'manual'});
 assert.equal(queue().length,0);
 const chat=fs.readFileSync(path.join(root,'lib/chat-engine.ts'),'utf8');
 assert.match(chat,/executeMcpTool\(server, name, call.args, options\?\.signal, true\)/);
 assert.match(source,/executeMcpTool\(server, call.name, call.args, context\?\.signal, true\)/);
 assert.match(fs.readFileSync(path.join(root,'components/desktop-shell.tsx'),'utf8'),/startObWriteRetries\(\)/);
 console.log('PASS: OB unsent-only queue, deduplication, delete/read exclusions, 10-minute delay, foreground-only single retry, no replay of sent writes, online/offline wiring');
})().catch(e=>{console.error(e);process.exitCode=1});
