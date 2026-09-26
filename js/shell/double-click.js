// We detect double-clicks ourselves, so it works the same
// with a mouse and with a finger on a phone.

const DOUBLE_CLICK_MS = 450;

let lastTarget = null;
let lastTime = 0;

// Call this on every click. Returns true when this click is the
// second quick click on the same thing.
export function isDoubleClick(target) {
  const now = Date.now();
  const result = target === lastTarget && now - lastTime < DOUBLE_CLICK_MS;

  // After a double-click, the next click starts counting afresh
  lastTarget = result ? null : target;
  lastTime = now;
  return result;
}
