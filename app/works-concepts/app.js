import {
  variants,
  statuses,
  initialData,
  research,
} from "./data.js?v=20261111-1";

const root = document.querySelector("#app");
const detail = document.querySelector("#detail");
const storageKey = "belkhi-works-concepts-v1";
const snapshotDate = "2026-11-11";
const url = new URL(location.href);
const variant = variants.find(
  (item) => item.id === Number(url.searchParams.get("variant")),
);
let state = readState();
let view = "home";
let projectFilter = "";
let personFilter = "all";
let boardFilter = "doing";
let day = snapshotDate;
let query = "";
let lastTrigger;

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (
      saved?.version === 1 &&
      ["projects", "people", "tasks", "documents", "journal"].every((key) =>
        Array.isArray(saved[key]),
      )
    )
      return saved;
  } catch {}
  return structuredClone(initialData);
}
function saveState() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
    return true;
  } catch {
    notify(
      "Не удалось сохранить изменения. Проверьте доступ к хранилищу браузера.",
    );
    return false;
  }
}
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ],
  );
const money = (value) => new Intl.NumberFormat("ru-RU").format(value) + " ₽";
const project = (id) => state.projects.find((item) => item.id === id);
const person = (id) => state.people.find((item) => item.id === id);
const projectTasks = (id) => state.tasks.filter((task) => task.project === id);
const date = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
const fullDate = (value) =>
  new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
