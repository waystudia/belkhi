import {projectUrl,publishableKey} from './cloud.js';
export const examples=[
  ['Строительство дома','Истра','Одноэтажный дом из газобетона, 120 м². Фундамент, коробка и кровля.',3000000,'3–5 месяцев','house','Мария Соколова','maria'],
  ['Отделочные работы','Москва','Чистовая отделка квартиры 64 м². Стены под покраску и укладка пола.',450000,'1–2 месяца','room','Иван Соколов','ivan'],
  ['Кровля','Урус-Мартан','Монтаж стропильной системы и металлочерепицы на частном доме.',350000,'До 1 месяца','roof','Муса Алиев','musa'],
  ['Фундамент','Грозный','Ленточное основание для дома 10 × 8 м. Нужны опалубка и армирование.',400000,'До 2 недель','site','Мария Соколова','maria']
];
export async function seed(records){
  let rows=examples.map(([kind,district,description,budget,period,photo,customer,owner],position)=>({position,kind,district,description,budget,period,photo,customer,owner}));
  let online=false;
  try{
    const [tenders,people,bids]=await Promise.all(['belkhi_demo_tenders','belkhi_people','belkhi_bids'].map(async table=>{
      const r=await fetch(projectUrl+'/rest/v1/'+table+'?select=*',{headers:{apikey:publishableKey},signal:AbortSignal.timeout(4500)});
      if(!r.ok)throw Error('Catalog unavailable');
      return r.json();
    }));
    rows=tenders.map(t=>({...t,customer:people.find(p=>p.id===t.owner)?.name||'',
      catalogBids:bids.filter(b=>b.tender===t.position).map(b=>{
        const p=people.find(p=>p.id===b.performer);
        return {...b,id:b.performer,name:p.name,photo:p.photo,about:p.about,type:b.performer==='0'?'Компания':b.performer==='1'?'Бригада':'Частный мастер',demo:true};
      })
    }));
    online=true;
  }catch{if(localStorage.getItem('belkhi-demo-v1'))return}
  await records('readwrite',store=>{
    const ids=new Set(rows.map(t=>'demo-'+t.position));
    const request=store.openCursor();
    request.onsuccess=()=>{const c=request.result;if(c){if(online&&c.value.demo&&!ids.has(c.key)&&c.value.winner==null)c.delete();c.continue()}};
    for(const row of rows){
      const id='demo-'+row.position, req=store.get(id);
      req.onsuccess=()=>{
        const old=req.result;
        if(old?.winner!=null)return;
        store.put({created:1+row.position,files:[],winner:null,...old,...row,id,demo:true});
      };
    }
  });
  localStorage.setItem('belkhi-demo-v1','1');
}
