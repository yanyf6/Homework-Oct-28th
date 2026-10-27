"use strict";

const STORAGE_KEY = "chore-split-v1";
const PALETTE = ["#7b6cf6", "#f07a9a", "#4da3ff", "#45c4b0", "#f0a35e", "#8d6adf", "#e06b6b", "#3d9be9"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const personForm = document.getElementById("personForm");
const personNameEl = document.getElementById("personName");
const taskForm = document.getElementById("taskForm");
const taskTitleEl = document.getElementById("taskTitle");
const taskDateEl = document.getElementById("taskDate");
const randomizeEl = document.getElementById("randomize");

const state = initialState();
const draft = {
  assigneeId: state.people[0]?.id ?? null,
  randomize: false,
};
let focusAfter = null;

function todayISO() {
  return toISO(new Date());
}

function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function initial(name) {
  return [...name.trim()][0]?.toUpperCase() || "?";
}

function monthKey(iso) {
  return iso.slice(0, 7);
}

function monthDay(iso) {
  const date = parseISO(iso);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

function personById(id) {
  return state.people.find((person) => person.id === id) || { id, name: "Someone", color: "#888888" };
}

function tasksOn(iso) {
  return state.tasks.filter((task) => task.date === iso);
}

function tasksInMonth(key) {
  return state.tasks.filter((task) => task.date.startsWith(key));
}

function nextColor() {
  return PALETTE.find((color) => !state.people.some((person) => person.color === color)) || PALETTE[state.people.length % PALETTE.length];
}

function progress(tasks) {
  if (!tasks.length) return "Nothing scheduled";
  const done = tasks.filter((task) => task.done).length;
  if (done === tasks.length) return `All ${tasks.length} done`;
  return `${done} of ${tasks.length} done`;
}

function countWord(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function defaultState() {
  const today = todayISO();
  return {
    people: [],
    tasks: [],
    selectedDate: today,
    selectedPersonId: null,
    monthCursor: monthKey(today),
    view: "calendar",
  };
}

function seedState() {
  const seeded = defaultState();
  seeded.people = [
    { id: "alex", name: "Alex", color: PALETTE[0] },
    { id: "jordan", name: "Jordan", color: PALETTE[1] },
    { id: "sam", name: "Sam", color: PALETTE[2] },
  ];
  seeded.selectedPersonId = "alex";
  const rows = [
    ["oct10a", "2026-10-10", "Dishes", "alex", true],
    ["oct10b", "2026-10-10", "Take out trash", "jordan", false],
    ["oct10c", "2026-10-10", "Vacuum", "sam", false],
    ["oct15a", "2026-10-15", "Groceries", "alex", false],
    ["oct15b", "2026-10-15", "Clean bathroom", "jordan", true],
    ["oct17a", "2026-10-17", "Laundry", "alex", false],
    ["oct17b", "2026-10-17", "Water plants", "jordan", false],
    ["oct17c", "2026-10-17", "Wipe counters", "sam", false],
    ["oct22a", "2026-10-22", "Mop floors", "sam", true],
    ["oct25a", "2026-10-25", "Water plants", "alex", false],
    ["oct27a", "2026-10-27", "Take out recycling", "alex", false],
    ["oct27b", "2026-10-27", "Dishes", "sam", false],
    ["oct28a", "2026-10-28", "Sweep kitchen", "jordan", false],
    ["oct30a", "2026-10-30", "Take out trash", "sam", false],
    ["oct31a", "2026-10-31", "Groceries", "jordan", false],
    ["nov10a", "2026-11-10", "Dishes", "alex", true],
    ["nov10b", "2026-11-10", "Take out trash", "jordan", false],
    ["nov10c", "2026-11-10", "Vacuum", "sam", false],
    ["nov15a", "2026-11-15", "Groceries", "alex", false],
    ["nov15b", "2026-11-15", "Clean bathroom", "jordan", false],
    ["nov17a", "2026-11-17", "Laundry", "alex", false],
    ["nov17b", "2026-11-17", "Water plants", "jordan", false],
    ["nov17c", "2026-11-17", "Wipe counters", "sam", false],
  ];
  seeded.tasks = rows.map(([id, date, title, assigneeId, done]) => ({ id, date, title, assigneeId, done }));
  return seeded;
}

function sanitize(data) {
  const next = defaultState();
  const people = Array.isArray(data.people) ? data.people : [];
  next.people = people
    .filter((person) => person && typeof person.id === "string" && typeof person.name === "string" && person.name.trim())
    .map((person, index) => ({
      id: person.id,
      name: person.name.trim().slice(0, 32),
      color: /^#[0-9a-fA-F]{6}$/.test(person.color || "") ? person.color : PALETTE[index % PALETTE.length],
    }));
  const ids = new Set(next.people.map((person) => person.id));
  const tasks = Array.isArray(data.tasks) ? data.tasks : [];
  next.tasks = tasks
    .filter((task) => task && ids.has(task.assigneeId) && /^\d{4}-\d{2}-\d{2}$/.test(task.date || "") && typeof task.title === "string" && task.title.trim())
    .map((task) => ({
      id: String(task.id || uid()),
      title: task.title.trim().slice(0, 60),
      date: task.date,
      assigneeId: task.assigneeId,
      done: Boolean(task.done),
    }));
  if (/^\d{4}-\d{2}-\d{2}$/.test(data.selectedDate || "")) next.selectedDate = data.selectedDate;
  next.monthCursor = /^\d{4}-\d{2}$/.test(data.monthCursor || "") ? data.monthCursor : monthKey(next.selectedDate);
  next.view = ["day", "week", "calendar"].includes(data.view) ? data.view : "calendar";
  next.selectedPersonId = ids.has(data.selectedPersonId) ? data.selectedPersonId : next.people[0]?.id ?? null;
  return next;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

function initialState() {
  return load() || seedState();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Private mode or a full disk can reject storage. The page still works. */
  }
}

function setNote(id, message, isError = false) {
  const note = document.getElementById(id);
  note.textContent = message;
  note.classList.toggle("error", Boolean(message) && isError);
  note.classList.toggle("ok", Boolean(message) && !isError);
}

function lightestPerson(date) {
  const key = monthKey(date);
  let best = [];
  let bestCount = Infinity;
  state.people.forEach((person) => {
    const count = state.tasks.filter((task) => task.assigneeId === person.id && task.date.startsWith(key)).length;
    if (count < bestCount) {
      best = [person];
      bestCount = count;
    } else if (count === bestCount) {
      best.push(person);
    }
  });
  return best[Math.floor(Math.random() * best.length)];
}

function selectDate(iso) {
  state.selectedDate = iso;
  state.monthCursor = monthKey(iso);
  taskDateEl.value = iso;
  persist();
  renderDynamic();
}

function renderViews() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.view === state.view));
  });
}

