import test from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../assets/knight-game/core.mjs';

function advance(world, seconds) {
  const end = world.time + seconds;
  while (end - world.time > 1e-9) world.step(Math.min(0.01, end - world.time));
}

function almostEqual(actual, expected, message) {
  assert.ok(Math.abs(actual - expected) < 1e-7, message ?? `${actual} should equal ${expected}`);
}

test('default click interval rejects a burst and accepts the next click at 450 ms', () => {
  const world = new World(800, 1000, { gravity: 0 });
  assert.equal(world.spawn(100, 100), true);
  for (let i = 0; i < 100; i++) assert.equal(world.spawn(100, 100), false);
  advance(world, 0.449);
  assert.equal(world.spawn(100, 100), false);
  advance(world, 0.001);
  assert.equal(world.spawn(100, 100), true, 'a rejected click must not reset the interval');
  advance(world, 1);
  assert.equal(world.monsters.length, 2, 'rejected clicks must never be queued');
});

test('the default 20-monster cap includes monsters still falling', () => {
  const world = new World(800, 1000, { gravity: 0 });
  for (let i = 0; i < 20; i++) {
    assert.equal(world.spawn(30 + i * 20, 50), true);
    advance(world, 0.45);
  }
  assert.equal(world.groundedCount, 0);
  assert.equal(world.spawn(500, 50), false);
  advance(world, 1);
  assert.equal(world.monsters.length, 20);
});

test('a monster falls, lands once, and stops vertically at the ground', () => {
  const world = new World(800, 400, { knightSpeed: 0 });
  world.spawn(700, 250);
  const monster = world.monsters[0];
  const startY = monster.y;
  advance(world, 0.1);
  assert.equal(monster.state, 'falling');
  assert.ok(monster.y > startY);
  advance(world, 0.5);
  assert.equal(monster.state, 'grounded');
  assert.equal(monster.y, world.groundY);
  assert.equal(monster.vy, 0);
  assert.equal(world.groundedCount, 1);
  assert.equal(world.events.filter(event => event.type === 'land').length, 1);
  advance(world, 0.2);
  assert.equal(monster.y, world.groundY);
  assert.equal(world.events.filter(event => event.type === 'land').length, 1);
});

test('the knight ignores an airborne neighbour and pursues a farther grounded monster', () => {
  const world = new World(1000, 10000, { spawnInterval: 0 });
  const initialX = world.knight.x;
  world.spawn(initialX - 5, 20);
  advance(world, 0.1);
  assert.equal(world.knight.state, 'idle');
  assert.equal(world.knight.x, initialX);
  world.spawn(initialX + 250, world.groundY);
  advance(world, 0.1);
  assert.equal(world.monsters[0].state, 'falling');
  assert.equal(world.monsters[1].state, 'grounded');
  assert.equal(world.knight.state, 'run');
  assert.equal(world.knight.facing, 1);
  assert.ok(world.knight.x > initialX);
  assert.equal(world.kills, 0);
});

test('an ordinary sword swing kills exactly one target, then respects the attack interval', () => {
  const world = new World(800, 400, { spawnInterval: 0 });
  world.spawn(world.knight.x, world.groundY);
  world.spawn(world.knight.x + 10, world.groundY);
  advance(world, 0.05);
  assert.equal(world.knight.state, 'attack');
  assert.equal(world.kills, 0, 'starting a swing must not cause an immediate kill');
  advance(world, 0.2);
  assert.equal(world.kills, 1);
  assert.equal(world.monsters.length, 1);
  advance(world, 0.4);
  assert.equal(world.kills, 1, 'one animation cannot hit twice or bypass the 0.7 s interval');
  advance(world, 0.3);
  assert.equal(world.kills, 2);
  assert.equal(world.monsters.length, 0);
  assert.equal(world.events.filter(event => event.type === 'kill').length, 2);
  advance(world, 1);
  assert.equal(world.kills, 2);
  assert.equal(world.knight.state, 'idle');
});

test('nine landed monsters do not trigger the default skill threshold', () => {
  const world = new World(1000, 2000, { spawnInterval: 0, knightSpeed: 0 });
  for (let i = 0; i < 9; i++) world.spawn(800 + i, world.groundY);
  advance(world, 0.2);
  assert.equal(world.groundedCount, 9);
  assert.equal(world.skill, null);
  assert.equal(world.cooldown, 0);
});

