// Project data lives with the accepted order, so the customer sees the same progress.
export function progress(plan=[]){
  const tasks=plan.flatMap(stage=>stage.tasks);
  return {done:tasks.filter(t=>t.done).length,total:tasks.length};
}
export function crm(t,p,{esc,show,link,teamMembers,records,render,notice,channel,objectURL}){
  const plan=t.plan||[], log=t.log||[], members=teamMembers(p);
  const {done,total}=progress(plan);
  const field=(label,name,attrs='')=>'<label>'+label+'<input required name="'+name+'" '+attrs+'></label>';
  const section=(title,html,open=false)=>'<details class="fold" '+(open?'open':'')+'><summary>'+title+'</summary><div>'+html+'</div></details>';
  const assignees='<option value="">Я сам</option>'+members.map(m=>'<option value="'+esc(m.id)+'">'+esc(m.name)+' · '+esc(m.job)+'</option>').join('');
  function taskView(task){
    const assignee=members.find(m=>m.id===task.assignee)?.name||p.name;
    const status=task.done?'Готово':task.type==='Количество'?task.count+' / '+task.target+' '+esc(task.unit):'В работе';
    const report=task.type==='Количество'?field('Добавить за смену · '+esc(task.unit),'amount','type="number" min="1" max="'+(task.target-task.count)+'"'):task.type==='Текст'?field('Что выполнено','note','maxlength="1000"'):'';
    const meter=task.type==='Количество'?'<progress aria-label="Объём выполненных работ" max="'+task.target+'" value="'+task.count+'"></progress>':'';
    return section('<span class="crm-task-title">'+esc(task.name)+'<span class="tag">'+esc(task.type)+'</span></span><small>'+esc(assignee)+(task.due?' · до '+esc(task.due):'')+' · '+status+'</small>',meter+(task.done?'<p class="crm-complete">Задача выполнена</p>':'<form data-task="'+task.id+'">'+report+'<label>Фотоотчёт '+(task.type==='Фото'?'· обязательно':'· по желанию')+'<input '+(task.type==='Фото'?'required':'')+' type="file" name="photo" accept="image/jpeg,image/png,image/webp"></label><button class="secondary">'+(task.type==='Количество'?'Записать объём':'Завершить задачу')+'</button></form>'));
  }
  function stageView(s){
    const add='<form data-stage="'+s.id+'">'+field('Название задачи','name','maxlength="120"')+'<label>Ответственный<select name="assignee">'+assignees+'</select></label><label>Выполнить до<input name="due" type="date"></label><label>Форма отчёта<select name="type"><option>Галочка</option><option>Количество</option><option>Текст</option></select></label><fieldset hidden disabled>'+field('Плановый объём','target','type="number" min="1" max="1000000000"')+field('Единица измерения','unit','maxlength="24" placeholder="кирпичи, м²…"')+'</fieldset><button class="secondary">Создать задачу</button></form>';
    return section(esc(s.name)+'<small>'+(s.due?'До '+esc(s.due)+' · ':'')+(s.tasks.length?'Готово задач: '+s.tasks.filter(x=>x.done).length+' из '+s.tasks.length:'Пока нет задач')+'</small>',s.tasks.map(taskView).join('')+section('Добавить задачу',add));
  }
  const budget=t.manual?t.budget:t.bids?.find(b=>b.id===p.id)?.price||t.budget;
  const stage=plan.find(s=>!s.tasks.length||s.tasks.some(task=>!task.done));
  const task=stage?.tasks.find(task=>!task.done);
  const nextForm=!plan.length?'#crm-stage':task?'form[data-task="'+task.id+'"]':stage?'form[data-stage="'+stage.id+'"]':'';
  const nextLabel=!plan.length?'Создать первый этап':task?'Открыть задачу':'Назначить задачу';
  const nextHint=!plan.length?'С чего начнёте работы на объекте?':stage?esc(stage.name)+(task?' · '+esc(task.name):''):'Все запланированные задачи выполнены';
  const summary=`<section class="crm-overview"><small>${esc(t.district)}</small><dl class="post-spec"><div><dt>Бюджет</dt><dd>${Number(budget).toLocaleString('ru')} ₽</dd></div><div><dt>Срок работ</dt><dd>${esc(t.period)}</dd></div></dl>
    ${total?'<small>Задачи · '+done+' из '+total+'</small><progress aria-label="Выполнено задач" max="'+total+'" value="'+done+'"></progress>':''}</section>
    <div class="crm-next"><small>${stage||!plan.length?'Следующий шаг':'План выполнен'}</small><strong>${nextHint}</strong>${nextForm?'<button class="secondary" id="crm-next">'+nextLabel+'</button>':''}</div>`;
  const addStage=section('Добавить этап','<form id="crm-stage">'+field('Название этапа','name','maxlength="120" placeholder="Например, фундамент"')+'<label>Завершить до<input name="due" type="date"></label><button class="primary">Сохранить этап</button></form>');
  const journal=section('Журнал объекта <small>Записей: '+log.length+'</small>',log.slice().reverse().map(e=>'<p><small>'+esc(new Date(e.at).toLocaleString('ru'))+'</small><br>'+esc(e.text)+(e.photo?'<br><a href="'+e.photo+'" download="Отчёт">Скачать фото</a>':'')+'</p>').join('')||'Здесь появятся изменения плана и отчёты по задачам.');
  const cover=t.photo?'<img class="crm-cover" src="media/'+encodeURIComponent(t.photo)+'.jpg" alt="'+esc(t.kind)+'">':'';
  const files=(t.files||[]).map((f,i)=>'<a class="project" data-project-file="'+i+'">'+esc(f.name||'Файл проекта')+' · Открыть</a>').join('');
  show(null,t.kind,'<div class="crm-project-cover">'+cover+'</div>'+summary+section('Проект и документы',files||'<p class="muted">Чертежи и фотографии, приложенные к тендеру, будут доступны здесь.</p>')+'<h3>План работ <small>'+plan.length+' этапов</small></h3><div class="crm-plan">'+plan.map(stageView).join('')+'</div>'+addStage+journal+link('crew','Управление командой','back'),'works');
  const root=document.querySelector('main');
  root.querySelectorAll('[data-project-file]').forEach(a=>{a.href=objectURL(t.files[Number(a.dataset.projectFile)]);a.target='_blank';a.rel='noopener'});
  root.querySelectorAll('select[name=type]').forEach(select=>select.insertAdjacentHTML('beforeend','<option>Фото</option>'));
  const next=root.querySelector('#crm-next');
  if(next)next.onclick=()=>{
    const form=root.querySelector(nextForm);
    for(let fold=form.closest('details');fold;fold=fold.parentElement.closest('details'))fold.open=true;
    form.scrollIntoView({block:'center'});
    form.querySelector('input:not([type=file]),button')?.focus({preventScroll:true});
  };
  root.querySelectorAll('[name=type]').forEach(select=>select.onchange=()=>{const f=select.form.querySelector('fieldset');f.disabled=f.hidden=select.value!=='Количество'});
  root.querySelectorAll('form').forEach(form=>form.onsubmit=async event=>{
    event.preventDefault();const button=event.submitter;button.disabled=true;
    const data=new FormData(form),name=String(data.get('name')||'').trim();
    try{
      let photo=null;const file=data.get('photo');
      if(file?.size){
        if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Выберите изображение до 5 МБ.');
        photo=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)});
      }
      let error;
      await records('readwrite',store=>{
        const req=store.get(t.id);
        req.onsuccess=()=>{
          try{
            const now=req.result;if(now?.winner!==p.id)throw Error('Нет доступа к объекту.');
            now.plan??=[];now.log??=[];let text;
            if(form.dataset.task){
              const task=now.plan.flatMap(s=>s.tasks).find(x=>x.id===form.dataset.task);
              if(!task||task.done)throw Error('Задача уже закрыта.');
              const n=Number(data.get('amount')),note=String(data.get('note')||'').trim();
              if(task.type==='Количество'){
                if(!Number.isSafeInteger(n)||n<1||task.count+n>task.target)throw Error('Объём превышает остаток или введён неверно.');
                task.count+=n;task.done=task.count===task.target;text=task.name+' · +'+n+' '+task.unit;
              }else{
                if(task.type==='Фото'&&!photo)throw Error('Добавьте фотографию результата.');
                if(task.type==='Текст'&&!note)throw Error('Введите результат работы.');
                task.done=true;text=task.name+' · '+(note||'Выполнено');
              }
            }else{
              if(!name)throw Error('Введите название.');
              if(form.dataset.stage){
                const stage=now.plan.find(s=>s.id===form.dataset.stage);
                const type=data.get('type'),target=Number(data.get('target')),unit=String(data.get('unit')||'').trim();
                if(type==='Количество'&&(!unit||!Number.isSafeInteger(target)||target<1))throw Error('Укажите объём и единицу измерения.');
                stage.tasks.push({id:crypto.randomUUID(),name,due:data.get('due'),assignee:data.get('assignee'),type,target,unit,count:0,done:false});text='Добавлена задача · '+name;
              }else{now.plan.push({id:crypto.randomUUID(),name,due:data.get('due'),tasks:[]});text='Добавлен этап · '+name}
            }
            now.log.push({at:Date.now(),text,photo});store.put(now);
          }catch(e){error=e}
        };return req;
      });
      if(error)throw error;
      const expanded=[...root.querySelectorAll('details')].map(d=>[d.querySelector('summary').firstChild.textContent,d.open]);
      channel.postMessage(t.id);await render();
      for(const d of root.querySelectorAll('details'))d.open=expanded.some(([title,open])=>open&&title===d.querySelector('summary').firstChild.textContent);
      notice('Сохранено');
    }catch(e){notice(e.message)}finally{button.disabled=false}
  });
}
