# 🛠️ Thread System — Implementation & Refinement Guide

> Apply fixes in the order listed. Each fix is self-contained.  
> Files referenced use their canonical names as they exist in your project.

---

## PHASE 1 — System Initialization (Fix everything before any other code runs)

---

### FIX-01 · `thread_api.js` — Remove debug toast spam from `fetchCurrentUser`

**File:** `thread_api.js`  
**Replace the entire `fetchCurrentUser` function:**

```js
/**
 * Fetch the authenticated user's own profile.
 * @returns {Promise<{id:number, name:string, username:string, avatar:string|null}|null>}
 */
export async function fetchCurrentUser() {
  try {
    const res = await api.get("/users/me");
    return res.data?.user ?? null;
  } catch (err) {
    console.error("[fetchCurrentUser] Error:", err);
    return null;
  }
}
```

**Why:** The original calls `showToast()` — a function that is never imported in this file — causing a `ReferenceError` that crashes the entire thread initialization chain before a single thread is ever loaded.

---

### FIX-02 · `thread_init.js` — Fix typos in user error messages

**File:** `thread_init.js` lines 49 and 56  
**Replace:**

```js
// Line 49 — before:
showToast("Cannot resolve currebt user", 'error');

// Line 49 — after:
showToast("Could not resolve your account. Please refresh.", 'error');

// Line 56 — before:
showToast("Cannot resolve currebt user ud not found", 'error');

// Line 56 — after:
showToast("Account not found. Please log in again.", 'error');
```

---

## PHASE 2 — WebSocket Event Name Corrections (Core real-time layer)

All of these are in `thread_websocket.js` (client) and `websocket_threads.py` (server). The fastest path is to fix the client constants and client emit calls, since the server names are authoritative.

---

### FIX-03 · `thread_constants.js` — Align all WS event names to server

**File:** `thread_constants.js`  
**Replace the entire `THREAD_WS` export:**

```js
export const THREAD_WS = {
  // ── Client → Server ───────────────────────────────────────────────────────
  /** Join a thread room. Server handler: @sio.on("join_thread_room") */
  JOIN_ROOM:   "join_thread_room",

  /** Leave a thread room. Server handler: @sio.on("leave_thread_room") */
  LEAVE_ROOM:  "leave_thread_room",

  /** Send a message. Server handler: @sio.on("send_thread_message") */
  SEND:        "send_thread_message",

  /** Notify typing. Server handler: @sio.on("thread_typing") */
  TYPING_START: "thread_typing",

  /** Stop typing. Server handler: @sio.on("thread_typing_stop") */
  TYPING_STOP:  "thread_typing_stop",

  /** Add/toggle reaction. Server handler: @sio.on("add_thread_reaction") */
  REACT:        "add_thread_reaction",

  /** Mark thread read. Server handler: @sio.on("mark_thread_read") */
  MARK_READ:    "mark_thread_read",

  /** Message delivered. Server handler: @sio.on("message_delivered") */
  MESSAGE_DELIVERED: "message_delivered",

  /** Pin a message. Server handler: @sio.on("pin_thread_message") */
  PIN:          "pin_thread_message",

  /** Unpin a message. Server handler: @sio.on("unpin_thread_message") */
  UNPIN:        "unpin_thread_message",

  /** Edit a message. Server handler: @sio.on("edit_thread_message") */
  EDIT:         "edit_thread_message",

  /** Delete a message. Server handler: @sio.on("delete_thread_message") */
  DELETE:       "delete_thread_message",

  // ── Server → Client ───────────────────────────────────────────────────────
  /** Emitted by server after successful join_thread_room */
  ROOM_JOINED:      "thread_room_joined",

  /** Broadcast: new message for entire thread room */
  NEW_MESSAGE:      "new_thread_message",

  /** Unicast: sender-only confirmation with real message ID */
  MESSAGE_SENT:     "thread_message_sent",

  /** Broadcast: a message was edited */
  MESSAGE_EDITED:   "thread_message_edited",

  /** Broadcast: a message was deleted */
  MESSAGE_DELETED:  "thread_message_deleted",

  /** Broadcast: a message was pinned */
  MESSAGE_PINNED:   "thread_message_pinned",

  /** Broadcast: a message was unpinned */
  MESSAGE_UNPINNED: "thread_message_unpinned",

  /** Broadcast: reaction counts changed on a message */
  REACTION_UPDATED: "thread_reactions_updated",

  /** Broadcast: a user started typing */
  USER_TYPING_START: "thread_typing_started",

  /** Broadcast: a user stopped typing */
  USER_TYPING_STOP:  "thread_typing_stopped",

  /** Broadcast: presence update */
  USER_ONLINE:  "user_online",
  USER_OFFLINE: "user_offline",

  /** Unicast: delivery/read status changed for sender */
  MESSAGE_STATUS_UPDATED: "message_status_updated",

  /** Thread-level read acknowledgement */
  READ_ACK: "thread_read_ack",

  /** Broadcast: a new member joined */
  MEMBER_JOINED: "thread_member_joined",

  /** Broadcast: thread was deleted (add to server — see FIX-09) */
  THREAD_DELETED: "thread_deleted",

  /** Broadcast: a member was removed */
  MEMBER_REMOVED: "thread_member_removed",

  /** Legacy aliases — kept for backward compatibility */
  CONNECT:    "join_thread_room",
  DISCONNECT: "leave_thread_room",

  // Errors
  ERROR: "thread_error",
};
```

---

### FIX-04 · `thread_websocket.js` — Fix all emit calls and listener names

**File:** `thread_websocket.js`  
**Replace the entire file:**

