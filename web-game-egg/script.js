const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");
const exitBtn = document.getElementById("exit-btn");
const chargePanel = document.getElementById("charge-panel");
const monsterSpeedInput = document.getElementById("monster-speed");
const monsterSpeedValue = document.getElementById("monster-speed-value");
const chargeSpeedInput = document.getElementById("charge-speed");
const chargeSpeedValue = document.getElementById("charge-speed-value");
const bounceCountInput = document.getElementById("bounce-count");
const bounceCountValue = document.getElementById("bounce-count-value");
const damageInput = document.getElementById("damage");
const damageValue = document.getElementById("damage-value");
const hpRangeInput = document.getElementById("hp-range");
const hpRangeValue = document.getElementById("hp-range-value");
const gravityInput = document.getElementById("gravity");
const gravityValue = document.getElementById("gravity-value");
const bounceAngleInput = document.getElementById("bounce-angle");
const bounceAngleValue = document.getElementById("bounce-angle-value");
const eggSizeInput = document.getElementById("egg-size");
const eggSizeValue = document.getElementById("egg-size-value");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const waveEl = document.getElementById("wave");
const remainingEl = document.getElementById("remaining");
const modeEl = document.getElementById("mode");

const config = {
  gooseCount: 5,
  eggsPerShot: 5,
  eggDamage: 10,
  monsterSpeed: 2,
  shotInterval: 2000,
  waves: 3,
  monstersPerWaveMin: 3,
  monstersPerWaveMax: 8,
  monsterHpMin: 40,
  monsterHpMax: 70,
  monsterMinSpacing: 60,
  gooseLineY: 120,
  monsterRadius: 22,
  eggRadius: 8,
  eggSpeed: 10,
  eggGravity: 0.22,
  eggRestitution: 0.7,
  bounceAngleFactor: 1,
  eggMaxBounces: 5,
  pathSubsteps: 3,
  boardPadding: 32,
  chargeDuration: 2200,
  chargeSpeedFactor: 1.8,
};

const colors = {
  board: "#fdf9f3",
  goose: ["#f2c57c", "#f1a96a", "#f3d7a6", "#e8b381", "#f0c9a0"],
  egg: "#f5f0e6",
  eggStroke: "#cfae8b",
  monster: "#9d3b2c",
  monsterAlt: "#d7683b",
  text: "#2a1d16",
  guide: "rgba(123, 60, 28, 0.4)",
};

