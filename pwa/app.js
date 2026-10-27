const STORAGE_KEY = "study-management-data-v1";
const SETTINGS_KEY = "study-management-settings-v1";
const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];
const state = {
  page: "home",
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selectedTest: "all",
  editingTodoId: null,
  data: loadData(),
  settings: loadSettings(),
  notificationError: "",
  checkingReminders: false,
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

function loadSettings() {
  const defaults = {
    theme: "light",
    notificationsEnabled: false,
    notificationTiming: "1",
    notifiedReminders: [],
  };
  try {
    const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return {
      ...defaults,
      theme: ["light", "dark"].includes(stored.theme) ? stored.theme : defaults.theme,
      notificationsEnabled: stored.notificationsEnabled === true,
      notificationTiming: ["0", "1", "3"].includes(String(stored.notificationTiming))
        ? String(stored.notificationTiming)
        : defaults.notificationTiming,
      notifiedReminders: Array.isArray(stored.notifiedReminders)
        ? stored.notifiedReminders.filter((item) => typeof item === "string")
        : [],
    };
  } catch {
    return defaults;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function saveSettings() {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
}

function applyTheme() {
  document.documentElement.dataset.theme = state.settings.theme;
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
  if (state.page === "settings") renderSettings();
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
    ? upcoming.map((todo) => `<li><time>${formatDate(todo.dueDate, true)}</time><span>${escapeHtml(todo.task)}${todo.scope ? `<small class="upcoming-scope">範囲：${escapeHtml(todo.scope)}</small>` : ""}</span></li>`).join("")
    : '<li class="empty-state">期限のある未完了タスクはありません。</li>';
}

function renderTests() {
  const tests = activeRecords("testResults").sort((left, right) => right.createdAt.localeCompare(left.createdAt));
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
  const scores = visibleTests.map((record) => Number(record.score)).filter(Number.isFinite);
  document.querySelector("#test-count").textContent = `${visibleTests.length}件`;
  document.querySelector("#test-average-label").textContent = state.selectedTest === "all"
    ? "平均点"
    : `${state.selectedTest}の平均点`;
  document.querySelector("#test-average").textContent = scores.length
    ? `${(scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1)}点`
    : "--";
  document.querySelector("#test-high").textContent = scores.length ? `${Math.max(...scores)}点` : "--";

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
        ${state.editingTodoId === todo.id
          ? `<form class="todo-edit-form" data-edit-todo-form data-todo-id="${escapeHtml(todo.id)}">
              <label>タスク<input name="task" type="text" value="${escapeHtml(todo.task)}" required></label>
              <label>範囲<input name="scope" type="text" value="${escapeHtml(todo.scope || "")}"></label>
              <label>期限<input name="dueDate" type="date" value="${escapeHtml(todo.dueDate || "")}"></label>
              <div class="todo-edit-actions">
                <button class="primary-button" type="submit">保存</button>
                <button class="secondary-button" type="button" data-cancel-todo-edit="${escapeHtml(todo.id)}">キャンセル</button>
              </div>
            </form>`
          : `<div class="todo-copy"><strong>${escapeHtml(todo.task)}</strong>${todo.scope ? `<span class="todo-scope">範囲：${escapeHtml(todo.scope)}</span>` : ""}${todo.dueDate ? `<time>${formatDate(todo.dueDate, true)}</time>` : ""}</div>
            <div class="todo-actions">
              <button class="icon-button todo-edit-button" type="button" data-edit-todo="${escapeHtml(todo.id)}" aria-label="タスクを編集">編集</button>
              <button class="icon-button" type="button" data-delete-todo="${escapeHtml(todo.id)}" aria-label="タスクを削除">削除</button>
            </div>`}
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
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
    const isToday = dateKey === todayKey;
    const weekend = dayDate.getDay() === 6 ? "saturday" : dayDate.getDay() === 0 ? "sunday" : "";
    const entries = (tasksByDate.get(dateKey) || []).map((todo) => `
      <span class="calendar-task ${todo.done ? "is-done" : ""}">${todo.done ? "✓ " : ""}${escapeHtml(todo.task)}${todo.scope ? `<small>範囲：${escapeHtml(todo.scope)}</small>` : ""}</span>`).join("");
    return `<div class="calendar-day ${inMonth ? "" : "outside-month"} ${weekend} ${isToday ? "is-today" : ""}" role="gridcell"${isToday ? ' aria-current="date"' : ""}>
      <span class="calendar-date${isToday ? " is-today" : ""}"><span class="calendar-date-number">${dayDate.getDate()}</span></span>${entries}
    </div>`;
  }).join("");

  document.querySelector("#calendar-grid").innerHTML = `
    ${WEEKDAYS.map((weekday, index) => `<div class="weekday ${index === 5 ? "saturday" : index === 6 ? "sunday" : ""}" role="columnheader">${weekday}</div>`).join("")}
    ${days}`;
}

function renderSettings() {
  document.querySelector("#settings-test-count").textContent = activeRecords("testResults").length;
  document.querySelector("#settings-todo-count").textContent = activeRecords("todos").length;
  document.querySelector("#theme-select").value = state.settings.theme;
  document.querySelector("#notification-timing").value = state.settings.notificationTiming;

  const toggle = document.querySelector("#notification-toggle");
  const status = document.querySelector("#notification-status");
  toggle.textContent = state.settings.notificationsEnabled ? "通知を停止" : "通知を有効にする";
  toggle.disabled = !("Notification" in window);
  if (!("Notification" in window)) {
    status.textContent = "このブラウザーは通知に対応していません。";
  } else if (Notification.permission === "denied") {
    status.textContent = "通知がブロックされています。ブラウザーのサイト設定から許可してください。";
  } else if (state.notificationError) {
    status.textContent = state.notificationError;
  } else if (state.settings.notificationsEnabled) {
    status.textContent = "通知はオンです。このアプリを開いている間に期限を確認します。";
  } else {
    status.textContent = Notification.permission === "granted"
      ? "通知はオフです。"
      : "有効にすると、ブラウザーが通知の許可を確認します。";
  }
}

function reminderOffsets() {
  if (state.settings.notificationTiming === "3") return [3, 1, 0];
  if (state.settings.notificationTiming === "1") return [1, 0];
  return [0];
}

async function showReminder(todo, daysUntilDue) {
  const dueDescription = daysUntilDue === 0
    ? "期限は今日です。"
    : `期限まであと${daysUntilDue}日です。`;
  const body = [todo.task, todo.scope ? `範囲：${todo.scope}` : "", dueDescription]
    .filter(Boolean)
    .join("\n");
  const options = {
    body,
    icon: "./icon-192.png",
    tag: `todo-${todo.id}-${todo.dueDate}-${daysUntilDue}`,
    data: { url: "./" },
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification("Study Desk：期限のお知らせ", options);
  } else {
    new Notification("Study Desk：期限のお知らせ", options);
  }
}

async function checkDueReminders() {
  if (state.checkingReminders || !state.settings.notificationsEnabled) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  state.checkingReminders = true;
  try {
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const offsets = reminderOffsets();
    for (const todo of activeRecords("todos")) {
      if (todo.done || !/^\d{4}-\d{2}-\d{2}$/.test(todo.dueDate || "")) continue;
      const [year, month, day] = todo.dueDate.split("-").map(Number);
      const dueUtc = Date.UTC(year, month - 1, day);
      if (!Number.isFinite(dueUtc) || new Date(dueUtc).toISOString().slice(0, 10) !== todo.dueDate) continue;
      const daysUntilDue = Math.round((dueUtc - todayUtc) / 86400000);
      if (!offsets.includes(daysUntilDue)) continue;
      const reminderKey = `${todo.id}|${todo.dueDate}|${daysUntilDue}`;
      if (state.settings.notifiedReminders.includes(reminderKey)) continue;

      await showReminder(todo, daysUntilDue);
      state.settings.notifiedReminders.push(reminderKey);
      state.settings.notifiedReminders = state.settings.notifiedReminders.slice(-300);
      state.notificationError = "";
      saveSettings();
    }
  } catch (error) {
    console.error("期限通知を表示できませんでした。", error);
    state.notificationError = "通知を表示できませんでした。ブラウザーの通知設定を確認してください。";
    if (state.page === "settings") renderSettings();
  } finally {
    state.checkingReminders = false;
  }
}

function persistAndRender() {
  saveData();
  renderPage();
  renderHome();
  renderSettings();
  void checkDueReminders();
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
    csv = ["task,scope,due_date,done", ...records.map((item) => [item.task, item.scope, item.dueDate, item.done].map(csvEscape).join(","))].join("\r\n");
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
      scope: record.scope ?? record["範囲"] ?? "",
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
    scope: String(form.get("scope") || "").trim(),
    dueDate: String(form.get("dueDate") || ""),
    done: false,
  }));
  event.currentTarget.reset();
  persistAndRender();
});