```js
/**
 * thread_websocket.js
 * Frontend WebSocket client for the thread real-time layer.
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
} from "./thread_state.js";

import { THREAD_WS, MSG_STATUS } from "./thread_constants.js";

let _socket = null;


// ─── Public: Outbound helpers ─────────────────────────────────────────────────

/**
 * @param {SocketIOClient.Socket} socket  Existing socket.io instance
 * @param {number}                threadId
 * @param {string}                token
 */
export function initThreadWebSocket(socket, threadId, token) {
  _socket = socket;
  _registerHandlers(socket, threadId, token);
  // FIX: was emitting "thread_connect". Server expects "join_thread_room".
  socket.emit(THREAD_WS.JOIN_ROOM, { token, thread_id: threadId });
}

/** Disconnect from the active thread room. */
export function disconnectThreadWebSocket(threadId, token) {
  if (!_socket) return;
  // FIX: was emitting "thread_disconnect". Server expects "leave_thread_room".
  _socket.emit(THREAD_WS.LEAVE_ROOM, { token, thread_id: threadId });

  // Remove all listeners for this session so reconnect doesn't double them.
  [
    THREAD_WS.ROOM_JOINED,
    THREAD_WS.NEW_MESSAGE,
    THREAD_WS.MESSAGE_SENT,
    THREAD_WS.MESSAGE_EDITED,
    THREAD_WS.MESSAGE_DELETED,
    THREAD_WS.MESSAGE_PINNED,
    THREAD_WS.MESSAGE_UNPINNED,
    THREAD_WS.MESSAGE_STATUS_UPDATED,
    THREAD_WS.REACTION_UPDATED,
    THREAD_WS.USER_TYPING_START,
    THREAD_WS.USER_TYPING_STOP,
    THREAD_WS.USER_ONLINE,
    THREAD_WS.USER_OFFLINE,
    THREAD_WS.READ_ACK,
    THREAD_WS.MEMBER_JOINED,
    THREAD_WS.MEMBER_REMOVED,
    THREAD_WS.THREAD_DELETED,
    THREAD_WS.ERROR,
    "thread_message_error",
    "learnora_thinking",
  ].forEach((ev) => _socket.off(ev));

  _socket = null;
}

/** Add optimistic message and emit. Returns clientTempId. */
export function sendMessage(payload, token) {
  if (!_socket) return null;

  const clientTempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { currentUser, activeThreadId } = threadState;

  const optimistic = {
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
    text_content:    payload.text_content ?? "",
    attachment_url:  payload.attachment_url  ?? null,
    attachment_name: payload.attachment_name ?? null,
    attachment_type: payload.attachment_type ?? null,
    attachment_size: payload.attachment_size ?? null,
    reply_to_id:     payload.reply_to_id ?? null,
    reply_to:        payload.reply_to ?? null,
    is_pinned:       false,
    is_edited:       false,
    is_ai_response:  false,
    reactions:       {},
    status:          MSG_STATUS.PENDING,
    sent_at:         new Date().toISOString(),
  };

  addPendingMessage(optimistic);

  _socket.emit(THREAD_WS.SEND, {
    token,
    thread_id:       activeThreadId,
    text_content:    payload.text_content,
    client_temp_id:  clientTempId,
    reply_to_id:     payload.reply_to_id ?? null,
    attachment_url:  payload.attachment_url  ?? null,
    attachment_name: payload.attachment_name ?? null,
    attachment_type: payload.attachment_type ?? null,
    attachment_size: payload.attachment_size ?? null,
  });

  return clientTempId;
}

export function emitTypingStart(threadId, token) {
  // FIX: was emitting "thread_typing_start". Server expects "thread_typing".
  _socket?.emit(THREAD_WS.TYPING_START, { token, thread_id: threadId });
}

export function emitTypingStop(threadId, token) {
  _socket?.emit(THREAD_WS.TYPING_STOP, { token, thread_id: threadId });
}

export function emitMarkRead(threadId, token) {
  _socket?.emit(THREAD_WS.MARK_READ, { token, thread_id: threadId });
}

export function emitDelivered(messageId, token) {
  _socket?.emit(THREAD_WS.MESSAGE_DELIVERED, { token, message_id: messageId });
}


// ─── Private: Inbound handlers ────────────────────────────────────────────────

function _registerHandlers(socket, threadId, token) {

  // ── Room joined ack ───────────────────────────────────────────────────────
  // FIX: was listening for "thread_connected". Server emits "thread_room_joined".
  socket.on(THREAD_WS.ROOM_JOINED, (data) => {
    console.log(`[thread_ws] Joined room ${threadId} as ${data.your_role}`);
    // Store role in state for permission checks
    addOrUpdateThreadInList({ id: threadId, your_role: data.your_role });
  });

  // ── Error ─────────────────────────────────────────────────────────────────
  socket.on(THREAD_WS.ERROR, (data) => {
    console.error("[thread_ws] error:", data?.message);
    import("./thread_render.js").then(({ showToast }) => {
      showToast(data?.message ?? "WebSocket error", "error");
    });
  });

  // ── Message send error (pending → failed) ─────────────────────────────────
  socket.on("thread_message_error", (data) => {
    const { client_temp_id } = data ?? {};
    if (client_temp_id) {
      failPendingMessage(client_temp_id);
      import("./thread_render.js").then(({ markMessageFailed }) => {
        markMessageFailed?.(client_temp_id);
      });
    }
    import("./thread_render.js").then(({ showToast }) => {
      showToast(data?.message ?? "Failed to send message", "error");
    });
  });

  // ── New message ───────────────────────────────────────────────────────────
  socket.on(THREAD_WS.NEW_MESSAGE, (data) => {
    const wasAdded = addMessage(data);

    if (wasAdded) {
      import("./thread_render.js").then(({ renderNewMessage }) => {
        renderNewMessage(data);
      });

      // Emit delivered for other users' messages
      const currentUserId = threadState.currentUser?.id;
      if (data.sender_id !== currentUserId && data.id) {
        emitDelivered(data.id, token);
      }

      addOrUpdateThreadInList({
        id:           threadId,
        last_message: {
          text:      data.text_content?.slice(0, 80) ?? "",
          sender:    data.sender?.name ?? "",
          sender_id: data.sender_id,
          sent_at:   data.sent_at,
        },
        last_activity: data.sent_at,
      });
    }
  });

  // ── Sender-only confirm ───────────────────────────────────────────────────
  socket.on(THREAD_WS.MESSAGE_SENT, (data) => {
    const { client_temp_id, id, sent_at, status } = data;
    confirmOptimisticMessage(client_temp_id, { id, sent_at, status: status ?? MSG_STATUS.SENT });

    import("./thread_render.js").then(({ confirmOptimisticMessage: renderConfirm }) => {
      renderConfirm(client_temp_id, data);
    });
  });

  // ── Status update (delivered / read) ─────────────────────────────────────
  socket.on(THREAD_WS.MESSAGE_STATUS_UPDATED, (data) => {
    const { message_ids, status } = data;
    if (!Array.isArray(message_ids) || !status) return;
    updateMessageStatus(message_ids, status);
    import("./thread_render.js").then(({ updateStatusIcons }) => {
      updateStatusIcons(message_ids, status);
    });
  });

  // ── Edit ──────────────────────────────────────────────────────────────────
  socket.on(THREAD_WS.MESSAGE_EDITED, (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) {
      msg.text_content = data.text_content;
      msg.is_edited    = true;
      msg.edited_at    = data.edited_at;
    }
    import("./thread_render.js").then(({ renderMessageEdit }) => {
      renderMessageEdit(data.message_id, data.text_content, data.edited_at);
    });
  });

  // ── Delete ────────────────────────────────────────────────────────────────
  socket.on(THREAD_WS.MESSAGE_DELETED, (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) { msg.is_deleted = true; msg.text_content = "[deleted]"; }
    import("./thread_render.js").then(({ renderMessageDelete }) => {
      renderMessageDelete(data.message_id);
    });
  });

  // ── Pin ───────────────────────────────────────────────────────────────────
  // FIX: data.is_pinned was missing from server payload. Now set explicitly.
  socket.on(THREAD_WS.MESSAGE_PINNED, (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    // Server pin event always means is_pinned = true
    if (msg) msg.is_pinned = true;
    import("./thread_render.js").then(({ renderPinUpdate }) => {
      renderPinUpdate(data.message_id, true);
    });
  });

  socket.on(THREAD_WS.MESSAGE_UNPINNED, (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) msg.is_pinned = false;
    import("./thread_render.js").then(({ renderPinUpdate }) => {
      renderPinUpdate(data.message_id, false);
    });
  });

  // ── Reactions ─────────────────────────────────────────────────────────────
  // FIX: was listening for "thread_reaction_updated" (singular).
  //      Server emits "thread_reactions_updated" (plural).
  socket.on(THREAD_WS.REACTION_UPDATED, (data) => {
    const msg = threadState.messages.find((m) => m.id === data.message_id);
    if (msg) msg.reactions = data.reactions;
    import("./thread_render.js").then(({ renderReactionUpdate }) => {
      renderReactionUpdate(data.message_id, data.reactions);
    });
  });

  // ── Typing ────────────────────────────────────────────────────────────────
  // FIX: was listening for "user_typing". Server emits "thread_typing_started"
  //      and "thread_typing_stopped".
  socket.on(THREAD_WS.USER_TYPING_START, (data) => {
    if (data.user_id === threadState.currentUser?.id) return;
    setUserTyping(data.user_id, data.user_name, true, () => {
      import("./thread_render.js").then(({ renderTypingIndicator }) => {
        renderTypingIndicator();
      });
    });
  });

  socket.on(THREAD_WS.USER_TYPING_STOP, (data) => {
    if (data.user_id === threadState.currentUser?.id) return;
    setUserTyping(data.user_id, null, false, () => {
      import("./thread_render.js").then(({ renderTypingIndicator }) => {
        renderTypingIndicator();
      });
    });
  });

  // ── Presence ──────────────────────────────────────────────────────────────
  socket.on(THREAD_WS.USER_ONLINE, (data) => {
    setUserOnline(data.user_id, true);
    import("./thread_render.js").then(({ updateOnlineBadge }) => {
      updateOnlineBadge?.(data.user_id, true);
    });
  });

  socket.on(THREAD_WS.USER_OFFLINE, (data) => {
    setUserOnline(data.user_id, false);
    import("./thread_render.js").then(({ updateOnlineBadge }) => {
      updateOnlineBadge?.(data.user_id, false);
    });
  });

  // ── Read ACK ──────────────────────────────────────────────────────────────
  socket.on(THREAD_WS.READ_ACK, () => {
    addOrUpdateThreadInList({ id: threadId, unread_count: 0 });
    import("./thread_render.js").then(({ updateUnreadBadge }) => {
      updateUnreadBadge?.(threadId, 0);
    });
  });

  // ── Member joined ─────────────────────────────────────────────────────────
  socket.on(THREAD_WS.MEMBER_JOINED, (data) => {
    const current = threadState.threadList.get(threadId);
    addOrUpdateThreadInList({
      id:           threadId,
      member_count: (current?.member_count ?? 0) + 1,
    });
    import("./thread_render.js").then(({ showSystemMessage }) => {
      showSystemMessage?.(`${data.user?.name ?? "Someone"} joined the thread`);
    });
  });

  // ── Member removed ────────────────────────────────────────────────────────
  socket.on(THREAD_WS.MEMBER_REMOVED, (data) => {
    // If current user was removed, go back to list
    if (data.user_id === threadState.currentUser?.id) {
      import("./thread_render.js").then(({ showToast }) => {
        showToast("You were removed from this thread", "error");
      });
      import("./thread_events.js").then(({ handleBackToList }) => {
        handleBackToList();
      });
    }
  });

  // ── Thread deleted ────────────────────────────────────────────────────────
  socket.on(THREAD_WS.THREAD_DELETED, () => {
    import("./thread_render.js").then(({ showToast }) => {
      showToast("This thread was deleted", "error");
    });
    import("./thread_events.js").then(({ handleBackToList }) => {
      handleBackToList();
    });
  });

  // ── Learnora thinking indicator ───────────────────────────────────────────
  socket.on("learnora_thinking", () => {
    import("./thread_render.js").then(({ showTypingIndicatorForBot }) => {
      showTypingIndicatorForBot?.();
    });
  });
}
```

