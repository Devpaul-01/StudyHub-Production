/**
 * Message Long-Press / Right-Click System — PRODUCTION
 *
 * Attaches to the #messages-list container.
 * Triggers message options on:
 *   • Mobile: long-press (500 ms, cancels if finger moves > 12 px)
 *   • Desktop: right-click (contextmenu)
 *
 * Protected: deleted messages never trigger the menu.
 * The menu is opened via message.modals.openMessageOptionsModal().
 */

import { LONG_PRESS_DURATION, LONG_PRESS_MOVE_THRESHOLD } from './message.constants.js';

// Lazy import to avoid circular dependency
async function _openOptions(messageId, isOwn, sentAt) {
  const { openMessageOptionsModal } = await import('./message.modals.js');
  openMessageOptionsModal(messageId, isOwn, sentAt);
}

// ============================================================================
// PUBLIC: ATTACH / DETACH
// ============================================================================

let _attached = false;
const _listeners = [];

export function attachMessageLongPress(container) {
  if (!container) return;
  if (_attached) detachMessageLongPress(container);

  const onTouch    = _makeTouchHandler();
  const onMouse    = _makeMouseHandler();
  const onContext  = _makeContextMenuHandler();

  container.addEventListener('touchstart',   onTouch.start,  { passive: true });
  container.addEventListener('touchend',     onTouch.end,    { passive: true });
  container.addEventListener('touchcancel',  onTouch.cancel, { passive: true });
  container.addEventListener('touchmove',    onTouch.move,   { passive: true });

  container.addEventListener('mousedown',    onMouse.down);
  container.addEventListener('mouseup',      onMouse.up);
  container.addEventListener('mousemove',    onMouse.move);

  container.addEventListener('contextmenu',  onContext);

  _listeners.push(
    { el: container, type: 'touchstart',  fn: onTouch.start  },
    { el: container, type: 'touchend',    fn: onTouch.end    },
    { el: container, type: 'touchcancel', fn: onTouch.cancel },
    { el: container, type: 'touchmove',   fn: onTouch.move   },
    { el: container, type: 'mousedown',   fn: onMouse.down   },
    { el: container, type: 'mouseup',     fn: onMouse.up     },
    { el: container, type: 'mousemove',   fn: onMouse.move   },
    { el: container, type: 'contextmenu', fn: onContext       },
  );

  _attached = true;
}

export function detachMessageLongPress() {
  _listeners.forEach(({ el, type, fn }) => el.removeEventListener(type, fn));
  _listeners.length = 0;
  _attached = false;
}

// ============================================================================
// PRIVATE: SHARED STATE
// ============================================================================

let _timer      = null;
let _startX     = 0;
let _startY     = 0;
let _cancelled  = false;

function _resolveMessageEl(target) {
  return target.closest('[data-message-id]');
}

function _isEligible(msgEl) {
  if (!msgEl) return false;
  // Deleted messages must not show options
  if (msgEl.dataset.isDeleted === 'true') return false;
  const messageId = parseInt(msgEl.dataset.messageId, 10);
  if (!messageId) return false;
  return true;
}

function _trigger(msgEl) {
  const messageId = parseInt(msgEl.dataset.messageId, 10);
  const isOwn     = msgEl.dataset.isOwn === 'true';
  const sentAt    = msgEl.dataset.sentAt || null;

  // Brief haptic feedback on supported devices
  if (navigator.vibrate) navigator.vibrate(30);

  _openOptions(messageId, isOwn, sentAt);
}

// ============================================================================
// PRIVATE: TOUCH HANDLER
// ============================================================================

function _makeTouchHandler() {
  return {
    start(e) {
      const msgEl = _resolveMessageEl(e.target);
      if (!_isEligible(msgEl)) return;

      _cancelled = false;
      const touch = e.touches[0];
      _startX = touch.clientX;
      _startY = touch.clientY;

      _timer = setTimeout(() => {
        if (!_cancelled) _trigger(msgEl);
      }, LONG_PRESS_DURATION);
    },

    end() {
      clearTimeout(_timer);
      _timer = null;
    },

    cancel() {
      _cancelled = true;
      clearTimeout(_timer);
      _timer = null;
    },

    move(e) {
      if (!_timer) return;
      const touch = e.touches[0];
      if (
        Math.abs(touch.clientX - _startX) > LONG_PRESS_MOVE_THRESHOLD ||
        Math.abs(touch.clientY - _startY) > LONG_PRESS_MOVE_THRESHOLD
      ) {
        _cancelled = true;
        clearTimeout(_timer);
        _timer = null;
      }
    },
  };
}

// ============================================================================
// PRIVATE: MOUSE HANDLER  (desktop long-press)
// ============================================================================

function _makeMouseHandler() {
  return {
    down(e) {
      // Only primary button
      if (e.button !== 0) return;

      const msgEl = _resolveMessageEl(e.target);
      if (!_isEligible(msgEl)) return;

      _cancelled = false;
      _startX = e.clientX;
      _startY = e.clientY;

      _timer = setTimeout(() => {
        if (!_cancelled) _trigger(msgEl);
      }, LONG_PRESS_DURATION);
    },

    up() {
      clearTimeout(_timer);
      _timer = null;
    },

    move(e) {
      if (!_timer) return;
      if (
        Math.abs(e.clientX - _startX) > LONG_PRESS_MOVE_THRESHOLD ||
        Math.abs(e.clientY - _startY) > LONG_PRESS_MOVE_THRESHOLD
      ) {
        _cancelled = true;
        clearTimeout(_timer);
        _timer = null;
      }
    },
  };
}

// ============================================================================
// PRIVATE: RIGHT-CLICK  (desktop)
// ============================================================================

function _makeContextMenuHandler() {
  return function onContext(e) {
    const msgEl = _resolveMessageEl(e.target);
    if (!_isEligible(msgEl)) return;

    e.preventDefault(); // suppress browser context menu
    clearTimeout(_timer);
    _timer = null;
    _trigger(msgEl);
  };
}
