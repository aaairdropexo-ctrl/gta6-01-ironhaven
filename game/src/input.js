// IRONHAVEN — input. Keyboard drives, mouse aims, one-shot presses are queued
// as flags and taken once by the loop, so a press between two frames is never
// lost and never counted twice. Pointer lock is requested on the canvas when
// the player aims; releasing it never stops the game.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_RELOAD = 8;

const FORWARD = new Set(['KeyW', 'ArrowUp']);
const BACK = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);
const SPRINT = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const RELOAD = new Set(['KeyR']);
const AIM = new Set(['KeyQ']);

export function createInputState(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0, mouseDY = 0;
  let mouseDown = false;
  let pointerLocked = false;
  let aimHeld = false;

  function onKeyDown(event) {
    if (FORWARD.has(event.code) || BACK.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || SPRINT.has(event.code)) {
      keys.add(event.code);
      event.preventDefault();
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (RELOAD.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RELOAD;
    } else if (AIM.has(event.code)) {
      aimHeld = true;
    }
  }
  function onKeyUp(event) {
    keys.delete(event.code);
    if (AIM.has(event.code)) aimHeld = false;
  }
  function onMouseMove(event) {
    if (pointerLocked) { mouseDX += event.movementX; mouseDY += event.movementY; }
  }
  function onMouseDown(event) {
    if (event.button === 0) mouseDown = true;
    if (event.button === 2) aimHeld = true;
  }
  function onMouseUp(event) {
    if (event.button === 0) mouseDown = false;
    if (event.button === 2) aimHeld = false;
  }
  function onBlur() {
    keys.clear(); mouseDown = false; aimHeld = false;
  }
  function onLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  document.addEventListener('pointerlockchange', onLockChange);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    /** -1..1 forward/back and strafe, from held keys. */
    move() {
      let forward = 0, strafe = 0;
      for (const k of keys) {
        if (FORWARD.has(k)) forward += 1;
        if (BACK.has(k)) forward -= 1;
        if (LEFT.has(k)) strafe -= 1;
        if (RIGHT.has(k)) strafe += 1;
      }
      return { forward: Math.max(-1, Math.min(1, forward)), strafe: Math.max(-1, Math.min(1, strafe)), sprint: [...keys].some((k) => SPRINT.has(k)) };
    },
    // aiming is true while Q or the right mouse is held — and also while
    // the left mouse is held, so firing always aims: the crosshair is
    // only ever shown over a target, never over open ground.
    aiming() { return aimHeld || mouseDown; },
    firing() { return mouseDown; },
    takeMouse() { const d = { dx: mouseDX, dy: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    takeActions() { const taken = actions; actions = 0; return taken; },
    requestLock() { if (!pointerLocked) canvas.requestPointerLock?.(); },
    locked() { return pointerLocked; },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('pointerlockchange', onLockChange);
    },
  };
}
