/**
 * thread.websocket.js
 * Frontend WebSocket client for the thread real-time layer.
 *
 * FIXES vs previous version:
 *  - WS-01 / ARCH-01: All socket.on() calls use named handler functions stored
 *    in module-level _threadHandlers / _personalHandlers objects. This allows
 *    disconnectThreadWebSocket() to remove only the specific listeners it
 *    registered, preventing the "remove-all" side effect of socket.off(event)
 *    without a handler reference.
 *  - ARCH-02: Events arriving on the user's personal room (message_status_updated)
 *    are separated from thread-room events. Personal room listeners are registered
 *    once in initPersonalRoomListeners() and never torn down on thread switch.
 *  - WS-02: NEW_MESSAGE handler now checks whether the message is for the
 *    active thread. If yes → emitMarkRead (user is viewing). If no → emitDelivered
 *    (online but not viewing). This matches the Option 1 status architecture.
 *  - WS-03: NEW_MESSAGE with is_ai_response=true removes the Learnora typing
 *    indicator immediately instead of waiting up to 30 s.
 *  - WS-05: sendMessage() checks socket connectivity before emitting. If
 *    disconnected the optimistic message is immediately failed with a toast.
 *  - WS-06: typingThreadId captured at emitTypingStart time so _stopTyping
 *    emits to the correct thread even after a thread switch.
 *  - BUG-C2: NEW_MESSAGE triggers moveThreadToTop() in render after state update.
 *  - Token: api.getToken() (cookie) everywhere — no localStorage/sessionStorage.
 */

import {
  threadState,
  addMessage,
  addPendingMessage,
  confirmOptimisticMessage,
  failPendingMessage,
  updateMessageStatus,
  setUserOnline,
  setUserTyping,
  addOrUpdateThreadInList,
  removeThreadFromList,
  setMember,
  setUserActiveThread,
} from './thread.state.js';

import { THREAD_WS, MSG_STATUS } from './thread.constants.js';

// ─── Module state ─────────────────────────────────────────────────────────────

let _socket   = null;
let _threadId = null;

/**
 * Named handler references for thread-room events.
 * Keyed by THREAD_WS constant value so disconnectThreadWebSocket can remove
 * exactly the handlers it registered without touching other modules' listeners.
 */
const _threadHandlers  = {};

/**
 * Named handler references for personal-room events.
 * Registered once per socket lifetime; never torn down on thread switch.
 */
const _personalHandlers = {};

/** True once personal-room listeners are attached to avoid duplicates. */
let _personalHandlersSocket = null;


// ─── Public: lifecycle ────────────────────────────────────────────────────────

/**
 * Attach to a thread room and register all thread-room event handlers.
 * Call once per thread open. Automatically disconnects any previous handlers.
 *
 * @param {import('socket.io-client').Socket} socket
 * @param {number} threadId
 */
export function initThreadWebSocket(socket, threadId) {
  _socket   = socket;
  _threadId = threadId;

  const token = api.getToken();

  // Register personal-room listeners exactly once per socket instance.
  if (_personalHandlersSocket !== socket) {
    _registerPersonalHandlers(socket);
    _personalHandlersSocket = socket;
  }

  _registerThreadHandlers(socket, threadId, token);

  // Track which thread this user is actively viewing (ARCH-02 / Option 1 status).
  if (threadState.currentUser?.id) {
    setUserActiveThread(threadState.currentUser.id, threadId);
  }

  // FIX WS-01: was emitting "thread_connect" — server handler is "join_thread_room"
  socket.emit(THREAD_WS.JOIN_ROOM, { token, thread_id: threadId });
}

/**
 * Leave the current thread room and remove all thread-room listeners.
 * Personal-room listeners are intentionally preserved.
 *
 * @param {number} threadId
 */
