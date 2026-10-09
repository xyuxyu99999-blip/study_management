const STORAGE_KEY = "study-management-data-v1";
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const state = {
  page: "home",
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTest: "all",
  data: loadData(),
};

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
}

function normalizeRecords(records) {
  const now = new Date().toISOString();
  return records.map((record) => ({
    ...record,
    id: record.id || createId(),
    createdAt: record.createdAt || now,
    updatedAt: record.updatedAt || now,
    deletedAt: record.deletedAt || null,
  }));
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      testResults: normalizeRecords(Array.isArray(stored.testResults) ? stored.testResults : []),
      todos: normalizeRecords(Array.isArray(stored.todos) ? stored.todos : []),
    };
  } catch {
    return { testResults: [], todos: [] };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function activeRecords(collection) {
  return state.data[collection].filter((record) => !record.deletedAt);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function formatDate(dateString, withWeekday = false) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return dateString;
  const formatted = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return withWeekday
    ? `${formatted}（${new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "UTC" }).format(date)}）`
    : formatted;
}

function setPage(page) {
  state.page = page;
  document.querySelectorAll("[data-screen]").forEach((screen) => {
    screen.hidden = screen.dataset.screen !== page;
  });
  document.querySelectorAll("[data-page]").forEach((button) => {
    const selected = button.dataset.page === page;
    button.classList.toggle("is-active", selected);
    button.setAttribute("aria-current", selected ? "page" : "false");
  });
  renderPage();
}

function renderPage() {
  if (state.page === "home") renderHome();
  if (state.page === "tests") renderTests();
  if (state.page === "todos") renderTodos();
  if (state.page === "calendar") renderCalendar();
  if (state.page === "data") renderDataSummary();
}

function renderHome() {
  const tests = activeRecords("testResults");
  const todos = activeRecords("todos");
  const scores = tests.map((record) => Number(record.score)).filter(Number.isFinite);
  const upcoming = todos
    .filter((todo) => todo.dueDate && !todo.done)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))
    .slice(0, 4);

  document.querySelector("#home-metrics").innerHTML = `
    <div class="metric"><span>登録タスク</span><strong>${todos.filter((todo) => !todo.done).length}</strong></div>
    <div class="metric"><span>テスト記録</span><strong>${tests.length}</strong></div>
    <div class="metric"><span>平均点</span><strong>${scores.length ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)}<small>点</small>` : "--"}</strong></div>`;
  document.querySelector("#home-upcoming").innerHTML = upcoming.length
    ? upcoming.map((todo) => `<li><time>${formatDate(todo.dueDate, true)}</time><span>${escapeHtml(todo.task)}</span></li>`).join("")
    : '<li class="empty-state">期限のある未完了タスクはありません。</li>';
}

function renderTests() {
  const tests = activeRecords("testResults").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const scores = tests.map((record) => Number(record.score)).filter(Number.isFinite);
  document.querySelector("#test-count").textContent = `${tests.length}件`;
  document.querySelector("#test-average").textContent = scores.length
    ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)}点`
    : "--";
  document.querySelector("#test-high").textContent = scores.length ? `${Math.max(...scores)}点` : "--";

  const filter = document.querySelector("#test-filter");
  const selected = state.selectedTest;
  const testNames = [...new Set(tests.map((record) => record.exam).filter(Boolean))];
  filter.innerHTML = '<option value="all">すべてのテスト</option>' + testNames
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  filter.value = testNames.includes(selected) ? selected : "all";
  state.selectedTest = filter.value;

  const visibleTests = state.selectedTest === "all"
    ? tests
    : tests.filter((record) => record.exam === state.selectedTest);
  document.querySelector("#test-results").innerHTML = visibleTests.length
    ? visibleTests.map((record) => `
      <tr>
        <td>${escapeHtml(record.exam)}</td>
        <td>${escapeHtml(record.subject)}</td>
        <td class="score-cell">${escapeHtml(record.score)}<small>点</small></td>
        <td><button class="icon-button" type="button" data-delete-test="${escapeHtml(record.id)}" aria-label="記録を削除">削除</button></td>
      </tr>`).join("")
    : '<tr><td colspan="4" class="empty-state">テスト記録はまだありません。</td></tr>';
}

