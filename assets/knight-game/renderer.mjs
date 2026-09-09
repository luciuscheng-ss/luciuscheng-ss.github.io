/* Procedural pixel art. Coordinates are in CSS pixels; the simulation owns time. */
const TAU = Math.PI * 2;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const snap = n => Math.round(n);
const noise = (seed, index = 0) => {
  const n = Math.sin(seed * 12.9898 + index * 78.233) * 43758.5453;
  return n - Math.floor(n);
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    if (!this.ctx) throw new Error('Canvas 2D is unavailable');
    this.width = 0;
    this.height = 0;
    this.dpr = 1;
  }

  resize(width, height) {
    this.width = Math.max(1, Math.round(width));
    this.height = Math.max(1, Math.round(height));
    this.dpr = Math.min(2, Math.max(1, globalThis.devicePixelRatio || 1));
    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  draw(world, { dark = false, reducedMotion = false } = {}) {
    const { ctx } = this;
    const width = world.width || this.width;
    const height = world.height || this.height;
    if (width !== this.width || height !== this.height) this.resize(width, height);
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalAlpha = 1;
    const groundY = world.groundY ?? height - 22;
    const time = world.time || 0;
    this.ground(groundY, dark);
    if (world.skill) this.skill(world.skill, time, groundY, dark, reducedMotion, false);
    for (const monster of world.monsters || []) {
      this.monster(monster, time, groundY, dark, reducedMotion);
    }
    if (world.knight) this.knight(world.knight, time, groundY, dark, reducedMotion);
    this.particles(world.events || [], time, reducedMotion);
    if (world.skill) this.skill(world.skill, time, groundY, dark, reducedMotion, true);
    ctx.globalAlpha = 1;
  }

  rect(x, y, width, height, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.fillRect(snap(x), snap(y), Math.max(1, snap(width)), Math.max(1, snap(height)));
  }

  ground(y, dark) {
    const gy = snap(y);
    const width = this.width;
    this.rect(0, gy, width, this.height - gy, dark ? '#263044' : '#cfdbd5');
    this.rect(0, gy, width, 3, dark ? '#6b9b82' : '#65957b');
    this.rect(0, gy + 3, width, 3, dark ? '#354b48' : '#94b39c');
    this.rect(0, gy + 6, width, 2, dark ? '#202737' : '#b1c4b9');
    for (let x = 0, i = 0; x < width; x += 28, i += 1) {
      const variation = noise(12, i);
      if (variation > 0.36) {
        const tx = x + 5 + Math.floor(variation * 12);
        this.rect(tx, gy - 3, 2, 3, dark ? '#7aab85' : '#74a387');
        if (variation > 0.7) this.rect(tx + 3, gy - 5, 2, 5, dark ? '#92b888' : '#609a78');
      }
      const bx = x + Math.floor(noise(31, i) * 9);
      const by = gy + 11 + Math.floor(noise(26, i) * 7);
      this.rect(bx, by, 9 + Math.floor(variation * 10), 2, dark ? '#344055' : '#b2c5bd');
      if (i % 4 === 0) this.rect(bx + 2, by - 2, 5, 2, dark ? '#455067' : '#e1e8df');
    }
  }

  shadow(x, y, size, opacity, dark) {
    const { ctx } = this;
    ctx.save();
    ctx.globalAlpha = opacity;
    this.rect(x - size / 2 + 3, y - 2, size - 6, 5, dark ? '#030914' : '#304839');
    this.rect(x - size / 2, y, size, 2, dark ? '#030914' : '#304839');
    ctx.restore();
  }

  monster(monster, time, groundY, dark, reducedMotion) {
    const { ctx } = this;
    const grounded = monster.state === 'grounded';
    const phase = monster.phase || 0;
    const bounce = grounded && !reducedMotion ? Math.round(Math.sin(time * 5 + phase)) : 0;
    const footY = monster.y + bounce;
    const altitude = clamp(groundY - monster.y, 0, 400);
    this.shadow(monster.x, groundY, 24 - altitude / 40, 0.08 + 0.1 * (1 - altitude / 400), dark);
    ctx.save();
    ctx.translate(snap(monster.x), snap(footY));
    ctx.scale(2, 2);
    const r = (x, y, w, h, color) => this.rect(x, y, w, h, color);
    const kind = ((monster.kind || 0) % 3 + 3) % 3;
    if (kind === 0) {
      const outline = '#253f40';
      r(-5, -12, 10, 1, outline); r(-7, -10, 14, 8, outline);
      r(-6, -11, 12, 10, outline); r(-8, -5, 16, 4, outline);
      r(-6, -10, 12, 7, '#6dbf78'); r(-4, -11, 8, 2, '#8ed991');
      r(-7, -4, 14, 2, '#54a567'); r(-5, -2, 10, 1, '#478762');
      r(-5, -9, 2, 3, '#b3edaa'); r(-3, -10, 3, 1, '#b3edaa');
      r(-3, -7, 2, 3, '#203c3b'); r(3, -7, 2, 3, '#203c3b');
      r(-3, -7, 1, 1, '#efffe0'); r(3, -7, 1, 1, '#efffe0');
      r(0, -3, 2, 1, '#31504a'); r(-5, -4, 2, 1, '#94cf80');
      if (!grounded) { r(-5, -1, 2, 2, outline); r(4, -1, 2, 2, outline); }
    } else if (kind === 1) {
      const outline = '#352d4b';
      const wing = !reducedMotion && Math.sin(time * 12 + phase) > 0 ? -1 : 1;
      r(-8, -13, 2, 5, outline); r(6, -13, 2, 5, outline);
      r(-7, -13, 1, 3, '#e7bbd2'); r(6, -13, 1, 3, '#e7bbd2');
      r(-6, -11, 12, 9, outline); r(-5, -12, 10, 11, outline);
      r(-5, -10, 10, 7, '#a481c8'); r(-3, -11, 6, 2, '#c2a0e0');
      r(-6, -8, 2, 5, '#795b9f'); r(4, -8, 2, 5, '#795b9f');
      r(-9, -8 + wing, 3, 4, outline); r(7, -8 + wing, 3, 4, outline);
      r(-10, -9 + wing, 2, 2, outline); r(9, -9 + wing, 2, 2, outline);
      r(-8, -7 + wing, 2, 2, '#9471b6'); r(7, -7 + wing, 2, 2, '#9471b6');
      r(-4, -8, 3, 2, '#f4dfae'); r(2, -8, 3, 2, '#f4dfae');
      r(-2, -8, 1, 2, '#352d4b'); r(2, -8, 1, 2, '#352d4b');
      r(-1, -4, 3, 1, outline); r(-1, -4, 1, 2, '#fff2d4');
      r(-4, -1, 3, 1, outline); r(2, -1, 3, 1, outline);
    } else {
      const outline = '#62402c';
      r(-3, -15, 2, 3, outline); r(2, -14, 2, 3, outline);
      r(-2, -14, 2, 4, '#ffdc89'); r(-5, -12, 10, 3, outline);
      r(-7, -9, 14, 6, outline); r(-6, -11, 12, 9, outline);
      r(-5, -2, 10, 1, outline); r(-6, -8, 12, 5, '#e89b4b');
      r(-5, -10, 10, 5, '#f8b765'); r(-3, -11, 6, 2, '#ffd084');
      r(-5, -5, 10, 3, '#cd7943'); r(-5, -9, 2, 2, '#ffe2a0');
      r(-4, -7, 3, 3, '#513c34'); r(2, -7, 3, 3, '#513c34');
      r(-3, -7, 2, 1, '#fff3bf'); r(2, -7, 2, 1, '#fff3bf');
      r(0, -3, 2, 1, '#70472e'); r(-5, -1, 3, 1, outline); r(3, -1, 3, 1, outline);
    }
    ctx.restore();
  }

  knight(knight, time, groundY, dark, reducedMotion) {
    const { ctx } = this;
    const run = knight.state === 'run';
    const attack = knight.state === 'attack';
    const skill = knight.state === 'skill';
    const step = !reducedMotion && run ? Math.floor(time * 10) % 4 : 0;
    const bob = step === 1 || step === 3 ? -1 : 0;
    const idle = !reducedMotion && knight.state === 'idle' && Math.sin(time * 3) > 0.75 ? -1 : 0;
    this.shadow(knight.x, groundY, 35, dark ? 0.3 : 0.2, dark);
    ctx.save();
    ctx.translate(snap(knight.x), snap(groundY + bob + idle));
    ctx.scale((knight.facing || 1) * 2, 2);
    const r = (x, y, w, h, color) => this.rect(x, y, w, h, color);
    const line = '#243349';
    const cloak = '#a84958';
    const capeSwing = run ? (step < 2 ? -2 : 0) : 0;
    // The cape, plume and shield make the silhouette readable at a glance.
    r(-7 + capeSwing, -16, 5, 13, '#733d51');
    r(-8 + capeSwing, -13, 5, 10, cloak);
    r(-9 + capeSwing, -8, 5, 5, '#bc5b65');
    r(-8 + capeSwing, -3, 3, 1, line);
    const left = run && step < 2 ? -2 : 0;
    const right = run && step >= 2 ? 2 : 0;
    r(-4 + left, -5, 4, 4, line); r(1 + right, -5, 4, 4, line);
    r(-3 + left, -5, 2, 3, '#70879d'); r(2 + right, -5, 2, 3, '#8194aa');
    r(-5 + left, -2, 5, 2, '#263346'); r(1 + right, -2, 6, 2, '#263346');
    r(-4 + left, -2, 3, 1, '#a1b2bc'); r(3 + right, -2, 3, 1, '#a1b2bc');
    r(-5, -15, 11, 10, line); r(-4, -14, 9, 8, '#476079');
    r(-3, -14, 4, 6, '#637d96'); r(1, -13, 3, 6, '#334b65');
    r(-2, -12, 5, 1, '#9bb9c6'); r(-4, -7, 9, 2, '#26374a');
    r(0, -7, 2, 2, '#d9b277');
    r(-6, -16, 4, 4, '#a1b2bf'); r(4, -16, 4, 4, '#bac9cc');
    r(-6, -12, 3, 5, '#657d92'); r(6, -12, 3, 4, '#7e94a5');
    // Silver helm, black visor and one glint through the slit.
    r(-5, -25, 9, 1, line); r(-7, -23, 13, 9, line);
    r(-6, -24, 11, 10, line); r(-5, -24, 9, 2, '#bdcdd3');
    r(-6, -22, 11, 6, '#8da1b4'); r(-4, -23, 7, 5, '#d5e1df');
    r(-5, -22, 2, 4, '#f2f5df'); r(3, -22, 2, 6, '#9eafbd');
    r(-3, -20, 9, 4, '#28384c'); r(-3, -20, 8, 1, '#40556a');
    r(1, -19, 3, 1, '#b9f1e3'); r(0, -18, 2, 1, '#65958f');
    r(-5, -16, 10, 2, '#a8bac3'); r(-4, -15, 7, 1, '#d5e1df');
    r(-4, -27, 6, 2, '#a84958'); r(-6, -27, 3, 1, '#cd7e7a');
    r(-7, -26, 4, 2, '#733d51');
    // Kite shield with a tiny warm-metal cross.
    r(-9, -14, 6, 8, line); r(-8, -6, 4, 2, line); r(-7, -4, 2, 1, line);
    r(-8, -13, 4, 6, '#9db5c1'); r(-7, -12, 3, 6, '#3d607b');
    r(-7, -6, 2, 1, '#8ba4b6'); r(-6, -12, 1, 5, '#d6b77d'); r(-7, -10, 3, 1, '#d6b77d');
    const swing = attack ? clamp(1 - (knight.actionTime || 0) / 0.38, 0, 1) : 0;
    // Three hand-pixelled sword poses keep edges crisp through the swing.
    if (attack && swing > 0.25 && swing < 0.62) {
      for (let i = 0; i < 9; i += 1) {
        r(9 + i, -13 - i, 3, 3, line);
        r(9 + i, -13 - i, 1, 2, '#eef4e6');
        r(10 + i, -12 - i, 1, 1, '#9cbdc8');
      }
      r(7, -13, 4, 3, '#d6b77d'); r(7, -10, 2, 2, '#855a4d');
    } else if (attack && swing >= 0.62 && swing < 0.95) {
      r(10, -11, 13, 3, line); r(11, -11, 11, 1, '#eef4e6');
      r(11, -10, 10, 1, '#9cbdc8'); r(9, -13, 1, 7, '#d6b77d');
      r(6, -10, 3, 1, '#855a4d'); r(5, -11, 1, 3, '#c4a271');
    } else {
      const lift = skill ? -5 : run && step < 2 ? -1 : 0;
      r(7, -23 + lift, 3, 12, line); r(7, -22 + lift, 1, 10, '#eef4e6');
      r(8, -21 + lift, 1, 9, '#9cbdc8'); r(6, -12 + lift, 6, 1, '#d6b77d');
      r(8, -11 + lift, 1, 3, '#855a4d'); r(7, -8 + lift, 3, 1, '#c4a271');
    }
    if (attack) {
      const progress = clamp(1 - (knight.actionTime || 0) / 0.38, 0, 1);
      if (progress > 0.12 && progress < 0.8) {
        ctx.globalAlpha = Math.sin((progress - 0.12) / 0.68 * Math.PI) * 0.85;
        r(11, -23, 5, 2, '#e6eddc'); r(15, -21, 3, 3, '#9ecfc9');
        r(17, -18, 3, 7, '#e6f7dd'); r(15, -11, 4, 3, '#9ecfc9');
        r(11, -8, 5, 2, '#e6f7dd'); r(9, -6, 3, 1, '#9ecfc9');
      }
    }
    ctx.restore();
  }

  particles(events, time, reducedMotion) {
    const { ctx } = this;
    let budget = reducedMotion ? 28 : 160;
    for (let e = events.length - 1; e >= 0 && budget > 0; e -= 1) {
      const event = events[e];
      const age = time - event.at;
      const life = event.type === 'kill' ? 0.65 : event.type === 'land' ? 0.35 : 0.5;
      if (age < 0 || age > life || event.type === 'skill') continue;
      const progress = age / life;
      const count = Math.min(budget, reducedMotion ? 2 : event.type === 'kill' ? 8 : 5);
      budget -= count;
      const seed = event.x * 0.7 + event.at * 63 + event.y;
      const colors = event.type === 'land' ? ['#b2bb9c', '#839985', '#cfceb0'] :
        event.type === 'spawn' ? ['#d9bc7e', '#9ac9ba', '#ecdaaa'] :
          [['#78c487', '#c1e0a3', '#4c8c70'], ['#b193ce', '#ddbbe5', '#786093'], ['#e9ad62', '#ffe0a0', '#c8784b']][event.kind % 3 || 0];
      ctx.save();
      ctx.globalAlpha = (1 - progress) * 0.85;
      for (let i = 0; i < count; i += 1) {
        const angle = noise(seed, i) * TAU;
        const distance = event.type === 'land' ? 14 : 24;
        const dx = Math.cos(angle) * distance * progress;
        const dy = event.type === 'land' ? -Math.sin(progress * Math.PI) * (3 + noise(seed, i + 20) * 5) :
          Math.sin(angle) * distance * progress - progress * 12 + progress * progress * 22;
        const size = event.type === 'kill' && i % 3 === 0 ? 4 : 2;
        this.rect(event.x + dx, event.y + dy - (event.type === 'kill' ? 13 : 0), size, size, colors[i % colors.length]);
      }
      ctx.restore();
    }
  }

  skill(skill, time, groundY, dark, reducedMotion, foreground) {
    const { ctx } = this;
    const age = time - skill.startedAt;
    if (age < 0 || age > 1.1) return;
    const cx = skill.x;
    ctx.save();
    if (age < 0.5 && !foreground) {
      const p = age / 0.5;
      ctx.globalAlpha = 0.12 + p * 0.2;
      this.rect(cx - 20 - p * 8, groundY - 42, 40 + p * 16, 39, dark ? '#b9eacf' : '#8ec1ab');
      ctx.globalAlpha = 0.5 + p * 0.3;
      for (let i = 0; i < (reducedMotion ? 4 : 10); i += 1) {
        const theta = i * TAU / 10 + (reducedMotion ? 0 : age * 6);
        const radius = 35 * (1 - p) + 8;
        this.rect(cx + Math.cos(theta) * radius, groundY - 25 + Math.sin(theta) * radius * 0.7, 3, 3, '#dabc7d');
      }
      this.rect(cx - 20, groundY - 1, 40, 2, '#e4ca93');
    } else if (age >= 0.5 && foreground) {
      const p = (age - 0.5) / 0.6;
      const reach = Math.max(cx, this.width - cx) + 40;
      const radius = reach * Math.min(1, p * 1.7);
      ctx.globalAlpha = (1 - p) * (reducedMotion ? 0.32 : 0.72);
      this.rect(cx - radius, groundY - 7, radius * 2, 4, '#dabe80');
      this.rect(cx - radius, groundY - 13, radius * 2, 2, '#c6e0be');
      for (const direction of [-1, 1]) {
        const edge = cx + radius * direction;
        this.rect(edge - 3, groundY - 43, 6, 34, '#e7dfad');
        this.rect(edge - 7, groundY - 35, 14, 22, '#b4d7bf');
        this.rect(edge - 2, groundY - 49, 4, 6, '#e7dfad');
        if (!reducedMotion) {
          for (let i = 0; i < 6; i += 1) {
            this.rect(edge - direction * (9 + i * 12), groundY - 7 - noise(71, i) * 30, 4, 3, i % 2 ? '#e1c991' : '#a7c8ac');
          }
        }
      }
    }
    ctx.restore();
  }

  destroy() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }
}