function renderPeople() {
  const host = document.getElementById("peopleList");
  if (!state.people.length) {
    host.innerHTML = `<p class="empty">No roommates yet.</p>`;
    return;
  }
  host.innerHTML = `<div class="people">${state.people.map((person) => `
    <div class="person-row ${person.id === state.selectedPersonId ? "selected" : ""}">
      <button type="button" class="person" data-action="select-person" data-id="${esc(person.id)}">
        <span class="dot" style="background:${person.color}"></span>
        <span class="pname">${esc(person.name)}</span>
      </button>
      <button type="button" class="x" data-action="remove-person" data-id="${esc(person.id)}" aria-label="Remove ${esc(person.name)}">×</button>
    </div>
  `).join("")}</div>`;
}

function renderBalance() {
  const host = document.getElementById("balance");
  const date = parseISO(`${state.monthCursor}-01`);
  const label = MONTHS[date.getMonth()];
  if (!state.people.length) {
    host.innerHTML = `${label} · add roommates to split chores`;
    return;
  }
  const bits = state.people.map((person) => {
    const count = tasksInMonth(state.monthCursor).filter((task) => task.assigneeId === person.id).length;
    return `<span class="bal"><span class="dot" style="background:${person.color}"></span>${esc(person.name)} ${count}</span>`;
  }).join("");
  host.innerHTML = `<span>${label}</span>${bits}`;
}

function renderAssignees() {
  const host = document.getElementById("assigneeChoices");
  if (!state.people.length) {
    host.innerHTML = `<p class="empty">Add a roommate first.</p>`;
    return;
  }
  if (!state.people.some((person) => person.id === draft.assigneeId)) {
    draft.assigneeId = state.people[0].id;
  }
  host.innerHTML = state.people.map((person) => `
    <label class="pill">
      <input type="radio" name="assignee" value="${esc(person.id)}" ${person.id === draft.assigneeId ? "checked" : ""} ${draft.randomize ? "disabled" : ""} />
      <span class="dot" style="background:${person.color}"></span>
      ${esc(person.name)}
    </label>
  `).join("");
}