---

### FIX-05 · `thread_events.js` — Fix `handleReaction` to emit the correct event name

**File:** `thread_events.js` line 309  
**Replace:**

```js
// Before:
socket.emit("react_thread_message", { token, message_id: messageId, emoji });

// After:
socket.emit("add_thread_reaction", { token, message_id: messageId, emoji });
```

---

### FIX-06 · `thread_events.js` — Fix `handlePinMessage` to toggle pin/unpin

**File:** `thread_events.js` lines 300–304  
**Replace the entire function:**

```js
export async function handlePinMessage(messageId) {
  const msg     = threadState.messages.find((m) => m.id === messageId);
  const isPinned = msg?.is_pinned ?? false;
  const event    = isPinned ? "unpin_thread_message" : "pin_thread_message";

  const { socket } = await import("./thread_init.js");
  const token      = localStorage.getItem("token") || sessionStorage.getItem("token");
  socket.emit(event, { token, message_id: messageId });
}
```

---

### FIX-07 · `websocket_threads.py` — Add `is_pinned` to pin/unpin broadcast payloads

**File:** `websocket_threads.py`  
**In `handle_pin_thread_message`, replace the broadcast (around line 909):**

```python
# Before:
self.broadcast_to_thread(msg.thread_id, "thread_message_pinned", {
    "message_id": message_id,
    "pinned_by":  user_id,
    "text":       msg.text_content[:120],
    "sender":     sender.name if sender else "Unknown"
})

# After:
self.broadcast_to_thread(msg.thread_id, "thread_message_pinned", {
    "message_id": message_id,
    "is_pinned":  True,                     # FIX: was missing
    "pinned_by":  user_id,
    "text":       msg.text_content[:120],
    "sender":     sender.name if sender else "Unknown"
})
```

**In `handle_unpin_thread_message`, replace the broadcast:**

```python
# Before:
self.broadcast_to_thread(msg.thread_id, "thread_message_unpinned", {
    "message_id": message_id
})

# After:
self.broadcast_to_thread(msg.thread_id, "thread_message_unpinned", {
    "message_id": message_id,
    "is_pinned":  False                     # FIX: was missing
})
```

---

### FIX-08 · `thread_init.js` — Fix reconnect handler to avoid duplicating listeners

**File:** `thread_init.js` lines 220–229  
**Replace the reconnect block:**

```js
sock.on("reconnect", (attempt) => {
  console.log("[thread_init] socket reconnected after", attempt, "attempts");
  const threadId = threadState.activeThreadId;
  if (threadId) {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    import("./thread_websocket.js").then(({ disconnectThreadWebSocket, initThreadWebSocket }) => {
      // FIX: disconnect first to remove all old .on() listeners before re-registering.
      // Without this, every reconnect doubles all handlers.
      disconnectThreadWebSocket(threadId, token);
      initThreadWebSocket(sock, threadId, token);
    });
  }
});
```

---

### FIX-09 · `websocket_threads.py` — Emit WS event on thread delete

**File:** `threads.py` (REST backend)  
**In `delete_thread()`, insert a broadcast BEFORE the DB delete:**

```python
@threads_bp.route("/threads/<int:thread_id>", methods=["DELETE"])
@token_required
def delete_thread(current_user, thread_id):
    """Delete thread (creator only). Cascade deletes all members, messages, requests."""
    try:
        thread = Thread.query.get(thread_id)
        if not thread:
            return error_response("Thread not found", 404)
        if thread.creator_id != current_user.id:
            return error_response("Only creator can delete thread", 403)

        members = ThreadMember.query.filter_by(thread_id=thread_id).all()
        for member in members:
            if member.student_id != current_user.id:
                db.session.add(Notification(
                    user_id=member.student_id,
                    title="Thread deleted",
                    body=f'The thread "{thread.title}" has been deleted',
                    notification_type="thread_deleted",
                    related_type="thread",
                    related_id=thread_id
                ))

        # FIX: broadcast before deleting so the WS manager can still find the thread room
        try:
            from websocket_threads import thread_ws_manager
            thread_ws_manager.broadcast_to_thread(thread_id, "thread_deleted", {
                "thread_id": thread_id,
                "title":     thread.title
            })
        except Exception:
            pass

        db.session.delete(thread)
        db.session.commit()
        return success_response("Thread deleted successfully")

    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Delete thread error: {str(e)}")
        return error_response("Failed to delete thread")
```

---

### FIX-10 · `websocket_threads.py` — Emit WS event on member remove (REST)

**File:** `threads.py` `remove_member()`, after `db.session.commit()`  

```python
        db.session.commit()

        # FIX: notify the kicked member and all thread members in real-time
        try:
            from websocket_threads import thread_ws_manager
            thread_ws_manager.broadcast_to_thread(thread_id, "thread_member_removed", {
                "thread_id": thread_id,
                "user_id":   user_id
            })
        except Exception:
            pass

        return success_response("Member removed from thread")
```

---

## PHASE 3 — Frontend Interaction Fixes

---

### FIX-11 · `threads.html` — Enable send button dynamically; fix modal `flex`

**File:** `threads.html`

**Change 1 — Add `flex` to all modal class lists:**

```html
<!-- Before (4 modals have this pattern): -->
<div id="thread-create-modal"
     class="hidden fixed inset-0 z-50 items-center justify-center bg-black/40 backdrop-blur-sm px-4"

<!-- After — add "flex" before "hidden": -->
<div id="thread-create-modal"
     class="hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
```

Apply to all four: `#thread-create-modal`, `#thread-info-modal`, `#thread-ask-ai-modal`, `#thread-confirm-modal`.

**Change 2 — Add thread list search input after the header:**

```html
<!-- After the header div (after line 45), before the invites section: -->
<div class="px-3 pb-2 bg-white border-b border-gray-100">
    <div class="relative">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
             width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input id="thread-list-search"
               data-role="thread-list-search"
               type="search"
               placeholder="Filter threads…"
               autocomplete="off"
               class="w-full pl-8 pr-3 py-2 text-sm rounded-xl border border-gray-200
                      bg-gray-50 focus:bg-white focus:border-indigo-400
                      focus:ring-2 focus:ring-indigo-100 outline-none transition-all
                      placeholder-gray-400 text-gray-900">
    </div>
</div>
```

**Change 3 — Add `data-role` to search panel inputs:**

```html
<!-- thread-search-input — add data-role: -->
<input id="thread-search-input"
       data-role="thread-search-input"
       type="search" ...>

<!-- thread-search-results — add data-role: -->
<div id="thread-search-results"
     data-role="thread-search-results"
     class="flex-1 overflow-y-auto divide-y divide-gray-50">
```

**Change 4 — Add top sentinel for infinite scroll:**

```html
<!-- First child of #thread-messages-list: -->
<div id="thread-messages-list" ...>
    <div id="thread-top-sentinel" class="h-1"></div>
    <!-- messages rendered here -->
</div>
```

**Change 5 — Remove `scroll-smooth` from message list:**

```html
<!-- Before: -->
class="flex-1 overflow-y-auto overscroll-contain scroll-smooth space-y-0.5 pb-2"

<!-- After: -->
class="flex-1 overflow-y-auto overscroll-contain space-y-0.5 pb-2"
```

---

### FIX-12 · `thread_init.js` — Wire send button, IntersectionObserver, search panel

**File:** `thread_init.js`  
**Add the following private functions and call them from `threadInit()`:**

```js
// Add to threadInit() after step 6:
// ── 7. Wire send button enable/disable ────────────────────────────────
_initSendButtonToggle();

// ── 8. Wire IntersectionObserver for infinite scroll ──────────────────
_initScrollObserver();
```

**Add these functions at the bottom of the file:**

```js
// ─── Send button toggle ───────────────────────────────────────────────────────
function _initSendButtonToggle() {
  // We use event delegation on document because the chat panel may not be
  // visible yet and the textarea is inside a conditionally-shown panel.
  document.addEventListener("input", (e) => {
    const textarea = e.target;
    if (
      textarea.id !== "thread-message-input" &&
      !textarea.matches("[data-role='thread-input']")
    ) return;

    const btn = document.getElementById("thread-send-btn");
    if (!btn) return;
    const hasText       = textarea.value.trim().length > 0;
    const hasAttachment = !!threadState.pendingAttachment;
    btn.disabled = !hasText && !hasAttachment;
  });
}


// ─── Infinite scroll (load older messages) ───────────────────────────────────
function _initScrollObserver() {
  const sentinel = document.getElementById("thread-top-sentinel");
  if (!sentinel || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && threadState.hasMore && !threadState.isLoadingMore) {
        import("./thread_events.js").then(({ handleLoadMoreMessages }) => {
          handleLoadMoreMessages();
        });
      }
    },
    { root: document.getElementById("thread-messages-list"), threshold: 1.0 }
  );

  observer.observe(sentinel);
}
```

