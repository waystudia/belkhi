import { statuses, initialData } from "./data.js?v=20261111-crm-1";
import {
  serviceAreas as servicePlaces,
  serviceRegion,
} from "../service-places.js?v=20261111-2";
const root = document.querySelector("#app");
const detail = document.querySelector("#detail");
const scope = new URL(location.href).searchParams.get("scope") || "guest";
const storageKey = "belkhi-unified-crm-v1/" + scope;
const snapshotDate = new Date().toLocaleDateString("en-CA");
const url = new URL(location.href);
const variant = {
  id: 1,
  title: "Работы",
  question: "Объекты, задачи и команда",
};
let state = readState();
let view = "projects";
let dayTab = "plan";
let taskMode = "board";
let documentKind = "all";
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
const nav = [
  ["projects", "Обзор", "home"],
  ["day", "Сегодня", "calendar"],
  ["tasks", "Задачи", "board"],
  ["team", "Команда", "people"],
  ["documents", "Документы", "file"],
];
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
  const waiting = state.documents.filter(
    (doc) =>
      doc.status === "waiting" &&
      (!projectFilter || doc.project === projectFilter),
  );
  const reviewing = activeTasks().filter((task) => task.status === "review");
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
      '<p class="muted">Нет задач на приёмке и ожидаемых документов.</p>') +
    "</aside>"
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
    toolBar(
      '<span class="toolbar-note">' + taskCount(tasks.length) + "</span>",
    ) +
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
      (documentKind === "all" || doc.kind === documentKind) &&
      (!projectFilter || doc.project === projectFilter) &&
      (doc.name + " " + project(doc.project)?.name)
        .toLocaleLowerCase("ru")
        .includes(query.toLocaleLowerCase("ru")),
  );
  return (
    toolBar() +
    '<div class="segmented document-types">' +
    ["all", "Договор", "Акт", "Смета"]
      .map(
        (k) =>
          '<button data-document-kind="' +
          k +
          '" aria-pressed="' +
          (documentKind === k) +
          '">' +
          (k === "all" ? "Все" : k) +
          "</button>",
      )
      .join("") +
    "</div>" +
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
      .filter(
        (item) =>
          (!projectFilter || item.project === projectFilter) &&
          (!query || item.text.toLowerCase().includes(query.toLowerCase())),
      )
      .slice(0, limit)
      .map(
        (item) =>
          '<div><span class="journal-dot"></span><p>' +
          (item.photo
            ? '<img class="journal-photo" src="' +
              esc(item.photo.url) +
              '" alt="Фото записи">'
            : "") +
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
function currentContent() {
  if (view === "day")
    return (
      '<div class="segmented day-switch"><button data-day-tab="plan" aria-pressed="' +
      (dayTab === "plan") +
      '">План</button><button data-day-tab="journal" aria-pressed="' +
      (dayTab === "journal") +
      '">Журнал</button></div>' +
      (dayTab === "journal"
        ? toolBar(primary("Запись", "new-journal")) + journalView(1000)
        : dayView())
    );
  if (view === "tasks")
    return (
      '<div class="segmented task-switch"><button data-task-mode="board" aria-pressed="' +
      (taskMode === "board") +
      '">Доска</button><button data-task-mode="list" aria-pressed="' +
      (taskMode === "list") +
      '">Список</button></div>' +
      (taskMode === "board" ? boardView() : tasksView())
    );
  if (view === "projects")
    return (
      projectsView() +
      '<details class="offers-list"><summary>Отправленные отклики · ' +
      (state.offers || []).length +
      "</summary>" +
      (state.offers || [])
        .map(
          (o) =>
            '<button class="attention-row" data-offer="' +
            esc(o.id) +
            '">' +
            esc(o.name) +
            "<small>" +
            esc(o.status) +
            "</small></button>",
        )
        .join("") +
      "</details>"
    );
  return { projects: projectsView, team: teamView, documents: documentsView }[
    view
  ]();
}
function render() {
  document.title = "Работы · Белхи";
  document.body.dataset.variant = "1";
  const action =
    view === "projects"
      ? ["Объект", "new-project"]
      : view === "team"
        ? ["Работник", "new-person"]
        : view === "documents"
          ? ["Документ", "new-document"]
          : ["Задача", "new-task"];
  root.innerHTML =
    '<div class="crm-shell"><header class="crm-heading"><h1>Работы</h1><span class="local-label">На этом устройстве</span><button class="icon-button" data-menu aria-label="Все разделы CRM">' +
    icon("more") +
    '</button></header><nav class="crm-nav" aria-label="Разделы CRM">' +
    nav
      .map(
        ([id, label, symbol]) =>
          '<button data-view="' +
          id +
          '" aria-current="' +
          (view === id ? "page" : "false") +
          '">' +
          icon(symbol) +
          "<span>" +
          label +
          "</span></button>",
      )
      .join("") +
    '</nav><main class="crm-content"><div class="page-title"><h2>' +
    nav.find((n) => n[0] === view)[1] +
    "</h2>" +
    primary(...action) +
    '</div><div class="search-row"><label class="search">' +
    icon("search") +
    '<span class="sr-only">Поиск в разделе</span><input id="workspace-search" type="search" placeholder="Название или человек" value="' +
    esc(query) +
    '"></label></div><div id="work-content">' +
    currentContent() +
    '</div><p class="crm-storage-note">Данные сохраняются в этом браузере. Облачная синхронизация не подключена.</p></main></div>';
  document.querySelector("#workspace-search").oninput = (e) => {
    query = e.target.value;
    renderContent();
    remember();
  };
  const active = document.querySelector('.crm-nav [aria-current="page"]');
  const menu = active?.parentElement;
  if (active && menu)
    menu.scrollLeft = Math.max(0, active.offsetLeft - menu.offsetLeft - 12);
}
function renderContent() {
  document.querySelector("#work-content").innerHTML = currentContent();
}
function snapshot() {
  return {
    view,
    projectFilter,
    personFilter,
    boardFilter,
    day,
    query,
    dayTab,
    taskMode,
    documentKind,
    scroll: window.scrollY,
  };
}
function remember() {
  const crm = snapshot();
  history.replaceState({ ...history.state, crm }, "");
  try {
    sessionStorage.setItem(storageKey + "/navigation", JSON.stringify(crm));
  } catch {}
}
function restore() {
  let v = history.state?.crm;
  if (!v) {
    try {
      v = JSON.parse(sessionStorage.getItem(storageKey + "/navigation"));
    } catch {}
  }
  if (v) {
    ({
      view,
      projectFilter,
      personFilter,
      boardFilter,
      day,
      query,
      dayTab,
      taskMode,
      documentKind = "all",
    } = v);
  }
  render();
  paintPanel();
  if (v) requestAnimationFrame(() => window.scrollTo(0, v.scroll || 0));
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
  remember();
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
  history.pushState({ conceptPanel: true, crm: snapshot() }, "", target);
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
        '.jpg" alt="Демонстрационное фото работы"><figcaption>Фотоотчёт</figcaption></figure>'
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
    '</dd></div></dl><p class="paper-disclaimer">Учётная карточка. Не заменяет подписанный договор.</p></div>' +
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
    '</select></label><label>Тип<select name="kind" aria-label="Тип"><option>Договор</option><option>Акт</option><option>Смета</option></select></label><label>Сумма договора, ₽<input name="amount" type="number" min="0" max="1000000000" value="0" required></label><p class="form-note">Документ сохранится на этом устройстве.</p><div class="form-actions"><button class="primary">Добавить документ</button></div></form></div>'
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
      '<div class="detail-body"><form id="person-form"><label>Имя и фамилия<input name="name" required maxlength="70"></label><label>Специальность<input name="role" required maxlength="70" placeholder="Например, штукатур"></label><p class="form-note">Работник будет доступен для назначения на задачи.</p><div class="form-actions"><button class="primary">Добавить работника</button></div></form></div>';
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
  body = extendPanel(route, id, body);
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
    at: new Date().toLocaleString("ru-RU"),
  });
}
function commitChange(message) {
  if (!saveState()) {
    state = readState();
    return;
  }
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
    remember();
  }
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-close-panel")) {
    closePanel();
    return;
  }
  if (extraClick(button)) return;
  if (button.dataset.view) {
    remember();
    view = button.dataset.view;
    query = "";
    history.pushState(
      { crm: snapshot() },
      "",
      location.pathname + location.search,
    );
    render();
    window.scrollTo(0, 0);
    remember();
    return;
  }
  if (button.dataset.board) {
    boardFilter = button.dataset.board;
    remember();
    renderContent();
    return;
  }
  if (button.dataset.people) {
    personFilter = button.dataset.people;
    remember();
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
    commitChange("Документ отмечен полученным.");
  }
  if (button.dataset.download) {
    const doc = state.documents.find(
      (item) => item.id === button.dataset.download,
    );
    const file = new Blob(
      [
        "Белхи · Учётная карточка\n\n" +
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
detail.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const id = crypto.randomUUID();
  const name = String(data.name || "").trim();
  if (await extraSubmit(form, data)) return;
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
    commitChange("Задача сохранена.");
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
    commitChange("Документ добавлен.");
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
    commitChange("Работник добавлен.");
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
      budget: Number(data.budget) || 0,
      stages: String(data.stages || "Подготовка")
        .split("\n")
        .map((name) => ({ id: crypto.randomUUID(), name: name.trim() }))
        .filter((s) => s.name),
    });
    commitChange("Объект создан.");
  }
});
detail.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePanel();
});
detail.addEventListener("click", (event) => {
  if (event.target === detail) closePanel();
});
window.addEventListener("popstate", restore);
window.addEventListener("hashchange", paintPanel);
window.addEventListener("storage", (event) => {
  if (event.key === storageKey && !detail.open) {
    state = readState();
    render();
  }
});
async function initializeWorkspace() {
  if (window.parent === window) return;
  const input = await new Promise((resolve) => {
    window.addEventListener("message", function receive(e) {
      if (
        e.source !== parent ||
        e.origin !== location.origin ||
        e.data?.type !== "belkhi-crm-init"
      )
        return;
      window.removeEventListener("message", receive);
      resolve(e.data);
    });
    parent.postMessage({ type: "belkhi-crm-ready" }, location.origin);
  });
  const saved = localStorage.getItem(storageKey);
  if (!saved)
    state = {
      version: 1,
      projects: [],
      people: [],
      tasks: [],
      documents: [],
      journal: [],
    };
  state.offers = input.offers || [];
  state.imported ||= [];
  for (const member of input.people || [])
    if (!state.people.some((p) => p.id === member.id))
      state.people.push({
        ...member,
        role: member.job,
        initials: member.name
          .split(/\s+/)
          .map((x) => x[0])
          .slice(0, 2)
          .join(""),
        color: "green",
      });
  for (const item of input.jobs || []) {
    if (state.imported.includes(item.id)) continue;
    state.imported.push(item.id);
    const phases = item.plan || [];
    state.projects.push({
      id: item.id,
      name: item.kind.replace(/^Демо · /, ""),
      place: item.district || "",
      image: item.photo || "site",
      manager: "",
      due: item.due || snapshotDate,
      phase:
        phases.find((x) => x.tasks?.some((t) => !t.done))?.name || "Подготовка",
      budget: Number(item.budget) || 0,
      legacy: true,
      demo: !!item.demo,
      stages: phases.map((x) => ({ id: x.id, name: x.name })),
    });
    for (const stage of phases)
      for (const task of stage.tasks || [])
        state.tasks.push({
          ...task,
          id: item.id + "/" + task.id,
          legacyId: task.id,
          project: item.id,
          stage: stage.name,
          status: task.done ? "done" : "planned",
          assignee: task.assignee || "",
          due: task.due || snapshotDate,
          amount: Number(task.count) || 0,
          time: "09:00",
        });
    for (const log of item.log || [])
      state.journal.push({
        id: crypto.randomUUID(),
        project: item.id,
        text: log.text,
        photo: /^data:image\/(jpeg|png|webp);base64,/.test(log.photo || "")
          ? { url: log.photo, name: "Фото отчёта" }
          : null,
        at: new Date(log.at).toLocaleString("ru-RU"),
      });
  }
  if (!activeTasks().some((t) => t.status === boardFilter))
    boardFilter = "planned";
  saveState();
}
function inputFile(label, name, accept) {
  return (
    "<label>" +
    label +
    '<input type="file" name="' +
    name +
    '" accept="' +
    accept +
    '"></label>'
  );
}
async function readFile(file) {
  if (!file?.size) return null;
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    )
  )
    throw Error("Выберите JPG, PNG, WebP или PDF.");
  if (file.size > 5 * 1024 * 1024)
    throw Error("Файл слишком большой. Максимум 5 МБ.");
  return {
    name: file.name,
    type: file.type,
    url: await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(Error("Не удалось прочитать файл."));
      r.readAsDataURL(file);
    }),
  };
}
function attachment(file) {
  return file &&
    /^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(file.url)
    ? '<div class="form-actions"><a class="secondary file-link" href="' +
        esc(file.url) +
        '" target="_blank" rel="noopener">Открыть · ' +
        esc(file.name) +
        '</a><a class="secondary file-link" href="' +
        esc(file.url) +
        '" download="' +
        esc(file.name) +
        '">Скачать файл</a></div>'
    : "";
}
function extendPanel(route, id, body) {
  if (route === "edit-project") {
    const p = project(id);
    if (!p) return "";
    return (
      panelHeader("Редактировать объект") +
      '<div class="detail-body"><form id="edit-project-form" data-id="' +
      esc(id) +
      '"><label>Название<input name="name" required maxlength="100" value="' +
      esc(p.name) +
      '"></label><label>Город или село<input name="place" required list="crm-places" value="' +
      esc(p.place) +
      '"></label><datalist id="crm-places">' +
      [{ name: serviceRegion }, ...servicePlaces]
        .map((p) => '<option value="' + esc(p.name) + '"></option>')
        .join("") +
      '</datalist><label>Текущий этап<input name="phase" value="' +
      esc(p.phase) +
      '" maxlength="100"></label><label>Срок<input name="due" type="date" required value="' +
      esc(p.due) +
      '"></label><label>Ответственный<select name="manager"><option value="">Не назначен</option>' +
      options(state.people, p.manager) +
      '</select></label><label>Бюджет, ₽<input name="budget" type="number" min="0" value="' +
      (p.budget || 0) +
      '"></label><button class="primary">Сохранить объект</button></form></div>'
    );
  }
  if (route === "menu")
    return (
      panelHeader("Разделы CRM") +
      '<div class="detail-body section-menu">' +
      nav
        .map(
          ([v, n, i]) =>
            '<button data-navigate="' +
            v +
            '">' +
            icon(i) +
            n +
            icon("arrow") +
            "</button>",
        )
        .join("") +
      "</div>"
    );
  if (route === "new-journal")
    return (
      panelHeader("Запись в журнал") +
      '<div class="detail-body"><form id="journal-form"><label>Объект<select name="project">' +
      options(state.projects, projectFilter) +
      '</select></label><label>Что сделано<textarea name="name" required maxlength="1500" rows="4"></textarea></label>' +
      inputFile("Фото", "photo", "image/jpeg,image/png,image/webp") +
      '<button class="primary">Добавить запись</button></form></div>'
    );
  if (route === "payment") {
    const d = state.documents.find((d) => d.id === id);
    if (!d) return "";
    return (
      panelHeader("Добавить оплату") +
      '<div class="detail-body"><p>' +
      esc(d.name) +
      " · остаток " +
      money(d.amount - d.paid) +
      '</p><form id="payment-form" data-id="' +
      esc(id) +
      '"><label>Сумма, ₽<input name="amount" required type="number" min="0.01" step="0.01" max="' +
      (d.amount - d.paid) +
      '"></label><label>Дата<input type="date" name="date" required value="' +
      snapshotDate +
      '"></label><label>Способ<select name="method"><option>Перевод</option><option>Наличные</option></select></label><label>Комментарий<textarea name="note" maxlength="500"></textarea></label>' +
      inputFile("Квитанция", "receipt", "image/*,application/pdf") +
      '<button class="primary">Сохранить оплату</button></form></div>'
    );
  }
  if (route === "task" || route === "new-task") {
    const t = state.tasks.find((t) => t.id === id) || {};
    const extras =
      '<label>Этап<input name="stage" maxlength="100" value="' +
      esc(t.stage) +
      '" placeholder="Например, фундамент"></label><div class="form-pair"><label>Время<input type="time" name="time" value="' +
      esc(t.time || "09:00") +
      '"></label><label>Тип задачи<select name="type"><option ' +
      (t.type === "Галочка" ? "selected" : "") +
      ">Галочка</option><option " +
      (t.type === "Количество" ? "selected" : "") +
      ">Количество</option><option " +
      (t.type === "Фото" ? "selected" : "") +
      ">Фото</option><option " +
      (t.type === "Текст" ? "selected" : "") +
      '>Текст</option></select></label></div><div class="form-pair"><label>Плановый объём<input type="number" name="target" min="1" value="' +
      (t.target || 1) +
      '"></label><label>Единица<input name="unit" value="' +
      esc(t.unit || "м²") +
      '" maxlength="12"></label></div><div class="checklist-items">' +
      (t.checklist || [])
        .map(
          (c) =>
            '<label><input type="checkbox" name="completedItem" value="' +
            esc(c.text) +
            '" ' +
            (c.done ? "checked" : "") +
            ">" +
            esc(c.text) +
            "</label>",
        )
        .join("") +
      '</div><label>Пункты чек-листа · один на строку<textarea name="checklist" maxlength="1500">' +
      esc((t.checklist || []).map((c) => c.text).join("\n")) +
      "</textarea></label>" +
      inputFile("Фотоотчёт", "upload", "image/jpeg,image/png,image/webp") +
      (t.upload
        ? '<img class="report-image" src="' +
          esc(t.upload.url) +
          '" alt="Фотоотчёт">'
        : "") +
      '<div class="task-comments">' +
      (t.comments || [])
        .map(
          (c) => "<p>" + esc(c.text) + "<small>" + esc(c.at) + "</small></p>",
        )
        .join("") +
      '</div><label>Новый комментарий<textarea name="comment" maxlength="1000"></textarea></label>';
    return body.replace(
      '<div class="form-actions">',
      extras + '<div class="form-actions">',
    );
  }
  if (route === "document") {
    const d = state.documents.find((d) => d.id === id);
    return body.replace(
      '<div class="form-actions">',
      '<section class="payment-history"><h3>История оплат</h3>' +
        (d.payments || [])
          .map(
            (p) =>
              "<p>" +
              money(p.amount) +
              " · " +
              esc(p.date) +
              " · " +
              esc(p.method) +
              attachment(p.receipt) +
              "</p>",
          )
          .join("") +
        "</section>" +
        attachment(d.file) +
        (d.file
          ? '<button class="secondary" data-share-file="' +
            esc(id) +
            '">Поделиться файлом</button>'
          : "") +
        '<div class="form-actions">' +
        (d.kind === "Договор" && d.paid < d.amount
          ? '<button class="primary" data-payment="' +
            esc(id) +
            '">Добавить оплату</button>'
          : ""),
    );
  }
  if (route === "new-document")
    return body.replace(
      '<p class="form-note">',
      inputFile(
        "Файл документа",
        "file",
        "application/pdf,image/jpeg,image/png",
      ) + '<p class="form-note">',
    );
  if (route === "new-project")
    return body
      .replace('name="place"', 'name="place" list="crm-places"')
      .replace(
        "</form>",
        '<datalist id="crm-places">' +
          [{ name: serviceRegion }, ...servicePlaces]
            .map((p) => '<option value="' + esc(p.name) + '"></option>')
            .join("") +
          "</datalist></form>",
      )
      .replace(
        '<div class="form-actions">',
        '<label>Этапы · один на строку<textarea name="stages" maxlength="1500" placeholder="Подготовка&#10;Фундамент&#10;Коробка"></textarea></label><label>Бюджет, ₽<input name="budget" type="number" min="0" value="0"></label><div class="form-actions">',
      );
  if (route === "new-person")
    return body.replace(
      '<p class="form-note">',
      '<label>Телефон<input name="phone" type="tel" maxlength="25"></label><p class="form-note">',
    );
  if (route === "person") {
    const m = person(id);
    return body.replace(
      '<div class="member-intro">',
      (m.phone
        ? '<a class="secondary" href="tel:' +
          esc(m.phone.replace(/[^+\d]/g, "")) +
          '">Позвонить · ' +
          esc(m.phone) +
          "</a>"
        : "") + '<div class="member-intro">',
    );
  }
  if (route === "project") {
    const item = project(id);
    return (
      body
        .replace(
          '<div class="detail-tabs"',
          '<div class="project-steps"><h3>Этапы</h3>' +
            (item.stages || [])
              .map((stage) => {
                const ts = projectTasks(id).filter(
                  (t) => t.stage === stage.name,
                );
                return (
                  "<p>" +
                  esc(stage.name) +
                  "<small>" +
                  ts.filter((t) => t.status === "done").length +
                  " / " +
                  ts.length +
                  " задач</small></p>"
                );
              })
              .join("") +
            '<form id="stage-form" data-id="' +
            esc(id) +
            '"><label>Новый этап<input name="name" required maxlength="100"></label><button class="secondary">Добавить этап</button></form></div><div class="detail-tabs"',
        )
        .replace("</div></div>", "</div></div>") +
      '<div class="detail-body"><button class="secondary" data-edit-project="' +
      esc(id) +
      '">Редактировать объект</button>' +
      primary("Задача", "new-task") +
      (item.legacy
        ? '<button class="text-button" data-legacy="' +
          esc(id) +
          '">Прежняя карточка · субподряд и отклики</button>'
        : "") +
      "</div>"
    );
  }
  return body;
}
function extraClick(b) {
  if (b.dataset.offer) {
    parent.postMessage(
      { type: "belkhi-crm-offer", id: b.dataset.offer },
      location.origin,
    );
    return true;
  }
  if (
    b.dataset.action === "new-task" &&
    location.hash.startsWith("#project=")
  ) {
    projectFilter = decodeURIComponent(location.hash.slice(9).split("?")[0]);
  }
  if (b.hasAttribute("data-menu")) {
    openPanel("menu", "", b);
    return true;
  }
  if (b.dataset.navigate) {
    view = b.dataset.navigate;
    const u = new URL(location.href);
    u.hash = "";
    history.replaceState({ crm: snapshot() }, "", u);
    detail.close();
    render();
    return true;
  }
  if (b.dataset.dayTab) {
    dayTab = b.dataset.dayTab;
    renderContent();
    remember();
    return true;
  }
  if (b.dataset.taskMode) {
    taskMode = b.dataset.taskMode;
    renderContent();
    remember();
    return true;
  }
  if (b.dataset.shareFile) {
    shareDocument(b.dataset.shareFile);
    return true;
  }
  if (b.dataset.editProject) {
    openPanel("edit-project", b.dataset.editProject, b);
    return true;
  }
  if (b.dataset.documentKind) {
    documentKind = b.dataset.documentKind;
    renderContent();
    return true;
  }
  if (b.dataset.payment) {
    openPanel("payment", b.dataset.payment, b);
    return true;
  }
  if (b.dataset.legacy) {
    parent.postMessage(
      { type: "belkhi-crm-legacy", id: b.dataset.legacy },
      location.origin,
    );
    return true;
  }
  return false;
}
async function shareDocument(id) {
  try {
    const d = state.documents.find((d) => d.id === id);
    if (!d?.file) return;
    const blob = await (await fetch(d.file.url)).blob();
    const file = new File([blob], d.file.name, { type: d.file.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: d.name });
    } else {
      const a = document.createElement("a");
      a.href = d.file.url;
      a.download = d.file.name;
      a.click();
      notify("Файл скачан — его можно отправить получателю.");
    }
  } catch (e) {
    if (e.name !== "AbortError")
      notify("Не удалось отправить файл. Воспользуйтесь скачиванием.");
  }
}
async function extraSubmit(form, data) {
  try {
    if (form.id === "edit-project-form") {
      if (
        ![{ name: serviceRegion }, ...servicePlaces].some(
          (p) => p.name === String(data.place).trim(),
        )
      )
        throw Error("Выберите территорию из списка.");
      Object.assign(project(form.dataset.id), {
        name: data.name.trim(),
        place: data.place,
        phase: data.phase,
        due: data.due,
        manager: data.manager,
        budget: Number(data.budget),
      });
      commitChange("Объект сохранён.");
      return true;
    }
    if (
      form.id === "project-form" &&
      ![{ name: serviceRegion }, ...servicePlaces].some(
        (p) => p.name === String(data.place).trim(),
      )
    )
      throw Error("Выберите город, село или район из списка.");
    if (form.id === "stage-form") {
      const p = project(form.dataset.id);
      p.stages ||= [];
      p.stages.push({
        id: crypto.randomUUID(),
        name: String(data.name).trim(),
      });
      saveState();
      paintPanel();
      return true;
    }
    if (form.id === "payment-form") {
      const doc = state.documents.find((d) => d.id === form.dataset.id);
      const amount = Number(data.amount);
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        amount > doc.amount - doc.paid
      )
        throw Error("Укажите сумму в пределах остатка договора.");
      const receipt = await readFile(form.elements.receipt.files[0]);
      doc.payments ||= [];
      doc.payments.push({
        id: crypto.randomUUID(),
        amount,
        date: data.date,
        method: data.method,
        note: data.note,
        receipt,
      });
      doc.paid = Number((doc.paid + amount).toFixed(2));
      addLog("Оплата " + money(amount) + " · " + doc.name, doc.project);
      commitChange("Оплата сохранена.");
      return true;
    }
    if (form.id === "journal-form") {
      const photo = await readFile(form.elements.photo.files[0]);
      addLog(String(data.name).trim(), data.project);
      state.journal[0].photo = photo;
      commitChange("Запись добавлена.");
      return true;
    }
    if (form.id === "task-form") {
      const id = location.hash.startsWith("#task=")
        ? decodeURIComponent(location.hash.slice(6))
        : "";
      let t = state.tasks.find((t) => t.id === id);
      const upload = await readFile(form.elements.upload.files[0]);
      const update = {
        name: String(data.name).trim(),
        project: data.project,
        assignee: data.assignee,
        due: data.due,
        status: data.status,
        note: data.note,
        stage: data.stage,
        time: data.time,
        type: data.type,
        target: Number(data.target) || 1,
        unit: data.unit,
        checklist: String(data.checklist || "")
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .map((x) => ({
            done: [
              ...form.querySelectorAll('[name="completedItem"]:checked'),
            ].some((c) => c.value === x.replace(/^\[x\] /, "")),
            text: x.replace(/^\[x\] /, ""),
          })),
      };
      if (update.type === "Количество") {
        update.amount =
          update.status === "done"
            ? update.target
            : Number(data.amount || t?.amount || 0);
        if (update.amount > update.target)
          throw Error("Выполненный объём больше планового.");
      }
      if (
        update.type === "Фото" &&
        ["done", "review"].includes(update.status) &&
        !upload &&
        !t?.upload &&
        !t?.photo
      )
        throw Error("Добавьте фотоотчёт перед сдачей задачи.");
      if (upload) update.upload = upload;
      if (!t) {
        t = { id: crypto.randomUUID(), comments: [] };
        state.tasks.push(t);
      }
      Object.assign(t, update);
      if (String(data.comment || "").trim()) {
        t.comments ||= [];
        t.comments.push({
          text: data.comment,
          at: new Date().toLocaleString("ru-RU"),
        });
      }
      addLog("Задача · " + t.name, t.project);
      commitChange("Задача сохранена.");
      return true;
    }
    if (form.id === "document-form") {
      const file = await readFile(form.elements.file.files[0]);
      state.documents.push({
        id: crypto.randomUUID(),
        name: String(data.name).trim(),
        project: data.project,
        kind: data.kind,
        amount: data.kind === "Договор" ? Number(data.amount) : 0,
        paid: 0,
        payments: [],
        status: "waiting",
        date: snapshotDate,
        file,
      });
      commitChange("Документ добавлен.");
      return true;
    }
    if (form.id === "person-form") {
      const name = String(data.name).trim();
      state.people.push({
        id: crypto.randomUUID(),
        name,
        role: data.role,
        phone: data.phone,
        initials: name
          .split(/\s+/)
          .slice(0, 2)
          .map((x) => x[0])
          .join(""),
        color: "green",
      });
      commitChange("Работник добавлен.");
      return true;
    }
  } catch (error) {
    notify(error.message);
    return true;
  }
  return false;
}

await initializeWorkspace();
restore();
