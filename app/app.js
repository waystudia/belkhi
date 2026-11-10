import {serviceAreas,servicePlaces} from './service-places.js?v=20261111-1';
import {portfolio} from './portfolio.js?v=20261109-4';
import {crm,progress} from './crm.js';
import {catalog} from './catalog.js';
import {seed} from './demo.js';
import {accountDestination, currentAuth, currentIdentity, isOwner, registrationStep, restoreAuth, watchSession} from './auth.js';
import {accountScreen, demoMode} from './account.js?v=20261109-1';
import {registrationPages, registrationScreen} from './registration.js';
import {accountKey, accountStorage, initializeAccountStorage} from './account-storage.js';
import {moderation} from './moderation.js';
import {icon} from './icons.js?v=20261109-2';
import {isStoredFile, packFile, unpackFile} from './file-storage.js';
import {finishWorkspaceEdit, openWorkspaceLink, replaceWorkspaceParams, replaceWorkspaceRoute, restoreWorkspace, workspaceState} from './workspace-nav.js?v=20261109-2';

let authError;
try { await restoreAuth(); }
catch (error) { authError = error.message; }
if(currentAuth()) sessionStorage.removeItem('belkhi-demo-session');
else if(!authError) sessionStorage.setItem('belkhi-demo-session','1');
initializeAccountStorage();
watchSession();
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
  const request = indexedDB.open(accountKey('belkhi-customer'),1);
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
  const overrides=JSON.parse(accountStorage.getItem('belkhi-firms')||'{}');
  const samples = people.map((base, i) => ({
    ...base,...overrides[i], id:String(i), demo:true,
    price:Math.max(1,Math.round(t.budget*base.factor)),
    period:t.period==='3–5 месяцев'?['4 месяца','3–4 месяца','4 месяца'][i]:t.period==='Указать в описании'?'По условиям тендера':t.period
  }));
  return [...(t.bids || []), ...samples.map(p=>({...p,...t.offerEdits?.[p.id]})).filter(p=>(!p.deleted&&!p.hidden) || String(t.winner)===p.id)];
}
function bidById(t,id){return bids(t).find(p=>p.id===String(id))}
const channel = new BroadcastChannel(accountKey('belkhi-tenders'));
channel.onmessage=({data})=>{
  if(['offers','list','market'].includes(route().page)||(route().page==='sent'&&route().id===data))render();
};
const img = (key,alt='') => '<img src="media/'+encodeURIComponent(key)+'.jpg" alt="'+esc(alt)+'">';
const link=(hash,text,cls='btn')=>'<a class="'+cls+'" href="#'+esc(hash)+'">'+esc(text)+'</a>';
const tabs=(values,current)=>'<div class="tabs">'+values.map(v=>'<button data-tab="'+esc(v)+'" aria-pressed="'+(v===current)+'">'+esc(v)+'</button>').join('')+'</div>';
let selectedFiles=[], draft={}, current, generation=0, urls=[], fileUrls=new WeakMap();
let profileReturn='';
function notice(msg){document.querySelector('#message').textContent=msg}
function objectURL(file){
  if(fileUrls.has(file))return fileUrls.get(file);
  const url=URL.createObjectURL(unpackFile(file));
  urls.push(url);fileUrls.set(file,url);return url;
}
const workerPages=['worker','market','works','crew','apply','sent','crm','manual','buyer'];
const activeProfile=()=>currentAuth() && accountDestination()!=='market'?'customer':'worker';

function bottomNav(page, params){
  const customerMode = activeProfile()==='customer';
  const items = [
    ['market','Лента','home'],
    ['market?view=grid','Поиск','search'],
    ['new','Создать тендер','add'],
    customerMode?['list','Мои объекты','folder']:['works','Работы','helmet'],
    [activeProfile(),'Профиль','person']
  ];
  const active = page==='market' && params.get('view')==='grid' ? 'market?view=grid'
    : ({crm:'works',manual:'works',crew:'works',apply:'market',sent:'works',offers:'list',
      profile:'list',project:'list',customer:activeProfile(),worker:activeProfile(),account:activeProfile(),'activate-worker':activeProfile()})[page] || page;
  const nav=document.querySelector('#bottom-nav'),signature=items.map(item=>item[0]).join('|');
  if(nav.dataset.items!==signature){
    nav.dataset.items=signature;
    nav.innerHTML=items.map(([path,title,symbol])=>'<a href="#'+path+'" aria-label="'+title+'" title="'+title+'">'+icon(symbol)+'<span>'+title+'</span></a>').join('');
  }
  for(const item of nav.querySelectorAll('a')){
    if(item.hash==='#'+active)item.setAttribute('aria-current','page');
    else item.removeAttribute('aria-current');
  }
}
function teamMembers(p){return JSON.parse(accountStorage.getItem('belkhi-team-'+p.id)||'[]')}
function crewScreen(p){
  const members=teamMembers(p);
  show(null,'Моя команда','<p class="muted">Добавьте людей, которых сможете назначать на выигранные объекты.</p>'+members.map(m=>'<div class="stage"><span class="avatar">'+esc(m.name.slice(0,1))+'</span><div><b>'+esc(m.name)+'</b><div class="meta">'+esc(m.job)+'</div></div></div>').join('')+'<form id="crew-form"><label for="member">Имя работника</label><input id="member" name="name" required maxlength="90"><label for="job">Специальность</label><input id="job" name="job" required maxlength="100" placeholder="Например, каменщик"><button class="primary wide">Добавить работника</button></form>');
}
function projectCrew(t,p){
  if(String(t.winner)!==p.id)return '';
  const team=teamMembers(p);
  return '<h3>Работники на объекте</h3><form id="staff-form"><div class="chips">'+team.map(m=>'<label><input type="checkbox" name="member" value="'+m.id+'" '+((t.staff||[]).includes(m.id)?'checked':'')+'> '+esc(m.name)+' · '+esc(m.job)+'</label>').join('')+'</div>'+(team.length?'<button class="wide secondary">Сохранить состав</button>':'<p>Добавьте первого работника в команду.</p>')+'</form>'+link('crew','Моя команда','back');
}
function customerDetails(){
  const p=JSON.parse(accountStorage.getItem('belkhi-customer-profile')||'null') || {name: currentAuth()?.user?.user_metadata?.display_name};
  const username=currentIdentity()?.username;
  return {p,username,savedHandle:username||accountStorage.getItem('belkhi-public-handle/customer')};
}
function customerProfile(){
  const {p,savedHandle}=customerDetails();
  const name=p.name|| (savedHandle?'@'+savedHandle:'Заказчик');
  const type=p.type||'Частный заказчик';
  show(null,'Профиль заказчика',`<section class="customer-overview">
    <div class="customer-identity"><span class="settings-avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</span>
      <div><strong>${esc(name)}</strong>
      ${savedHandle&&name!=='@'+savedHandle?'<small>@'+esc(savedHandle)+'</small>':''}
      <small>${esc([type,p.city].filter(Boolean).join(' · '))}</small></div></div>
    ${p.about?'<p class="customer-about">'+esc(p.about)+'</p>':''}
    <div class="customer-actions">${link('customer?edit=1','Редактировать профиль','btn secondary')}
      ${link('list','Мои объекты','btn')}</div>
  </section>`, 'list');
}
function editCustomerProfile(){
  const {p,username,savedHandle}=customerDetails();
  const handle=savedHandle||'belhi_'+crypto.randomUUID().replaceAll('-','').slice(0,8);
  show(null,'Редактировать профиль','<form id="customer-form" class="customer-settings">'+
    '<section><h3>Основные сведения</h3><label for="customer-name">Имя или название<input id="customer-name" name="name" required maxlength="90" value="'+esc(p.name||'')+'" placeholder="Например, Ахмед или СК Монолит"></label>'+
    '<div class="settings-pair"><label for="customer-type">Тип профиля<select id="customer-type" name="type"><option '+(p.type==='Частный заказчик'?'selected':'')+'>Частный заказчик</option><option '+(p.type==='Компания-заказчик'?'selected':'')+'>Компания-заказчик</option></select></label>'+
    placeField('customer-city','city','Город',p.city)+'</div>'+
    '<label for="customer-handle">Ник профиля<span class="handle-field"><b>@</b><input id="customer-handle" name="handle" required maxlength="30" pattern="[A-Za-z0-9._]{3,30}" '+(username?'readonly ':'')+'value="'+esc(handle)+'"></span><small>'+(username?'@логин аккаунта':'Латиница, цифры, точка или подчёркивание')+'</small></label></section>'+
    '<section><h3>О себе</h3><label for="customer-about">Короткое описание<textarea id="customer-about" name="about" maxlength="500" rows="3" placeholder="Расскажите, какие объекты вы строите и что для вас важно">'+esc(p.about||'')+'</textarea></label></section>'+
    '<div class="privacy-note"><strong>Ваши данные защищены</strong><span>До выбора исполнителя участники тендера не видят имя, профиль и контакты заказчика.</span></div>'+
    '<button class="primary wide">Сохранить изменения</button></form>','customer');
  bindPlacePicker(document.querySelector('#customer-city-picker'));
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
        accountStorage.setItem('belkhi-customer-profile',JSON.stringify({name,type:data.get('type'),city:data.get('city').trim(),about:data.get('about').trim()}));
        accountStorage.setItem('belkhi-public-handle/customer',handle);
      }
      else{
        const p=myProfile(),job=data.get('job').trim();
        if(!job)throw Error('Укажите специальность.');
        accountStorage.setItem('belkhi-team-'+p.id,JSON.stringify([...teamMembers(p),{id:crypto.randomUUID(),name,job}]));
      }
    }
    if(id==='customer-form'){if(!finishWorkspaceEdit('#customer'))await render();return}
    await render();notice('Сохранено');
  }catch(error){notice(error.message)}
});