---

### FIX-13 · `thread_delegation.js` — Fix search panel open/close; fix modal display

**File:** `thread_delegation.js`

**Replace the search button handler (currently line 395):**

```js
// ── Search button in chat header — OPEN search panel ─────────────────────
if (_closest(t, "[data-action='thread-search']")) {
  e.preventDefault();
  const panel = document.getElementById("thread-search-panel");
  if (panel) {
    panel.classList.remove("hidden");
    panel.classList.add("flex");   // FIX: panel has flex-col but needs display
    setTimeout(() => {
      document.getElementById("thread-search-input")?.focus();
    }, 50);
  }
  return;
}

// ── Close search panel ────────────────────────────────────────────────────
if (_closest(t, "[data-action='thread-close-search']")) {
  e.preventDefault();
  const panel = document.getElementById("thread-search-panel");
  if (panel) {
    panel.classList.add("hidden");
    panel.classList.remove("flex");
  }
  import("./thread_events.js").then(({ handleClearSearch }) => {
    handleClearSearch();
  });
  return;
}
```

**Add a real-time search input listener at the end of `initThreadDelegation()`:**

```js
export function initThreadDelegation() {
  document.addEventListener("click",   _onClick,   { capture: false });
  document.addEventListener("keydown",  _onKeydown, { capture: false });
  document.addEventListener("submit",  _onSubmit,  { capture: false });

  // FIX: wire the search input to live-search as the user types
  document.addEventListener("input", _onSearchInput, { capture: false });
}

export function destroyThreadDelegation() {
  document.removeEventListener("click",   _onClick);
  document.removeEventListener("keydown",  _onKeydown);
  document.removeEventListener("submit",  _onSubmit);
  document.removeEventListener("input",  _onSearchInput);
}

let _searchDebounce = null;
function _onSearchInput(e) {
  const input = e.target;
  if (input.id !== "thread-search-input" && !input.matches("[data-role='thread-search-input']")) return;
  clearTimeout(_searchDebounce);
  const q = input.value.trim();
  if (!q) {
    import("./thread_events.js").then(({ handleClearSearch }) => handleClearSearch());
    return;
  }
  _searchDebounce = setTimeout(() => {
    import("./thread_events.js").then(({ handleThreadSearch }) => {
      handleThreadSearch(q);
    });
  }, 300);
}
```

**Fix `_openModal()` in `thread_modals.js` to use `hidden` consistently:**

```js
function _openModal(id, html) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement("div");
    modal.id        = id;
    // FIX: include "flex" so items-center/justify-center work.
    // Start hidden; show by removing "hidden".
    modal.className =
      "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);
  }
  modal.innerHTML = html;
  modal.classList.remove("hidden");   // FIX: was adding class "open" — use "hidden" toggle

  modal.addEventListener("click", (e) => {
    if (e.target === modal) _closeModal(id);
    // FIX: removed { once: true } — the once flag consumed the listener on any inner click.
  });

  return modal;
}

function _closeModal(id) {
  document.getElementById(id)?.classList.add("hidden");  // FIX: was removing "open"
}
```

---

### FIX-14 · `thread_events.js` — Fix complete attachment upload flow

**File:** `thread_events.js`  
**Replace `handleSendMessage()`:**

```js
export async function handleSendMessage() {
  const input = document.getElementById("thread-message-input")
              ?? document.querySelector("[data-role='thread-input']");
  if (!input) return;

  const text    = input.value.trim();
  const pending = threadState.pendingAttachment;

  if (!text && !pending) return;

  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  let attachmentPayload = {};

  // ── Upload attachment first, if present ────────────────────────────────────
  if (pending) {
    try {
      const { showToast } = await import("./thread_render.js");
      showToast("Uploading file…", "info");

      const { uploadAttachment } = await import("./thread_api.js");
      const result = await uploadAttachment(threadState.activeThreadId, pending.file);

      attachmentPayload = {
        attachment_url:  result.attachment_url,
        attachment_name: result.attachment_name,
        attachment_type: result.attachment_type,
        attachment_size: result.attachment_size,
      };

      // Clear pending attachment from state and strip UI
      threadState.pendingAttachment = null;
      _clearAttachmentStrip();
    } catch (err) {
      const { showToast } = await import("./thread_render.js");
      showToast("Failed to upload file. Try again.", "error");
      return;  // Don't send a broken message
    }
  }

  input.value = "";
  input.dispatchEvent(new Event("input"));  // re-evaluates send button disabled state

  handleCancelReply();
  _stopTyping();

  wsSendMessage(
    {
      text_content: text,
      reply_to_id:  _replyContext?.id ?? null,
      reply_to:     _replyContext ?? null,
      ...attachmentPayload,
    },
    token
  );
}

function _clearAttachmentStrip() {
  const strip = document.getElementById("thread-attachment-strip");
  if (strip) {
    strip.innerHTML = "";
    strip.classList.add("hidden");
  }
  // Re-evaluate send button (no attachment + empty textarea = disabled)
  const btn = document.getElementById("thread-send-btn");
  const input = document.getElementById("thread-message-input");
  if (btn && input) btn.disabled = !input.value.trim();
}
```

**In `thread_delegation.js` — fix the attach file handler to store the File object (not base64):**

```js
if (_closest(t, "[data-action='thread-attach-file']")) {
  e.preventDefault();
  let fileInput = document.getElementById("thread-file-input-hidden");
  if (!fileInput) {
    fileInput = document.createElement("input");
    fileInput.id      = "thread-file-input-hidden";
    fileInput.type    = "file";
    fileInput.accept  = "image/*,video/*,.pdf,.doc,.docx,.txt,.csv";
    fileInput.style.display = "none";
    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", async (e) => {
      const file      = e.target.files?.[0];
      const maxBytes  = 25 * 1024 * 1024;  // 25 MB — matches backend

      if (!file) return;

      if (file.size > maxBytes) {
        import("./thread_render.js").then(({ showToast }) => {
          showToast("File too large (max 25 MB)", "error");
        });
        fileInput.value = "";
        return;
      }

      // FIX: store the actual File object, not base64.
      // handleSendMessage() will upload it via uploadAttachment().
      const { threadState } = await import("./thread_state.js");
      threadState.pendingAttachment = { file, name: file.name, type: file.type, size: file.size };

      // Show preview strip
      _renderAttachmentStrip(file);

      // Enable send button
      const btn = document.getElementById("thread-send-btn");
      if (btn) btn.disabled = false;

      fileInput.value = "";
    });
  }
  fileInput.click();
  return;
}

function _renderAttachmentStrip(file) {
  const strip = document.getElementById("thread-attachment-strip");
  if (!strip) return;
  const isImage = file.type.startsWith("image/");
  strip.innerHTML = `
    <div class="flex items-center gap-2 bg-indigo-50 rounded-xl px-3 py-2 flex-1">
      <span class="text-base flex-shrink-0">${isImage ? "🖼️" : "📎"}</span>
      <span class="text-xs text-gray-700 truncate flex-1">${file.name}</span>
      <span class="text-xs text-gray-400">(${Math.round(file.size / 1024)} KB)</span>
      <button data-action="thread-clear-attachment"
              class="text-gray-400 hover:text-red-500 transition-colors text-sm ml-1">✕</button>
    </div>`;
  strip.classList.remove("hidden");
}
```

**Also add the clear-attachment delegation handler in `_onClick`:**

```js
if (_closest(t, "[data-action='thread-clear-attachment']")) {
  e.preventDefault();
  import("./thread_state.js").then(({ threadState }) => {
    threadState.pendingAttachment = null;
  });
  const strip = document.getElementById("thread-attachment-strip");
  if (strip) { strip.innerHTML = ""; strip.classList.add("hidden"); }
  const btn   = document.getElementById("thread-send-btn");
  const input = document.getElementById("thread-message-input");
  if (btn && input) btn.disabled = !input.value.trim();
  return;
}
```

---

### FIX-15 · `thread_state.js` — Add `pendingAttachment` and fix `confirmedMessageIds` memory leak

**File:** `thread_state.js`

**Add to `threadState`:**
```js
export const threadState = {
  // ... existing fields ...
  pendingAttachment: null,         // FIX: was missing — persisted across threads
  memberMap: new Map(),            // NEW: Map<userId, {name, avatar, role}> for typing names
};
```

**Add to `resetThreadSession()`:**
```js
export function resetThreadSession() {
  threadState.activeThreadId      = null;
  threadState.messages            = [];
  threadState.pendingMessages     = new Map();
  threadState.confirmedMessageIds = new Set();
  threadState.typingUsers         = new Map();
  threadState.onlineUsers         = new Map();
  threadState.hasMore             = false;
  threadState.oldestMessageId     = null;
  threadState.isLoadingMore       = false;
  threadState.pendingAttachment   = null;   // FIX: clear between threads
  threadState.memberMap           = new Map();
}
```

