import { writeBatch as nativeBatch } from 'firebase/firestore';
/** Sequential chunks; reports partial commits explicitly. Never use for financial transactions. */
export function chunkedWriteBatch(db:any,factory:any=nativeBatch,chunkSize=200){
 if(!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>400)throw Error('Ukuran batch tidak valid.');
 const ops:{type:string,args:any[]}[]=[];let committed=0,started=false;
 const batch:any={};for(const type of ['set','update','delete'])batch[type]=(...args:any[])=>{if(started)throw Error('Batch sudah dijalankan.');ops.push({type,args});return batch;};
 batch.commit=async()=>{if(started)throw Error('Gunakan operasi pemulihan; batch tidak dapat diulang otomatis.');started=true;for(let i=0;i<ops.length;i+=chunkSize){const part=ops.slice(i,i+chunkSize),b=factory(db);for(const op of part)b[op.type](...op.args);try{await b.commit();committed+=part.length;}catch(e:any){throw Error('Tersimpan '+committed+' dari '+ops.length+' operasi; periksa data sebelum mengulang. '+e.message);}}return [];};return batch;
}
