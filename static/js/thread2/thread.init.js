/**
 * thread.init.js
 * Application entry point for the thread system.
 *
 * FIXES vs previous version:
 *  - HIDDEN-05: "Connected" toast now only fires on reconnect (not initial connect).
 *    A "Connecting…" toast on first connect would be spammy; users expect it to work.
 *  - WS-04 / ARCH-02: on reconnect, disconnectThreadWebSocket() is called before
 *    re-registering handlers. This is now safe because named handlers are used
 *    (WS-01 fix in thread.websocket.js) and personal-room listeners (message_status_updated)
 *    are registered only once and never re-added on reconnect.
 *  - HIDDEN-06: Generation counter lives in thread.events.js handleOpenThread().
 *    Init just delegates; no change needed here beyond ensuring thread.events.js
 *    is imported correctly.
 *  - Sends API token in socket auth payload so handle_connect correctly populates
 *    socket_to_user map in the backend MessageWebSocketManager.
 */

import { threadState, resetThreadSession }              from './thread.state.js';
import { initThreadDelegation, destroyThreadDelegation } from './thread.delegation.js';
import { handleLoadThreadList, handleOpenThread }        from './thread.events.js';
import { fetchCurrentUser }                              from './thread.api.js';
import { renderThreadList }                              from './thread.render.js';
import { attachThreadLongPress } from './thread.longpress.js';
import { io }                                            from 'https://cdn.socket.io/4.7.5/socket.io.esm.min.js';

// ─── Exports ──────────────────────────────────────────────────────────────────

/** Shared socket.io instance — imported by thread.events.js and thread.websocket.js */
export let socket = null;


// ─── Entry point ──────────────────────────────────────────────────────────────

let _initialised = false;
// ── FIX 2: Block native context menu on bubbles ───────────────────────────


// Call it like:
// initThreadMessageInteractions(document.querySelector('#thread-messages-container'));

export async function threadInit() {
  if (_initialised) return;

  try {
    // 1. Resolve current user
    let currentUser;
    try {
      currentUser = await fetchCurrentUser();
    } catch {
      showToast('Could not resolve your session. Please log in again.', 'error');
      _renderAuthError();
      return;
    }

    if (!currentUser?.id) {
      showToast('Invalid user session. Please log in again.', 'error');
      _renderAuthError();
      return;
    }

    threadState.currentUser = currentUser;

    // 2. Connect socket.io
    if (typeof io !== 'undefined') {
      socket = io({
        transports:           ['polling', 'websocket'],
        auth:                 { token: api.getToken() },
        reconnection:         true,
        reconnectionAttempts: 5,
        reconnectionDelay:    1000,
      });
      _bindSocketLifecycle(socket);
    } else {
      showToast('Real-time disabled — socket.io not loaded.', 'error');
    }

    // 3. Event delegation
    initThreadDelegation();

    // 4. Load thread list
    try {
      await handleLoadThreadList();
    } catch {
      showToast('Failed to load thread list. Please refresh.', 'error');
    }

    // 5. Load pending invites
    await _loadPendingInvites();

    // 6. Wire send button enable/disable
    _initSendButtonToggle();

    // 7. Wire avatar file input
    _initAvatarFileInput();

    // 8. Open thread from URL hash
    const hashId = _hashThreadId();
    if (hashId) {
      try {
        await handleOpenThread(hashId);
      } catch {
        showToast('Failed to open thread from URL.', 'error');
      }
    }

    _initialised = true;
    const containerEl = document.getElementById("threads");
    containerEl.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.msg-bubble')) {
      e.preventDefault();
    }
    });
    // 3a. Long-press / right-click on messages
    const listEl = document.getElementById('thread-messages-list');
    if (listEl) attachThreadLongPress(listEl);

  } catch (err) {
    showToast(`Initialisation failed: ${err?.message ?? err}`, 'error');
    _renderInitError(err);
  }
}

export function threadDestroy() {
  resetThreadSession();
  socket?.disconnect();
  socket       = null;
  _initialised = false;
  destroyThreadDelegation?.();
}


// ─── Send button enable/disable ───────────────────────────────────────────────

function _initSendButtonToggle() {
  // Handled by thread.delegation.js _onInput which fires on every input event.
  // This function is kept as a no-op hook for future per-instance initialization.
}


// ─── Avatar file input ────────────────────────────────────────────────────────

function _initAvatarFileInput() {
  document.addEventListener('change', (e) => {
    const input = e.target;
    if (
      input.id !== 'thread-avatar-file-input' &&
      !input.matches("[data-role='thread-avatar-input']")
    ) return;
    const file     = input.files?.[0];
    const threadId = threadState.activeThreadId;
    if (!file || !threadId) return;
    import('./thread.events.js').then(({ handleThreadAvatarUpload }) => {
      handleThreadAvatarUpload(threadId, file);
    });
    input.value = '';
  });
}