**Fix `confirmedMessageIds` size leak — update `addMessage()`:**

```js
export function addMessage(message) {
  if (message.id && threadState.messages.some((m) => m.id === message.id)) return false;
  if (message.id && threadState.confirmedMessageIds.has(message.id)) return false;
  if (message.client_temp_id && threadState.pendingMessages.has(message.client_temp_id)) {
    const idx = threadState.messages.findIndex((m) => m.client_temp_id === message.client_temp_id);
    if (idx !== -1) {
      threadState.messages[idx] = { ...threadState.messages[idx], id: message.id, sent_at: message.sent_at, status: message.status ?? "sent" };
    }
    threadState.pendingMessages.delete(message.client_temp_id);
    if (message.id) _addConfirmedId(message.id);
    return false;
  }
  threadState.messages.push(message);
  return true;
}

function _addConfirmedId(id) {
  threadState.confirmedMessageIds.add(id);
  // FIX: cap at 300 to prevent unbounded growth
  if (threadState.confirmedMessageIds.size > 300) {
    const first = threadState.confirmedMessageIds.values().next().value;
    threadState.confirmedMessageIds.delete(first);
  }
}
```

**Add a `setMember` helper for the member map:**

```js
export function setMember(userId, data) {
  threadState.memberMap.set(userId, data);
}
```

---

### FIX-16 · `thread_render.js` — Fix typing name lookup; add `markMessageFailed`

**File:** `thread_render.js`

**Replace `renderTypingIndicator()` name lookup:**

```js
export function renderTypingIndicator() {
  const container = _msgContainer();
  if (!container) return;

  let indicator = document.getElementById("thread-typing-indicator");
  const typingIds = getTypingUsers();

  if (!typingIds.length) {
    indicator?.remove();
    return;
  }

  // FIX: was looking in messages array — use memberMap instead for accuracy.
  const names = typingIds
    .map((id) => {
      const member = threadState.memberMap.get(id);
      if (member) return member.name;
      // Fallback: search messages
      const m = threadState.messages.find((msg) => msg.sender_id === id);
      return m?.sender?.name ?? "Someone";
    })
    .filter(Boolean);

  const text = names.length === 1
    ? `${names[0]} is typing…`
    : `${names.slice(0, 2).join(", ")} are typing…`;

  if (!indicator) {
    container.insertAdjacentHTML("beforeend", typingIndicatorTemplate(text));
  } else {
    indicator.querySelector(".typing-text")?.replaceChildren(document.createTextNode(text));
  }
}
```

**Add `markMessageFailed()` (used by `thread_message_error` WS handler):**

```js
export function markMessageFailed(clientTempId) {
  const el = document.querySelector(`[data-temp-id="${clientTempId}"]`);
  if (!el) return;
  el.classList.remove("message-pending", "opacity-70");
  el.classList.add("message-failed");

  const statusEl = el.querySelector(".msg-status-icon");
  if (statusEl) statusEl.innerHTML = `
    <svg class="status-icon failed w-3.5 h-3.5 text-red-400"
         viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
      <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" stroke-width="1.5"
            stroke-linecap="round"/>
      <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
    </svg>`;

  // Add retry button if not already present
  if (!el.querySelector("[data-action='thread-retry']")) {
    el.insertAdjacentHTML("beforeend", `
      <button class="msg-retry-btn text-xs text-red-500 hover:text-red-700 underline mt-0.5 px-1"
              data-action="thread-retry"
              data-temp-id="${clientTempId}">
        Retry
      </button>`);
  }
}
```

---

### FIX-17 · `thread_events.js` — Fix `handleOpenThread` to populate memberMap and avoid WS collision

**File:** `thread_events.js`

**Replace `handleOpenThread()`:**

```js
export async function handleOpenThread(threadId) {
  try {
    const { showThreadView, renderMessages, renderThreadHeader, showToast } =
      await import("./thread_render.js");

    // FIX: Disconnect existing thread before opening new one.
    // Without this, switching threads rapidly joins multiple rooms.
    const prevId = threadState.activeThreadId;
    if (prevId && prevId !== threadId) {
      const prevToken = localStorage.getItem("token") || sessionStorage.getItem("token");
      const { disconnectThreadWebSocket } = await import("./thread_websocket.js");
      disconnectThreadWebSocket(prevId, prevToken);
      // Don't call resetThreadSession() here — we want the list to persist.
      // Only clear per-thread state:
      threadState.messages        = [];
      threadState.pendingMessages = new Map();
      threadState.confirmedMessageIds = new Set();
      threadState.typingUsers     = new Map();
      threadState.hasMore         = false;
      threadState.oldestMessageId = null;
      threadState.isLoadingMore   = false;
      threadState.pendingAttachment = null;
      threadState.memberMap         = new Map();
    }

    showThreadView(threadId);
    threadState.activeThreadId = threadId;

    const [detail, msgData, members] = await Promise.all([
      fetchThread(threadId),
      fetchMessages(threadId, { limit: THREAD_UI.MESSAGES_PER_PAGE }),
      fetchThreadMembers(threadId),
    ]);

    const { thread, user_status } = detail;

    // FIX: populate memberMap so typing names resolve correctly
    const { setMember } = await import("./thread_state.js");
    members.forEach((m) => setMember(m.user_id ?? m.id, { name: m.name, avatar: m.avatar, role: m.role }));

    addOrUpdateThreadInList({
      id:           thread.id,
      title:        thread.title,
      avatar:       thread.avatar,
      department:   thread.department,
      tags:         thread.tags,
      is_open:      thread.is_open,
      max_members:  thread.max_members,
      your_role:    user_status?.your_role,
      ...(typeof thread.member_count === "number" && { member_count: thread.member_count }),
    });

    // Pass user_status so header can show role/permissions
    renderThreadHeader(thread, user_status);

    threadState.messages        = msgData.messages ?? [];
    threadState.hasMore         = msgData.has_more ?? false;
    threadState.oldestMessageId = msgData.oldest_id ?? null;

    renderMessages(threadState.messages);

    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    const { socket } = await import("./thread_init.js");
    const { initThreadWebSocket } = await import("./thread_websocket.js");
    initThreadWebSocket(socket, threadId, token);

    emitMarkRead(threadId, token);
    addOrUpdateThreadInList({ id: threadId, unread_count: 0 });

  } catch (err) {
    console.error("[thread_events] openThread:", err);
    const { showThreadError } = await import("./thread_render.js");
    showThreadError("Failed to open thread");
  }
}
```

---

### FIX-18 · `thread_events.js` — Fix `handleCreateThread` result path

**File:** `thread_events.js` line 201  
**Replace:**

```js
// Before:
const newId = result.data?.thread?.id ?? result.thread?.id;

// After:
const newId = result?.thread?.id ?? result?.data?.thread?.id ?? result?.data?.data?.thread?.id;
```

---

### FIX-19 · `thread_events.js` — Fix `handleAcceptInvite` thread ID path

**File:** `thread_events.js` lines 640–643  
**Replace:**

```js
export async function handleAcceptInvite(inviteId) {
  try {
    const result = await acceptInvite(inviteId);
    const { showToast } = await import("./thread_render.js");
    showToast("Invitation accepted!");

    // FIX: try multiple possible paths depending on api client behavior
    const threadId =
      result?.data?.thread_id ??
      result?.data?.data?.thread_id ??
      result?.thread_id;

    if (threadId) {
      await handleOpenThread(threadId);
    } else {
      // Reload thread list so the new thread appears
      await handleLoadThreadList();
    }
  } catch (err) {
    const { showToast } = await import("./thread_render.js");
    showToast(err.message || "Failed to accept invite", "error");
  }
}
```

---

### FIX-20 · `thread_events.js` — Fix `handleJoinThread` to show join message modal

**File:** `thread_events.js`  
**Replace:**

```js
export async function handleJoinThread(threadId) {
  try {
    // Fetch thread details to check if approval is required
    const { thread } = await fetchThread(threadId);
    const { openJoinRequestModal } = await import("./thread_modals.js");
    const { showToast }            = await import("./thread_render.js");

    openJoinRequestModal(thread, async (message) => {
      try {
        const result = await requestJoinThread(threadId, message ? { message } : {});
        showToast(
          thread.requires_approval
            ? "Join request sent! Waiting for approval."
            : "You joined the thread!",
          "success"
        );
        if (!thread.requires_approval) {
          await handleLoadThreadList();
          await handleOpenThread(threadId);
        }
      } catch (err) {
        showToast(err.message || "Failed to request join", "error");
      }
    });
  } catch (err) {
    const { showToast } = await import("./thread_render.js");
    showToast(err.message || "Failed to load thread details", "error");
  }
}
```

---

### FIX-21 · `thread_templates.js` — Replace inline `<script>` in pin banner with data attribute