function renderProfile() {
  const host = document.getElementById("profile");
  const person = state.people.find((item) => item.id === state.selectedPersonId);
  const monthDate = parseISO(`${state.monthCursor}-01`);
  const monthName = MONTHS[monthDate.getMonth()];
  if (!person) {
    host.innerHTML = `
      <div class="profile-head">
        <div class="avatar-icon" style="background:var(--purple)">?</div>
        <div>
          <h2>Roommate</h2>
          <p class="sub">Add someone to see their month.</p>
        </div>
      </div>`;
    return;
  }
  const chores = state.tasks
    .filter((task) => task.assigneeId === person.id && task.date.startsWith(state.monthCursor))
    .sort((a, b) => a.date.localeCompare(b.date) || state.tasks.indexOf(a) - state.tasks.indexOf(b));
  const done = chores.filter((task) => task.done).length;
  const list = chores.length
    ? `<ul class="chores profile-list">${chores.map((task) => `
        <li class="chore ${task.done ? "done" : ""}" style="--person:${person.color}">
          <input type="checkbox" data-action="toggle" data-id="${esc(task.id)}" data-panel="profile" ${task.done ? "checked" : ""} aria-label="Mark ${esc(task.title)} ${task.done ? "not done" : "done"}" />
          <button type="button" class="jump" data-action="select-date" data-date="${task.date}" aria-label="Open ${monthDay(task.date)}, ${esc(task.title)}">
            <span class="when">${monthDay(task.date)}</span>
            <span class="dash" aria-hidden="true">—</span>
            <span class="what">${esc(task.title)}</span>
          </button>
        </li>
      `).join("")}</ul>`
    : `<p class="empty">No chores for ${esc(person.name)} in ${monthName}.</p>`;
  host.innerHTML = `
    <div class="profile-head">
      <div class="avatar" style="background:${person.color}">${esc(initial(person.name))}</div>
      <div>
        <h2>${esc(person.name)}</h2>
        <p class="sub">${countWord(chores.length, "chore")} in ${monthName} · ${done} done</p>
      </div>
    </div>
    ${list}`;
}

function toolbarHTML(title, subtitle, prevLabel, nextLabel, compact) {
  return `
    <div class="toolbar">
      <button type="button" class="icon-btn" data-action="shift" data-dir="-1" aria-label="${esc(prevLabel)}">‹</button>
      <div class="month-mark">
        <h2 class="month-short ${compact ? "compact" : ""}">${esc(title)}</h2>
        <p>${esc(subtitle)}</p>
      </div>
      <button type="button" class="icon-btn" data-action="shift" data-dir="1" aria-label="${esc(nextLabel)}">›</button>
      <button type="button" class="today-btn" data-action="today">Today</button>
    </div>`;
}

function calendarHTML() {
  const [year, monthNumber] = state.monthCursor.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    cells.push(date);
  }
  while (cells.length > 28 && cells.at(-7).getMonth() !== monthIndex) cells.splice(-7, 7);
  const today = todayISO();
  const body = cells.map((date) => {
    const iso = toISO(date);
    const tasks = tasksOn(iso);
    const outside = date.getMonth() !== monthIndex;
    const classes = [
      "cell",
      outside ? "outside" : "",
      iso === state.selectedDate ? "selected" : "",
      iso === today ? "today" : "",
      tasks.length ? "has-tasks" : "",
    ].filter(Boolean).join(" ");
    const preview = tasks.slice(0, 3).map((task) => {
      const person = personById(task.assigneeId);
      return `<li class="cell-task ${task.done ? "done" : ""}" title="${esc(person.name)} → ${esc(task.title)}">
        <span class="dot" style="background:${person.color}"></span>
        <span>${esc(person.name)} · ${esc(task.title)}</span>
      </li>`;
    }).join("");
    const more = tasks.length > 3 ? `<li class="more">+${tasks.length - 3} more</li>` : "";
    const dots = tasks.slice(0, 6).map((task) => `<span class="dot" style="background:${personById(task.assigneeId).color}"></span>`).join("");
    const label = tasks.length
      ? `${MONTHS[date.getMonth()]} ${date.getDate()}, ${countWord(tasks.length, "chore")}`
      : `${MONTHS[date.getMonth()]} ${date.getDate()}`;
    return `<button type="button" class="${classes}" data-action="select-date" data-date="${iso}" aria-label="${esc(label)}" aria-pressed="${iso === state.selectedDate}">
      <span class="num">${date.getDate()}</span>
      <ul class="cell-tasks">${preview}${more}</ul>
      <span class="dots">${dots}</span>
    </button>`;
  }).join("");
  return `
    ${toolbarHTML(MONTHS[monthIndex], String(year), "Previous month", "Next month", false)}
    <div class="dow">${DOW.map((day) => `<div>${day}</div>`).join("")}</div>
    <div class="grid">${body}</div>`;
}

