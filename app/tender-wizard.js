const kinds = ['Строительство дома', 'Фундамент', 'Кровля', 'Электромонтаж', 'Отделочные работы'];
const steps = ['Работа', 'Параметры', 'Место и сроки', 'Фото', 'Проверка'];
const periods = ['До 2 недель', 'До 1 месяца', '1–2 месяца', '3–5 месяцев', 'Обсудить с мастером'];
const subtypes = {
  'Строительство дома': ['Дом под ключ', 'Коробка дома', 'Кладка стен', 'Пристройка'],
  'Фундамент': ['Ленточный', 'Плитный', 'Свайный', 'Нужна консультация'],
  'Кровля': ['Новая кровля', 'Ремонт кровли', 'Замена покрытия'],
  'Электромонтаж': ['Разводка с нуля', 'Замена проводки', 'Розетки и выключатели', 'Электрощит', 'Освещение'],
  'Отделочные работы': ['Комплексная отделка', 'Штукатурка', 'Шпаклёвка и покраска', 'Укладка плитки', 'Напольное покрытие']
};
const number = (key, label, unit, extra = false) => ({key, label, unit, extra, type: 'number'});
const choice = (key, label, options, extra = false) => ({key, label, options, extra});
const text = (key, label, extra = false) => ({key, label, extra});
const unknown = 'Не знаю / нужен замер';
// Illustrative placeholders only: never copied into the draft or published values.
const examples = {length:'42',width:'40',depth:'80',aboveGround:'40',rebar:'12',slabLength:'10',slabWidth:'8',slabThickness:'25',pileCount:'20',pileDiameter:'300',pileLength:'3',roofArea:'150',roofHeight:'6',roofSlope:'30',objectArea:'80',sockets:'24',switches:'8',lights:'12',circuits:'6',surfaceArea:'120',wallHeight:'2.8',layer:'10',houseArea:'120',floors:'2',houseLength:'10',houseWidth:'12'};
function fields(kind, subtype) {
  const shared = [choice('measurement', 'Нужен выезд и замер', ['Нужен', 'Замеры уже есть', 'Обсудим'], true), choice('materials', 'Кто закупает материалы', ['Заказчик', 'Исполнитель', 'Обсудим'], true), choice('project', 'Проект или схема', ['Есть', 'Нет', 'Нужна помощь'], true), text('access', 'Условия на объекте', true)];
  let result = [];
  if (kind === 'Фундамент') {
    result = subtype === 'Плитный'
      ? [number('slabLength', 'Длина плиты', 'м'), number('slabWidth', 'Ширина плиты', 'м'), number('slabThickness', 'Толщина плиты', 'см')]
      : subtype === 'Свайный'
        ? [number('pileCount', 'Количество свай', 'шт.'), number('pileDiameter', 'Диаметр свай', 'мм'), number('pileLength', 'Длина свай', 'м'), choice('grillage', 'Ростверк', ['Нужен', 'Не нужен', unknown])]
        : subtype === 'Нужна консультация' ? []
          : [number('length', 'Общая длина ленты', 'пог. м'), number('width', 'Ширина ленты', 'см'), number('depth', 'Глубина в грунте', 'см'), number('aboveGround', 'Высота над землёй', 'см')];
    result.push(number('rebar', 'Диаметр арматуры', 'мм'), text('concrete', 'Класс / марка бетона'), choice('earthworks', 'Земляные работы', ['Нужны', 'Уже выполнены', 'Обсудим'], true), choice('formwork', 'Опалубка и армирование', ['Нужны', 'Уже выполнены', 'Обсудим'], true), choice('waterproof', 'Гидроизоляция', ['Нужна', 'Не нужна', 'Обсудим'], true));
  } else if (kind === 'Кровля') {
    result = [number('roofArea', 'Площадь кровли', 'м²'), choice('roofShape', 'Форма крыши', ['Двускатная', 'Вальмовая', 'Плоская', 'Сложная', unknown]), choice('covering', 'Покрытие', ['Металлочерепица', 'Профнастил', 'Мягкая кровля', 'Шифер', 'Другое', unknown]), number('roofHeight', 'Высота до карниза', 'м'), number('roofSlope', 'Уклон крыши', '°', true), choice('insulation', 'Утепление', ['Нужно', 'Не нужно', 'Обсудим'], true), choice('roofFrame', 'Стропила и обрешётка', ['Нужны', 'Уже готовы', 'Обсудим'], true), choice('gutters', 'Водосток', ['Нужен', 'Не нужен', 'Обсудим'], true), choice('demolition', 'Демонтаж покрытия', ['Нужен', 'Не нужен', 'Обсудим'], true)];
  } else if (kind === 'Электромонтаж') {
    result = [number('objectArea', 'Площадь помещения', 'м²'), number('sockets', 'Розетки', 'шт.'), number('switches', 'Выключатели', 'шт.'), number('lights', 'Точки освещения', 'шт.'), choice('wiring', 'Способ прокладки', ['Скрытая', 'Открытая', unknown]), choice('wallBase', 'Материал стен', ['Кирпич', 'Бетон', 'Блоки', 'Гипсокартон', 'Другое', unknown]), choice('grooving', 'Штробление', ['Нужно', 'Не нужно', 'Обсудим'], true), number('circuits', 'Группы в щите', 'шт.', true), choice('demolition', 'Демонтаж проводки', ['Нужен', 'Не нужен', 'Обсудим'], true)];
  } else if (kind === 'Отделочные работы') {
    result = [number('surfaceArea', 'Площадь работ', 'м²'), number('wallHeight', 'Высота стен', 'м'), choice('surface', 'Поверхность', ['Стены', 'Пол', 'Потолок', 'Несколько поверхностей']), choice('wallBase', 'Основание', ['Кирпич', 'Бетон', 'Штукатурка', 'Гипсокартон', 'Другое', unknown]), choice('condition', 'Состояние', ['Черновое', 'Подготовлено', 'Старое покрытие', unknown]), choice('demolition', 'Демонтаж покрытия', ['Нужен', 'Не нужен', 'Обсудим'], true), text('finishMaterial', 'Материал отделки', true), number('layer', 'Толщина слоя', 'мм', true)];
  } else {
    result = [number('houseArea', 'Площадь дома', 'м²'), number('floors', 'Количество этажей', 'эт.'), choice('wallMaterial', 'Материал стен', ['Кирпич', 'Газоблок', 'Пеноблок', 'Каркас', 'Другое', unknown]), choice('stage', 'Что уже готово', ['Только участок', 'Фундамент', 'Стены', 'Коробка', 'Обсудим']), number('houseLength', 'Длина дома', 'м', true), number('houseWidth', 'Ширина дома', 'м', true), text('constructionScope', 'Какие этапы нужны', true)];
  }
  return [...result, ...shared];
}
const memories = new Map();
const defaultEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
export function tenderParameters(t, escape = defaultEscape) {
  const entries = fields(t.kind, t.subtype).filter(field => t.params?.[field.key] !== undefined && String(t.params[field.key]).trim() !== '');
  if (!entries.length && !t.subtype && !t.start && !t.locationNote) return '';
  const conditions = [[t.locationNote, 'Ориентир'], [t.start === 'В выбранную дату' ? t.startDate : t.start, 'Начало работ']].filter(([value]) => value);
  return '<section class="tender-parameters"><h3>Параметры работ</h3><dl>' + (t.subtype ? '<div><dt>Вид работ</dt><dd>' + escape(t.subtype) + '</dd></div>' : '') + entries.map(field => '<div><dt>' + escape(field.label) + '</dt><dd>' + escape(t.params[field.key]) + (field.unit ? ' ' + escape(field.unit) : '') + '</dd></div>').join('') + conditions.map(([value,label]) => '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl></section>';
}
export function mountTenderWizard({show, esc = defaultEscape, icon, placeField, bindPlacePicker, notice, onPublish, storage = localStorage, draftKey = 'belkhi-tender-draft-v2', initialDraft = {}}) {
  const storageKey = 'belkhi-tender-draft-v2';
  let saved = {};
  try { saved = JSON.parse(storage.getItem(storageKey) || '{}'); } catch { /* A malformed draft must not prevent a new tender. */ }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const existing = memories.get(draftKey);
  const state = existing || {values: {...initialDraft, ...saved.values}, parameters: saved.parameters || {}, step: Math.min(4, Math.max(0, Number(saved.step) || 0)), files: [], urls: new Map(), restoredFiles: Number(saved.fileCount) || 0};
  memories.set(draftKey, state);
  const data = state.values;
  if (!kinds.includes(data.kind)) data.kind = '';
  let active = true;
  let busy = false;
  let saveError = false;
  let closeMenus = () => {};
  let detachMenus = () => {};
  const currentFields = () => fields(data.kind, data.subtype);
  const countKeys = new Set(['pileCount', 'sockets', 'switches', 'lights', 'circuits', 'floors']);
  const params = () => state.parameters[data.kind] ||= {};
  function persist() {
    try { storage.setItem(storageKey, JSON.stringify({values: data, parameters: state.parameters, step: state.step, fileCount: state.files.length || state.restoredFiles})); saveError = false; }
    catch { if (!saveError) notice('Не удалось сохранить черновик на устройстве. Не закрывайте страницу до создания тендера.'); saveError = true; }
  }
  function choiceField(name, label, options, value, required = false) {
    return `<div class="tw-field tw-choice-field"><span id="tw-label-${esc(name)}">${esc(label)}${required ? ' <span class="tw-required">*</span>' : ''}</span><details class="tw-choice" data-choice="${esc(name)}"><summary aria-label="${esc(label)}: ${esc(value || 'выберите вариант')}"><span id="tw-value-${esc(name)}">${esc(value || 'Выбрать')}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="tw-options" role="group" aria-label="${esc(label)}">${options.map(option => `<label><input type="radio" name="${esc(name)}" value="${esc(option)}" ${option === value ? 'checked' : ''}><span>${esc(option)}</span></label>`).join('')}${required ? '' : `<label><input type="radio" name="${esc(name)}" value="" ${!value ? 'checked' : ''}><span>Не указано</span></label>`}</div></details></div>`;
  }
  function input(name, label, {value = '', unit = '', type = 'text', required = false, maxLength = 100, placeholder = ''} = {}) {
    return `<label class="tw-field" for="tw-${esc(name)}"><span>${esc(label)}${required ? ' <span class="tw-required">*</span>' : ''}</span><span class="tw-input-wrap"><input id="tw-${esc(name)}" name="${esc(name)}" value="${esc(value)}" type="${type}" ${type === 'number' ? `min="${countKeys.has(name.replace('param:', '')) ? '0' : '0.01'}" max="100000000000" step="${countKeys.has(name.replace('param:', '')) ? '1' : 'any'}" inputmode="decimal"` : `maxlength="${maxLength}"`} ${required ? 'required' : ''} placeholder="${esc(placeholder)}">${unit ? `<span class="tw-unit">${esc(unit)}</span>` : ''}</span></label>`;
  }
  function parameter(field) {
    const value = params()[field.key] ?? '';
    if (field.options) return choiceField('param:' + field.key, field.label, field.options, value);
    return input('param:' + field.key, field.label, {value, unit: field.unit, type: field.type || 'text', placeholder: field.key === 'concrete' ? 'М300' : field.key === 'access' ? 'Вода, электричество, подъезд' : field.type === 'number' ? examples[field.key] || '10' : 'Не указано'});
  }
  function fileURL(file) {
    if (!state.urls.has(file)) state.urls.set(file, URL.createObjectURL(file));
    return state.urls.get(file);
  }
  function filesHTML() {
    return state.files.length ? '<div class="tw-files">' + state.files.map((file, index) => `<div class="tw-file">${file.type.startsWith('image/') ? `<img src="${esc(fileURL(file))}" alt="">` : icon('folder')}<span>${esc(file.name)}<small>${(file.size / 1024 / 1024).toLocaleString('ru-RU', {maximumFractionDigits: 1})} МБ</small></span><button type="button" data-tw-remove="${index}" aria-label="Удалить ${esc(file.name)}">${icon('more').replace(/<path[^>]*\/>/, '<path d="m6 6 12 12M18 6 6 18"/>')}</button></div>`).join('') + '</div>' : '<p class="tw-empty">Фото и файлы пока не добавлены.</p>';
  }
  function reviewSection(title, step, body) {
    return `<section class="tw-review-section"><div class="tw-section-head"><h3>${title}</h3><button type="button" class="tw-text-button" data-tw-step="${step}">${icon('edit')} Изменить</button></div>${body}</section>`;
  }
  function content() {
    if (state.step === 0) return `<h2 id="tw-step-title">Какая работа нужна?</h2><p class="tw-help">Выберите специальность — покажем подходящие вопросы.</p>${input('title', 'Название тендера', {value: data.title, required: true, maxLength: 100, placeholder: 'Например, залить фундамент дома'})}${choiceField('kind', 'Специальность', kinds, data.kind, true)}${data.kind ? choiceField('subtype', 'Вид работ', subtypes[data.kind], data.subtype, true) : ''}<label class="tw-field" for="tw-description"><span>Что нужно сделать <span class="tw-required">*</span></span><textarea id="tw-description" name="description" maxlength="3000" required placeholder="Опишите задачу, пожелания и что уже готово">${esc(data.description || '')}</textarea></label>`;
    if (state.step === 1) {
      const title = {'Фундамент':'Параметры фундамента', 'Кровля':'Параметры кровли', 'Электромонтаж':'Параметры электромонтажа', 'Отделочные работы':'Параметры отделки', 'Строительство дома':'Параметры строительства'}[data.kind];
      return `<h2 id="tw-step-title">${title || 'Параметры работ'}</h2><p class="tw-help">Серые значения — пример. Если не знаете размер, пропустите поле.</p><p class="tw-chosen">${esc(data.kind)} · ${esc(data.subtype || '')}<button class="tw-text-button" type="button" data-tw-step="0">Изменить</button></p><div class="tw-grid">${currentFields().filter(field => !field.extra).map(parameter).join('')}</div><details class="tw-extra"><summary>Дополнительные сведения<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg></summary><div class="tw-grid">${currentFields().filter(field => field.extra).map(parameter).join('')}</div></details><p class="tw-help tw-note">Указывайте известные вам данные из проекта или замеров.</p>`;
    }
    if (state.step === 2) return `<h2 id="tw-step-title">Место, бюджет и сроки</h2><p class="tw-help">Укажите место и удобные сроки работ.</p>${placeField('tw-district', 'district', 'Город, село или район', data.district || '', true)}${input('locationNote', 'Ориентир или район города', {value: data.locationNote, placeholder: 'Без номера дома и квартиры'})}<p class="tw-help">Точный адрес можно передать выбранному исполнителю.</p><div class="tw-grid">${input('budget', 'Бюджет', {value: data.budget, type: 'number', unit: '₽', required: true, placeholder: '400 000'})}${choiceField('period', 'Срок выполнения', periods, data.period || '', true)}</div>${choiceField('start', 'Когда начинать', ['Как можно скорее', 'В течение месяца', 'В выбранную дату', 'По договорённости'], data.start || '')}${data.start === 'В выбранную дату' ? input('startDate', 'Дата начала', {value: data.startDate, type: 'date', required: true}) : ''}`;
    if (state.step === 3) return `<h2 id="tw-step-title">Фото и чертежи</h2><p class="tw-help">Фото объекта, план или эскиз помогут мастеру оценить объём работ.</p><label class="tw-upload" for="tw-upload">${icon('add')}<strong>Добавить фото или файл</strong><span>До 5 файлов · JPEG, PNG, WebP, PDF · до 10 МБ</span><input id="tw-upload" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple></label>${state.restoredFiles ? '<p class="tw-file-warning">После перезагрузки добавьте файлы заново. Остальные данные черновика сохранены.</p>' : ''}${filesHTML()}<p class="tw-help">Этот шаг можно пропустить.</p>`;
    const review = {...data, params: params()};
    return `<h2 id="tw-step-title">Проверьте тендер</h2><p class="tw-help">Такую информацию увидят специалисты. Любой раздел можно изменить.</p>${reviewSection('Работа', 0, `<h4>${esc(data.title)}</h4><p class="tw-muted">${esc(data.kind)} · ${esc(data.subtype)}</p><p class="tw-review-copy">${esc(data.description)}</p>`)}${reviewSection('Параметры', 1, tenderParameters(review, esc) || '<p class="tw-muted">Мастер уточнит параметры при обсуждении.</p>')}${reviewSection('Место и сроки', 2, `<dl class="tw-review-facts"><div><dt>Где</dt><dd>${esc(data.district)}${data.locationNote ? ' · ' + esc(data.locationNote) : ''}</dd></div><div><dt>Бюджет</dt><dd>${Number(data.budget).toLocaleString('ru-RU')} ₽</dd></div><div><dt>Срок</dt><dd>${esc(data.period)}</dd></div><div><dt>Начало</dt><dd>${esc(data.start === 'В выбранную дату' ? data.startDate : data.start || 'По договорённости')}</dd></div></dl>`)}${reviewSection('Фото и файлы', 3, (state.restoredFiles ? '<p class="tw-file-warning">Фото после перезагрузки не восстановлены. Добавьте их заново, если хотите приложить к тендеру.</p>' : '') + filesHTML())}<p class="tw-help tw-local-note">Демо-версия: тендер сохранится на этом устройстве. Отклики для сравнения будут демонстрационными.</p>`;
  }
  function collect(form) {
    if (!form) return;
    const next = new FormData(form);
    for (const [key, value] of next.entries()) {
      if (key.startsWith('param:')) params()[key.slice(6)] = String(value).trim();
      else if (key !== 'tw-upload') data[key] = String(value).trim();
    }
    persist();
  }
  function validate(step) {
    let message = '', name = '';
    if (step === 0) {
      if (!data.title) {message = 'Добавьте название тендера.'; name = 'title';}
      else if (!data.kind) {message = 'Выберите специальность.'; name = 'kind';}
      else if (!subtypes[data.kind]?.includes(data.subtype)) {message = 'Выберите вид работ.'; name = 'subtype';}
      else if (!data.description) {message = 'Опишите, что нужно сделать.'; name = 'description';}
    }
    if (step === 2) {
      if (!data.district) {message = 'Укажите город, село или район.'; name = 'district';}
      else if (!(Number(data.budget) > 0 && Number(data.budget) <= 100000000000)) {message = 'Укажите бюджет больше нуля.'; name = 'budget';}
      else if (!periods.includes(data.period)) {message = 'Выберите срок выполнения.'; name = 'period';}
      else if (data.start === 'В выбранную дату' && !/^\d{4}-\d{2}-\d{2}$/.test(data.startDate || '')) {message = 'Выберите дату начала.'; name = 'startDate';}
    }
    if (step === 1) {
      const invalid = currentFields().find(field => field.type === 'number' && params()[field.key] !== undefined && params()[field.key] !== '' && !(Number(params()[field.key]) >= (countKeys.has(field.key) ? 0 : 0.01) && Number(params()[field.key]) <= 100000000000 && (!countKeys.has(field.key) || Number.isInteger(Number(params()[field.key])))));
      if (invalid) {message = 'Укажите положительное число в поле «' + invalid.label + '» или оставьте его пустым.'; name = 'param:' + invalid.key;}
    }
    if (!message) return true;
    state.step = step; render(false);
    const error = document.querySelector('#tw-error'); error.textContent = message;
    const target = [...document.querySelectorAll('#tender-wizard-form [name]')].find(el => el.name === name);
    if (target?.type === 'radio') {target.closest('details').open = true; target.focus();}
    else {const extra = target?.closest('.tw-extra'); if (extra) extra.open = true; target?.focus();}
    return false;
  }
  function render(focus = true) {
    if (!active) return;
    detachMenus();
    persist();
    const nav = `<nav class="tw-steps" aria-label="Шаги создания тендера">${steps.map((step, index) => `<button type="button" data-tw-step="${index}" ${index > state.step ? 'disabled' : ''} ${index === state.step ? 'aria-current="step"' : ''}><span>${index + 1}</span>${step}</button>`).join('')}</nav>`;
    show(0, 'Создание тендера', `<div class="tender-wizard">${nav}<form id="tender-wizard-form" class="tw-form" novalidate><div class="tw-mobile-progress"><span>Шаг ${state.step + 1} из 5</span><span>${steps[state.step]}</span></div><div class="tw-mobile-track" aria-hidden="true">${steps.map((_,index)=>`<span class="${index < state.step ? 'done' : index === state.step ? 'current' : ''}">${index < state.step ? '<svg viewBox="0 0 20 20"><path d="m5 10 3 3 7-7"/></svg>' : index+1}</span>`).join('')}</div><progress class="tw-progress" value="${state.step + 1}" max="5" aria-label="Шаг ${state.step + 1} из 5"></progress><div class="tw-content">${content()}</div><p id="tw-error" class="tw-error" role="alert"></p><div class="tw-footer"><button class="tw-back" type="button" data-tw-back ${state.step === 0 ? 'disabled' : ''}>Назад</button><span>Черновик на устройстве</span><button type="submit" class="primary">${state.step === 4 ? 'Создать тендер' : 'Далее'}</button></div></form><div class="tw-overview"><h3>Ваш тендер</h3><strong>${esc(data.title || 'Название появится здесь')}</strong><p>${esc(data.kind || 'Выберите специальность')}</p><dl><div><dt>Место</dt><dd>${esc(data.district || 'Не указано')}</dd></div><div><dt>Бюджет</dt><dd>${data.budget ? Number(data.budget).toLocaleString('ru-RU') + ' ₽' : 'Не указан'}</dd></div><div><dt>Срок</dt><dd>${esc(data.period || 'Не указан')}</dd></div></dl><small>Заполните известные данные. Остальное можно уточнить с мастером.</small></div></div>`, 'market');
    const form = document.querySelector('#tender-wizard-form');
    const root = form.closest('.tender-wizard');
    function positionMenu(anchor, menu) {
      const rect = anchor.getBoundingClientRect();
      const boundary = innerWidth < 1000 ? innerHeight - 126 : innerHeight - 12;
      const width = Math.min(Math.max(rect.width, 264), innerWidth - 24);
      const below = boundary - rect.bottom - 6;
      const above = rect.top - 70;
      const up = below < 150 && above > below;
      const height = Math.max(100, Math.min(menu.matches('.worker-suggestions') ? 160 : 260, up ? above : below));
      menu.style.width = width + 'px';
      menu.style.left = Math.max(12, Math.min(rect.left, innerWidth - width - 12)) + 'px';
      menu.style.maxHeight = height + 'px';
      menu.style.top = up ? 'auto' : Math.max(64, rect.bottom + 6) + 'px';
      menu.style.bottom = up ? (innerHeight - rect.top + 6) + 'px' : 'auto';
    }
    const positionChoice = choice => positionMenu(choice.querySelector('summary'), choice.querySelector('.tw-options'));
    root.addEventListener('toggle', event => {
      const choice = event.target;
      if (!choice.matches('.tw-choice') || !choice.open) return;
      root.querySelectorAll('.tw-choice[open]').forEach(other => { if (other !== choice) other.open = false; });
      positionChoice(choice);
    }, true);
    root.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const choice = root.querySelector('.tw-choice[open]');
      if (choice) {event.preventDefault(); choice.open = false; choice.querySelector('summary').focus();}
    });
    const picker = root.querySelector('#tw-district-picker');
    if (picker) {
      bindPlacePicker(picker);
      const input = picker.querySelector('input');
      input.placeholder = 'Город, село или район';
      const positionPlaces = () => {
        const results = picker.querySelector('.worker-suggestions');
        if (!results.hidden) {
          root.querySelectorAll('.tw-choice[open]').forEach(choice => {choice.open = false;});
          positionMenu(input, results);
        }
      };
      input.addEventListener('input', positionPlaces);
      input.addEventListener('focus', positionPlaces);
    }
    closeMenus = event => {
      if (picker) {
        const results = picker.querySelector('.worker-suggestions');
        if (!results.hidden) {
          if (event.type === 'resize' || event.type === 'scroll') positionMenu(picker.querySelector('input'), results);
          else if (!picker.contains(event.target)) results.hidden = true;
        }
      }
      root.querySelectorAll('.tw-choice[open]').forEach(choice => {
        if (event.type === 'resize' || event.type === 'scroll') positionChoice(choice);
        else if (!choice.contains(event.target)) choice.open = false;
      });
    };
    document.addEventListener('pointerdown', closeMenus);
    window.addEventListener('resize', closeMenus);
    window.addEventListener('scroll', closeMenus, true);
    detachMenus = () => {document.removeEventListener('pointerdown', closeMenus); window.removeEventListener('resize', closeMenus); window.removeEventListener('scroll', closeMenus, true);};
    form.addEventListener('input', event => { if (event.target.type !== 'radio' && event.target.type !== 'file') collect(form); });
    form.addEventListener('change', event => {
      const element = event.target;
      if (element.id === 'tw-upload') {
        const next = [...element.files]; element.value = '';
        if (state.files.length + next.length > 5 || next.some(file => file.size > 10 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type))) {
          document.querySelector('#tw-error').textContent = 'Можно добавить до 5 файлов JPEG, PNG, WebP или PDF, до 10 МБ каждый.'; return;
        }
        state.files.push(...next); state.restoredFiles = 0; render(false); return;
      }
      if (element.type === 'radio') {
        const previousKind = data.kind;
        collect(form);
        if (element.name === 'kind' && previousKind !== data.kind) {data.subtype = ''; render(false);}
        else if (element.name === 'start') render(false);
        else {const choice = element.closest('details'); choice.open = false; choice.querySelector('summary span').textContent = element.value || 'Выбрать'; choice.querySelector('summary').focus();}
      } else {collect(form); if (element.name === 'start') render(false);}
    });
    root.addEventListener('click', event => {
      const summary = event.target.closest('.tw-choice > summary');
      if (summary) {
        event.preventDefault();
        const choice = summary.parentElement;
        const open = !choice.open;
        root.querySelectorAll('.tw-choice[open]').forEach(other => { other.open = false; });
        choice.open = open;
        if (open) positionChoice(choice);
        return;
      }
      const button = event.target.closest('button');
      if (!button || busy) return;
      if (button.hasAttribute('data-tw-remove')) {
        const [file] = state.files.splice(Number(button.dataset.twRemove), 1); URL.revokeObjectURL(state.urls.get(file)); state.urls.delete(file); render(false); return;
      }
      if (button.hasAttribute('data-tw-step') || button.hasAttribute('data-tw-back')) {
        collect(form); state.step = button.hasAttribute('data-tw-back') ? Math.max(0, state.step - 1) : Number(button.dataset.twStep); render();
      }
    });
    form.addEventListener('submit', async event => {
      event.preventDefault(); if (busy) return; collect(form);
      if (!validate(state.step)) return;
      if (state.step < 4) {state.step++; render(); return;}
      for (const step of [0, 1, 2]) if (!validate(step)) return;
      busy = true; const button = form.querySelector('button.primary'); button.disabled = true; button.textContent = 'Сохраняем…';
      try {
        const validParams = Object.fromEntries(currentFields().filter(field => String(params()[field.key] || '').trim()).map(field => [field.key, params()[field.key]]));
        await onPublish({...data, params: validParams}, state.files);
        try { storage.setItem(storageKey, '{}'); } catch { /* The tender itself has already been saved. */ }
        memories.delete(draftKey); for (const url of state.urls.values()) URL.revokeObjectURL(url);
      } catch (error) {document.querySelector('#tw-error')?.replaceChildren(document.createTextNode(error.message || 'Не удалось создать тендер. Попробуйте ещё раз.')); button.disabled = false; button.textContent = 'Создать тендер';}
      finally {busy = false;}
    });
    if (focus) {document.querySelector('#tw-step-title')?.setAttribute('tabindex', '-1'); document.querySelector('#tw-step-title')?.focus({preventScroll: true}); document.querySelector('#screen')?.scrollIntoView({block: 'start', behavior: 'instant'});}
  }
  render(false);
  return () => {active = false; detachMenus();};
}