**File:** `thread_templates.js`  
**Replace `pinnedMessagesBannerTemplate()`:**

The function injects `<script>` via `innerHTML` which browsers do not execute. Replace with a pure data-driven approach and handle navigation in delegation.

```js
export function pinnedMessagesBannerTemplate(pinnedMessages) {
  if (!pinnedMessages || !pinnedMessages.length) return "";

  const count     = pinnedMessages.length;
  const firstPin  = pinnedMessages[0];
  const firstText = esc((firstPin.text_content ?? "📎 Attachment").slice(0, 80));
  const firstSender = esc(firstPin.sender?.name ?? "");

  // FIX: embed all pins as data-pins JSON on the banner element.
  // Navigation handled by delegation (see delegation FIX-22).
  const pinsJson = escAttr(JSON.stringify(
    pinnedMessages.map((p) => ({
      id:     p.id,
      text:   (p.text_content ?? "📎 Attachment").slice(0, 80),
      sender: p.sender?.name ?? "",
    }))
  ));

  const countLabel = count > 1
    ? `<span class="pin-count-label text-[10px] font-bold text-indigo-600 uppercase tracking-wide">
         ${count} pinned
       </span>`
    : "";

  const navHtml = count > 1
    ? `<div class="pin-nav flex flex-col gap-0.5">
         <button class="pin-nav-btn w-5 h-5 rounded flex items-center justify-center text-[10px]
                         text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                 data-pin-dir="-1" aria-label="Previous pinned message">▲</button>
         <button class="pin-nav-btn w-5 h-5 rounded flex items-center justify-center text-[10px]
                         text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                 data-pin-dir="1" aria-label="Next pinned message">▼</button>
       </div>`
    : "";

  return `
    <div class="thread-pinned-banner flex items-center gap-2 px-3 py-2 bg-indigo-50 border-b border-indigo-100"
         data-pin-index="0"
         data-pin-count="${count}"
         data-pins="${pinsJson}">

      <button class="pin-icon-btn text-base flex-shrink-0 hover:scale-110 transition-transform"
              data-action="thread-scroll-to-message"
              data-message-id="${firstPin.id}"
              aria-label="Scroll to pinned message">📌</button>

      <div class="pin-content flex-1 min-w-0 cursor-pointer"
           data-action="thread-scroll-to-message"
           data-message-id="${firstPin.id}">
        ${countLabel}
        <p class="pin-sender text-xs font-semibold text-indigo-700 leading-tight">${firstSender}</p>
        <p class="pin-text text-xs text-gray-600 truncate">${firstText}</p>
      </div>

      ${navHtml}

      <button class="pin-view-all-btn flex-shrink-0 text-xs font-semibold text-indigo-600
                      hover:text-indigo-800 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
              data-action="thread-open-pinned-list">
        All
      </button>
    </div>`;
}
```

---

### FIX-22 · `thread_delegation.js` — Handle pin banner navigation (replaces inline script)

**File:** `thread_delegation.js`  
**Add inside `_onClick()` before the `return` fallthrough at the bottom:**

```js
// ── Pinned banner navigation ──────────────────────────────────────────────
const pinNavBtn = _closest(t, ".pin-nav-btn");
if (pinNavBtn) {
  e.stopPropagation();
  const banner = pinNavBtn.closest(".thread-pinned-banner");
  if (!banner) return;

  let pins;
  try {
    pins = JSON.parse(banner.dataset.pins ?? "[]");
  } catch {
    return;
  }

  let idx = parseInt(banner.dataset.pinIndex ?? "0", 10);
  idx = (idx + parseInt(pinNavBtn.dataset.pinDir, 10) + pins.length) % pins.length;
  banner.dataset.pinIndex = String(idx);

  const pin = pins[idx];
  if (!pin) return;

  const content = banner.querySelector(".pin-content");
  if (content) {
    content.dataset.messageId = String(pin.id);
    const senderEl = content.querySelector(".pin-sender");
    const textEl   = content.querySelector(".pin-text");
    if (senderEl) senderEl.textContent = pin.sender;
    if (textEl)   textEl.textContent   = pin.text;
  }
  const iconBtn = banner.querySelector(".pin-icon-btn");
  if (iconBtn) iconBtn.dataset.messageId = String(pin.id);
  return;
}
```

---

### FIX-23 · `thread_modals.js` — Fix `requires_approval` inline import path

**File:** `thread_modals.js` lines 281–284  
**Replace the inline `onchange` with a `data-action`:**

```html
<!-- Before (in openInfoModal): -->
<input type="checkbox" onchange="(async()=>{
  const {updateThreadSettings} = await import('./thread.api.js');
  ...
})()">

<!-- After: -->
<input type="checkbox"
       id="thread-info-requires-approval"
       data-action="thread-toggle-approval"
       data-thread-id="${threadId}"
       ${thread.requires_approval ? "checked" : ""}
       class="w-4 h-4 rounded accent-indigo-600 cursor-pointer">
```

**Add delegation handler in `thread_delegation.js`:**

```js
// ── Requires approval toggle (in info modal) ──────────────────────────────
const approvalToggle = _closest(t, "[data-action='thread-toggle-approval']");
if (approvalToggle) {
  const threadId        = Number(approvalToggle.dataset.threadId ?? threadState.activeThreadId);
  const requiresApproval = approvalToggle.checked;
  if (threadId) {
    import("./thread_api.js").then(({ updateThreadSettings }) => {
      updateThreadSettings(threadId, { requires_approval: requiresApproval })
        .then(() => {
          import("./thread_render.js").then(({ showToast }) => {
            showToast(`Approval ${requiresApproval ? "enabled" : "disabled"}`);
          });
        })
        .catch(() => {
          import("./thread_render.js").then(({ showToast }) => {
            showToast("Failed to update setting", "error");
          });
          approvalToggle.checked = !requiresApproval; // revert
        });
    });
  }
  return;
}
```

---

### FIX-24 · `thread_events.js` — Replace `confirm()` with custom confirm modal

**File:** `thread_events.js`  
**Replace `handleRemoveMember()` and `handleLeaveThread()`:**

```js
export async function handleRemoveMember(threadId, userId) {
  const confirmed = await _showConfirm("Remove Member", "Remove this member from the thread?");
  if (!confirmed) return;
  try {
    await removeMember(threadId, userId);
    addOrUpdateThreadInList({
      id: threadId,
      member_count: (threadState.threadList.get(threadId)?.member_count ?? 1) - 1,
    });
    const { showToast } = await import("./thread_render.js");
    showToast("Member removed");
    await handleOpenInfo();
  } catch (err) {
    const { showToast } = await import("./thread_render.js");
    showToast(err.message || "Failed to remove member", "error");
  }
}

export async function handleLeaveThread(threadId) {
  const confirmed = await _showConfirm("Leave Thread", "Are you sure you want to leave this thread?");
  if (!confirmed) return;
  try {
    await leaveThread(threadId);
    addOrUpdateThreadInList({
      id: threadId,
      member_count: (threadState.threadList.get(threadId)?.member_count ?? 1) - 1,
    });
    await handleBackToList();
  } catch (err) {
    const { showToast } = await import("./thread_render.js");
    showToast(err.message || "Failed to leave thread", "error");
  }
}

/**
 * Show the custom confirm modal.
 * Returns a Promise<boolean> that resolves when the user clicks OK or Cancel.
 */
function _showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal   = document.getElementById("thread-confirm-modal");
    const titleEl = document.getElementById("thread-confirm-title");
    const msgEl   = document.getElementById("thread-confirm-message");
    if (!modal) { resolve(window.confirm(message)); return; }

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;

    modal.classList.remove("hidden");

    const okBtn     = document.getElementById("thread-confirm-ok");
    const cancelBtn = modal.querySelector("[data-action='thread-confirm-cancel']");

    function cleanup() {
      modal.classList.add("hidden");
      okBtn?.removeEventListener("click", onOk);
      cancelBtn?.removeEventListener("click", onCancel);
    }
    function onOk()     { cleanup(); resolve(true);  }
    function onCancel() { cleanup(); resolve(false); }

    okBtn?.addEventListener("click", onOk,     { once: true });
    cancelBtn?.addEventListener("click", onCancel, { once: true });
  });
}
```

---

## PHASE 4 — Backend Fixes

---

### FIX-25 · `threads.py` — Fix unread count for new members with NULL `last_read_at`

**File:** `threads.py` lines 1617–1626  
**Replace:**

```python
# Before:
unread_count = 0
if membership.last_read_at:
    unread_count = ThreadMessage.query.filter(
        ThreadMessage.thread_id == thread.id,
        ThreadMessage.sent_at   >  membership.last_read_at,
        ...
    ).count()

# After:
cutoff       = membership.last_read_at or datetime.datetime(2000, 1, 1)
unread_count = ThreadMessage.query.filter(
    ThreadMessage.thread_id == thread.id,
    ThreadMessage.sent_at   >  cutoff,
    ThreadMessage.sender_id != current_user.id,
    ThreadMessage.is_deleted == False
).count()
```