let gameState = "idle";
let wave = 1;
let geese = [];
let eggs = [];
let monsters = [];
let aiming = false;
let pointerDown = false;
let aimPoint = { x: canvas.width / 2, y: canvas.height / 2 };
let lastShotTime = 0;
let activeShot = false;
let animationFrame = null;
let chargePoints = [];
let activeChargeIndex = 0;
let lastChargeTime = 0;
let guideOffset = 0;
let monsterIdCounter = 1;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const distToSegment = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = clamp(t, 0, 1);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
};
const distSegmentToSegment = (a1, a2, b1, b2) => {
  const d1 = distToSegment(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y);
  const d2 = distToSegment(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
  const d3 = distToSegment(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y);
  const d4 = distToSegment(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y);
  return Math.min(d1, d2, d3, d4);
};
const pointInPolygon = (point, vertices) => {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i].x;
    const yi = vertices[i].y;
    const xj = vertices[j].x;
    const yj = vertices[j].y;
    const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
};
const getShapeVertices = (monster) => {
  const r = config.monsterRadius;
  const cx = monster.x;
  const cy = monster.y;
  switch (monster.shape) {
    case "triangle_up":
      return [
        { x: cx, y: cy - r },
        { x: cx + r, y: cy + r },
        { x: cx - r, y: cy + r },
      ];
    case "triangle_down":
      return [
        { x: cx - r, y: cy - r },
        { x: cx + r, y: cy - r },
        { x: cx, y: cy + r },
      ];
    case "square":
      return [
        { x: cx - r, y: cy - r },
        { x: cx + r, y: cy - r },
        { x: cx + r, y: cy + r },
        { x: cx - r, y: cy + r },
      ];
    case "diamond":
      return [
        { x: cx, y: cy - r },
        { x: cx + r, y: cy },
        { x: cx, y: cy + r },
        { x: cx - r, y: cy },
      ];
    default:
      return [];
  }
};
const getPolygonCollisionNormal = (px, py, vertices, center) => {
  let minDist = Infinity;
  let normal = null;
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const edgeLength = Math.hypot(dx, dy) || 1;
    const nx = -dy / edgeLength;
    const ny = dx / edgeLength;
    const distance = distToSegment(px, py, a.x, a.y, b.x, b.y);
    if (distance < minDist) {
      const centerDot = (center.x - ((a.x + b.x) / 2)) * nx + (center.y - ((a.y + b.y) / 2)) * ny;
      let adjNx = nx;
      let adjNy = ny;
      if (centerDot > 0) {
        adjNx *= -1;
        adjNy *= -1;
      }
      minDist = distance;
      normal = { x: adjNx, y: adjNy };
    }
  }
  if (minDist <= config.eggRadius * 1.2) {
    return normal;
  }
  return null;
};
const getCollisionNormal = (px, py, monster) => {
  if (monster.shape === "circle") {
    const dx = px - monster.x;
    const dy = py - monster.y;
    const distValue = Math.hypot(dx, dy) || 1;
    if (distValue <= config.monsterRadius + config.eggRadius) {
      return { x: dx / distValue, y: dy / distValue };
    }
    return null;
  }
  const vertices = getShapeVertices(monster);
  if (!vertices.length) {
    return null;
  }
  const point = { x: px, y: py };
  if (!pointInPolygon(point, vertices)) {
    const nearNormal = getPolygonCollisionNormal(px, py, vertices, monster);
    if (nearNormal) {
      return nearNormal;
    }
    return null;
  }
  return getPolygonCollisionNormal(px, py, vertices, monster);
};
const segmentHitsShape = (prev, curr, monster) => {
  if (monster.shape === "circle") {
    return distToSegment(monster.x, monster.y, prev.x, prev.y, curr.x, curr.y) <= config.monsterRadius + config.eggRadius;
  }
  const vertices = getShapeVertices(monster);
  if (!vertices.length) {
    return false;
  }
  const midpoint = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 };
  if (pointInPolygon(midpoint, vertices)) {
    return true;
  }
  for (let i = 0; i < vertices.length; i += 1) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    const distValue = distSegmentToSegment(prev, curr, a, b);
    if (distValue <= config.eggRadius * 1.2) {
      return true;
    }
  }
  return false;
};

const resetGame = () => {
  gameState = "ready";
  wave = 1;
  eggs = [];
  monsters = [];
  activeShot = false;
  geese = createGeese();
  chargePoints = createChargePoints();
  activeChargeIndex = 0;
  renderChargePanel();
  resetChargeState();
  spawnWave();
  monsterSpeedInput.value = String(config.monsterSpeed);
  chargeSpeedInput.value = String(config.chargeSpeedFactor);
  bounceCountInput.value = String(config.eggMaxBounces);
  damageInput.value = String(config.eggDamage);
  hpRangeInput.value = String(config.monsterHpMax);
  gravityInput.value = String(config.eggGravity);
  bounceAngleInput.value = String(config.bounceAngleFactor);
  eggSizeInput.value = String(config.eggRadius);
  updateUI();
  hideOverlay();
};

const createGeese = () => {
  const spacing = (canvas.width - config.boardPadding * 2) / (config.gooseCount - 1);
  return Array.from({ length: config.gooseCount }, (_, i) => ({
    x: config.boardPadding + spacing * i,
    y: config.gooseLineY,
    color: colors.goose[i % colors.goose.length],
  }));
};

const createChargePoints = () =>
  Array.from({ length: config.gooseCount }, (_, index) => ({
    index,
    progress: 0,
    ready: false,
    fired: false,
  }));

const renderChargePanel = () => {
  chargePanel.innerHTML = "";
  chargePoints.forEach((point, index) => {
    const slot = document.createElement("div");
    slot.className = "charge-slot";
    slot.innerHTML = `
      <div class="charge-label">点 ${index + 1}</div>
      <div class="charge-track">
        <div class="charge-fill" data-index="${index}"></div>
      </div>
    `;
    chargePanel.appendChild(slot);
  });
};

