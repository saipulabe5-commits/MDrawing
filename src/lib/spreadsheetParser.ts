export async function parseSpreadsheet(file:File):Promise<any[]> {
  if(file.size>10*1024*1024)throw new Error('Maksimal ukuran spreadsheet 10 MB.');
  if(!/\.(xlsx|xls|csv)$/i.test(file.name))throw new Error('Format spreadsheet tidak didukung.');
  const buffer=await file.arrayBuffer();
  return new Promise((resolve,reject)=>{
    const worker=new Worker(new URL('../workers/spreadsheet.worker.ts',import.meta.url),{type:'module'});
    const finish=(err?:Error,rows?:any[])=>{clearTimeout(timer);worker.terminate();err?reject(err):resolve(rows||[]);};
    const timer=setTimeout(()=>finish(new Error('Parsing melebihi 15 detik. Pecah/periksa berkas.')),15000);
    worker.onmessage=event=>event.data.error?finish(new Error(event.data.error)):finish(undefined,event.data.rows);
    worker.onerror=()=>finish(new Error('Parser spreadsheet gagal.'));
    worker.postMessage(buffer,[buffer]);
  });
}
