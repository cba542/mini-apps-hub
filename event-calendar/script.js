"use strict";

const DEFAULT_CARNIVAL_START = "2026-02-07";
const DEFAULT_UP_START = "2026-02-06";
const DEFAULT_CARNIVAL_INDEX = 0;
const DEFAULT_UP_INDEX = 0;
const DEFAULT_CHECKIN_START = "2026-02-12";

const SEQS = {
  carnival: [
    { name: "胶囊", days: 5 },
    { name: "蛋壳", days: 5 },
    { name: "招唤券", days: 5 },
    { name: "钓鱼", days: 5 },
    { name: "胶囊", days: 5 },
  ],
  up: [
    { name: "冰", days: 3 },
    { name: "火", days: 3 },
    { name: "物理", days: 3 },
    { name: "电", days: 3 },
    { name: "冰", days: 3 },
  ],
};

const COLORS = {
  carnival: "#1fb6a6",
  up: "#f78c6c",
  empty: "#ffffff",
};

const MAX_MONTH_OFFSET_BACK = 2;
const MAX_MONTH_OFFSET_FORWARD = 6;

const IMAGE_MAP = {
  carnival: {
    胶囊: "img/嘉年华_胶囊.jpg",
    蛋壳: "img/嘉年华_开蛋.jpg",
    招唤券: "img/嘉年华_招唤券.jpg",
    钓鱼: "img/嘉年华_钓鱼.jpg",
  },
  up: {
    冰: "img/UP券_冰.png",
    火: "img/UP券_火.png",
    物理: "img/UP券_物理.png",
    电: "img/UP券_电.png",
  },
};

const elements = {
  carnivalStart: document.getElementById("carnival-start"),
  carnivalSeq: document.getElementById("carnival-seq"),
  upStart: document.getElementById("up-start"),
  upSeq: document.getElementById("up-seq"),
  checkinStart: document.getElementById("checkin-start"),
  apply: document.getElementById("apply"),
  exportBtn: document.getElementById("export"),
  calendarPanel: document.querySelector(".calendar-panel"),
  calendar: document.getElementById("calendar"),
  dayTemplate: document.getElementById("day-template"),
  rangeTitle: document.getElementById("range-title"),
  monthLabel: document.getElementById("month-label"),
  monthPrev: document.getElementById("month-prev"),
  monthNext: document.getElementById("month-next"),
};

const state = {
  carnivalStart: parseDate(DEFAULT_CARNIVAL_START),
  upStart: parseDate(DEFAULT_UP_START),
  carnivalSeqIndex: DEFAULT_CARNIVAL_INDEX,
  upSeqIndex: DEFAULT_UP_INDEX,
  checkinStart: null,
  monthOffset: 0,
};

function dayNumberUtc(date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

function typeLabel(type) {
  return type === "carnival" ? "嘉年华" : "UP券";
}

function parseDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, n) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  return d;
}