function show(step,title,body,back=''){
  const workerMode=workerPages.includes(route().page);
  const {page,params}=route();
  bottomNav(page,params);
  const steps=workerMode?['Мой профиль','Доступные заявки','Отклик на заявку','Мой отклик']:roles;
  document.querySelector('.head>span').textContent=document.body.dataset.surface==='admin'?'Администрирование':'Мой кабинет';
  document.querySelector('.rail small').textContent='БЕЛХИ';
  document.querySelector('.rail h2').textContent='От заявки до стройки';
  const toggle=document.querySelector('#switch-role');
  toggle.hidden=!currentAuth() || page==='worker';
  toggle.textContent=currentAuth()?'Аккаунт':'Войти';
  toggle.href=currentAuth()?'#account':'#login';
  document.querySelector('.brand').href=currentAuth()?'#'+accountDestination():demoMode()?'#market':'#login';
  document.querySelector('#bottom-nav').hidden=document.body.dataset.surface!=='app';
  document.querySelector('#workspace-saved').hidden=document.body.dataset.surface!=='app';
  const heading=back
    ? '<div class="screen-heading"><a href="#'+esc(back)+'" aria-label="Назад" title="Назад"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg></a><h1>'+esc(title)+'</h1></div>'
    : '<h1>'+esc(title)+'</h1>';
  screen.dataset.page=page;
  screen.innerHTML=heading+body;
  document.querySelector('#steps').innerHTML=steps.map((v,i)=>'<li class="'+(i===step?'active':'')+'"><span class="num">'+(i+1)+'</span>'+v+'</li>').join('');
  document.title=title+' · Белхи';
}
function form(){
  const options=(values,value)=>values.map(v=>'<option '+(v===value?'selected':'')+'>'+esc(v)+'</option>').join('');
  show(0,'Создание тендера',`<form id="tender">
    <section class="tender-attachments" aria-labelledby="attachments-title">
      <div class="tender-attachment-head"><div><h2 id="attachments-title">Фото и чертежи</h2><p>До 5 файлов JPEG, PNG, WebP или PDF, до 10 МБ каждый.</p></div>
      <input class="hiddenfile" id="upload" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple>
      <label class="attach" for="upload">${icon('add')} Добавить файл</label></div>
      <div id="files"></div>
    </section>
    <label for="kind">Тип работ<select id="kind" name="kind">${options(kinds,draft.kind)}</select></label>
    <label for="description">Описание проекта<textarea id="description" name="description" maxlength="3000" required placeholder="Например, нужны фундамент, коробка и кровля.">${esc(draft.description||'')}</textarea></label>
    ${placeField('district','district','Город или район',draft.district,true)}
    <div class="pair">
      <label for="budget">Бюджет, ₽<input id="budget" name="budget" type="number" inputmode="numeric" min="1" max="100000000000" required placeholder="3 000 000" value="${esc(draft.budget||'')}"></label>
      <label for="period">Срок выполнения<select id="period" name="period">${options(durations,draft.period||'3–5 месяцев')}</select></label>
    </div>
    <button class="primary wide">Создать тендер</button><p class="caption">Тендер сохранится на этом устройстве. Для сравнения появятся демонстрационные отклики.</p>
  </form>`,'list');
  bindPlacePicker(document.querySelector('#district-picker'));
  fileList();
}
function fileList(){
  document.querySelector('#files').innerHTML=selectedFiles.map((file,index)=>`<div class="file">
    ${file.type.startsWith('image/')?'<img src="'+esc(objectURL(file))+'" alt="">':''}
    <span>${esc(file.name)}</span><button type="button" data-remove="${index}" aria-label="Удалить ${esc(file.name)}">×</button>
  </div>`).join('');
}

