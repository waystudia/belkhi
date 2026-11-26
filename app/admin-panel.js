import {api as cloudAPI,currentAuth,signOut} from './auth.js';
import {catalog} from './catalog.js';
import {renderAdminAccounts,restoreAdminAccountsNavigation} from './admin-accounts.js';
import {createAdminPreviewAPI,resetAdminPreview,previewAdminId} from './admin-preview-data.js';
import {icon} from './icons.js';
import {tenderParameters} from './tender-wizard.js';

const previewAPI=createAdminPreviewAPI();
const sections=[
 ['overview','Обзор','grid'],['users','Пользователи','person'],['customers','Заказчики','home'],
 ['specialists','Специалисты','helmet'],['tenders','Тендеры','folder'],['objects','Объекты','tools'],
 ['responses','Отклики','bookmark'],['moderation','Модерация','filter'],['journal','Журнал действий','edit'],
 ['demo','Демоданные','grid'],['settings','Настройки','more']
];
const events={block_requested:'Блокировка аккаунта',unblock_requested:'Восстановление доступа',read_messages:'Просмотр переписки'};
const date=value=>value?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'—';
const money=value=>new Intl.NumberFormat('ru-RU').format(Number(value)||0)+' ₽';
const badge=(value,kind='muted')=>`<span class="ad-badge ad-badge-${kind}">${value}</span>`;
const scope=()=>currentAuth()?.user?.id||'admin-preview';
const routeKey=hash=>hash.split('?')[0]+'|'+(new URLSearchParams(hash.split('?')[1]).get('record')||'');

