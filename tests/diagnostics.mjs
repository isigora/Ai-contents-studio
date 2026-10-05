import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {inspectEndpoint} from '../scripts/diagnose-codespaces.mjs';
let response = {};
const server = createServer((req,res)=>{
  res.writeHead(response.status || 200,response.headers || {});
  res.end(response.body || '');
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const url = `http://127.0.0.1:${server.address().port}`;
const cases = [
  ['studio',{headers:{'content-type':'text/html'},body:'<title>Content Studio</title>'},'ready'],
  ['auth',{headers:{'content-type':'application/json'},body:'null'},'ready'],
  ['studio',{headers:{'content-disposition':'Attachment'},body:'private sentinel'},'download-response'],
  ['studio',{},'empty-response'],
  ['studio',{status:302,headers:{location:'/login'}},'redirect'],
  ['auth',{status:500,body:'private sentinel'},'http-error'],
  ['studio',{body:'private sentinel'},'wrong-content-type'],
  ['studio',{headers:{'content-type':'text/html'},body:'Other app'},'unexpected-page'],
  ['auth',{headers:{'content-type':'application/json'},body:'private sentinel'},'invalid-json'],
  ['auth',{headers:{'content-type':'application/json'},body:'{"secret":"private sentinel"}'},'unexpected-session'],
];
try {
  for (const [kind,value,reason] of cases) {
    response=value;
    const result=await inspectEndpoint(url,kind);
    assert.equal(result.reason,reason);
    assert.equal(result.ok,reason==='ready');
    assert.ok(!JSON.stringify(result).includes('private sentinel'));
  }
} finally { server.closeAllConnections(); await new Promise(r=>server.close(r)); }
assert.equal((await inspectEndpoint(url,'studio')).reason,'connection-failed-or-timeout');
console.log('11 diagnostic cases passed; response bodies are not disclosed.');
