import {portfolio} from './portfolio.js?v=20261104-1';
import {crm,progress} from './crm.js';
import {catalog} from './catalog.js';
import {seed} from './demo.js';
const screen = document.querySelector('#screen');
const dialog = document.querySelector('dialog');
const roles = ['Создание тендера', 'Отклики', 'Профиль исполнителя', 'Мой объект'];
const kinds = ['Строительство дома', 'Фундамент', 'Кровля', 'Электромонтаж', 'Отделочные работы'];
const durations = ['До 2 недель', 'До 1 месяца', '1–2 месяца', '3–5 месяцев', 'Указать в описании'];
const people = [
  {name:'СК ПрофСтрой', type:'Компания', photo:'team',teamSize:12,about:'Строим частные дома от фундамента до кровли. Перед заливкой показываем армирование, после каждого этапа присылаем фото.', rating:'4,8', reviews:42, factor:295/300, years:8, projects:120, terms:'Работы, инструмент и технический надзор', portfolio:['house','house2','pan'], review:'Сдали в согласованный срок. Прораб присылал фотографии после каждого этапа.'},
  {name:'Андрей Ковалёв и бригада', type:'Бригада', photo:'team2', rating:'4,9', reviews:28, factor:0.9, years:6, projects:54, terms:'Работа бригады и инструмент', portfolio:['roof','house','room'], review:'Объяснили смету до начала работ и помогли с приёмкой материалов.'},
  {name:'ДомСтрой Групп', type:'Компания', photo:'house2', rating:'4,7', reviews:19, factor:31/30, years:7, projects:76, terms:'Работы, инструмент и организация доставки', portfolio:['pan','room','house2'], review:'Удобно было сверять ход работ с планом. Получили фото и акт по завершении.'}
];
const db = await new Promise((resolve,reject) => {
  const request = indexedDB.open('belkhi-customer',1);
  request.onupgradeneeded = () => request.result.createObjectStore('tenders',{keyPath:'id'});
  request.onsuccess = () => resolve(request?.result);
  request.onerror = () => reject(request.error);
}).catch(() => null);
async function records(mode,operation) {
  if (!db) throw Error('Хранилище браузера недоступно. Разрешите локальное хранение данных.');
  return new Promise((resolve,reject) => {
    const tx=db.transaction('tenders',mode);
    const request=operation(tx.objectStore('tenders'));
    tx.oncomplete=()=>resolve(request?.result);
    tx.onabort=()=>reject(tx.error || Error('Не удалось сохранить данные на устройстве.'));
  });
}
const esc = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => new Intl.NumberFormat('ru-RU').format(n)+' ₽';
function bids(t) {
  if(t.catalogBids)return [...(t.bids||[]),...t.catalogBids.map(p=>({portfolio:[],rating:'—',projects:0,years:0,review:'Отзывов пока нет.',...people[p.id],...p,about:p.id==='0' && (!p.about || p.about==='Дома под ключ. Работаем с 2016 года.')?people[0].about:p.about||people[p.id]?.about}))];
  const overrides=JSON.parse(localStorage.getItem('belkhi-firms')||'{}');
  const samples = people.map((base, i) => ({
    ...base,...overrides[i], id:String(i), demo:true,
    price:Math.max(1,Math.round(t.budget*base.factor)),
    period:t.period==='3–5 месяцев'?['4 месяца','3–4 месяца','4 месяца'][i]:t.period==='Указать в описании'?'По условиям тендера':t.period
  }));
  return [...(t.bids || []), ...samples.map(p=>({...p,...t.offerEdits?.[p.id]})).filter(p=>(!p.deleted&&!p.hidden) || String(t.winner)===p.id)];
}
function bidById(t,id){return bids(t).find(p=>p.id===String(id))}
const channel = new BroadcastChannel('belkhi-tenders');
channel.onmessage=({data})=>{
  if(['offers','list','market'].includes(route().page)||(route().page==='sent'&&route().id===data))render();
};
const img = (key,alt='') => '<img src="media/'+encodeURIComponent(key)+'.jpg" alt="'+esc(alt)+'">';
const link=(hash,text,cls='btn')=>'<a class="'+cls+'" href="#'+esc(hash)+'">'+esc(text)+'</a>';
const tabs=(values,current)=>'<div class="tabs">'+values.map(v=>'<button data-tab="'+esc(v)+'" aria-pressed="'+(v===current)+'">'+esc(v)+'</button>').join('')+'</div>';
let selectedFiles=[], draft={}, current, generation=0, urls=[];
let profileReturn='';
function notice(msg){document.querySelector('#message').textContent=msg}
function objectURL(file){const url=URL.createObjectURL(file);urls.push(url);return url}
const workerPages=['worker','market','works','crew','apply','sent','crm','manual','buyer'];
const navIcons={
  market:'M5 3h10l4 4v14H5z M15 3v5h4 M9 12h6 M9 16h4',
  works:'M3 7h7l2 3h9v10H3z M3 7V5h7l2 2',
  crew:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M3 21v-2a6 6 0 0 1 12 0v2 M17 6a3 3 0 0 1 0 6 M17 15a5 5 0 0 1 5 5v1',
  worker:'M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M5 21a7 7 0 0 1 14 0'
};
function bottomNav(worker,page){
  const items=[['market','Тендеры','market'],['list','Мои заказы','works'],['works','Работы','works'],['crew','Команда','crew'],['worker','Профиль','worker']];
  const active=({crm:'works',manual:'works',apply:'market',sent:'works',new:'list',offers:'list',profile:'list',project:'list'})[page]||page;
  const nav=document.querySelector('#bottom-nav'),signature=items.map(item=>item[0]).join('|');
  if(nav.dataset.items!==signature){
    nav.dataset.items=signature;
    nav.innerHTML=items.map(([path,title,icon])=>'<a href="#'+path+'" aria-label="'+title+'" title="'+title+'"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="'+navIcons[icon]+'"/></svg></a>').join('');
  }
  for(const item of nav.querySelectorAll('a')){
    const selected=item.getAttribute('href')==='#'+active;
    if(selected)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
  }
}
function teamMembers(p){return JSON.parse(localStorage.getItem('belkhi-team-'+p.id)||'[]')}
function crewScreen(p){
  const members=teamMembers(p);
  show(null,'Моя команда','<p class="muted">Добавьте людей, которых сможете назначать на выигранные объекты.</p>'+members.map(m=>'<div class="stage"><span class="avatar">'+esc(m.name.slice(0,1))+'</span><div><b>'+esc(m.name)+'</b><div class="meta">'+esc(m.job)+'</div></div></div>').join('')+'<form id="crew-form"><label for="member">Имя работника</label><input id="member" name="name" required maxlength="90"><label for="job">Специальность</label><input id="job" name="job" required maxlength="100" placeholder="Например, каменщик"><button class="primary wide">Добавить работника</button></form>');
}
function projectCrew(t,p){
  if(String(t.winner)!==p.id)return '';
  const team=teamMembers(p);
  return '<h3>Работники на объекте</h3><form id="staff-form"><div class="chips">'+team.map(m=>'<label><input type="checkbox" name="member" value="'+m.id+'" '+((t.staff||[]).includes(m.id)?'checked':'')+'> '+esc(m.name)+' · '+esc(m.job)+'</label>').join('')+'</div>'+(team.length?'<button class="wide secondary">Сохранить состав</button>':'<p>Добавьте первого работника в команду.</p>')+'</form>'+link('crew','Моя команда','back');
}
function customerProfile(){
  const p=JSON.parse(localStorage.getItem('belkhi-customer-profile')||'{}');
  const savedHandle=localStorage.getItem('belkhi-public-handle/customer');
  const handle=savedHandle||'belhi_'+crypto.randomUUID().replaceAll('-','').slice(0,8);
  show(null,'Настройки профиля','<form id="customer-form" class="customer-settings">'+
    '<div class="settings-person"><span class="settings-avatar">'+esc((p.name||'З').slice(0,1))+'</span><div><strong>Профиль заказчика</strong><small>Личные сведения вашего кабинета</small></div></div>'+
    '<section><h3>Основные сведения</h3><label for="customer-name">Имя или название<input id="customer-name" name="name" required maxlength="90" value="'+esc(p.name||'')+'" placeholder="Например, Ахмед или СК Монолит"></label>'+
    '<div class="settings-pair"><label for="customer-type">Тип профиля<select id="customer-type" name="type"><option '+(p.type==='Частный заказчик'?'selected':'')+'>Частный заказчик</option><option '+(p.type==='Компания-заказчик'?'selected':'')+'>Компания-заказчик</option></select></label>'+
    '<label for="customer-city">Город<input id="customer-city" name="city" maxlength="100" value="'+esc(p.city||'')+'" placeholder="Грозный"></label></div>'+
    '<label for="customer-handle">Ник профиля<span class="handle-field"><b>@</b><input id="customer-handle" name="handle" required maxlength="30" pattern="[A-Za-z0-9._]{3,30}" value="'+esc(handle)+'"></span><small>Латиница, цифры, точка или подчёркивание</small></label></section>'+
    '<section><h3>О себе</h3><label for="customer-about">Короткое описание<textarea id="customer-about" name="about" maxlength="500" rows="3" placeholder="Расскажите, какие объекты вы строите и что для вас важно">'+esc(p.about||'')+'</textarea></label></section>'+
    '<div class="privacy-note"><strong>Ваши данные защищены</strong><span>До выбора исполнителя участники тендера не видят имя, профиль и контакты заказчика.</span></div>'+
    '<button class="primary wide">Сохранить изменения</button></form>','customer');
}
document.addEventListener('submit',async e=>{
  const id=e.target.id;
  if(!['crew-form','staff-form','customer-form'].includes(id))return;
  e.preventDefault();
  const data=new FormData(e.target);
  try{
    if(id==='staff-form'){
      const p=myProfile(), projectId=current.id;
      const staff=data.getAll('member').filter(id=>teamMembers(p).some(m=>m.id===id));
      await records('readwrite',s=>{
        const req=s.get(projectId);
        req.onsuccess=()=>{if(String(req.result?.winner)===p.id)s.put({...req.result,staff})};
        return req;
      });
      channel.postMessage(projectId);
    }else{
      const name=data.get('name').trim();
      if(!name)throw Error('Укажите имя.');
      if(id==='customer-form'){
        const handle=data.get('handle').trim().toLowerCase();
        if(!/^[a-z0-9._]{3,30}$/.test(handle))throw Error('Проверьте ник профиля: используйте латиницу, цифры, точку или подчёркивание.');
        localStorage.setItem('belkhi-customer-profile',JSON.stringify({name,type:data.get('type'),city:data.get('city').trim(),about:data.get('about').trim()}));
        localStorage.setItem('belkhi-public-handle/customer',handle);
      }
      else{
        const p=myProfile(),job=data.get('job').trim();
        if(!job)throw Error('Укажите специальность.');
        localStorage.setItem('belkhi-team-'+p.id,JSON.stringify([...teamMembers(p),{id:crypto.randomUUID(),name,job}]));
      }
    }
    if(id==='customer-form'){location.hash='customer';return}
    await render();notice('Сохранено');
  }catch(error){notice(error.message)}
});