function customerBadge(t){
  if(!t.owner)return '';
  const record=readLocal('belkhi-customers',{})[t.owner];
  if(record?.deleted)return '';
  return '<span class="customer-badge">'+img(['maria','ivan','musa'].includes(t.owner)?t.owner:'man')+'<span>'+esc(record?.name||t.customer)+'</span></span>';
}
function offers(t,filter){
  const types={'Компании':'Строительная компания','Мастера':'Частный мастер'};
  if(filter==='Бригады')filter='Компании';
  const all=bids(t), list=all.filter(p=>filter==='Все'||workerType(p.type)===types[filter]);
  const filters=['Все',...Object.keys(types)].map(name=>
    '<button data-tab="'+name+'" aria-pressed="'+(name===filter)+'">'+name+'</button>'
  ).join('');
  const photo=t.files?.find(file=>isStoredFile(file) && file.type.startsWith('image/'));
  const cover=photo?'<img src="'+objectURL(photo)+'" alt="Фото объекта">':t.id==='demo-3' && t.photo==='site' && t.description?.includes('10 × 8')?'<img src="media/foundation-plan.svg" alt="Схема ленточного основания 10 на 8 метров">':t.photo?img(t.photo,'Фото объекта'):'';
  const post=`<article class="tender-post">
    <div class="post-heading"><strong>${esc(t.kind)}</strong><small>${esc(t.district)}</small></div>
    ${cover}<div class="post-caption"><dl class="post-spec"><div><dt>Бюджет</dt><dd>до ${money(t.budget)}</dd></div><div><dt>Срок работ</dt><dd>${esc(t.period)}</dd></div></dl>
    ${t.description?'<p>'+esc(t.description)+'</p>':''}</div></article>`;
  const cards=list.map(p=>`<article class="entry offer-row">${avatar(p)}<div><strong>${esc(p.name)}</strong>
    <small>${p.demo?'<b class="score">★ '+esc(p.rating)+'</b> · ':''}${esc(workerType(p.type))}${p.demo?' · Демо':''}</small>
    <div class="offer-foot"><div><b>${money(p.price)}</b><small>${esc(p.period)}</small></div>
    ${link('profile/'+t.id+'/'+encodeURIComponent(p.id),'Посмотреть','btn primary')}</div></div></article>`).join('');
  show(1,'Отклики на тендер',post+'<h3 class="responses-title">Отклики <small>'+all.length+'</small></h3><div class="offer-filters">'+filters+'</div>'+ (cards||'<p class="muted">Таких откликов пока нет.</p>'),'list');
}
function avatar(p){return p.demo?img(p.photo):'<span class="avatar">'+esc(p.name.trim().slice(0,1))+'</span>'}
async function profile(t,p,tab,filter){
  const live=myProfile();
  const person=live?.id===p.id?live:{...p,type:workerType(p.type)};
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
  if(!accountStorage.getItem(key))accountStorage.setItem(key,crypto.randomUUID());
  return accountStorage.getItem(key);
}
function myProfile(){
  const p=JSON.parse(accountStorage.getItem(profileKey)||'null');
  return p && {...p,type:workerType(p.type),handle:currentIdentity()?.username||p.handle,teamSize:teamMembers(p).length+1};
}
function workerType(type){return ['Бригада','Компания'].includes(type)?'Строительная компания':type}
function workerEnabled(){
  const auth=currentAuth();
  const data=auth?.user?.user_metadata;
  return !auth || data?.belkhi_worker_enabled===true || data?.belkhi_starting_mode==='worker' || Boolean(myProfile());
}
const searchKey=value=>value.trim().toLocaleLowerCase('ru').replaceAll('ё','е');
const splitPlaces=value=>value.split(/[,;\n]+/).map(item=>item.trim()).filter(Boolean);
const uniqueLabels=skills=>[...new Map(skills.filter(Boolean).map(skill=>[searchKey(skill),skill])).values()];

function placeField(id,name,label,value='',required=false){
  return `<div id="${id}-picker" class="worker-picker place-field">
    <label for="${id}">${label}</label>
    <div class="worker-search">${icon('search')}<input id="${id}" name="${name}" type="search"
      maxlength="100" autocomplete="off" placeholder="Найти город или район"
      aria-controls="${id}-results" value="${esc(value)}" ${required?'required':''}></div>
    <div id="${id}-results" class="worker-suggestions" hidden></div>
    <p class="worker-picker-note" role="status"></p>
  </div>`;
}

function bindPlacePicker(picker,{excluded=()=>[],select}={}){
  const input=picker.querySelector('input[type="search"]');
  const results=picker.querySelector('.worker-suggestions');
  const note=picker.querySelector('.worker-picker-note');
  const placeKey=value=>searchKey(value).replace(/[\s‐‑–—-]+/g,' ');
  const suggest=()=>{
    const query=placeKey(input.value);
    const chosen=new Set(excluded().map(placeKey));
    const options=query?servicePlaces.filter(place=>placeKey(place).startsWith(query)&&!chosen.has(placeKey(place))):[];
    results.innerHTML=options.map(place=>'<button type="button" data-place="'+esc(place)+'">'+esc(place)+'</button>').join('');
    results.hidden=!options.length;
    note.textContent=query&&!options.length?(select?'Нет новых совпадений. Попробуйте другое название.':'В списке нет совпадений. Можно оставить введённое название.'):'';
  };
  input.oninput=input.onfocus=suggest;
  picker.addEventListener('focusout',event=>{
    if(!picker.contains(event.relatedTarget))results.hidden=true;
  });
  picker.onkeydown=event=>{
    if(event.key==='Escape'&&!results.hidden){
      event.preventDefault();
      input.focus();
      results.hidden=true;
    }
    if(event.target!==input||results.hidden||!['ArrowDown','Enter'].includes(event.key))return;
    event.preventDefault();
    const buttons=results.querySelectorAll('button');
    if(event.key==='Enter'&&buttons.length===1)buttons[0].click();
    else buttons[0]?.focus();
  };
  results.onclick=event=>{
    const option=event.target.closest('[data-place]');
    if(!option)return;
    const place=option.dataset.place;
    if(select){
      if(select(place)===false)return;
    }else{
      input.value=place;
      input.dispatchEvent(new Event('input',{bubbles:true}));
    }
    input.focus();
    results.hidden=true;
    note.textContent='';
  };
}

