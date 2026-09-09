import { World } from './core.mjs';
import { Renderer } from './renderer.mjs';

const root = document.querySelector('#homepage-guard');
const canvas = root.querySelector('canvas');
const toggle = root.querySelector('.guard-toggle');
const hint = root.querySelector('.guard-hint');
const count = root.querySelector('.guard-count');
const charge = root.querySelector('.guard-charge');
const announcement = root.querySelector('.guard-announcement');
const hud = root.querySelector('.guard-hud');
const darkMode = matchMedia('(prefers-color-scheme: dark)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const storageKey = 'homepage-knight-enabled';
const editable = 'input, textarea, select, [contenteditable]:not([contenteditable="false"])';
const excluded = `a, button, ${editable}, label, summary, [role="button"], [role="link"],
  [role="slider"], [tabindex], audio, video, iframe, img, svg, canvas,
  .card, .avatar, #homepage-guard, [data-no-monsters]`;
const listeners = new AbortController();
const world = new World(innerWidth, innerHeight);
const renderer = new Renderer(canvas);
let enabled = true;
let suspended = false;
let destroyed = false;
let windowFocused = document.hasFocus();
let frame = 0;
let previousTime = null;
let gesture = null;
let previousHud = '';
let wasCooling = false;
let wasAtCapacity = false;

try { enabled = localStorage.getItem(storageKey) !== 'false'; } catch { /* Storage may be disabled. */ }

function listen(target, name, handler, options = {}) {
  target.addEventListener(name, handler, { ...options, signal: listeners.signal });
}

function announce(message) {
  announcement.textContent = message;
}

function draw() {
  renderer.draw(world, { dark: darkMode.matches, reducedMotion: reducedMotion.matches });
}

function updateHud() {
  const cooling = world.cooldown > 0;
  const atCapacity = world.monsters.length >= world.config.maxMonsters;
  const remaining = Math.ceil(world.cooldown);
  const status = cooling ? `清场中 · ${remaining} 秒后可召唤` : atCapacity ?
    '小怪满员，等骑士清理一下' : '点击空白处，召唤小怪';
  const key = `${enabled}:${world.groundedCount}:${status}`;
  if (key !== previousHud) {
    previousHud = key;
    count.textContent = `${world.groundedCount} / ${world.config.skillThreshold}`;
    hint.textContent = status;
    charge.style.setProperty('--charge', `${cooling ? 100 : Math.min(100,
      world.groundedCount / world.config.skillThreshold * 100)}%`);
    root.dataset.cooling = String(cooling);
    root.dataset.enabled = String(enabled);
    toggle.textContent = enabled ? '收起' : '开启守卫';
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.setAttribute('aria-label', enabled ? '关闭像素小游戏' : '开启像素小游戏');
  }
  if (enabled && cooling && !wasCooling) announce('骑士释放清场技能，四秒后可以继续召唤。');
  if (enabled && !cooling && wasCooling) announce('清场结束，可以继续点击空白处召唤小怪。');
  if (enabled && atCapacity && !wasAtCapacity) announce('小怪已满，请等骑士清理。');
  wasCooling = cooling;
  wasAtCapacity = atCapacity;
}

function stop() {
  cancelAnimationFrame(frame);
  frame = 0;
  previousTime = null;
}

function tick(timestamp) {
  frame = 0;
  if (!enabled || suspended || document.hidden || !windowFocused || destroyed) return;
  if (previousTime !== null) world.step((timestamp - previousTime) / 1000);
  previousTime = timestamp;
  draw();
  updateHud();
  frame = requestAnimationFrame(tick);
}

function resume() {
  if (enabled && !suspended && !document.hidden && windowFocused && !destroyed && !frame) {
    previousTime = null;
    frame = requestAnimationFrame(tick);
  }
}

function resize() {
  const width = document.documentElement.clientWidth;
  const height = innerHeight;
  world.resize(width, height);
  renderer.resize(width, height);
  if (enabled && !suspended) draw();
}

function updateSuspension() {
  const focused = document.activeElement;
  suspended = Boolean(focused?.matches(editable)) ||
    Boolean(window.visualViewport && window.visualViewport.height < innerHeight * 0.72);
  root.dataset.suspended = String(suspended);
  if (suspended || document.hidden) { gesture = null; stop(); } else resume();
}

// Text glyphs are not blank space, even if their element fills a much larger box.
function hitsText(x, y) {
  let node;
  let offset;
  if (document.caretPositionFromPoint) {
    const caret = document.caretPositionFromPoint(x, y);
    node = caret?.offsetNode;
    offset = caret?.offset;
  } else if (document.caretRangeFromPoint) {
    const caret = document.caretRangeFromPoint(x, y);
    node = caret?.startContainer;
    offset = caret?.startOffset;
  }
  if (node?.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return false;
  const range = document.createRange();
  range.setStart(node, Math.max(0, offset - 1));
  range.setEnd(node, Math.min(node.length, offset + 1));
  return [...range.getClientRects()].some(rect =>
    x >= rect.left - 2 && x <= rect.right + 2 && y >= rect.top && y <= rect.bottom);
}

function hitsHud(x, y) {
  const rect = hud.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

listen(document, 'pointerdown', event => {
  gesture = null;
  if (!enabled || suspended || !event.isPrimary || event.button !== 0 ||
      !(event.target instanceof Element) || event.target.closest(excluded) ||
      hitsHud(event.clientX, event.clientY)) return;
  gesture = {
    id: event.pointerId, x: event.clientX, y: event.clientY,
    scrollX, scrollY, at: performance.now(), moved: false,
  };
}, { passive: true });

listen(document, 'pointermove', event => {
  if (gesture && gesture.id === event.pointerId &&
      Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) gesture.moved = true;
}, { passive: true });
listen(document, 'pointercancel', () => { gesture = null; }, { passive: true });
listen(window, 'scroll', () => { if (gesture) gesture.moved = true; }, { passive: true });
listen(document, 'contextmenu', () => { gesture = null; }, { passive: true });

// Native click follows pointerup and text selection; no preventDefault or pointer capture.
listen(document, 'click', event => {
  const tap = gesture;
  gesture = null;
  if (!tap || !enabled || suspended || event.defaultPrevented || event.detail === 0 ||
      tap.moved || performance.now() - tap.at > 550 ||
      Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > 8 ||
      Math.abs(scrollX - tap.scrollX) + Math.abs(scrollY - tap.scrollY) > 2 ||
      !(event.target instanceof Element) || event.target.closest(excluded) ||
      !window.getSelection()?.isCollapsed || hitsHud(event.clientX, event.clientY) ||
      hitsText(event.clientX, event.clientY)) return;
  if (world.spawn(event.clientX, event.clientY)) updateHud();
}, { passive: true });

listen(toggle, 'click', () => {
  enabled = !enabled;
  gesture = null;
  if (!enabled) { world.clear(); stop(); } else { resize(); resume(); }
  try { localStorage.setItem(storageKey, String(enabled)); } catch { /* Optional preference only. */ }
  updateHud();
  announce(enabled ? '像素小游戏已开启，点击网页空白处召唤小怪。' : '像素小游戏已关闭。');
});
listen(window, 'resize', () => { resize(); updateSuspension(); }, { passive: true });
listen(document, 'visibilitychange', updateSuspension);
listen(window, 'blur', () => { windowFocused = false; gesture = null; stop(); });
listen(window, 'focus', () => { windowFocused = true; updateSuspension(); });
listen(document, 'focusin', updateSuspension);
listen(document, 'focusout', () => queueMicrotask(updateSuspension));
listen(darkMode, 'change', () => { if (enabled) draw(); });
listen(reducedMotion, 'change', () => { if (enabled) draw(); });
if (window.visualViewport) listen(window.visualViewport, 'resize', updateSuspension, { passive: true });
listen(window, 'pagehide', event => { if (event.persisted) stop(); else destroy(); });
listen(window, 'pageshow', updateSuspension);

export function getSnapshot() {
  return {
    enabled, suspended, time: world.time, alive: world.monsters.length,
    grounded: world.groundedCount, kills: world.kills, cooldown: world.cooldown,
    knight: { ...world.knight },
    monsters: world.monsters.map(monster => ({ ...monster })),
  };
}

export function destroy() {
  destroyed = true;
  stop();
  listeners.abort();
  world.clear();
  renderer.destroy?.();
  root.hidden = true;
}

resize();
updateHud();
root.hidden = false;
updateSuspension();