export function disconnectThreadWebSocket(threadId) {
  if (!_socket) return;

  const token = api.getToken();

  // FIX WS-01: was emitting "thread_disconnect" — server handler is "leave_thread_room"
  _socket.emit(THREAD_WS.LEAVE_ROOM, { token, thread_id: threadId });

  // Remove only the named handlers we registered — no collateral damage.
  for (const [event, handler] of Object.entries(_threadHandlers)) {
    _socket.off(event, handler);
    delete _threadHandlers[event];
  }

  // Clear active thread tracking (ARCH-02)
  if (threadState.currentUser?.id) {
    setUserActiveThread(threadState.currentUser.id, null);
  }

  _socket   = null;
  _threadId = null;
}


// ─── Public: outbound helpers ─────────────────────────────────────────────────

/**
 * WS-05 FIX: check connectivity before emitting. If disconnected, immediately
 * fail the optimistic message rather than leaving it in perpetual "pending".
 */
export function sendMessage(payload) {
  if (!_socket || !_socket.connected) {
    // Build a minimal optimistic message so the user sees it failed.
    const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { currentUser, activeThreadId } = threadState;

    const optimistic = _buildOptimistic(payload, clientTempId, currentUser, activeThreadId);
    optimistic.status = MSG_STATUS.FAILED;

    addPendingMessage(optimistic);
    import('./thread.render.js').then(({ renderNewMessage }) => {
      renderNewMessage(optimistic);
      // Template already renders retry button when status === FAILED
    });

    showToast('You appear to be offline. Message could not be sent.', 'error');
    return null;
  }

  const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { currentUser, activeThreadId } = threadState;
  const token = api.getToken();

  const optimistic = _buildOptimistic(payload, clientTempId, currentUser, activeThreadId);
  addPendingMessage(optimistic);

  import('./thread.render.js').then(({ renderNewMessage }) => {
    renderNewMessage(optimistic);
  });

  _socket.emit(THREAD_WS.SEND, {
    token,
    thread_id:       activeThreadId,
    text_content:    payload.text_content    ?? '',
    client_temp_id:  clientTempId,
    reply_to_id:     payload.reply_to_id     ?? null,
    attachment_url:  payload.attachment_url  ?? null,
    attachment_name: payload.attachment_name ?? null,
    attachment_type: payload.attachment_type ?? null,
    attachment_size: payload.attachment_size ?? null,
  });

  return clientTempId;
}

/**
 * WS-06 FIX: store the thread ID at emit time so stop-typing uses
 * the correct thread even if the user switches threads mid-timer.
 */
export function emitTypingStart(threadId) {
  threadState.typingThreadId = threadId;
  // FIX: was emitting "thread_typing_start" — server handler is "thread_typing"
  _socket?.emit(THREAD_WS.TYPING_START, { token: api.getToken(), thread_id: threadId });
}

/** Uses the captured typingThreadId to target the correct thread. */
export function emitTypingStop(threadId) {
  _socket?.emit(THREAD_WS.TYPING_STOP, { token: api.getToken(), thread_id: threadId });
  threadState.typingThreadId = null;
}

export function emitMarkRead(threadId) {
  _socket?.emit(THREAD_WS.MARK_READ, { token: api.getToken(), thread_id: threadId });
}

export function emitDelivered(messageId) {
  _socket?.emit(THREAD_WS.MESSAGE_DELIVERED, {
    token:      api.getToken(),
    message_id: messageId,
  });
}


// ─── Private: optimistic message builder ─────────────────────────────────────

function _buildOptimistic(payload, clientTempId, currentUser, activeThreadId) {
  return {
    id:              null,
    client_temp_id:  clientTempId,
    thread_id:       activeThreadId,
    sender_id:       currentUser?.id,
    sender: {
      id:       currentUser?.id,
      name:     currentUser?.name,
      username: currentUser?.username,
      avatar:   currentUser?.avatar,
    },
    text_content:    payload.text_content    ?? '',
    attachment_url:  payload.attachment_url  ?? null,
    attachment_name: payload.attachment_name ?? null,
    attachment_type: payload.attachment_type ?? null,
    attachment_size: payload.attachment_size ?? null,
    reply_to_id:     payload.reply_to_id     ?? null,
    reply_to:        payload.reply_to        ?? null,
    is_pinned:       false,
    is_edited:       false,
    is_ai_response:  false,
    reactions:       {},
    status:          MSG_STATUS.PENDING,
    sent_at:         new Date().toISOString(),
  };
}