function show(step,title,body,back=''){
  const workerMode=workerPages.includes(route().page);
  const role=workerMode?'Исполнитель':'Заказчик';
  bottomNav(workerMode,route().page);
  const steps=workerMode?['Мой профиль','Доступные заявки','Отклик на заявку','Мой отклик']:roles;
  document.querySelector('.head>span').textContent='Мой кабинет';
  document.querySelector('.rail small').textContent='БЕЛХИ';
  document.querySelector('.rail h2').textContent='От заявки до стройки';
  const toggle=document.querySelector('#switch-role');
  toggle.textContent='Создать тендер';
  toggle.href='#new';
  document.querySelector('.brand').href='#market';
  const heading=back
    ? '<div class="screen-heading"><a href="#'+esc(back)+'" aria-label="Назад" title="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></a><h1>'+esc(title)+'</h1></div>'
    : '<h1>'+esc(title)+'</h1>';
  screen.innerHTML=heading+body;
  document.querySelector('#steps').innerHTML=steps.map((v,i)=>'<li class="'+(i===step?'active':'')+'"><span class="num">'+(i+1)+'</span>'+v+'</li>').join('');
  document.title=title+' · Белхи';
}
function form(){
  const options=(values,value)=>values.map(v=>'<option '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('');
  show(0,'Создание тендера','<form id="tender"><label for="kind">Тип работ</label><select id="kind" name="kind">'+options(kinds,draft.kind)+'</select><label for="description">Описание проекта</label><textarea id="description" name="description" maxlength="3000" required placeholder="Например, одноэтажный дом из газобетона. Нужны фундамент, коробка и кровля.">'+esc(draft.description||'')+'</textarea><label for="district">Город или район</label><input id="district" name="district" required maxlength="100" value="'+esc(draft.district||'')+'" placeholder="Например, Истринский район"><div class="pair"><div><label for="budget">Бюджет, ₽</label><input id="budget" name="budget" type="number" inputmode="numeric" min="1" max="100000000000" required placeholder="3 000 000" value="'+esc(draft.budget||'')+'"></div><div><label for="period">Срок выполнения</label><select id="period" name="period">'+options(durations,draft.period||'3–5 месяцев')+'</select></div></div><p class="fieldlabel">Фото, планы, чертежи</p><div id="files"></div><input class="hiddenfile" id="upload" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple><label class="attach" for="upload">＋ Добавить файл</label><p class="caption">До 5 файлов JPEG, PNG, WebP или PDF, до 10 МБ каждый.</p><button class="primary wide">Создать тендер</button><p class="caption">Сохранится на этом устройстве. Для сравнения появятся демонстрационные отклики.</p></form>','list');
  fileList();
}
function fileList(){document.querySelector('#files').innerHTML=selectedFiles.map((f,i)=>'<div class="file">'+esc(f.name)+'<button type="button" data-remove="'+i+'" aria-label="Удалить '+esc(f.name)+'">×</button></div>').join('')}
function customerBadge(t){
  if(!t.owner)return '';
  const record=readLocal('belkhi-customers',{})[t.owner];
  if(record?.deleted)return '';
  return '<span class="customer-badge">'+img(['maria','ivan','musa'].includes(t.owner)?t.owner:'man')+'<span>'+esc(record?.name||t.customer)+'</span></span>';
}
function offers(t,filter){
  const types={'Бригады':'Бригада','Компании':'Компания','Мастера':'Частный мастер'};
  const all=bids(t), list=all.filter(p=>filter==='Все'||p.type===types[filter]);
  const filters=['Все',...Object.keys(types)].map(name=>
    '<button data-tab="'+name+'" aria-pressed="'+(name===filter)+'">'+name+'</button>'
  ).join('');
  const photo=t.files?.find(file=>file instanceof Blob && file.type.startsWith('image/'));
  const cover=photo?'<img src="'+objectURL(photo)+'" alt="Фото объекта">':t.id==='demo-3' && t.photo==='site' && t.description?.includes('10 × 8')?'<img src="media/foundation-plan.svg" alt="Схема ленточного основания 10 на 8 метров">':t.photo?img(t.photo,'Фото объекта'):'';
  const post=`<article class="tender-post">
    <div class="post-heading"><strong>${esc(t.kind)}</strong><small>${esc(t.district)}</small></div>
    ${cover}<div class="post-caption"><dl class="post-spec"><div><dt>Бюджет</dt><dd>до ${money(t.budget)}</dd></div><div><dt>Срок работ</dt><dd>${esc(t.period)}</dd></div></dl>
    ${t.description?'<p>'+esc(t.description)+'</p>':''}</div></article>`;
  const cards=list.map(p=>`<article class="entry offer-row">${avatar(p)}<div><strong>${esc(p.name)}</strong>
    <small>${p.demo?'<b class="score">★ '+esc(p.rating)+'</b> · ':''}${esc(p.type)}${p.demo?' · Демо':''}</small>
    <div class="offer-foot"><div><b>${money(p.price)}</b><small>${esc(p.period)}</small></div>
    ${link('profile/'+t.id+'/'+encodeURIComponent(p.id),'Посмотреть','btn primary')}</div></div></article>`).join('');
  show(1,'Отклики на тендер',post+'<h3 class="responses-title">Отклики <small>'+all.length+'</small></h3><div class="offer-filters">'+filters+'</div>'+ (cards||'<p class="muted">Таких откликов пока нет.</p>'),'list');
}
function avatar(p){return p.demo?img(p.photo):'<span class="avatar">'+esc(p.name.trim().slice(0,1))+'</span>'}
async function profile(t,p,tab,filter){
  const live=myProfile();
  const person=live?.id===p.id?live:p;
  const terms=`<details class="bid-details"><summary><strong>Отклик · ${esc(t.kind)}</strong>
    <b>${money(p.price)} · ${esc(p.period)}</b></summary>
    <div class="bid-expanded"><div class="bid-copy"><strong>Ваша задача</strong><small>${esc(t.district)}</small>
    ${t.description?'<p>'+esc(t.description)+'</p>':''}</div>
    ${p.terms?'<div class="bid-copy"><strong>Что предлагает исполнитель</strong><p>'+esc(p.terms)+'</p></div>':''}
    <button class="primary" data-choose="${esc(p.id)}">Выбрать исполнителя</button></div></details>`;
  await portfolio(person,p.demo?'demo/'+p.id:p.id,false,portfolioUI,terms,'offers/'+t.id+'?tab='+encodeURIComponent(filter));
}
function project(t,tab){
  const p=bidById(t,t.winner);const stages=t.kind==='Строительство дома'?['Подготовительные работы','Фундамент','Коробка дома','Кровля','Отделочные работы']:['Подготовительные работы',t.kind,'Приёмка работ'];
  const team='<div class="info">'+avatar(p)+'<div><strong>'+esc(p.name)+'</strong><span>'+esc(p.type)+' · Исполнитель выбран</span></div></div>';
  const files=(t.files||[]).map(f=>'<a class="project" download="'+esc(f.name)+'" href="'+objectURL(f)+'">'+esc(f.name)+' ↓</a>').join('')||'<p class="muted">Файлы к тендеру не прикреплены.</p>';
  show(3,'Мой объект','<div class="info">'+img('house')+'<div><strong>'+esc(t.kind)+'</strong><div class="meta">'+esc(t.district)+'</div><span class="tag">В работе</span></div></div>'+tabs(['Этапы','Команда','Документы'],tab)+(tab==='Команда'?team:tab==='Документы'?files:t.plan?.length?t.plan.map(s=>'<div class="stage"><b>'+esc(s.name)+'</b><span>'+progress([s]).done+' / '+s.tasks.length+' задач</span></div>').join(''):stages.map((s,i)=>'<div class="stage"><span class="num">'+(i+1)+'</span><div><b>'+s+'</b><div class="meta">Запланировано</div></div></div>').join(''))+'<h3>Условия заказа</h3><div class="summary"><b>'+esc(p.name)+'</b><br>'+money(p.price)+' · '+esc(p.period)+'<br>'+esc(p.terms)+'</div><p>'+esc(t.description)+'</p>','list');
}
const profileKey='belkhi-specialist-v1';
function portfolioOwner(){
  const key='belkhi-portfolio-owner';
  if(!localStorage.getItem(key))localStorage.setItem(key,crypto.randomUUID());
  return localStorage.getItem(key);
}
function myProfile(){
  const p=JSON.parse(localStorage.getItem(profileKey)||'null');
  return p && {...p,teamSize:teamMembers(p).length+1};
}
function editProfile(p={}){
  show(null,'Настройки профиля','<div class="profile-id">'+avatar({...p,name:p.name||'И'})+'<div><strong>'+esc(p.name||'Новый исполнитель')+'</strong><small>'+esc([p.type,p.city].filter(Boolean).join(' · '))+'</small></div></div><form id="worker-profile"><details class="fold" '+(!p.id?'open':'')+'><summary>Основные сведения</summary><div><label for="work-type">От чьего лица вы работаете</label><select id="work-type" name="type">'+['Частный мастер','Бригада','Компания'].map(v=>'<option '+(p.type===v?'selected':'')+'>'+v+'</option>').join('')+'</select><label for="work-name">Имя или название команды</label><input id="work-name" name="name" maxlength="90" required value="'+esc(p.name||'')+'"></div></details><details class="fold" '+(!p.id?'open':'')+'><summary>Специализация<small>'+esc(p.skills?.join(' · ')||'Выберите виды работ')+'</small></summary><div><fieldset class="specialties"><legend>Специализация</legend><div class="chips">'+kinds.map(k=>'<label><input type="checkbox" name="skills" value="'+esc(k)+'" '+(p.skills?.includes(k)?'checked':'')+'> '+esc(k)+'</label>').join('')+'</div></fieldset></div></details><details class="fold" '+(!p.id?'open':'')+'><summary>Город и опыт</summary><div><label for="work-city">Город</label><input id="work-city" name="city" required maxlength="100" value="'+esc(p.city||'')+'"><label for="work-years">Стаж, полных лет</label><input id="work-years" type="number" inputmode="numeric" min="0" max="100" name="years" value="'+esc(p.years??'')+'"><label for="work-areas">Где работаете</label><input id="work-areas" name="areas" maxlength="240" placeholder="Города и районы через запятую" value="'+esc(p.areas||'')+'"><label for="work-about">О себе</label><textarea id="work-about" name="about" maxlength="1500" placeholder="Опыт и виды работ">'+esc(p.about||'')+'</textarea></div></details><button class="primary wide">Сохранить профиль</button></form>','worker');
}
function myBid(t,p){return (t.bids||[]).find(b=>b.id===p.id)}
function feedPost(t,p){
  const own=p && myBid(t,p);
  const files=(t.files||[]).filter(f=>f instanceof Blob).map(f=>({url:objectURL(f),name:f.name,image:f.type.startsWith('image/')}));
  if(t.photo)files.unshift({url:'media/'+encodeURIComponent(t.photo)+'.jpg',name:'Фото объекта',image:true});
  if(t.id==='demo-3' && t.description?.includes('10 × 8'))files.push({url:'media/foundation-plan.svg',name:'Схема основания',image:true});
  const media=files.map((f,i)=>`<a class="feed-slide" href="${esc(f.url)}" target="_blank" rel="noopener" aria-label="Открыть: ${esc(f.name)}">
    ${f.image?'<img loading="lazy" src="'+esc(f.url)+'" alt="'+esc(f.name)+'">':'<strong>Открыть PDF</strong>'}
    <span>${i+1}/${files.length} · ${esc(f.name)}</span></a>`).join('');
  return `<article class="feed-post"><div class="post-heading"><strong>${esc(t.kind)}</strong><small>${esc(t.district)}</small></div>
    <div class="feed-cover feed-gallery">${media||'<span class="no-cover">Фото пока нет</span>'}</div>
    <div class="post-caption"><dl class="post-spec"><div><dt>Бюджет</dt><dd>${money(t.budget)}</dd></div><div><dt>Срок работ</dt><dd>${esc(t.period)}</dd></div></dl>
    <p>${esc(t.description||'')}</p></div><div class="feed-actions"><small>${t.demo?'Демо · ':''}Откликов: ${bids(t).length}</small>
    ${link((own?'sent/':'apply/')+t.id,own?'Мой отклик':'Оставить отклик','btn primary')}</div></article>`;
}
function tenderRow(t, target, status, ownerVisible=false){
  const attachment=t.files?.find(f=>f instanceof Blob && f.type.startsWith('image/'));
  const thumb=attachment?'<img src="'+objectURL(attachment)+'" alt="">':t.photo?img(t.photo,''):'<span class="tender-placeholder" aria-hidden="true">⌂</span>';
  return '<a class="tender-card" href="#'+esc(target)+'">'+thumb+'<div class="tender-details"><strong>'+esc(t.kind)+'</strong><span class="meta">'+esc(t.district)+' · '+esc(t.period)+'</span><div class="tender-price"><b>'+money(t.budget)+'</b><span class="tag">'+esc(status)+'</span></div>'+(ownerVisible?customerBadge(t):'')+'</div></a>';
}
function market(tenders,p,params){
  const filter=params.get('tab')||(p.skills.length?'По специальности':'Все');
  const relevant=tenders.filter(t=>!t.manual&&(filter==='Мои отклики'?myBid(t,p):t.winner==null&&(t.demo||t.owner)&&t.parentOwner!==p.id&&(filter==='Все'||p.skills.includes(t.kind)))).sort((a,b)=>b.created-a.created);
  const choices=key=>[...new Set(relevant.map(t=>t[key]).filter(Boolean))].sort();
  const filters=`<form id="feed-filter">
    <input type="search" name="query" id="tender-search" aria-label="Поиск объектов" placeholder="Поиск по объектам">
    <button type="button" id="filter-open" aria-haspopup="dialog">Фильтры</button>
    <dialog id="market-panel" aria-labelledby="filter-title"><h3 id="filter-title">Фильтры</h3>
      <fieldset><legend>Города и районы</legend><div class="filter-cities">${choices('district').map(c=>'<label><input type="checkbox" name="city" value="'+esc(c)+'"> '+esc(c)+'</label>').join('')}</div></fieldset>
      <label>Тип работ<select name="kind"><option value="">Все работы</option>${choices('kind').map(k=>'<option>'+esc(k)+'</option>').join('')}</select></label>
      <div class="pair"><label>Бюджет от, ₽<input name="min" type="number" min="0"></label><label>До, ₽<input name="max" type="number" min="0"></label></div>
      <div class="filter-actions"><button type="reset">Сбросить</button><button type="button" class="primary" id="filter-done">Готово</button></div>
    </dialog></form>`;
  const modes=[['Все','Все'],['По специальности','Подходящие'],['Мои отклики','Мои отклики']];
  const switcher='<div class="market-modes">'+modes.map(([value,label])=>`<button data-tab="${value}" aria-pressed="${filter===value}">${label}</button>`).join('')+'</div>';
  show(1,'Тендеры',filters+switcher+'<div id="results"></div>');
  const search=document.querySelector('#tender-search');
  const panel=document.querySelector('#market-panel');
  const opener=document.querySelector('#filter-open');
  opener.onclick=()=>panel.showModal();
  document.querySelector('#filter-done').onclick=()=>panel.close();
  function results(){
    const q=search.value.trim().toLocaleLowerCase('ru');
    const f=new FormData(search.form), cities=f.getAll("city");
    const count=cities.length+['kind','min','max'].filter(key=>f.get(key)).length;
    opener.textContent=count?'Фильтры · '+count:'Фильтры';
    const visible=relevant.filter(t=>(!cities.length||cities.includes(t.district)) && (!f.get("kind")||t.kind===f.get("kind")) && (!f.get("min")||Number(t.budget)>=Number(f.get("min"))) && (!f.get("max")||Number(t.budget)<=Number(f.get("max"))) && [t.kind,t.district,t.description].join(' ').toLocaleLowerCase('ru').includes(q));
    document.querySelector('#results').innerHTML=visible.map(t=>{
      const own=myBid(t,p);
      const status=!own?'Открыт':String(t.winner)===own.id?'Вас выбрали':t.winner!=null?'Тендер закрыт':'Отклик отправлен';
      if(t.winner==null)return feedPost(t,p);
      return tenderRow(t,(own?'sent/':'apply/')+t.id,status);
    }).join('')||'<p class="muted">'+(filter==='Мои отклики'?'Здесь появятся отправленные предложения.':'Подходящих тендеров нет. Попробуйте вкладку «Все» или другой запрос.')+'</p>';
  }
  search.form.oninput=results;search.form.onreset=()=>queueMicrotask(results);search.form.onsubmit=e=>e.preventDefault();results();
}
async function workerScreen(page,id,params,seq){
  const savedProfile=myProfile();
  const p=savedProfile||{id:portfolioOwner(),name:'Исполнитель',skills:[]};
  if(page==='worker'){if(params.has('edit'))editProfile(p||{});else await portfolio(p||{name:'Исполнитель'},p?.id||portfolioOwner(),true,portfolioUI,'',profileReturn||(p?'market':'list'));return}
  if(page==='apply'&&!savedProfile){
    show(null,'Заполните профиль для отклика','<p>Укажите имя, город и специальность, чтобы заказчик мог оценить ваше предложение.</p>'+link('worker?edit=1&tender='+encodeURIComponent(id),'Заполнить профиль','btn primary'),'market');return
  }
  if(page==='manual'){
    show(null,'Новый объект',`<form id="manual-project">
      <p class="form-note">Свой заказ в разделе «Работы». Этапы добавите после создания.</p>
      <label>Название объекта<input name="kind" placeholder="Например, дом из кирпича" required maxlength="100"></label>
      <label>Город или район<input name="district" placeholder="Грозный" required maxlength="100"></label>
      <div class="project-terms">
        <label>Бюджет, ₽<input type="number" inputmode="numeric" name="budget" min="1" placeholder="350 000" required></label>
        <label>Срок работ<input name="period" placeholder="3 недели" required maxlength="80"></label>
      </div>
      <button class="primary" type="submit">Создать объект</button>
    </form>`,'works');
    document.querySelector('#manual-project').onsubmit=async e=>{
      e.preventDefault();const f=e.target,b=e.submitter||f.querySelector('button[type=submit]');b.disabled=true;
      try{const data=Object.fromEntries(new FormData(f)),id=crypto.randomUUID();
        await records('readwrite',s=>s.add({...data,id,created:Date.now(),manual:true,winner:p.id,description:'',files:[],bids:[]}));
        location.hash='crm/'+id;
      }catch(error){notice(error.message)}finally{b.disabled=false}
    };return
  }
  if(page==='crew'){crewScreen(p);return}
  if(page==='works'){
    const demoId='crm-demo-'+p.id;
    if(!await records('readonly',s=>s.get(demoId))){
      const plan=[{id:'prep',name:'Подготовка',tasks:[{id:'mark',name:'Разметить участок',type:'Галочка',done:true,assignee:'',due:''}]},{id:'base',name:'Фундамент',tasks:[{id:'rebar',name:'Связать арматуру',type:'Количество',count:40,target:100,unit:'м',done:false,assignee:'',due:''},{id:'pour',name:'Залить бетон',type:'Галочка',done:false,assignee:'',due:''}]}];
      await records('readwrite',s=>s.put({id:demoId,kind:'Демо · Дом 120 м²',district:'Грозный',period:'2 месяца',budget:850000,photo:'house',manual:true,demo:true,winner:p.id,created:0,plan,log:[{at:Date.now(),text:'Демо · Разметка участка завершена. Арматура: 40 из 100 м.',photo:null}]}));
    }
    const secondId=demoId+'-finish';
    if(!await records('readonly',s=>s.get(secondId))){
      await records('readwrite',s=>s.put({id:secondId,kind:'Демо · Отделка квартиры',district:'Цоци-Юрт',period:'3 недели',budget:240000,photo:'room',manual:true,demo:true,winner:p.id,created:1,plan:[{id:'finish',name:'Чистовая отделка',tasks:[{id:'paint',name:'Покрасить стены',type:'Галочка',done:true,assignee:'',due:''},{id:'floor',name:'Уложить пол',type:'Количество',count:30,target:60,unit:'м²',done:false,assignee:'',due:''}]}],log:[{at:Date.now(),text:'Демо · Стены покрашены. Напольное покрытие уложено на 30 м².'}]}));
    }
    const all=await records('readonly',s=>s.getAll());if(seq!==generation)return;
    const sorted=all.sort((a,b)=>b.created-a.created);
    const jobs=sorted.filter(t=>String(t.winner)===p.id);
    const offers=sorted.filter(t=>myBid(t,p)&&String(t.winner)!==p.id);
    const workCard=t=>{
      const state=progress(t.plan||[]),percent=state.total?Math.round(state.done/state.total*100):0;
      const currentStage=(t.plan||[]).find(stage=>progress([stage]).done<(stage.tasks||[]).length);
      const status=state.total&&state.done===state.total?'Завершён':currentStage?'В работе':'Нужен план';
      const title=String(t.kind||'Объект').replace(/^Демо · /,'');
      const next=currentStage?'Сейчас · '+currentStage.name:state.total?'Все задачи выполнены':'Добавьте этапы и задачи';
      return '<a class="work-card" href="#crm/'+encodeURIComponent(t.id)+'">'+
        '<span class="work-cover">'+(t.photo?img(t.photo,title):'<span>⌂</span>')+'</span>'+
        '<span class="work-content"><span class="work-title"><strong>'+esc(title)+'</strong><small>'+status+'</small></span>'+
        '<span class="work-meta">'+esc(t.district)+' · '+esc(t.period||'Срок не указан')+'</span>'+
        '<span class="work-current">'+esc(next)+'</span><progress max="100" value="'+percent+'"></progress>'+
        '<span class="work-progress"><small>'+state.done+' из '+state.total+' задач</small><b>'+percent+'%</b></span></span></a>';
    };
    const visibleJobs=[...jobs].sort((a,b)=>Number(b.demo)-Number(a.demo)||b.created-a.created);
    show(null,'Работы',
      '<div class="works-intro"><p>Управляйте этапами, задачами и командой на каждом объекте.</p>'+link('manual','＋ Объект','btn secondary pill works-add')+'</div>'+
      '<section class="works-section"><div class="works-section-head"><h3>В работе</h3><span>'+visibleJobs.length+'</span></div>'+
      (visibleJobs.map(workCard).join('')||'<div class="works-empty"><b>Объектов пока нет</b><small>Выигранные заказы и свои проекты появятся здесь.</small></div>')+'</section>'+
      '<details class="fold works-offers"><summary>Отправленные отклики <small>'+offers.length+' предложений</small></summary><div>'+
      (offers.map(t=>link('sent/'+t.id,t.kind+' · '+(t.winner==null?'На рассмотрении':'Тендер закрыт'),'project')).join('')||'<p class="muted">Вы ещё не откликались на тендеры.</p>')+'</div></details>');return
  }
  if(page==='market'){const all=await records('readonly',s=>s.getAll());if(seq===generation)market(all,p,params);return}
  const t=await records('readonly',s=>s.get(id));if(seq!==generation)return;
  if(!t){location.replace('#market');return}
  current=t;
  if(page==='apply'&&(t.parentOwner===p.id||(!t.demo&&!t.manual&&!t.owner&&!t.parentId))){location.replace('#offers/'+t.id);return}
  if(page==='buyer'){location.replace('#works');return}
  if(page==='crm'){if(t.winner!==p.id){location.replace('#works');return}crm(t,p,{esc,show,link,teamMembers,records,render,notice,channel});
    const children=(await records('readonly',s=>s.getAll())).filter(child=>child.parentId===t.id);
    if(seq!==generation)return;
    screen.insertAdjacentHTML('beforeend','<h3>Субподряд</h3>'+link('new?parent='+encodeURIComponent(t.id),'＋ Нанять на часть работ','btn secondary pill')+children.map(child=>tenderRow(child,(child.winner==null?'offers/':'project/')+child.id,child.winner==null?'Сравнить отклики · '+bids(child).length:'В работе')).join(''));return}
  const own=myBid(t,p);
  const requestCard='<article class="apply-request">'+
    (t.photo?'<div class="apply-cover">'+img(t.photo,t.kind)+'</div>':'')+
    '<div class="apply-request-body"><div class="apply-request-head"><div><h2>'+esc(t.kind)+'</h2><span>'+esc(t.district)+'</span></div><span class="tag">Приём откликов</span></div>'+
    '<dl class="apply-facts"><div><dt>Бюджет заказчика</dt><dd>'+money(t.budget)+'</dd></div><div><dt>Желаемый срок</dt><dd>'+esc(t.period)+'</dd></div><div><dt>Откликов</dt><dd>'+bids(t).length+'</dd></div></dl>'+
    '<p class="apply-description">'+esc(t.description||'Описание работ не указано.')+'</p></div></article>';
  const intro=requestCard;
  if(own){
    const status=t.winner==null?'Отклик отправлен':String(t.winner)===own.id?'Заказчик выбрал вас':'Выбран другой исполнитель';
    show(3,status,intro+'<h3>Ваше предложение</h3><b class="amount">'+money(own.price)+'</b> · '+esc(own.period)+'<p>'+esc(own.terms)+'</p>'+(String(t.winner)===p.id?link('crm/'+t.id,'Открыть объект в CRM','btn primary'):'')+projectCrew(t,p)+link('market?tab='+encodeURIComponent('Мои отклики'),'Мои отклики','btn secondary'),'market');return
  }
  if(t.winner!=null){show(2,'Тендер закрыт',intro+'<p>Заказчик уже выбрал исполнителя.</p>','market');return}
  const files=(t.files||[]).map(f=>'<a class="project" download="'+esc(f.name)+'" href="'+objectURL(f)+'">'+esc(f.name)+' ↓</a>').join('');
  const performer='<div class="bid-profile">'+avatar(p)+'<div><small>Отклик от</small><strong>'+esc(p.name)+'</strong><span>'+esc([p.type,p.city].filter(Boolean).join(' · '))+'</span></div>'+link('worker?edit=1','Изменить профиль','btn secondary')+'</div>';
  show(2,'Отклик на заявку',requestCard+
    (files?'<details class="fold apply-files"><summary>Материалы заказчика <small>'+(t.files||[]).length+' файлов</small></summary><div>'+files+'</div></details>':'')+
    performer+'<section class="bid-compose"><div class="bid-compose-head"><h3>Ваше предложение</h3><span>Заказчик увидит цену, срок и комментарий</span></div>'+
    '<form id="bid-form"><div class="bid-fields"><label for="bid-price">Стоимость работ, ₽<input id="bid-price" name="price" type="number" inputmode="numeric" min="1" max="100000000000" required placeholder="Например, '+Math.round(Number(t.budget)*.9).toLocaleString('ru-RU')+'"></label>'+
    '<label for="bid-period">Срок выполнения<input id="bid-period" name="period" list="period-options" required maxlength="80" placeholder="Например, 3 недели"><datalist id="period-options"><option value="До 2 недель"><option value="3 недели"><option value="1 месяц"><option value="1–2 месяца"></datalist></label></div>'+
    '<label for="bid-comment">Комментарий заказчику <small>по желанию</small><textarea id="bid-comment" name="terms" maxlength="1500" placeholder="Укажите, что входит в стоимость, когда готовы начать и какую гарантию даёте"></textarea></label>'+
    '<div class="bid-submit"><span>Контакты откроются после выбора исполнителя.</span><button class="primary" type="submit">Отправить отклик</button></div></form></section>','market');
}
document.addEventListener('submit',async event=>{
  const form=event.target;
  if(!['worker-profile','bid-form'].includes(form.id))return;
  event.preventDefault();const data=new FormData(form);
  const value=key=>String(data.get(key)||'').trim();
  const submit=form.querySelector('button.primary');submit.disabled=true;
  try{
    if(form.id==='worker-profile'){
      const skills=data.getAll('skills');
      if(!skills.length||!value('name')||!value('city'))throw Error('Укажите имя, город и хотя бы одну специальность.');
      localStorage.setItem(profileKey,JSON.stringify({id:myProfile()?.id||portfolioOwner(),name:value('name'),city:value('city'),years:value('years'),areas:value('areas'),about:value('about'),type:value('type'),skills}));
      const tender=route().params.get('tender');
      location.hash=tender?'apply/'+encodeURIComponent(tender):'worker';return
    }
    const id=current.id, p=myProfile(), period=value('period'),price=Number(value('price'));
    if(!p||!period||!Number.isSafeInteger(price)||price<=0||price>100000000000)throw Error('Проверьте цену и срок выполнения.');
    const bid={...p,price,period,terms:value('terms')};
    let failure;
    await records('readwrite',store=>{
      const req=store.get(id);
      req.onsuccess=()=>{const tender=req.result;
        if(!tender||tender.winner!=null){failure='Приём предложений по этому тендеру завершён.';return}
        if(myBid(tender,p))return;
        store.put({...tender,bids:[...(tender.bids||[]),bid]});
      };return req;
    });
    if(failure)throw Error(failure);
    channel.postMessage(id);location.hash='sent/'+id;
  }catch(error){notice(error.message)}finally{submit.disabled=false}
});

const readLocal=(key,fallback)=>JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));
const writeLocal=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
const portfolioUI={show,esc,link,objectURL,notice,render};
function route(){
  const [path,query]=location.hash.slice(1).split('?');const [page,id,index]=path.split('/');
  return {page:page||'new',id,index,params:new URLSearchParams(query)};
}
async function render(){
  const seq=++generation;const {page,id,index,params}=route();
  dialog.close();notice('');urls.forEach(URL.revokeObjectURL);urls=[];current=null;
  try{
    if(workerPages.includes(page)){await workerScreen(page,id,params,seq);return}
    document.querySelector('#bottom-nav').hidden=false;
    if(page==='admin'||page==='catalog'){await catalog(page==='admin',params.get('section'),{show,notice,render,sync:()=>seed(records)});return}
    if(page==='customer'){
      location.replace('#worker'+(params.has('edit')?'?edit=1':''));return
    }
    if(page==='inbox'){location.replace('#list');return}
    if(page==='new'){
      const parentId=params.get('parent');
      if(parentId){const parent=await records('readonly',s=>s.get(parentId));if(!parent||parent.winner!==myProfile()?.id){notice('Объект недоступен');return}}
      form();return
    }
    if(page==='list'){
      const all=await records('readonly',s=>s.getAll());
      if(seq!==generation)return;
      const own=all.filter(t=>!t.manual && !t.demo && !t.owner && !t.parentId).sort((a,b)=>b.created-a.created);
      const sections=[false,true].map(active=>{
        const items=own.filter(t=>(t.winner!=null)===active);
        if(!items.length)return '';
        const rows=items.map(t=>{
          if(!active)return tenderRow(t,'offers/'+t.id,'Сравнить отклики · '+bids(t).length);
          const winner=bidById(t,t.winner);
          const stage=t.plan?.find(s=>progress([s]).done<s.tasks.length);
          return tenderRow(t,'project/'+t.id,[winner?.name,stage?.name||'Ход работ'].filter(Boolean).join(' · '));
        }).join('');
        return '<section class="object-group"><h3>'+(active?'В работе':'Ищем исполнителя')+' <small>'+items.length+'</small></h3>'+rows+'</section>';
      }).join('');
      show(null,'Мои объекты',link('new','＋ Создать тендер','btn primary new-tender')+(sections||'<p class="muted">Создайте первый тендер, чтобы получить предложения исполнителей.</p>'));return
    }
    const t=id&&await records('readonly',s=>s.get(id));if(seq!==generation)return;
    if(!t||t.manual){location.replace('#list');return}
    current=t;
    if(t.winner!=null&&page!=='project'){location.replace('#project/'+id);return}
    const tab=params.get('tab');
    if(page==='project'&&t.winner!=null)project(t,tab||'Этапы');
    else if(page==='profile'&&bidById(t,index))await profile(t,bidById(t,index),tab,params.get('from')||'Все');
    else offers(t,tab||'Все');
  }catch(e){notice(e.message)}
}
document.addEventListener('input',e=>{if(e.target.form?.id==='tender')draft=Object.fromEntries(new FormData(e.target.form))});
document.addEventListener('change',e=>{
  if(e.target.id!=='upload')return;
  const next=Array.from(e.target.files);e.target.value='';
  if(selectedFiles.length+next.length>5||next.some(f=>f.size>10*1024*1024||!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type))){notice('Проверьте тип, размер и количество файлов.');return}
  notice('');selectedFiles.push(...next);fileList();
});
document.addEventListener('submit',async e=>{
  if(e.target.id!=='tender')return;e.preventDefault();
  const form=e.target;const values=Object.fromEntries(new FormData(form));
  for(const key of ['description','district']){values[key]=values[key].trim();if(!values[key]){form.elements[key].focus();notice('Заполните поле «'+(key==='district'?'Город или район':'Описание проекта')+'».');return}}
  const btn=form.querySelector('button.primary');btn.disabled=true;
  const parentId=route().params.get('parent');
  const parent=parentId?await records('readonly',s=>s.get(parentId)):null;
  if(parentId&&parent?.winner!==myProfile()?.id){notice('Объект недоступен');btn.disabled=false;return}
  const t={...values,...(parent?{parentId,parentOwner:myProfile().id,requester:{...myProfile()}}:{}),budget:Number(values.budget),created:Date.now(),id:crypto.randomUUID(),files:selectedFiles,winner:null};
  try{await records('readwrite',s=>s.add(t));draft={};selectedFiles=[];channel.postMessage(t.id);location.hash='offers/'+t.id}catch(e){notice(e.message);btn.disabled=false}
});
document.addEventListener('click',async e=>{
  const a=e.target.closest('a,button');if(!a)return;
  if(a.dataset.remove!==undefined){selectedFiles.splice(Number(a.dataset.remove),1);fileList();return}
  if(a.dataset.tab){const r=route();r.params.set('tab',a.dataset.tab);history.replaceState(null,'',location.hash.split('?')[0]+'?'+r.params);await render();screen.querySelector('[aria-pressed=true]')?.focus();return}
  if(a.hash?.startsWith('#profile/')&&route().params.get('tab'))a.hash+='?from='+encodeURIComponent(route().params.get('tab'));
  if(a.dataset.choose!==undefined&&current){
    const i=a.dataset.choose,p=bidById(current,i);
    dialog.innerHTML='<h2>Выбрать исполнителя?</h2><p>'+esc(p.name)+'</p><div class="summary"><b>'+money(p.price)+'</b> · '+esc(p.period)+'<br>'+esc(p.terms)+'</div><p>После подтверждения тендер перейдёт в работу.</p><div class="actions"><button data-cancel>Вернуться</button><button class="primary" data-confirm="'+i+'">Подтвердить выбор</button></div>';dialog.showModal();
  }
  if(a.hasAttribute('data-cancel'))dialog.close();
  if(a.dataset.confirm!==undefined&&current){
    a.disabled=true;const id=current.id,winner=a.dataset.confirm;
    try{await records('readwrite',s=>{const req=s.get(id);req.onsuccess=()=>{if(req.result&&req.result.winner==null)s.put({...req.result,winner})};return req});channel.postMessage(id);dialog.close();location.hash='project/'+id}catch(e){dialog.close();notice(e.message)}
  }
});
window.addEventListener('hashchange',async event=>{if(route().page==='worker'){const prior=new URL(event.oldURL).hash.slice(1);if(!prior.startsWith('worker'))profileReturn=(!myProfile()&&workerPages.includes(prior.split(/[/?]/)[0]))?'list':prior}await render();screen.focus({preventScroll:true});window.scrollTo(0,0)});
await seed(records);
if(!location.hash){try{const existing=await records('readonly',s=>s.count());history.replaceState(null,'',existing?'#list':'#new')}catch{}}
await render();
