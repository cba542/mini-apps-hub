"use strict";

const STORAGE_KEY = "meal-time-planner-state";
const MODE_CALENDAR = "calendar";
const MODE_TIME = "time";
const PERSON_COLORS = [
  "#e45858",
  "#2f6bd1",
  "#d89b20",
  "#2a9d67",
  "#8a63d2",
  "#1b9aaa",
  "#d94f9b",
  "#6b7c12",
];
const MONTH_COLORS = [
  "#d96a5b",
  "#d4a036",
  "#4e9f7a",
  "#4b7fd1",
  "#8a63d2",
  "#d9822b",
  "#2f9fb1",
  "#c15fa2",
  "#6d8b2d",
  "#b8704c",
  "#4f6aa3",
  "#9a6f2e",
];

const today = new Date();
const defaultEnd = new Date(today);
defaultEnd.setDate(today.getDate() + 6);

const defaultConfig = {
  startDate: today.toISOString().slice(0, 10),
  endDate: defaultEnd.toISOString().slice(0, 10),
  startTime: "11:00",
  endTime: "22:00",
  stepMinutes: 30,
};

const state = {
  people: [
    { id: 1, name: "小周", availability: new Set() },
    { id: 2, name: "阿敏", availability: new Set() },
  ],
  activePersonId: 1,
  slots: [],
  days: [],
  mode: MODE_CALENDAR,
  showOthers: false,
  lang: "zh-CN",
  weekOffset: 0,
  monthOffset: 0,
  config: { ...defaultConfig },
  drag: {
    active: false,
    dayIndex: null,
    mode: null,
    lastSlotId: null,
    pointerId: null,
    suppressClickUntil: 0,
  },
};

const labels = {
  weekdays: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
};

const elements = {
  peopleList: document.getElementById("people-list"),
  currentPerson: document.getElementById("current-person"),
  personName: document.getElementById("person-name"),
  addPerson: document.getElementById("add-person"),
  clearActive: document.getElementById("clear-active"),
  clearAll: document.getElementById("clear-all"),
  schedule: document.getElementById("schedule"),
  statusText: document.getElementById("status-text"),
  summaryStats: document.getElementById("summary-stats"),
  commonList: document.getElementById("common-list"),
  commonBars: document.getElementById("common-bars"),
  monthPrev: document.getElementById("month-prev"),
  monthNext: document.getElementById("month-next"),
  monthRange: document.getElementById("month-range"),
  startDate: document.getElementById("start-date"),
  endDate: document.getElementById("end-date"),
  startTime: document.getElementById("start-time"),
  endTime: document.getElementById("end-time"),
  stepMinutes: document.getElementById("step-minutes"),
  applyConfig: document.getElementById("apply-config"),
  toggleDots: document.getElementById("toggle-dots"),
  modeCalendar: document.getElementById("mode-calendar"),
  modeTime: document.getElementById("mode-time"),
  toggleLang: document.getElementById("toggle-lang"),
  rangeText: document.getElementById("range-text"),
  stepText: document.getElementById("step-text"),
  clearStorage: document.getElementById("clear-storage"),
  jsonArea: document.getElementById("json-area"),
  copyJson: document.getElementById("copy-json"),
  downloadJson: document.getElementById("download-json"),
  importJson: document.getElementById("import-json"),
  importFile: document.getElementById("import-file"),
  jsonFile: document.getElementById("json-file"),
  createRoom: document.getElementById("create-room"),
  joinRoom: document.getElementById("join-room"),
  roomIdInput: document.getElementById("room-id"),
  copyRoom: document.getElementById("copy-room"),
  saveRoom: document.getElementById("save-room"),
  roomStatus: document.getElementById("room-status"),
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseDate = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseTimeMinutes = (value) => {
  if (!value) {
    return null;
  }
  const [hours, minutes] = value.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return null;
  }
  return hours * 60 + minutes;
};

const isValidDateString = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidTimeString = (value) => typeof value === "string" && /^\d{2}:\d{2}$/.test(value);

const sanitizeConfig = (raw) => {
  const config = { ...defaultConfig, ...(raw || {}) };
  if (!isValidDateString(config.startDate)) {
    config.startDate = defaultConfig.startDate;
  }
  if (!isValidDateString(config.endDate)) {
    config.endDate = defaultConfig.endDate;
  }
  if (!isValidTimeString(config.startTime)) {
    config.startTime = defaultConfig.startTime;
  }
  if (!isValidTimeString(config.endTime)) {
    config.endTime = defaultConfig.endTime;
  }
  const validSteps = [15, 30, 60];
  if (!validSteps.includes(Number(config.stepMinutes))) {
    config.stepMinutes = defaultConfig.stepMinutes;
  }
  const start = parseDate(config.startDate);
  const end = parseDate(config.endDate);
  if (start && end && end < start) {
    config.startDate = defaultConfig.startDate;
    config.endDate = defaultConfig.endDate;
  }
  return config;
};

const formatDateKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
};

const formatTime = (minutes) => {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const isMobileView = () => window.matchMedia("(max-width: 600px)").matches;

const SYNC_INTERVAL_MS = 15000;

const roomState = {
  id: null,
  lastSyncedAt: 0,
  dirty: false,
  saveTimer: null,
  pollTimer: null,
  statusKey: null,
  statusFallback: "",
};

const getDefaultStatePayload = () => ({
  people: [
    { id: 1, name: "小周", availability: [] },
    { id: 2, name: "阿敏", availability: [] },
  ],
  activePersonId: 1,
  slots: [],
  days: [],
  mode: MODE_CALENDAR,
  showOthers: false,
  lang: "zh-CN",
  weekOffset: 0,
  monthOffset: 0,
  config: { ...defaultConfig },
});

const getMonthContext = () => {
  const startDate = parseDate(state.config.startDate);
  const endDate = parseDate(state.config.endDate);
  if (!startDate || !endDate) {
    return null;
  }
  const base = new Date(startDate);
  base.setHours(12, 0, 0, 0);
  base.setMonth(base.getMonth() + state.monthOffset, 1);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1, 12, 0, 0, 0);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0, 12, 0, 0, 0);
  const rangeStart = new Date(startDate);
  rangeStart.setHours(12, 0, 0, 0);
  const rangeEnd = new Date(endDate);
  rangeEnd.setHours(12, 0, 0, 0);
  return {
    monthStart,
    monthEnd,
    rangeStart,
    rangeEnd,
  };
};