// ─── Pending invites ──────────────────────────────────────────────────────────

async function _loadPendingInvites() {
  try {
    const { getMyInvites } = await import('./thread.api.js');
    const invites = await getMyInvites();
    if (!invites.length) return;

    const container = document.getElementById('thread-invites-container');
    const list      = document.getElementById('thread-invites-list');
    if (!container || !list) return;

    list.innerHTML = invites.map((invite) => `
      <div class="flex items-start justify-between gap-3 py-2.5 border-b border-gray-100
                  last:border-0" data-invite-row data-invite-id="${invite.invite_id}">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-900 truncate">
            ${_esc(invite.thread?.title ?? 'Thread')}
          </p>
          <p class="text-xs text-gray-400 mt-0.5">
            From ${_esc(invite.invited_by?.name ?? 'Someone')}
          </p>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button data-action="thread-accept-invite"
                  data-invite-id="${invite.invite_id}"
                  class="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                         active:scale-95 rounded-lg px-2.5 py-1.5 transition-all">
            Accept
          </button>
          <button data-action="thread-decline-invite"
                  data-invite-id="${invite.invite_id}"
                  class="text-xs font-semibold text-gray-600 hover:bg-gray-100
                         active:bg-gray-200 rounded-lg px-2.5 py-1.5 transition-colors
                         border border-gray-200">
            Decline
          </button>
        </div>
      </div>`
    ).join('');

    container.classList.remove('hidden');
    showToast(
      `You have ${invites.length} pending invite${invites.length > 1 ? 's' : ''}.`,
      'info'
    );
  } catch {
    // Non-fatal — invites section just stays hidden.
  }
}


// ─── Socket lifecycle ─────────────────────────────────────────────────────────

let _hasConnectedOnce = false;

function _bindSocketLifecycle(sock) {
  sock.on('connect', () => {
    // HIDDEN-05 FIX: only show toast on reconnect, not initial connection.
    if (_hasConnectedOnce) {
      showToast('Reconnected', 'success');
    }
    _hasConnectedOnce = true;
  });

  sock.on('disconnect', (reason) => {
    if (reason !== 'io client disconnect') {
      // Only notify the user for unexpected disconnects.
      showToast('Connection lost — reconnecting…', 'error');
    }
    if (reason === 'io server disconnect') {
      setTimeout(() => sock.connect(), 1500);
    }
  });

  sock.on('connect_error', (err) => {
    // Suppress connect_error spam during reconnection attempts after initial connect.
    if (_hasConnectedOnce) return;
    console.warn('[thread_init] Socket connection error:', err.message);
  });

  // WS-04 FIX: named handlers in thread.websocket.js mean reconnect is safe.
  // disconnectThreadWebSocket() removes only the registered handlers, not all
  // listeners, so personal-room handlers added once in initPersonalRoomListeners()
  // are not affected.
  sock.on('reconnect', () => {
    const threadId = threadState.activeThreadId;
    if (!threadId) return;
    import('./thread.websocket.js').then(({ disconnectThreadWebSocket, initThreadWebSocket }) => {
      disconnectThreadWebSocket(threadId);
      initThreadWebSocket(sock, threadId);
    });
  });
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function _hashThreadId() {
  const hash = window.location.hash;
  if (!hash?.startsWith('#thread-')) return NaN;
  const id = parseInt(hash.slice(8), 10);
  return isNaN(id) || id <= 0 ? NaN : id;
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _renderAuthError() {
  const root = document.getElementById('threads');
  if (root) {
    root.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <span class="text-4xl">🔒</span>
        <p class="text-sm text-gray-600">You must be logged in to use threads.</p>
        <a href="/student/login"
           class="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                  rounded-xl px-4 py-2 transition-colors">
          Log in
        </a>
      </div>`;
  }
}

function _renderInitError(err) {
  const root = document.getElementById('threads');
  if (root) {
    root.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full gap-3 p-8 text-center">
        <span class="text-3xl">⚠️</span>
        <p class="text-sm text-gray-600">Failed to load threads. Please refresh.</p>
        <p class="text-xs text-gray-400">${String(err?.message ?? err)}</p>
        <button onclick="location.reload()"
                class="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       rounded-xl px-4 py-2 transition-colors">
          Refresh
        </button>
      </div>`;
  }
}


// ─── Auto-init ────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', threadInit);
} else {
  threadInit();
}