document.addEventListener("submit", (event) => {
  const formElement = event.target.closest("[data-edit-todo-form]");
  if (!formElement) return;
  event.preventDefault();
  const todo = state.data.todos.find((item) => item.id === formElement.dataset.todoId);
  if (!todo) return;
  const form = new FormData(formElement);
  const task = String(form.get("task") || "").trim();
  if (!task) return;
  todo.task = task;
  todo.scope = String(form.get("scope") || "").trim();
  todo.dueDate = String(form.get("dueDate") || "");
  todo.updatedAt = new Date().toISOString();
  state.editingTodoId = null;
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
  const editTodoId = event.target.closest("[data-edit-todo]")?.dataset.editTodo;
  const cancelTodoId = event.target.closest("[data-cancel-todo-edit]")?.dataset.cancelTodoEdit;
  if (editTodoId) {
    state.editingTodoId = editTodoId;
    renderTodos();
    return;
  }
  if (cancelTodoId) {
    state.editingTodoId = null;
    renderTodos();
    return;
  }
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

document.querySelector("#theme-select").addEventListener("change", (event) => {
  state.settings.theme = event.currentTarget.value;
  saveSettings();
  applyTheme();
});

document.querySelector("#notification-timing").addEventListener("change", (event) => {
  state.settings.notificationTiming = event.currentTarget.value;
  saveSettings();
  void checkDueReminders();
});

document.querySelector("#notification-toggle").addEventListener("click", async () => {
  if (state.settings.notificationsEnabled) {
    state.settings.notificationsEnabled = false;
    state.notificationError = "";
    saveSettings();
    renderSettings();
    return;
  }

  if (!("Notification" in window)) {
    state.notificationError = "このブラウザーは通知に対応していません。";
    renderSettings();
    return;
  }

  try {
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
    if (permission !== "granted") {
      state.notificationError = permission === "denied"
        ? "通知が許可されませんでした。ブラウザーのサイト設定から許可できます。"
        : "通知を有効にするには、ブラウザーの通知許可が必要です。";
      renderSettings();
      return;
    }

    state.settings.notificationsEnabled = true;
    state.notificationError = "";
    saveSettings();
    renderSettings();
    void checkDueReminders();
  } catch (error) {
    console.error("通知を有効にできませんでした。", error);
    state.notificationError = "通知の設定に失敗しました。ブラウザーの設定を確認してください。";
    renderSettings();
  }
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
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.error("Service Workerを登録できませんでした。", error);
      state.notificationError = "通知の準備に失敗しました。ページを再読み込みしてください。";
      if (state.page === "settings") renderSettings();
    });
  });
}

applyTheme();
renderPage();
void checkDueReminders();
window.addEventListener("focus", () => void checkDueReminders());
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void checkDueReminders();
});
window.setInterval(() => void checkDueReminders(), 60_000);