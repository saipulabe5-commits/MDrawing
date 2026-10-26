export function dayInJakarta(date=new Date()):string {return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function dueNotifications(project:any,drawings:any[],invoices:any[],bills:any[],finance:boolean,today=dayInJakarta()) {
  const list:any[]=[];
  const add=(kind:string,item:any,title:string,description:string,tab:string)=>list.push({id:`${kind}-${item.id}-${item.deadline||item.dueDate}-${item.status}`,type:kind,title,description,projectId:project.id,projectCode:project.projectCode,projectName:project.projectName,severity:'high',actionUrl:`/projects/${project.id}?tab=${tab}`,actionLabel:'Buka '+(tab==='drawings'?'Gambar':'Keuangan'),date:item.deadline||item.dueDate});
  for(const d of drawings)if(!d.isDeleted&&d.deadline&&d.deadline<today&&!['Selesai','Hold'].includes(d.status))add('DRAWING_OVERDUE',d,'Gambar melewati deadline',`${d.drawingNumber}: ${d.drawingName}`,'drawings');
  if(finance){for(const i of invoices)if(!['Draft','Paid','Void','Cancelled'].includes(i.status)&&i.dueDate&&i.dueDate<today&&(i.remainingAmount??i.grandTotal)>0)add('INVOICE_UNPAID',i,'Invoice jatuh tempo',i.invoiceNumber,'finance');for(const b of bills)if(!['Draft','Paid','Void','Cancelled'].includes(b.status)&&b.dueDate&&b.dueDate<=today&&(b.remainingAmount??b.amount)>0)add('VENDOR_BILL_DUE',b,'Tagihan vendor jatuh tempo',b.billNumber,'vendor');}
  return list;
}
