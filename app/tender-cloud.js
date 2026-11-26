import {api, currentAuth} from './auth.js';
const publicFields = ['title','kind','subtype','district','description','budget','period','params','start','startDate','locationNote','photo','parentId'];
const detailFields = data => Object.fromEntries(publicFields.filter(key => data[key] !== undefined).map(key => [key,data[key]]));
async function encodeFiles(files) {
  let total = 0;
  return Promise.all(files.map(async file => {
    const bytes = new Uint8Array(file instanceof Blob ? await file.arrayBuffer() : file.bytes);
    total += bytes.byteLength;
    if (total > 15 * 1024 * 1024) throw Error('Для публикации прикрепите не более 15 МБ материалов.');
    let binary = '';
    for (let i=0;i<bytes.length;i+=8192) binary += String.fromCharCode(...bytes.subarray(i,i+8192));
    return {name:file.name,type:file.type,lastModified:file.lastModified,base64:btoa(binary)};
  }));
}
function decodeFiles(files=[]) {
  return files.map(({base64,...file}) => ({...file,bytes:Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer}));
}
export async function publishTender(t) {
  const details = {...detailFields(t),files:await encodeFiles(t.files||[])};
  await api('/rest/v1/belkhi_tenders',{method:'POST',body:{id:t.id,owner_id:currentAuth().user.id,details}});
  return {...t,cloud:true,ownerAccount:currentAuth().user.id,bids:[],catalogBids:[]};
}
export async function submitTenderBid(t,p,bid) {
  const profile = Object.fromEntries(['name','type','city','years','about','skills','areas','handle'].filter(key=>p[key]!==undefined).map(key=>[key,p[key]]));
  await api('/rest/v1/belkhi_tender_bids',{method:'POST',body:{tender_id:t.id,performer_id:currentAuth().user.id,profile,price:bid.price,period:bid.period,terms:bid.terms}});
}
export async function chooseTenderBid(t,winner) {
  const rows = await api('/rest/v1/belkhi_tenders?id=eq.'+encodeURIComponent(t.id)+'&winner=is.null',{
    method:'PATCH',body:{winner},representation:true
  });
  if (rows?.length!==1) throw Error('Выбор недоступен. Обновите тендер и проверьте права.');
}
export async function syncTenders(records) {
  if (!currentAuth()) return;
  const [tenders,offers] = await Promise.all([
    api('/rest/v1/belkhi_tenders?select=*'),api('/rest/v1/belkhi_tender_bids?select=*')
  ]);
  await records('readwrite',store=>{
    const ids = new Set(tenders.map(t=>t.id));
    const cursor = store.openCursor();
    cursor.onsuccess=()=>{const item=cursor.result;if(item){if(item.value.cloud&&!ids.has(item.key))item.delete();item.continue();}};
    for (const row of tenders) {
      const req = store.get(row.id);
      req.onsuccess=()=>{
        const bids = offers.filter(b=>b.tender_id===row.id).map(b=>({
          ...b.profile,id:b.performer_id,price:b.price,period:b.period,terms:b.terms,demo:false
        }));
        store.put({...req.result,...detailFields(row.details),files:decodeFiles(row.details.files),
          id:row.id,created:Date.parse(row.created_at),cloud:true,ownerAccount:row.owner_id,
          winner:row.winner,bids,catalogBids:[],demo:false,localDemo:false});
      };
    }
  });
}