function buildCycledSegments(startDate, seq, type, stopDate, startIndex = 0) {
  const segments = [];
  let cursor = new Date(startDate.getTime());
  let seqIndex = startIndex % seq.length;
  while (segments.length === 0 || cursor <= stopDate) {
    const item = seq[seqIndex];
    const start = new Date(cursor.getTime());
    const end = addDays(cursor, item.days - 1);
    segments.push({ type, name: item.name, start, end, days: item.days });
    cursor = addDays(cursor, item.days);
    seqIndex = (seqIndex + 1) % seq.length;
  }
  // Trim segments that end after stopDate to align visually
  return segments
    .map((seg) => {
      if (seg.end > stopDate) {
        const effectiveEnd = new Date(stopDate.getTime());
        const days = Math.max(1, Math.floor((effectiveEnd - seg.start) / 86400000) + 1);
        return { ...seg, end: effectiveEnd, days };
      }
      return seg;
    })
    .filter((seg) => seg.end >= seg.start);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function eachDay(from, to) {
  const days = [];
  for (let d = new Date(from.getTime()); d <= to; d = addDays(d, 1)) {
    days.push(new Date(d.getTime()));
  }
  return days;
}

function expandDailyMap(segments) {
  const map = new Map();
  segments.forEach((seg) => {
    eachDay(seg.start, seg.end).forEach((day) => {
      const key = formatDate(day);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push({ type: seg.type, name: seg.name });
    });
  });
  return map;
}

function buildCalendarBounds(segments) {
  const min = segments.reduce((acc, seg) => (seg.start < acc ? seg.start : acc), segments[0].start);
  const max = segments.reduce((acc, seg) => (seg.end > acc ? seg.end : acc), segments[0].end);
  const rangeStart = addDays(min, -min.getDay());
  const rangeEnd = addDays(max, 6 - max.getDay());
  return { rangeStart, rangeEnd, visibleStart: min, visibleEnd: max };
}

function buildCalendarGrid(rangeStart, rangeEnd) {
  const weeks = [];
  let cursor = new Date(rangeStart.getTime());
  while (cursor <= rangeEnd) {
    const week = [];
    for (let i = 0; i < 7; i += 1) {
      week.push(new Date(cursor.getTime()));
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }
  return weeks;
}

function renderGrid(weeks, dailyMap, visibleStart, visibleEnd) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDate(today);
  const checkinStart = state.checkinStart;
  const checkinDayNumber = checkinStart ? dayNumberUtc(checkinStart) : null;

  elements.calendar.innerHTML = "";
  weeks.forEach((week) => {
    week.forEach((day) => {
      const key = formatDate(day);
      const activities = dailyMap.get(key) || [];
      const isVisible = day >= visibleStart && day <= visibleEnd;
      const clone = elements.dayTemplate.content.firstElementChild.cloneNode(true);
      const dateEl = clone.querySelector(".day__date");
      const badgesEl = clone.querySelector(".day__badges");
      dateEl.textContent = `${day.getMonth() + 1}/${day.getDate()}`;
      clone.dataset.date = key;
      if (!isVisible) {
        clone.classList.add("empty");
      }
      if (key === todayKey) {
        clone.classList.add("day--today");
      }
      const isCheckin =
        checkinDayNumber !== null &&
        ((dayNumberUtc(day) - checkinDayNumber) % 5 + 5) % 5 === 0;
      if (isCheckin) {
        clone.classList.add("day--checkin");
      }
      const carnival = activities.find((a) => a.type === "carnival");
      const up = activities.find((a) => a.type === "up");
      if (carnival) {
        const badge = document.createElement("span");
        badge.className = "badge badge--carnival";
        const icon = resolveIcon("carnival", carnival.name);
        if (icon) {
          const img = document.createElement("img");
          img.className = "badge__icon";
          img.src = icon;
          img.alt = carnival.name;
          badge.appendChild(img);
        }
        badge.append(carnival.name);
        badge.title = `${formatDate(day)} ${typeLabel("carnival")} ${carnival.name}`;
        badgesEl.appendChild(badge);
      }
      if (up) {
        const badge = document.createElement("span");
        badge.className = "badge badge--up";
        const icon = resolveIcon("up", up.name);
        if (icon) {
          const img = document.createElement("img");
          img.className = "badge__icon";
          img.src = icon;
          img.alt = up.name;
          badge.appendChild(img);
        }
        badge.append(up.name);
        badge.title = `${formatDate(day)} ${typeLabel("up")} ${up.name}`;
        badgesEl.appendChild(badge);
      }
      if (activities.length === 0) {
        const lines = [];
        if (key === todayKey) lines.push("今天");
        if (isCheckin) lines.push("签到招唤券");
        lines.push("无活动");
        clone.title = `${formatDate(day)}\n${lines.join("\n")}`;
      } else {
        const lines = [];
        if (key === todayKey) lines.push("今天");
        if (isCheckin) lines.push("签到招唤券");
        activities.forEach((act) => lines.push(badgeLabel(act)));
        clone.title = `${formatDate(day)}\n${lines.join("\n")}`;
      }
      elements.calendar.appendChild(clone);
    });
  });
}

function resolveIcon(type, name) {
  const group = IMAGE_MAP[type];
  if (!group) return null;
  return group[name] || null;
}

function badgeLabel(act) {
  return `${typeLabel(act.type)} ${act.name}`;
}

function updateRangeTitle(visibleStart, visibleEnd) {
  const startStr = `${visibleStart.getFullYear()}年${visibleStart.getMonth() + 1}月${visibleStart.getDate()}日`;
  const endStr = `${visibleEnd.getFullYear()}年${visibleEnd.getMonth() + 1}月${visibleEnd.getDate()}日`;
  elements.rangeTitle.textContent = `${startStr} – ${endStr}`;
}

function hydrateInputs() {
  const savedCarnival = localStorage.getItem("event-cal-carnival-start");
  const savedUp = localStorage.getItem("event-cal-up-start");
  const savedCarnivalSeq = localStorage.getItem("event-cal-carnival-seq-index");
  const savedUpSeq = localStorage.getItem("event-cal-up-seq-index");
  const savedCheckin = localStorage.getItem("event-cal-checkin-start");
  elements.carnivalStart.value = savedCarnival || DEFAULT_CARNIVAL_START;
  elements.upStart.value = savedUp || DEFAULT_UP_START;
  if (elements.carnivalSeq) {
    elements.carnivalSeq.value = savedCarnivalSeq ?? String(DEFAULT_CARNIVAL_INDEX);
  }
  if (elements.upSeq) {
    elements.upSeq.value = savedUpSeq ?? String(DEFAULT_UP_INDEX);
  }
  if (elements.checkinStart) {
    elements.checkinStart.value = savedCheckin || DEFAULT_CHECKIN_START;
  }
}

function saveInputs() {
  localStorage.setItem("event-cal-carnival-start", elements.carnivalStart.value);
  localStorage.setItem("event-cal-up-start", elements.upStart.value);
  if (elements.carnivalSeq) {
    localStorage.setItem("event-cal-carnival-seq-index", elements.carnivalSeq.value);
  }
  if (elements.upSeq) {
    localStorage.setItem("event-cal-up-seq-index", elements.upSeq.value);
  }
  if (elements.checkinStart) {
    localStorage.setItem("event-cal-checkin-start", elements.checkinStart.value);
  }
}

function applySchedule() {
  const carnivalDate = parseDate(elements.carnivalStart.value);
  const upDate = parseDate(elements.upStart.value);
  const carnivalSeqIndex = elements.carnivalSeq ? Number(elements.carnivalSeq.value) || 0 : 0;
  const upSeqIndex = elements.upSeq ? Number(elements.upSeq.value) || 0 : 0;
  const checkinValue = elements.checkinStart ? elements.checkinStart.value.trim() : "";
  const checkinDate = checkinValue ? parseDate(checkinValue) : null;
  if (!carnivalDate || !upDate) {
    alert("请输入有效的起始日期");
    return;
  }
  if (checkinValue && !checkinDate) {
    alert("请输入有效的签到日期");
    return;
  }
  saveInputs();

  state.carnivalStart = carnivalDate;
  state.upStart = upDate;
  state.carnivalSeqIndex = carnivalSeqIndex;
  state.upSeqIndex = upSeqIndex;
  state.checkinStart = checkinDate;
  state.monthOffset = clamp(state.monthOffset, -MAX_MONTH_OFFSET_BACK, MAX_MONTH_OFFSET_FORWARD);
  renderView();
}

function getViewBounds(baseDate, monthOffset) {
  const viewDate = new Date(baseDate.getTime());
  viewDate.setMonth(viewDate.getMonth() + monthOffset, 1);
  const start = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const end = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0);
  return { viewStart: start, viewEnd: end };
}