---

### FIX-26 · `threads.py` — Allow member messaging in closed threads

**File:** `threads.py` REST `send_thread_message()` and `websocket_threads.py` WS handler  

The `is_open` flag should only block NEW JOIN REQUESTS, not block messaging.

**In `websocket_threads.py` `handle_send_thread_message`, remove the is_open check:**

```python
# Remove these lines (around line 451-453):
# if not thread.is_open:
#     self._emit_error("This thread is closed")
#     return
```

**In `threads.py` REST `send_thread_message`, remove the is_open check if present.**

**Update `close_thread()` docstring:**

```python
def close_thread(current_user, thread_id):
    """
    Close thread: stops new join requests.
    Does NOT block existing members from messaging.
    """
```

---

### FIX-27 · `threads.py` — Fix `delete_thread_message` text consistency

**File:** `threads.py` line 1585  
**Replace:**

```python
# Before:
message.text_content = "[deleted]"

# After (match WS handler):
message.text_content = "[deleted]"   # already matches — verify websocket_threads.py line 841
```

**In `websocket_threads.py` line 841:**

```python
# Before:
msg.text_content = "[Message deleted]"

# After:
msg.text_content = "[deleted]"   # standardize with REST handler
```

---

### FIX-28 · `websocket_threads.py` — Fix `mark_thread_read` N+1 read receipt inserts

**File:** `websocket_threads.py` `handle_mark_thread_read()`  
**Replace the read receipt section:**

```python
now = datetime.datetime.utcnow()

# Find unread messages not sent by this user
unread_messages = ThreadMessage.query.filter(
    ThreadMessage.thread_id == thread_id,
    ThreadMessage.sender_id != user_id,
    ThreadMessage.is_deleted == False,
    ThreadMessage.sent_at > (membership.last_read_at or datetime.datetime(2000, 1, 1)),
).all()

if not unread_messages:
    # Update last_read_at even if nothing new
    ThreadMember.query.filter_by(thread_id=thread_id, student_id=user_id).update(
        {ThreadMember.last_read_at: now}, synchronize_session=False
    )
    db.session.commit()
    return

msg_ids = [m.id for m in unread_messages]

# FIX: single query to find existing receipts instead of one per message
existing_receipt_ids = {
    r.message_id for r in ThreadMessageReadReceipt.query.filter(
        ThreadMessageReadReceipt.message_id.in_(msg_ids),
        ThreadMessageReadReceipt.user_id == user_id
    ).all()
}

# Batch-insert missing receipts
new_receipts = [
    ThreadMessageReadReceipt(message_id=mid, user_id=user_id, read_at=now)
    for mid in msg_ids
    if mid not in existing_receipt_ids
]
db.session.add_all(new_receipts)

# FIX: single bulk status update instead of one per message
ThreadMessage.query.filter(
    ThreadMessage.id.in_(msg_ids),
    ThreadMessage.status != 'read'
).update({ThreadMessage.status: 'read'}, synchronize_session=False)

# Collect sender → message_ids map for WS status pushes
sender_msg_map: dict[int, list[int]] = {}
for msg in unread_messages:
    sender_msg_map.setdefault(msg.sender_id, []).append(msg.id)

ThreadMember.query.filter_by(thread_id=thread_id, student_id=user_id).update(
    {ThreadMember.last_read_at: now}, synchronize_session=False
)
db.session.commit()

for sender_id, ids in sender_msg_map.items():
    self.socketio.emit(
        "message_status_updated",
        {"thread_id": thread_id, "message_ids": ids, "status": "read", "by_user_id": user_id},
        room=_user_room(sender_id)
    )
```

---

### FIX-29 · `threads.py` — Fix rejected request cooldown `NoneType` crash

**File:** `threads.py` line 2193  
**Replace:**

```python
elif existing_request.status == "rejected":
    # FIX: reviewed_at may be None if record was manually created or migrated
    if existing_request.reviewed_at:
        cooldown_period      = datetime.timedelta(hours=24)
        time_since_rejection = datetime.datetime.utcnow() - existing_request.reviewed_at
        if time_since_rejection < cooldown_period:
            remaining = int((cooldown_period - time_since_rejection).total_seconds() / 3600)
            return error_response(f"Please wait {remaining} hours before requesting again", 429)
    # If reviewed_at is None, allow re-request without cooldown
    existing_request.status       = "pending"
    existing_request.requested_at = datetime.datetime.utcnow()
    existing_request.reviewed_at  = None
    existing_request.reviewed_by  = None
    existing_request.message      = message or existing_request.message
    ...
```

---

## PHASE 5 — Long-Press Module Fix

---

### FIX-30 · `thread_constants.js` — Add long-press constants

**File:** `thread_constants.js`  
**Add to `THREAD_UI`:**

```js
export const THREAD_UI = {
  TYPING_TIMEOUT_MS:      3500,
  MESSAGES_PER_PAGE:      30,
  SCROLL_LOAD_THRESHOLD:  120,
  HIGHLIGHT_DURATION_MS:  2500,
  MAX_ATTACHMENT_MB:      25,
  RETRY_MAX_ATTEMPTS:     3,
  // FIX: was missing — imported by thread_longpress.js
  LONG_PRESS_DURATION_MS: 500,
  LONG_PRESS_THRESHOLD_PX: 10,
};
```

---

### FIX-31 · `thread_longpress.js` — Fix all broken imports and data attribute

**File:** `thread_longpress.js`  
**Replace the entire file:**

```js
/**
 * thread_longpress.js
 * Long-press (mobile) and right-click (desktop) to open message options sheet.
 */

import { THREAD_UI } from './thread_constants.js';
// FIX: no longer importing openThreadMessageOptions from modals — 
// uses delegation's action system instead.


// ─── State ────────────────────────────────────────────────────────────────────

let _listEl          = null;
let _pressTimer      = null;
let _startX          = 0;
let _startY          = 0;
let _didMove         = false;
let _touchStarted    = false;
let _activeMessageId = null;


// ─── Attach / Detach ─────────────────────────────────────────────────────────

export function attachThreadLongPress(listEl) {
  if (_listEl === listEl) return;
  detachThreadLongPress();
  _listEl = listEl;
  _listEl.addEventListener('touchstart',  _onTouchStart,  { passive: true });
  _listEl.addEventListener('touchmove',   _onTouchMove,   { passive: true });
  _listEl.addEventListener('touchend',    _onTouchEnd,    { passive: true });
  _listEl.addEventListener('touchcancel', _onTouchCancel, { passive: true });
  _listEl.addEventListener('contextmenu', _onContextMenu);
}

export function detachThreadLongPress() {
  if (!_listEl) return;
  _listEl.removeEventListener('touchstart',  _onTouchStart);
  _listEl.removeEventListener('touchmove',   _onTouchMove);
  _listEl.removeEventListener('touchend',    _onTouchEnd);
  _listEl.removeEventListener('touchcancel', _onTouchCancel);
  _listEl.removeEventListener('contextmenu', _onContextMenu);
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
  }, THREAD_UI.LONG_PRESS_DURATION_MS);   // FIX: was THREAD_LONG_PRESS_DURATION
}

function _onTouchMove(e) {
  if (!_touchStarted) return;
  const touch = e.touches[0];
  const dx    = Math.abs(touch.clientX - _startX);
  const dy    = Math.abs(touch.clientY - _startY);
  if (dx > THREAD_UI.LONG_PRESS_THRESHOLD_PX || dy > THREAD_UI.LONG_PRESS_THRESHOLD_PX) {
    _didMove = true;
    _clearTimer();
  }
}

function _onTouchEnd()   { _touchStarted = false; _clearTimer(); }
function _onTouchCancel(){ _touchStarted = false; _clearTimer(); }


// ─── Context menu ─────────────────────────────────────────────────────────────

function _onContextMenu(e) {
  const msgEl = _getMessageWrapper(e.target);
  if (!msgEl) return;
  const messageId = _getMessageId(msgEl);
  if (!messageId) return;
  e.preventDefault();
  _openOptionsSheet(messageId);
}


// ─── Options sheet ────────────────────────────────────────────────────────────

function _openOptionsSheet(messageId) {
  // FIX: was calling openThreadMessageOptions() which doesn't exist.
  // Now dispatches a custom event that thread_delegation.js can handle,
  // keeping all action routing in one place.
  const sheet    = document.getElementById("thread-message-options-sheet");
  const panel    = document.getElementById("thread-options-panel");
  const body     = document.getElementById("thread-msg-options-body");
  if (!sheet || !panel || !body) return;

  // Dynamically import state to get message data
  import("./thread_state.js").then(({ threadState }) => {
    const msg = threadState.messages.find((m) => m.id === messageId);
    if (!msg) return;

    const isOwn  = msg.sender_id === threadState.currentUser?.id;
    const isPinned = msg.is_pinned;

    body.innerHTML = _buildOptionsHTML(messageId, isOwn, isPinned);
    sheet.classList.remove("hidden");
    requestAnimationFrame(() => {
      panel.style.transform = "translateY(0)";
    });

    // Close on backdrop click
    const backdrop = document.getElementById("thread-options-backdrop");
    backdrop?.addEventListener("click", _closeOptionsSheet, { once: true });
  });
}

function _closeOptionsSheet() {
  const sheet = document.getElementById("thread-message-options-sheet");
  const panel = document.getElementById("thread-options-panel");
  if (panel) panel.style.transform = "translateY(100%)";
  setTimeout(() => sheet?.classList.add("hidden"), 250);
}

function _buildOptionsHTML(messageId, isOwn, isPinned) {
  const btn = (action, icon, label, danger = false) => `
    <button class="flex items-center gap-3 w-full px-5 py-3.5 text-sm
                   ${danger ? "text-red-600 hover:bg-red-50" : "text-gray-800 hover:bg-gray-50"}
                   transition-colors"
            data-action="${action}"
            data-message-id="${messageId}"
            onclick="document.getElementById('thread-message-options-sheet').classList.add('hidden')">
      <span class="text-lg w-6 text-center">${icon}</span>
      <span>${label}</span>
    </button>`;

  return [
    btn("thread-reply",        "↩️",  "Reply"),
    btn("thread-open-emoji-picker", "😊", "React"),
    isOwn  ? btn("thread-edit-message",   "✏️",  "Edit")           : "",
    isPinned ? btn("thread-pin-message",  "📌",  "Unpin")          : btn("thread-pin-message", "📌", "Pin"),
    isOwn  ? btn("thread-delete-message", "🗑️",  "Delete", true)   : "",
  ].join("");
}


// ─── Helpers ─────────────────────────────────────────────────────────────────

function _getMessageWrapper(el) {
  // FIX: was looking for [data-thread-message-id]; templates use [data-message-id]
  return el?.closest?.('[data-message-id]') ?? null;
}

function _getMessageId(el) {
  const raw = el?.dataset?.messageId;   // FIX: was dataset.threadMessageId
  const id  = parseInt(raw, 10);
  return isNaN(id) || id === 0 ? null : id;
}

function _clearTimer() {
  if (_pressTimer) { clearTimeout(_pressTimer); _pressTimer = null; }
}

function _vibrate() {
  try { navigator.vibrate?.(30); } catch { /* ignore */ }
}
```

