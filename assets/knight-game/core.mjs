// All durations are in seconds; positions and speeds use CSS pixels.
export const CONFIG = Object.freeze({
  spawnInterval: 0.45,
  maxMonsters: 20,
  skillThreshold: 10,
  skillLock: 4,
  skillWindup: 0.5,
  skillDuration: 1.1,
  attackInterval: 0.7,
  attackDuration: 0.38,
  attackHitAt: 0.16,
  attackRange: 43,
  knightSpeed: 145,
  gravity: 1450,
  groundHeight: 22,
});

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));

export class World {
  constructor(width, height, config = {}) {
    this.config = { ...CONFIG, ...config };
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.groundY = Math.max(0, this.height - this.config.groundHeight);
    this.time = 0;
    this.monsters = [];
    this.events = [];
    this.knight = { x: width * 0.35, facing: 1, state: 'idle', actionTime: 0 };
    this.skill = null;
    this.kills = 0;
    this.spawnLockedUntil = 0;
    this.lastSpawnAt = -Infinity;
    this.nextAttackAt = 0;
    this.nextId = 1;
    this.attackTarget = null;
  }

  get groundedCount() {
    return this.monsters.filter(monster => monster.state === 'grounded').length;
  }

  get cooldown() {
    return Math.max(0, this.spawnLockedUntil - this.time);
  }

  emit(type, x, y, kind = 0) {
    this.events.push({ type, x, y, kind, at: this.time });
  }

  spawn(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || this.cooldown > 0 ||
        this.skill || this.monsters.length >= this.config.maxMonsters ||
        this.time - this.lastSpawnAt + 1e-8 < this.config.spawnInterval) return false;
    const id = this.nextId++;
    const monster = {
      id,
      x: clamp(x, Math.min(18, this.width / 2), Math.max(this.width / 2, this.width - 18)),
      y: clamp(y + 14, 0, Math.max(0, this.groundY - 1)),
      vy: 0,
      state: 'falling',
      kind: (id - 1) % 3,
      phase: (id * 2.39996) % (Math.PI * 2),
      landedAt: -Infinity,
    };
    this.monsters.push(monster);
    this.lastSpawnAt = this.time;
    this.emit('spawn', monster.x, monster.y - 14, monster.kind);
    return true;
  }

  kill(monster) {
    const index = this.monsters.indexOf(monster);
    if (index < 0) return;
    this.monsters.splice(index, 1);
    this.kills++;
    this.emit('kill', monster.x, monster.y - 12, monster.kind);
  }

  startSkill() {
    this.skill = { startedAt: this.time, hit: false, x: this.knight.x };
    this.spawnLockedUntil = this.time + this.config.skillLock;
    this.attackTarget = null;
    this.knight.state = 'skill';
    this.knight.actionTime = this.config.skillDuration;
  }

  step(delta) {
    // Dropped frames cannot produce a giant physics jump. Paused pages don't call step.
    const dt = clamp(Number.isFinite(delta) ? delta : 0, 0, 0.05);
    if (dt === 0) return;
    this.time += dt;
    this.events = this.events.filter(event => this.time - event.at < 1.5);
    for (const monster of this.monsters) {
      if (monster.state !== 'falling') continue;
      monster.vy += this.config.gravity * dt;
      monster.y += monster.vy * dt;
      if (monster.y >= this.groundY) {
        monster.y = this.groundY;
        monster.vy = 0;
        monster.state = 'grounded';
        monster.landedAt = this.time;
        this.emit('land', monster.x, monster.y, monster.kind);
      }
    }

    if (!this.skill && this.groundedCount >= this.config.skillThreshold && this.cooldown === 0) {
      this.startSkill();
    }
    if (this.skill) {
      const elapsed = this.time - this.skill.startedAt;
      this.knight.actionTime = Math.max(0, this.config.skillDuration - elapsed);
      if (!this.skill.hit && elapsed + 1e-8 >= this.config.skillWindup) {
        this.skill.hit = true;
        for (const monster of [...this.monsters]) this.kill(monster);
        this.emit('skill', this.knight.x, this.groundY);
      }
      if (elapsed >= this.config.skillDuration) {
        this.skill = null;
        this.knight.state = 'idle';
      }
      return;
    }

    if (this.knight.state === 'attack') {
      this.knight.actionTime = Math.max(0, this.knight.actionTime - dt);
      const elapsed = this.config.attackDuration - this.knight.actionTime;
      if (this.attackTarget && elapsed + 1e-8 >= this.config.attackHitAt) {
        const target = this.monsters.find(monster => monster.id === this.attackTarget);
        if (target && target.state === 'grounded' &&
            Math.abs(target.x - this.knight.x) <= this.config.attackRange + 4) this.kill(target);
        this.attackTarget = null;
      }
      if (this.knight.actionTime === 0) this.knight.state = 'idle';
      return;
    }

    let target = null;
    let distance = Infinity;
    for (const monster of this.monsters) {
      const candidate = Math.abs(monster.x - this.knight.x);
      if (monster.state === 'grounded' && candidate < distance) {
        target = monster;
        distance = candidate;
      }
    }
    if (!target) {
      this.knight.state = 'idle';
      this.knight.actionTime = 0;
      return;
    }
    this.knight.facing = target.x >= this.knight.x ? 1 : -1;
    if (distance > this.config.attackRange) {
      this.knight.state = 'run';
      this.knight.x += this.knight.facing * Math.min(
        this.config.knightSpeed * dt, distance - this.config.attackRange,
      );
    } else if (this.time + 1e-8 >= this.nextAttackAt) {
      this.knight.state = 'attack';
      this.knight.actionTime = this.config.attackDuration;
      this.attackTarget = target.id;
      this.nextAttackAt = this.time + this.config.attackInterval;
    } else {
      this.knight.state = 'idle';
    }
  }

  resize(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height)) return;
    const oldWidth = this.width;
    const oldGround = this.groundY;
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.groundY = Math.max(0, this.height - this.config.groundHeight);
    const repositionX = x => clamp(x * this.width / oldWidth,
      Math.min(18, this.width / 2), Math.max(this.width / 2, this.width - 18));
    this.knight.x = repositionX(this.knight.x);
    for (const monster of this.monsters) {
      monster.x = repositionX(monster.x);
      monster.y = monster.state === 'grounded' ? this.groundY :
        clamp(monster.y * this.groundY / Math.max(1, oldGround), 0, this.groundY);
    }
    if (this.skill) this.skill.x = this.knight.x;
    this.events = [];
  }

  clear() {
    this.monsters = [];
    this.events = [];
    this.skill = null;
    this.spawnLockedUntil = this.time;
    this.lastSpawnAt = -Infinity;
    this.attackTarget = null;
    this.knight.state = 'idle';
    this.knight.actionTime = 0;
  }
}