const updateChargePanel = () => {
  const fills = chargePanel.querySelectorAll(".charge-fill");
  fills.forEach((fill) => {
    const index = Number(fill.dataset.index);
    const point = chargePoints[index];
    const percent = Math.min(100, Math.floor(point.progress * 100));
    fill.style.width = `${percent}%`;
  });
  monsterSpeedValue.textContent = config.monsterSpeed.toFixed(1);
  chargeSpeedValue.textContent = `x${config.chargeSpeedFactor.toFixed(1)}`;
  bounceCountValue.textContent = config.eggMaxBounces.toString();
  damageValue.textContent = config.eggDamage.toString();
  hpRangeValue.textContent = `${config.monsterHpMin}-${config.monsterHpMax}`;
  gravityValue.textContent = config.eggGravity.toFixed(2);
  bounceAngleValue.textContent = config.bounceAngleFactor.toFixed(2);
  eggSizeValue.textContent = config.eggRadius.toString();
};

const spawnWave = () => {
  const count = randInt(config.monstersPerWaveMin, config.monstersPerWaveMax);
  const shapes = ["triangle_up", "triangle_down", "square", "circle", "diamond"];
  monsters = [];
  for (let i = 0; i < count; i += 1) {
    const hp = randInt(config.monsterHpMin, config.monsterHpMax);
    let x = randInt(config.boardPadding, canvas.width - config.boardPadding);
    let attempts = 0;
    while (attempts < 30 && monsters.some((monster) => Math.abs(monster.x - x) < config.monsterMinSpacing)) {
      x = randInt(config.boardPadding, canvas.width - config.boardPadding);
      attempts += 1;
    }
    monsters.push({
      id: monsterIdCounter,
      x,
      y: canvas.height - randInt(20, 80),
      hp,
      maxHp: hp,
      alive: true,
      shape: shapes[randInt(0, shapes.length - 1)],
    });
    monsterIdCounter += 1;
  }
  remainingEl.textContent = monsters.length;
};

const showOverlay = (title, text) => {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
  overlay.style.display = "flex";
};

const hideOverlay = () => {
  overlay.classList.add("hidden");
  overlay.style.display = "none";
};

const updateUI = () => {
  waveEl.textContent = wave;
  remainingEl.textContent = monsters.filter((monster) => monster.alive).length;
  modeEl.textContent = "手动";
  updateChargePanel();
};

const startGame = () => {
  if (gameState === "playing") {
    return;
  }
  gameState = "playing";
  hideOverlay();
  startBtn.classList.add("hidden");
  restartBtn.classList.remove("hidden");
  exitBtn.classList.remove("hidden");
  lastShotTime = performance.now();
  activeShot = false;
  resetChargeState();
};

const endGame = (win) => {
  gameState = win ? "win" : "lose";
  showOverlay(win ? "通关成功" : "游戏失败", win ? "点击重新开始再来一局" : "怪物突破防线");
};

const restartGame = () => {
  resetGame();
  startGame();
};

const exitGame = () => {
  gameState = "idle";
  eggs = [];
  monsters = [];
  startBtn.classList.remove("hidden");
  restartBtn.classList.add("hidden");
  exitBtn.classList.add("hidden");
  showOverlay("返回首页", "刷新页面可再次开始");
};

const getNearestMonster = (point) => {
  const living = monsters.filter((monster) => monster.alive);
  if (!living.length) {
    return null;
  }
  return living.reduce((closest, monster) => {
    const d = dist(point, monster);
    return d < closest.distance ? { monster, distance: d } : closest;
  }, { monster: living[0], distance: dist(point, living[0]) }).monster;
};

const createEggs = (targetPoint) => {
  const goose = geese[activeChargeIndex];
  if (!goose) {
    return;
  }
  const target = { x: targetPoint.x, y: targetPoint.y };
  const dx = target.x - goose.x;
  const dy = target.y - goose.y;
  const length = Math.hypot(dx, dy) || 1;
  const vx = (dx / length) * config.eggSpeed;
  const vy = (dy / length) * config.eggSpeed;
  eggs = [
    {
      x: goose.x,
      y: goose.y,
      vx,
      vy,
      alive: true,
      bounces: 0,
      bounceCooldown: 0,
      hitIds: new Set(),
      pendingHitIds: [],
    },
  ];
  activeShot = true;
};

const updateEggTargets = () => {
  eggs.forEach((egg) => {
    if (!egg.alive) {
      return;
    }
    const target = getNearestMonster({ x: egg.x, y: egg.y });
    if (!target) {
      return;
    }
    const dx = target.x - egg.x;
    const dy = target.y - egg.y;
    const length = Math.hypot(dx, dy) || 1;
    egg.vx = (dx / length) * config.eggSpeed;
    egg.vy = (dy / length) * config.eggSpeed;
  });
};