---

## PHASE 6 — Pending Invites & Thread List Init

---

### FIX-32 · `thread_init.js` — Load pending invites on init

**File:** `thread_init.js`  
**Add after step 4 (load thread list):**

```js
// ── 5. Load pending invites ───────────────────────────────────────────────
await _loadPendingInvites();
```

**Add the function:**

```js
async function _loadPendingInvites() {
  try {
    const { getMyInvites } = await import("./thread_api.js");
    const invites = await getMyInvites();
    if (!invites.length) return;

    const container = document.getElementById("thread-invites-container");
    const list      = document.getElementById("thread-invites-list");
    if (!container || !list) return;

    list.innerHTML = invites.map((invite) => `
      <div class="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
           data-invite-id="${invite.invite_id}">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-gray-900 truncate">${invite.thread?.title ?? "Thread"}</p>
          <p class="text-xs text-gray-400">
            From ${invite.invited_by?.name ?? "Someone"}
          </p>
        </div>
        <div class="flex gap-1.5 flex-shrink-0">
          <button data-action="thread-accept-invite"
                  data-invite-id="${invite.invite_id}"
                  class="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                         rounded-lg px-2.5 py-1.5 transition-colors">
            Accept
          </button>
          <button data-action="thread-decline-invite"
                  data-invite-id="${invite.invite_id}"
                  class="text-xs font-semibold text-gray-600 hover:bg-gray-100
                         rounded-lg px-2.5 py-1.5 transition-colors border border-gray-200">
            Decline
          </button>
        </div>
      </div>`
    ).join("");

    container.classList.remove("hidden");
  } catch (err) {
    console.warn("[thread_init] invites load failed:", err);
  }
}
```

---

## PHASE 7 — Remaining Backend Performance Fixes

---

### FIX-33 · `threads.py` — Fix `get_recommended_threads` N+1 friend name query

**File:** `threads.py` inside `get_recommended_threads()`  
**Replace the friend names lookup inside the thread loop:**

```python
# Before the loop, preload all friend User objects:
friend_user_map = {}
if friend_ids:
    friend_user_map = {
        u.id: u for u in User.query.filter(User.id.in_(friend_ids)).all()
    }

# Inside the loop, replace:
# friend_names = [User.query.get(fid).name for fid in list(friends_in_thread)[:2] if User.query.get(fid)]
# With:
friend_names = [
    friend_user_map[fid].name
    for fid in list(friends_in_thread)[:2]
    if fid in friend_user_map
]
```

---

### FIX-34 · `models.py` — Add composite index for most common ThreadMessage query

**File:** `models.py` (ThreadMessage model)  
**Add to `ThreadMessage.__table_args__` (create one if not present):**

```python
class ThreadMessage(db.Model):
    # ... existing columns ...
    
    __table_args__ = (
        db.Index(
            "idx_tm_thread_active_time",
            "thread_id", "is_deleted", "sent_at"
        ),
        db.Index(
            "idx_tm_thread_pinned",
            "thread_id", "is_pinned", "is_deleted"
        ),
    )
```

---

## Quick Reference — Fix Checklist

| # | File | Description | Priority |
|---|------|-------------|----------|
| FIX-01 | thread_api.js | Remove showToast crash from fetchCurrentUser | 🔴 CRITICAL |
| FIX-02 | thread_init.js | Fix typos in error messages | 🟡 |
| FIX-03 | thread_constants.js | Align ALL WS event names to server | 🔴 CRITICAL |
| FIX-04 | thread_websocket.js | Rewrite with correct emit/listen names | 🔴 CRITICAL |
| FIX-05 | thread_events.js | Fix reaction emit name | 🔴 CRITICAL |
| FIX-06 | thread_events.js | Fix pin button to toggle pin/unpin | 🟠 |
| FIX-07 | websocket_threads.py | Add `is_pinned` to pin/unpin payloads | 🔴 CRITICAL |
| FIX-08 | thread_init.js | Fix reconnect handler duplicate listeners | 🔴 CRITICAL |
| FIX-09 | threads.py | Broadcast WS event on thread delete | 🟠 |
| FIX-10 | threads.py | Broadcast WS event on member remove | 🟠 |
| FIX-11 | threads.html | Add `flex` to modals, search input, sentinel | 🔴 CRITICAL |
| FIX-12 | thread_init.js | Wire send button, IntersectionObserver | 🔴 CRITICAL |
| FIX-13 | thread_delegation.js | Fix search panel open/close + live search | 🔴 CRITICAL |
| FIX-14 | thread_events.js | Complete attachment upload flow | 🔴 CRITICAL |
| FIX-15 | thread_state.js | Add pendingAttachment; cap confirmedMessageIds | 🟠 |
| FIX-16 | thread_render.js | Fix typing names; add markMessageFailed | 🟠 |
| FIX-17 | thread_events.js | Fix handleOpenThread (multi-room, memberMap) | 🟠 |
| FIX-18 | thread_events.js | Fix createThread result path | 🟡 |
| FIX-19 | thread_events.js | Fix acceptInvite thread_id path | 🟡 |
| FIX-20 | thread_events.js | Show join modal for requires_approval threads | 🟠 |
| FIX-21 | thread_templates.js | Replace inline `<script>` in pin banner | 🔴 CRITICAL |
| FIX-22 | thread_delegation.js | Handle pin banner navigation | 🟠 |
| FIX-23 | thread_modals.js | Fix inline import in requires_approval toggle | 🟠 |
| FIX-24 | thread_events.js | Replace confirm() with custom modal | 🟠 |
| FIX-25 | threads.py | Fix unread count for new members | 🟠 |
| FIX-26 | websocket_threads.py | Allow messaging in closed threads | 🟠 |
| FIX-27 | websocket_threads.py | Standardize deleted message text | 🟡 |
| FIX-28 | websocket_threads.py | Batch mark_thread_read queries | 🟠 |
| FIX-29 | threads.py | Fix cooldown None crash on re-request | 🟠 |
| FIX-30 | thread_constants.js | Add LONG_PRESS constants | 🟠 |
| FIX-31 | thread_longpress.js | Fix all broken imports and data attribute | 🟠 |
| FIX-32 | thread_init.js | Load pending invites on init | 🟡 |
| FIX-33 | threads.py | Fix N+1 friend name queries | 🟡 |
| FIX-34 | models.py | Add composite indexes | 🟡 |

**Total estimated time to apply all fixes: 6–9 hours**  
**Minimum viable fix set (🔴 only): ~2 hours — restores core chat functionality**