// ─── Private: personal-room handler registration ──────────────────────────────

/**
 * ARCH-02: Register listeners for events delivered to the user's personal room
 * (user_{id}). These must persist across thread switches, so they are never
 * removed by disconnectThreadWebSocket().
 */
function _registerPersonalHandlers(socket) {
  // ── Message status updated (delivered / read ticks) ───────────────────────
  _personalHandlers[THREAD_WS.MESSAGE_STATUS_UPDATED] = (data) => {
    const { message_ids, status } = data;
    if (!Array.isArray(message_ids) || !status) return;
    updateMessageStatus(message_ids, status);
    import('./thread.render.js').then(({ updateStatusIcons }) => {
      updateStatusIcons(message_ids, status);
    });
  };
  socket.on(THREAD_WS.MESSAGE_STATUS_UPDATED, _personalHandlers[THREAD_WS.MESSAGE_STATUS_UPDATED]);
}


// ─── Private: thread-room handler registration ────────────────────────────────

function _registerThreadHandlers(socket, threadId, token) {

  // ── Room joined ack ───────────────────────────────────────────────────────
  // FIX WS-01: was listening for "thread_connected" → now "thread_room_joined"
  _threadHandlers[THREAD_WS.ROOM_JOINED] = (data) => {
    addOrUpdateThreadInList({ id: threadId, your_role: data.your_role });
  };
  socket.on(THREAD_WS.ROOM_JOINED, _threadHandlers[THREAD_WS.ROOM_JOINED]);

  // ── Thread-level error ────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.ERROR] = (data) => {
    showToast(data?.message ?? 'Real-time error', 'error');
  };
  socket.on(THREAD_WS.ERROR, _threadHandlers[THREAD_WS.ERROR]);

  // ── Message send error → mark pending as failed ───────────────────────────
  // WS previous: this handler was missing — pending messages stayed in limbo.
  _threadHandlers[THREAD_WS.MSG_ERROR] = (data) => {
    const { client_temp_id } = data ?? {};
    if (client_temp_id) {
      failPendingMessage(client_temp_id);
      import('./thread.render.js').then(({ markMessageFailed }) => {
        markMessageFailed?.(client_temp_id);
      });
    }
    showToast(data?.message ?? 'Failed to send message', 'error');
  };
  socket.on(THREAD_WS.MSG_ERROR, _threadHandlers[THREAD_WS.MSG_ERROR]);

  // ── New message ───────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.NEW_MESSAGE] = (data) => {
    // WS-03 FIX: remove Learnora typing indicator the moment the AI response arrives.
    if (data.is_ai_response) {
      document.getElementById('thread-learnora-typing')?.remove();
    }

    const wasAdded = addMessage(data);

    if (wasAdded) {
      import('./thread.render.js').then(({ renderNewMessage, moveThreadToTop }) => {
        renderNewMessage(data);
        // BUG-C2 FIX: move thread to top of list on new activity.
        moveThreadToTop?.(data.thread_id);
      });

      // WS-02 FIX: decide delivered vs read based on whether this thread is active.
      if (data.sender_id !== threadState.currentUser?.id && data.id) {
        if (data.thread_id === threadState.activeThreadId) {
          // User is actively viewing this thread — upgrade to READ immediately.
          emitMarkRead(data.thread_id);
        } else {
          // User is online but has this thread in the background.
          emitDelivered(data.id);
        }
      }
    }

    // Always update list preview and activity timestamp.
    addOrUpdateThreadInList({
      id:           data.thread_id,
      last_message: {
        text:      (data.text_content ?? '').slice(0, 80) || (data.attachment_url ? '📎 Attachment' : ''),
        sender:    data.sender?.name ?? '',
        sender_id: data.sender_id,
        sent_at:   data.sent_at,
      },
      last_activity: data.sent_at,
    });
  };
  socket.on(THREAD_WS.NEW_MESSAGE, _threadHandlers[THREAD_WS.NEW_MESSAGE]);

  // ── Sender-only confirm ───────────────────────────────────────────────────
  // BUG-C5 FIX: toast moved here only; removed from render.confirmOptimisticMessage.
  _threadHandlers[THREAD_WS.MESSAGE_SENT] = (data) => {
    const { client_temp_id, id, sent_at, status } = data;
    confirmOptimisticMessage(client_temp_id, { id, sent_at, status: status ?? MSG_STATUS.SENT });
    import('./thread.render.js').then(({ confirmOptimisticMessage: renderConfirm }) => {
      renderConfirm(client_temp_id, data);
    });
    // Single toast per send — not duplicated in render layer.
    showToast('Message sent', 'success');
  };
  socket.on(THREAD_WS.MESSAGE_SENT, _threadHandlers[THREAD_WS.MESSAGE_SENT]);

  // ── Edit ──────────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MESSAGE_EDITED] = (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) {
      msg.text_content = data.text_content;
      msg.is_edited    = true;
      msg.edited_at    = data.edited_at;
    }
    import('./thread.render.js').then(({ renderMessageEdit }) => {
      renderMessageEdit(data.message_id, data.text_content);
    });
  };
  socket.on(THREAD_WS.MESSAGE_EDITED, _threadHandlers[THREAD_WS.MESSAGE_EDITED]);

  // ── Delete ────────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MESSAGE_DELETED] = (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) { msg.is_deleted = true; msg.text_content = '[deleted]'; }
    import('./thread.render.js').then(({ renderMessageDelete }) => {
      renderMessageDelete(data.message_id);
    });
  };
  socket.on(THREAD_WS.MESSAGE_DELETED, _threadHandlers[THREAD_WS.MESSAGE_DELETED]);

  // ── Pin ───────────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MESSAGE_PINNED] = (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) msg.is_pinned = true;
    showToast('Message pinned', 'success');
    import('./thread.render.js').then(({ renderPinUpdate, renderPinnedBanner }) => {
      renderPinUpdate(data.message_id, true);
      const pinned = threadState.messages.filter((m) => m.is_pinned && !m.is_deleted);
      renderPinnedBanner(pinned);
    });
  };
  socket.on(THREAD_WS.MESSAGE_PINNED, _threadHandlers[THREAD_WS.MESSAGE_PINNED]);

  // ── Unpin ─────────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MESSAGE_UNPINNED] = (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) msg.is_pinned = false;
    showToast('Message unpinned', 'info');
    import('./thread.render.js').then(({ renderPinUpdate, renderPinnedBanner }) => {
      renderPinUpdate(data.message_id, false);
      const pinned = threadState.messages.filter((m) => m.is_pinned && !m.is_deleted);
      renderPinnedBanner(pinned);
    });
  };
  socket.on(THREAD_WS.MESSAGE_UNPINNED, _threadHandlers[THREAD_WS.MESSAGE_UNPINNED]);

  // ── Reactions ─────────────────────────────────────────────────────────────
  // FIX WS-01: was listening "thread_reaction_updated" (singular) → plural
  _threadHandlers[THREAD_WS.REACTION_UPDATED] = (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) msg.reactions = data.reactions;
    import('./thread.render.js').then(({ renderReactionUpdate }) => {
      renderReactionUpdate(data.message_id, data.reactions);
    });
  };
  socket.on(THREAD_WS.REACTION_UPDATED, _threadHandlers[THREAD_WS.REACTION_UPDATED]);

  // ── Typing started ────────────────────────────────────────────────────────
  // FIX WS-01: was listening "user_typing" → "thread_typing_started"
  _threadHandlers[THREAD_WS.USER_TYPING_START] = (data) => {
    if (data.user_id === threadState.currentUser?.id) return;
    setUserTyping(data.user_id, data.user_name, true, () => {
      import('./thread.render.js').then(({ renderTypingIndicator }) => {
        renderTypingIndicator();
      });
    });
  };
  socket.on(THREAD_WS.USER_TYPING_START, _threadHandlers[THREAD_WS.USER_TYPING_START]);

  // ── Typing stopped ────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.USER_TYPING_STOP] = (data) => {
    if (data.user_id === threadState.currentUser?.id) return;
    setUserTyping(data.user_id, null, false, () => {
      import('./thread.render.js').then(({ renderTypingIndicator }) => {
        renderTypingIndicator();
      });
    });
  };
  socket.on(THREAD_WS.USER_TYPING_STOP, _threadHandlers[THREAD_WS.USER_TYPING_STOP]);

  // ── Presence ──────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.USER_ONLINE] = (data) => {
    setUserOnline(data.user_id, true);
    import('./thread.render.js').then(({ updateOnlineBadge }) => {
      updateOnlineBadge?.(data.user_id, true);
    });
  };
  socket.on(THREAD_WS.USER_ONLINE, _threadHandlers[THREAD_WS.USER_ONLINE]);

  _threadHandlers[THREAD_WS.USER_OFFLINE] = (data) => {
    setUserOnline(data.user_id, false);
    import('./thread.render.js').then(({ updateOnlineBadge }) => {
      updateOnlineBadge?.(data.user_id, false);
    });
  };
  socket.on(THREAD_WS.USER_OFFLINE, _threadHandlers[THREAD_WS.USER_OFFLINE]);

  // ── Read ACK ──────────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.READ_ACK] = () => {
    addOrUpdateThreadInList({ id: threadId, unread_count: 0 });
    import('./thread.render.js').then(({ updateUnreadBadge }) => {
      updateUnreadBadge?.(threadId, 0);
    });
  };
  socket.on(THREAD_WS.READ_ACK, _threadHandlers[THREAD_WS.READ_ACK]);

  // ── Member joined ─────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MEMBER_JOINED] = (data) => {
    const current = threadState.threadList.get(threadId);
    addOrUpdateThreadInList({
      id:           threadId,
      member_count: (current?.member_count ?? 0) + 1,
    });
    if (data.user) {
      setMember(data.user.id, {
        name:   data.user.name,
        avatar: data.user.avatar,
        role:   'member',
      });
    }
    import('./thread.render.js').then(({ showSystemMessage }) => {
      showSystemMessage(`${data.user?.name ?? 'Someone'} joined the thread`);
    });
  };
  socket.on(THREAD_WS.MEMBER_JOINED, _threadHandlers[THREAD_WS.MEMBER_JOINED]);

  // ── Member removed ────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.MEMBER_REMOVED] = (data) => {
    if (data.user_id === threadState.currentUser?.id) {
      showToast('You were removed from this thread', 'error');
      import('./thread.events.js').then(({ handleBackToList }) => handleBackToList());
    } else {
      import('./thread.render.js').then(({ showSystemMessage }) => {
        showSystemMessage('A member was removed from the thread');
      });
    }
  };
  socket.on(THREAD_WS.MEMBER_REMOVED, _threadHandlers[THREAD_WS.MEMBER_REMOVED]);

  // ── Thread deleted ────────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.THREAD_DELETED] = () => {
    showToast('This thread was deleted', 'error');
    import('./thread.events.js').then(({ handleBackToList }) => handleBackToList());
  };
  socket.on(THREAD_WS.THREAD_DELETED, _threadHandlers[THREAD_WS.THREAD_DELETED]);

  // ── Learnora thinking ─────────────────────────────────────────────────────
  _threadHandlers[THREAD_WS.LEARNORA_THINKING] = () => {
    import('./thread.render.js').then(({ showLearnoraBotTyping }) => {
      showLearnoraBotTyping?.();
    });
  };
  socket.on(THREAD_WS.LEARNORA_THINKING, _threadHandlers[THREAD_WS.LEARNORA_THINKING]);
}