test('ten landed monsters trigger one skill, clear airborne monsters, and lock spawning for four seconds', () => {
  const world = new World(1000, 2000, { spawnInterval: 0, knightSpeed: 0 });
  for (let i = 0; i < 10; i++) world.spawn(800 + i, world.groundY);
  world.spawn(100, 20);
  advance(world, 0.05);
  assert.equal(world.groundedCount, 10);
  assert.equal(world.monsters[10].state, 'falling');
  assert.ok(world.skill);
  assert.equal(world.knight.state, 'skill');
  const skillStart = world.skill.startedAt;
  almostEqual(world.spawnLockedUntil, skillStart + 4);
  assert.equal(world.kills, 0, 'skill must retain its windup');
  assert.equal(world.spawn(100, 20), false);
  advance(world, skillStart + 0.49 - world.time);
  assert.equal(world.monsters.length, 11);
  advance(world, 0.02);
  assert.equal(world.monsters.length, 0, 'clear must include the airborne monster');
  assert.equal(world.kills, 11);
  assert.equal(world.events.filter(event => event.type === 'skill').length, 1);
  for (let i = 0; i < 20; i++) assert.equal(world.spawn(100, 20), false);
  advance(world, 0.8);
  assert.equal(world.skill, null);
  assert.equal(world.knight.state, 'idle');
  assert.equal(world.kills, 11, 'skill must not run its hit more than once');
  assert.equal(world.spawn(100, 20), false, 'the lock outlasts the visual effect');
  advance(world, skillStart + 3.99 - world.time);
  assert.ok(world.cooldown > 0);
  assert.equal(world.spawn(100, 20), false);
  advance(world, 0.011);
  assert.equal(world.cooldown, 0);
  assert.equal(world.monsters.length, 0, 'cooldown expiry must not replay rejected clicks');
  assert.equal(world.spawn(100, 20), true);
  assert.equal(world.monsters.length, 1);
});

test('resize keeps grounded and airborne actors inside normal and tiny viewports', () => {
  const world = new World(1000, 2000, { spawnInterval: 0, knightSpeed: 0 });
  world.spawn(980, world.groundY);
  world.spawn(-100, 100);
  advance(world, 0.05);
  const landed = world.monsters[0];
  const falling = world.monsters[1];
  world.resize(320, 480);
  assert.equal(world.groundY, 458);
  assert.equal(landed.y, world.groundY);
  assert.equal(falling.state, 'falling');
  assert.ok(falling.y >= 0 && falling.y <= world.groundY);
  for (const actor of [world.knight, ...world.monsters]) {
    assert.ok(actor.x >= 18 && actor.x <= 302);
  }
  assert.equal(world.events.length, 0);
  world.resize(1, 1);
  assert.equal(world.groundY, 0);
  for (const actor of [world.knight, ...world.monsters]) almostEqual(actor.x, 0.5);
  for (const monster of world.monsters) assert.equal(monster.y, 0);
  advance(world, 0.05);
  assert.ok(Number.isFinite(world.knight.x));
  assert.equal(world.groundedCount, 2);
});

test('invalid coordinates and frame deltas do not corrupt the world', () => {
  const world = new World(800, 400);
  assert.equal(world.spawn(NaN, 100), false);
  assert.equal(world.spawn(100, Infinity), false);
  world.step(NaN);
  world.step(-1);
  assert.equal(world.time, 0);
  world.resize(NaN, 300);
  assert.equal(world.width, 800);
  assert.equal(world.height, 400);
  world.spawn(100, 0);
  world.step(100);
  assert.ok(world.time <= 0.05, 'a stalled frame must not advance simulation by many seconds');
  assert.equal(world.monsters[0].state, 'falling');
});

test('clear resets an in-progress attack and permits an immediate fresh spawn', () => {
  const world = new World(800, 400);
  world.spawn(world.knight.x, world.groundY);
  advance(world, 0.05);
  assert.equal(world.knight.state, 'attack');
  world.clear();
  assert.equal(world.monsters.length, 0);
  assert.equal(world.events.length, 0);
  assert.equal(world.attackTarget, null);
  assert.equal(world.knight.state, 'idle');
  assert.equal(world.knight.actionTime, 0);
  assert.equal(world.spawn(700, 20), true);
  advance(world, 0.2);
  assert.equal(world.kills, 0, 'cleared attack must not damage an old or replacement target');
});

test('clear cancels a skill and its spawn lock without delayed effects', () => {
  const world = new World(1000, 2000, { spawnInterval: 0, knightSpeed: 0 });
  for (let i = 0; i < 10; i++) world.spawn(800, world.groundY);
  advance(world, 0.05);
  assert.ok(world.skill);
  assert.ok(world.cooldown > 0);
  world.clear();
  assert.equal(world.skill, null);
  assert.equal(world.cooldown, 0);
  assert.equal(world.knight.state, 'idle');
  assert.equal(world.monsters.length, 0);
  assert.equal(world.events.length, 0);
  assert.equal(world.spawn(800, 20), true);
  advance(world, 1.2);
  assert.equal(world.monsters.length, 1);
  assert.equal(world.kills, 0);
  assert.equal(world.events.some(event => event.type === 'skill'), false);
});
