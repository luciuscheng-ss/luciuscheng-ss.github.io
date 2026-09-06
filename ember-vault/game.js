// app/game/core.mjs
var WIDTH = 5400;
var GROUND = 448;
var STEP = 1 / 120;
var platforms = [{ x: 0, y: 448, w: 5400, h: 130, ground: true }, { x: 380, y: 337, w: 224, h: 24 }, { x: 720, y: 250, w: 192, h: 24 }, { x: 1080, y: 338, w: 288, h: 24 }, { x: 1540, y: 305, w: 224, h: 24 }, { x: 1930, y: 355, w: 192, h: 24 }, { x: 2210, y: 263, w: 256, h: 24 }, { x: 2600, y: 345, w: 256, h: 24 }, { x: 3e3, y: 292, w: 256, h: 24 }, { x: 3420, y: 354, w: 224, h: 24 }, { x: 3760, y: 274, w: 256, h: 24 }, { x: 4070, y: 356, w: 192, h: 24 }];
var spikes = [{ x: 1260, w: 96 }, { x: 2710, w: 96 }, { x: 3650, w: 96 }];
var clamp = (v, a, b) => Math.max(a, Math.min(b, v));
var approach = (v, target, amount) => v < target ? Math.min(target, v + amount) : Math.max(target, v - amount);
var WEAPONS = {
  sword: { name: "\u4F59\u70EC\u957F\u5251", style: "\u8FC5\u6377\u8FDE\u65A9", sprite: "hero", color: "#ddf3df", duration: [0, 0.34, 0.36, 0.48], damage: [0, 28, 33, 50], range: [0, 90, 96, 111], active: [0.25, 0.56], stop: [0, 0.05, 0.055, 0.085], lunge: [0, 180, 205, 265], stagger: 0.3, knock: 195 },
  spear: { name: "\u5B88\u671B\u957F\u77DB", style: "\u8FDC\u8DDD\u7A81\u523A", sprite: "hero_spear", color: "#8de6db", duration: [0, 0.4, 0.42, 0.55], damage: [0, 25, 30, 44], range: [0, 143, 153, 167], active: [0.28, 0.56], stop: [0, 0.04, 0.045, 0.065], lunge: [0, 205, 225, 290], stagger: 0.23, knock: 145 },
  hammer: { name: "\u788E\u72F1\u6218\u9524", style: "\u84C4\u529B\u91CD\u51FB", sprite: "hero_hammer", color: "#ffbd7e", duration: [0, 0.6, 0.66, 0.82], damage: [0, 47, 59, 83], range: [0, 84, 100, 113], active: [0.44, 0.65], stop: [0, 0.075, 0.09, 0.12], lunge: [0, 125, 175, 235], stagger: 0.55, knock: 345 }
};
function createState() {
  const spawns = [["guard", 655, 448], ["guard", 1160, 338], ["wisp", 1470, 302], ["guard", 1810, 448], ["guard", 2340, 263], ["guard", 2480, 448], ["wisp", 2960, 325], ["guard", 3220, 292], ["guard", 3510, 448], ["wisp", 3890, 274], ["guard", 4190, 448], ["boss", 4770, 448]];
  return { mode: "title", time: 0, clock: 0, hitstop: 0, shake: 0, seed: 123456, hero: { x: 230, y: 448, vx: 0, vy: 0, dir: 1, w: 26, h: 62, hp: 100, stamina: 100, flasks: 2, grounded: true, jumps: 0, coyote: 0.1, jumpBuffer: 0, drop: 0, roll: 0, rollCd: 0, invuln: 0, hurt: 0, attack: 0, attackTotal: 0, attackId: 0, combo: 0, comboGrace: 0, queued: false, anim: "idle", animTime: 0, weapon: "sword", sprinting: false, gait: 0, land: 0, brake: 0, released: false, sprintStrike: false, pickupCd: 0, trailClock: 0 }, enemies: spawns.map(([kind, x, y], i) => ({ id: i, kind, x, y, homeX: x, homeY: y, vx: 0, vy: 0, dir: -1, w: kind === "boss" ? 55 : 26, h: kind === "boss" ? 104 : kind === "wisp" ? 42 : 56, hp: kind === "boss" ? 420 : kind === "wisp" ? 44 : 74, maxHp: kind === "boss" ? 420 : kind === "wisp" ? 44 : 74, state: "idle", timer: 0, cooldown: 0.5 + i * 0.13, stun: 0, flash: 0, animTime: i * 0.16, deadTime: 0, lastHit: -1, activated: false, attackSerial: 0 })), particles: [], texts: [], projectiles: [], drops: [], ghosts: [], impacts: [], events: [], kills: 0, cells: 0, hint: "", hintTime: 0, bossAwake: false, bossDefeated: false, pickups: [{ id: 0, x: 350, y: 448, weapon: "spear" }, { id: 1, x: 950, y: 448, weapon: "hammer" }, { id: 2, x: 1570, y: 448, weapon: "sword" }, { id: 3, x: 2260, y: 263, weapon: "hammer" }, { id: 4, x: 3e3, y: 448, weapon: "spear" }, { id: 5, x: 4230, y: 448, weapon: "hammer" }], rests: [{ x: 1710, y: 448, used: false }, { x: 3990, y: 448, used: false }], chests: [{ x: 822, y: 250, opened: false }, { x: 3148, y: 292, opened: false }] };
}
function rand(s) {
  s.seed = Math.imul(s.seed, 1664525) + 1013904223 >>> 0;
  return s.seed / 4294967296;
}
function burst(s, x, y, color, n = 14, power = 130) {
  for (let i = 0; i < n; i++) {
    const a = rand(s) * Math.PI * 2, v = power * (0.2 + rand(s));
    s.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 50, life: 0.25 + rand(s) * 0.55, maxLife: 0.8, color, size: 1 + rand(s) * 3 });
  }
}
function note(s, text, duration = 3) {
  s.hint = text;
  s.hintTime = duration;
}
function event(s, name) {
  s.events.push(name);
}
function startAttack(s, combo) {
  const h = s.hero, w = WEAPONS[h.weapon];
  h.sprintStrike = combo === 1 && h.sprinting && Math.abs(h.vx) > 330;
  h.sprinting = false;
  h.combo = combo;
  h.attackTotal = w.duration[combo];
  h.attack = h.attackTotal;
  h.attackId++;
  h.animTime = 0;
  h.queued = false;
  h.released = false;
  h.vx *= h.sprintStrike ? 0.6 : 0.15;
  h.brake = 0;
  h.land = 0;
}
function nearbyWeapon(s) {
  const h = s.hero;
  return s.pickups.filter((p) => p.weapon !== h.weapon && Math.abs(p.y - h.y) < 65 && Math.abs(p.x - h.x) < 67).sort((a, b) => Math.abs(a.x - h.x) - Math.abs(b.x - h.x))[0];
}
function action(s, name, input = {}) {
  if (name === "start" && s.mode === "title") {
    s.mode = "playing";
    note(s, "A / D \u79FB\u52A8 \xB7 \u6309\u4F4F Shift \u75BE\u8DD1 \xB7 E \u62FE\u53D6\u6B66\u5668", 4);
    return;
  }
  if (name === "restart") {
    Object.assign(s, createState());
    s.mode = "playing";
    return;
  }
  if (name === "pause") {
    if (s.mode === "playing") s.mode = "paused";
    return;
  }
  if (name === "togglePause") {
    if (s.mode === "playing") s.mode = "paused";
    else if (s.mode === "paused") s.mode = "playing";
    return;
  }
  if (s.mode !== "playing") return;
  const h = s.hero;
  if (name === "jump") {
    if (input.down && h.grounded && h.y < GROUND - 2) {
      h.drop = 0.22;
      h.y += 5;
      h.grounded = false;
      h.jumps = 1;
      return;
    }
    h.jumpBuffer = 0.14;
  }
  if (name === "attack" && h.roll <= 0 && h.hurt <= 0) {
    if (h.attack > 0) h.queued = true;
    else startAttack(s, h.comboGrace > 0 && h.combo < 3 ? h.combo + 1 : 1);
  }
  if (name === "roll" && h.rollCd <= 0 && h.stamina >= 28 && h.hurt <= 0) {
    h.roll = 0.34;
    h.rollCd = 0.49;
    h.stamina -= 28;
    h.invuln = Math.max(h.invuln, 0.38);
    h.attack = 0;
    h.queued = false;
    h.comboGrace = 0;
    h.animTime = 0;
    event(s, "dash");
    burst(s, h.x, h.y - 8, "#8dbba6", 9, 80);
  }
  if (name === "heal" && h.flasks > 0 && h.hp < 100) {
    h.hp = Math.min(100, h.hp + 45);
    h.flasks--;
    h.invuln = Math.max(0.4, h.invuln);
    burst(s, h.x, h.y - 30, "#a2e9af", 27, 95);
    note(s, "\u6062\u590D 45 \u751F\u547D");
    event(s, "heal");
  }
  if (name === "interact") {
    const pickup = nearbyWeapon(s);
    if (pickup) {
      if (h.pickupCd > 0) return;
      if (h.attack > 0 || h.roll > 0 || h.hurt > 0) {
        note(s, "\u6536\u62DB\u540E\u6309 E \u66F4\u6362\u6B66\u5668", 1);
        return;
      }
      const old = h.weapon;
      h.weapon = pickup.weapon;
      pickup.weapon = old;
      h.pickupCd = 0.35;
      h.combo = 0;
      h.comboGrace = 0;
      h.queued = false;
      h.sprintStrike = false;
      h.animTime = 0;
      burst(s, h.x, h.y - 30, WEAPONS[h.weapon].color, 22, 100);
      note(s, "\u5DF2\u88C5\u5907 " + WEAPONS[h.weapon].name + " \xB7 " + WEAPONS[h.weapon].style, 2);
      event(s, "equip");
      return;
    }
    const rest = s.rests.find((r) => !r.used && Math.abs(r.x - h.x) < 75 && Math.abs(r.y - h.y) < 70);
    const chest = s.chests.find((c) => !c.opened && Math.abs(c.x - h.x) < 68 && Math.abs(c.y - h.y) < 70);
    if (rest) {
      rest.used = true;
      h.hp = 100;
      h.flasks = Math.min(2, h.flasks + 1);
      burst(s, rest.x, rest.y - 25, "#ffd29a", 30);
      note(s, "\u4F11\u606F\u5904\u5DF2\u70B9\u71C3 \xB7 \u751F\u547D\u6062\u590D \xB7 \u8840\u74F6 +1", 4);
      event(s, "heal");
    } else if (chest) {
      chest.opened = true;
      s.cells += 20;
      h.hp = Math.min(100, h.hp + 20);
      burst(s, chest.x, chest.y - 15, "#f7d48b", 35);
      note(s, "\u627E\u5230\u4F59\u70EC \xD720 \xB7 \u6062\u590D 20 \u751F\u547D", 4);
      event(s, "loot");
    }
  }
}
function moveBody(body, dt, oneWay = true) {
  const oldY = body.y;
  body.x += body.vx * dt;
  body.y += body.vy * dt;
  body.grounded = false;
  if (body.vy >= 0) for (const p of platforms) {
    if (!p.ground && (!oneWay || body.drop > 0)) continue;
    if (oldY <= p.y + 2 && body.y >= p.y && body.x + body.w / 2 > p.x && body.x - body.w / 2 < p.x + p.w) {
      body.y = p.y;
      body.vy = 0;
      body.grounded = true;
    }
  }
  body.x = clamp(body.x, 28, WIDTH - 35);
}
function damageHero(s, amount, sourceX) {
  const h = s.hero;
  if (h.invuln > 0 || h.hp <= 0 || s.mode !== "playing") return false;
  h.hp = Math.max(0, h.hp - amount);
  h.invuln = 0.95;
  h.hurt = 0.23;
  h.roll = 0;
  h.attack = 0;
  h.queued = false;
  h.vx = (h.x < sourceX ? -1 : 1) * 260;
  h.vy = -160;
  h.animTime = 0;
  s.shake = 6;
  s.hitstop = 0.065;
  burst(s, h.x, h.y - 32, "#ff997d", 18);
  s.texts.push({ x: h.x, y: h.y - 68, text: "\u2212" + amount, color: "#ffa28b", life: 0.8 });
  event(s, "hurt");
  if (h.hp === 0) {
    s.mode = "dead";
    event(s, "death");
  }
  return true;
}
function damageEnemy(s, e, amount) {
  const h = s.hero, w = WEAPONS[h.weapon], heavy = h.weapon === "hammer";
  e.hp = Math.max(0, e.hp - amount);
  e.lastHit = h.attackId;
  e.flash = 0.15;
  e.stun = e.kind === "boss" ? heavy ? 0.13 : 0.04 : w.stagger;
  if (e.kind !== "boss") {
    e.state = "idle";
    e.timer = 0;
    e.vx = h.dir * w.knock;
    e.cooldown = Math.max(e.cooldown, 0.35);
  }
  s.shake = heavy ? 8 : h.combo === 3 ? 6 : 3;
  s.hitstop = w.stop[h.combo];
  burst(s, e.x, e.y - e.h * 0.5, e.kind === "wisp" ? "#c3a5ff" : w.color, heavy ? 27 : 17, heavy ? 230 : 175);
  s.impacts.push({ x: e.x, y: e.y - e.h * 0.5, dir: h.dir, life: heavy ? 0.24 : 0.16, weapon: h.weapon });
  s.texts.push({ x: e.x, y: e.y - e.h - 8, text: String(amount), color: heavy ? "#ffc382" : h.combo === 3 ? "#f9dd96" : "#f6efda", life: 0.75 });
  event(s, heavy ? "hammerHit" : h.weapon === "spear" ? "spearHit" : "hit");
  if (e.hp === 0) {
    s.kills++;
    e.state = "death";
    e.animTime = 0;
    e.deadTime = 0;
    burst(s, e.x, e.y - e.h / 2, "#91e5d0", 30, 140);
    for (let i = 0; i < (e.kind === "boss" ? 18 : 4); i++) s.drops.push({ x: e.x + (rand(s) - 0.5) * 40, y: e.y - 25 - rand(s) * 25, vy: -100 - rand(s) * 160, vx: (rand(s) - 0.5) * 110, life: 0 });
    if (e.kind === "boss") {
      s.bossDefeated = true;
      note(s, "\u9501\u72F1\u8005\u5DF2\u5012\u4E0B \xB7 \u524D\u5F80\u53F3\u4FA7\u51FA\u53E3", 5);
      event(s, "bossDown");
    }
  }
}
function hitInFront(a, b, range, vertical) {
  return (b.x - a.x) * a.dir > -b.w / 2 - 15 && (b.x - a.x) * a.dir < range + b.w / 2 && Math.abs(a.y - a.h * 0.5 - (b.y - b.h * 0.5)) < vertical;
}
function enemyUpdate(s, e, dt) {
  const h = s.hero;
  e.animTime += dt;
  e.flash = Math.max(0, e.flash - dt);
  e.stun = Math.max(0, e.stun - dt);
  e.cooldown -= dt;
  if (e.hp <= 0) {
    e.deadTime += dt;
    return;
  }
  const dx = h.x - e.x, dy = h.y - h.h / 2 - (e.y - e.h / 2), dist = Math.abs(dx), boss = e.kind === "boss";
  if (boss && !s.bossAwake) {
    if (h.x > 4350) {
      s.bossAwake = true;
      e.activated = true;
      note(s, "\u9501\u72F1\u8005\u82CF\u9192\u4E86", 3);
      event(s, "boss");
    } else return;
  }
  if (e.stun > 0) {
    if (e.kind !== "wisp") {
      e.vx *= 0.94;
      e.x += e.vx * dt;
    }
    return;
  }
  if (e.kind === "wisp") {
    e.y = e.homeY + Math.sin(s.clock * 2.1 + e.id) * 18;
    if (dist < 490 && Math.abs(dy) < 190) {
      e.dir = dx > 0 ? 1 : -1;
      if (e.state === "telegraph") {
        e.timer -= dt;
        if (e.timer <= 0) {
          const a = Math.atan2(dy, dx);
          s.projectiles.push({ x: e.x, y: e.y - 22, vx: Math.cos(a) * 205, vy: Math.sin(a) * 205, life: 4.2, kind: "orb" });
          e.state = "idle";
          e.cooldown = 2.6;
          event(s, "shot");
        }
      } else if (e.cooldown <= 0) {
        e.state = "telegraph";
        e.timer = 0.65;
        e.animTime = 0;
      } else if (dist > 220) e.x += Math.sign(dx) * 36 * dt;
    } else e.state = "idle";
    return;
  }
  const range = boss ? 132 : 75;
  if (e.state === "telegraph") {
    e.timer -= dt;
    e.vx = 0;
    if (e.timer <= 0) {
      e.state = "attack";
      e.timer = boss ? 0.35 : 0.25;
      e.attackSerial++;
      e.animTime = 0;
      e.didHit = false;
      if (boss && e.hp < e.maxHp * 0.55 && e.attackSerial % 2 === 0) {
        for (const dir of [-1, 1]) s.projectiles.push({ x: e.x + dir * 38, y: GROUND - 18, vx: dir * 240, vy: 0, life: 2.6, kind: "wave" });
        event(s, "slam");
      } else event(s, "enemySwing");
    }
  } else if (e.state === "attack") {
    e.timer -= dt;
    e.vx = e.dir * (boss ? 145 : 95);
    if (!e.didHit && hitInFront(e, h, range, boss ? 82 : 64)) {
      damageHero(s, boss ? 22 : 13, e.x);
      e.didHit = true;
    }
    if (e.timer <= 0) {
      e.state = "recover";
      e.timer = boss ? 0.7 : 0.64;
      e.vx = 0;
    }
  } else if (e.state === "recover") {
    e.timer -= dt;
    e.vx = 0;
    if (e.timer <= 0) {
      e.state = "idle";
      e.cooldown = boss ? 0.38 : 0.55;
    }
  } else {
    e.dir = dx >= 0 ? 1 : -1;
    if (dist < range - 10 && Math.abs(dy) < (boss ? 90 : 65) && e.cooldown <= 0) {
      e.state = "telegraph";
      e.timer = boss ? e.hp < e.maxHp * 0.5 ? 0.65 : 0.87 : 0.55;
      e.animTime = 0;
      e.vx = 0;
    } else if (dist < (boss ? 650 : 350) && dist > range * 0.64 && Math.abs(dy) < 95) {
      e.vx = Math.sign(dx) * (boss ? 95 : 72);
      e.state = "run";
    } else {
      e.state = "idle";
      e.vx = 0;
    }
  }
  if (e.homeY < GROUND && e.state !== "attack") e.x = clamp(e.x, e.homeX - 75, e.homeX + 75);
  e.vy += 1580 * dt;
  moveBody(e, dt);
}
function step(s, dt, input = {}) {
  if (s.mode !== "playing") return;
  s.clock += dt;
  s.time += dt;
  s.hitstop = Math.max(0, s.hitstop - dt);
  s.shake = Math.max(0, s.shake - 25 * dt);
  if (s.hitstop > 0) return;
  const h = s.hero;
  h.animTime += dt;
  for (const key of ["invuln", "hurt", "roll", "rollCd", "comboGrace", "coyote", "jumpBuffer", "drop", "land", "brake", "pickupCd"]) h[key] = Math.max(0, h[key] - dt);
  h.stamina = Math.min(100, h.stamina + (h.roll > 0 ? 0 : 29) * dt);
  if (h.grounded) {
    h.coyote = 0.1;
    h.jumps = 0;
  }
  if (h.jumpBuffer > 0 && h.roll <= 0 && h.hurt <= 0 && (h.coyote > 0 || h.jumps < 2)) {
    if (h.coyote <= 0 && h.jumps === 0) h.jumps = 1;
    h.vy = h.jumps === 0 ? -570 : -510;
    h.jumps++;
    h.jumpBuffer = 0;
    h.coyote = 0;
    h.grounded = false;
    h.animTime = 0;
    burst(s, h.x, h.y, "#8babba", h.jumps === 2 ? 14 : 7, 80);
    event(s, "jump");
  }
  const horizontal = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  h.sprinting = !!input.sprint && horizontal !== 0 && h.grounded && h.attack <= 0 && h.roll <= 0 && h.hurt <= 0;
  if (h.roll > 0) {
    h.vx = h.dir * 610;
  } else if (h.hurt <= 0) {
    if (h.attack <= 0) {
      if (h.grounded && Math.abs(h.vx) > 130 && (!horizontal || Math.sign(h.vx) !== horizontal) && h.brake === 0) {
        h.brake = 0.15;
        h.animTime = 0;
        burst(s, h.x, h.y - 3, "#8299a3", 5, 50);
      }
      h.vx = approach(h.vx, horizontal * (input.sprint ? 420 : 255), dt * (horizontal ? Math.sign(h.vx) !== horizontal ? 4800 : 2100 : 2600));
      if (horizontal) h.dir = horizontal;
    } else h.vx *= Math.pow(0.055, dt);
  } else h.vx *= Math.pow(0.055, dt);
  const oldGait = h.gait;
  if (h.grounded && h.attack <= 0 && h.roll <= 0) {
    h.gait += Math.abs(h.vx) * dt / (h.sprinting ? 118 : 90);
    if (Math.floor(h.gait * 2) !== Math.floor(oldGait * 2) && Math.abs(h.vx) > 70) {
      burst(s, h.x, h.y - 1, "#8aa29a", h.sprinting ? 7 : 3, h.sprinting ? 80 : 45);
      event(s, h.sprinting ? "sprintStep" : "step");
    }
  }
  h.trailClock += dt;
  if ((h.roll > 0 || h.sprinting && Math.abs(h.vx) > 330) && h.trailClock > 0.045) {
    h.trailClock = 0;
    s.ghosts.push({ x: h.x, y: h.y, dir: h.dir, life: h.roll > 0 ? 0.16 : 0.12, animTime: h.animTime, anim: h.roll > 0 ? "roll" : "sprint", frame: h.roll > 0 ? Math.floor((1 - h.roll / 0.34) * 8) : Math.floor(h.gait * 16) % 16, weapon: h.weapon });
  }
  if (h.attack > 0) {
    h.attack = Math.max(0, h.attack - dt);
    const progress = 1 - h.attack / h.attackTotal, w = WEAPONS[h.weapon];
    if (!h.released && progress >= w.active[0]) {
      h.released = true;
      h.vx = h.dir * (w.lunge[h.combo] + (h.sprintStrike ? 115 : 0));
      event(s, h.weapon === "hammer" ? "hammerSwing" : h.weapon === "spear" ? "spearSwing" : "swing");
      if (h.grounded) burst(s, h.x - h.dir * 12, h.y - 2, "#aeb9a2", h.weapon === "hammer" ? 13 : 6, 95);
    }
    if (progress > w.active[0] && progress < w.active[1]) {
      for (const e of s.enemies) if (e.hp > 0 && e.lastHit !== h.attackId && hitInFront(h, e, w.range[h.combo] + (h.sprintStrike ? 14 : 0), h.weapon === "spear" ? e.kind === "boss" ? 75 : 45 : e.kind === "boss" ? 91 : 66)) damageEnemy(s, e, Math.round(w.damage[h.combo] * (h.sprintStrike ? 1.2 : 1)));
      s.projectiles = s.projectiles.filter((p) => {
        if ((p.x - h.x) * h.dir > -18 && (p.x - h.x) * h.dir < w.range[h.combo] + 8 && Math.abs(p.y - h.y + 28) < (h.weapon === "spear" ? 44 : 72)) {
          burst(s, p.x, p.y, w.color, 12);
          event(s, "hit");
          return false;
        }
        return true;
      });
    }
    if (h.attack <= 0) {
      if (h.queued && h.combo < 3) startAttack(s, h.combo + 1);
      else {
        h.queued = false;
        h.comboGrace = h.combo < 3 ? 0.18 : 0;
      }
    }
  }
  const wasGrounded = h.grounded, landingSpeed = h.vy;
  h.vy = Math.min(900, h.vy + 1580 * dt);
  moveBody(h, dt);
  if (!wasGrounded && h.grounded && landingSpeed > 180) {
    h.land = 0.13;
    h.animTime = 0;
    burst(s, h.x, h.y - 2, "#9cafa5", landingSpeed > 600 ? 14 : 7, landingSpeed > 600 ? 125 : 65);
    event(s, "land");
    if (landingSpeed > 650) s.shake = Math.max(s.shake, 2);
  }
  if (s.bossAwake && !s.bossDefeated) h.x = clamp(h.x, 4330, 5140);
  if (h.grounded && h.drop <= 0) {
    for (const p of spikes) if (h.y >= GROUND - 2 && h.x > p.x - 5 && h.x < p.x + p.w + 5) damageHero(s, 15, p.x + p.w / 2);
  }
  for (const e of s.enemies) enemyUpdate(s, e, dt);
  for (const p of s.projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (Math.abs(p.x - h.x) < h.w / 2 + 12 && p.y > h.y - h.h && p.y < h.y + 6) {
      if (damageHero(s, p.kind === "wave" ? 18 : 11, p.x)) p.life = 0;
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0 && p.x > 0 && p.x < WIDTH);
  for (const p of s.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 240 * dt;
    p.life -= dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0);
  for (const t of s.texts) {
    t.y -= 35 * dt;
    t.life -= dt;
  }
  s.texts = s.texts.filter((t) => t.life > 0);
  for (const g of s.ghosts) g.life -= dt;
  s.ghosts = s.ghosts.filter((g) => g.life > 0);
  for (const f of s.impacts) f.life -= dt;
  s.impacts = s.impacts.filter((f) => f.life > 0);
  for (const d of s.drops) {
    d.life += dt;
    const dx = h.x - d.x, dy = h.y - 28 - d.y;
    if (d.life > 0.25 && Math.hypot(dx, dy) < 145) {
      d.x += dx * dt * 8;
      d.y += dy * dt * 8;
      if (Math.hypot(dx, dy) < 18) {
        s.cells++;
        d.collected = true;
        event(s, "cell");
      }
    } else {
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 550 * dt;
      if (d.y > GROUND - 8) {
        d.y = GROUND - 8;
        d.vy *= -0.3;
        d.vx *= 0.7;
      }
    }
  }
  s.drops = s.drops.filter((d) => !d.collected && d.life < 30);
  s.hintTime = Math.max(0, s.hintTime - dt);
  if (s.hintTime === 0) s.hint = "";
  const near = nearbyWeapon(s);
  if (near && h.pickupCd <= 0) s.hint = "\u6309 E \u62FE\u53D6 " + WEAPONS[near.weapon].name + " \xB7 " + WEAPONS[near.weapon].style;
  else if (!s.hint) {
    if (s.rests.some((r) => !r.used && Math.abs(r.x - h.x) < 75 && Math.abs(r.y - h.y) < 60)) s.hint = "\u6309 E \u70B9\u71C3\u4F11\u606F\u5904 \xB7 \u6062\u590D\u751F\u547D\u4E0E\u8840\u74F6";
    else if (s.chests.some((c) => !c.opened && Math.abs(c.x - h.x) < 68 && Math.abs(c.y - h.y) < 60)) s.hint = "\u6309 E \u6253\u5F00\u5B9D\u7BB1";
  }
  if (h.x > 5255 && s.bossDefeated) {
    s.mode = "won";
    event(s, "victory");
  }
  h.anim = h.hp <= 0 ? "death" : h.hurt > 0 ? "hurt" : h.roll > 0 ? "roll" : h.attack > 0 ? "attack" + h.combo : !h.grounded ? h.vy < 0 ? "jump" : "fall" : h.land > 0 ? "land" : h.brake > 0 ? "brake" : Math.abs(h.vx) > 20 ? h.sprinting ? "sprint" : "run" : "idle";
}
function snapshot(s) {
  const e = s.enemies.find((e2) => e2.kind === "boss"), w = WEAPONS[s.hero.weapon];
  return { mode: s.mode, hp: s.hero.hp, stamina: s.hero.stamina, kills: s.kills, cells: s.cells, time: s.time, zone: s.hero.x < 1800 ? "\u9057\u5FD8\u6C34\u7262" : s.hero.x < 3600 ? "\u6C89\u949F\u56DE\u5ECA" : "\u9501\u72F1\u5927\u5385", boss: s.bossAwake ? e.hp : 0, bossMax: e.maxHp, flasks: s.hero.flasks, hint: s.hint, combo: s.hero.combo, progress: s.hero.x / WIDTH, weapon: s.hero.weapon, weaponName: w.name, weaponStyle: w.style, sprinting: s.hero.sprinting };
}

// app/game/renderer.ts
var clamp2 = (n, a, b) => Math.max(a, Math.min(b, n));
var KEYMAP = { KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", KeyS: "down", ArrowDown: "down", Space: "jump", KeyW: "jump", ArrowUp: "jump", KeyJ: "attack", KeyK: "roll", ShiftLeft: "sprint", ShiftRight: "sprint", KeyQ: "heal", KeyE: "interact", Escape: "togglePause", KeyP: "togglePause", Enter: "start" };
var Sound = class {
  constructor() {
    this.context = null;
    this.muted = false;
    this.master = null;
    this.ambient = [];
  }
  unlock() {
    if (!this.context) {
      try {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.muted ? 0 : 0.25;
        this.master.connect(this.context.destination);
        for (const f of [55, 82.41]) {
          const o = this.context.createOscillator(), g = this.context.createGain();
          o.type = "sine";
          o.frequency.value = f;
          g.gain.value = 0.026;
          o.connect(g);
          g.connect(this.master);
          o.start();
          this.ambient.push(o);
        }
      } catch {
        return;
      }
    }
    this.context?.resume().catch(() => {
    });
  }
  mute(v) {
    this.muted = v;
    if (this.master && this.context) this.master.gain.setTargetAtTime(v ? 0 : 0.25, this.context.currentTime, 0.04);
  }
  suspend() {
    this.context?.suspend().catch(() => {
    });
  }
  play(kind) {
    const c = this.context, m = this.master;
    if (!c || !m || this.muted || c.state !== "running") return;
    const now = c.currentTime;
    const sounds = { jump: [170, 310, 0.12, "sine"], dash: [170, 50, 0.16, "triangle"], swing: [320, 80, 0.11, "sawtooth"], hit: [95, 35, 0.12, "square"], hurt: [170, 38, 0.26, "sawtooth"], heal: [390, 780, 0.5, "sine"], loot: [500, 1e3, 0.3, "sine"], cell: [1e3, 1350, 0.06, "sine"], boss: [90, 40, 0.8, "sawtooth"], bossDown: [130, 390, 1, "triangle"], death: [190, 30, 1, "triangle"], victory: [330, 880, 1.3, "sine"], shot: [650, 230, 0.17, "sine"], enemySwing: [200, 60, 0.18, "sawtooth"], slam: [65, 20, 0.35, "triangle"] };
    Object.assign(sounds, { hammerSwing: [120, 35, 0.27, "sawtooth"], hammerHit: [72, 22, 0.3, "triangle"], spearSwing: [480, 170, 0.1, "triangle"], spearHit: [240, 75, 0.13, "square"], step: [76, 34, 0.045, "triangle"], sprintStep: [90, 35, 0.055, "triangle"], land: [68, 28, 0.1, "triangle"], equip: [380, 950, 0.23, "sine"] });
    const [f, end, dur, type] = sounds[kind] || sounds.hit;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(end, now + dur);
    g.gain.setValueAtTime(kind === "cell" ? 0.05 : kind === "step" || kind === "sprintStep" ? 0.07 : kind === "hammerHit" ? 0.36 : 0.23, now);
    g.gain.exponentialRampToValueAtTime(1e-3, now + dur);
    o.connect(g);
    g.connect(m);
    o.start(now);
    o.stop(now + dur + 0.02);
    if (["swing", "dash", "hit", "hurt", "slam", "hammerHit", "hammerSwing", "spearHit"].includes(kind)) {
      const b = c.createBuffer(1, Math.ceil(c.sampleRate * 0.12), c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const n = c.createBufferSource(), ng = c.createGain(), filter = c.createBiquadFilter();
      n.buffer = b;
      filter.type = "lowpass";
      filter.frequency.value = kind === "hammerHit" ? 650 : kind === "hit" ? 1600 : 3500;
      ng.gain.value = 0.13;
      n.connect(filter);
      filter.connect(ng);
      ng.connect(m);
      n.start();
    }
  }
  destroy() {
    this.context?.close().catch(() => {
    });
  }
};
function createGame(canvas, onState, onError) {
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("\u6D4F\u89C8\u5668\u4E0D\u652F\u6301 Canvas 2D");
  const c = ctx, s = createState(), audio = new Sound(), input = {};
  const assetBase = (globalThis.__EMBER_ASSET_BASE__ ?? "/assets").replace(/\/$/, "");
  const images = {};
  let definitions = {};
  let alive = true, ready = false, raf = 0, last = 0, accumulator = 0, lastNotify = 0, realTime = 0, camera = 0, viewW = 960;
  const toolLifecycle = new AbortController();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function notify() {
    onState(snapshot(s));
  }
  function clearInput() {
    Object.keys(input).forEach((k) => input[k] = false);
  }
  function resize() {
    const box = canvas.getBoundingClientRect();
    viewW = clamp2(Math.round(540 * box.width / Math.max(1, box.height)), 320, 1600);
    canvas.width = viewW;
    canvas.height = 540;
    c.imageSmoothingEnabled = false;
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();
  function loadImage(key, url) {
    return new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        images[key] = im;
        resolve();
      };
      im.onerror = () => reject(new Error("\u753B\u9762\u7D20\u6750\u52A0\u8F7D\u5931\u8D25\uFF0C\u8BF7\u5237\u65B0\u91CD\u8BD5\u3002"));
      im.src = url;
    });
  }
  async function load() {
    try {
      const response = await fetch(assetBase + "/characters/sprites.json", { cache: "no-cache" });
      if (!response.ok) throw new Error("\u89D2\u8272\u7D20\u6750\u672A\u80FD\u8F7D\u5165\u3002");
      const data = await response.json();
      definitions = data.entities;
      await Promise.all([...Object.entries(definitions).map(([key, d]) => loadImage(key, assetBase + "/characters/" + d.image)), ...["sword", "spear", "hammer"].map((key) => loadImage("weapon_" + key, assetBase + "/characters/weapon-" + key + ".png")), ...["far", "mid", "near", "tiles", "banner"].map((key) => loadImage(key, assetBase + "/environment/" + key + ".png"))]);
      if (!alive) return;
      ready = true;
      notify();
    } catch (e) {
      if (alive) onError(e instanceof Error ? e.message : "\u672A\u80FD\u8F7D\u5165\u6E38\u620F\u3002");
    }
  }
  function command(name) {
    audio.unlock();
    if (name === "restart") {
      camera = 0;
      clearInput();
    }
    action(s, name, input);
    if (s.mode !== "playing") clearInput();
    notify();
  }
  const modelContext = document.modelContext;
  if (modelContext?.registerTool) {
    const register = (tool) => {
      try {
        void Promise.resolve(modelContext.registerTool(tool, { signal: toolLifecycle.signal })).catch(() => {
        });
      } catch {
      }
    };
    register({ name: "read_ember_vault_status", description: "Read the current run, health, progress, and boss status.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true }, execute: () => snapshot(s) });
    register({ name: "control_ember_vault_run", description: "Start, pause, resume, or restart the current game. Restart discards this run.", inputSchema: { type: "object", properties: { action: { type: "string", enum: ["start", "pause", "resume", "restart"] } }, required: ["action"], additionalProperties: false }, annotations: { readOnlyHint: false }, execute: (input2) => {
      const value = input2;
      if (!value || typeof value !== "object" || Object.keys(value).some((k) => k !== "action") || !["start", "pause", "resume", "restart"].includes(value.action || "")) throw new Error("Expected a supported run action.");
      if (!ready) throw new Error("Game assets are still loading.");
      if (value.action === "resume") {
        if (s.mode === "paused") command("togglePause");
      } else command(value.action);
      return snapshot(s);
    } });
  }
  function down(e) {
    if (e.target?.closest('input,textarea,select,[role="dialog"]')) return;
    const name = KEYMAP[e.code];
    if (!name) return;
    if (e.code === "Space" && e.target?.tagName === "BUTTON") return;
    e.preventDefault();
    audio.unlock();
    if (["left", "right", "down", "sprint"].includes(name)) input[name] = true;
    else if (!e.repeat) command(name);
  }
  function up(e) {
    const name = KEYMAP[e.code];
    if (name) input[name] = false;
  }
  function blur() {
    clearInput();
    if (s.mode === "playing") {
      action(s, "pause");
      notify();
    }
    audio.suspend();
  }
  function visibility() {
    if (document.hidden) blur();
  }
  function mouse(e) {
    if (e.button === 0 && s.mode === "playing") {
      command("attack");
    }
  }
  window.addEventListener("keydown", down);
  window.addEventListener("keyup", up);
  window.addEventListener("blur", blur);
  document.addEventListener("visibilitychange", visibility);
  canvas.addEventListener("mousedown", mouse);
  function imageLayer(key, speed, alpha = 1) {
    const im = images[key];
    if (!im) return;
    const scale = 1.5, w = im.width * scale;
    const off = -(camera * speed % w);
    c.globalAlpha = alpha;
    for (let x = off - w; x < viewW; x += w) c.drawImage(im, Math.round(x), 0, w, 540);
    c.globalAlpha = 1;
  }
  function glow(x, y, r, color) {
    const g = c.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, "transparent");
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  function tile(col, row, x, y, size = 32) {
    c.drawImage(images.tiles, col * 16, row * 16, 16, 16, Math.round(x), Math.round(y), size, size);
  }
  function sprite(kind, x, y, dir, animation, time, scale, alpha = 1, frameOverride) {
    const d = definitions[kind];
    if (!d || !images[kind]) return;
    const a = d.animations[animation] || d.animations.idle;
    const raw = Math.floor(Math.max(0, time) * a.fps), frame = frameOverride === void 0 ? a.loop ? raw % a.frames : Math.min(a.frames - 1, raw) : clamp2(frameOverride, 0, a.frames - 1);
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(dir, 1);
    c.globalAlpha = alpha;
    c.drawImage(images[kind], frame * d.frameWidth, a.row * d.frameHeight, d.frameWidth, d.frameHeight, -d.anchorX * scale, -d.anchorY * scale, d.frameWidth * scale, d.frameHeight * scale);
    c.restore();
  }
  function slash(x, y, dir, progress, combo, color = "#e5fbeb") {
    if (progress < 0.2 || progress > 0.8) return;
    const t = (progress - 0.2) / 0.6, range = combo === 3 ? 110 : 94;
    c.save();
    c.translate(x, y - 30);
    c.scale(dir, 1);
    c.globalAlpha = Math.sin(t * Math.PI) * 0.85;
    c.strokeStyle = color;
    c.lineWidth = combo === 3 ? 10 : 6;
    c.beginPath();
    c.ellipse(5, 0, range, range * 0.62, 0, -1.35 + t * 0.7, 1.3 + t * 0.4);
    c.stroke();
    c.strokeStyle = "#c6f8ef";
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(8, 0, range + 6, range * 0.64, 0, -1.2 + t * 0.7, 1.05 + t * 0.4);
    c.stroke();
    c.restore();
  }
  function heroStrike() {
    const h = s.hero, w = WEAPONS[h.weapon], p = 1 - h.attack / h.attackTotal;
    if (p < w.active[0] || p > w.active[1] + 0.1) return;
    const t = (p - w.active[0]) / (w.active[1] + 0.1 - w.active[0]), r = w.range[h.combo] + (h.sprintStrike ? 14 : 0);
    c.save();
    c.translate(h.x, h.y - 31);
    c.scale(h.dir, 1);
    c.globalAlpha = Math.sin(Math.PI * t) * 0.78;
    c.strokeStyle = w.color;
    if (h.weapon === "spear") {
      c.fillStyle = w.color;
      c.beginPath();
      c.moveTo(28, -5);
      c.lineTo(r + 12, -1);
      c.lineTo(30, 6);
      c.lineTo(48, 0);
      c.fill();
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(18, -10);
      c.lineTo(r - 9, -5);
      c.moveTo(24, 11);
      c.lineTo(r - 22, 6);
      c.stroke();
    } else {
      const radius = h.weapon === "hammer" ? r * 0.88 : r;
      c.lineWidth = h.weapon === "hammer" ? 15 : 7;
      c.beginPath();
      c.ellipse(12, 0, radius, radius * 0.64, 0, -1.5 + t * 0.75, 1 + t * 0.6);
      c.stroke();
      c.strokeStyle = "#fff7db";
      c.lineWidth = 2;
      c.beginPath();
      c.ellipse(12, 0, radius + 5, radius * 0.68, 0, -1.25 + t * 0.7, 0.85 + t * 0.6);
      c.stroke();
      if (h.weapon === "hammer" && h.grounded && t > 0.25) {
        c.fillStyle = "#efc298";
        c.globalAlpha = (1 - t) * 0.42;
        c.fillRect(20, 29, r * 1.05, 3);
      }
    }
    c.restore();
  }
  function drawWorld() {
    c.fillStyle = "#0c1a24";
    c.fillRect(0, 0, viewW, 540);
    imageLayer("far", 0.09);
    imageLayer("mid", 0.34, 0.72);
    imageLayer("near", 0.66, 0.85);
    c.save();
    c.globalCompositeOperation = "screen";
    for (let i = 0; i < 4; i++) {
      const x = ((i * 520 - camera * 0.31) % 1800 + 1800) % 1800 - 220;
      c.fillStyle = "#43747c09";
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + 47, 0);
      c.lineTo(x + 250, 448);
      c.lineTo(x + 105, 448);
      c.fill();
    }
    c.restore();
    c.save();
    c.translate(-Math.round(camera), 0);
    for (const x of [110, 980, 1740, 2560, 3290, 4140, 4630, 5160]) {
      const flicker = 1 + Math.sin(realTime * 8 + x) * 0.07;
      glow(x, 258, 105 * flicker, "#e7923839");
      tile(5, 1, x - 16, 244);
      c.fillStyle = "#fff0b1";
      c.fillRect(x - 3, 250 + Math.sin(realTime * 11 + x) * 2, 5, 8);
      c.fillStyle = "#b9763860";
      c.fillRect(x - 20, 286, 40, 3);
    }
    for (const x of [485, 2040, 3480, 4650]) c.drawImage(images.banner, x, 92, 60, 144);
    for (const p of platforms) {
      if (p.x + p.w < camera - 32 || p.x > camera + viewW + 32) continue;
      for (let x = p.x; x < p.x + p.w; x += 32) {
        if (x + 32 < camera || x > camera + viewW) continue;
        if (p.ground) {
          tile(Math.floor(x / 32) * 7 % 3, 0, x, p.y);
          for (let y = p.y + 32; y < 540; y += 32) tile((Math.floor(x / 32) + Math.floor(y / 32)) % 3, 1, x, y);
        } else tile(x === p.x ? 5 : x + 32 >= p.x + p.w ? 7 : 6, 0, x, p.y - 6);
      }
      if (!p.ground) {
        c.fillStyle = "#385058";
        c.fillRect(p.x + 14, p.y + 23, 7, 18);
        c.fillRect(p.x + p.w - 23, p.y + 23, 7, 18);
        c.fillStyle = "#15252a";
        c.fillRect(p.x + 22, p.y + 23, p.w - 45, 3);
      }
    }
    for (const p of spikes) for (let x = p.x; x < p.x + p.w; x += 32) tile(3, 1, x, GROUND - 26);
    for (const x of [320, 917, 1450, 1900, 2140, 3350, 4010, 5100]) tile(6, 1, x, GROUND - 28);
    for (const rest of s.rests) {
      tile(0, 2, rest.x - 20, rest.y - 36, 40);
      glow(rest.x, rest.y - 27, 65, rest.used ? "#e99b4950" : "#63d8b82b");
      c.fillStyle = rest.used ? "#f9ca7c" : "#b0ffe3";
      c.fillRect(rest.x - 3, rest.y - 27, 6, 13);
    }
    for (const chest of s.chests) {
      tile(4, 1, chest.x - 18, chest.y - 32, 36);
      if (chest.opened) {
        c.fillStyle = "#192529";
        c.fillRect(chest.x - 12, chest.y - 28, 24, 7);
      } else {
        glow(chest.x, chest.y - 16, 50, "#e4b26025");
        c.fillStyle = "#eaca88";
        c.fillRect(chest.x - 3, chest.y - 20, 6, 7);
      }
    }
    for (const p of s.pickups) {
      if (p.x < camera - 110 || p.x > camera + viewW + 100) continue;
      const color = WEAPONS[p.weapon].color, y = p.y - 30 + Math.sin(realTime * 2.5 + p.id) * 3;
      c.fillStyle = "#16292f";
      c.fillRect(p.x - 24, p.y - 8, 48, 8);
      c.fillStyle = "#668b89";
      c.fillRect(p.x - 24, p.y - 8, 48, 2);
      glow(p.x + 8, y, 53, color + "2b");
      c.drawImage(images["weapon_" + p.weapon], p.x - 38, y - 24, 96, 48);
      c.fillStyle = color;
      c.fillRect(p.x - 2, p.y - 15, 4, 4);
      if (Math.abs(s.hero.x - p.x) < 95 && Math.abs(s.hero.y - p.y) < 80) {
        c.font = '13px "Microsoft YaHei",sans-serif';
        c.textAlign = "center";
        c.fillStyle = "#07151be8";
        c.fillRect(p.x - 61, y - 38, 122, 23);
        c.fillStyle = color;
        c.fillText(WEAPONS[p.weapon].name, p.x, y - 22);
      }
    }
    const exitColor = s.bossDefeated ? "#96f1ca" : "#526c77";
    c.fillStyle = "#09161f";
    c.fillRect(5220, 280, 86, 168);
    c.strokeStyle = "#43616a";
    c.lineWidth = 9;
    c.strokeRect(5216, 276, 94, 172);
    glow(5263, 363, 120, s.bossDefeated ? "#6beab84b" : "#377a821d");
    c.fillStyle = exitColor;
    c.globalAlpha = s.bossDefeated ? 0.5 : 0.18;
    c.fillRect(5230, 290, 66, 158);
    c.globalAlpha = 1;
    for (let i = 0; i < 5; i++) {
      c.fillStyle = exitColor;
      c.fillRect(5236 + i * 12, 297, 3, 151);
    }
    if (s.bossAwake && !s.bossDefeated) {
      for (const gx of [4330, 5140]) {
        c.fillStyle = "#8a564956";
        c.fillRect(gx - 3, 150, 6, 298);
        glow(gx, 340, 80, "#cf4f2630");
      }
    }
    for (const e of s.enemies) {
      if (e.x < camera - 150 || e.x > camera + viewW + 150 || e.deadTime > 1.2) continue;
      const kind = e.kind, scale = kind === "boss" ? 1.65 : kind === "wisp" ? 1.7 : 1.7;
      c.fillStyle = "#05131980";
      c.beginPath();
      c.ellipse(e.x, kind === "wisp" ? GROUND : e.y, kind === "boss" ? 47 : 24, 5, 0, 0, Math.PI * 2);
      c.fill();
      const animation = e.hp <= 0 ? "death" : e.stun > 0 && kind !== "wisp" ? "hurt" : e.state === "attack" || e.state === "telegraph" ? "attack" : e.state === "run" ? "run" : "idle";
      sprite(kind, e.x, e.y, e.dir, animation, e.hp <= 0 ? e.deadTime : e.animTime, scale, e.hp <= 0 ? Math.max(0, 1 - e.deadTime * 0.8) : 1, e.state === "telegraph" ? 0 : void 0);
      if (e.flash > 0) {
        glow(e.x, e.y - e.h / 2, 45, "#ffeccc49");
      }
      if (e.state === "telegraph") {
        c.fillStyle = "#ffba79";
        c.fillRect(e.x - 2, e.y - e.h - 26, 4, 12);
        c.fillRect(e.x - 2, e.y - e.h - 11, 4, 4);
        glow(e.x, e.y - e.h - 14, 35, "#ffc06f50");
        if (kind !== "wisp") {
          c.globalAlpha = 0.3 + 0.15 * Math.sin(realTime * 24);
          c.fillStyle = "#f7a16c";
          const r = kind === "boss" ? 155 : 84;
          c.fillRect(e.dir > 0 ? e.x : e.x - r, e.y - 3, r, 3);
          c.globalAlpha = 1;
        }
      }
      if (e.state === "attack" && kind !== "wisp") slash(e.x, e.y, e.dir, 0.5, kind === "boss" ? 3 : 1, "#ffad79");
      if (e.hp > 0 && e.hp < e.maxHp && kind !== "boss") {
        c.fillStyle = "#0b1b24";
        c.fillRect(e.x - 23, e.y - e.h - 10, 46, 4);
        c.fillStyle = kind === "wisp" ? "#bc8beb" : "#d7ad78";
        c.fillRect(e.x - 23, e.y - e.h - 10, 46 * e.hp / e.maxHp, 3);
      }
    }
    for (const d of s.drops) {
      glow(d.x, d.y, 15, "#83edd742");
      c.fillStyle = "#a3ffe5";
      c.fillRect(Math.round(d.x) - 2, Math.round(d.y) - 3, 4, 6);
    }
    for (const g of s.ghosts) if (!reduced) sprite(WEAPONS[g.weapon].sprite, g.x, g.y, g.dir, g.anim, g.animTime, 1.65, g.life * 1.4, g.frame);
    const h = s.hero;
    const hx = s.mode === "title" ? camera + viewW * 0.72 : h.x;
    c.fillStyle = "#05101799";
    c.beginPath();
    c.ellipse(hx, Math.min(GROUND, h.y + 2), 24, 5, 0, 0, Math.PI * 2);
    c.fill();
    const heroKind = WEAPONS[h.weapon].sprite;
    const frame = h.attack > 0 ? Math.floor((1 - h.attack / h.attackTotal) * (definitions[heroKind]?.animations["attack" + h.combo]?.frames || 10)) : h.roll > 0 ? Math.floor((1 - h.roll / 0.34) * 8) : s.mode === "dead" ? 5 : h.anim === "run" || h.anim === "sprint" ? Math.floor(h.gait * 16) % 16 : void 0;
    const opacity = h.invuln > 0 && h.roll <= 0 && Math.floor(realTime * 18) % 2 === 0 ? 0.5 : 1;
    sprite(heroKind, hx, h.y, h.dir, s.mode === "title" ? "idle" : h.anim, s.mode === "title" ? realTime : h.animTime, 1.65, opacity, frame);
    if (h.attack > 0) heroStrike();
    for (const impact of s.impacts) {
      const max = impact.weapon === "hammer" ? 0.24 : 0.16, t = 1 - impact.life / max, r = (impact.weapon === "hammer" ? 43 : 29) * (1 + t * 0.5);
      c.save();
      c.translate(impact.x, impact.y);
      c.globalAlpha = (1 - t) * 0.95;
      c.strokeStyle = WEAPONS[impact.weapon].color;
      c.lineWidth = impact.weapon === "hammer" ? 3 : 2;
      for (let i = 0; i < 7; i++) {
        const a = i * Math.PI * 2 / 7 + 0.2;
        c.beginPath();
        c.moveTo(Math.cos(a) * r * 0.25, Math.sin(a) * r * 0.25);
        c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        c.stroke();
      }
      c.fillStyle = "#fff7dc";
      c.fillRect(-3, -7, 6, 14);
      c.fillRect(-7, -3, 14, 6);
      c.restore();
    }
    for (const p of s.projectiles) {
      glow(p.x, p.y, p.kind === "wave" ? 40 : 27, p.kind === "wave" ? "#ff924e50" : "#b693f959");
      c.fillStyle = p.kind === "wave" ? "#ffb473" : "#d8afff";
      if (p.kind === "wave") {
        c.beginPath();
        c.moveTo(p.x - 17, p.y + 16);
        c.lineTo(p.x + 5, p.y - 25);
        c.lineTo(p.x + 18, p.y + 16);
        c.fill();
      } else {
        c.fillRect(p.x - 5, p.y - 5, 10, 10);
        c.fillStyle = "#fff2ff";
        c.fillRect(p.x - 2, p.y - 2, 4, 4);
      }
    }
    for (const p of s.particles) {
      c.globalAlpha = Math.min(1, p.life * 2.5);
      c.fillStyle = p.color;
      c.fillRect(Math.round(p.x), Math.round(p.y), Math.ceil(p.size), Math.ceil(p.size));
    }
    c.globalAlpha = 1;
    c.textAlign = "center";
    c.font = "bold 16px monospace";
    for (const t of s.texts) {
      c.globalAlpha = Math.min(1, t.life * 2);
      c.fillStyle = "#0b1720";
      c.fillText(t.text, t.x + 1, t.y + 1);
      c.fillStyle = t.color;
      c.fillText(t.text, t.x, t.y);
    }
    c.globalAlpha = 1;
    c.restore();
    for (let i = 0; i < 30; i++) {
      const x = ((i * 83.7 - camera * 0.52 + Math.sin(realTime * 0.3 + i) * 14) % viewW + viewW) % viewW, y = (i * 47.8 - realTime * (6 + i % 4)) % 480;
      c.fillStyle = i % 4 === 0 ? "#e5bd7455" : "#a7dadb25";
      c.fillRect(Math.floor(x), Math.floor((y + 480) % 480), i % 4 === 0 ? 2 : 1, 2);
    }
    const mist = c.createLinearGradient(0, 360, 0, 475);
    mist.addColorStop(0, "#67c3b000");
    mist.addColorStop(1, "#4f9c9220");
    c.fillStyle = mist;
    c.fillRect(0, 360, viewW, 115);
    const vignette = c.createLinearGradient(0, 0, 0, 540);
    vignette.addColorStop(0, "#0208127d");
    vignette.addColorStop(0.27, "#07101a00");
    vignette.addColorStop(0.82, "#070d1500");
    vignette.addColorStop(1, "#040a12cc");
    c.fillStyle = vignette;
    c.fillRect(0, 0, viewW, 540);
  }
  function tick(ms) {
    if (!alive) return;
    const dt = Math.min(0.08, (ms - last) / 1e3 || 0);
    last = ms;
    if (s.mode === "playing" || s.mode === "title") realTime += dt;
    if (ready) {
      accumulator += dt;
      if (s.mode !== "playing") accumulator = 0;
      while (accumulator >= STEP) {
        step(s, STEP, input);
        accumulator -= STEP;
      }
      for (const name of s.events) audio.play(name);
      s.events.length = 0;
      if (s.mode === "playing") {
        const look = s.hero.sprinting ? s.hero.dir * 42 : 0, target = clamp2(s.hero.x - viewW * 0.4 + look, 0, WIDTH - viewW);
        camera += (target - camera) * (1 - Math.exp(-dt * 8));
      }
      c.save();
      if (!reduced && s.shake > 0) c.translate(Math.sin(ms * 0.7) * s.shake, Math.cos(ms * 0.6) * s.shake * 0.5);
      drawWorld();
      c.restore();
      if (ms - lastNotify > 80) {
        notify();
        lastNotify = ms;
      }
    } else {
      c.fillStyle = "#0c1a24";
      c.fillRect(0, 0, viewW, 540);
    }
    raf = requestAnimationFrame(tick);
  }
  load();
  raf = requestAnimationFrame(tick);
  return { action: command, hold: (name, held) => {
    input[name] = held;
    audio.unlock();
  }, mute: (v) => audio.mute(v), pause: () => command("pause"), togglePause: () => command("togglePause"), getState: () => snapshot(s), destroy: () => {
    alive = false;
    toolLifecycle.abort();
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    window.removeEventListener("keydown", down);
    window.removeEventListener("keyup", up);
    window.removeEventListener("blur", blur);
    document.removeEventListener("visibilitychange", visibility);
    canvas.removeEventListener("mousedown", mouse);
    audio.destroy();
  } };
}
export {
  createGame
};
