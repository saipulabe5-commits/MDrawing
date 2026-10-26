import { beforeAll,afterAll,it,expect } from 'vitest';
import { initializeTestEnvironment,assertFails } from '@firebase/rules-unit-testing';
import { ref,uploadBytes,getBytes,deleteObject } from 'firebase/storage';
import { readFileSync } from 'node:fs';
if(process.env.FIREBASE_STORAGE_EMULATOR_HOST!=='127.0.0.1:8999')throw Error('Local storage emulator is required; production is forbidden.');
let env:any;
beforeAll(async()=>{env=await initializeTestEnvironment({projectId:'demo-mdrawing-repair',storage:{host:'127.0.0.1',port:8999,rules:readFileSync('storage.rules','utf8')}});});
afterAll(async()=>{await env?.cleanup();});
for(const folder of ['projects/pA/drawings','projects/pA/invoices','projects/pA/vendor-payments','avatars/owner','company-assets','unknown'])it('keeps direct Storage disabled for '+folder,async()=>{
 const owner=env.authenticatedContext('owner',{role:'OWNER'}).storage();
 await assertFails(uploadBytes(ref(owner,folder+'/synthetic.pdf'),new Uint8Array([1,2,3]),{contentType:'application/pdf'}));
});
it('denies anonymous read of an object even when it exists',async()=>{
 await env.withSecurityRulesDisabled(async(c:any)=>uploadBytes(ref(c.storage(),'synthetic-secret.txt'),new Uint8Array([1,2,3])));
 await assertFails(getBytes(ref(env.unauthenticatedContext().storage(),'synthetic-secret.txt')));
});
