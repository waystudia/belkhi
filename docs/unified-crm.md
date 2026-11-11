# Единая CRM «Работы»

Вход: `#works`. Обзор объектов, Сегодня (план / журнал), Задачи (доска / список), Команда, Документы (договоры / акты / сметы). Один фильтр объекта сохраняется при переключении разделов. На телефоне внутренние вкладки и меню всех разделов; на ПК — боковое меню. Внешнее меню приложения не меняет назначение.

Компоненты используют общий `design-tokens.css`: Golos Text, зелёный #008449, единые цвета текста, поля и радиусы. CRM изолирована в same-origin frame, чтобы стили прежних форм не переопределяли новые элементы. Основная навигация и аккаунт принадлежат оболочке приложения.

## Данные

CRM работает локально. Хранилище `belkhi-unified-crm-v1/<accountKey(workspace)>` разделено по аккаунту. Облачной и межустройственной синхронизации нет. Не является серверной многопользовательской CRM. Импорт существующих объектов, этапов, задач, журнала и команды происходит однократно по исходному ID; оригинальные IndexedDB записи сохраняются. Новые объекты и изменения ведутся в новой CRM. «Прежняя карточка» остаётся доступна у импортированных объектов для субподряда и откликов; она не синхронизирует дальнейшие изменения с новой CRM.

Счётчики/объёмы считаются из задач, оплаты — из договоров. Сумма оплаты не может превышать остаток. Изменения, назначения, оплаты и записи журнала доступны в обеих адаптивных версиях. Файлы JPG/PNG/WebP/PDF до 5 МБ сохраняются локально; ограничение квоты браузера показывается пользователю без сообщения об успешном сохранении. Карточка договора TXT — учётная, не юридический шаблон; оригинальный загруженный файл можно открыть, скачать или отправить через системное меню (при отсутствии поддержки — скачать).

## Проверки

`tests/unified-crm-responsive.cjs`: 319/390/768/800/1024/1440 (включая 319×509), все разделы, переполнение, запись журнала.
`tests/unified-crm-flows.cjs`: работник, назначение, количественная задача, комментарии/чек-лист, возврат из карточки, договор, оплата, перезагрузка.

Требуется Playwright; при внешней установке задайте `PLAYWRIGHT_MODULE` и при необходимости `CHROMIUM_PATH`. Аргумент теста — адрес приложения (по умолчанию localhost:4182).

## Reference design refinement · 12 November 2026

The approved desktop and mobile boards are the visual source: white surfaces,
green primary actions, mint selection, Golos Text, compact forms and thin rules.
`workspace-crm/reference.css` contains the responsive composition. Shared palette
values live in `design-tokens.css` and also apply to the surrounding application.

- One project selector stays visible across all five sections.
- Objects use aligned desktop rows and mobile cards. Today includes a week/date
  selector, plan/journal switch and desktop journal sidebar.
- Task read view is separate from editing; status changes use a bottom sheet on
  mobile. Checklists and comments save from the read view. Edit and nested Back
  preserve the underlying task or project context.
- Team assignment uses the desktop inspector or mobile form. Worker photos can
  be uploaded; initials remain the fallback when no photo was provided.
- Documents show totals, payment progress and a desktop accounting-card preview.
  Actual files and payments continue using the existing local persistence.
- Project photos aggregate the task photo reports; photos link back to tasks.

Validation: `tests/unified-crm-reference.cjs` uses an isolated seeded browser scope
for populated layouts at 319, 390, 768, 1024 and 1440px. It also exercises status,
checklist, comment, assignment, calendar and nested photo-tab return. Existing
responsive and create/edit/payment tests cover the actual embedded application.
These changes do not add cloud synchronization or electronic signatures.
