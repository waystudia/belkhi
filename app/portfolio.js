const opening=new Promise((resolve,reject)=>{
  const request=indexedDB.open('belkhi-portfolio',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('photos',{keyPath:'id'}).createIndex('owner','owner');
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});
async function photos(mode,op){
  const tx=(await opening).transaction('photos',mode);
  const result=op(tx.objectStore('photos'));
  return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve(result.result);tx.onabort=()=>reject(tx.error)});
}
export async function portfolio(p,owner,editing,{show,esc,link,objectURL,notice,render},extra='',back='',objects=''){
  const here=location.hash;
  const rows=await photos('readonly',s=>s.index('owner').getAll(owner));
  if(location.hash!==here)return;
  const avatar=rows.find(r=>r.id===owner+'/avatar');
  const works=rows.filter(r=>r!==avatar).sort((a,b)=>b.created-a.created);
  const samples=owner!=='customer' && !p.demo?[
    ['site','Ленточный фундамент','Собрали опалубку по разметке и связали арматурный каркас перед заливкой.','Показали армирование до заливки. Было легко сверить размеры с планом.'],
    ['room','Отделка гостиной','Выровняли стены, подготовили их под покраску и уложили напольное покрытие.','Помогли выбрать оттенок стен. После сдачи комната была готова к расстановке мебели.']
  ]:[];
  for(const [key,title,description] of samples){
    const id=owner+'/sample-'+key;
    if(!works.some(w=>w.id===id))works.push({id,title,description,url:'media/'+key+'.jpg',sample:true});
  }
  if(p.demo)for(const key of p.portfolio||[])works.push({url:'media/'+encodeURIComponent(key)+'.jpg',title:'Пример работы'});
  const portrait=avatar?objectURL(avatar.file):p.demo?'media/'+encodeURIComponent(p.photo)+'.jpg':'';
  const face=portrait?'<img alt="Аватар" src="'+portrait+'">':esc((p.name||'П').slice(0,1));
  const avatarInput=editing?'<label class="portrait" title="Изменить фото профиля">'+face+'<span>＋</span><input type="file" aria-label="Изменить фото профиля" accept="image/png,image/jpeg,image/webp"></label>':'<div class="portrait">'+face+'</div>';
  const tiles=works.map((w,i)=>'<button class="tile" data-work="'+i+'" aria-label="'+esc(w.title)+'"><img src="'+(w.url||objectURL(w.file))+'" alt="'+esc(w.title)+'"></button>').join('');
  const settings=editing?'<a class="profile-settings" href="#'+(owner==='customer'?'customer':'worker')+'?edit=1" aria-label="Настройки профиля" title="Настройки профиля"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 3 .7-1h4.6l.7 2.2 1.7 1 2.4-.4 2.2 3.8-1.6 1.9v2.2l1.6 1.9-2.2 3.8-2.4-.4-1.7 1-.7 2.2H9.7L9 19l-1.7-1-2.4.4-2.2-3.8 1.6-1.9v-2.2L2.7 8.6l2.2-3.8 2.4.4L9 4.2Z"/><circle cx="12" cy="11.8" r="3.2"/></svg></a>':'';
  const handleKey='belkhi-public-handle/'+owner;
  let handle=localStorage.getItem(handleKey);
  if(!handle){
    const demoNames={team:'profstroy',team2:'brigada_kovaleva',man:'alexandr_petrov',house2:'domstroy'};
    handle=p.demo?(demoNames[p.photo]||'demo_'+p.id):'belhi_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
    localStorage.setItem(handleKey,handle);
  }
  const experience=p.years!=null && p.years!==''?new Intl.NumberFormat('ru',{style:'unit',unit:'year',unitDisplay:'long'}).format(Number(p.years)):'—';
  const metric=(value,label)=>'<div><b>'+esc(value)+'</b><small>'+label+'</small></div>';
  const metrics=metric(works.length,'Работы')+metric(p.reviews??(samples.length||Number(Boolean(p.review && p.review!=='Отзывов пока нет.'))),'Отзывы')+(owner==='customer'?'':metric(experience,'Стаж'));
  const header='<div class="identity">'+avatarInput+'<div class="profile-numbers"><strong>'+esc(p.name||'Заказчик')+'</strong>'+(owner==='customer'?'':'<div class="profile-metrics">'+metrics+'</div>')+'</div></div>';
  const areas=p.areas?'Работает в районах и городах · '+p.areas:'';
  const facts=[[p.type,p.teamSize?'Команда · '+p.teamSize+' чел.':'',p.city].filter(Boolean).join(' · '),areas].filter(Boolean).map(text=>'<small style="display:block">'+esc(text)+'</small>').join('');
  const bio='<div class="profile-bio">'+facts+(p.about?'<p id="profile-description" class="bio-short">'+esc(p.about)+'</p><button type="button" class="bio-toggle" aria-controls="profile-description" aria-expanded="false" hidden>ещё</button>':editing?'<p class="muted">Добавьте описание в настройках профиля.</p>':'')+(p.skills?.length?'<small>'+p.skills.map(esc).join(' · ')+'</small>':'')+'</div>';
  const score=Number(String(p.rating||'').replace(',','.'));
  const rating=score>0 && score<=5?`<div class="rating-line"><span class="star-meter" aria-hidden="true">★★★★★<i style="width:${score*20}%">★★★★★</i></span><b>${esc(p.rating)} из 5</b><small>Рейтинг</small></div>`:'';
  const reviewImage=p.demo && p.portfolio?.length?'media/'+encodeURIComponent(p.portfolio[0])+'.jpg':'';
  const reviewMedia=reviewImage?`<button class="review-photo" aria-label="Открыть фото работы из демоотзыва"><img src="${reviewImage}" alt="Фото работы из демоотзыва"></button>`:'';
  const demoReviewers={site:{name:'Мария Соколова',photo:'maria',meta:'Фундамент · 12 сентября'},room:{name:'Иван Соколов',photo:'ivan',meta:'Отделка · 3 октября'}};
  const reviewCard=(reviewer,title,text,photo)=>`<article class="review-card"><div class="review-card-head"><img src="media/${reviewer.photo}.jpg" alt="${esc(reviewer.name)}"><div><strong>${esc(reviewer.name)}</strong><small>${esc(reviewer.meta)}</small></div><span class="review-stars" aria-label="Оценка 5 из 5">★★★★★</span></div><p>${esc(text)}</p>${photo?`<button class="review-photo review-preview" aria-label="Открыть фото к отзыву ${esc(title)}"><img src="${photo}" alt="${esc(title)}"><span><strong>${esc(title)}</strong><small>Фото выполненной работы</small></span></button>`:''}</article>`;
  const reviews=samples.length?samples.map(([key,title,,text])=>reviewCard(demoReviewers[key],title,text,'media/'+key+'.jpg')).join(''):p.review && p.review!=='Отзывов пока нет.'?reviewCard({name:'Заказчик',photo:'maria',meta:'Подтверждённый заказ'},'Выполненная работа',p.review,reviewImage):'<p class="muted">Пока нет отзывов.</p>';
  const sections=`<div class="profile-sections" role="group" aria-label="Разделы профиля">
    ${objects?'<button aria-pressed="true" aria-controls="customer-objects">Объекты</button>':''}
    <button aria-pressed="${!objects}" aria-controls="work-posts"><span aria-hidden="true">▦</span> Работы</button>
    <button aria-pressed="false" aria-controls="review-posts"><span aria-hidden="true">☆</span> Отзывы</button></div>
    ${objects?'<section id="customer-objects" aria-label="Мои объекты">'+objects+'</section>':''}
    <section id="work-posts" ${objects?'hidden':''} aria-label="Выполненные работы">${tiles?'<div class="tiles">'+tiles+'</div>':'<p class="muted">Здесь появятся фотографии работ.</p>'}</section>
    <section id="review-posts" aria-label="Отзывы" hidden>${rating}${reviews}</section>`;
  const actions=editing?'<div class="profile-actions"><button class="profile-share" id="share-profile">Поделиться профилем</button><button id="new-work" aria-haspopup="dialog">＋ Работа</button></div>':'';
  show(null,'@'+handle,settings+header+bio+(owner==='customer'?'':actions+extra+sections),back);
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
    dialog.innerHTML='<h3>Фото из демоотзыва</h3><img class="full-work" src="'+photoButton.querySelector('img').src+'" alt="Фото работы"><button data-cancel>Закрыть</button>';
    dialog.showModal();
  };
  const switches=document.querySelectorAll('.profile-sections button');
  for(const button of switches)button.onclick=()=>{
    for(const item of switches){
      item.setAttribute('aria-pressed',String(item===button));
      document.getElementById(item.getAttribute('aria-controls')).hidden=item!==button;
    }
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
    const bitmap=await createImageBitmap(file);bitmap.close();
    await photos('readwrite',s=>s.put({id:work?.id||owner+'/'+(isAvatar?'avatar':crypto.randomUUID()),owner,file,title,description,sample:work?.sample,created:work?.created??Date.now()}));
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
  document.querySelectorAll('.tile').forEach(b=>b.onclick=()=>{
    const w=works[b.dataset.work],d=document.querySelector('dialog');
    d.innerHTML=`<article class="work-post"><div class="work-author"><span>${face}</span><div><strong>${esc(p.name||'Заказчик')}</strong><small>@${esc(handle)}</small></div><button data-cancel aria-label="Закрыть публикацию">×</button></div>
      <img class="post-image" src="${b.querySelector('img').src}" alt="${esc(w.title)}">
      <h3>${w.sample?'Демо · ':''}${esc(w.title)}</h3>${w.description?'<p>'+esc(w.description)+'</p>':''}${editing?'<button id="edit-work">Редактировать</button>':''}</article>`;
    if(editing)d.querySelector('#edit-work').onclick=()=>compose(w);
    d.showModal();
  });
}
