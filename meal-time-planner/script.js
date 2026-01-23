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
  startDate: document.getElementById("start-date"),
  endDate: document.getElementById("end-date"),
  startTime: document.getElementById("start-time"),
  endTime: document.getElementById("end-time"),
  stepMinutes: document.getElementById("step-minutes"),
  applyConfig: document.getElementById("apply-config"),
  modeCalendar: document.getElementById("mode-calendar"),
  modeTime: document.getElementById("mode-time"),
  rangeText: document.getElementById("range-text"),
  stepText: document.getElementById("step-text"),
  clearStorage: document.getElementById("clear-storage"),
  jsonArea: document.getElementById("json-area"),
  copyJson: document.getElementById("copy-json"),
  downloadJson: document.getElementById("download-json"),
  importJson: document.getElementById("import-json"),
  importFile: document.getElementById("import-file"),
  jsonFile: document.getElementById("json-file"),
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

const formatDate = (date) => {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
};

const formatTime = (minutes) => {
  const hour = String(Math.floor(minutes / 60)).padStart(2, "0");
  const minute = String(minutes % 60).padStart(2, "0");
  return `${hour}:${minute}`;
};

const buildDays = (startDate, endDate) => {
  const days = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
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
      const dateKey = date.toISOString().slice(0, 10);
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
    const dateKey = date.toISOString().slice(0, 10);
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
  if (state.mode === MODE_CALENDAR) {
    elements.schedule.classList.add("schedule--calendar");
    elements.schedule.style.gridTemplateColumns = "repeat(7, minmax(96px, 1fr))";
    elements.schedule.style.gridTemplateRows = "48px";
    elements.schedule.style.gridAutoRows = "96px";

    const startWeekday = state.days[0]?.getDay() ?? 0;
    labels.weekdays.forEach((label) => {
      const cell = document.createElement("div");
      cell.className = "day-cell day-cell--week";
      cell.textContent = label;
      elements.schedule.appendChild(cell);
    });

    for (let i = 0; i < startWeekday; i += 1) {
      const filler = document.createElement("div");
      filler.className = "day-cell day-cell--blank";
      elements.schedule.appendChild(filler);
    }

    state.slots.forEach((slot, index) => {
      const cell = document.createElement("div");
      const showMonthTag = index === 0 || slot.date.getDate() === 1;
      const monthIndex = slot.date.getMonth();
      const monthColor = MONTH_COLORS[monthIndex % MONTH_COLORS.length];
      const monthTag = showMonthTag
        ? `<span class="month-tag" style="--month-color: ${monthColor}">${monthIndex + 1}月</span>`
        : "";
      cell.className = "slot slot--calendar";
      cell.dataset.slotId = slot.id;
      cell.dataset.dayIndex = String(slot.dayIndex);
      cell.dataset.level = "0";
      cell.innerHTML = `
        <span class="calendar-day">${slot.date.getDate()}</span>
        ${monthTag}
        <div class="calendar-dots"></div>
      `;
      cell.addEventListener("pointerdown", handlePointerDown);
      elements.schedule.appendChild(cell);
    });
    return;
  }

  elements.schedule.classList.remove("schedule--calendar");
  elements.schedule.style.gridAutoRows = "";
  const daysCount = state.days.length;
  const startMinutes = parseTimeMinutes(state.config.startTime);
  const endMinutes = parseTimeMinutes(state.config.endTime);
  const slotsPerDay = (endMinutes - startMinutes) / state.config.stepMinutes;
  elements.schedule.style.gridTemplateColumns = `120px repeat(${daysCount}, minmax(60px, 1fr))`;
  elements.schedule.style.gridTemplateRows = `48px repeat(${slotsPerDay}, 32px)`;

  const headerBlank = document.createElement("div");
  headerBlank.className = "day-cell";
  headerBlank.textContent = "时间";
  elements.schedule.appendChild(headerBlank);

  state.days.forEach((date) => {
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
      const slotIndex = rowIndex * daysCount + dayIndex;
      const slot = state.slots[slotIndex];
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
      <span class="person-name">
        <i class="person-dot" style="--dot-color: ${PERSON_COLORS[index % PERSON_COLORS.length]}"></i>
        ${person.name}
      </span>
      <div class="person-actions">
        <button type="button" class="person-edit" data-id="${person.id}">改名</button>
        <button type="button" class="person-remove" data-id="${person.id}">×</button>
      </div>
    `;
    item.addEventListener("click", (event) => {
      if (event.target.matches(".person-remove")) {
        removePerson(person.id);
        return;
      }
      if (event.target.matches(".person-edit")) {
        renamePerson(person.id);
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
  elements.currentPerson.textContent = person ? `当前：${person.name}` : "当前：-";
};

const updateStatus = (message) => {
  elements.statusText.textContent = message;
};

const setActivePerson = (id) => {
  state.activePersonId = id;
  renderPeople();
  updateGridVisuals();
};

const addPerson = () => {
  const name = elements.personName.value.trim();
  if (!name) {
    updateStatus("请输入名字。");
    return;
  }
  const newId = Math.max(0, ...state.people.map((person) => person.id)) + 1;
  state.people.push({ id: newId, name, availability: new Set() });
  elements.personName.value = "";
  setActivePerson(newId);
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatus("已添加新参与者。");
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

const renamePerson = (id) => {
  const person = state.people.find((entry) => entry.id === id);
  if (!person) {
    return;
  }
  const nextName = window.prompt("请输入新的名字", person.name);
  if (!nextName) {
    return;
  }
  const trimmed = nextName.trim();
  if (!trimmed) {
    updateStatus("名字不能为空。");
    return;
  }
  person.name = trimmed;
  renderPeople();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatus("名字已更新。");
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
    updateStatus("请先选择一个人。");
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
  updateStatus("已清空当前人的选择。");
};

const clearAll = () => {
  const ok = window.confirm("确认清空所有人的选择吗？");
  if (!ok) {
    return;
  }
  state.people.forEach((person) => person.availability.clear());
  updateGridVisuals();
  updateSummary();
  saveState();
  updateJsonArea();
  updateStatus("已清空所有人的选择。");
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
        if (person.availability.has(slotId)) {
          const dot = document.createElement("span");
          dot.className = "person-dot";
          dot.style.setProperty("--dot-color", PERSON_COLORS[index % PERSON_COLORS.length]);
          dotWrap.appendChild(dot);
        }
      });
    }
  });
};

const updateSummary = () => {
  const totalPeople = state.people.length;
  elements.summaryStats.textContent = `已选人数：${totalPeople}`;

  const commonsByDate = new Map();
  if (totalPeople > 0) {
    state.slots.forEach((slot) => {
      const allSelected = state.people.every((person) => person.availability.has(slot.id));
      if (allSelected) {
        const list = commonsByDate.get(slot.dateKey) ?? [];
        list.push(slot);
        commonsByDate.set(slot.dateKey, list);
      }
    });
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
        <div class="common-times">整天可行</div>
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
  if (state.mode === MODE_CALENDAR) {
    elements.rangeText.textContent = `${startText} 至 ${endText}`;
    elements.stepText.textContent = "整天";
    return;
  }
  elements.rangeText.textContent = `${startText} 至 ${endText} / ${state.config.startTime}-${state.config.endTime}`;
  elements.stepText.textContent = `${state.config.stepMinutes} 分钟`;
};

const serializeState = () => ({
  config: state.config,
  mode: state.mode,
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
    updateStatus("已复制 JSON。");
  } catch (error) {
    updateStatus("复制失败，请手动复制。");
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
  updateStatus("已下载 JSON。");
};

const importJsonText = (raw) => {
  if (!raw) {
    updateStatus("请粘贴 JSON 内容。");
    return;
  }
  try {
    const data = JSON.parse(raw);
    const ok = applyStateData(data);
    if (!ok) {
      updateStatus("JSON 格式不正确。");
      return;
    }
    syncInputs();
    rebuildSchedule();
    renderPeople();
    updateStatus("已导入 JSON。");
  } catch (error) {
    updateStatus("JSON 解析失败。");
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
    updateStatus("读取文件失败。");
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
      updateStatus("请填写起止日期。");
    }
    return;
  }
  if (endDate < startDate) {
    updateStatus("结束日期必须晚于开始日期。");
    return;
  }
  const dayCount = Math.floor((endDate - startDate) / 86400000) + 1;
  if (dayCount > 62) {
    updateStatus("日期范围最多 62 天。");
    return;
  }
  if (state.mode === MODE_TIME) {
    if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes) {
      updateStatus("请确认每日开始/结束时间。");
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
  updateStatus("时间设置已更新。");
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
  updateInfoCard();
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
  updateStatus(mode === MODE_CALENDAR ? "已切换到月历模式。" : "已切换到时间段模式。");
};

const handlePointerDown = (event) => {
  event.preventDefault();
  const cell = event.currentTarget;
  const slotId = cell.dataset.slotId;
  const dayIndex = Number(cell.dataset.dayIndex);
  const person = state.people.find((entry) => entry.id === state.activePersonId);
  if (!person) {
    updateStatus("请先选择一个人。");
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
};

const clearStorage = () => {
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
  updateStatus("已清除本地数据。");
};

const init = () => {
  restoreState();
  state.config = sanitizeConfig(state.config);
  if (!state.mode) {
    state.mode = MODE_CALENDAR;
  }
  syncInputs();
  updateModeUI();

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
  updateStatus("准备就绪，选择一个人开始标记。");
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
if (elements.modeTime) {
  elements.modeTime.addEventListener("click", () => setMode(MODE_TIME));
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
  const target = event.target;
  if (target.classList.contains("slot")) {
    toggleSlot(target.dataset.slotId);
  }
});


init();