const paths = {
  home: "M3 10 12 3l9 7v11h-6v-7H9v7H3z",
  calendar: "M5 5h14v16H5zM8 2v6m8-6v6M5 10h14",
  board: "M3 4h18v16H3zM9 4v16m6-16v16",
  people:
    "M16 21v-2a5 5 0 0 0-10 0v2M14 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm4 5a5 5 0 0 1 3 5v4",
  file: "M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6",
  plus: "M12 4v16M4 12h16",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  back: "m14 5-7 7 7 7",
  search: "M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1 5 6 6",
  check: "m5 12 4 4L19 6",
  close: "m6 6 12 12M6 18 18 6",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-5v5l3 2",
  photo: "M3 7h4l2-3h6l2 3h4v14H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};
const icon = (name) =>
  '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="' +
  paths[name] +
  '"/></svg>';
const avatar = (id) => {
  const member = person(id);
  return (
    '<span class="avatar ' +
    esc(member?.color || "slate") +
    '" aria-hidden="true">' +
    esc(member?.initials || "—") +
    "</span>"
  );
};
const mark =
  '<svg class="brand-mark" viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" d="M2 15 20 2l18 13v8L20 11 9 19v18H2zM14 22l6-5 18 12v8H14z"/></svg>';
const homeDestination = { 1: "projects", 4: "team", 5: "documents" }[
  variant?.id
];
const nav = [
  ["home", variant?.short || "Обзор", variant?.icon || "home"],
  ["projects", "Объекты", "home"],
  ["tasks", "Задачи", "board"],
  ["team", "Команда", "people"],
  ["documents", "Документы", "file"],
].filter(([id]) => id !== homeDestination);
function plural(count, one, few, many) {
  const end = count % 10;
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return many;
  return end === 1 ? one : end >= 2 && end <= 4 ? few : many;
}
function taskCount(count) {
  return count + " " + plural(count, "задача", "задачи", "задач");
}
function progress(id) {
  const tasks = projectTasks(id);
  const done = tasks.filter((task) => task.status === "done").length;
  return {
    done,
    total: tasks.length,
    percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
  };
}
function progressBar(id) {
  const value = progress(id);
  return (
    '<div class="progress-copy"><span>' +
    value.done +
    " из " +
    value.total +
    " задач</span><b>" +
    value.percent +
    '%</b></div><progress aria-label="Готовность объекта" max="100" value="' +
    value.percent +
    '">' +
    value.percent +
    "%</progress>"
  );
}
function status(task) {
  return (
    '<span class="status ' +
    task.status +
    '">' +
    esc(statuses[task.status]?.label || "Запланировано") +
    "</span>"
  );
}
function activeTasks() {
  return state.tasks.filter(
    (task) =>
      (!projectFilter || task.project === projectFilter) &&
      [task.name, project(task.project)?.name, person(task.assignee)?.name]
        .join(" ")
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
}
function primary(label, action) {
  return (
    '<button class="primary" data-action="' +
    action +
    '">' +
    icon("plus") +
    "<span>" +
    label +
    "</span></button>"
  );
}
function sectionTitle(title, action = "", content = "") {
  return (
    '<div class="section-title"><h2>' +
    title +
    "</h2>" +
    action +
    "</div>" +
    content
  );
}
function projectSelect() {
  return (
    '<label class="project-filter"><span class="sr-only">Объект</span><select id="project-filter" aria-label="Объект"><option value="">Все объекты</option>' +
    state.projects
      .map(
        (item) =>
          '<option value="' +
          item.id +
          '" ' +
          (projectFilter === item.id ? "selected" : "") +
          ">" +
          esc(item.name) +
          "</option>",
      )
      .join("") +
    "</select></label>"
  );
}
function toolBar(extra = "") {
  return '<div class="toolbar">' + projectSelect() + extra + "</div>";
}
function taskRow(task, showProject = true) {
  const member = person(task.assignee);
  return (
    '<button class="task-row" data-task="' +
    task.id +
    '"><span class="task-state ' +
    task.status +
    '" aria-hidden="true">' +
    (task.status === "done" ? icon("check") : "") +
    '</span><span class="task-copy"><strong>' +
    esc(task.name) +
    "</strong><small>" +
    esc(showProject ? project(task.project)?.name + " · " : "") +
    esc(member?.name || "Не назначен") +
    '</small></span><span class="task-tail">' +
    status(task) +
    "<small>" +
    date(task.due) +
    "</small></span></button>"
  );
}
function smallTask(task) {
  return (
    '<button class="small-task" data-task="' +
    task.id +
    '"><span class="task-state ' +
    task.status +
    '" aria-hidden="true">' +
    (task.status === "done" ? icon("check") : "") +
    "</span><span><strong>" +
    esc(task.name) +
    "</strong><small>" +
    esc(person(task.assignee)?.name || "Не назначен") +
    " · " +
    date(task.due) +
    "</small></span>" +
    icon("arrow") +
    "</button>"
  );
}
function empty(message) {
  return '<div class="empty">' + message + "</div>";
}
function attention() {
  const waiting = state.documents.filter((doc) => doc.status === "waiting");
  const reviewing = state.tasks.filter((task) => task.status === "review");
  return (
    '<aside class="attention panel">' +
    sectionTitle("Требует внимания") +
    (reviewing
      .map(
        (task) =>
          '<button class="attention-row" data-task="' +
          task.id +
          '">' +
          icon("photo") +
          "<span><strong>" +
          esc(task.name) +
          "</strong><small>" +
          esc(project(task.project)?.name) +
          " · На приёмке</small></span>" +
          icon("arrow") +
          "</button>",
      )
      .join("") +
      waiting
        .map(
          (doc) =>
            '<button class="attention-row" data-document="' +
            doc.id +
            '">' +
            icon("file") +
            "<span><strong>" +
            esc(doc.name) +
            "</strong><small>" +
            esc(project(doc.project)?.place) +
            " · Ожидается документ</small></span>" +
            icon("arrow") +
            "</button>",
        )
        .join("") ||
      '<p class="muted">Все задачи приняты, документы получены.</p>') +
    '<div class="attention-footer"><span>Демосрез</span><b>11 ноября</b></div></aside>'
  );
}
function projectsView() {
  const items = state.projects.filter(
    (item) =>
      (!projectFilter || item.id === projectFilter) &&
      (item.name + " " + item.place)
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  return (
    toolBar() +
    '<div class="objects-layout"><section class="object-list" aria-label="Объекты">' +
    (items
      .map((item) => {
        const next =
          projectTasks(item.id).find((task) => task.status === "review") ||
          projectTasks(item.id).find((task) => task.status !== "done");
        const documents = state.documents.filter(
          (doc) => doc.project === item.id,
        );
        return (
          '<article class="object-card"><button class="object-heading" data-project="' +
          item.id +
          '"><img src="../media/' +
          item.image +
          '.jpg" alt="' +
          esc(item.name) +
          '"><span><strong>' +
          esc(item.name) +
          "</strong><small>" +
          esc(item.place) +
          " · До " +
          date(item.due) +
          '</small><span class="object-stage">' +
          esc(item.phase) +
          "</span></span>" +
          icon("arrow") +
          '</button><div class="object-body">' +
          progressBar(item.id) +
          '<div class="object-footer"><span>' +
          avatar(item.manager) +
          "<span>" +
          esc(person(item.manager)?.name) +
          '<small>Ответственный</small></span></span><button class="text-button" data-project="' +
          item.id +
          '" data-project-tab="documents">' +
          icon("file") +
          documents.length +
          " док.</button></div>" +
          (next
            ? '<div class="object-next"><small>Ближайшее дело</small>' +
              smallTask(next) +
              "</div>"
            : '<p class="muted">Все задачи выполнены.</p>') +
          "</div></article>"
        );
      })
      .join("") || empty("Объектов по этому запросу нет.")) +
    "</section>" +
    attention() +
    "</div>"
  );
}
function dayView() {
  const tasks = activeTasks()
    .filter((task) => task.due === day && task.status !== "done")
    .sort(
      (a, b) =>
        (a.status === "review" ? -1 : 0) - (b.status === "review" ? -1 : 0) ||
        a.time.localeCompare(b.time),
    );
  const done = activeTasks().filter(
    (task) => task.due === day && task.status === "done",
  ).length;
  return (
    toolBar(
      '<div class="day-picker"><button class="icon-button" data-day="-1" aria-label="Предыдущий день">' +
        icon("back") +
        "</button><span>" +
        fullDate(day) +
        '</span><button class="icon-button" data-day="1" aria-label="Следующий день">' +
        icon("arrow") +
        "</button></div>",
    ) +
    '<div class="day-layout"><section class="day-plan panel">' +
    sectionTitle(
      "План на " + fullDate(day),
      '<span class="muted">' + taskCount(tasks.length) + "</span>",
    ) +
    '<div class="daily-summary"><strong>' +
    tasks.length +
    "</strong><span>осталось на сегодня<br><small>" +
    done +
    " выполнено за этот день</small></span></div>" +
    (tasks
      .map(
        (task) =>
          '<div class="schedule-row"><span class="schedule-time">' +
          esc(task.time) +
          '</span><div class="schedule-item"><button class="schedule-task" data-task="' +
          task.id +
          '">' +
          "<strong>" +
          esc(task.name) +
          "</strong><small>" +
          esc(project(task.project)?.name) +
          " · " +
          esc(person(task.assignee)?.name || "Не назначен") +
          "</small>" +
          '<span class="schedule-result">' +
          status(task) +
          "<span>" +
          esc(
            task.type === "Количество"
              ? (task.amount || 0) + " / " + task.target + " " + task.unit
              : task.type === "Фото"
                ? "Фотоотчёт"
                : task.type === "Текст"
                  ? "Комментарий"
                  : "Отметка выполнения",
          ) +
          "</span></span></button></div></div>",
      )
      .join("") ||
      empty(
        "На этот день нет открытых задач. Перейдите к другому дню или добавьте задачу.",
      )) +
    '</section><aside class="day-aside">' +
    attention() +
    journalView(4) +
    "</aside></div>"
  );
}
function boardView() {
  const tasks = activeTasks();
  return (
    toolBar('<span class="toolbar-note">' + taskCount(tasks.length) + "</span>") +
    '<div class="board-tabs" role="group" aria-label="Статус задач">' +
    Object.entries(statuses)
      .map(
        ([id, value]) =>
          '<button data-board="' +
          id +
          '" aria-pressed="' +
          (boardFilter === id) +
          '">' +
          value.short +
          " <span>" +
          tasks.filter((task) => task.status === id).length +
          "</span></button>",
      )
      .join("") +
    "</div>" +
    '<div class="board" aria-label="Доска задач">' +
    Object.entries(statuses)
      .map(([id, value]) => {
        const column = tasks.filter((task) => task.status === id);
        return (
          '<section class="board-column ' +
          (boardFilter === id ? "mobile-active" : "") +
          '"><div class="column-title"><h2><span class="status-dot ' +
          id +
          '"></span>' +
          value.label +
          "</h2><span>" +
          column.length +
          "</span></div>" +
          (column
            .map(
              (task) =>
                '<button class="kanban-task" data-task="' +
                task.id +
                '"><small>' +
                esc(project(task.project)?.name) +
                "</small><strong>" +
                esc(task.name) +
                "</strong>" +
                (task.type === "Количество"
                  ? '<div class="quantity-track"><progress max="' +
                    task.target +
                    '" value="' +
                    (task.amount || 0) +
                    '"></progress><span>' +
                    (task.amount || 0) +
                    " / " +
                    task.target +
                    " " +
                    esc(task.unit) +
                    "</span></div>"
                  : "") +
                '<div class="kanban-foot">' +
                avatar(task.assignee) +
                "<span>" +
                esc(person(task.assignee)?.name || "Не назначен") +
                "</span><time>" +
                date(task.due) +
                "</time></div></button>",
            )
            .join("") ||
            '<p class="column-empty">Задач в этом статусе нет.</p>') +
          "</section>"
        );
      })
      .join("") +
    "</div>"
  );
}
function teamView() {
  const tasks = state.tasks.filter(
    (task) =>
      task.status !== "done" &&
      (!projectFilter || task.project === projectFilter),
  );
  const members = state.people.filter((member) => {
    const count = tasks.filter((task) => task.assignee === member.id).length;
    return (
      (personFilter === "all" ||
        (personFilter === "free" ? count === 0 : count > 0)) &&
      (member.name + " " + member.role)
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru"))
    );
  });
  return (
    toolBar(
      '<div class="segmented" role="group" aria-label="Загрузка работников">' +
        [
          ["all", "Все"],
          ["busy", "Заняты"],
          ["free", "Свободны"],
        ]
          .map(
            ([id, label]) =>
              '<button data-people="' +
              id +
              '" aria-pressed="' +
              (personFilter === id) +
              '">' +
              label +
              "</button>",
          )
          .join("") +
        "</div>",
    ) +
    '<div class="team-layout"><section class="team-roster panel">' +
    sectionTitle(
      "Работники",
      '<span class="muted">' + members.length + " человек</span>",
    ) +
    '<div class="roster-header"><span>Работник</span><span>Задачи и объекты</span><span>Загрузка</span></div>' +
    (members
      .map((member) => {
        const assigned = tasks.filter((task) => task.assignee === member.id);
        const locations = [
          ...new Set(assigned.map((task) => project(task.project)?.place)),
        ];
        return (
          '<article class="person-row"><button class="person-identity" data-person="' +
          member.id +
          '">' +
          avatar(member.id) +
          "<span><strong>" +
          esc(member.name) +
          "</strong><small>" +
          esc(member.role) +
          "</small></span></button>" +
          '<div class="person-tasks">' +
          (assigned
            .map(
              (task) =>
                '<button data-task="' +
                task.id +
                '">' +
                esc(task.name) +
                "</button>",
            )
            .join("") || '<span class="muted">Можно назначить задачу</span>') +
          "<small>" +
          esc(locations.join(" · ")) +
          "</small></div>" +
          '<div class="person-load"><strong>' +
          assigned.length +
          " <small>" +
          plural(assigned.length, "задача", "задачи", "задач") +
          '</small></strong><div class="load-markers" aria-hidden="true">' +
          Array.from(
            { length: Math.max(3, assigned.length) },
            (_, index) =>
              '<i class="' +
              (index < assigned.length ? "filled" : "") +
              '"></i>',
          ).join("") +
          '</div><button class="text-button" data-action="new-task" data-assignee="' +
          member.id +
          '">Назначить</button></div></article>'
        );
      })
      .join("") || empty("Работников с такой загрузкой нет.")) +
    '</section><aside class="team-side">' +
    sectionTitle("По объектам") +
    state.projects
      .map((item) => {
        const assigned = tasks.filter((task) => task.project === item.id);
        const count = new Set(
          assigned.map((task) => task.assignee).filter(Boolean),
        ).size;
        return (
          '<button class="crew-project" data-project="' +
          item.id +
          '"><span><strong>' +
          esc(item.name) +
          "</strong><small>" +
          count +
          " " +
          plural(count, "работник", "работника", "работников") +
          " · " +
          taskCount(assigned.length) +
          "</small></span>" +
          icon("arrow") +
          "</button>"
        );
      })
      .join("") +
    "</aside></div>"
  );
}
function documentsView() {
  const contracts = state.documents.filter(
    (doc) =>
      doc.kind === "Договор" &&
      (!projectFilter || doc.project === projectFilter),
  );
  const sum = contracts.reduce((total, doc) => total + Number(doc.amount), 0);
  const paid = contracts.reduce((total, doc) => total + Number(doc.paid), 0);
  const rows = state.documents.filter(
    (doc) =>
      (!projectFilter || doc.project === projectFilter) &&
      (doc.name + " " + project(doc.project)?.name)
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  return (
    toolBar() +
    '<div class="finance-strip"><div><span>По договорам</span><strong>' +
    money(sum) +
    "</strong></div><div><span>Получено</span><strong>" +
    money(paid) +
    "</strong></div><div><span>Осталось получить</span><strong>" +
    money(sum - paid) +
    "</strong></div></div>" +
    '<div class="documents-layout"><section class="document-ledger panel">' +
    sectionTitle(
      "Документы",
      '<span class="muted">' + rows.length + " документов</span>",
    ) +
    '<div class="document-header"><span>Документ и объект</span><span>Сумма</span><span>Состояние</span></div>' +
    (rows
      .map(
        (doc) =>
          '<button class="document-row" data-document="' +
          doc.id +
          '"><span class="document-name">' +
          icon("file") +
          "<span><strong>" +
          esc(doc.name) +
          "</strong><small>" +
          esc(project(doc.project)?.name) +
          " · " +
          date(doc.date) +
          "</small></span></span>" +
          '<span class="document-money">' +
          (doc.kind === "Договор" ? money(doc.amount) : "—") +
          "<small>" +
          (doc.kind === "Договор"
            ? "Оплачено " + money(doc.paid)
            : esc(doc.kind)) +
          "</small></span>" +
          '<span class="document-status"><span class="status ' +
          (doc.status === "waiting" ? "review" : "done") +
          '">' +
          (doc.status === "waiting" ? "Ожидается" : "Получен") +
          "</span>" +
          icon("arrow") +
          "</span></button>",
      )
      .join("") || empty("Документов по этому запросу нет.")) +
    '</section><aside class="payment-plan panel">' +
    sectionTitle("Расчёты по объектам") +
    contracts
      .map(
        (doc) =>
          '<div class="payment-item"><button data-document="' +
          doc.id +
          '">' +
          esc(project(doc.project)?.name) +
          icon("arrow") +
          '</button><progress aria-label="Оплаченная часть" max="' +
          Math.max(1, doc.amount) +
          '" value="' +
          doc.paid +
          '"></progress><div><span>' +
          money(doc.paid) +
          "</span><small>из " +
          money(doc.amount) +
          "</small></div></div>",
      )
      .join("") +
    "</aside></div>"
  );
}
function journalView(limit = 8) {
  return (
    '<section class="journal panel">' +
    sectionTitle("Журнал работ") +
    state.journal
      .slice(0, limit)
      .map(
        (item) =>
          '<div><span class="journal-dot"></span><p>' +
          esc(item.text) +
          "<small>" +
          esc(item.at) +
          " · " +
          esc(project(item.project)?.name || "Команда") +
          "</small></p></div>",
      )
      .join("") +
    "</section>"
  );
}
function tasksView() {
  const tasks = activeTasks();
  return (
    toolBar() +
    '<section class="tasks-list panel">' +
    sectionTitle(
      "Все задачи",
      '<span class="muted">' + taskCount(tasks.length) + "</span>",
    ) +
    (tasks.map((task) => taskRow(task)).join("") ||
      empty("Задачи не найдены. Измените поиск или добавьте задачу.")) +
    "</section>"
  );
}
function chooseView() {
  document.title = "Белхи · Пять вариантов «Работ»";
  root.innerHTML =
    '<header class="comparison-header"><a class="brand" href="../#works">' +
    mark +
    'Белхи</a><a class="text-button" href="../#works">Вернуться к приложению ' +
    icon("arrow") +
    "</a></header>" +
    '<main class="comparison"><div class="comparison-intro"><h1>Как удобнее вести стройку?</h1><p>Пять вариантов раздела «Работы». Везде одни объекты, работники и задачи — меняется способ управления.</p><span class="demo-label">Интерактивные варианты · Демоданные</span></div>' +
    '<div class="concepts">' +
    variants
      .map(
        (item) =>
          '<article class="concept concept-' +
          item.id +
          '"><div class="concept-icon">' +
          icon(item.icon) +
          "</div><h2>" +
          esc(item.title) +
          "</h2><p>" +
          esc(item.description) +
          "</p><small>" +
          esc(item.suitable) +
          '</small><a href="?variant=' +
          item.id +
          '">Открыть вариант ' +
          icon("arrow") +
          "</a></article>",
      )
      .join("") +
    "</div>" +
    '<section class="reference-list"><h2>Что изучено в похожих сервисах</h2><div>' +
    research
      .map(
        (item) =>
          '<a href="' +
          item.url +
          '" target="_blank" rel="noopener">' +
          esc(item.title) +
          icon("arrow") +
          "</a>",
      )
      .join("") +
    "</div>" +
    "<p>Варианты используют демонстрационные объекты, работников, документы и оплаты. Все изменения сохраняются только в этом браузере.</p></section></main>";
}
function render() {
  if (!variant) {
    chooseView();
    return;
  }
  const selectedView =
    view === "home"
      ? { 1: "projects", 2: "day", 3: "board", 4: "team", 5: "documents" }[
          variant.id
        ]
      : view;
  const titles = {
    projects: "Объекты",
    day: "Дела на сегодня",
    board: "Доска задач",
    team: "Команда и загрузка",
    documents: "Договоры и расчёты",
    tasks: "Задачи",
  };
  const title = titles[selectedView];
  const action =
    selectedView === "projects"
      ? ["Объект", "new-project"]
      : selectedView === "documents"
        ? ["Документ", "new-document"]
        : selectedView === "team"
          ? ["Работник", "new-person"]
          : ["Задача", "new-task"];
  document.title = "Белхи · " + title + " · " + variant.title;
  document.body.dataset.variant = variant.id;
  root.innerHTML =
    '<div class="concept-ribbon"><a href="?">Все варианты ' +
    icon("arrow") +
    '</a><label><span class="sr-only">Вариант интерфейса</span><select id="variant-choice" aria-label="Вариант интерфейса">' +
    variants
      .map(
        (item) =>
          '<option value="' +
          item.id +
          '" ' +
          (item.id === variant.id ? "selected" : "") +
          ">" +
          item.id +
          " · " +
          esc(item.title) +
          "</option>",
      )
      .join("") +
    "</select></label></div>" +
    '<div class="app-frame"><header class="workspace-top"><a class="brand" href="../#works">' +
    mark +
    'Белхи</a><span class="workspace-name">Строительная команда</span><span class="demo-label">Демо · 11 ноября</span></header>' +
    '<nav class="side-nav" aria-label="Разделы варианта"><div class="workspace-label">Рабочее пространство</div>' +
    nav
      .map(
        ([id, label, symbol]) =>
          '<button data-view="' +
          id +
          '" aria-label="' +
          esc(label) +
          '" title="' +
          esc(label) +
          '" ' +
          (view === id ? 'aria-current="page"' : "") +
          ">" +
          icon(symbol) +
          "<span>" +
          label +
          "</span></button>",
      )
      .join("") +
    '<div class="nav-bottom"><span class="avatar green" aria-hidden="true">МА</span><span>Муса Алиев<small>Прораб · Демо</small></span></div></nav>' +
    '<main class="workspace-sheet"><div class="page-title"><div><h1>' +
    title +
    "</h1><p>" +
    esc(
      view === "home" ? variant.question : "Три объекта строительной команды",
    ) +
    "</p></div>" +
    primary(action[0], action[1]) +
    "</div>" +
    '<div class="search-row"><label class="search">' +
    icon("search") +
    '<span class="sr-only">Поиск в разделе</span><input type="search" id="workspace-search" placeholder="Поиск по названию или человеку" value="' +
    esc(query) +
    '"></label><button class="text-button reset-demo" data-action="reset">Сбросить демо</button></div>' +
    '<div id="work-content">' +
    {
      projects: projectsView,
      day: dayView,
      board: boardView,
      team: teamView,
      documents: documentsView,
      tasks: tasksView,
    }[selectedView]() +
    "</div>" +
    '<footer class="demo-footer">Демонстрационные данные. Задачи, назначения и документы можно менять для проверки интерфейса.</footer></main></div>';
  bindControls();
}
function renderContent() {
  const selectedView =
    view === "home"
      ? { 1: "projects", 2: "day", 3: "board", 4: "team", 5: "documents" }[
          variant.id
        ]
      : view;
  document.querySelector("#work-content").innerHTML = {
    projects: projectsView,
    day: dayView,
    board: boardView,
    team: teamView,
    documents: documentsView,
    tasks: tasksView,
  }[selectedView]();
}
function bindControls() {
  document.querySelector("#workspace-search").oninput = (event) => {
    query = event.target.value;
    renderContent();
  };
  document.querySelector("#variant-choice").onchange = (event) => {
    location.href = "?variant=" + event.target.value;
  };
}
function notify(message) {
  const notice = document.querySelector("#notice");
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(notify.timeout);
  notify.timeout = setTimeout(() => {
    notice.hidden = true;
  }, 3500);
}
function openPanel(kind, id = "", trigger, tab = "") {
  lastTrigger = trigger?.dataset.task
    ? '[data-task="' + trigger.dataset.task + '"]'
    : trigger?.dataset.project
      ? '[data-project="' + trigger.dataset.project + '"]'
      : null;
  const target = new URL(location.href);
  target.hash =
    kind +
    (id ? "=" + encodeURIComponent(id) : "") +
    (tab ? "?tab=" + encodeURIComponent(tab) : "");
  history.pushState({ conceptPanel: true }, "", target);
  paintPanel();
}
function closePanel() {
  if (history.state?.conceptPanel) history.back();
  else {
    const target = new URL(location.href);
    target.hash = "";
    history.replaceState(null, "", target);
    paintPanel();
  }
}
function panelHeader(title) {
  return (
    '<div class="detail-heading"><h2 id="detail-title" tabindex="-1">' +
    esc(title) +
    '</h2><button class="icon-button" data-close-panel aria-label="Закрыть">' +
    icon("close") +
    "</button></div>"
  );
}
function options(items, value) {
  return items
    .map(
      (item) =>
        '<option value="' +
        esc(item.id) +
        '" ' +
        (item.id === value ? "selected" : "") +
        ">" +
        esc(item.name) +
        "</option>",
    )
    .join("");
}
function taskForm(task = {}, assigned = "") {
  return (
    '<form id="task-form">' +
    '<label>Название задачи<input name="name" required maxlength="120" value="' +
    esc(task.name) +
    '" placeholder="Например, проверить армирование"></label>' +
    '<label>Объект<select name="project" aria-label="Объект" required>' +
    options(state.projects, task.project || projectFilter) +
    "</select></label>" +
    '<label>Ответственный<select name="assignee" aria-label="Ответственный"><option value="">Не назначен</option>' +
    options(state.people, task.assignee || assigned) +
    "</select></label>" +
    '<div class="form-pair"><label>Срок<input name="due" type="date" required value="' +
    esc(task.due || day) +
    '"></label><label>Статус<select name="status" aria-label="Статус">' +
    Object.entries(statuses)
      .map(
        ([id, value]) =>
          '<option value="' +
          id +
          '" ' +
          (task.status === id ? "selected" : "") +
          ">" +
          value.label +
          "</option>",
      )
      .join("") +
    "</select></label></div>" +
    '<label>Примечание<textarea name="note" rows="2" maxlength="1000">' +
    esc(task.note) +
    "</textarea></label>" +
    (task.type === "Количество"
      ? "<label>Выполнено, " +
        esc(task.unit) +
        " из " +
        task.target +
        '<input name="amount" type="number" min="0" max="' +
        task.target +
        '" value="' +
        (task.amount || 0) +
        '" required></label>'
      : "") +
    (task.photo
      ? '<figure class="task-photo"><img src="../media/' +
        task.photo +
        '.jpg" alt="Демонстрационное фото работы"><figcaption>Фотоотчёт · Демо</figcaption></figure>'
      : "") +
    '<div class="form-actions"><button class="primary">Сохранить задачу</button></div></form>'
  );
}
function projectPanel(item) {
  const tab =
    new URLSearchParams(location.hash.split("?")[1] || "").get("tab") ||
    "tasks";
  const tasks = projectTasks(item.id);
  const workers = [
    ...new Set(tasks.map((task) => task.assignee).filter(Boolean)),
  ];
  return (
    panelHeader(item.name) +
    '<div class="detail-body"><div class="project-detail-intro"><img src="../media/' +
    item.image +
    '.jpg" alt="' +
    esc(item.name) +
    '"><div><small>' +
    esc(item.place) +
    "</small><strong>" +
    esc(item.phase) +
    "</strong><span>До " +
    date(item.due) +
    "</span></div></div>" +
    progressBar(item.id) +
    '<div class="detail-tabs" role="group" aria-label="Сведения об объекте">' +
    [
      ["tasks", "Задачи", tasks.length],
      ["people", "Команда", workers.length],
      [
        "documents",
        "Документы",
        state.documents.filter((doc) => doc.project === item.id).length,
      ],
    ]
      .map(
        ([id, title, count]) =>
          '<button data-project-tab-choice="' +
          id +
          '" data-id="' +
          item.id +
          '" aria-pressed="' +
          (tab === id) +
          '">' +
          title +
          " " +
          count +
          "</button>",
      )
      .join("") +
    "</div>" +
    (tab === "tasks"
      ? tasks.map((task) => taskRow(task, false)).join("") ||
        empty("Пока нет задач.")
      : tab === "people"
        ? workers
            .map(
              (id) =>
                '<button class="person-detail-row" data-person="' +
                id +
                '">' +
                avatar(id) +
                "<span><strong>" +
                esc(person(id)?.name) +
                "</strong><small>" +
                esc(person(id)?.role) +
                "</small></span>" +
                icon("arrow") +
                "</button>",
            )
            .join("") || empty("Пока никто не назначен.")
        : state.documents
            .filter((doc) => doc.project === item.id)
            .map(
              (doc) =>
                '<button class="attention-row" data-document="' +
                doc.id +
                '">' +
                icon("file") +
                "<span><strong>" +
                esc(doc.name) +
                "</strong><small>" +
                (doc.status === "waiting" ? "Ожидается" : "Получен") +
                "</small></span>" +
                icon("arrow") +
                "</button>",
            )
            .join("") || empty("Документов пока нет.")) +
    "</div>"
  );
}
function documentPanel(doc) {
  const item = project(doc.project);
  return (
    panelHeader(doc.name) +
    '<div class="detail-body"><div class="document-paper"><span class="paper-mark">' +
    icon("file") +
    " Белхи · Демо</span><h3>" +
    esc(doc.kind) +
    "</h3><p>" +
    esc(doc.name) +
    "</p><dl><div><dt>Объект</dt><dd>" +
    esc(item?.name) +
    "</dd></div><div><dt>Место</dt><dd>" +
    esc(item?.place) +
    "</dd></div><div><dt>Дата</dt><dd>" +
    fullDate(doc.date) +
    "</dd></div>" +
    (doc.kind === "Договор"
      ? "<div><dt>Стоимость работ</dt><dd>" +
        money(doc.amount) +
        "</dd></div><div><dt>Получено</dt><dd>" +
        money(doc.paid) +
        "</dd></div><div><dt>Остаток</dt><dd>" +
        money(doc.amount - doc.paid) +
        "</dd></div>"
      : "") +
    "<div><dt>Состояние</dt><dd>" +
    (doc.status === "waiting" ? "Ожидается документ" : "Документ получен") +
    '</dd></div></dl><p class="paper-disclaimer">Демонстрационная карточка документа для выбора интерфейса.</p></div>' +
    '<div class="form-actions"><button class="secondary" data-download="' +
    doc.id +
    '">Скачать карточку · TXT</button>' +
    (doc.status === "waiting"
      ? '<button class="primary" data-receive="' +
        doc.id +
        '">Отметить полученным</button>'
      : "") +
    "</div></div>"
  );
}
function newDocumentForm() {
  return (
    panelHeader("Добавить документ") +
    '<div class="detail-body"><form id="document-form"><label>Название<input name="name" required maxlength="120" placeholder="Например, акт по фундаменту"></label><label>Объект<select name="project" aria-label="Объект">' +
    options(state.projects, projectFilter) +
    '</select></label><label>Тип<select name="kind" aria-label="Тип"><option>Договор</option><option>Акт</option><option>Смета</option></select></label><label>Сумма договора, ₽<input name="amount" type="number" min="0" max="1000000000" value="0" required></label><p class="form-note">Демодокумент сохранится в этом браузере.</p><div class="form-actions"><button class="primary">Добавить документ</button></div></form></div>'
  );
}
function paintPanel() {
  const [route, param = ""] = location.hash.slice(1).split("=");
  const id = decodeURIComponent(param.split("?")[0]);
  let body = "";
  if (route === "task") {
    const task = state.tasks.find((item) => item.id === id);
    if (task)
      body =
        panelHeader("Задача") +
        '<div class="detail-body"><p class="detail-context">' +
        esc(project(task.project)?.name) +
        " · " +
        status(task) +
        "</p>" +
        taskForm(task) +
        "</div>";
  }
  if (route === "new-task")
    body =
      panelHeader("Новая задача") +
      '<div class="detail-body">' +
      taskForm({}, id) +
      "</div>";
  if (route === "project") {
    const item = project(id);
    if (item) body = projectPanel(item);
  }
  if (route === "document") {
    const doc = state.documents.find((item) => item.id === id);
    if (doc) body = documentPanel(doc);
  }
  if (route === "new-document") body = newDocumentForm();
  if (route === "person") {
    const member = person(id);
    if (member)
      body =
        panelHeader(member.name) +
        '<div class="detail-body"><div class="member-intro">' +
        avatar(id) +
        "<div><strong>" +
        esc(member.role) +
        "</strong><small>Назначенные задачи</small></div></div>" +
        (state.tasks
          .filter((task) => task.assignee === id)
          .map((task) => taskRow(task))
          .join("") || empty("Задач пока нет.")) +
        '<div class="form-actions">' +
        primary("Назначить задачу", "new-task") +
        "</div></div>";
  }
  if (route === "new-person")
    body =
      panelHeader("Добавить работника") +
      '<div class="detail-body"><form id="person-form"><label>Имя и фамилия<input name="name" required maxlength="70"></label><label>Специальность<input name="role" required maxlength="70" placeholder="Например, штукатур"></label><p class="form-note">Работник будет добавлен в демонстрационную команду.</p><div class="form-actions"><button class="primary">Добавить работника</button></div></form></div>';
  if (route === "new-project")
    body =
      panelHeader("Новый объект") +
      '<div class="detail-body"><form id="project-form"><label>Название<input name="name" required maxlength="90" placeholder="Например, отделка дома"></label><label>Город или село<input name="place" required maxlength="90"></label><label>Срок<input name="due" type="date" required value="' +
      snapshotDate +
      '"></label><label>Ответственный<select name="manager" aria-label="Ответственный">' +
      options(state.people, "musa") +
      '</select></label><div class="form-actions"><button class="primary">Создать объект</button></div></form></div>';
  if (route === "reset")
    body =
      panelHeader("Сбросить демоданные?") +
      '<div class="detail-body"><p>Все изменения в пяти вариантах будут заменены исходными примерами.</p><div class="form-actions"><button class="secondary" data-close-panel>Отмена</button><button class="primary" data-reset-confirm>Сбросить демо</button></div></div>';
  if (body) {
    detail.innerHTML = body;
    if (!detail.open) detail.showModal();
    else detail.querySelector("#detail-title").focus({ preventScroll: true });
  } else if (detail.open) {
    detail.close();
    if (lastTrigger)
      document.querySelector(lastTrigger)?.focus({ preventScroll: true });
  }
}
function addLog(text, projectId) {
  state.journal.unshift({
    id: crypto.randomUUID(),
    text,
    project: projectId,
    at: "Изменение в демо",
  });
}
function commitChange(message) {
  saveState();
  const scroll = window.scrollY;
  render();
  window.scrollTo(0, scroll);
  closePanel();
  notify(message);
}
document.addEventListener("change", (event) => {
  if (event.target.id === "project-filter") {
    projectFilter = event.target.value;
    renderContent();
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-close-panel")) {
    closePanel();
    return;
  }
  if (button.dataset.view) {
    view = button.dataset.view;
    query = "";
    projectFilter = "";
    render();
    window.scrollTo(0, 0);
    return;
  }
  if (button.dataset.board) {
    boardFilter = button.dataset.board;
    renderContent();
    return;
  }
  if (button.dataset.people) {
    personFilter = button.dataset.people;
    renderContent();
    return;
  }
  if (button.dataset.day) {
    const next = new Date(day + "T12:00:00Z");
    next.setUTCDate(next.getUTCDate() + Number(button.dataset.day));
    day = next.toISOString().slice(0, 10);
    renderContent();
    return;
  }
  if (button.dataset.projectTabChoice) {
    history.replaceState(
      history.state,
      "",
      "#project=" +
        button.dataset.id +
        "?tab=" +
        button.dataset.projectTabChoice,
    );
    paintPanel();
    return;
  }
  if (button.dataset.task) {
    openPanel("task", button.dataset.task, button);
    return;
  }
  if (button.dataset.document) {
    openPanel("document", button.dataset.document, button);
    return;
  }
  if (button.dataset.project) {
    openPanel(
      "project",
      button.dataset.project,
      button,
      button.dataset.projectTab || "",
    );
    return;
  }
  if (button.dataset.person) {
    openPanel("person", button.dataset.person, button);
    return;
  }
  if (button.dataset.action) {
    const assignee =
      button.dataset.assignee ||
      (location.hash.startsWith("#person=") ? location.hash.slice(8) : "");
    openPanel(
      button.dataset.action,
      button.dataset.action === "new-task" ? assignee : "",
      button,
    );
    return;
  }
  if (button.dataset.receive) {
    const doc = state.documents.find(
      (item) => item.id === button.dataset.receive,
    );
    doc.status = "received";
    addLog("Получен документ · " + doc.name, doc.project);
    commitChange("Демодокумент отмечен полученным.");
  }
  if (button.dataset.download) {
    const doc = state.documents.find(
      (item) => item.id === button.dataset.download,
    );
    const file = new Blob(
      [
        "Белхи · Демонстрационная карточка\n\n" +
          doc.name +
          "\nОбъект: " +
          project(doc.project)?.name +
          "\nДата: " +
          doc.date +
          (doc.kind === "Договор"
            ? "\nСтоимость: " +
              money(doc.amount) +
              "\nПолучено: " +
              money(doc.paid)
            : "") +
          "\nСостояние: " +
          (doc.status === "waiting" ? "Ожидается" : "Получен"),
      ],
      { type: "text/plain;charset=utf-8" },
    );
    const anchor = document.createElement("a");
    const objectURL = URL.createObjectURL(file);
    anchor.href = objectURL;
    anchor.download = "Белхи — " + doc.name + ".txt";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
  }
  if (button.hasAttribute("data-reset-confirm")) {
    state = structuredClone(initialData);
    saveState();
    render();
    closePanel();
    notify("Исходные примеры восстановлены.");
  }
});
detail.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const id = crypto.randomUUID();
  const name = String(data.name || "").trim();
  if (!name) {
    notify("Введите название.");
    return;
  }
  if (form.id === "task-form") {
    const existingId = location.hash.startsWith("#task=")
      ? decodeURIComponent(location.hash.slice(6))
      : "";
    const task = state.tasks.find((item) => item.id === existingId);
    const updates = {
      name,
      project: data.project,
      assignee: data.assignee,
      due: data.due,
      status: data.status,
      note: String(data.note || "").trim(),
    };
    if (task?.type === "Количество")
      updates.amount =
        data.status === "done" ? task.target : Number(data.amount);
    if (task) Object.assign(task, updates);
    else state.tasks.push({ id, type: "Галочка", time: "09:00", ...updates });
    addLog(
      (task ? "Обновлена задача · " : "Добавлена задача · ") + name,
      data.project,
    );
    commitChange("Задача сохранена в демоверсии.");
  }
  if (form.id === "document-form") {
    state.documents.push({
      id,
      name,
      project: data.project,
      kind: data.kind,
      amount: data.kind === "Договор" ? Number(data.amount) : 0,
      paid: 0,
      status: "waiting",
      date: snapshotDate,
    });
    addLog("Добавлен документ · " + name, data.project);
    commitChange("Демодокумент добавлен.");
  }
  if (form.id === "person-form") {
    const initials = name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
    state.people.push({
      id,
      name,
      role: String(data.role || "").trim(),
      initials,
      color: ["green", "blue", "sand", "slate", "rose"][
        state.people.length % 5
      ],
    });
    commitChange("Работник добавлен в демонстрационную команду.");
  }
  if (form.id === "project-form") {
    state.projects.push({
      id,
      name,
      place: String(data.place || "").trim(),
      due: data.due,
      manager: data.manager,
      image: "site",
      phase: "Подготовка",
      budget: 0,
    });
    commitChange("Демообъект создан.");
  }
});
detail.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePanel();
});
detail.addEventListener("click", (event) => {
  if (event.target === detail) closePanel();
});
window.addEventListener("popstate", paintPanel);
window.addEventListener("hashchange", paintPanel);
window.addEventListener("storage", (event) => {
  if (event.key === storageKey && !detail.open) {
    state = readState();
    render();
  }
});
render();
if (variant) paintPanel();