function renderTodos() {
  const todos = activeRecords("todos");
  const renderList = (records, emptyText) => records.length
    ? records.map((todo) => `
      <li class="todo-row ${todo.done ? "is-done" : ""}">
        <label class="todo-check"><input type="checkbox" data-toggle-todo="${escapeHtml(todo.id)}" ${todo.done ? "checked" : ""}><span class="checkmark" aria-hidden="true"></span></label>
        <div class="todo-copy"><strong>${escapeHtml(todo.task)}</strong>${todo.dueDate ? `<time>${formatDate(todo.dueDate, true)}</time>` : ""}</div>
        <button class="icon-button" type="button" data-delete-todo="${escapeHtml(todo.id)}" aria-label="タスクを削除">削除</button>
      </li>`).join("")
    : `<li class="empty-state">${emptyText}</li>`;

  document.querySelector("#todo-open").innerHTML = renderList(
    todos.filter((todo) => !todo.done), "未完了のタスクはありません。"
  );
  document.querySelector("#todo-done").innerHTML = renderList(
    todos.filter((todo) => todo.done), "完了したタスクはありません。"
  );
}

function renderCalendar() {
  const year = state.month.getFullYear();
  const month = state.month.getMonth();
  document.querySelector("#calendar-title").textContent = `${year}年${month + 1}月`;

  const tasksByDate = new Map();
  activeRecords("todos").forEach((todo) => {
    if (!todo.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(todo.dueDate)) return;
    const dayTasks = tasksByDate.get(todo.dueDate) || [];
    dayTasks.push(todo);
    tasksByDate.set(todo.dueDate, dayTasks);
  });

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  const days = Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    const dayDate = new Date(year, month, dayNumber);
    const inMonth = dayNumber > 0 && dayNumber <= daysInMonth;
    const dateKey = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, "0")}-${String(dayDate.getDate()).padStart(2, "0")}`;
    const weekend = dayDate.getDay() === 6 ? "saturday" : dayDate.getDay() === 0 ? "sunday" : "";
    const entries = (tasksByDate.get(dateKey) || []).map((todo) => `
      <span class="calendar-task ${todo.done ? "is-done" : ""}">${todo.done ? "✓ " : ""}${escapeHtml(todo.task)}</span>`).join("");
    return `<div class="calendar-day ${inMonth ? "" : "outside-month"} ${weekend}" role="gridcell">
      <span class="calendar-date">${dayDate.getDate()}</span>${entries}
    </div>`;
  }).join("");

  document.querySelector("#calendar-grid").innerHTML = `
    ${WEEKDAYS.map((weekday, index) => `<div class="weekday ${index === 5 ? "saturday" : index === 6 ? "sunday" : ""}" role="columnheader">${weekday}</div>`).join("")}
    ${days}`;
}

function renderDataSummary() {
  document.querySelector("#data-test-count").textContent = activeRecords("testResults").length;
  document.querySelector("#data-todo-count").textContent = activeRecords("todos").length;
}

function persistAndRender() {
  saveData();
  renderPage();
  renderHome();
  renderDataSummary();
}

function createRecord(fields) {
  const now = new Date().toISOString();
  return { id: createId(), ...fields, createdAt: now, updatedAt: now, deletedAt: null };
}

function markDeleted(collection, id) {
  const record = state.data[collection].find((item) => item.id === id);
  if (!record) return;
  record.deletedAt = new Date().toISOString();
  record.updatedAt = record.deletedAt;
  persistAndRender();
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function exportCsv(collection) {
  const records = activeRecords(collection);
  let csv;
  let filename;
  if (collection === "testResults") {
    csv = ["テスト,教科,点数", ...records.map((item) => [item.exam, item.subject, item.score].map(csvEscape).join(","))].join("\r\n");
    filename = "test_results.csv";
  } else {
    csv = ["task,due_date,done", ...records.map((item) => [item.task, item.dueDate, item.done].map(csvEscape).join(","))].join("\r\n");
    filename = "todo_list.csv";
  }
  downloadFile(filename, `\uFEFF${csv}`, "text/csv;charset=utf-8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted && character === '"' && source[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  row.push(field);
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

async function importCsv(file, collection) {
  const rows = parseCsv(await file.text());
  if (rows.length < 2) {
    window.alert("読み込めるデータがありません。");
    return;
  }
  const headers = rows[0].map((header) => header.trim());
  const records = rows.slice(1).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""])
  ));
  const imported = records.map((record) => {
    if (collection === "testResults") {
      const score = Number(record["点数"] ?? record.score);
      if (!record["教科"] && !record.subject) return null;
      return createRecord({
        exam: record["テスト"] ?? record.exam ?? "",
        subject: record["教科"] ?? record.subject ?? "",
        score: Number.isFinite(score) ? score : 0,
      });
    }
    const task = record.task ?? record["タスク"];
    if (!task) return null;
    return createRecord({
      task,
      dueDate: record.due_date ?? record.dueDate ?? "",
      done: ["true", "1", "yes"].includes(String(record.done).toLowerCase()),
    });
  }).filter(Boolean);

  if (!imported.length) {
    window.alert("読み込めるデータがありません。");
    return;
  }
  state.data[collection].push(...imported);
  persistAndRender();
  window.alert(`${imported.length}件を端末に取り込みました。`);
}

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => setPage(button.dataset.page));
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => setPage(button.dataset.go));
});

document.querySelector("#test-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const subject = String(form.get("subject") || "").trim();
  if (!subject) return;
  state.data.testResults.push(createRecord({
    exam: String(form.get("exam") || "").trim(),
    subject,
    score: Number(form.get("score")),
  }));
  event.currentTarget.reset();
  persistAndRender();
});

document.querySelector("#test-filter").addEventListener("change", (event) => {
  state.selectedTest = event.currentTarget.value;
  renderTests();
});

document.querySelector("#todo-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const task = String(form.get("task") || "").trim();
  if (!task) return;
  state.data.todos.push(createRecord({
    task,
    dueDate: String(form.get("dueDate") || ""),
    done: false,
  }));
  event.currentTarget.reset();
  persistAndRender();
});

document.addEventListener("change", (event) => {
  const todoId = event.target.dataset.toggleTodo;
  if (!todoId) return;
  const todo = state.data.todos.find((item) => item.id === todoId);
  if (!todo) return;
  todo.done = event.target.checked;
  todo.updatedAt = new Date().toISOString();
  persistAndRender();
});

document.addEventListener("click", (event) => {
  const testId = event.target.closest("[data-delete-test]")?.dataset.deleteTest;
  const todoId = event.target.closest("[data-delete-todo]")?.dataset.deleteTodo;
  if (testId && window.confirm("この記録を削除しますか？")) markDeleted("testResults", testId);
  if (todoId && window.confirm("このタスクを削除しますか？")) markDeleted("todos", todoId);
});

document.querySelector("#calendar-previous").addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() - 1, 1);
  renderCalendar();
});
document.querySelector("#calendar-next").addEventListener("click", () => {
  state.month = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 1);
  renderCalendar();
});

document.querySelector("#export-tests").addEventListener("click", () => exportCsv("testResults"));
document.querySelector("#export-todos").addEventListener("click", () => exportCsv("todos"));
document.querySelector("#import-tests").addEventListener("change", (event) => {
  if (event.target.files[0]) importCsv(event.target.files[0], "testResults");
  event.target.value = "";
});
document.querySelector("#import-todos").addEventListener("change", (event) => {
  if (event.target.files[0]) importCsv(event.target.files[0], "todos");
  event.target.value = "";
});

const installButton = document.querySelector("#install-app");
let installPrompt;
const isInstalled = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
installButton.hidden = Boolean(isInstalled);
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  installPrompt = event;
  installButton.hidden = false;
});
installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    window.alert("ブラウザーのメニューから「ホーム画面に追加」を選んでください。");
    return;
  }
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  installButton.hidden = true;
});
window.addEventListener("appinstalled", () => {
  installButton.hidden = true;
});

function updateNetworkStatus() {
  const online = navigator.onLine;
  const status = document.querySelector("#network-status");
  status.textContent = online ? "オンライン" : "オフライン";
  status.classList.toggle("is-offline", !online);
}
window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
updateNetworkStatus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

renderPage();