function buildViewData() {
  const { viewStart, viewEnd } = getViewBounds(state.carnivalStart, state.monthOffset);
  const carnivalSegs = buildCycledSegments(
    state.carnivalStart,
    SEQS.carnival,
    "carnival",
    viewEnd,
    state.carnivalSeqIndex,
  );
  const upSegs = buildCycledSegments(state.upStart, SEQS.up, "up", viewEnd, state.upSeqIndex);

  const visibleSegs = [...carnivalSegs, ...upSegs].filter((seg) => seg.start <= viewEnd && seg.end >= viewStart);
  const dailyMap = expandDailyMap(visibleSegs);
  const rangeStart = addDays(viewStart, -viewStart.getDay());
  const rangeEnd = addDays(viewEnd, 6 - viewEnd.getDay());
  const weeks = buildCalendarGrid(rangeStart, rangeEnd);
  return { weeks, dailyMap, visibleStart: viewStart, visibleEnd: viewEnd, viewStart, viewEnd };
}

function updateMonthLabel(viewStart) {
  if (!elements.monthLabel) return;
  elements.monthLabel.textContent = `${viewStart.getFullYear()}年${viewStart.getMonth() + 1}月`;
}

function renderView() {
  const { weeks, dailyMap, visibleStart, visibleEnd, viewStart } = buildViewData();
  renderGrid(weeks, dailyMap, visibleStart, visibleEnd);
  updateRangeTitle(visibleStart, visibleEnd);
  updateMonthLabel(viewStart);
}

function downloadDataUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function handleExport() {
  const target = elements.calendarPanel || document.querySelector(".calendar-panel");
  if (!target || typeof html2canvas !== "function") {
    alert("导出失败，请稍后重试");
    return;
  }
  const filename = `event-calendar-${Date.now()}.png`;
  target.classList.add("exporting");
  html2canvas(target, {
    scale: window.devicePixelRatio > 1 ? 2 : 1.5,
    backgroundColor: null,
    useCORS: true,
  })
    .then((canvas) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          alert("导出失败，请稍后重试");
          return;
        }
        const url = URL.createObjectURL(blob);
        downloadDataUrl(url, filename);
        URL.revokeObjectURL(url);
      });
    })
    .catch(() => alert("导出失败，请稍后重试"))
    .finally(() => {
      target.classList.remove("exporting");
    });
}

function init() {
  hydrateInputs();
  elements.apply.addEventListener("click", applySchedule);
  elements.exportBtn.addEventListener("click", handleExport);
  if (elements.monthPrev) {
    elements.monthPrev.addEventListener("click", () => {
      state.monthOffset = clamp(state.monthOffset - 1, -MAX_MONTH_OFFSET_BACK, MAX_MONTH_OFFSET_FORWARD);
      renderView();
    });
  }
  if (elements.monthNext) {
    elements.monthNext.addEventListener("click", () => {
      state.monthOffset = clamp(state.monthOffset + 1, -MAX_MONTH_OFFSET_BACK, MAX_MONTH_OFFSET_FORWARD);
      renderView();
    });
  }
  applySchedule();
}

init();