function bindWorkerPickers(){
  const bindTags=(picker,field,read,serialize)=>{
    const input=picker.querySelector('input:not([type="hidden"])');
    const stored=picker.querySelector('input[name="'+field+'"]');
    const tags=picker.querySelector('.worker-picked');
    const note=picker.querySelector('.worker-picker-note');
    const selected=read(stored.value);
    const paint=()=>{
      stored.value=serialize(selected);
      tags.innerHTML=selected.map((item,index)=>'<button type="button" data-remove-tag="'+index+
        '" aria-label="Убрать '+esc(item)+'">'+esc(item)+' <span aria-hidden="true">×</span></button>').join('');
    };
    tags.onclick=event=>{
      const button=event.target.closest('[data-remove-tag]');
      if(!button)return;
      selected.splice(Number(button.dataset.removeTag),1);
      note.textContent='';
      paint();
      input.focus();
    };
    paint();
    return {input,selected,note,paint};
  };
  const geo=document.querySelector('#worker-area-picker');
  const areas=bindTags(geo,'areas',splitPlaces,items=>items.join(', '));
  bindPlacePicker(geo,{
    excluded:()=>areas.selected,
    select(place){
      if([...areas.selected,place].join(', ').length>240){
        areas.note.textContent='Список мест слишком длинный. Уберите одно из выбранных.';
        return false;
      }
      areas.selected.push(place);
      areas.input.value='';
      areas.paint();
    }
  });

  const custom=document.querySelector('#worker-skill-picker');
  const skills=bindTags(custom,'custom_skills',JSON.parse,JSON.stringify);
  const toggle=document.querySelector('#worker-skill-toggle');
  const editor=custom.querySelector('#worker-skill-editor');
  const editorState=custom.querySelector('[name="skill_editor_open"]');
  toggle.onclick=()=>{
    const open=editor.hidden;
    editor.hidden=!open;
    editorState.value=open?'1':'0';
    toggle.setAttribute('aria-expanded',String(open));
    if(open)skills.input.focus();
  };
  const addSkill=()=>{
    const skill=skills.input.value.trim().replace(/\s+/g,' ');
    if(!skill)return;
    const standard=kinds.find(kind=>searchKey(kind)===searchKey(skill));
    if(standard){
      const checkbox=[...custom.closest('fieldset').querySelectorAll('input[name="skills"]')].find(field=>field.value===standard);
      checkbox.checked=true;
    }else if(!skills.selected.some(item=>searchKey(item)===searchKey(skill))){
      if(skills.selected.length>=12){skills.note.textContent='Можно добавить до 12 своих специализаций.';return}
      skills.selected.push(skill);
      skills.paint();
    }
    skills.input.value='';
    skills.note.textContent='Добавлено: '+skill;
    skills.input.focus();
  };
  custom.querySelector('.worker-custom button').onclick=addSkill;
  skills.input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();addSkill()}};
}

