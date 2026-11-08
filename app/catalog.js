import {api, currentAuth, signOut} from './auth.js';
const tables={Тендеры:'belkhi_demo_tenders',Заказчики:'belkhi_people',Исполнители:'belkhi_people',Отклики:'belkhi_bids',Журнал:'belkhi_journal'};
const labels={kind:'Тип работ',district:'Район',description:'Описание',budget:'Бюджет, ₽',period:'Срок',photo:'Фото',owner:'Заказчик',name:'Имя или название',city:'Город',about:'О себе',tender:'Тендер',performer:'Исполнитель',price:'Цена, ₽',terms:'Условия'};
const fields={Тендеры:['kind','district','description','budget','period','owner','photo'],Заказчики:['name','city','about','photo'],Исполнители:['name','city','about','photo'],Отклики:['tender','performer','price','period','terms']};
const pictures={house:'Дом',house2:'Коттедж',room:'Квартира',roof:'Кровля',site:'Фундамент',pan:'Стройка',man:'Мастер',team:'Компания',team2:'Бригада',maria:'Мария',ivan:'Иван',musa:'Муса'};
const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function request(path,method='GET',body,token){
 return api(path,{method,body,token,representation:path.startsWith('/rest/')&&method!=='GET'});
}
export async function catalog(admin,section,{show,notice,render,sync}){
 section=section||'Тендеры';
 const sections=Object.keys(tables).filter(k=>admin||k!=='Журнал');
 if(admin)sections.push('Пароль');
 if(!sections.includes(section))section='Тендеры';
 const base=admin?'admin':'catalog', root=document.querySelector('main');
 const tabbar=(admin?'<a class="back" href="#admin">Управление аккаунтами</a>':'')+'<div class="admin-tabs">'+sections.map(k=>'<a class="'+(k===section?'selected':'')+'" href="#'+base+'?section='+encodeURIComponent(k)+'">'+k+'</a>').join('')+'</div>';
 const password=(name,label,mode)=>'<label>'+label+'<input name="'+name+'" type="password" required minlength="8" autocomplete="'+mode+'"></label>';
 function paint(content){show(null,admin?'Администрирование':'Демонстрационный каталог',content);document.querySelector('#bottom-nav').hidden=true}
 let data;
 const here=location.hash;
 paint('<p>Загрузка каталога…</p>');
 try{
 const [objects,people,bids]=await Promise.all(['belkhi_demo_tenders?order=position','belkhi_people?order=name','belkhi_bids?order=price'].map(k=>request('/rest/v1/'+k)));
 data={Тендеры:objects,Заказчики:people.filter(p=>p.role==='Заказчик'),Исполнители:people.filter(p=>p.role==='Исполнитель'),Отклики:bids};
 if(section==='Журнал')data.Журнал=await request('/rest/v1/belkhi_journal?order=id.desc&limit=150');
 }catch(err){if(location.hash===here)paint(tabbar+'<p>Не удалось загрузить данные. '+escape(err.message)+'</p><button id="retry">Повторить</button>');root.querySelector('#retry')?.addEventListener('click',render);return}
 if(location.hash!==here)return;
 const options={photo:Object.entries(pictures),owner:data.Заказчики.map(r=>[r.id,r.name]),performer:data.Исполнители.map(r=>[r.id,r.name]),tender:data.Тендеры.map(r=>[r.position,r.kind+' · '+r.district])};
 const lookup=(key,id)=>options[key].find(([v])=>String(id)===String(v))?.[1]||'—';
 const number=n=>Number(n).toLocaleString('ru')+' ₽';
 function form(row={}){
   const id=row.position??row.id??'';
   return '<form data-record="'+escape(id)+'">'+fields[section].map(k=>{
    const v=row[k]??'';
    const el=options[k]?'<select name="'+k+'" required>'+options[k].map(([val,text])=>'<option value="'+escape(val)+'" '+(String(val)===String(v)?'selected':'')+'>'+escape(text)+'</option>').join('')+'</select>':'<input name="'+k+'" '+(['price','budget'].includes(k)?'type="number" min="1" max="100000000000"':'maxlength="3000"')+' value="'+escape(v)+'" '+(['about','terms'].includes(k)?'':'required')+'>';
    return '<label>'+labels[k]+el+'</label>';
   }).join('')+'<div class="actions"><button>Сохранить</button>'+(id!==''?'<button formnovalidate name="remove">Удалить</button>':'')+'</div></form>';
 }
 function card(r){
   const title=r.kind||r.name||lookup('performer',r.performer);
   const detail=r.kind?r.district+' · '+number(r.budget)+' · '+r.period:r.name?r.city+' · '+r.role:lookup('tender',r.tender)+' · '+number(r.price)+' · '+r.period;
   const photo=r.photo||data.Исполнители.find(p=>p.id===r.performer)?.photo;
   const related=r.kind?data.Отклики.filter(b=>b.tender===r.position).map(b=>'<p>'+escape(lookup('performer',b.performer))+' · '+number(b.price)+' · '+escape(b.period)+'</p>').join(''):'';
   const portfolio={0:['house','house2','pan'],1:['roof','house','room'],2:['site','roof','room']};
   const photos=r.role==='Исполнитель'&&portfolio[r.id]?'<h3>Примеры работ</h3><div class="gallery">'+portfolio[r.id].map(k=>'<img src="media/'+k+'.jpg" alt="Пример выполненной работы">').join('')+'</div>':'';
   return '<details class="admin-record"><summary>'+(pictures[photo]?'<img src="media/'+photo+'.jpg" alt="">':'')+escape(title)+'<small>'+escape(detail)+'</small></summary><p>'+escape(r.description||r.about||r.terms)+'</p>'+photos+related+(admin?form(r):'')+'</details>';
 }
 const body=section==='Пароль'?'<form id="cloud-password">'+password('old','Текущий пароль','current-password')+password('password','Новый пароль','new-password')+'<button>Сменить пароль</button></form>':section==='Журнал'?data.Журнал.map(r=>'<p>'+escape(new Date(r.at).toLocaleString('ru'))+' · '+escape(({INSERT:'Создание',UPDATE:'Изменение',DELETE:'Удаление'})[r.action])+' · '+escape(r.label)+'</p>').join('')||'<p>Действий пока нет.</p>':(admin?'<details><summary class="attach">＋ Добавить запись</summary>'+form()+'</details>':'')+data[section].map(card).join('');
 paint('<p class="eyebrow">ДЕМОНСТРАЦИОННЫЕ ДАННЫЕ</p>'+tabbar+body+(admin?'<button id="cloud-logout" class="wide">Выйти</button>':''));
 root.querySelector('#cloud-logout')?.addEventListener('click',async()=>{try{await signOut()}finally{location.reload()}});
 root.querySelectorAll('form').forEach(f=>f.onsubmit=async e=>{
  e.preventDefault();if(!currentAuth())return;
  const values=Object.fromEntries(new FormData(f));const button=e.submitter;button.disabled=true;
  try{
   if(f.id==='cloud-password'){
    const fresh=await request('/auth/v1/token?grant_type=password','POST',{email:currentAuth().user.email,password:values.old},null);
    await request('/auth/v1/user','PUT',{password:values.password},fresh.access_token);
    try{await signOut()}finally{location.reload()}return;
   }else{
    const id=f.dataset.record, removing=button.name==='remove';
    if(removing&&!confirm('Удалить эту запись? Связанные отклики также будут удалены.'))return;
    if(['Исполнители','Заказчики'].includes(section))values.role=section==='Исполнители'?'Исполнитель':'Заказчик';
    if(section==='Тендеры')values.customer=lookup('owner',values.owner);
    const filter=id?'?'+(section==='Тендеры'?'position':'id')+'=eq.'+encodeURIComponent(id):'';
    const result=await request('/rest/v1/'+tables[section]+filter,removing?'DELETE':id?'PATCH':'POST',removing?undefined:values);
    if(!result?.length)throw Error('Запись не изменена. Обновите страницу.');
   }
   if(f.id!=='cloud-password')await sync();
   await render();notice('Сохранено');
  }catch(err){notice(err.message)}finally{button.disabled=false}
 });
}
