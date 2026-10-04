import {createServer} from 'node:http';
import assert from 'node:assert/strict';
import {checkReady} from '../scripts/check-ready.mjs';
let scenario='ok';
const server=createServer((req,res)=>{
 if(req.url==='/studio'){
  res.setHeader('Content-Type',scenario==='download'?'application/octet-stream':'text/html');
  if(scenario==='download')res.setHeader('Content-Disposition','attachment');
  res.end(scenario==='empty'?'':'<title>Content Studio</title>');
 } else {res.statusCode=scenario==='auth-failure'?500:200;res.setHeader('Content-Type','application/json');res.end('null')}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
try{
 const base='http://127.0.0.1:'+server.address().port;
 await checkReady(base);
 for(scenario of ['download','empty','auth-failure']) await assert.rejects(checkReady(base));
 console.log('4 readiness cases passed: valid HTML/auth, download, empty body, auth failure');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