function editProfile(p={}){
  const name=p.name||'Исполнитель';
  const types=[['Частный мастер','person'],['Строительная компания','home']];
  const draft=workspaceState()?.draft;
  const values=new URLSearchParams(draft?.id==='worker-profile'?draft.values:[]);
  const places=values.has('city')||!values.has('areas')
    ?uniqueLabels([values.get('city')??p.city,...splitPlaces(values.get('areas')??p.areas??'')]).join(', ')
    :values.get('areas');
  const customSkills=(p.skills||[]).filter(skill=>!kinds.includes(skill));
  const skillEditorOpen=values.get('skill_editor_open')==='1';
  show(null,'Настройки профиля',`<form id="worker-profile">
    <div class="worker-editor-identity">
      <span class="settings-avatar" aria-hidden="true">${esc(name.slice(0,1).toUpperCase())}</span>
      <div><strong>${esc(name)}</strong><small>Профиль исполнителя</small></div>
    </div>
    <section aria-labelledby="work-identity">
      <h2 id="work-identity">Основные сведения</h2>
      <label>Имя или название команды<input id="work-name" name="name" maxlength="90" required value="${esc(p.name||'')}"></label>
      <fieldset class="worker-formats">
        <legend>Формат работы</legend>
        <div>${types.map(([type,symbol])=>`<label><input type="radio" name="type" value="${type}" ${(p.type||types[0][0])===type?'checked':''}>${icon(symbol)}<span>${type}</span></label>`).join('')}</div>
      </fieldset>
      <label>О себе<textarea id="work-about" name="about" rows="2" maxlength="1500" placeholder="Расскажите о вашем опыте и работах">${esc(p.about||'')}</textarea></label>
    </section>
    <section aria-labelledby="work-location">
      <h2 id="work-location">География и стаж</h2>
      <div id="worker-area-picker" class="worker-picker">
        <label for="work-areas">Города и районы работы</label>
        <div class="worker-search">${icon('search')}<input id="work-areas" name="area_query" type="search" maxlength="100" autocomplete="off" placeholder="Найти город или район" aria-controls="worker-area-results"></div>
        <input type="hidden" name="areas" value="${esc(places)}">
        <div id="worker-area-results" class="worker-suggestions" hidden></div>
        <div class="worker-picked" role="group" aria-label="Выбранные места"></div>
        <p class="worker-picker-note" role="status"></p>
      </div>
      <label class="worker-years">Стаж, лет<input id="work-years" type="number" inputmode="numeric" min="0" max="100" name="years" value="${esc(p.years??'')}"></label>
    </section>
    <fieldset class="specialties">
      <legend>Специализация</legend>
      <div class="chips">${kinds.map(kind=>`<label><input type="checkbox" name="skills" value="${esc(kind)}" ${p.skills?.includes(kind)?'checked':''}> ${esc(kind)}</label>`).join('')}
        <button id="worker-skill-toggle" type="button" aria-expanded="${skillEditorOpen}" aria-controls="worker-skill-editor">${icon('add')} Другая специальность</button>
      </div>
      <div id="worker-skill-picker" class="worker-picker">
        <div id="worker-skill-editor" ${skillEditorOpen?'':'hidden'}>
          <label for="work-custom-skill">Название специальности</label>
          <div class="worker-custom"><input id="work-custom-skill" name="skill_query" maxlength="60" placeholder="Например, сварочные работы"><button type="button" aria-label="Добавить специализацию">${icon('add')}</button></div>
        </div>
        <input type="hidden" name="skill_editor_open" value="${skillEditorOpen?'1':'0'}">
        <input type="hidden" name="custom_skills" value="${esc(values.get('custom_skills')??JSON.stringify(customSkills))}">
        <div class="worker-picked" role="group" aria-label="Добавленные специализации"></div>
        <p class="worker-picker-note" role="status"></p>
      </div>
    </fieldset>
    <button class="primary wide">Сохранить профиль</button>
  </form>`,'worker');
  bindWorkerPickers();
}
function myBid(t,p){return (t.bids||[]).find(b=>b.id===p.id)}
const marketCategories=[
  ['Фундамент','site','Фундамент'], ['Строительство дома','house','Строительство'],
  ['Кровля','roof','Кровля'], ['Отделочные работы','room','Отделка'], ['Электромонтаж',null,'Электрика']
];
const savedTab='Сохранённые';
const savedTenders=()=>new Set(readLocal('belkhi-saved-tenders',[]));
const detailRoute=(t,p)=>'#'+(myBid(t,p)?'sent/':'apply/')+encodeURIComponent(t.id);
function tenderMedia(t){
  const files=(t.files||[]).filter(isStoredFile).map(file=>({
    url:objectURL(file),name:file.name,image:file.type.startsWith('image/')
  }));
  if(t.photo)files.unshift({url:'media/'+encodeURIComponent(t.photo)+'.jpg',name:'Фото объекта',image:true});
  if(t.id==='demo-3' && t.description?.includes('10 × 8')){
    files.push({url:'media/foundation-plan.svg',name:'Схема основания',image:true});
  }
  return files;
}
function feedPost(t,p,saved){
  const target=detailRoute(t,p), own=myBid(t,p);
  const files=tenderMedia(t);
  const media=files.map((file,index)=>`<a class="feed-slide" href="${esc(target)}" data-view-key="${esc(t.id+'/'+index)}" aria-label="${esc(t.kind+' · '+file.name)}">
    ${file.image?'<img loading="lazy" src="'+esc(file.url)+'" alt="'+esc(file.name)+'">':'<strong>Документ заказчика</strong>'}
    ${files.length>1?'<span class="media-position">'+(index+1)+' / '+files.length+'</span>':''}</a>`).join('');
  return `<article class="feed-post">
    <div class="post-heading"><span class="feed-subject-icon">${icon('tools')}</span><div><a href="${esc(target)}"><strong>${esc(t.kind)}</strong></a><small>${esc(t.district)}${t.demo?' · Демо':''}${t.winner!=null?' · Закрыт':''}</small></div></div>
    ${media?'<div class="feed-cover feed-gallery" data-gallery="'+esc(t.id)+'">'+media+'</div>':''}
    <div class="feed-caption">
      <div class="feed-toolbar"><a href="${esc(target)}" class="feed-details-link">${own?'Мой отклик':'Открыть тендер'} ${icon('arrow')}</a>
      <button class="workspace-icon bookmark" type="button" data-save-tender="${esc(t.id)}" aria-label="Сохранить тендер" aria-pressed="${saved}">${icon('bookmark')}</button></div>
      <dl class="post-spec"><div><dt>Бюджет</dt><dd>${money(t.budget)}</dd></div><div><dt>Срок</dt><dd>${esc(t.period)}</dd></div><div><dt>Отклики</dt><dd>${bids(t).length}</dd></div></dl>
      ${t.description?'<p>'+esc(t.description)+'</p>':''}
    </div></article>`;
}
function marketTile(t,p){
  const cover=tenderMedia(t).find(file=>file.image);
  return `<a class="market-tile" href="${esc(detailRoute(t,p))}"><span class="market-tile-media">
    ${cover?'<img loading="lazy" src="'+esc(cover.url)+'" alt="">':icon('tools')}
    ${t.demo?'<small>Демо</small>':''}</span>
    <strong>${esc(t.kind)}</strong><span>${esc(t.district)}</span><b>${money(t.budget)}</b></a>`;
}
function tenderRow(t, target, status, ownerVisible=false){
  const attachment=t.files?.find(f=>isStoredFile(f) && f.type.startsWith('image/'));
  const thumb=attachment?'<img src="'+objectURL(attachment)+'" alt="">':t.photo?img(t.photo,''):'<span class="tender-placeholder" aria-hidden="true">⌂</span>';
  return '<a class="tender-card" href="#'+esc(target)+'">'+thumb+'<div class="tender-details"><strong>'+esc(t.kind)+'</strong><span class="meta">'+esc(t.district)+' · '+esc(t.period)+'</span><div class="tender-price"><b>'+money(t.budget)+'</b><span class="tag">'+esc(status)+'</span></div>'+(ownerVisible?customerBadge(t):'')+'</div></a>';
}
function matchesTerritory(location,selected,region){
  const key=value=>searchKey(value||'').replace(/^(?:г\.|с\.|п\.|город|село|пос[её]лок|станица)\s*/,'').replace(/[\s‐‑–—-]+/g,' ');
  const actual=key(location);
  if(actual===key(selected))return true;
  const place=serviceAreas.find(place=>key(place.name)===actual);
  if(!place)return false;
  return selected===region||key(place.district)===key(selected);
}