function weekDays(iso) {
  const date = parseISO(iso);
  const start = new Date(date);
  start.setDate(date.getDate() - date.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function shortRange(days) {
  const start = days[0];
  const end = days[6];
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()} – ${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`;
}

function weekHTML() {
  const days = weekDays(state.selectedDate);
  const today = todayISO();
  const columns = days.map((date) => {
    const iso = toISO(date);
    const tasks = tasksOn(iso);
    const classes = ["week-col", iso === state.selectedDate ? "selected" : "", iso === today ? "today" : ""].filter(Boolean).join(" ");
    const chores = tasks.length
      ? tasks.map((task) => {
        const person = personById(task.assigneeId);
        return `<label class="week-chore ${task.done ? "done" : ""}">
          <input type="checkbox" data-action="toggle" data-id="${esc(task.id)}" data-panel="schedule" ${task.done ? "checked" : ""} />
          <span style="border-left:3px solid ${person.color};padding-left:6px">
            <span class="who">${esc(person.name)}</span>
            <span class="what">${esc(task.title)}</span>
          </span>
        </label>`;
      }).join("")
      : `<p class="quiet">No chores</p>`;
    return `<div class="${classes}">
      <button type="button" class="week-head" data-action="select-date" data-date="${iso}">
        <strong>${date.getDate()}</strong>
        <span>${DOW[date.getDay()]}</span>
      </button>
      ${chores}
    </div>`;
  }).join("");
  const year = days[0].getFullYear() === days[6].getFullYear()
    ? String(days[0].getFullYear())
    : `${days[0].getFullYear()} – ${days[6].getFullYear()}`;
  return `
    ${toolbarHTML(shortRange(days), year, "Previous week", "Next week", true)}
    <div class="week-scroll"><div class="week">${columns}</div></div>`;
}

function dayNavigatorHTML() {
  const date = parseISO(state.selectedDate);
  const tasks = tasksOn(state.selectedDate);
  return toolbarHTML(
    `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`,
    `${WEEKDAYS[date.getDay()]} · ${progress(tasks)}`,
    "Previous day",
    "Next day",
    true,
  );
}

function renderSchedule() {
  const host = document.getElementById("schedule");
  if (state.view === "day") host.innerHTML = dayNavigatorHTML();
  else if (state.view === "week") host.innerHTML = weekHTML();
  else host.innerHTML = calendarHTML();
}

function renderDayDetail() {
  const host = document.getElementById("dayDetail");
  const date = parseISO(state.selectedDate);
  const tasks = tasksOn(state.selectedDate);
  const heading = state.view === "day"
    ? `<div class="detail-head"><p class="sub">${progress(tasks)}</p><button type="button" class="text-btn" data-action="compose">Add chore</button></div>`
    : `<div class="detail-head">
        <div>
          <h2>${MONTHS[date.getMonth()]} ${date.getDate()}</h2>
          <p class="sub">${WEEKDAYS[date.getDay()]} · ${progress(tasks)}</p>
        </div>
        <button type="button" class="text-btn" data-action="compose">Add chore</button>
      </div>`;
  const list = tasks.length
    ? `<ul class="chores">${tasks.map((task) => {
      const person = personById(task.assigneeId);
      return `<li class="chore ${task.done ? "done" : ""}" style="--person:${person.color}">
        <label>
          <input type="checkbox" data-action="toggle" data-id="${esc(task.id)}" data-panel="dayDetail" ${task.done ? "checked" : ""} />
          <span class="who">${esc(person.name)}</span>
          <span class="arrow" aria-hidden="true">→</span>
          <span class="what">${esc(task.title)}</span>
        </label>
        <button type="button" class="x" data-action="remove-task" data-id="${esc(task.id)}" aria-label="Remove ${esc(task.title)}">×</button>
      </li>`;
    }).join("")}</ul>`
    : `<p class="empty">No chores this day.</p>`;
  host.innerHTML = heading + list;
}

function restoreFocus() {
  if (!focusAfter) return;
  const root = document.getElementById(focusAfter.panel);
  const next = root?.querySelector(`[data-action="toggle"][data-id="${CSS.escape(focusAfter.id)}"]`);
  focusAfter = null;
  next?.focus();
}

function renderDynamic() {
  renderViews();
  renderPeople();
  renderBalance();
  renderProfile();
  renderSchedule();
  renderDayDetail();
  restoreFocus();
}

function addPerson(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    setNote("personNote", "Enter a name.", true);
    return;
  }
  if (state.people.some((person) => person.name.toLowerCase() === trimmed.toLowerCase())) {
    setNote("personNote", `${trimmed} is already on the list.`, true);
    return;
  }
  const person = { id: uid(), name: trimmed, color: nextColor() };
  state.people.push(person);
  state.selectedPersonId = person.id;
  draft.assigneeId = person.id;
  personNameEl.value = "";
  persist();
  setNote("personNote", `Added ${person.name}.`);
  renderAssignees();
  renderDynamic();
}

function addTask(title, date) {
  const trimmed = title.trim();
  if (!trimmed) {
    setNote("taskNote", "Name the chore.", true);
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setNote("taskNote", "Pick a date.", true);
    return;
  }
  if (!state.people.length) {
    setNote("taskNote", "Add a roommate before assigning chores.", true);
    return;
  }
  const assignee = draft.randomize
    ? lightestPerson(date)
    : state.people.find((person) => person.id === draft.assigneeId);
  if (!assignee) {
    setNote("taskNote", "Choose who gets this chore.", true);
    return;
  }
  state.tasks.push({ id: uid(), title: trimmed, date, assigneeId: assignee.id, done: false });
  taskTitleEl.value = "";
  state.selectedDate = date;
  state.monthCursor = monthKey(date);
  if (!state.selectedPersonId) state.selectedPersonId = assignee.id;
  persist();
  const reason = draft.randomize ? " Lightest load that month." : "";
  setNote("taskNote", `Assigned “${trimmed}” to ${assignee.name}.${reason}`, false);
  renderDynamic();
  taskTitleEl.focus();
}

function removePerson(id) {
  const person = state.people.find((item) => item.id === id);
  if (!person) return;
  const count = state.tasks.filter((task) => task.assigneeId === id).length;
  const message = count
    ? `Remove ${person.name} and their ${countWord(count, "chore")}?`
    : `Remove ${person.name}?`;
  if (!confirm(message)) return;
  state.people = state.people.filter((item) => item.id !== id);
  state.tasks = state.tasks.filter((task) => task.assigneeId !== id);
  if (state.selectedPersonId === id) state.selectedPersonId = state.people[0]?.id ?? null;
  if (draft.assigneeId === id) draft.assigneeId = state.people[0]?.id ?? null;
  persist();
  setNote("personNote", `Removed ${person.name}.`);
  renderAssignees();
  renderDynamic();
}

function bind() {
  personForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPerson(personNameEl.value);
  });

  taskForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addTask(taskTitleEl.value, taskDateEl.value);
  });

  randomizeEl.addEventListener("change", () => {
    draft.randomize = randomizeEl.checked;
    renderAssignees();
  });

  document.getElementById("assigneeChoices").addEventListener("change", (event) => {
    if (event.target.name === "assignee") draft.assigneeId = event.target.value;
  });

  document.getElementById("app").addEventListener("change", (event) => {
    const input = event.target;
    if (input.dataset.action !== "toggle") return;
    const task = state.tasks.find((item) => item.id === input.dataset.id);
    if (!task) return;
    task.done = input.checked;
    focusAfter = { id: task.id, panel: input.dataset.panel };
    persist();
    renderDynamic();
  });

  document.getElementById("app").addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;
    const { action } = trigger.dataset;
    if (action === "set-view") {
      state.view = trigger.dataset.view;
      persist();
      renderDynamic();
    } else if (action === "select-person") {
      state.selectedPersonId = trigger.dataset.id;
      persist();
      renderDynamic();
    } else if (action === "remove-person") {
      removePerson(trigger.dataset.id);
    } else if (action === "remove-task") {
      state.tasks = state.tasks.filter((task) => task.id !== trigger.dataset.id);
      persist();
      setNote("taskNote", "Removed that chore.");
      renderDynamic();
    } else if (action === "select-date") {
      selectDate(trigger.dataset.date);
      if (window.matchMedia("(max-width: 860px)").matches) {
        document.getElementById("dayDetail").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    } else if (action === "shift") {
      const dir = Number(trigger.dataset.dir);
      if (state.view === "calendar") {
        const [year, month] = state.monthCursor.split("-").map(Number);
        const next = new Date(year, month - 1 + dir, 1);
        const wanted = Number(state.selectedDate.slice(8, 10));
        const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
        selectDate(toISO(new Date(next.getFullYear(), next.getMonth(), Math.min(wanted, last))));
      } else {
        const date = parseISO(state.selectedDate);
        date.setDate(date.getDate() + (state.view === "week" ? dir * 7 : dir));
        selectDate(toISO(date));
      }
    } else if (action === "today") {
      selectDate(todayISO());
    } else if (action === "compose") {
      taskDateEl.value = state.selectedDate;
      taskTitleEl.focus();
    }
  });
}

taskDateEl.value = state.selectedDate;
bind();
renderAssignees();
renderDynamic();