export function restoreAdminNavigation(){
 if(restoreAdminAccountsNavigation?.())return true;
 const snapshot=history.state?.adminView;
 if(!snapshot||snapshot.hash!==location.hash||snapshot.scope!==scope())return false;
 const root=document.querySelector('#ad-content');
 for(const [name,value] of snapshot.draft||[]){const field=root?.querySelector(`[name="${CSS.escape(name)}"]`);if(field&&!field.readOnly)field.value=value;}
 const focus=[...root?.querySelectorAll('a,button,input,select')||[]].find(el=>(el.getAttribute('href')||el.name)===snapshot.focus);
 focus?.focus({preventScroll:true});window.scrollTo(0,snapshot.scroll);return true;
}
function bindAdminNavigation(root,prefix,rerender){
 root.addEventListener('click',event=>{
  const a=event.target.closest('a');
  if(!a||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;
  if(a.hasAttribute('data-ad-back')||a.hasAttribute('data-ad-account-back')){
   event.preventDefault();
   const origin=history.state?.adminOrigin;
   if(origin?.scope===scope()&&origin.target===routeKey(location.hash)&&origin.source.startsWith(prefix))history.back();
   else location.hash=a.hash;
  }else if(a.hasAttribute('data-ad-tab')){
   event.preventDefault();history.replaceState({...history.state},'',a.hash);void rerender();
  }else if(a.hasAttribute('data-ad-detail')){
   event.preventDefault();
   const form=root.querySelector('form');
   history.replaceState({...history.state,adminView:{hash:location.hash,scope:scope(),scroll:window.scrollY,
     focus:a.getAttribute('href'),draft:form?[...new FormData(form)]:[]}},'');
   const source=location.hash;location.hash=a.hash;
   history.replaceState({...history.state,adminOrigin:{scope:scope(),source,target:routeKey(a.hash)}},'');
  }
 });
}
export async function adminPanel({id,params,show,notice,esc,isCurrent,preview=false,render}){
 const prefix=preview?'#admin-preview':'#admin';
 const legacySection=params.get('section');
 const panel=sections.some(([key])=>key===params.get('panel'))?params.get('panel'):legacySection?(legacySection==='Пароль'?'settings':'demo'):params.get('view')==='journal'?'journal':id?'users':'overview';
 const tab=params.get('tab')||(legacySection==='Пароль'?'security':'');
 const title=sections.find(([key])=>key===panel)[1];
 const href=(page,extra={})=>prefix+'?'+new URLSearchParams({panel:page,...extra});
 const request=preview?previewAPI:(action,fields={})=>cloudAPI('/functions/v1/belkhi-moderation',{method:'POST',body:{...fields,action}});
 show(null,title,`<div class="admin-workspace"><nav class="ad-sidebar" aria-label="Панель администратора"><strong class="ad-sidebar-title">Управление Белхи</strong>${sections.map(([key,label,symbol])=>`<a href="${href(key)}" ${panel===key?'aria-current="page"':''}>${icon(symbol)}<span>${label}</span></a>`).join('')}<div class="ad-sidebar-bottom"><a href="#market">${icon('arrow')}<span>Открыть сайт</span></a><a href="${preview?'#admin':href('settings',{tab:'access'})}">${preview?'Войти как администратор':'Мой доступ'}</a></div></nav><section class="ad-main"><div class="ad-page-header"><div><h1>${esc(title)}</h1><p>${preview?'Демонстрационная панель':'Рабочая панель администратора'}</p></div><button class="ad-button ad-mobile-menu" type="button" aria-expanded="false" aria-controls="ad-mobile-nav">Разделы ${icon('filter')}</button><a class="ad-button ad-button-ghost ad-preview-link" href="${preview?'#admin': '#admin-preview'}">${preview?'Рабочая панель':'Посмотреть демо'}</a></div><nav id="ad-mobile-nav" class="ad-mobile-nav" aria-label="Разделы панели" hidden>${sections.map(([key,label])=>`<a href="${href(key)}" ${panel===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>${preview?'<div class="ad-preview-note"><strong>Тестовые данные.</strong> Изменения доступны только в этой вкладке и не затрагивают пользователей. <button class="ad-inline-button" id="ad-reset-preview" type="button">Сбросить</button></div>':''}<div id="ad-content"><div class="ad-loading" role="status">Загружаем ${esc(title.toLowerCase())}…</div></div></section></div>`);
 const root=document.querySelector('#ad-content');
 const mobile=document.querySelector('.ad-mobile-menu');
 mobile.onclick=()=>{const nav=document.querySelector('#ad-mobile-nav');nav.hidden=!nav.hidden;mobile.setAttribute('aria-expanded',String(!nav.hidden));};
 document.querySelector('#ad-reset-preview')?.addEventListener('click',()=>{resetAdminPreview();notice('Тестовые данные сброшены.');void render();});
 bindAdminNavigation(root,prefix,render);
 const tabs=(items,current,section=panel)=>`<nav class="ad-tabs" aria-label="Вкладки ${esc(title)}">${items.map(([key,label])=>`<a class="ad-tab" href="${href(section,{tab:key})}" ${current===key?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
 const empty=(heading,copy)=>`<div class="ad-empty"><h2>${heading}</h2><p>${copy}</p></div>`;
 const logRows=rows=>rows.map(row=>`<li class="ad-log-item"><div><strong>${esc(events[row.action]||row.action)}</strong><time>${esc(date(row.at))}</time></div><p>${esc(row.reason)}</p><a data-ad-detail href="${prefix}/${encodeURIComponent(row.target)}?panel=users&returnTo=${encodeURIComponent(location.hash)}">Аккаунт ${esc(row.target.slice(0,4)+'…'+row.target.slice(-4))}</a></li>`).join('');
 const page=Math.max(0,Math.min(10000,Math.trunc(Number(params.get('p')))||0));
 function paging(rows){const to=p=>{const next=new URLSearchParams(params);next.set('panel',panel);if(p)next.set('p',p);else next.delete('p');return prefix+'?'+next;};return `<div class="ad-pagination">${page?`<a class="ad-button" href="${to(page-1)}">Предыдущая</a>`:''}<span>Страница ${page+1}</span>${rows.length>30?`<a class="ad-button" href="${to(page+1)}">Следующая</a>`:''}</div>`;}
 try{
 if(['users','customers','specialists'].includes(panel)){
  const accountParams=new URLSearchParams(params);if(panel==='moderation')accountParams.set('tab','blocked');
  await renderAdminAccounts({root,api:request,route:{id,params:accountParams},esc,notify:notice,isCurrent,preview,currentUserId:preview?previewAdminId:currentAuth()?.user.id,rerender:render});return;
 }
 if(panel==='overview'){
  const [stats,logs,tenders]=await Promise.all([request('overview'),request('journal',{page:0}),request('tenders',{page:0,status:'open'})]);
  if(!isCurrent())return;
  root.innerHTML=`<section class="ad-overview-summary"><div><h2>Состояние площадки</h2><p class="ad-muted">${preview?'Пример сводки на тестовых записях':'Актуальные данные аккаунтов и опубликованных тендеров'}</p></div><dl><div><dt>Пользователи</dt><dd>${stats.accounts.total}</dd><small>${stats.accounts.customers} заказчика · ${stats.accounts.specialists} специалиста</small></div><div><dt>Тендеры</dt><dd>${stats.tenders.total}</dd><small>${stats.tenders.open} принимают отклики</small></div><div><dt>В работе</dt><dd>${stats.tenders.in_progress}</dd><small>Исполнитель выбран заказчиком</small></div><div><dt>Отклики</dt><dd>${stats.bids.total}</dd><small>Содержимое доступно заказчикам</small></div></dl></section><div class="ad-overview-columns"><section><div class="ad-section-heading"><h2>Открытые тендеры</h2><a href="${href('tenders',{status:'open'})}">Все тендеры ${icon('arrow')}</a></div>${tenders.length?`<div class="ad-compact-list">${tenders.slice(0,5).map(t=>`<a data-ad-detail href="${href('tenders',{record:t.id,returnTo:location.hash})}"><span><strong>${esc(t.title||t.kind)}</strong><small>${esc(t.district)} · ${t.bid_count} отклика</small></span><b>${money(t.budget)}</b></a>`).join('')}</div>`:empty('Пока нет открытых тендеров','Здесь появятся опубликованные заказчиками работы.')}</section><section><div class="ad-section-heading"><h2>Последние действия</h2><a href="${href('journal')}">Весь журнал ${icon('arrow')}</a></div>${logs.length?'<ul class="ad-log-list">'+logRows(logs.slice(0,4))+'</ul>':empty('Действий пока нет','Блокировки и просмотры переписки записываются автоматически.')}</section></div><section class="ad-attention"><h2>Контроль доступа</h2><p>${stats.accounts.blocked?`${stats.accounts.blocked} аккаунт(а) заблокировано в Белхи.`:'Заблокированных аккаунтов нет.'} Администратор не выбирает исполнителя вместо заказчика.</p><a class="ad-button" href="${href('moderation')}">Открыть модерацию</a></section>`;return;
 }
 if(['tenders','objects','responses'].includes(panel)){
  const record=params.get('record');
  if(record){
   const t=await request('tender',{id:record});if(!isCurrent())return;
   const current=['details','files','responses','history'].includes(tab)?tab:'details';
   const returnTo=params.get('returnTo');const back=returnTo?.startsWith(prefix+'?')?returnTo:href(panel);
   const detailTabs=[['details','Описание'],['files','Материалы'],['responses','Отклики'],['history','События']];
   const nav=`<nav class="ad-tabs" aria-label="Карточка тендера">${detailTabs.map(([key,label])=>{const next=new URLSearchParams(params);next.set('tab',key);return `<a class="ad-tab" data-ad-tab href="${prefix}?${next}" ${current===key?'aria-current="page"':''}>${label}${key==='files'?' · '+t.files.length:key==='responses'?' · '+t.bid_count:''}</a>`;}).join('')}</nav>`;
   root.innerHTML=`<a class="ad-back" data-ad-back href="${esc(back)}">${icon('arrow')} Назад</a><div class="ad-detail-header"><div><h2>${esc(t.details.title||t.details.kind)}</h2><p>${esc(t.details.district)} · ${esc(t.details.kind)}</p></div>${badge(t.status==='open'?'Принимает отклики':'Исполнитель выбран',t.status==='open'?'success':'muted')}</div>${nav}`+
    (current==='details'?`<dl class="ad-info-grid"><div><dt>Бюджет заказчика</dt><dd>${money(t.details.budget)}</dd></div><div><dt>Срок выполнения</dt><dd>${esc(t.details.period)}</dd></div><div><dt>Опубликован</dt><dd>${esc(date(t.created_at))}</dd></div><div><dt>Заказчик</dt><dd><a data-ad-detail href="${prefix}/${t.owner_id}?panel=users&returnTo=${encodeURIComponent(location.hash)}">Открыть аккаунт ${esc(t.owner_id.slice(0,4)+'…'+t.owner_id.slice(-4))}</a></dd></div></dl><section class="ad-prose"><h3>Описание работ</h3><p>${esc(t.details.description||'Заказчик не добавил описание.')}</p>${tenderParameters(t.details,esc)}</section>`:
     current==='files'?(t.files.length?`<p class="ad-muted">Сведения о приложенных материалах. Исходные файлы открываются в пользовательском тендере.</p><ul class="ad-file-list">${t.files.map(file=>`<li>${icon('folder')}<div><strong>${esc(file.name)}</strong><small>${esc(file.type||'Файл')} · ${file.size==null?'Размер не указан':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(file.size/1024)+' КБ'}</small></div></li>`).join('')}</ul>`:empty('Материалы не прикреплены','Заказчик сможет приложить проект, фотографии и схемы при публикации.')):
     current==='responses'?`<section class="ad-prose"><h3>На тендер получено откликов: ${t.bid_count}</h3><p>Цены, комментарии и профили в предложениях доступны заказчику этого тендера. Администратор видит количество и статус, сохраняя конфиденциальность предложений.</p><p>Исполнителя выбирает сам заказчик. В панели администратора такого действия нет.</p></section>`:
     `<ol class="ad-timeline"><li><strong>Тендер опубликован</strong><time>${esc(date(t.created_at))}</time></li><li><strong>Получено ${t.bid_count} отклика</strong><span>Сводка на момент загрузки страницы</span></li>${t.status!=='open'?'<li><strong>Исполнитель выбран заказчиком</strong><span>Дата выбора пока не сохраняется на сервере</span></li>':''}</ol>`);return;
  }
  const status=panel==='objects'?'in_progress':params.get('status')||(['open','in_progress'].includes(tab)?tab:'');
  const rows=await request('tenders',{search:params.get('q')||'',status,page});if(!isCurrent())return;
  root.innerHTML=(panel==='objects'?'<p class="ad-muted">Объекты, где заказчик выбрал исполнителя. Этапы и задачи локальной CRM пока не синхронизируются с панелью.</p>':panel==='responses'?'<p class="ad-muted">Сводка откликов по тендерам. Содержание предложений видит заказчик, а специалист — только собственное предложение.</p>':tabs([['all','Все тендеры'],['open','Принимают отклики'],['in_progress','Исполнитель выбран']],status||'all'))+
   `<form class="ad-search-form" id="ad-tender-search"><label class="ad-field">Поиск тендера<input class="ad-input" name="q" type="search" maxlength="150" placeholder="Название, город или ID" value="${esc(params.get('q')||'')}"></label><button class="ad-button ad-button-primary" type="submit">Найти</button></form>`+
   (rows.length?`<div class="ad-table-wrap"><table class="ad-table"><thead><tr><th>Тендер</th><th>Бюджет</th><th>Отклики</th><th>Статус</th><th>Опубликован</th></tr></thead><tbody>${rows.slice(0,30).map(t=>`<tr><td data-label="Тендер"><a class="ad-record-title" data-ad-detail href="${href(panel,{record:t.id,returnTo:location.hash})}">${esc(t.title||t.kind)}</a><small>${esc(t.district)} · ${esc(t.kind)}</small></td><td data-label="Бюджет">${money(t.budget)}</td><td data-label="Отклики">${t.bid_count}</td><td data-label="Статус">${badge(t.status==='open'?'Приём откликов':'В работе',t.status==='open'?'success':'muted')}</td><td data-label="Опубликован">${esc(date(t.created_at))}</td></tr>`).join('')}</tbody></table></div>`:empty(params.get('q')?'Тендеры не найдены':panel==='objects'?'Объектов пока нет':'Тендеров пока нет',params.get('q')?'Измените запрос или сбросьте фильтры.':'Новые записи появятся после публикации и выбора исполнителя заказчиком.'))+paging(rows);
  root.querySelector('form').onsubmit=event=>{event.preventDefault();const next=new URLSearchParams(params);next.set('panel',panel);next.delete('p');const q=new FormData(event.target).get('q').trim();if(q)next.set('q',q);else next.delete('q');location.hash=prefix+'?'+next;};return;
 }
 if(panel==='journal'){
  const current=tab==='catalog'?'catalog':'moderation';
  if(current==='catalog'){
   if(preview){root.innerHTML=tabs([['moderation','Модерация'],['catalog','Изменения демоданных']],current)+empty('Изменений тестового каталога нет','В рабочей панели здесь отображаются записи журнала PostgreSQL.');return;}
   const logs=await cloudAPI('/rest/v1/belkhi_journal?order=id.desc&limit=31&offset='+page*30);if(!isCurrent())return;
   root.innerHTML=tabs([['moderation','Модерация'],['catalog','Изменения демоданных']],current)+(logs.length?'<ul class="ad-log-list">'+logs.slice(0,30).map(row=>`<li class="ad-log-item"><div><strong>${esc(({INSERT:'Добавление',UPDATE:'Изменение',DELETE:'Удаление'})[row.action]||row.action)}</strong><time>${esc(date(row.at))}</time></div><p>${esc(row.label)}</p><small>${esc(row.entity)}</small></li>`).join('')+'</ul>':empty('Журнал пуст','Изменения демокаталога фиксируются автоматически.'))+paging(logs);return;
  }
  const logs=await request('journal',{page,...(params.get('event')?{event:params.get('event')}:{})});if(!isCurrent())return;
  root.innerHTML=tabs([['moderation','Модерация'],['catalog','Изменения демоданных']],current)+`<form class="ad-search-form" id="ad-journal-filter"><label class="ad-field">Действие<select class="ad-select" name="event"><option value="">Все действия</option>${Object.entries(events).map(([key,label])=>`<option value="${key}" ${params.get('event')===key?'selected':''}>${label}</option>`).join('')}</select></label><button class="ad-button" type="submit">Применить</button></form>`+(logs.length?'<ul class="ad-log-list">'+logRows(logs.slice(0,30))+'</ul>':empty('Действий пока нет','Здесь сохраняются причины блокировок, восстановления доступа и просмотра переписки.'))+paging(logs);
  root.querySelector('form').onsubmit=event=>{event.preventDefault();location.hash=href('journal',{event:new FormData(event.target).get('event')});};return;
 }
 if(panel==='moderation'){
  if(!tab||tab==='blocked'){
   const rows=await request('accounts',{status:'blocked',page,role:'all'});if(!isCurrent())return;
   root.innerHTML=tabs([['blocked','Заблокированные'],['messages','Доступ к сообщениям'],['policy','Правила доступа']],'blocked')+'<p class="ad-muted">Аккаунты с ограниченным доступом к Белхи. Откройте карточку, чтобы проверить причину и восстановить доступ.</p>'+(rows.length?'<div class="ad-compact-list">'+rows.slice(0,30).map(user=>`<a data-ad-detail href="${prefix}/${user.id}?panel=users&tab=access&returnTo=${encodeURIComponent(location.hash)}"><span><strong>${esc(user.display_name||user.email||'Аккаунт')}</strong><small>${esc(date(user.blocked_at))}</small></span>${badge('Заблокирован','danger')}</a>`).join('')+'</div>':empty('Заблокированных аккаунтов нет','Решения об ограничении доступа принимаются в карточке пользователя с указанием причины.'))+paging(rows);return;
  }
  root.innerHTML=tabs([['blocked','Заблокированные'],['messages','Доступ к сообщениям'],['policy','Правила доступа']],tab||'blocked')+(tab==='messages'?`<section class="ad-prose"><h2>Проверка переписки</h2><p>Откройте карточку аккаунта и вкладку «Сообщения». Для каждого просмотра нужна причина. Действие попадёт в журнал модерации.</p><p>Пользовательский чат пока не подключён. Письма регистрации и коды подтверждения в этот раздел не входят.</p><a class="ad-button ad-button-primary" href="${href('users')}">Найти аккаунт</a></section>`:`<section class="ad-prose"><h2>Права администратора</h2><p>Доступ проверяется на сервере. Администратор может проверять аккаунты и ограничивать доступ к Белхи с указанием причины.</p><ul><li>Свой аккаунт и другие администраторы защищены от блокировки.</li><li>Блокировка действует только в Белхи.</li><li>Каждый просмотр переписки фиксируется с причиной.</li><li>Отклики и выбор исполнителя остаются под управлением заказчика.</li></ul></section>`);return;
 }
 if(panel==='demo'){
  const demoSections=['Тендеры','Заказчики','Исполнители','Отклики','Журнал'];
  const section=demoSections.includes(params.get('section'))?params.get('section'):'Тендеры';
  const bar=`<p class="ad-muted">Публичные примеры для знакомства с Белхи. Они хранятся отдельно от рабочих тендеров и аккаунтов.</p><nav class="ad-tabs" aria-label="Демонстрационные данные">${demoSections.map(label=>`<a class="ad-tab" href="${href('demo',{section:label})}" ${section===label?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
  if(preview){
   const [rows,accounts]=await Promise.all([request('tenders',{page:0}),request('accounts',{page:0})]);if(!isCurrent())return;
   root.innerHTML=bar+(section==='Тендеры'?`<div class="ad-compact-list">${rows.map(t=>`<a data-ad-detail href="${href('tenders',{record:t.id,returnTo:location.hash})}"><span><strong>${esc(t.title)}</strong><small>${esc(t.district)} · ${t.bid_count} тестовых отклика</small></span><b>${money(t.budget)}</b></a>`).join('')}</div>`:section==='Заказчики'||section==='Исполнители'?`<ul class="ad-demo-people">${accounts.filter(p=>section==='Заказчики'?p.customer_enabled:p.worker_enabled).map(p=>`<li><strong>${esc(p.display_name)}</strong><span>${esc(p.email)}</span></li>`).join('')}</ul>`:section==='Отклики'?'<p>У каждого из четырёх демонстрационных тендеров по три предложения. Сравнить их можно в тестовом кабинете заказчика.</p><a class="ad-button" href="#market">Открыть тестовую ленту</a>':empty('Нет изменений','Это пример журнала демоданных.'))+`<p class="ad-muted">Создание, редактирование и удаление демокаталога доступны после входа администратора в рабочую панель.</p>`;return;
  }
  await catalog(true,section,{show:(_step,_title,body)=>{if(!isCurrent())return;root.innerHTML=bar+'<div class="ad-legacy-catalog">'+body+'</div>';root.querySelectorAll('.admin-tabs').forEach(node=>node.remove());},notice,render,sync:async()=>{}});return;
 }
 if(panel==='settings'){
  const current=['application','categories','access','security'].includes(tab)?tab:'application';
  root.innerHTML=tabs([['application','Приложение'],['categories','Категории работ'],['access','Мой доступ'],['security','Безопасность']],current)+
   (current==='application'?`<section class="ad-prose"><h2>Белхи</h2><p>Тендеры на строительство и ремонт. Заказчики публикуют работы, специалисты предлагают условия.</p><dl class="ad-info-grid"><div><dt>Адрес приложения</dt><dd>${esc(location.origin+location.pathname)}</dd></div><div><dt>Установка</dt><dd>PWA · кнопка «На главный экран»</dd></div><div><dt>Рабочие данные</dt><dd>Аккаунты, тендеры и отклики — на сервере</dd></div><div><dt>CRM и портфолио</dt><dd>Часть данных хранится на устройстве</dd></div></dl><p>Отправка откликов и административные действия требуют подключения к интернету.</p></section>`:
    current==='categories'?`<section class="ad-prose"><h2>Категории тендеров</h2><p>Текущий набор специальностей в форме публикации. Эти категории заданы в приложении; изменение выполняется вместе с обновлением сайта.</p><ul class="ad-category-list">${['Строительство дома','Фундамент','Кровля','Электромонтаж','Отделочные работы'].map((label,i)=>`<li>${icon(['home','tools','home','tools','edit'][i])}<span>${label}</span>${badge('Доступна','success')}</li>`).join('')}</ul></section>`:
    current==='access'?`<section class="ad-prose"><h2>Доступ владельца</h2><dl class="ad-info-grid"><div><dt>Аккаунт</dt><dd>${esc(preview?'admin@example.invalid':currentAuth()?.user.email||'Без почты')}</dd></div><div><dt>Права</dt><dd>Администратор Белхи</dd></div><div><dt>Проверка доступа</dt><dd>${preview?'Демонстрация · реальные действия недоступны':'JWT и серверная роль владельца'}</dd></div></dl><p>Назначение прав владельца не выполняется через клиентский интерфейс.</p><button class="ad-button" id="ad-sign-out" type="button">${preview?'Открыть вход администратора':'Выйти из аккаунта'}</button></section>`:
    `<section class="ad-prose"><h2>Смена пароля</h2>${preview?'<p>В демонстрационной панели пароль не меняется. Форма доступна после входа владельца.</p>':`<form id="ad-password-form" class="ad-reason-form"><label class="ad-field">Текущий пароль<input class="ad-input" name="old" type="password" required autocomplete="current-password"></label><label class="ad-field">Новый пароль<input class="ad-input" name="password" type="password" required minlength="8" autocomplete="new-password"></label><label class="ad-field">Повторите новый пароль<input class="ad-input" name="confirm" type="password" required minlength="8" autocomplete="new-password"></label><p class="ad-form-feedback" role="status"></p><button class="ad-button ad-button-primary" type="submit">Сменить пароль</button></form>`}</section>`);
  root.querySelector('#ad-sign-out')?.addEventListener('click',async()=>{if(preview){location.hash='#admin';return;}await signOut();location.reload();});
  const form=root.querySelector('#ad-password-form');
  if(form)form.onsubmit=async event=>{event.preventDefault();const data=new FormData(form),feedback=form.querySelector('[role=status]'),button=form.querySelector('button');if(data.get('password')!==data.get('confirm')){feedback.textContent='Новые пароли не совпадают.';return;}button.disabled=true;try{const fresh=await cloudAPI('/auth/v1/token?grant_type=password',{method:'POST',token:null,body:{email:currentAuth().user.email,password:data.get('old')}});await cloudAPI('/auth/v1/user',{method:'PUT',token:fresh.access_token,body:{password:data.get('password')}});form.reset();feedback.textContent='Пароль изменён.';}catch(error){feedback.textContent=error.message;}finally{button.disabled=false;}};
 }
 }catch(error){if(!isCurrent())return;root.innerHTML=`<div class="ad-error" role="alert"><h2>Не удалось загрузить раздел</h2><p>${esc(error.message)}</p><button type="button" class="ad-button" id="ad-retry">Повторить</button></div>`;root.querySelector('#ad-retry').onclick=()=>render();}
}
