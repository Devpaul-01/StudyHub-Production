/**
 * thread.swipe.js
 * Swipe-right-to-reply gesture for touch devices.
 * Desktop: quick-reply (↩) button shown on hover via CSS in threads.html.
 *
 * Architecture:
 *  - Completely self-contained; dispatches a custom event to thread.events.js
 *    via handleReply() to avoid circular imports.
 *  - Does NOT import from thread.delegation.js.
 */

import { THREAD_UI } from './thread.constants.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATION  = THREAD_UI.LONG_PRESS_DURATION_MS;   // reuse threshold constant
const THRESHOLD = 60;   // px rightward swipe to trigger reply
const MAX_VERT  = 20;   // cancel if vertical drift exceeds this
const MAX_SHIFT = 50;   // max visual bubble translation in px

// ─── Module state ─────────────────────────────────────────────────────────────

let _listEl      = null;
let _swipeEl     = null;
let _startX      = 0;
let _startY      = 0;
let _deltaX      = 0;
let _cancelled   = false;


// ─── Public: attach / detach ──────────────────────────────────────────────────

export function attachThreadSwipe(listEl) {
  if (_listEl === listEl) return;
  detachThreadSwipe();
  _listEl = listEl;
  _listEl.addEventListener('touchstart',  _onStart,  { passive: true });
  _listEl.addEventListener('touchmove',   _onMove,   { passive: false });
  _listEl.addEventListener('touchend',    _onEnd,    { passive: true });
  _listEl.addEventListener('touchcancel', _onCancel, { passive: true });
}

export function detachThreadSwipe() {
  if (!_listEl) return;
  _listEl.removeEventListener('touchstart',  _onStart);
  _listEl.removeEventListener('touchmove',   _onMove);
  _listEl.removeEventListener('touchend',    _onEnd);
  _listEl.removeEventListener('touchcancel', _onCancel);
  _listEl = null;
  _reset();
}


// ─── Touch handlers ───────────────────────────────────────────────────────────

function _onStart(e) {
  const msgEl = e.target.closest('[data-message-id]');
  if (!msgEl || msgEl.classList.contains('message-deleted')) return;

  _swipeEl   = msgEl;
  _startX    = e.touches[0].clientX;
  _startY    = e.touches[0].clientY;
  _deltaX    = 0;
  _cancelled = false;
}

function _onMove(e) {
  if (!_swipeEl || _cancelled) return;

  const dx = e.touches[0].clientX - _startX;
  const dy = Math.abs(e.touches[0].clientY - _startY);

  // Cancel on excessive vertical movement or leftward swipe
  if (dy > MAX_VERT || dx < 0) { _doCancel(); return; }
  if (dx < 5) return;

  _deltaX = dx;

  const shift = Math.min(dx * 0.6, MAX_SHIFT);
  const bubble = _swipeEl.querySelector('.msg-bubble-col');
  if (bubble) {
    bubble.style.transform  = `translateX(${shift}px)`;
    bubble.style.transition = 'none';
  }

  // Show hint icon when close to threshold
  if (dx > THRESHOLD * 0.65) _showHint(_swipeEl);

  // Prevent scroll while horizontal swiping
  if (dx > 15) e.preventDefault();
}

function _onEnd() {
  if (!_swipeEl || _cancelled) return;

  const triggered = _deltaX >= THRESHOLD;
  _resetEl(_swipeEl, triggered);

  if (triggered) {
    const messageId = Number(_swipeEl.dataset.messageId);
    if (messageId) {
      try { navigator.vibrate?.(15); } catch { /* ignore */ }
      import('./thread.events.js').then(({ handleReply }) => handleReply(messageId));
    }
  }
  _swipeEl = null;
}

function _onCancel() { _doCancel(); }

function _doCancel() {
  _cancelled = true;
  if (_swipeEl) _resetEl(_swipeEl, false);
  _swipeEl = null;
}


// ─── Visual helpers ───────────────────────────────────────────────────────────

function _resetEl(el, triggered) {
  const bubble = el?.querySelector('.msg-bubble-col');
  if (bubble) {
    bubble.style.transition = 'transform 0.2s ease-out';
    bubble.style.transform  = 'translateX(0)';
    setTimeout(() => { if (bubble) bubble.style.transition = ''; }, 220);
  }
  _removeHint(el);
  if (triggered) el?.classList.add('swipe-flash');
  setTimeout(() => el?.classList.remove('swipe-flash'), 350);
}

function _showHint(el) {
  if (el.querySelector('.swipe-reply-hint')) return;
  const hint = document.createElement('div');
  hint.className =
    'swipe-reply-hint absolute left-1 top-1/2 -translate-y-1/2 ' +
    'w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 ' +
    'flex items-center justify-center text-sm z-10 pointer-events-none';
  hint.setAttribute('aria-hidden', 'true');
  hint.textContent = '↩';
  el.style.position = 'relative';
  el.appendChild(hint);
}

function _removeHint(el) {
  el?.querySelector('.swipe-reply-hint')?.remove();
}

function _reset() {
  _swipeEl   = null;
  _startX    = 0;
  _startY    = 0;
  _deltaX    = 0;
  _cancelled = false;
}