const getMonthDays = () => {
  const context = getMonthContext();
  if (!context) {
    return [];
  }
  const { monthStart, monthEnd } = context;
  const days = [];
  const cursor = new Date(monthStart);
  while (cursor <= monthEnd) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const buildDays = (startDate, endDate) => {
  const days = [];
  const cursor = new Date(startDate);
  cursor.setHours(12, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(12, 0, 0, 0);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const generateSlots = () => {
  const startDate = parseDate(state.config.startDate);
  const endDate = parseDate(state.config.endDate);
  if (!startDate || !endDate) {
    return { slots: [], days: [] };
  }
  const days = buildDays(startDate, endDate);
  if (state.mode === MODE_CALENDAR) {
    const slots = days.map((date, dayIndex) => {
      const dateKey = formatDateKey(date);
      return {
        id: dateKey,
        dayIndex,
        date,
        dateKey,
      };
    });
    return { slots, days };
  }
  const slots = [];
  const startMinutes = parseTimeMinutes(state.config.startTime);
  const endMinutes = parseTimeMinutes(state.config.endTime);
  if (startMinutes === null || endMinutes === null) {
    return { slots: [], days: [] };
  }
  days.forEach((date, dayIndex) => {
    const dateKey = formatDateKey(date);
    for (let minutes = startMinutes; minutes < endMinutes; minutes += state.config.stepMinutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const slotId = `${dateKey}-${String(hour).padStart(2, "0")}-${String(minute).padStart(2, "0")}`;
      slots.push({
        id: slotId,
        dayIndex,
        date,
        dateKey,
        hour,
        minute,
      });
    }
  });
  return { slots, days };
};

const buildScheduleGrid = () => {
  elements.schedule.innerHTML = "";
  const mobile = isMobileView();
  const viewDays = mobile ? getMonthDays() : state.days;
  if (state.mode === MODE_CALENDAR) {
    elements.schedule.classList.add("schedule--calendar");
    elements.schedule.style.gridTemplateColumns = mobile
      ? "repeat(7, 1fr)"
      : "repeat(7, minmax(96px, 1fr))";
    elements.schedule.style.gridTemplateRows = mobile ? "40px" : "48px";
    elements.schedule.style.gridAutoRows = mobile ? "64px" : "96px";

    const startWeekday = viewDays[0]?.getDay() ?? 0;
    labels.weekdays.forEach((label) => {
      const cell = document.createElement("div");
      cell.className = "day-cell day-cell--week";
      cell.textContent = label;
      elements.schedule.appendChild(cell);
    });

    const fillerCount = mobile ? startWeekday : startWeekday;
    for (let i = 0; i < fillerCount; i += 1) {
      const filler = document.createElement("div");
      filler.className = "day-cell day-cell--blank";
      elements.schedule.appendChild(filler);
    }

    viewDays.forEach((date) => {
      const dateKey = formatDateKey(date);
      const slot = state.slots.find((entry) => entry.dateKey === dateKey);
      if (!slot) {
        const empty = document.createElement("div");
        empty.className = "slot slot--calendar";
        elements.schedule.appendChild(empty);
        return;
      }
      const cell = document.createElement("div");
      const showMonthTag = date.getDate() === 1 || (!mobile && slot.dayIndex === 0);
      const monthIndex = date.getMonth();
      const monthColor = MONTH_COLORS[monthIndex % MONTH_COLORS.length];
      const monthTag = showMonthTag
        ? `<span class="month-tag" style="--month-color: ${monthColor}">${monthIndex + 1}月</span>`
        : "";
      cell.className = "slot slot--calendar";
      cell.dataset.slotId = slot.id;
      cell.dataset.dayIndex = String(slot.dayIndex);
      cell.dataset.level = "0";
      cell.innerHTML = `
        <span class="calendar-day">${date.getDate()}</span>
        ${monthTag}
        <div class="calendar-dots"></div>
      `;
      cell.addEventListener("pointerdown", handlePointerDown);
      elements.schedule.appendChild(cell);
    });
    updateMonthRange(viewDays);
    return;
  }

  elements.schedule.classList.remove("schedule--calendar");
  elements.schedule.style.gridAutoRows = "";
  const daysCount = viewDays.length;
  const startMinutes = parseTimeMinutes(state.config.startTime);
  const endMinutes = parseTimeMinutes(state.config.endTime);
  const slotsPerDay = (endMinutes - startMinutes) / state.config.stepMinutes;
  const dayColumn = mobile ? "minmax(40px, 1fr)" : "minmax(60px, 1fr)";
  elements.schedule.style.gridTemplateColumns = mobile
    ? `56px repeat(${daysCount}, ${dayColumn})`
    : `120px repeat(${daysCount}, ${dayColumn})`;
  elements.schedule.style.gridTemplateRows = mobile
    ? `40px repeat(${slotsPerDay}, 28px)`
    : `48px repeat(${slotsPerDay}, 32px)`;

  const headerBlank = document.createElement("div");
  headerBlank.className = "day-cell";
  headerBlank.textContent = "时间";
  elements.schedule.appendChild(headerBlank);

  viewDays.forEach((date) => {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const week = labels.weekdays[date.getDay()];
    cell.innerHTML = `${week}<br /><span class="muted">${formatDate(date)}</span>`;
    elements.schedule.appendChild(cell);
  });

  let rowIndex = 0;
  for (let minutes = startMinutes; minutes < endMinutes; minutes += state.config.stepMinutes) {
    const timeCell = document.createElement("div");
    timeCell.className = "time-cell";
    timeCell.textContent = formatTime(minutes);
    elements.schedule.appendChild(timeCell);

    for (let dayIndex = 0; dayIndex < daysCount; dayIndex += 1) {
      const date = viewDays[dayIndex];
      const dateKey = formatDateKey(date);
      const slot = state.slots.find((entry) => entry.dateKey === dateKey && entry.hour != null);
      if (!slot) {
        const empty = document.createElement("div");
        empty.className = "slot";
        elements.schedule.appendChild(empty);
        continue;
      }
      const minutesForSlot = slot.hour * 60 + slot.minute;
      if (minutesForSlot !== minutes) {
        const empty = document.createElement("div");
        empty.className = "slot";
        elements.schedule.appendChild(empty);
        continue;
      }
      const cell = document.createElement("div");
      cell.className = "slot";
      cell.dataset.slotId = slot.id;
      cell.dataset.dayIndex = String(slot.dayIndex);
      cell.dataset.level = "0";
      cell.addEventListener("pointerdown", handlePointerDown);
      elements.schedule.appendChild(cell);
    }
    rowIndex += 1;
  }
  updateMonthRange(viewDays);
};

const renderPeople = () => {
  elements.peopleList.innerHTML = "";
  state.people.forEach((person, index) => {
    const item = document.createElement("div");
    item.className = "person";
    if (person.id === state.activePersonId) {
      item.classList.add("active");
    }
    item.innerHTML = `
      <span class="person-name" data-id="${person.id}">
        <i class="person-dot" style="--dot-color: ${PERSON_COLORS[index % PERSON_COLORS.length]}"></i>
        <span class="person-label">${person.name}</span>
      </span>
      <div class="person-actions">
        <button type="button" class="person-remove" data-id="${person.id}">×</button>
      </div>
    `;
    item.addEventListener("click", (event) => {
      if (event.target.matches(".person-remove")) {
        removePerson(person.id);
        return;
      }
      if (event.target.closest(".person-name")) {
        startRename(person.id, event.target.closest(".person-name"));
        return;
      }
      setActivePerson(person.id);
    });
    elements.peopleList.appendChild(item);
  });
  updateCurrentPerson();
};

const updateCurrentPerson = () => {
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  const dict = I18N[state.lang] || I18N["zh-CN"];
  const label = dict.currentPerson.replace("-", person ? person.name : "-");
  elements.currentPerson.textContent = label;
};

const updateStatus = (message) => {
  elements.statusText.textContent = message;
};

const updateStatusKey = (key) => {
  const dict = I18N[state.lang] || I18N["zh-CN"];
  const message = dict[key] || "";
  updateStatus(message);
};

const updateRoomStatus = (key, fallback) => {
  roomState.statusKey = key;
  roomState.statusFallback = fallback || "";
  if (!elements.roomStatus) {
    return;
  }
  const dict = I18N[state.lang] || I18N["zh-CN"];
  elements.roomStatus.textContent = dict[key] || fallback || "";
};

const setRoomId = (roomId) => {
  roomState.id = roomId;
  if (elements.roomIdInput) {
    elements.roomIdInput.value = roomId || "";
  }
  if (roomId) {
    updateRoomStatus("roomReady", `房间：${roomId}`);
  } else {
    updateRoomStatus("roomIdle", "未加入房间");
  }
};

const buildRoomUrl = (roomId) => {
  const url = new URL(window.location.href);
  if (roomId) {
    url.searchParams.set("room", roomId);
  } else {
    url.searchParams.delete("room");
  }
  return url.toString();
};

const scheduleSave = () => {
  if (!roomState.id) {
    return;
  }
  roomState.dirty = true;
  if (roomState.saveTimer) {
    clearTimeout(roomState.saveTimer);
  }
  roomState.saveTimer = setTimeout(() => {
    saveRoom();
  }, 1000);
};

const refreshFromDefault = () => {
  const payload = getDefaultStatePayload();
  applyStateData(payload);
  syncInputs();
  rebuildSchedule();
  renderPeople();
  updateSummary();
  updateInfoCard();
  updateJsonArea();
  updateModeUI();
  applyLanguage();
};

const markSynced = (updatedAt) => {
  roomState.dirty = false;
  roomState.lastSyncedAt = updatedAt;
  updateRoomStatus("roomSynced", "已同步");
};

const saveRoom = async (options = { notify: false }) => {
  if (!roomState.id) {
    return;
  }
  const payload = {
    data: JSON.stringify(serializeState()),
  };
  try {
    const response = await fetch(`/api/rooms/${roomState.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      updateRoomStatus("roomSaveFail", "保存失败");
      return;
    }
    const result = await response.json();
    markSynced(result.updatedAt || 0);
    if (options.notify) {
      updateRoomStatus("roomSaved", "已保存");
    }
  } catch (error) {
    updateRoomStatus("roomSaveFail", "保存失败");
  }
};

const fetchRoom = async (roomId, options = { silent: false }) => {
  try {
    const response = await fetch(`/api/rooms/${roomId}`);
    if (!response.ok) {
      if (!options.silent) {
        updateRoomStatus("roomNotFound", "房间不存在");
      }
      return null;
    }
    return await response.json();
  } catch (error) {
    if (!options.silent) {
      updateRoomStatus("roomLoadFail", "加载失败");
    }
    return null;
  }
};

const applyRoomData = (payload) => {
  if (!payload || !payload.data) {
    return false;
  }
  try {
    const data = JSON.parse(payload.data);
    const ok = applyStateData(data);
    if (!ok) {
      return false;
    }
    syncInputs();
    rebuildSchedule();
    renderPeople();
    updateSummary();
    updateInfoCard();
    updateJsonArea();
    applyLanguage();
    return true;
  } catch (error) {
    return false;
  }
};

const pollRoom = async () => {
  if (!roomState.id) {
    return;
  }
  const payload = await fetchRoom(roomState.id, { silent: true });
  if (!payload || typeof payload.updatedAt !== "number") {
    return;
  }
  if (payload.updatedAt > roomState.lastSyncedAt && !roomState.dirty) {
    const applied = applyRoomData(payload);
    if (applied) {
      markSynced(payload.updatedAt);
    }
  }
};

const startPolling = () => {
  if (roomState.pollTimer) {
    clearInterval(roomState.pollTimer);
  }
  roomState.pollTimer = setInterval(pollRoom, SYNC_INTERVAL_MS);
};

const createRoomFlow = async () => {
  refreshFromDefault();
  const payloadData = JSON.stringify(getDefaultStatePayload());
  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: payloadData }),
    });
    if (!response.ok) {
      updateRoomStatus("roomCreateFail", "创建失败");
      return;
    }
    const payload = await response.json();
    setRoomId(payload.roomId);
    markSynced(payload.updatedAt || 0);
    const url = buildRoomUrl(payload.roomId);
    window.history.replaceState({}, "", url);
    startPolling();
  } catch (error) {
    updateRoomStatus("roomCreateFail", "创建失败");
  }
};

const joinRoomFlow = async () => {
  const roomId = elements.roomIdInput?.value.trim().toUpperCase();
  if (!roomId) {
    updateRoomStatus("roomIdRequired", "请输入房间号");
    return;
  }
  const payload = await fetchRoom(roomId);
  if (!payload) {
    return;
  }
  setRoomId(roomId);
  const applied = applyRoomData(payload);
  if (!applied) {
    updateRoomStatus("roomLoadFail", "加载失败");
    return;
  }
  markSynced(payload.updatedAt || 0);
  const url = buildRoomUrl(roomId);
  window.history.replaceState({}, "", url);
  startPolling();
};

const copyRoomLink = async () => {
  if (!roomState.id) {
    updateRoomStatus("roomNoLink", "没有房间");
    return;
  }
  const url = buildRoomUrl(roomState.id);
  try {
    await navigator.clipboard.writeText(url);
    updateRoomStatus("roomLinkCopied", "已复制链接");
  } catch (error) {
    updateRoomStatus("roomCopyFail", "复制失败");
  }
};

const initRoomFromUrl = async () => {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get("room");
  if (!roomId) {
    setRoomId(null);
    return;
  }
  const normalized = roomId.trim().toUpperCase();
  const payload = await fetchRoom(normalized);
  if (!payload) {
    setRoomId(null);
    return;
  }
  setRoomId(normalized);
  const applied = applyRoomData(payload);
  if (applied) {
    markSynced(payload.updatedAt || 0);
  }
  startPolling();
};


const setActivePerson = (id) => {
  state.activePersonId = id;
  renderPeople();
  updateGridVisuals();
};

const addPerson = () => {
  const name = elements.personName.value.trim();
  if (!name) {
    updateStatusKey("nameRequired");
    return;
  }
  const newId = Math.max(0, ...state.people.map((person) => person.id)) + 1;
  state.people.push({ id: newId, name, availability: new Set() });
  elements.personName.value = "";
  setActivePerson(newId);
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatusKey("addPerson");
  applyLanguage();
  scheduleSave();
};

const removePerson = (id) => {
  const index = state.people.findIndex((person) => person.id === id);
  if (index === -1) {
    return;
  }
  state.people.splice(index, 1);
  if (state.activePersonId === id) {
    state.activePersonId = state.people[0]?.id ?? null;
  }
  renderPeople();
  updateGridVisuals();
  updateSummary();
  saveState();
  updateJsonArea();
};

const renamePerson = (id, nextName) => {
  const person = state.people.find((entry) => entry.id === id);
  if (!person) {
    return false;
  }
  const trimmed = nextName.trim();
  if (!trimmed) {
    updateStatusKey("renameEmpty");
    return false;
  }
  person.name = trimmed;
  renderPeople();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatusKey("renameSuccess");
  applyLanguage();
  scheduleSave();
  return true;
};

const startRename = (id, nameEl) => {
  const person = state.people.find((entry) => entry.id === id);
  if (!person || !nameEl) {
    return;
  }
  const input = document.createElement("input");
  input.type = "text";
  input.value = person.name;
  input.className = "rename-input";
  const label = nameEl.querySelector(".person-label");
  if (!label) {
    return;
  }
  nameEl.replaceChild(input, label);
  input.focus();
  input.select();

  const finish = (save) => {
    const value = input.value;
    if (save) {
      renamePerson(id, value);
    } else {
      renderPeople();
    }
  };

  input.addEventListener("blur", () => finish(true));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      finish(true);
    }
    if (event.key === "Escape") {
      finish(false);
    }
  });
};



const setSlotSelection = (slotId, shouldSelect) => {
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  if (!person) {
    return;
  }
  if (shouldSelect) {
    person.availability.add(slotId);
  } else {
    person.availability.delete(slotId);
  }
};

const toggleSlot = (slotId) => {
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  if (!person) {
    updateStatusKey("selectPerson");
    return;
  }
  if (person.availability.has(slotId)) {
    person.availability.delete(slotId);
  } else {
    person.availability.add(slotId);
  }
  updateGridVisuals();
  updateSummary();
  saveState();
};

const clearActive = () => {
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  if (!person) {
    return;
  }
  person.availability.clear();
  updateGridVisuals();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatusKey("clearActiveDone");
  applyLanguage();
  scheduleSave();
};

const clearAll = () => {
  const dict = I18N[state.lang] || I18N["zh-CN"];
  const ok = window.confirm(dict.confirmClearAll || "确认清空所有人的选择吗？");
  if (!ok) {
    return;
  }
  state.people.forEach((person) => person.availability.clear());
  updateGridVisuals();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatusKey("clearAllDone");
  applyLanguage();
  scheduleSave();
};

const updateGridVisuals = () => {
  const totalPeople = state.people.length;
  const cells = elements.schedule.querySelectorAll(".slot");
  const activePerson = state.people.find((entry) => entry.id === state.activePersonId);

  cells.forEach((cell) => {
    const slotId = cell.dataset.slotId;
    let count = 0;
    state.people.forEach((person) => {
      if (person.availability.has(slotId)) {
        count += 1;
      }
    });

    if (totalPeople > 0 && count === totalPeople) {
      cell.dataset.level = "all";
    } else {
      const level = clamp(count, 0, 3);
      cell.dataset.level = String(level);
    }

    if (activePerson && activePerson.availability.has(slotId)) {
      cell.classList.add("is-selected");
    } else {
      cell.classList.remove("is-selected");
    }

    if (state.mode === MODE_CALENDAR) {
      const dotWrap = cell.querySelector(".calendar-dots");
      if (!dotWrap) {
        return;
      }
      dotWrap.innerHTML = "";
      state.people.forEach((person, index) => {
        if (!person.availability.has(slotId)) {
          return;
        }
        if (!state.showOthers && person.id !== state.activePersonId) {
          return;
        }
        const dot = document.createElement("span");
        dot.className = "person-dot";
        dot.style.setProperty("--dot-color", PERSON_COLORS[index % PERSON_COLORS.length]);
        dotWrap.appendChild(dot);
      });
    }
  });
};

const updateSummary = () => {
  const totalPeople = state.people.length;
  const dict = I18N[state.lang] || I18N["zh-CN"];
  elements.summaryStats.textContent = dict.summaryStats.replace("-", totalPeople);

  const commonsByDate = new Map();
  const peopleByDate = new Map();

  if (totalPeople > 0) {
    if (state.mode === MODE_CALENDAR) {
      state.people.forEach((person) => {
        person.availability.forEach((dateKey) => {
          if (!isValidDateString(dateKey)) {
            return;
          }
          let selectedPeople = peopleByDate.get(dateKey);
          if (!selectedPeople) {
            selectedPeople = new Set();
            peopleByDate.set(dateKey, selectedPeople);
          }
          selectedPeople.add(person.id);
        });
      });

      peopleByDate.forEach((selectedPeople, dateKey) => {
        if (selectedPeople.size === totalPeople) {
          const slot = state.slots.find((entry) => entry.dateKey === dateKey);
          if (slot) {
            commonsByDate.set(dateKey, [slot]);
          }
        }
      });
    } else {
      state.slots.forEach((slot) => {
        const selectedPeople = new Set();
        state.people.forEach((person) => {
          if (person.availability.has(slot.id)) {
            selectedPeople.add(person.id);
          }
        });
        if (selectedPeople.size > 0) {
          const dateKey = slot.dateKey;
          let datePeople = peopleByDate.get(dateKey);
          if (!datePeople) {
            datePeople = new Set();
            peopleByDate.set(dateKey, datePeople);
          }
          selectedPeople.forEach((personId) => datePeople.add(personId));
        }
        if (selectedPeople.size === totalPeople) {
          const list = commonsByDate.get(slot.dateKey) ?? [];
          list.push(slot);
          commonsByDate.set(slot.dateKey, list);
        }
      });
    }
  }

  if (elements.commonBars) {
    elements.commonBars.innerHTML = "";
    if (totalPeople === 0 || !peopleByDate.size) {
      elements.commonBars.innerHTML = "<div class=\"common-empty\">暂无选择记录。</div>";
    } else {
      const dates = Array.from(peopleByDate.keys()).sort();
      dates.forEach((dateKey) => {
        const count = peopleByDate.get(dateKey)?.size ?? 0;
        if (!count) {
          return;
        }
        const date = parseDate(dateKey);
        const week = date ? labels.weekdays[date.getDay()] : "";
        const dateText = date ? `${week} ${formatDate(date)}` : dateKey;
        const item = document.createElement("div");
        item.className = "common-bar";
        item.innerHTML = `
          <div class="common-bar-label">${dateText}</div>
          <div class="common-bar-track">
            <div class="common-bar-fill" style="width: ${(count / totalPeople) * 100}%"></div>
          </div>
          <div class="common-bar-count">${count}/${totalPeople}</div>
        `;
        elements.commonBars.appendChild(item);
      });
    }
  }

  elements.commonList.innerHTML = "";
  if (!commonsByDate.size) {
    const empty = document.createElement("li");
    empty.className = "common-group";
    empty.textContent = "暂无共同空档。";
    elements.commonList.appendChild(empty);
    return;
  }

  Array.from(commonsByDate.entries()).forEach(([dateKey, slots]) => {
    const date = parseDate(dateKey);
    const item = document.createElement("li");
    item.className = "common-group";
    const week = date ? labels.weekdays[date.getDay()] : "";
    const dateText = date ? `${week} ${formatDate(date)}` : dateKey;
    if (state.mode === MODE_CALENDAR) {
      item.innerHTML = `
        <div class="common-date">${dateText}</div>
        <div class="common-times">${dict.allDayAvailable || "整天可行"}</div>
      `;
      elements.commonList.appendChild(item);
      return;
    }
    const times = slots
      .map((slot) => `${String(slot.hour).padStart(2, "0")}:${String(slot.minute).padStart(2, "0")}`)
      .join(" ");
    item.innerHTML = `
      <div class="common-date">${dateText}</div>
      <div class="common-times">${times}</div>
    `;
    elements.commonList.appendChild(item);
  });
};

const updateInfoCard = () => {
  const startDate = parseDate(state.config.startDate);
  const endDate = parseDate(state.config.endDate);
  if (!startDate || !endDate) {
    elements.rangeText.textContent = "-";
    return;
  }
  const startText = `${labels.weekdays[startDate.getDay()]} ${formatDate(startDate)}`;
  const endText = `${labels.weekdays[endDate.getDay()]} ${formatDate(endDate)}`;
  const dict = I18N[state.lang] || I18N["zh-CN"];
  if (state.mode === MODE_CALENDAR) {
    elements.rangeText.textContent = `${startText} 至 ${endText}`;
    elements.stepText.textContent = dict.allDay || "整天";
    return;
  }
  elements.rangeText.textContent = `${startText} 至 ${endText} / ${state.config.startTime}-${state.config.endTime}`;
  elements.stepText.textContent = `${state.config.stepMinutes} ${dict.minutes || "分钟"}`;
};

const serializeState = () => ({
  config: state.config,
  mode: state.mode,
  showOthers: state.showOthers,
  lang: state.lang,
  weekOffset: state.weekOffset,
  monthOffset: state.monthOffset,
  activePersonId: state.activePersonId,
  people: state.people.map((person) => ({
    id: person.id,
    name: person.name,
    availability: Array.from(person.availability),
  })),
});

const applyStateData = (data) => {
  if (!data || typeof data !== "object") {
    return false;
  }
  if (data.config) {
    state.config = sanitizeConfig(data.config);
  }
  if (data.mode === MODE_TIME || data.mode === MODE_CALENDAR) {
    state.mode = data.mode;
  }
  if (typeof data.showOthers === "boolean") {
    state.showOthers = data.showOthers;
  }
  if (data.lang === "zh-TW" || data.lang === "zh-CN") {
    state.lang = data.lang;
  }
  if (Number.isInteger(data.weekOffset)) {
    state.weekOffset = data.weekOffset;
  }
  if (Number.isInteger(data.monthOffset)) {
    state.monthOffset = data.monthOffset;
  }
  if (Array.isArray(data.people) && data.people.length) {
    state.people = data.people.map((person) => ({
      id: person.id,
      name: person.name,
      availability: new Set(person.availability || []),
    }));
  }
  if (data.activePersonId) {
    state.activePersonId = data.activePersonId;
  }
  return true;
};

const saveState = () => {
  const data = serializeState();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

const restoreState = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return;
  }
  try {
    const data = JSON.parse(raw);
    applyStateData(data);
  } catch (error) {
    console.error("Failed to restore state", error);
    state.config = { ...defaultConfig };
  }
};

const updateJsonArea = () => {
  if (!elements.jsonArea) {
    return;
  }
  const data = serializeState();
  elements.jsonArea.value = JSON.stringify(data, null, 2);
};

const copyJson = async () => {
  const data = serializeState();
  const json = JSON.stringify(data, null, 2);
  if (elements.jsonArea) {
    elements.jsonArea.value = json;
  }
  try {
    await navigator.clipboard.writeText(json);
    updateStatusKey("copyJsonDone");
  applyLanguage();
  } catch (error) {
    updateStatusKey("copyJsonFail");
  }
};

const downloadJson = () => {
  const data = serializeState();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `meal-time-planner-${timestamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  updateStatusKey("downloadJsonDone");
  applyLanguage();
};

const importJsonText = (raw) => {
  if (!raw) {
    updateStatusKey("jsonEmpty");
    return;
  }
  try {
    const data = JSON.parse(raw);
    const ok = applyStateData(data);
    if (!ok) {
      updateStatusKey("jsonInvalid");
      return;
    }
    syncInputs();
    rebuildSchedule();
    renderPeople();
    updateStatusKey("jsonImported");
    applyLanguage();
  } catch (error) {
    updateStatusKey("jsonParseFail");
  }
};

const importJson = () => {
  if (!elements.jsonArea) {
    return;
  }
  const raw = elements.jsonArea.value.trim();
  importJsonText(raw);
};

const importJsonFile = (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const content = String(reader.result || "");
    importJsonText(content.trim());
  };
  reader.onerror = () => {
    updateStatusKey("fileReadFail");
  };
  reader.readAsText(file);
  event.target.value = "";
};

const applyConfigFromInputs = (options = { notify: true }) => {
  const startDate = parseDate(elements.startDate.value);
  const endDate = parseDate(elements.endDate.value);
  const startMinutes = parseTimeMinutes(elements.startTime.value);
  const endMinutes = parseTimeMinutes(elements.endTime.value);
  const stepMinutes = Number(elements.stepMinutes.value);

  if (!startDate || !endDate) {
    if (options.notify) {
      updateStatusKey("dateRequired");
    }
    return;
  }
  if (endDate < startDate) {
    updateStatusKey("endBeforeStart");
    return;
  }
  const dayCount = Math.floor((endDate - startDate) / 86400000) + 1;
  if (dayCount > 62) {
    updateStatusKey("rangeTooLong");
    return;
  }
  if (state.mode === MODE_TIME) {
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      updateStatusKey("timeInvalid");
      return;
    }
  }

  state.config = {
    startDate: elements.startDate.value,
    endDate: elements.endDate.value,
    startTime: elements.startTime.value,
    endTime: elements.endTime.value,
    stepMinutes,
  };

  rebuildSchedule();
  updateStatusKey("configUpdated");
  applyLanguage();
  scheduleSave();
};

const rebuildSchedule = () => {
  const { slots, days } = generateSlots();
  state.slots = slots;
  state.days = days;

  const validSlotIds = new Set(slots.map((slot) => slot.id));
  state.people.forEach((person) => {
    person.availability = new Set(
      Array.from(person.availability).filter((slotId) => validSlotIds.has(slotId)),
    );
  });

  buildScheduleGrid();
  updateGridVisuals();
  updateSummary();
  updateInfoCard();
  updateJsonArea();
  updateModeUI();
};

const syncInputs = () => {
  elements.startDate.value = state.config.startDate;
  elements.endDate.value = state.config.endDate;
  elements.startTime.value = state.config.startTime;
  elements.endTime.value = state.config.endTime;
  elements.stepMinutes.value = String(state.config.stepMinutes);
};

const updateModeUI = () => {
  const timeFields = document.querySelectorAll(".time-field");
  timeFields.forEach((field) => {
    field.classList.toggle("is-hidden", state.mode === MODE_CALENDAR);
  });
  if (elements.modeCalendar) {
    elements.modeCalendar.classList.toggle("ghost", state.mode !== MODE_CALENDAR);
  }
  if (elements.modeTime) {
    elements.modeTime.classList.toggle("ghost", state.mode !== MODE_TIME);
  }
  if (elements.toggleDots) {
    elements.toggleDots.classList.toggle("ghost", !state.showOthers);
  }
  updateMonthNav();
  applyLanguage();
  updateInfoCard();
  updateCurrentPerson();
};

const setMode = (mode) => {
  if (mode !== MODE_CALENDAR && mode !== MODE_TIME) {
    return;
  }
  if (state.mode === mode) {
    return;
  }
  state.mode = mode;
  state.drag.dayIndex = null;
  state.drag.mode = null;
  state.drag.lastSlotId = null;
  state.drag.active = false;
  updateModeUI();
  rebuildSchedule();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatusKey(mode === MODE_CALENDAR ? "switchCalendar" : "switchTime");
  scheduleSave();
};

const toggleOthers = () => {
  state.showOthers = !state.showOthers;
  updateModeUI();
  updateGridVisuals();
  saveState();
  updateJsonArea();
};

const updateMonthRange = (days) => {
  if (!elements.monthRange) {
    return;
  }
  const context = getMonthContext();
  if (!context) {
    elements.monthRange.textContent = "-";
    return;
  }
  const { monthStart } = context;
  elements.monthRange.textContent = `${monthStart.getFullYear()}年${monthStart.getMonth() + 1}月`;
};

const updateMonthNav = () => {
  const show = isMobileView();
  if (elements.monthPrev) {
    elements.monthPrev.disabled = !show;
  }
  if (elements.monthNext) {
    elements.monthNext.disabled = !show;
  }
  if (!show) {
    if (elements.monthRange) {
      elements.monthRange.textContent = "-";
    }
  }
};

const changeMonth = (direction) => {
  state.monthOffset += direction;
  buildScheduleGrid();
  updateGridVisuals();
  updateSummary();
  updateModeUI();
  saveState();
  scheduleSave();
};

const I18N = {
  "zh-CN": {
    eyebrow: "Mini Apps Hub",
    title: "聚餐时间协调",
    subtitle: "选择每个人有空的时间，直观看到共同空档",
    participants: "参与者",
    currentPerson: "当前：-",
    namePlaceholder: "输入名字",
    add: "添加",
    clearActive: "清空当前",
    clearAll: "全部清空",
    configTitle: "时间设置",
    calendarMode: "月历模式",
    timeMode: "时间段",
    startDate: "起始日期",
    endDate: "结束日期",
    startTime: "每日开始",
    endTime: "每日结束",
    step: "粒度",
    apply: "更新网格",
    showAll: "显示全部",
    hideAll: "隐藏全部",
    prevMonth: "上一月",
    nextMonth: "下一月",
    createRoom: "创建房间",
    joinRoom: "加入房间",
    copyRoom: "复制链接",
    roomPlaceholder: "输入房间号",
    roomIdle: "未加入房间",
    roomReady: "房间：",
    roomSynced: "已同步",
    roomSaved: "已保存",
    roomCreateFail: "创建失败",
    roomLoadFail: "加载失败",
    roomNotFound: "房间不存在",
    roomSaveFail: "保存失败",
    roomIdRequired: "请输入房间号",
    roomLinkCopied: "链接已复制",
    roomCopyFail: "复制失败",
    roomNoLink: "没有房间",
    saveRoom: "保存",
    range: "时间范围",
    stepLabel: "粒度",
    usage: "使用方式",
    usage1: "选择一个人并点击格子标记有空。",
    usage2: "可按住拖拽连续日期或时间段。",
    usage3: "其他人轮流标记各自有空的时间。",
    usage4: "右侧会高亮大家都能的时段。",
    export: "导出 / 导入",
    exportPlaceholder: "点击复制后会生成 JSON，可在这里粘贴导入",
    copyJson: "复制 JSON",
    downloadJson: "下载 JSON",
    importJson: "导入 JSON",
    importFile: "导入文件",
    importHint: "导入会覆盖现有内容。",
    clearStorage: "清除数据",
    scheduleTitle: "时间表",
    scheduleHint: "点击格子标记有空，颜色越深代表越多人可行。",
    summaryStats: "已选人数：-",
    summaryHint: "共同空档会自动汇总在下方",
    summaryTitle: "共同空档",
    summaryDesc: "日期条越长，代表越多人选择。",
    allDay: "整天",
    allDayAvailable: "整天可行",
    minutes: "分钟",
    confirmClearAll: "确认清空所有人的选择吗？",
    confirmClearStorage: "确认清除所有数据吗？此操作不可恢复。",
    promptRename: "请输入新的名字",
    renameEmpty: "名字不能为空。",
    renameSuccess: "名字已更新。",
    addPerson: "已添加新参与者。",
    nameRequired: "请输入名字。",
    selectPerson: "请先选择一个人。",
    clearActiveDone: "已清空当前人的选择。",
    clearAllDone: "已清空所有人的选择。",
    configUpdated: "时间设置已更新。",
    dateRequired: "请填写起止日期。",
    endBeforeStart: "结束日期必须晚于开始日期。",
    rangeTooLong: "日期范围最多 62 天。",
    timeInvalid: "请确认每日开始/结束时间。",
    switchCalendar: "已切换到月历模式。",
    switchTime: "已切换到时间段模式。",
    ready: "准备就绪，选择一个人开始标记。",
    clearStorageDone: "已清除本地数据。",
    copyJsonDone: "已复制 JSON。",
    copyJsonFail: "复制失败，请手动复制。",
    downloadJsonDone: "已下载 JSON。",
    jsonEmpty: "请粘贴 JSON 内容。",
    jsonInvalid: "JSON 格式不正确。",
    jsonImported: "已导入 JSON。",
    jsonParseFail: "JSON 解析失败。",
    fileReadFail: "读取文件失败。",
  },
  "zh-TW": {
    eyebrow: "Mini Apps Hub",
    title: "聚餐時間協調",
    subtitle: "選擇每個人有空的時間，直觀看到共同空檔",
    participants: "參與者",
    currentPerson: "當前：-",
    namePlaceholder: "輸入名字",
    add: "新增",
    clearActive: "清空當前",
    clearAll: "全部清空",
    configTitle: "時間設定",
    calendarMode: "月曆模式",
    timeMode: "時間段",
    startDate: "起始日期",
    endDate: "結束日期",
    startTime: "每日開始",
    endTime: "每日結束",
    step: "粒度",
    apply: "更新網格",
    showAll: "顯示全部",
    hideAll: "隱藏全部",
    prevMonth: "上一月",
    nextMonth: "下一月",
    createRoom: "建立房間",
    joinRoom: "加入房間",
    copyRoom: "複製連結",
    roomPlaceholder: "輸入房間號",
    roomIdle: "未加入房間",
    roomReady: "房間：",
    roomSynced: "已同步",
    roomSaved: "已儲存",
    roomCreateFail: "建立失敗",
    roomLoadFail: "載入失敗",
    roomNotFound: "房間不存在",
    roomSaveFail: "儲存失敗",
    roomIdRequired: "請輸入房間號",
    roomLinkCopied: "連結已複製",
    roomCopyFail: "複製失敗",
    roomNoLink: "沒有房間",
    saveRoom: "保存",
    range: "時間範圍",
    stepLabel: "粒度",
    usage: "使用方式",
    usage1: "選擇一個人並點擊格子標記有空。",
    usage2: "可按住拖曳連續日期或時間段。",
    usage3: "其他人輪流標記各自有空的時間。",
    usage4: "右側會高亮大家都能的時段。",
    export: "匯出 / 匯入",
    exportPlaceholder: "點擊複製後會產生 JSON，可在這裡貼上匯入",
    copyJson: "複製 JSON",
    downloadJson: "下載 JSON",
    importJson: "匯入 JSON",
    importFile: "匯入檔案",
    importHint: "匯入會覆蓋現有內容。",
    clearStorage: "清除資料",
    scheduleTitle: "時間表",
    scheduleHint: "點擊格子標記有空，顏色越深代表越多人可行。",
    summaryStats: "已選人數：-",
    summaryHint: "共同空檔會自動彙總在下方",
    summaryTitle: "共同空檔",
    summaryDesc: "日期條越長，代表越多人選擇。",
    allDay: "整天",
    allDayAvailable: "整天可行",
    minutes: "分鐘",
    confirmClearAll: "確認清空所有人的選擇嗎？",
    confirmClearStorage: "確認清除所有資料嗎？此操作不可恢復。",
    promptRename: "請輸入新的名字",
    renameEmpty: "名字不能為空。",
    renameSuccess: "名字已更新。",
    addPerson: "已新增參與者。",
    nameRequired: "請輸入名字。",
    selectPerson: "請先選擇一個人。",
    clearActiveDone: "已清空當前人的選擇。",
    clearAllDone: "已清空所有人的選擇。",
    configUpdated: "時間設定已更新。",
    dateRequired: "請填寫起止日期。",
    endBeforeStart: "結束日期必須晚於開始日期。",
    rangeTooLong: "日期範圍最多 62 天。",
    timeInvalid: "請確認每日開始/結束時間。",
    switchCalendar: "已切換到月曆模式。",
    switchTime: "已切換到時間段模式。",
    ready: "準備就緒，選擇一個人開始標記。",
    clearStorageDone: "已清除本機資料。",
    copyJsonDone: "已複製 JSON。",
    copyJsonFail: "複製失敗，請手動複製。",
    downloadJsonDone: "已下載 JSON。",
    jsonEmpty: "請貼上 JSON 內容。",
    jsonInvalid: "JSON 格式不正確。",
    jsonImported: "已匯入 JSON。",
    jsonParseFail: "JSON 解析失敗。",
    fileReadFail: "讀取檔案失敗。",
  },
};

const applyLanguage = () => {
  const dict = I18N[state.lang] || I18N["zh-CN"];
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n;
    if (dict[key]) {
      el.textContent = dict[key];
    }
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    if (dict[key]) {
      el.setAttribute("placeholder", dict[key]);
    }
  });
  if (elements.toggleDots) {
    elements.toggleDots.textContent = state.showOthers ? dict.hideAll : dict.showAll;
  }
  if (elements.toggleLang) {
    elements.toggleLang.checked = state.lang === "zh-TW";
  }
  if (roomState.statusKey) {
    updateRoomStatus(roomState.statusKey, roomState.statusFallback);
  }
  if (elements.roomIdInput) {
    elements.roomIdInput.placeholder = dict.roomPlaceholder || elements.roomIdInput.placeholder;
  }
};

const toggleLanguage = (checked) => {
  state.lang = checked ? "zh-TW" : "zh-CN";
  applyLanguage();
  saveState();
};

const handlePointerDown = (event) => {
  event.preventDefault();
  const cell = event.currentTarget;
  const slotId = cell.dataset.slotId;
  const dayIndex = Number(cell.dataset.dayIndex);
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  if (!person) {
    updateStatusKey("selectPerson");
    return;
  }
  const shouldSelect = !person.availability.has(slotId);
  state.drag.active = true;
  state.drag.dayIndex = dayIndex;
  state.drag.mode = shouldSelect ? "select" : "deselect";
  state.drag.lastSlotId = null;
  state.drag.pointerId = event.pointerId;
  applyDrag(slotId, dayIndex);  // Keep receiving pointer events during drag (mouse / touch)
  try {
    event.currentTarget.setPointerCapture(event.pointerId);
  } catch (e) {
    // If not supported, document-level pointermove listener still covers dragging.
  }
};

const handlePointerMove = (event) => {
  if (!state.drag.active) {
    return;
  }
  // Some environments can report a different pointerId for document-level listeners (especially for mouse).
  if (state.drag.pointerId != null && event && event.pointerId != null) {
    if (state.drag.pointerId !== event.pointerId && event.pointerType !== "mouse") {
      return;
    }
  }
    // Hit-test the cell under the pointer.
  // Important: during pointer capture, event.target may stay as the original cell.
  // Using elementFromPoint ensures we follow the pointer while dragging.
  let target = document.elementFromPoint(event.clientX, event.clientY);
  if (target && typeof target.closest === "function") {
    target = target.closest(".slot");
  }
  // Fallback to event target if hit-test fails
  if (!target) {
    target = event.target;
    if (target && typeof target.closest === "function") {
      target = target.closest(".slot");
    }
  }
  if (!target || !target.classList || !target.classList.contains("slot")) {
    return;
  }
  const slotId = target.dataset.slotId;
  const dayIndex = Number(target.dataset.dayIndex);
  applyDrag(slotId, dayIndex);
};

const handlePointerUp = (event) => {
  if (!state.drag.active) {
    return;
  }
  if (event && state.drag.pointerId != null && event.pointerId != null) {
    if (state.drag.pointerId !== event.pointerId && event.pointerType !== "mouse") {
      return;
    }
  }
  state.drag.active = false;
  state.drag.dayIndex = null;
  state.drag.mode = null;
  state.drag.lastSlotId = null;
    // Release pointer capture if we captured it
  try {
    const el = event && (event.currentTarget || event.target);
    if (el && typeof el.hasPointerCapture === "function" && el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }
  } catch (e) {
    // Ignore
  }

  state.drag.pointerId = null;
  state.drag.suppressClickUntil = performance.now() + 150;
  updateGridVisuals();
  updateSummary();
  saveState();
  updateJsonArea();
};


const applyDrag = (slotId, dayIndex) => {
  if (state.drag.lastSlotId === slotId) {
    return;
  }
  state.drag.lastSlotId = slotId;
  const shouldSelect = state.drag.mode === "select";
  setSlotSelection(slotId, shouldSelect);
  updateGridVisuals();
  updateSummary();
  scheduleSave();
};

const clearStorage = () => {
  const dict = I18N[state.lang] || I18N["zh-CN"];
  const ok = window.confirm(dict.confirmClearStorage || "确认清除所有数据吗？此操作不可恢复。");
  if (!ok) {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
  state.config = { ...defaultConfig };
  state.mode = MODE_CALENDAR;
  state.people = [
    { id: 1, name: "小周", availability: new Set() },
    { id: 2, name: "阿敏", availability: new Set() },
  ];
  state.activePersonId = 1;
  syncInputs();
  updateModeUI();
  rebuildSchedule();
  renderPeople();
  updateJsonArea();
  updateStatusKey("clearStorageDone");
  applyLanguage();
};

const init = () => {
  restoreState();
  state.config = sanitizeConfig(state.config);
  if (!state.mode) {
    state.mode = MODE_CALENDAR;
  }
  if (state.lang !== "zh-CN" && state.lang !== "zh-TW") {
    state.lang = "zh-CN";
  }
  if (!Number.isInteger(state.weekOffset)) {
    state.weekOffset = 0;
  }
  if (!Number.isInteger(state.monthOffset)) {
    state.monthOffset = 0;
  }
  syncInputs();
  updateModeUI();
  applyLanguage();
  updateRoomStatus(roomState.id ? "roomSynced" : "roomIdle", roomState.id ? "已同步" : "未加入房间");

  const inputsMissing =
    !elements.startDate.value ||
    !elements.endDate.value ||
    (state.mode === MODE_TIME && (!elements.startTime.value || !elements.endTime.value));
  if (inputsMissing) {
    state.config = { ...defaultConfig };
    syncInputs();
  }

  if (state.mode === MODE_CALENDAR) {
    state.config.startTime = defaultConfig.startTime;
    state.config.endTime = defaultConfig.endTime;
    state.config.stepMinutes = defaultConfig.stepMinutes;
  }

  if (typeof state.showOthers !== "boolean") {
    state.showOthers = false;
  }

  let { slots, days } = generateSlots();
  if (!slots.length) {
    state.config = { ...defaultConfig };
    syncInputs();
    const refreshed = generateSlots();
    slots = refreshed.slots;
    days = refreshed.days;
  }
  state.slots = slots;
  state.days = days;
  buildScheduleGrid();
  renderPeople();
  updateGridVisuals();
  updateSummary();
  updateInfoCard();
  updateJsonArea();
  updateModeUI();
  updateMonthRange(isMobileView() ? getMonthDays() : []);
  updateStatusKey("ready");
  applyLanguage();
  initRoomFromUrl();
};

elements.addPerson.addEventListener("click", addPerson);
if (elements.personName) {
  elements.personName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      addPerson();
    }
  });
}
if (elements.clearActive) {
  elements.clearActive.addEventListener("click", clearActive);
}
if (elements.clearAll) {
  elements.clearAll.addEventListener("click", clearAll);
}
if (elements.applyConfig) {
  elements.applyConfig.addEventListener("click", () => applyConfigFromInputs({ notify: true }));
}
if (elements.startDate) {
  elements.startDate.addEventListener("change", () => applyConfigFromInputs({ notify: false }));
  elements.endDate.addEventListener("change", () => applyConfigFromInputs({ notify: false }));
  elements.startTime.addEventListener("change", () => applyConfigFromInputs({ notify: false }));
  elements.endTime.addEventListener("change", () => applyConfigFromInputs({ notify: false }));
  elements.stepMinutes.addEventListener("change", () => applyConfigFromInputs({ notify: false }));
}
if (elements.modeCalendar) {
  elements.modeCalendar.addEventListener("click", () => setMode(MODE_CALENDAR));
}
if (elements.modeTime && !elements.modeTime.disabled) {
  elements.modeTime.addEventListener("click", () => setMode(MODE_TIME));
}
if (elements.toggleDots) {
  elements.toggleDots.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleOthers();
  });
}
if (elements.toggleLang) {
  elements.toggleLang.addEventListener("change", (event) => {
    toggleLanguage(event.target.checked);
  });
}
if (elements.monthPrev) {
  elements.monthPrev.addEventListener("click", () => changeMonth(-1));
}
if (elements.monthNext) {
  elements.monthNext.addEventListener("click", () => changeMonth(1));
}
if (elements.createRoom) {
  elements.createRoom.addEventListener("click", createRoomFlow);
}
if (elements.joinRoom) {
  elements.joinRoom.addEventListener("click", joinRoomFlow);
}
if (elements.copyRoom) {
  elements.copyRoom.addEventListener("click", copyRoomLink);
}
if (elements.saveRoom) {
  elements.saveRoom.addEventListener("click", async () => {
    await saveRoom({ notify: true });
    await copyRoomLink();
  });
}
if (elements.roomIdInput) {
  elements.roomIdInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      joinRoomFlow();
    }
  });
}
if (elements.clearStorage) {
  elements.clearStorage.addEventListener("click", clearStorage);
}
if (elements.copyJson) {
  elements.copyJson.addEventListener("click", copyJson);
}
if (elements.downloadJson) {
  elements.downloadJson.addEventListener("click", downloadJson);
}
if (elements.importJson) {
  elements.importJson.addEventListener("click", importJson);
}
if (elements.importFile && elements.jsonFile) {
  elements.importFile.addEventListener("click", () => elements.jsonFile.click());
  elements.jsonFile.addEventListener("change", importJsonFile);
}

elements.schedule.addEventListener("pointermove", handlePointerMove);
elements.schedule.addEventListener("pointerup", handlePointerUp);
elements.schedule.addEventListener("pointerleave", handlePointerUp);
elements.schedule.addEventListener("pointercancel", handlePointerUp);

document.addEventListener("pointermove", handlePointerMove);
document.addEventListener("pointerup", handlePointerUp);

elements.schedule.addEventListener("click", (event) => {
  if (state.drag.active || performance.now() < state.drag.suppressClickUntil) {
    return;
  }
  let target = event.target;
  if (target && typeof target.closest === "function") {
    target = target.closest(".slot");
  }
  if (target && target.classList.contains("slot")) {
    toggleSlot(target.dataset.slotId);
  }
});


init();