function market(tenders,p,params){
  const grid=params.get('view')==='grid';
  const filter=params.get('tab')||(p.skills.length&&!grid?'По специальности':'Все');
  const saved=savedTenders();
  const available=tenders.filter(t=>!t.manual && (myBid(t,p) || ((t.demo||t.owner) && t.parentOwner!==p.id)));
  const relevant=available.filter(t=>{
    if(filter==='Мои отклики')return myBid(t,p);
    if(filter===savedTab)return saved.has(t.id);
    return t.winner==null && (filter==='Все' || p.skills.includes(t.kind));
  }).sort((a,b)=>b.created-a.created);
  const choices=key=>[...new Set(available.map(t=>t[key]).filter(Boolean))].sort();
  const region='Чеченская Республика';
  const geoTypes=[['region','Республика'],['district','Районы'],['city','Города'],['village','Сёла']];
  const areaNames=new Set(servicePlaces);
  const geoOptions=[{name:region,type:'region',district:''},...serviceAreas,
    ...choices('district').filter(name=>!areaNames.has(name)).map(name=>({name,type:'city',district:''}))];
  const filters=`<form id="feed-filter">
    <div class="market-search-field">${icon('search')}<input type="search" name="query" id="tender-search" aria-label="Поиск объектов" placeholder="Город, вид работ или объект"></div>
    <button type="button" class="workspace-icon" id="filter-open" aria-haspopup="dialog" aria-label="Фильтры">${icon('filter')}<small hidden></small></button>
    <dialog id="market-panel" aria-labelledby="filter-title">
      <div class="market-panel-head"><h3 id="filter-title">Фильтры</h3><button type="button" class="workspace-icon" id="filter-close" aria-label="Закрыть фильтры">×</button></div>
      <div class="market-panel-content">
      <fieldset class="market-geography"><legend>Где искать работу</legend>
        <div class="market-geo-types" role="group" aria-label="Тип территории">
          ${geoTypes.map(([type,title])=>`<label><input type="radio" name="geo_type" value="${type}" ${type==='region'?'checked':''}><span>${title}</span></label>`).join('')}
        </div>
        <div class="worker-search">${icon('search')}<input type="search" name="geo_query" aria-label="Найти территорию" placeholder="Название города, села или района" autocomplete="off"></div>
        <div id="filter-selected" class="worker-picked" role="group" aria-label="Выбранные территории"></div>
        <div class="market-geo-options" role="group" aria-label="Список территорий">
          ${geoOptions.map(place=>`<label data-geo-type="${place.type}"><input type="checkbox" name="city" value="${esc(place.name)}" aria-label="${esc(place.name)}"><span><strong>${esc(place.name)}</strong><small>${esc(place.type==='region'?'Все населённые пункты республики':place.type==='district'?'Район · Чеченская Республика':place.district||({city:'Город',district:'Район',village:'Сельский населённый пункт'})[place.type])}</small></span></label>`).join('')}
        </div>
        <p id="filter-geo-empty" class="form-note" hidden>Ничего не найдено. Попробуйте другое название.</p>
      </fieldset>
      <fieldset class="market-work-kinds"><legend>Тип работ</legend><div class="chips">
        ${['',...new Set([...kinds,...choices('kind')])].map(kind=>`<label><input type="radio" name="kind" value="${esc(kind)}" ${!kind?'checked':''}>${esc(kind||'Все работы')}</label>`).join('')}
      </div></fieldset>
      <div class="pair"><label>Бюджет от, ₽<input name="min" type="number" min="0" inputmode="numeric" placeholder="От"></label><label>До, ₽<input name="max" type="number" min="0" inputmode="numeric" placeholder="До"></label></div>
      </div>
      <div class="filter-actions"><button type="reset">Сбросить</button><button type="button" class="primary" id="filter-done">Показать тендеры</button></div>
    </dialog></form>`;
  const categories='<div class="round-shortcuts market-categories" data-gallery="market-categories" aria-label="Виды работ">'+
    marketCategories.map(([kind,photo,title])=>`<button type="button" data-kind="${kind}" aria-pressed="false">
      <span class="shortcut-circle">${photo?img(photo):icon('tools')}</span><span>${title}</span></button>`).join('')+'</div>';
  const modes=[['Все','Все'],['По специальности','Подходящие'],['Мои отклики','Мои отклики']];
  const switcher=filter===savedTab?'':'<div class="market-modes" aria-label="Лента тендеров">'+modes.map(([value,label])=>
    `<button data-tab="${value}" aria-pressed="${filter===value}">${label}</button>`).join('')+'</div>';
  const profileHint=!grid&&filter!==savedTab&&accountDestination()==='market'&&workerEnabled()&&!myProfile()
    ? '<p class="market-profile-hint">Готовы откликаться? '+link('worker?edit=1','Заполнить профиль','back')+'</p>' : '';
  show(1,filter===savedTab?savedTab:grid?'Поиск тендеров':'Тендеры',filters+categories+switcher+profileHint+
    '<div id="results" class="'+(grid?'market-grid':'market-stream')+'"></div>');
  screen.dataset.marketView=filter===savedTab?'saved':grid?'grid':'feed';
  const form=screen.querySelector('#feed-filter');
  const panel=form.querySelector('#market-panel');
  const opener=form.querySelector('#filter-open');
  const resultsNode=screen.querySelector('#results');
  const chips=[...screen.querySelectorAll('[data-kind]')];
  const restored=new FormData();
  for(const [key,value] of workspaceState()?.filters||[])restored.append(key,value);
  for(const control of form.querySelectorAll('[name]')){
    if(['checkbox','radio'].includes(control.type)){if(restored.has(control.name))control.checked=restored.getAll(control.name).includes(control.value);}
    else if(restored.has(control.name))control.value=restored.get(control.name);
  }
  opener.onclick=()=>panel.showModal();
  form.querySelector('#filter-done').onclick=form.querySelector('#filter-close').onclick=()=>panel.close();
  const geography=[...panel.querySelectorAll('[data-geo-type]')];
  const selected=panel.querySelector('#filter-selected');
  selected.onclick=event=>{
    const button=event.target.closest('[data-remove-place]');
    if(!button)return;
    const field=geography.map(row=>row.querySelector('input')).find(field=>field.value===button.dataset.removePlace);
    field.checked=false;
    results();
    panel.querySelector('[name="geo_query"]').focus();
  };
  function results(){
    const values=new FormData(form);
    const query=String(values.get('query')).trim().toLocaleLowerCase('ru');
    const cities=values.getAll('city');
    const kind=values.get('kind');
    const geoQuery=searchKey(String(values.get('geo_query')||'')).replace(/[\s‐‑–—-]+/g,' ');
    const geoType=values.get('geo_type')||'region';
    let geoCount=0;
    for(const row of geography){
      const matches=row.dataset.geoType===geoType&&(!geoQuery||
        searchKey(row.querySelector('input').value).replace(/[\s‐‑–—-]+/g,' ').includes(geoQuery));
      row.hidden=!matches;
      if(matches)geoCount++;
    }
    panel.querySelector('#filter-geo-empty').hidden=geoCount>0;
    selected.innerHTML=cities.map(city=>'<button type="button" data-remove-place="'+esc(city)+'" aria-label="Убрать '+esc(city)+'">'+esc(city)+' <span aria-hidden="true">×</span></button>').join('');
    const count=cities.length+['kind','min','max'].filter(key=>values.get(key)).length;
    opener.setAttribute('aria-label',count?'Фильтры, выбрано '+count:'Фильтры');
    opener.querySelector('small').hidden=!count;
    opener.querySelector('small').textContent=count;
    for(const chip of chips)chip.setAttribute('aria-pressed',String(chip.dataset.kind===kind));
    const visible=relevant.filter(t=>(filter!==savedTab||saved.has(t.id))&&
      (!cities.length||cities.some(city=>matchesTerritory(t.district,city,region)))&&(!kind||t.kind===kind)&&
      (!values.get('min')||Number(t.budget)>=Number(values.get('min')))&&
      (!values.get('max')||Number(t.budget)<=Number(values.get('max')))&&
      [t.kind,t.district,t.description].join(' ').toLocaleLowerCase('ru').includes(query));
    form.querySelector('#filter-done').textContent='Показать тендеры · '+visible.length;
    resultsNode.innerHTML=visible.map(t=>{
      if(grid)return marketTile(t,p);
      if(t.winner==null||filter===savedTab)return feedPost(t,p,saved.has(t.id));
      const own=myBid(t,p);
      const status=!own?'Тендер закрыт':String(t.winner)===own.id?'Вас выбрали':'Выбран другой исполнитель';
      return tenderRow(t,detailRoute(t,p).slice(1),status);
    }).join('')||'<p class="market-empty">'+(filter===savedTab&&!saved.size?'Здесь появятся тендеры, которые вы сохранили.':
      filter==='Мои отклики'&&!relevant.length?'Здесь появятся ваши предложения по тендерам.':
      'Тендеры не найдены. Попробуйте другой запрос или измените фильтры.')+'</p>';
  }
  for(const chip of chips)chip.onclick=()=>{
    const next=form.elements.kind.value===chip.dataset.kind?'':chip.dataset.kind;
    for(const radio of form.querySelectorAll('[name="kind"]'))radio.checked=radio.value===next;
    results();
  };
  resultsNode.onclick=event=>{
    const button=event.target.closest('[data-save-tender]');
    if(!button)return;
    const id=button.dataset.saveTender;
    if(saved.has(id))saved.delete(id);else saved.add(id);
    writeLocal('belkhi-saved-tenders',[...saved]);
    if(filter===savedTab&&!saved.has(id)){results();screen.focus({preventScroll:true})}
    else button.setAttribute('aria-pressed',String(saved.has(id)));
  };
  form.oninput=results;
  form.onreset=()=>setTimeout(results,0);
  form.onsubmit=event=>event.preventDefault();
  results();
}
async function workerScreen(page,id,params,seq){
  const savedProfile=myProfile();
  const p=savedProfile||{id:portfolioOwner(),name:currentAuth()?.user?.user_metadata?.display_name||'Исполнитель',handle:currentIdentity()?.username,skills:[]};
  if(page==='worker'){
    if(!workerEnabled()){
      const tender=params.get('tender');
      replaceWorkspaceRoute('#activate-worker'+(tender&&/^[a-z0-9-]+$/i.test(tender)?'?tender='+tender:''));
      await render();
      return;
    }
    if(params.has('edit'))editProfile(savedProfile || {name: currentAuth()?.user?.user_metadata?.display_name});
    else await portfolio(p,p.id,true,portfolioUI,'',profileReturn||'market');
    return;
  }
  if(page==='manual'){
    show(null,'Новый объект',`<form id="manual-project">
      <p class="form-note">Свой заказ в разделе «Работы». Этапы добавите после создания.</p>
      <label>Название объекта<input name="kind" placeholder="Например, дом из кирпича" required maxlength="100"></label>
      ${placeField('manual-district','district','Город или район','',true)}
      <div class="project-terms">
        <label>Бюджет, ₽<input type="number" inputmode="numeric" name="budget" min="1" placeholder="350 000" required></label>
        <label>Срок работ<input name="period" placeholder="3 недели" required maxlength="80"></label>
      </div>
      <button class="primary" type="submit">Создать объект</button>
    </form>`,'works');
    bindPlacePicker(document.querySelector('#manual-district-picker'));
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
  if(page==='crm'){if(t.winner!==p.id){location.replace('#works');return}crm(t,p,{esc,show,link,teamMembers,records,render,notice,channel,objectURL});
    const children=(await records('readonly',s=>s.getAll())).filter(child=>child.parentId===t.id);
    if(seq!==generation)return;
    screen.insertAdjacentHTML('beforeend','<h3>Субподряд</h3>'+link('new?parent='+encodeURIComponent(t.id),'＋ Нанять на часть работ','btn secondary pill')+children.map(child=>tenderRow(child,(child.winner==null?'offers/':'project/')+child.id,child.winner==null?'Сравнить отклики · '+bids(child).length:'В работе')).join(''));return}
  const own=myBid(t,p);
  const attachments=tenderMedia(t);
  const cover=attachments.find(file=>file.image);
  const requestCard='<article class="apply-request">'+
    (cover?'<div class="apply-cover"><img src="'+esc(cover.url)+'" alt="'+esc(cover.name)+'"></div>':'')+
    '<div class="apply-request-body"><div class="apply-request-head"><div><h2>'+esc(t.kind)+'</h2><span>'+esc(t.district)+'</span></div><span class="tag">'+(t.winner==null?'Приём откликов':'Закрыт')+'</span></div>'+
    '<dl class="apply-facts"><div><dt>Бюджет заказчика</dt><dd>'+money(t.budget)+'</dd></div><div><dt>Желаемый срок</dt><dd>'+esc(t.period)+'</dd></div><div><dt>Откликов</dt><dd>'+bids(t).length+'</dd></div></dl>'+
    '<p class="apply-description">'+esc(t.description||'Описание работ не указано.')+'</p></div></article>';
  const intro=requestCard;
  if(own){
    const status=t.winner==null?'Отклик отправлен':String(t.winner)===own.id?'Заказчик выбрал вас':'Выбран другой исполнитель';
    show(3,status,intro+'<h3>Ваше предложение</h3><b class="amount">'+money(own.price)+'</b> · '+esc(own.period)+'<p>'+esc(own.terms)+'</p>'+(String(t.winner)===p.id?link('crm/'+t.id,'Открыть объект в CRM','btn primary'):'')+projectCrew(t,p)+link('market?tab='+encodeURIComponent('Мои отклики'),'Мои отклики','btn secondary'),'market');return
  }
  if(t.winner!=null){show(2,'Тендер закрыт',intro+'<p>Заказчик уже выбрал исполнителя.</p>','market');return}
  const materials=attachments.length>1||attachments.some(file=>!file.image)
    ? '<details class="fold apply-files"><summary>Материалы заказчика</summary><div>'+
      attachments.map(file=>'<a class="project" href="'+esc(file.url)+'" target="_blank" rel="noopener">'+esc(file.name)+'</a>').join('')+'</div></details>'
    : '';
  if(!savedProfile){
    const enabled=workerEnabled();
    show(2,'Тендер',requestCard+materials+'<div class="tender-next"><p>Для отклика понадобится профиль исполнителя.</p>'+
      link((enabled?'worker?edit=1&tender=':'activate-worker?tender=')+encodeURIComponent(id),
        enabled?'Заполнить профиль':'Стать исполнителем','btn primary')+'</div>','market');
    return;
  }
  const performer='<div class="bid-profile">'+avatar(p)+'<div><small>Отклик от</small><strong>'+esc(p.name)+'</strong><span>'+esc([p.type,p.city].filter(Boolean).join(' · '))+'</span></div>'+link('worker?edit=1','Изменить профиль','btn secondary')+'</div>';
  show(2,'Отклик на заявку',requestCard+materials+
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
      if(!workerEnabled())return;
      const query=value('skill_query').replace(/\s+/g,' ');
      const pendingSkill=kinds.find(kind=>searchKey(kind)===searchKey(query))||query;
      const skills=uniqueLabels([...data.getAll('skills'),...JSON.parse(value('custom_skills')),pendingSkill]);
      if(value('area_query'))throw Error('Выберите город или район из подсказок либо очистите поиск.');
      if(skills.filter(skill=>!kinds.some(kind=>searchKey(kind)===searchKey(skill))).length>12)throw Error('Можно добавить до 12 своих специализаций.');
      const [city]=splitPlaces(value('areas'));
      if(!skills.length||!value('name')||!city)throw Error('Укажите имя, место работы и хотя бы одну специальность.');
      accountStorage.setItem(profileKey,JSON.stringify({id:myProfile()?.id||portfolioOwner(),name:value('name'),city,years:value('years'),areas:value('areas'),about:value('about'),type:workerType(value('type'))||'Частный мастер',skills}));
      const tender=route().params.get('tender');
      const target=tender&&/^[a-z0-9-]+$/i.test(tender)?'#apply/'+tender:'#worker';
      if(!finishWorkspaceEdit(target))await render();
      return
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

const readLocal=(key,fallback)=>JSON.parse(accountStorage.getItem(key)||JSON.stringify(fallback));
const writeLocal=(key,value)=>accountStorage.setItem(key,JSON.stringify(value));
const portfolioUI={show,esc,link,objectURL,notice,render,showSamples:demoMode(),signedIn:Boolean(currentAuth())};
function route(){
  const [path,query]=location.hash.slice(1).split('?');const [page,id,index]=path.split('/');
  return {page:page||(currentAuth()?accountDestination():demoMode()?'market':'login'),id,index,params:new URLSearchParams(query)};
}
let seeded;
const accountUI={show,notice,esc,link,workerEnabled,activeProfile,render};
async function render(){
  const seq=++generation;const {page,id,index,params}=route();
  dialog.close();notice('');urls.forEach(URL.revokeObjectURL);urls=[];fileUrls=new WeakMap();current=null;
  const auth=currentAuth();
  const isRegistration=registrationPages.includes(page);
  const isSettings=['account','activate-worker'].includes(page);
  const isAccountPage=isRegistration||['login','start'].includes(page)||isSettings;
  document.body.dataset.surface = page==='admin' ? 'admin' : page==='catalog' ? 'catalog'
    : isAccountPage&&!isSettings&&!(page==='start'&&auth?.user?.user_metadata?.belkhi_starting_mode) ? 'account' : 'app';
  try{
    const pending=registrationStep();
    if(pending && page!==pending){location.replace('#'+pending);return}
    if(isRegistration){
      const guestStep=['signup','signup-confirm'].includes(page);
      if((auth && !pending) || (!auth && !guestStep)){
        location.replace('#'+(auth?accountDestination():'signup'));return;
      }
      registrationScreen(page,accountUI,authError);
      return;
    }
    if(page==='admin'){
      if(!auth){accountScreen('admin',accountUI,authError);return}
      if(!isOwner()){
        show(null,'Администрирование','<p>У этого аккаунта нет прав администратора.</p>'+link('account','Настройки аккаунта','btn'));
        return;
      }
      if(params.has('section')){
        await catalog(true,params.get('section'),{show,notice,render,sync:()=>seed(records)});
        return;
      }
      await moderation(id,params,accountUI,()=>seq===generation);
      return;
    }
    if(page==='catalog'){await catalog(false,params.get('section'),{show,notice,render});return}
    if(!auth && (!demoMode() || isSettings || page==='start') && !['login','signup'].includes(page)){
      location.replace('#login');return;
    }
    if(auth && page==='login'){location.replace('#'+accountDestination());return}
    if(auth && !isAccountPage && accountDestination()==='start'){location.replace('#start');return}
    if(isAccountPage){accountScreen(page,accountUI,authError);return}
    if(!seeded)seeded=seed(records).catch(()=>{seeded=null});
    if(page==='market' || page==='apply')await seeded;
    if(seq!==generation)return;
    if(workerPages.includes(page)){await workerScreen(page,id,params,seq);return}
    if(page==='customer'){
      if(!auth){location.replace('#worker'+(params.has('edit')?'?edit=1':''));return}
      if(params.has('edit'))editCustomerProfile();
      else customerProfile();
      return;
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
  try {
    const files=await Promise.all(selectedFiles.map(packFile));
    const t={...values,...(parent?{parentId,parentOwner:myProfile().id,requester:{...myProfile()}}:{}),
      budget:Number(values.budget),created:Date.now(),id:crypto.randomUUID(),files,winner:null};
    await records('readwrite',s=>s.add(t));
    draft={};selectedFiles=[];channel.postMessage(t.id);location.hash='offers/'+t.id;
  } catch(error) {
    notice(error.message);
    btn.disabled=false;
  }
});
document.addEventListener('click',async e=>{
  const a=e.target.closest('a,button');if(!a)return;
  if(a.dataset.remove!==undefined){selectedFiles.splice(Number(a.dataset.remove),1);fileList();return}
  if(a.dataset.tab){
    const r=route();r.params.set('tab',a.dataset.tab);
    replaceWorkspaceParams(r.params,r.page==='market');
    const here=location.hash;
    await render();
    if(location.hash===here){
      const selected=[...screen.querySelectorAll('[data-tab]')].find(button=>button.dataset.tab===a.dataset.tab);
      selected?.focus({preventScroll:true});
    }
    return;
  }
  if(a.tagName==='A' && (document.body.dataset.surface==='app' || a.matches('.screen-heading a'))){
    if(a.hash?.startsWith('#profile/')&&route().params.get('tab')&&!a.hash.includes('?')){
      a.hash+='?from='+encodeURIComponent(route().params.get('tab'));
    }
    openWorkspaceLink(e,a);
  }
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
window.addEventListener('hashchange',async event=>{
  const here=location.hash;
  if(route().page==='worker'){
    const prior=new URL(event.oldURL).hash.slice(1);
    if(!prior.startsWith('worker'))profileReturn=(!myProfile()&&workerPages.includes(prior.split(/[/?]/)[0]))?'list':prior;
  }
  await render();
  if(location.hash!==here)return;
  if((document.body.dataset.surface==='app'||route().page==='start') && restoreWorkspace())return;
  screen.focus({preventScroll:true});window.scrollTo(0,0);
  screen.querySelector('[data-current-publication]')?.scrollIntoView({block:'start'});
});
await render();
if(document.body.dataset.surface==='app' && !restoreWorkspace()){
  screen.querySelector('[data-current-publication]')?.scrollIntoView({block:'start'});
}
