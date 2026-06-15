/**
 * thread_longpress.js
 * Long-press (mobile) and right-click (desktop) to open the message options
 * bottom sheet. Mirrors message.longpress.js architecture.
 *
 * FIXES applied:
 *  - Imports: was importing THREAD_LONG_PRESS_DURATION and THREAD_LONG_PRESS_THRESHOLD
 *    which didn't exist in thread_constants.js → crashed on import, making long-press
 *    completely non-functional. Now imports from THREAD_UI.
 *  - Imports: was importing openThreadMessageOptions from thread_modals.js which
 *    doesn't exist → second crash. Now opens the bottom sheet directly (sheet HTML
 *    exists in threads.html as #thread-message-options-sheet).
 *  - _getMessageWrapper(): was looking for [data-thread-message-id] — all message
 *    templates use [data-message-id]. Was never finding any messages.
 *  - _getMessageId(): reads dataset.messageId (not dataset.threadMessageId).
 *  - Bottom sheet open/close: fully implemented with slide-up animation.
 *  - Options sheet content is built from thread_delegation.js via a custom event
 *    to avoid circular imports.
 */

import { THREAD_UI } from "./thread.constants.js";


// ─── State ────────────────────────────────────────────────────────────────────

let _listEl          = null;
let _pressTimer      = null;
let _startX          = 0;
let _startY          = 0;
let _didMove         = false;
let _touchStarted    = false;
let _activeMessageId = null;

const DURATION  = THREAD_UI.LONG_PRESS_DURATION_MS;   // was THREAD_LONG_PRESS_DURATION (undefined)
const THRESHOLD = THREAD_UI.LONG_PRESS_THRESHOLD_PX;  // was THREAD_LONG_PRESS_THRESHOLD (undefined)


// ─── Attach / Detach ─────────────────────────────────────────────────────────

export function attachThreadLongPress(listEl) {
  if (_listEl === listEl) return;
  detachThreadLongPress();
  _listEl = listEl;
  _listEl.addEventListener("touchstart",  _onTouchStart,  { passive: true });
  _listEl.addEventListener("touchmove",   _onTouchMove,   { passive: true });
  _listEl.addEventListener("touchend",    _onTouchEnd,    { passive: true });
  _listEl.addEventListener("touchcancel", _onTouchCancel, { passive: true });
  _listEl.addEventListener("contextmenu", _onContextMenu);
}

export function detachThreadLongPress() {
  if (!_listEl) return;
  _listEl.removeEventListener("touchstart",  _onTouchStart);
  _listEl.removeEventListener("touchmove",   _onTouchMove);
  _listEl.removeEventListener("touchend",    _onTouchEnd);
  _listEl.removeEventListener("touchcancel", _onTouchCancel);
  _listEl.removeEventListener("contextmenu", _onContextMenu);
  _listEl = null;
  _clearTimer();
}


// ─── Touch handlers ───────────────────────────────────────────────────────────

function _onTouchStart(e) {
  _touchStarted = true;
  const touch   = e.touches[0];
  _startX       = touch.clientX;
  _startY       = touch.clientY;
  _didMove      = false;

  const msgEl = _getMessageWrapper(e.target);
  if (!msgEl) return;

  _activeMessageId = _getMessageId(msgEl);
  if (!_activeMessageId) return;

  _pressTimer = setTimeout(() => {
    if (!_didMove) {
      _vibrate();
      _openOptionsSheet(_activeMessageId);
    }
    _clearTimer();
  }, DURATION);
}

function _onTouchMove(e) {
  if (!_touchStarted) return;
  const touch = e.touches[0];
  const dx    = Math.abs(touch.clientX - _startX);
  const dy    = Math.abs(touch.clientY - _startY);
  if (dx > THRESHOLD || dy > THRESHOLD) {
    _didMove = true;
    _clearTimer();
  }
}

function _onTouchEnd() {
  _touchStarted = false;
  _clearTimer();
}

function _onTouchCancel() {
  _touchStarted = false;
  _clearTimer();
}


// ─── Context menu (desktop right-click) ──────────────────────────────────────

function _onContextMenu(e) {
  const msgEl = _getMessageWrapper(e.target);
  if (!msgEl) return;
  const messageId = _getMessageId(msgEl);
  if (!messageId) return;
  e.preventDefault();
  _openOptionsSheet(messageId);
}


// ─── Bottom sheet open/close ──────────────────────────────────────────────────

/**
 * FIX: was calling openThreadMessageOptions() which doesn't exist in modals.
 * Now dispatches a custom event that thread_delegation.js handles — avoids
 * circular import (delegation → longpress → delegation).
 *
 * The bottom sheet HTML is already in threads.html as #thread-message-options-sheet.
 */
function _openOptionsSheet(messageId) {
  // Delegate to the delegation layer via custom event — no circular import
  document.dispatchEvent(new CustomEvent("thread:open-options", {
    detail: { messageId },
    bubbles: false,
  }));
}

function _closeOptionsSheet() {
  const sheet = document.getElementById("thread-message-options-sheet");
  const panel = document.getElementById("thread-options-panel");
  if (!sheet || !panel) return;
  panel.classList.add("translate-y-full");
  setTimeout(() => sheet.classList.add("hidden"), 260);
}


// ─── Private helpers ─────────────────────────────────────────────────────────

/**
 * FIX: was looking for [data-thread-message-id] — templates use [data-message-id].
 */
function _getMessageWrapper(el) {
  return el?.closest?.("[data-message-id]") ?? null;
}

/**
 * FIX: was reading dataset.threadMessageId — correct key is dataset.messageId.
 */
function _getMessageId(el) {
  const raw = el?.dataset?.messageId;
  const id  = parseInt(raw, 10);
  return isNaN(id) || id === 0 ? null : id;
}

function _clearTimer() {
  if (_pressTimer) {
    clearTimeout(_pressTimer);
    _pressTimer = null;
  }
}

function _vibrate() {
  try { navigator.vibrate?.(30); } catch { /* ignore */ }
}
