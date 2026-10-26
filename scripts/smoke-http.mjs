import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:3187';
const child=spawn(process.execPath,['dist/server.cjs'],{env:{...process.env,NODE_ENV:'production',HOST:'127.0.0.1',PORT:'3187',AI_ENABLED:'false',FIREBASE_SERVICE_ACCOUNT_KEY:'',GOOGLE_APPLICATION_CREDENTIALS:'',MDRAWING_FIREBASE_CONFIG:JSON.stringify({projectId:'demo-mdrawing-repair',firestoreDatabaseId:'default'})},stdio:['ignore','pipe','pipe']});
let logs='';child.stdout.on('data',d=>logs+=d);child.stderr.on('data',d=>logs+=d);
try{
 let ready=false;for(let i=0;i<80;i++){try{if((await fetch(base+'/api/health')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert(ready,'Local server failed to start: '+logs);
 const probes=[['/projects/synthetic-drawing',200],['/pipeline/new',200],['/api/not-a-real-route',404],['/assets/not-present.js',404],['/server.cjs',404],['/server.cjs.map',404],['/src/server.ts',404],['/.env',404],['/api/projects',401],['/api/export-source-code',401]];
 for(const [path,status]of probes){const r=await fetch(base+path);assert.equal(r.status,status,path);if(status===200)assert.match(await r.text(),/<html/);console.log('PASS HTTP '+status+' '+path);}
 for(const route of ['/api/solar/chat','/api/solar/detect-errors','/api/solar/check-document','/api/solar/validate-key','/api/ai/command','/api/send-manual-reminder']){const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,401,route);console.log('PASS anonymous rejection '+route);}
 const health=await(await fetch(base+'/api/health')).json();assert.equal(health.firestoreDatabaseId,'default');assert.equal(health.storageDirectEnabled,false);console.log('PASS health configuration only; does not prove DB connectivity.');
 console.log('17 HTTP probes passed against the actual built Express application. No authenticated production/provider operation was invoked.');
}finally{child.kill();}