const updateEggs = () => {
  eggs.forEach((egg) => {
    if (!egg.alive) {
      return;
    }

    egg.vy += config.eggGravity;
    egg.x += egg.vx;
    egg.y += egg.vy;
    if (egg.bounceCooldown > 0) {
      egg.bounceCooldown -= 1;
    }

    const hitMonster = monsters.find((monster) => {
      if (!monster.alive) {
        return false;
      }
      return getCollisionNormal(egg.x, egg.y, monster);
    });

    if (hitMonster) {
      const normal = getCollisionNormal(egg.x, egg.y, hitMonster);
      if (normal && egg.bounceCooldown === 0) {
        const dot = egg.vx * normal.x + egg.vy * normal.y;
        const rx = egg.vx - 2 * dot * normal.x;
        const ry = egg.vy - 2 * dot * normal.y;
        egg.vx = (egg.vx + (rx - egg.vx) * config.bounceAngleFactor) * config.eggRestitution;
        egg.vy = (egg.vy + (ry - egg.vy) * config.bounceAngleFactor) * config.eggRestitution;
        egg.vy += config.eggGravity * 3;
        egg.bounces += 1;
        egg.bounceCooldown = 3;
      }
      if (normal) {
        egg.x += normal.x * (config.eggRadius + 2);
        egg.y += normal.y * (config.eggRadius + 2);
      }
      if (hitMonster.id) {
        egg.pendingHitIds.push(hitMonster.id);
      }
    }

    const left = config.eggRadius;
    const right = canvas.width - config.eggRadius;
    const top = config.eggRadius;
    const bottom = canvas.height - config.eggRadius;

    if (egg.bounceCooldown === 0 && egg.x <= left) {
      egg.x = left + 1;
      egg.vx = Math.abs(egg.vx) * config.eggRestitution;
      egg.bounces += 1;
      egg.bounceCooldown = 3;
    }
    if (egg.bounceCooldown === 0 && egg.x >= right) {
      egg.x = right - 1;
      egg.vx = -Math.abs(egg.vx) * config.eggRestitution;
      egg.bounces += 1;
      egg.bounceCooldown = 3;
    }
    if (egg.bounceCooldown === 0 && egg.y <= top) {
      egg.y = top + 1;
      egg.vy = Math.abs(egg.vy) * config.eggRestitution;
      egg.bounces += 1;
      egg.bounceCooldown = 3;
    }
    if (egg.bounceCooldown === 0 && egg.y >= bottom) {
      egg.alive = false;
    }

    if (egg.bounces >= config.eggMaxBounces) {
      egg.alive = false;
    }
  });

  if (activeShot && eggs.every((egg) => !egg.alive)) {
    activeShot = false;
    lastShotTime = performance.now();
  }
};

const updateMonsters = () => {
  const point = chargePoints[activeChargeIndex];
  if (activeShot || (point && point.ready)) {
    return;
  }
  monsters.forEach((monster) => {
    if (!monster.alive) {
      return;
    }
    monster.y -= config.monsterSpeed;
    if (monster.y - config.monsterRadius <= config.gooseLineY - 10) {
      endGame(false);
    }
  });
};

const handleCollisions = () => {
  eggs.forEach((egg) => {
    if (!egg.alive) {
      return;
    }
    if (egg.pendingHitIds && egg.pendingHitIds.length) {
      egg.pendingHitIds.forEach((hitId) => {
        const target = monsters.find((monster) => monster.id === hitId);
        if (target && target.alive) {
          target.hp -= config.eggDamage;
          if (target.hp <= 0) {
            target.alive = false;
          }
        }
      });
      egg.pendingHitIds = [];
    }
  });
};

const checkWaveClear = () => {
  const remaining = monsters.filter((monster) => monster.alive);
  if (remaining.length === 0 && gameState === "playing") {
    if (wave < config.waves) {
      wave += 1;
      spawnWave();
      resetChargeState();
      updateUI();
    } else {
      endGame(true);
    }
  }
};


