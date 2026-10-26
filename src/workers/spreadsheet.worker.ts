import * as XLSX from 'xlsx';
self.onmessage=(event:MessageEvent<ArrayBuffer>)=>{
  try{
    const workbook=XLSX.read(event.data,{dense:false,sheetRows:10002});
    if(workbook.SheetNames.length>20)throw new Error('Maksimal 20 sheet per workbook.');
    const sheet=workbook.Sheets[workbook.SheetNames[0]];if(!sheet)throw new Error('Workbook tidak memiliki sheet.');
    const rows=XLSX.utils.sheet_to_json(sheet,{defval:''});
    if(rows.length>10000)throw new Error('Maksimal 10000 baris per impor. Pecah berkas menjadi beberapa bagian.');
    self.postMessage({rows});
  }catch(error:any){self.postMessage({error:error.message||'Berkas spreadsheet tidak valid.'});}
};
