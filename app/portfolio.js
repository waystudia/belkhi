import {accountKey, accountStorage} from './account-storage.js';
import {icon} from './icons.js?v=20261109-2';
import {packFile, unpackFile} from './file-storage.js';
import {replaceWorkspaceParams} from './workspace-nav.js';

let opening;
function openPortfolio(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(accountKey('belkhi-portfolio'),1);
    request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'}).createIndex('owner','owner');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
async function photos(mode,op){
  opening ||= openPortfolio();
  const tx=(await opening).transaction('photos',mode);
  const result=op(tx.objectStore('photos'));
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(result.result);tx.onabort=()=>reject(tx.error)});
}
export async function portfolio(p,owner,editing,{show,esc,link,objectURL,notice,render,showSamples,signedIn},extra='',back='',objects=''){
  const here=location.hash;
  const stored=await photos('readonly',s=>s.index('owner').getAll(owner));
  if(location.hash!==here)return;
  const rows=stored.map(row=>({...row,file:unpackFile(row.file)}));
  const avatar=rows.find(r=>r.id===owner+'/avatar');
  const works=rows.filter(r=>r!==avatar).sort((a,b)=>b.created-a.created);
  const samples=showSamples && owner!=='customer' && !p.demo?[
    ['site','Ленточный фундамент','Собрали опалубку по разметке и связали арматурный каркас перед заливкой.','Показали армирование до заливки. Было легко сверить размеры с планом.'],
    ['room','Отделка гостиной','Выровняли стены, подготовили их под покраску и уложили напольное покрытие.','Помогли выбрать оттенок стен. После сдачи комната была готова к расстановке мебели.']
  ]:[];
  const demoImage=(key)=>({url:'media/'+encodeURIComponent(key)+'.jpg',
    width:key==='pan'?159:key==='house2'?78:1280,
    height:key==='pan'?74:key==='house2'?50:853});
  for(const [key,title,description] of samples){
    const id=owner+'/sample-'+key;
    if(!works.some(w=>w.id===id))works.push({id,title,description,...demoImage(key),sample:true});
  }
  const workTitles={house:'Строительство дома',house2:'Коттедж под ключ',pan:'Работы на объекте',
    roof:'Монтаж кровли',room:'Отделка помещений',site:'Подготовка фундамента'};
  if(p.demo)for(const key of p.portfolio||[])works.push({
    id:'demo-'+key, ...demoImage(key),title:workTitles[key]||'Пример работы',sample:true
  });
  const portrait=avatar?objectURL(avatar.file):p.demo?'media/'+encodeURIComponent(p.photo)+'.jpg':'';
  const face=portrait?'<img alt="Аватар" src="'+portrait+'">':esc((p.name||'П').slice(0,1));
  const avatarInput=editing?'<label class="portrait" title="Изменить фото профиля">'+face+'<span>＋</span><input type="file" aria-label="Изменить фото профиля" accept="image/png,image/jpeg,image/webp"></label>':'<div class="portrait">'+face+'</div>';
  const [path,query]=here.slice(1).split('?');
  const params=new URLSearchParams(query);
  const requestedWork=params.get('work');
  const selectedWork=works.find(work=>work.id===requestedWork);
  const section=params.get('section') || (objects?'objects':'works');
  const workHref=work=>{
    const next=new URLSearchParams(params);
    next.set('work',work.id);
    return '#'+path+'?'+next;
  };
  const mediaUrl=work=>work.url||objectURL(work.file);
  const tiles=works.map(work=>'<a class="tile" data-work-id="'+esc(work.id)+'" href="'+esc(workHref(work))+'" aria-label="'+esc(work.title)+'">'+
    '<img loading="lazy" src="'+esc(mediaUrl(work))+'" alt=""></a>').join('');
  const settings=editing?'<a class="profile-settings" href="#'+(owner==='customer'?'customer':'worker')+'?edit=1" aria-label="Настройки профиля" title="Настройки профиля"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 3 .7-1h4.6l.7 2.2 1.7 1 2.4-.4 2.2 3.8-1.6 1.9v2.2l1.6 1.9-2.2 3.8-2.4-.4-1.7 1-.7 2.2H9.7L9 19l-1.7-1-2.4.4-2.2-3.8 1.6-1.9v-2.2L2.7 8.6l2.2-3.8 2.4.4L9 4.2Z"/><circle cx="12" cy="11.8" r="3.2"/></svg></a>':'';
  const handleKey='belkhi-public-handle/'+owner;
  let handle=p.handle||accountStorage.getItem(handleKey);
  if(!handle){
    const demoNames={team:'profstroy',team2:'brigada_kovaleva',man:'alexandr_petrov',house2:'domstroy'};
    handle=p.demo?(demoNames[p.photo]||'demo_'+p.id):'belhi_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
    accountStorage.setItem(handleKey,handle);
  }
  const experience=p.years!=null && p.years!==''?new Intl.NumberFormat('ru',{style:'unit',unit:'year',unitDisplay:'long'}).format(Number(p.years)):'—';
  const metric=(value,label,target)=>{
    const content='<b>'+esc(value)+'</b><small>'+label+'</small>';
    return target?'<button type="button" data-profile-jump="'+target+'">'+content+'</button>':'<div>'+content+'</div>';
  };
  const metrics=metric(works.length,'Работы','works')+
    metric(p.reviews??(samples.length||Number(Boolean(p.review && p.review!=='Отзывов пока нет.'))),'Отзывы','reviews')+
    metric(experience,'Стаж');
  const header='<div class="identity">'+avatarInput+'<div class="profile-numbers"><strong>'+esc(p.name||'Заказчик')+'</strong>'+(owner==='customer'?'':'<div class="profile-metrics">'+metrics+'</div>')+'</div></div>';
  const areas=p.areas?'Работает в районах и городах · '+p.areas:'';
  const city=p.areas?.split(',').some(place=>place.trim().toLowerCase()===p.city?.toLowerCase())?'':p.city;
  const facts=[[p.type,p.teamSize?'Команда · '+p.teamSize+' чел.':'',city].filter(Boolean).join(' · '),areas].filter(Boolean).map(text=>'<small style="display:block">'+esc(text)+'</small>').join('');
  const demoLabel=p.demo?'Демонстрационный профиль':samples.length?'Работы и отзывы · демо':'';
  const bio='<div class="profile-bio">'+(demoLabel?'<small class="profile-demo">'+demoLabel+'</small>':'')+facts+(p.about?'<p id="profile-description" class="bio-short">'+esc(p.about)+'</p><button type="button" class="bio-toggle" aria-controls="profile-description" aria-expanded="false" hidden>ещё</button>':'')+(p.skills?.length?'<small>'+p.skills.map(esc).join(' · ')+'</small>':'')+'</div>';
  const score=Number(String(p.rating||'').replace(',','.'));
  const rating=score>0 && score<=5?`<div class="rating-line"><span class="star-meter" aria-hidden="true">★★★★★<i style="width:${score*20}%">★★★★★</i></span><b>${esc(p.rating)} из 5</b><small>Рейтинг</small></div>`:'';
  const reviewImage=p.demo && p.portfolio?.length?'media/'+encodeURIComponent(p.portfolio[0])+'.jpg':'';
  const reviewMedia=reviewImage?`<button class="review-photo" aria-label="Открыть фото работы из демоотзыва"><img src="${reviewImage}" alt="Фото работы из демоотзыва"></button>`:'';
  const demoReviewers={site:{name:'Мария Соколова',photo:'maria',meta:'Демо · Фундамент'},room:{name:'Иван Соколов',photo:'ivan',meta:'Демо · Отделка'}};
  const reviewCard=(reviewer,title,text,photo)=>`<article class="review-card"><div class="review-card-head"><img src="media/${reviewer.photo}.jpg" alt="${esc(reviewer.name)}"><div><strong>${esc(reviewer.name)}</strong><small>${esc(reviewer.meta)}</small></div><span class="review-stars" aria-label="Оценка 5 из 5">★★★★★</span></div><p>${esc(text)}</p>${photo?`<button class="review-photo review-preview" aria-label="Открыть фото к отзыву ${esc(title)}"><img src="${photo}" alt="${esc(title)}"><span><strong>${esc(title)}</strong><small>Фото выполненной работы</small></span></button>`:''}</article>`;
  const reviews=samples.length?samples.map(([key,title,,text])=>reviewCard(demoReviewers[key],title,text,'media/'+key+'.jpg')).join(''):p.review && p.review!=='Отзывов пока нет.'?reviewCard({name:'Заказчик',photo:'maria',meta:p.demo?'Демо · Отзыв':'Отзыв о работе'},'Выполненная работа',p.review,reviewImage):'<p class="muted">Пока нет отзывов.</p>';
  const sections=`<div class="profile-sections" role="group" aria-label="Разделы профиля">
    ${objects?'<button aria-pressed="'+(section==='objects')+'" aria-controls="customer-objects" data-section="objects">'+icon('folder')+' Объекты</button>':''}
    <button aria-pressed="${section!=='reviews'&&section!=='objects'}" aria-controls="work-posts" data-section="works">${icon('grid')} Работы</button>
    <button aria-pressed="${section==='reviews'}" aria-controls="review-posts" data-section="reviews">${icon('star')} Отзывы</button></div>
    ${objects?'<section id="customer-objects" aria-label="Мои объекты" '+(section!=='objects'?'hidden':'')+'>'+objects+'</section>':''}
    <section id="work-posts" ${['reviews','objects'].includes(section)?'hidden':''} aria-label="Выполненные работы">${tiles?'<div class="tiles">'+tiles+'</div>':'<p class="muted">Здесь появятся фотографии работ.</p>'}</section>
    <section id="review-posts" aria-label="Отзывы" ${section!=='reviews'?'hidden':''}>${rating}${reviews}</section>`;
  const actions=editing?'<div class="profile-actions"><button id="new-work" aria-haspopup="dialog">'+icon('add')+' Добавить работу</button>'+
    '<button class="profile-share" id="share-profile">Поделиться</button></div>':'';
  const shortcuts=editing?'<div class="round-shortcuts profile-shortcuts" aria-label="Разделы кабинета">'+
    '<a href="#crew"><span class="shortcut-circle">'+icon('person')+'</span><span>Команда</span></a>'+
    '<a href="#list"><span class="shortcut-circle">'+icon('folder')+'</span><span>Мои объекты</span></a></div>':'';
  if(selectedWork){
    const fallback=new URLSearchParams(params);
    fallback.delete('work');
    const posts=works.map((work,index)=>`<article class="work-post" ${work===selectedWork?'data-current-publication':''}>
      <div class="work-author"><span>${face}</span><div><strong>${esc(p.name||'Исполнитель')}</strong><small>@${esc(handle)}</small></div>
        ${editing?'<button type="button" data-edit-work="'+index+'" aria-label="Редактировать работу" title="Редактировать работу">'+icon('edit')+'</button>':''}</div>
      <img class="post-image" ${work===selectedWork?'':'loading="lazy"'} ${work.width&&work.height?'width="'+work.width+'" height="'+work.height+'"':''} src="${esc(mediaUrl(work))}" alt="${esc(work.title)}">
      <div class="work-publication-copy"><h3>${esc(work.title)}</h3>
      ${work.sample?'<small>Демо · Пример работы</small>':''}${work.description?'<p>'+esc(work.description)+'</p>':''}</div>
      </article>`).join('');
    show(null,'Публикации','<div class="work-publications">'+posts+'</div>',path+(fallback.size?'?'+fallback:''));
    for(const button of document.querySelectorAll('[data-edit-work]')){
      button.onclick=()=>compose(works[Number(button.dataset.editWork)]);
    }
    const previous=[...document.querySelectorAll('.work-publications .post-image')].slice(0,works.indexOf(selectedWork));
    await Promise.all(previous.filter(image=>!image.hasAttribute('width')).map(image=>{
      image.loading='eager';
      return image.decode().catch(()=>{});
    }));
    return;
  }
  const account=editing?'<a class="profile-account" data-view-key="profile-account" href="#'+(signedIn?'account':'login')+'">'+
    (signedIn?'Настройки аккаунта':'Войти или создать аккаунт')+'</a>':'';
  show(null,'@'+handle,'<div class="work-profile">'+settings+header+bio+
    (owner==='customer'?'':actions+shortcuts+account+extra+sections)+'</div>',editing?'':back);
  const description=document.querySelector('#profile-description');
  if(description){
    const toggle=document.querySelector('.bio-toggle');
    toggle.hidden=description.scrollHeight<=description.clientHeight+1;
    toggle.onclick=()=>{
      const collapsed=description.classList.toggle('bio-short');
      toggle.setAttribute('aria-expanded',String(!collapsed));
      toggle.textContent=collapsed?'ещё':'свернуть';
    };
  }
  for(const photoButton of document.querySelectorAll('.review-photo'))photoButton.onclick=()=>{
    const dialog=document.querySelector('#confirmation');
    const card=photoButton.closest('.review-card');
    const author=card?.querySelector('.review-card-head img');
    const authorName=card?.querySelector('.review-card-head strong')?.textContent||'Заказчик';
    const authorMeta=card?.querySelector('.review-card-head small')?.textContent||'Подтверждённый заказ';
    const review=card?.querySelector(':scope > p')?.textContent||'Фото выполненной работы';
    const title=photoButton.querySelector('strong')?.textContent||photoButton.querySelector('img').alt||'Выполненная работа';
    dialog.innerHTML=`<article class="work-post review-detail"><div class="work-author"><span>${author?'<img src="'+author.src+'" alt="'+esc(authorName)+'">':esc(authorName.slice(0,1))}</span><div><strong>${esc(authorName)}</strong><small>${esc(authorMeta)}</small></div><button data-cancel aria-label="Закрыть публикацию">×</button></div>
      <img class="post-image" src="${photoButton.querySelector('img').src}" alt="${esc(title)}">
      <div class="review-detail-copy"><div class="review-detail-label"><span class="review-stars" aria-label="Оценка 5 из 5">★★★★★</span><small>${p.demo||samples.length?'Демоотзыв':'Отзыв о работе'}</small></div><h3>${esc(title)}</h3><p>${esc(review)}</p></div></article>`;
    dialog.showModal();
  };
  const switches=document.querySelectorAll('.profile-sections button');
  for(const button of switches)button.onclick=()=>{
    params.set('section',button.dataset.section);
    params.delete('work');
    replaceWorkspaceParams(params);
    for(const tile of document.querySelectorAll('[data-work-id]')){
      tile.href=workHref(works.find(work=>work.id===tile.dataset.workId));
    }
    for(const item of switches){
      item.setAttribute('aria-pressed',String(item===button));
      document.getElementById(item.getAttribute('aria-controls')).hidden=item!==button;
    }
  };
  for(const shortcut of document.querySelectorAll('[data-profile-jump]'))shortcut.onclick=()=>{
    const tab=[...switches].find(button=>button.dataset.section===shortcut.dataset.profileJump);
    tab.click();
    tab.focus({preventScroll:true});
    tab.scrollIntoView({block:'nearest'});
  };
  const share=document.querySelector('#share-profile');
  if(share)share.onclick=async()=>{
    share.disabled=true;
    try{
      const encoded=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      const cover=avatar?'<img class="face" src="'+await encoded(avatar.file)+'" alt="Аватар">':'';
      const gallery=await Promise.all(works.map(async w=>'<figure><img src="'+await encoded(w.file||await (await fetch(w.url)).blob())+'" alt=""><figcaption>'+(w.sample?'Демо · ':'')+esc(w.title)+(w.description?'<br>'+esc(w.description):'')+'</figcaption></figure>'));
      const html='<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+esc(p.name||'Профиль')+' · Белхи</title><style>body{font:16px/1.4 system-ui;color:#172521;max-width:620px;margin:auto;padding:20px}.face{width:80px;height:80px;border-radius:50%;object-fit:cover}section{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}figure{margin:0}figure img{width:100%;aspect-ratio:1;object-fit:cover}figcaption{font-size:13px;overflow-wrap:anywhere}</style><main>'+cover+'<h1>'+esc(p.name||'Заказчик')+'</h1>'+facts+'<p>@'+esc(handle)+'</p><p>'+esc([p.type,p.city].filter(Boolean).join(' · '))+'</p><p>'+esc(p.about||'')+'</p><p>'+esc((p.skills||[]).join(', '))+'</p><h2>Выполненные работы</h2><section>'+gallery.join('')+'</section></main></html>';
      const file=new File([html],'Белхи — профиль.html',{type:'text/html'});
      if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Профиль в Белхи'});return}
      const a=document.createElement('a');a.href=objectURL(file);a.download=file.name;a.click();notice('Карточка скачана. Файл можно отправить для просмотра.');
    }catch(e){if(e.name!=='AbortError')notice(e.message)}finally{share.disabled=false}
  };
  async function save(file,title,isAvatar,description='',work=null){
    if(!file||!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Выберите JPG, PNG или WebP до 10 МБ.');
    const bitmap=await createImageBitmap(file);
    const {width,height}=bitmap;
    bitmap.close();
    const packed=await packFile(file);
    await photos('readwrite',s=>s.put({id:work?.id||owner+'/'+(isAvatar?'avatar':crypto.randomUUID()),
      owner,file:packed,title,description,width,height,sample:work?.sample,created:work?.created??Date.now()}));
    await render();
  }
  const input=document.querySelector('.portrait input');
  if(input)input.onchange=()=>{if(input.files[0])save(input.files[0],'Аватар',true).catch(e=>notice(e.message))};
  const add=document.querySelector('#new-work');
  if(add)add.onclick=()=>compose();
  function compose(work){
    const dialog=document.querySelector('#confirmation');
    dialog.innerHTML=`<form id="add-photo"><div class="composer-head"><h2>${work?'Редактировать работу':'Новая работа'}</h2><button type="button" data-cancel aria-label="Закрыть">×</button></div>
      <label class="photo-picker"><span>＋ Выбрать фотографию</span><input required name="photo" type="file" accept="image/png,image/jpeg,image/webp"></label>
      <label>Название работы<input required name="title" maxlength="120" placeholder="Например, монтаж кровли"></label>
      <label>Описание <small>по желанию</small><textarea name="description" rows="2" maxlength="2000" placeholder="Что сделали на объекте?"></textarea></label>
      <p role="alert" class="caption"></p><button class="primary publish">Опубликовать</button></form>`;
    const form=dialog.querySelector('form'), picker=form.elements.photo;
    if(work){
      form.elements.title.value=work.title;
      form.elements.description.value=work.description||'';
      picker.required=false;
      const img=new Image();img.src=work.url||objectURL(work.file);img.alt=work.title;
      picker.parentElement.prepend(img);
      picker.previousElementSibling.textContent='Заменить фото';
      form.querySelector('.publish').textContent='Сохранить изменения';
    }
    let preview;
    const release=()=>{if(preview)URL.revokeObjectURL(preview)};
    dialog.addEventListener('close',release,{once:true});
    picker.onchange=()=>{
      release();
      const file=picker.files[0], label=picker.parentElement;
      label.querySelector('img')?.remove();
      if(file){const img=new Image();preview=URL.createObjectURL(file);img.src=preview;img.alt='Предпросмотр работы';label.prepend(img)}
      label.querySelector('span').textContent=file?'Заменить фото':'＋ Выбрать фотографию';
    };
    form.onsubmit=async e=>{
      e.preventDefault();
      const button=form.querySelector('.publish');
      button.disabled=true;
      try{await save(picker.files[0]||work?.file||await (await fetch(work.url)).blob(),form.elements.title.value.trim(),false,form.elements.description.value.trim(),work)}
      catch(err){form.querySelector('[role=alert]').textContent=err.message}
      finally{button.disabled=false}
    };
    if(!dialog.open)dialog.showModal();
  }
}