const drawGeese = () => {
  geese.forEach((goose, index) => {
    ctx.fillStyle = goose.color;
    ctx.beginPath();
    ctx.ellipse(goose.x, goose.y, 20, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(goose.x - 6, goose.y - 2, 3, 0, Math.PI * 2);
    ctx.arc(goose.x + 6, goose.y - 2, 3, 0, Math.PI * 2);
    ctx.fill();

    if (index === activeChargeIndex) {
      ctx.strokeStyle = "rgba(179, 90, 45, 0.65)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(goose.x, goose.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
};

const simulateEggPath = (startX, startY, targetX, targetY) => {
  const direction = {
    x: targetX - startX,
    y: targetY - startY,
  };
  const length = Math.hypot(direction.x, direction.y) || 1;
  let dx = (direction.x / length) * config.eggSpeed;
  let dy = (direction.y / length) * config.eggSpeed;

  let px = startX;
  let py = startY;
let bounces = 0;
let bounceCooldown = 0;
const points = [{ x: px, y: py }];
const pendingHits = new Set();

  for (let i = 0; i < 520; i += 1) {
    const hitIds = new Set();
    for (let step = 0; step < config.pathSubsteps; step += 1) {
      dy += config.eggGravity / config.pathSubsteps;
      px += dx / config.pathSubsteps;
      py += dy / config.pathSubsteps;
      if (bounceCooldown > 0) {
        bounceCooldown -= 1;
      }

      const hitMonster = monsters.find((monster) => {
        if (!monster.alive) {
          return false;
        }
        return getCollisionNormal(px, py, monster);
      });

      if (hitMonster) {
        hitIds.add(hitMonster.id);
        const normal = getCollisionNormal(px, py, hitMonster);
        if (normal && bounceCooldown === 0) {
          const dot = dx * normal.x + dy * normal.y;
          const rx = dx - 2 * dot * normal.x;
          const ry = dy - 2 * dot * normal.y;
          dx = (dx + (rx - dx) * config.bounceAngleFactor) * config.eggRestitution;
          dy = (dy + (ry - dy) * config.bounceAngleFactor) * config.eggRestitution;
          bounces += 1;
          bounceCooldown = 3;
        }
        if (normal) {
          px += normal.x * (config.eggRadius + 2);
          py += normal.y * (config.eggRadius + 2);
        }
      }

      if (bounceCooldown === 0 && px <= config.eggRadius) {
        px = config.eggRadius + 1;
        dx = Math.abs(dx) * config.eggRestitution;
        bounces += 1;
        bounceCooldown = 3;
      }
      if (bounceCooldown === 0 && px >= canvas.width - config.eggRadius) {
        px = canvas.width - config.eggRadius - 1;
        dx = -Math.abs(dx) * config.eggRestitution;
        bounces += 1;
        bounceCooldown = 3;
      }
      if (bounceCooldown === 0 && py <= config.eggRadius) {
        py = config.eggRadius + 1;
        dy = Math.abs(dy) * config.eggRestitution;
        bounces += 1;
        bounceCooldown = 3;
      }
      if (bounceCooldown === 0 && py >= canvas.height - config.eggRadius) {
        points.push({ x: px, y: canvas.height - config.eggRadius, bounceCount: bounces, hitIds: Array.from(hitIds) });
        break;
      }
    }

    points.push({ x: px, y: py, bounceCount: bounces, hitIds: Array.from(hitIds) });
    if (bounces >= config.eggMaxBounces) {
      break;
    }
  }

  return points;
};


const drawGuides = () => {
  if (!aiming) {
    return;
  }
  const goose = geese[activeChargeIndex];
  if (!goose) {
    return;
  }

  const points = simulateEggPath(goose.x, goose.y, aimPoint.x, aimPoint.y);

  guideOffset = (guideOffset + 1) % 12;
  ctx.save();
  ctx.strokeStyle = colors.guide;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -guideOffset;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.restore();
};

const drawMonsters = () => {
  monsters.forEach((monster, index) => {
    if (!monster.alive) {
      return;
    }
    ctx.fillStyle = index % 2 === 0 ? colors.monster : colors.monsterAlt;
    ctx.beginPath();
    if (monster.shape === "circle") {
      ctx.arc(monster.x, monster.y, config.monsterRadius, 0, Math.PI * 2);
    } else {
      const vertices = getShapeVertices(monster);
      if (vertices.length) {
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i += 1) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();
      } else {
        ctx.arc(monster.x, monster.y, config.monsterRadius, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${Math.max(0, monster.hp)}`, monster.x, monster.y + 4);
  });
};

const drawEggs = () => {
  eggs.forEach((egg) => {
    if (!egg.alive) {
      return;
    }
    ctx.fillStyle = colors.egg;
    ctx.strokeStyle = colors.eggStroke;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(egg.x, egg.y, config.eggRadius, config.eggRadius * 1.25, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  });
};

const drawBoard = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = colors.board;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
};

const updateCharge = (time) => {
  if (gameState !== "playing" || activeShot) {
    lastChargeTime = time;
    return;
  }
  const point = chargePoints[activeChargeIndex];
  if (!point) {
    return;
  }
  const delta = time - (lastChargeTime || time);
  lastChargeTime = time;
  const duration = config.chargeDuration / config.chargeSpeedFactor;
  point.progress = clamp(point.progress + delta / duration, 0, 1);
  point.ready = point.progress >= 1;
  if (pointerDown && point.ready && !aiming && !activeShot) {
    aiming = true;
  }
};

const resetChargeState = () => {
  chargePoints.forEach((point) => {
    point.progress = 0;
    point.ready = false;
    point.fired = false;
  });
  activeChargeIndex = 0;
  lastChargeTime = performance.now();
};

const fireFromChargePoint = (targetPoint) => {
  if (activeShot || gameState !== "playing") {
    return;
  }
  const point = chargePoints[activeChargeIndex];
  if (!point || !point.ready) {
    return;
  }
  point.ready = false;
  point.progress = 0;
  point.fired = true;
  lastChargeTime = performance.now();
  createEggs(targetPoint);
  activeChargeIndex = (activeChargeIndex + 1) % chargePoints.length;
};

const loop = (time) => {
  if (gameState === "playing") {
    updateCharge(time);
    updateMonsters();
    updateEggs();
    handleCollisions();
    checkWaveClear();
  }

  drawBoard();
  drawGuides();
  drawEggs();
  drawGeese();
  drawMonsters();
  updateUI();

  animationFrame = requestAnimationFrame(loop);
};

const setMode = () => {
  modeEl.textContent = "手动";
};

const handlePointerDown = (event) => {
  pointerDown = true;
  if (gameState !== "playing" || activeShot) {
    return;
  }
  const point = chargePoints[activeChargeIndex];
  if (!point || !point.ready) {
    return;
  }
  aiming = true;
  const rect = canvas.getBoundingClientRect();
  aimPoint = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
};

const handlePointerMove = (event) => {
  if (!pointerDown) {
    return;
  }
  const rect = canvas.getBoundingClientRect();
  aimPoint = {
    x: ((event.clientX - rect.left) / rect.width) * canvas.width,
    y: ((event.clientY - rect.top) / rect.height) * canvas.height,
  };
  const point = chargePoints[activeChargeIndex];
  if (point && point.ready && gameState === "playing" && !activeShot) {
    aiming = true;
  }
};

const handlePointerUp = () => {
  pointerDown = false;
  if (!aiming || activeShot || gameState !== "playing") {
    aiming = false;
    return;
  }
  aiming = false;
  fireFromChargePoint(aimPoint);
};

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", restartGame);
exitBtn.addEventListener("click", exitGame);
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);

monsterSpeedInput.addEventListener("input", (event) => {
  config.monsterSpeed = Number(event.target.value);
});

chargeSpeedInput.addEventListener("input", (event) => {
  config.chargeSpeedFactor = Number(event.target.value);
});

bounceCountInput.addEventListener("input", (event) => {
  config.eggMaxBounces = Number(event.target.value);
});

damageInput.addEventListener("input", (event) => {
  config.eggDamage = Number(event.target.value);
});

hpRangeInput.addEventListener("input", (event) => {
  const maxHp = Number(event.target.value);
  config.monsterHpMax = maxHp;
  config.monsterHpMin = Math.max(10, maxHp - 30);
});

gravityInput.addEventListener("input", (event) => {
  config.eggGravity = Number(event.target.value);
});

bounceAngleInput.addEventListener("input", (event) => {
  config.bounceAngleFactor = Number(event.target.value);
});

eggSizeInput.addEventListener("input", (event) => {
  config.eggRadius = Number(event.target.value);
});

setMode();
resetGame();
animationFrame = requestAnimationFrame(loop);
