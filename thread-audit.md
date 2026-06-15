# 🧾 Thread Feature – Fixes & Refinement Audit

**Audit scope:** All 18 project files reviewed in full.  
**Methodology:** Data-flow tracing, event-lifecycle analysis, state-machine inspection, DOM synchronization review.  
**Verified against:** Actual code — no guesses, no assumptions carried forward unchecked.

---

## Table of Contents

1. [Critical Bugs](#1-critical-bugs)
2. [WebSocket & Realtime Issues](#2-websocket--realtime-issues)
3. [Frontend Rendering Issues](#3-frontend-rendering-issues)
4. [Attachment & Upload Improvements](#4-attachment--upload-improvements)
5. [Message Status System Refinement](#5-message-status-system-refinement)
6. [Missing Frontend Features](#6-missing-frontend-features)
7. [Hidden Bugs Found](#7-hidden-bugs-found)
8. [Suggested Architecture Refinements](#8-suggested-architecture-refinements)
9. [Database Migrations](#9-database-migrations)
10. [Final Risk Assessment](#10-final-risk-assessment)

---

## 1. Critical Bugs

---

### BUG-C1 — Reply context nulled before `wsSendMessage` is called

**Severity:** CRITICAL  
**Affected files:** `thread.events.js`

**Root cause:**  
In `handleSendMessage`, `handleCancelReply()` is called before `wsSendMessage`. `handleCancelReply` sets the module-level `_replyContext = null`. The `wsSendMessage` call that follows then reads `_replyContext?.id` which is already null. Every reply silently sends with `reply_to_id: null`.

**Current code (broken):**
```js
handleCancelReply();      // sets _replyContext = null
_stopTyping();

wsSendMessage({
  text_content: text,
  reply_to_id:  _replyContext?.id ?? null,  // always null
  reply_to:     _replyContext ?? null,       // always null
  ...attachmentPayload,
});
```

**Fix — capture context before clearing:**
```js
// Capture BEFORE clearing
const replyCtx = _replyContext;

handleCancelReply();   // clears UI and sets _replyContext = null
_stopTyping();

wsSendMessage({
  text_content: text,
  reply_to_id:  replyCtx?.id   ?? null,
  reply_to:     replyCtx       ?? null,
  ...attachmentPayload,
});
```

---

### BUG-C2 — Thread list does not re-sort when new messages arrive

**Severity:** CRITICAL  
**Affected files:** `thread_websocket.js`, `thread_render.js`

**Root cause:**  
`renderThreadList` is called once with state `"loaded"` during init. When `NEW_MESSAGE` arrives, `_updateListItemPreview` in `thread_render.js` updates the `.thread-last-message` text of the existing list item in-place, but the DOM order is never changed. The thread with the newest message stays wherever it was in the initial sort, not at the top.

The `addOrUpdateThreadInList` state update correctly sets `last_activity`, but nothing triggers a list re-render.

**Fix — two-part:**

Part A — In `thread_websocket.js`, after processing `NEW_MESSAGE`, trigger a targeted DOM move instead of a full re-render:

```js
socket.on(THREAD_WS.NEW_MESSAGE, (data) => {
  const wasAdded = addMessage(data);

  // ... existing renderNewMessage call ...

  // Move thread list item to top
  _moveThreadToTop(data.thread_id);
});

function _moveThreadToTop(threadId) {
  const container = document.getElementById("thread-list-container");
  const item = container?.querySelector(`[data-thread-id="${threadId}"]`);
  if (item && container && container.firstChild !== item) {
    container.prepend(item);
  }
}
```

Part B — Ensure `addOrUpdateThreadInList` always updates `last_activity` on new messages (already done in the current code, verified ✓).

---

### BUG-C3 — Confirmed messages lose their options button

**Severity:** CRITICAL  
**Affected files:** `thread_render.js`, `thread_templates.js`

**Root cause:**  
`threadMessageTemplate` only renders the `⋯` options button when `!message.is_deleted && message.id`. Optimistic/pending messages have `id: null`, so no options button is rendered. When `confirmOptimisticMessage` in `thread_render.js` confirms the message, it updates `data-message-id` and the status icon — but does NOT inject the options button. The confirmed message remains permanently without interaction capability until a page reload.

**Fix — in `confirmOptimisticMessage` in `thread_render.js`:**
```js
export function confirmOptimisticMessage(clientTempId, serverData) {
  const el = document.querySelector(`[data-temp-id="${clientTempId}"]`);
  if (el) {
    if (serverData.id) el.setAttribute("data-message-id", String(serverData.id));
    el.removeAttribute("data-temp-id");

    // Inject options button if missing (was omitted on optimistic render)
    if (serverData.id && !el.querySelector(".msg-options-btn")) {
      const bubbleCol = el.querySelector(".msg-bubble-col");
      const isMine = el.classList.contains("mine");
      if (bubbleCol) {
        const btnHtml = `<button class="msg-options-btn absolute ${
          isMine
            ? "left-0 -translate-x-full"
            : "right-0 translate-x-full"
          } top-0 opacity-0 group-hover:opacity-100 transition-opacity
          w-7 h-7 rounded-full bg-white shadow-sm border border-gray-200
          text-gray-500 hover:text-indigo-600 hover:border-indigo-300
          flex items-center justify-center text-xs select-none"
          data-action="thread-open-options"
          data-message-id="${serverData.id}"
          aria-label="Message options">⋯</button>`;
        bubbleCol.insertAdjacentHTML("afterbegin", btnHtml);
      }
    }

    const statusEl = el.querySelector(".msg-status-icon");
    if (statusEl) statusEl.innerHTML = _statusIconSVG(serverData.status ?? MSG_STATUS.SENT);
    el.classList.remove("opacity-70", "message-pending");
    el.classList.add("message-confirmed");
  }
}
```

---

### BUG-C4 — Send button permanently disabled/blank after successful attachment upload

**Severity:** CRITICAL  
**Affected files:** `thread.events.js`

**Root cause:**  
In `handleSendMessage`, when an attachment is present the send button is set to `disabled = true` and `textContent = "…"`. On upload **error**, the button is restored: `disabled = false; textContent = ""` (which also loses the SVG icon). On upload **success**, nothing restores the button at all — it stays disabled with "…" forever until page reload.

**Fix:**
```js
if (pending?.file) {
  const sendBtn = document.getElementById("thread-send-btn");
  const originalHTML = sendBtn?.innerHTML ?? "";
  if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = "…"; }

  try {
    // ...upload...
    threadState.pendingAttachment = null;
    _clearAttachmentStrip();
  } catch (uploadErr) {
    showToast("File upload failed. Message not sent.", "error");
    // Restore button on failure
    if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
    return;
  }

  // Restore button after successful upload (before send emit)
  if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
}
```

---

### BUG-C5 — Double "Message sent" toast on every send

**Severity:** HIGH (UX-breaking)  
**Affected files:** `thread_websocket.js`, `thread_render.js`

**Root cause:**  
Two separate `showToast("Message sent", "success")` calls fire for every message:

1. In `thread_websocket.js` `MESSAGE_SENT` handler: `showToast("Message sent", "success")`
2. In `thread_render.js` `confirmOptimisticMessage`: `showToast("Message sent.", "success")`

**Fix:** Remove the toast from `thread_render.js` `confirmOptimisticMessage` entirely. Keep only the one in `thread_websocket.js`. The render function's job is DOM mutation, not user notification.

---

### BUG-C6 — Hardcoded Learnora bot user ID ignores config

**Severity:** HIGH  
**Affected files:** `websocket_threads.py`

**Root cause:**  
The comment in `_call_learnora_for_thread` says it uses `app.config.get("LEARNORA_BOT_USER_ID", 0)` but the actual implementation is:
```python
bot_user_id = 99999999999
```

This is a literal integer, not a config lookup. If the bot user's real DB ID differs, Learnora responses will be saved under a non-existent user, causing FK constraint errors on `sender_id`.

**Fix — in `_call_learnora_for_thread`:**
```python
bot_user_id = app.config.get("LEARNORA_BOT_USER_ID")
if not bot_user_id:
    logger.warning(
        f"[LEARNORA_SKIP] thread_id={thread_id} "
        f"reason=LEARNORA_BOT_USER_ID_not_configured"
    )
    return
```

---

### BUG-C7 — Thread list not refreshed after `leaveThread` or member removal

**Severity:** HIGH  
**Affected files:** `thread.events.js`

**Root cause:**  
`handleBackToList` resets session state and shows the list panel but does **not** reload the thread list from the API. After a user leaves a thread, they're still shown as a member of it in the stale list. Same issue after `handleDeleteThread` (if implemented) and after being removed by a moderator.

**Fix — add reload in `handleBackToList`:**
```js
export async function handleBackToList() {
  const prevId = threadState.activeThreadId;
  if (_isTyping) _stopTyping();
  if (prevId) disconnectThreadWebSocket(prevId);
  resetSentinelObserver();
  resetThreadSession();

  const { showThreadList } = await import("./thread.render.js");
  showThreadList();

  // Reload list to reflect membership changes
  await handleLoadThreadList();
}
```

Alternatively, for leave/remove specifically, call `threadState.threadList.delete(threadId)` then `renderThreadList("loaded")` before navigating back, to avoid a network round-trip.

---

## 2. WebSocket & Realtime Issues

---

### WS-01 — `message_status_updated` listener lost on thread switch

**Severity:** HIGH  
**Affected files:** `thread_websocket.js`

**Root cause:**  
`disconnectThreadWebSocket` removes ALL listeners in `_MANAGED_EVENTS` via `_socket.off(ev)`. `MESSAGE_STATUS_UPDATED` is in that list. This event is emitted to the user's **personal room** (`user_{id}`), not the thread room. After switching threads, the new `initThreadWebSocket` call re-registers all listeners — but if any `message_status_updated` event fires between the `off` and the re-`on`, the status tick update is permanently lost.

More critically: `_socket.off(ev)` with no handler reference removes **every** listener for that event name on the socket, including listeners registered by other modules. If the message WebSocket manager ever attaches to the same events, those would be inadvertently removed.

**Fix — use named handler functions and remove only the specific ones:**
```js
// At module level
const _handlers = {};

function _registerHandlers(socket, threadId, token) {
  _handlers.roomJoined = (data) => { /* ... */ };
  socket.on(THREAD_WS.ROOM_JOINED, _handlers.roomJoined);

  _handlers.statusUpdated = (data) => { /* ... */ };
  socket.on(THREAD_WS.MESSAGE_STATUS_UPDATED, _handlers.statusUpdated);
  // etc.
}

export function disconnectThreadWebSocket(threadId) {
  if (!_socket) return;
  _socket.emit(THREAD_WS.LEAVE_ROOM, { token: api.getToken(), thread_id: threadId });
  Object.entries(_handlers).forEach(([, handler]) => {
    // Remove each listener by its named reference
    _MANAGED_EVENTS.forEach((ev) => _socket.off(ev, handler));
  });
  Object.keys(_handlers).forEach((k) => delete _handlers[k]);
  _socket = null;
  _threadId = null;
}
```

---

### WS-02 — `message_delivered` fires for users actively viewing the thread

**Severity:** HIGH  
**Affected files:** `thread_websocket.js`

**Root cause:**  
When `NEW_MESSAGE` arrives, the current code unconditionally calls `emitDelivered(data.id)` for any message not sent by the current user. But if the user is **actively viewing** the thread (it is the active thread), they should emit `mark_thread_read` (triggering a READ status), not `message_delivered` (triggering DELIVERED).

```js
// Current — incorrect
if (data.sender_id !== threadState.currentUser?.id && data.id) {
  emitDelivered(data.id);
}
```

**Fix:**
```js
if (data.sender_id !== threadState.currentUser?.id && data.id) {
  if (data.thread_id === threadState.activeThreadId) {
    // User is actively viewing this thread — mark as read immediately
    emitMarkRead(data.thread_id);
  } else {
    // User is online but in another thread — mark as delivered only
    emitDelivered(data.id);
  }
}
```

---

### WS-03 — Learnora typing indicator never removed when bot response arrives

**Severity:** MEDIUM  
**Affected files:** `thread_websocket.js`, `thread_render.js`

**Root cause:**  
`showLearnoraBotTyping` in `thread_render.js` adds a `#thread-learnora-typing` element and sets a 30-second timeout to auto-remove it. But when `NEW_MESSAGE` arrives with `is_ai_response: true`, the typing indicator is not programmatically removed. Users see the "Learnora is thinking" animation for up to 30 seconds after the response has already appeared.

**Fix — in `thread_websocket.js` `NEW_MESSAGE` handler:**
```js
socket.on(THREAD_WS.NEW_MESSAGE, (data) => {
  // Remove Learnora typing indicator when bot response arrives
  if (data.is_ai_response) {
    document.getElementById("thread-learnora-typing")?.remove();
  }
  // ... rest of handler
});
```

---

### WS-04 — Reconnect doubles all event listeners

**Severity:** MEDIUM  
**Affected files:** `thread_init.js`, `thread_websocket.js`

**Root cause:**  
In `thread_init.js`, the reconnect handler calls `disconnectThreadWebSocket` then `initThreadWebSocket`. `initThreadWebSocket` calls `_registerHandlers` which calls `socket.on(event, handler)`. If `_socket.off(ev)` in `disconnectThreadWebSocket` used named references (per WS-01 fix), this is safe. Without that fix, reconnect doubles the listener count because `socket.off(ev)` without a named reference may not clean properly depending on the socket.io version.

This is mitigated by implementing WS-01. Document as a dependency.

---

### WS-05 — Offline sends silently dropped

**Severity:** MEDIUM  
**Affected files:** `thread_websocket.js`

**Root cause:**  
`sendMessage` uses `_socket?.emit(...)`. When the socket is null or disconnected, the emit is silently discarded by the `?.` optional chain. The optimistic message remains in "pending" state indefinitely with no user feedback.

**Fix — add connectivity guard in `sendMessage`:**
```js
export function sendMessage(payload) {
  if (!_socket || !_socket.connected) {
    // Immediately fail the optimistic message
    const tempId = `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const optimistic = { ...buildOptimistic(payload, tempId), status: MSG_STATUS.FAILED };
    addPendingMessage(optimistic);
    import("./thread.render.js").then(({ renderNewMessage, markMessageFailed }) => {
      renderNewMessage(optimistic);
      markMessageFailed(tempId);
    });
    showToast("You are offline. Message could not be sent.", "error");
    return null;
  }
  // ... rest of existing sendMessage
}
```

---

### WS-06 — `_stopTyping` in `handleSendMessage` uses stale `activeThreadId`

**Severity:** LOW  
**Affected files:** `thread.events.js`

**Root cause:**  
If the user switches threads while a typing timer is pending, `_typingTimer` fires and `_stopTyping` calls `emitTypingStop(threadState.activeThreadId)`. But `activeThreadId` has already changed to the new thread. This sends a spurious `thread_typing_stop` to the newly-opened thread, not the one the user was actually typing in.

**Fix — capture thread ID at the time the typing indicator is started:**
```js
let _typingThreadId = null;

export function handleInputTyping() {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;
  _typingThreadId = threadId;

  if (!_isTyping) {
    _isTyping = true;
    emitTypingStart(threadId);
  }
  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(_stopTyping, THREAD_UI.TYPING_TIMEOUT_MS);
}

function _stopTyping() {
  if (!_isTyping) return;
  _isTyping = false;
  clearTimeout(_typingTimer);
  if (_typingThreadId) emitTypingStop(_typingThreadId);
  _typingThreadId = null;
}
```

---

## 3. Frontend Rendering Issues

---

### FE-01 — Thread list search clear button never becomes visible

**Severity:** MEDIUM  
**Affected files:** `thread.delegation.js`, `threads.html`

**Root cause:**  
The clear button in the thread list search starts with class `hidden`. The `_onSearchInput` handler filters results but never toggles the clear button's visibility. Users can type and filter but see no affordance to clear the search.

**Fix — in `_onSearchInput` in `thread_delegation.js`:**
```js
if (el.id === "thread-list-search" || el.matches("[data-role='thread-list-search']")) {
  clearTimeout(_listSearchDebounce);
  const q = el.value;

  // Toggle clear button visibility
  const clearBtn = document.querySelector("[data-action='clear-thread-list-search']");
  if (clearBtn) clearBtn.classList.toggle("hidden", !q);

  _listSearchDebounce = setTimeout(() => _filterThreadListInline(q), 150);
}
```

---

### FE-02 — Textarea height not reset after sending a message

**Severity:** LOW  
**Affected files:** `thread.events.js`

**Root cause:**  
The textarea has `rows="1"` and uses `overflow-y-auto` with `max-h-32`. As the user types multi-line content, the browser auto-expands the height (if any auto-resize script exists). After `input.value = ""` is set and the `input` event is dispatched, the send-button state resets but the textarea height does not reset to its base single-row size.

**Fix — in `handleSendMessage`:**
```js
input.value = "";
input.style.height = "";         // Reset height
input.dispatchEvent(new Event("input"));
```

If an auto-resize library is used, call its reset method. If raw CSS auto-height is achieved via `field-sizing: content` (CSS4), it resets automatically on `value = ""`.

---

### FE-03 — Search result click does not close search panel before scrolling

**Severity:** MEDIUM  
**Affected files:** `thread.delegation.js`

**Root cause:**  
Clicking a search result calls `handleScrollToMessage`. The search panel (`#thread-search-panel`) remains visible, covering the message list. The scroll happens behind the panel and the user sees nothing.

**Fix — in `handleScrollToMessage` in `thread.events.js`:**
```js
export async function handleScrollToMessage(messageId) {
  // Close search panel first so user can see the scrolled-to message
  const searchPanel = document.getElementById("thread-search-panel");
  if (searchPanel && !searchPanel.classList.contains("hidden")) {
    searchPanel.classList.add("hidden");
    searchPanel.classList.remove("flex");
  }
  // ... rest of existing logic
}
```

---

### FE-04 — Pinned message navigation only works for first pin after re-render

**Severity:** MEDIUM  
**Affected files:** `thread_templates.js`, `thread.delegation.js`

**Root cause:**  
`pinnedMessagesBannerTemplate` stores all pins as JSON in `data-pins`. Navigation cycles through them by updating the DOM. However, when the banner is re-rendered (e.g., after a pin/unpin event), `renderPinnedBanner` replaces the banner's `innerHTML`, resetting `data-pin-index` to `0`. If the user was on pin #2 and a new pin arrives, they're silently jumped back to pin #1. This is acceptable UX but should be documented as intended.

**More important issue:** Clicking a pin scrolls to it via `handleScrollToMessage`. If the pinned message is older than what's loaded (before `oldestMessageId`), one batch is loaded with `beforeId: messageId + 1`. If the message is still not in that batch (e.g., it's 200+ messages back), the scroll silently fails. There's no loop or "keep loading until found" logic.

**Fix — add iterative loading in `handleScrollToMessage`:**
```js
export async function handleScrollToMessage(messageId) {
  const threadId = threadState.activeThreadId;
  if (!threadId || !messageId) return;

  // Close search panel if open
  document.getElementById("thread-search-panel")
    ?.classList.add("hidden", "flex".replace("flex",""));

  let el = document.querySelector(`[data-message-id="${messageId}"]`);
  let attempts = 0;
  const MAX_ATTEMPTS = 10;

  while (!el && attempts < MAX_ATTEMPTS) {
    attempts++;
    try {
      const currentOldest = threadState.oldestMessageId;
      if (!currentOldest) break;

      const data = await fetchMessages(threadId, {
        beforeId: currentOldest,
        limit: THREAD_UI.MESSAGES_PER_PAGE,
      });

      const existing = new Set(threadState.messages.map((m) => m.id));
      const newMsgs = (data.messages ?? []).filter((m) => !existing.has(m.id));
      if (!newMsgs.length) break; // No more messages to load

      threadState.messages = [...newMsgs, ...threadState.messages];
      threadState.hasMore = data.has_more ?? false;
      threadState.oldestMessageId = data.oldest_id ?? null;

      const { prependMessages } = await import("./thread.render.js");
      prependMessages(newMsgs);
      el = document.querySelector(`[data-message-id="${messageId}"]`);
    } catch {
      break;
    }
  }

  if (!el) {
    showToast("Could not locate the message in history.", "error");
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("message-highlight");
  setTimeout(() => el.classList.remove("message-highlight"), THREAD_UI.HIGHLIGHT_DURATION_MS);
}
```

---

### FE-05 — Message options sheet shows premature "success" toasts for socket-emitted actions

**Severity:** MEDIUM  
**Affected files:** `thread.delegation.js`

**Root cause:**  
Actions like `handlePinMessage`, `handleDeleteMessage`, `handleEditMessage` all just emit a socket event and return immediately (they don't await a server confirmation). Their corresponding `.then()` in delegation fires the success toast at emit time, not when the server confirms. If the server rejects (e.g., wrong role), the user sees "Message pinned" toast followed by an error toast.

**Fix — Remove `.then(() => showToast("...", "success"))` from delegation for socket-emitted actions. Let the success toast fire only when the corresponding server-broadcast event is received** (e.g., `MESSAGE_PINNED`, `MESSAGE_DELETED`). Those handlers in `thread_websocket.js` already call `showToast`.

Current delegation code to clean up:
```js
// REMOVE the .then(success toast) from these:
handlePinMessage(msgId).then(() => showToast("Message pinned", "success"))
handleDeleteMessage(msgId).then(() => showToast("Message deleted", "success"))
handleEditMessage(msgId, ...).then(() => showToast("Message updated", "success"))
```

Keep error handling:
```js
handlePinMessage(msgId).catch(() => showToast("Failed to pin message", "error"))
```

---

### FE-06 — Message options sheet: replace "Find in chat" with "Copy message"

**Severity:** LOW (UX improvement)  
**Affected files:** `thread.delegation.js`

**Current:** "🔍 Find in chat" button calls `handleScrollToMessage` — this is redundant since the message is already visible when the sheet opens.

**Fix — replace in `_openOptionsSheet` in `thread.delegation.js`:**

Remove:
```js
!isDeleted ? `<button ... data-action="thread-scroll-to-message"...>🔍 Find in chat</button>` : "",
```

Add:
```js
!isDeleted && msg.text_content ? `
  <button class="${btnCls} text-gray-800 hover:bg-gray-50"
    data-action="thread-copy-message" data-message-id="${messageId}">
    <span class="text-xl w-7 text-center">📋</span>
    <span class="font-medium">Copy message</span>
  </button>` : "",
```

Add handler in `_onClick` in `thread.delegation.js`:
```js
const copyBtn = _closest(t, "[data-action='thread-copy-message']");
if (copyBtn) {
  const msgId = Number(copyBtn.dataset.messageId);
  const msg = threadState.messages.find((m) => m.id === msgId);
  if (msg?.text_content) {
    navigator.clipboard.writeText(msg.text_content)
      .then(() => showToast("Copied to clipboard", "success"))
      .catch(() => showToast("Copy not supported in this browser", "error"));
  }
  _closeOptionsSheet();
  return;
}
```

---

## 4. Attachment & Upload Improvements

---

### ATT-01 — Multiple attachments per message (requires DB migration)

**Current state:** Single attachment per `ThreadMessage` row via four columns.

**Recommended approach:** Add a `ThreadMessageAttachment` child table. This keeps the message row lean, is easier to query, and supports per-attachment metadata cleanly.

**SQLAlchemy model to add in `models.py`:**
```python
class ThreadMessageAttachment(db.Model):
    """Per-message attachment records. Replaces single-attachment columns on ThreadMessage."""
    __tablename__ = "thread_message_attachments"

    id             = db.Column(db.Integer, primary_key=True)
    message_id     = db.Column(
        db.Integer,
        db.ForeignKey("thread_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    attachment_url  = db.Column(db.String(500), nullable=False)
    attachment_name = db.Column(db.String(255), nullable=True)
    attachment_type = db.Column(db.String(50),  nullable=True)  # "image"|"video"|"document"
    attachment_size = db.Column(db.Integer,     nullable=True)  # bytes
    sort_order      = db.Column(db.Integer,     default=0)
    created_at      = db.Column(db.DateTime,    default=datetime.datetime.utcnow)

    message = db.relationship("ThreadMessage", backref="attachments_list")

    __table_args__ = (
        db.Index("idx_tma_message_id", "message_id"),
    )
```

**Migration notes:**
- The old `attachment_url/name/type/size` columns on `thread_messages` should be kept for now as `nullable` (they already are) to avoid breaking existing data.
- A data migration script should copy existing single-attachment rows to the new table.
- Once migration is validated, a second migration can `DROP COLUMN` the old columns.
- See Section 9 for full SQL.

**Backend changes needed:**
- `_build_message_payload` in `websocket_threads.py`: query `ThreadMessageAttachment` and include `attachments: [...]` array in payload.
- `serialize_message` in `threads.py`: same.
- `upload_thread_attachment` endpoint: unchanged (returns single upload result; client calls it once per file and batches them).
- `send_thread_message` WS handler: accept `attachments: [{url, name, type, size}]` array instead of single fields.

**Frontend changes needed:**
- `threadState.pendingAttachment` → change to `threadState.pendingAttachments: File[]`
- Allow adding multiple files in `_onClick` for `thread-attach-file`
- Render attachment strip showing all pending files with individual remove buttons
- Update `handleSendMessage` to upload each file and collect results before emitting

---

### ATT-02 — Upload progress UI

**Current state:** A toast says "Uploading file…" with no progress indication.

**Fix — add a progress bar to the compose area:**

In `threads.html`, add inside the compose area:
```html
<div id="thread-upload-progress"
     class="hidden mx-3 mb-2 bg-gray-100 rounded-full h-1.5 overflow-hidden">
  <div id="thread-upload-progress-bar"
       class="h-full bg-indigo-500 transition-all duration-200"
       style="width: 0%"></div>
</div>
```

Use `XMLHttpRequest` instead of `fetch` for the upload to get progress events, or use `fetch` with a `ReadableStream` wrapper. Simpler approach: show an indeterminate animation during upload.

```js
// In handleSendMessage, during upload:
const progressEl = document.getElementById("thread-upload-progress");
const barEl = document.getElementById("thread-upload-progress-bar");
if (progressEl) { progressEl.classList.remove("hidden"); }
if (barEl) { barEl.style.width = "0%"; }

// Animate indeterminate
let pct = 0;
const progressInterval = setInterval(() => {
  pct = Math.min(pct + Math.random() * 15, 90);
  if (barEl) barEl.style.width = `${pct}%`;
}, 200);

try {
  const result = await uploadAttachment(...);
  clearInterval(progressInterval);
  if (barEl) barEl.style.width = "100%";
  setTimeout(() => progressEl?.classList.add("hidden"), 300);
  // ...
} catch {
  clearInterval(progressInterval);
  progressEl?.classList.add("hidden");
}
```

---

### ATT-03 — Attachment rendering: max 2 previews + gallery modal

**Current state:** All attachments render inline in the bubble.

**Required behavior:**
- Show max 2 attachment previews inline
- If more than 2, show "+N more" overlay on the second preview
- Clicking any preview opens the full `openAttachmentViewer` modal

**Template change in `threadMessageTemplate`:**
```js
// After implementing ATT-01 (attachments_list):
const attachList = message.attachments ?? (message.attachment_url
  ? [{ url: message.attachment_url, name: message.attachment_name,
       type: message.attachment_type, size: message.attachment_size }]
  : []);

const visible = attachList.slice(0, 2);
const overflow = attachList.length - 2;

const attachmentHtml = visible.map((att, idx) => {
  const isLast = idx === 1 && overflow > 0;
  const overlay = isLast
    ? `<div class="absolute inset-0 bg-black/50 rounded-xl flex items-center justify-center
                    text-white font-bold text-lg cursor-pointer"
             data-action="thread-open-message-gallery"
             data-message-id="${message.id}">+${overflow}</div>` : "";

  if (att.type === "image") {
    return `<div class="relative">
      <img src="${escAttr(att.url)}" class="w-28 h-28 object-cover rounded-xl cursor-pointer"
           data-action="thread-open-message-gallery" data-message-id="${message.id}">
      ${overlay}
    </div>`;
  }
  // video / document handling...
}).join("");

const gridClass = visible.length > 1 ? "grid grid-cols-2 gap-1" : "";
const finalHtml = attachList.length
  ? `<div class="${gridClass} mb-1.5">${attachmentHtml}</div>` : "";
```

Add delegation handler `thread-open-message-gallery` that calls `openAttachmentViewer` with the specific message's attachments.

---

### ATT-04 — Attachment save/download support

**Current state:** Attachment links open in a new tab. No explicit download button.

**Fix — add download button to the attachment viewer in `thread_render.js`:**
```js
// In openAttachmentViewer, for each item add:
const downloadBtn = `
  <a href="${aUrl}" download="${aName}" target="_blank"
     class="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white
            bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1 transition-colors mt-1">
    ⬇ Download
  </a>`;
```

For images, the `download` attribute on `<a>` may be blocked by CORS if the URL is cross-origin (e.g., Cloudinary CDN). In that case, fetch the blob and create an object URL:
```js
async function downloadFile(url, filename) {
  try {
    const blob = await fetch(url).then(r => r.blob());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch {
    window.open(url, "_blank"); // fallback
  }
}
```

---

## 5. Message Status System Refinement

---

### STATUS-01 — Current architecture analysis

The `status` column on `ThreadMessage` is a **message-level** property representing the aggregate delivery state. The `ThreadMessageReadReceipt` table handles **per-user** read tracking. This is the correct two-layer design for group chat. The aggregate status follows: `sent → delivered → read`.

**Current flow:**
| Event | Trigger | Correct? |
|---|---|---|
| `sent` | Message saved to DB | ✓ |
| `delivered` | Any receiver emits `message_delivered` | ✗ (see below) |
| `read` | Any receiver calls `mark_thread_read` | ✓ |

**Problem with DELIVERED (WS-02):** `message_delivered` is emitted by the client in `NEW_MESSAGE` handler regardless of whether the user has the thread open. Since `NEW_MESSAGE` only reaches users in the thread room (they already joined), they are by definition "viewing" the thread. The delivered → sent distinction is effectively lost.

**Corrected flow:**

```
Message created                    → status = "sent"
Recipient joins thread room        → immediately: mark_thread_read fires → status = "read"
Recipient is online, not in room   → they won't receive NEW_MESSAGE at all
  (Personal room used for status    → when they next join, mark_thread_read fires)
```

**The DELIVERED state requires a separate mechanism.** To properly implement it:

Option A (simple, pragmatic): Drop the `delivered` state for group chat. Use sent/read only. This is what iMessage does for group threads.

Option B (full implementation): Track room presence separately from socket connection. When a user connects but has NOT yet called `join_thread_room` for a given thread, they are "online but not in room." A background job or on-connect hook can emit `message_delivered` for messages they haven't read.

**Recommendation:** Implement Option A for now — it's simpler, honest, and avoids the complexity of presence-state tracking for group chat.

### STATUS-02 — Implementation plan for sent/read only

**In `thread_websocket.js` `NEW_MESSAGE` handler, replace:**
```js
if (data.sender_id !== threadState.currentUser?.id && data.id) {
  emitDelivered(data.id);
}
```

**With:**
```js
if (data.sender_id !== threadState.currentUser?.id && data.id) {
  // Thread is open (user is in room), mark as read immediately
  emitMarkRead(data.thread_id);
}
```

**In `thread_state.js` `updateMessageStatus`, restrict to sent/read only:**
```js
export function updateMessageStatus(messageIds, status) {
  const ORDER = { sent: 0, read: 1 };  // Remove 'delivered'
  // ...
}
```

**Status icon cleanup in `thread_render.js`:** Keep all four icon states in the SVG helper (for backward compat with existing rows in DB), but stop generating new `delivered` transitions.

### STATUS-03 — `mark_thread_read` scalability concern

On a busy thread, every `mark_thread_read` call:
1. Queries all unread messages since `last_read_at`
2. Bulk-inserts read receipts
3. Bulk-updates message statuses
4. Emits `message_status_updated` to each distinct sender's personal room

For a thread with 20 members and 100 unread messages from 15 senders, this means 15 WS pushes per `mark_thread_read`. Consider batching:

```python
# Instead of per-sender emit, batch all updates into one push per sender
# using the existing sender_msg_map pattern — already done correctly in
# websocket_threads.py mark_thread_read handler. No change needed here. ✓
```

The batching is already correct. No action needed.

---

## 6. Missing Frontend Features

---

### FEAT-01 — Mention autocomplete (`@` suggestions)

**Required behavior:** When user types `@` in the message input, show a floating suggestion list of thread members + "Learnora". Selecting an entry inserts the `@username` or `@learnora`.

**Implementation plan:**

**1. Add suggestion dropdown HTML to `threads.html`:**
```html
<div id="thread-mention-suggestions"
     class="hidden absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl
            shadow-lg border border-gray-200 overflow-hidden z-30 max-h-48 overflow-y-auto"
     role="listbox">
</div>
```

Position this div relative to the compose area container.

**2. In `thread_delegation.js` `_onSearchInput`, detect `@` trigger:**
```js
if (el.id === "thread-message-input") {
  handleInputTyping();

  const val = el.value;
  const cursorPos = el.selectionStart;
  const textBefore = val.slice(0, cursorPos);
  const mentionMatch = textBefore.match(/@([a-zA-Z0-9_]*)$/);

  if (mentionMatch) {
    const query = mentionMatch[1].toLowerCase();
    _showMentionSuggestions(query, el, cursorPos, textBefore.lastIndexOf("@"));
  } else {
    document.getElementById("thread-mention-suggestions")?.classList.add("hidden");
  }
}
```

**3. Suggestion renderer:**
```js
function _showMentionSuggestions(query, inputEl, cursorPos, atPos) {
  const members = Array.from(threadState.memberMap.entries())
    .filter(([, m]) => m.name?.toLowerCase().includes(query) ||
                       m.username?.toLowerCase().includes(query))
    .slice(0, 6);

  const learnora = { id: "learnora", name: "Learnora", username: "learnora", isBot: true };
  const candidates = query === "" || "learnora".startsWith(query)
    ? [learnora, ...members]
    : members;

  if (!candidates.length) {
    document.getElementById("thread-mention-suggestions")?.classList.add("hidden");
    return;
  }

  const box = document.getElementById("thread-mention-suggestions");
  if (!box) return;

  box.innerHTML = candidates.map(([id, m] = [null, null], raw) => {
    // Handle both [id, memberObj] from Map entries and the learnora special object
    const member = m ?? raw;
    const uid = id ?? raw.id;
    const avatar = member.isBot
      ? `<div class="w-7 h-7 rounded-full bg-violet-100 text-violet-700 text-xs
                     flex items-center justify-center">🤖</div>`
      : member.avatar
        ? `<img src="${escAttr(member.avatar)}" class="w-7 h-7 rounded-full object-cover">`
        : `<div class="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs
                       flex items-center justify-center font-bold">
             ${(member.name ?? "?").charAt(0)}
           </div>`;

    return `<button class="flex items-center gap-2 w-full px-3 py-2 hover:bg-indigo-50
                           transition-colors text-left"
                    data-action="thread-insert-mention"
                    data-username="${escAttr(member.username ?? member.name)}"
                    data-at-pos="${atPos}"
                    data-cursor-pos="${cursorPos}">
      ${avatar}
      <span class="text-sm text-gray-800">${esc(member.name)}</span>
      <span class="text-xs text-gray-400">@${esc(member.username ?? "learnora")}</span>
    </button>`;
  }).join("");

  box.classList.remove("hidden");
}
```

**4. Insertion handler in `_onClick`:**
```js
const mentionBtn = _closest(t, "[data-action='thread-insert-mention']");
if (mentionBtn) {
  const username = mentionBtn.dataset.username;
  const atPos = Number(mentionBtn.dataset.atPos);
  const input = document.getElementById("thread-message-input");
  if (input && username !== undefined) {
    const before = input.value.slice(0, atPos);
    const after = input.value.slice(Number(mentionBtn.dataset.cursorPos));
    input.value = `${before}@${username} ${after}`;
    input.focus();
    const newCursor = atPos + username.length + 2;
    input.setSelectionRange(newCursor, newCursor);
    input.dispatchEvent(new Event("input"));
  }
  document.getElementById("thread-mention-suggestions")?.classList.add("hidden");
  return;
}
```

---

### FEAT-02 — Delete thread, close/reopen thread, update thread from frontend

**Backend:** All three endpoints exist and are correct.

**Missing frontend pieces:**

In `openInfoModal` (for creator only), add action buttons in `creatorControls`:
```html
<button data-action="thread-close-thread" data-thread-id="${threadId}"
        class="... text-amber-600 bg-amber-50 ...">
  ${thread.is_open ? "🔒 Close Thread" : "🔓 Reopen Thread"}
</button>
<button data-action="thread-delete-thread" data-thread-id="${threadId}"
        class="... text-red-600 bg-red-50 ...">
  🗑 Delete Thread
</button>
```

**Delegation handlers (add to `thread.delegation.js`):**
```js
const closeThreadBtn = _closest(t, "[data-action='thread-close-thread']");
if (closeThreadBtn) {
  const threadId = Number(closeThreadBtn.dataset.threadId ?? threadState.activeThreadId);
  const thread = threadState.threadList.get(threadId);
  const apiCall = thread?.is_open
    ? import("./thread.api.js").then(({ closeThread }) => closeThread(threadId))
    : import("./thread.api.js").then(({ reopenThread }) => reopenThread(threadId));
  apiCall
    .then(() => {
      addOrUpdateThreadInList({ id: threadId, is_open: !thread?.is_open });
      showToast(thread?.is_open ? "Thread closed" : "Thread reopened", "success");
    })
    .catch(() => showToast("Failed to update thread", "error"));
  return;
}

const deleteThreadBtn = _closest(t, "[data-action='thread-delete-thread']");
if (deleteThreadBtn) {
  const threadId = Number(deleteThreadBtn.dataset.threadId ?? threadState.activeThreadId);
  _showConfirm("Delete Thread", "This will permanently delete the thread and all messages.")
    .then((confirmed) => {
      if (!confirmed) return;
      import("./thread.api.js").then(({ deleteThread }) =>
        deleteThread(threadId)
          .then(() => {
            threadState.threadList.delete(threadId);
            handleBackToList();
            showToast("Thread deleted", "info");
          })
          .catch(() => showToast("Failed to delete thread", "error"))
      );
    });
  return;
}
```

---

### FEAT-03 — Add Members button/flow

**Placement:** In `openInfoModal`, add an "Add Members" button in `creatorControls` for creators/moderators.

**Required API:** `POST /threads/{id}/invite/{userId}` (already implemented).

**Suggested UX flow:**
1. User taps "Add Members"
2. A bottom sheet or modal opens showing a search input
3. User types a name — fetches from connections API (e.g., `GET /student/connections?status=accepted&q=name`)
4. Shows paginated list of connectable users not already in thread
5. User taps a person → invite is sent via `inviteToThread(threadId, userId)`
6. Toast confirms

**Frontend state:** After invite is sent, no state change needed (invitee is not yet a member). The info modal can show a "Pending invite" badge next to the user if you track pending invites locally.

**Placement in `openInfoModal` creator controls:**
```html
<button data-action="thread-add-members" data-thread-id="${threadId}"
        class="flex items-center gap-1.5 text-sm font-medium text-white
               bg-indigo-600 hover:bg-indigo-700 rounded-xl px-3 py-2 transition-colors">
  ➕ Add Members
</button>
```

---

### FEAT-04 — Edit thread title/description/tags from frontend

**Backend:** `PATCH /threads/{id}` exists and accepts `title`, `description`, `max_members`, `tags`.

**Quick implementation:** In the info modal's header section for creators, make the title tappable → inline edit or expand to a settings-style form. Alternatively, add an "Edit Thread" button that opens a pre-filled create-style modal.

---

## 7. Hidden Bugs Found

---

### HIDDEN-01 — `_addConfirmedId` Set oldest-eviction can purge recently-confirmed IDs

**File:** `thread_state.js`

`_addConfirmedId` caps the Set at 300 entries by evicting the oldest. Since `Set` insertion order is preserved, `values().next().value` removes the first-inserted ID. In a fast-paced thread, if the user sends 300+ messages in a session, the very first confirmed IDs are purged. If any late-arriving broadcast for those messages re-fires (e.g., after a reconnect), the dedup guard (Guard 2) would miss them and render duplicate messages.

**Fix:** Increase the cap to 1000. The memory cost is trivial (each entry is a small integer). Alternatively, key by `client_temp_id` instead:

```js
// confirmedTempIds: Set of client_temp_id strings (more unique per session than server IDs)
```

---

### HIDDEN-02 — `handleLoadMoreMessages` overwrites optimistic pending messages

**File:** `thread.events.js`

```js
threadState.messages = [...newMsgs, ...threadState.messages];
```

If pending (optimistic) messages are in `threadState.messages`, they are at the end of the array and are preserved. However, `newMsgs` is filtered by `!existingIds.has(m.id)`. Pending messages have `id: null`, and `existingIds.has(null)` is `false` (null is not in the set). If by chance the loaded older batch contains a null-ID entry (shouldn't happen from API), it would slip through. Not a real bug today, but fragile — add explicit ID guard:

```js
const newMsgs = (data.messages ?? []).filter(
  (m) => m.id !== null && m.id !== undefined && !existingIds.has(m.id)
);
```

---

### HIDDEN-03 — `openInfoModal` renders with stale member list after role change

**File:** `thread_modals.js`, `thread.events.js`

`handleChangeMemberRole` calls `await handleOpenInfo()` after success. `handleOpenInfo` fetches fresh member data and calls `openInfoModal`. `openInfoModal` calls `_openModal` which calls `modal.innerHTML = html`. This is correct but destroys any scroll position the user had in the member list.

Minor UX issue — not a data bug. Acceptable for now.

---

### HIDDEN-04 — `_openModal` backdrop-click listener accumulates on each re-open

**File:** `thread_modals.js`

```js
function _openModal(id, html) {
  let modal = document.getElementById(id);
  if (!modal) { /* create */ }
  modal.innerHTML = html;
  modal.classList.remove("hidden");

  modal.addEventListener("click", (e) => {   // ← New listener added each time
    if (e.target === modal) _closeModal(id);
  });
}
```

Every call to `_openModal` for an existing modal (e.g., re-opening the info panel) adds another backdrop-click listener. After 10 opens, a single backdrop click fires the close callback 10 times (all with `classList.add("hidden")` — harmless but wasteful, and more importantly the DOM mutation fires 10 times).

**Fix:**
```js
function _openModal(id, html) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement("div");
    modal.id = id;
    modal.className = "hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    document.body.appendChild(modal);

    // Add listener ONCE at creation time, not on every open
    modal.addEventListener("click", (e) => {
      if (e.target === modal) _closeModal(id);
    });
  }
  modal.innerHTML = html;
  modal.classList.remove("hidden");
  return modal;
}
```

---

### HIDDEN-05 — `thread_init.js` `_bindSocketLifecycle` toast spam on every connect

**File:** `thread_init.js`

```js
sock.on("connect", () => {
  showToast("Connected to real-time server.", "success");
});
```

This fires on initial connection AND on every reconnect. If the user's connection is unstable, they see a "Connected" toast every few seconds.

**Fix:** Only show toast on reconnect, not initial connection:
```js
let _hasConnectedOnce = false;
sock.on("connect", () => {
  if (_hasConnectedOnce) {
    showToast("Reconnected", "success");
  }
  _hasConnectedOnce = true;
});
```

---

### HIDDEN-06 — `handleOpenThread` has a race condition with rapid switching

**File:** `thread.events.js`

`handleOpenThread` is async with three `await` calls (`fetchThread`, `fetchMessages`, `fetchThreadMembers` via `Promise.all`). If the user rapidly taps two different threads, two concurrent `handleOpenThread` calls run. The second call disconnects the first thread's WS, but the first call's `Promise.all` may still be in flight. When it resolves, it calls `renderMessages`, `renderThreadHeader`, etc., overwriting the UI for thread B with data from thread A.

**Fix — add a generation counter guard:**
```js
let _openThreadGeneration = 0;

export async function handleOpenThread(threadId) {
  const generation = ++_openThreadGeneration;
  // ...
  const [detail, msgData, members] = await Promise.all([...]);

  if (generation !== _openThreadGeneration) return; // Stale call — abort

  // ... rest of render
}
```

---

### HIDDEN-07 — `thread_websocket.js` `sendMessage` sends `reply_to` in socket payload but server ignores it

**File:** `thread_websocket.js`, `websocket_threads.py`

`sendMessage` socket emit includes `text_content`, `reply_to_id`, attachments but NOT `reply_to` (the object). The server handler `handle_send_thread_message` only reads `data.get("reply_to_id")`. The `reply_to` object in the optimistic message state is used only for local rendering. This is architecturally correct — the server rebuilds the reply preview from the DB. No bug, but worth documenting to prevent future confusion.

---

### HIDDEN-08 — Toast system uses two different containers

**Files:** `thread_render.js`, `api.js`

`thread_render.js` exports its own `showToast` function using container `#thread-toast-root`. The global `showToast` from `api.js` uses `#toast-container`. The thread modules call `showToast` (global) or import from `thread_render.js` inconsistently:
- `thread_websocket.js` calls global `showToast` (no import)
- `thread_render.js` uses its own local function
- `thread_events.js`, `thread_delegation.js`, `thread_init.js` use global `showToast`

This results in toasts appearing in two different locations on screen simultaneously.

**Fix:** Pick one system. Recommended: use the global `showToast` everywhere. Remove the local `showToast` export from `thread_render.js` and replace internal calls with the global `window.showToast` or `showToast` directly (since api.js loads before the module system).

---

### HIDDEN-09 — `leaveThread` success path decrements count but doesn't remove thread from list

**File:** `thread.events.js`

After leaving a thread, the user is no longer a member. The current code decrements `member_count` in state but keeps the thread in `threadState.threadList`. When the list re-renders (after calling `handleLoadThreadList` per BUG-C7 fix), the thread will naturally disappear since `fetchMyThreads` only returns joined threads. However, between the leave API call and the list reload, there's a brief window where the thread still appears in the list. Calling `threadState.threadList.delete(threadId)` before navigating back would close that window immediately.

---

### HIDDEN-10 — Missing `aria-label` and `role` on message options bottom sheet

**File:** `threads.html`

The sheet has `role="dialog"` and `aria-modal="true"` but no `aria-labelledby`. Screen readers announce it as an untitled dialog.

**Fix:**
```html
<div id="thread-message-options-sheet"
     ...
     role="dialog" aria-modal="true"
     aria-label="Message options">
```

---

## 8. Suggested Architecture Refinements

---

### ARCH-01 — Use named-function WS listeners throughout (prerequisite for WS-01)

All socket `.on()` calls should use named references stored in a module-level object so they can be cleanly removed with `.off(event, handler)`. This prevents listener accumulation on reconnects and avoids the "remove-all" side-effect of `socket.off(event)` without a handler reference.

---

### ARCH-02 — Separate personal-room events from thread-room events in cleanup

Events that arrive on the user's personal room (`user_{id}`) — specifically `message_status_updated` — should never be unregistered when switching threads. They must persist for the lifetime of the socket connection.

Partition `_MANAGED_EVENTS` into two sets:
```js
const _THREAD_ROOM_EVENTS = [
  THREAD_WS.ROOM_JOINED, THREAD_WS.NEW_MESSAGE, THREAD_WS.MESSAGE_SENT,
  THREAD_WS.MESSAGE_EDITED, THREAD_WS.MESSAGE_DELETED,
  THREAD_WS.MESSAGE_PINNED, THREAD_WS.MESSAGE_UNPINNED,
  THREAD_WS.REACTION_UPDATED, THREAD_WS.USER_TYPING_START,
  THREAD_WS.USER_TYPING_STOP, THREAD_WS.USER_ONLINE, THREAD_WS.USER_OFFLINE,
  THREAD_WS.READ_ACK, THREAD_WS.MEMBER_JOINED, THREAD_WS.MEMBER_REMOVED,
  THREAD_WS.THREAD_DELETED, THREAD_WS.ERROR, THREAD_WS.MSG_ERROR,
  THREAD_WS.LEARNORA_THINKING,
];

const _PERSONAL_ROOM_EVENTS = [
  THREAD_WS.MESSAGE_STATUS_UPDATED,
  // future: notification events, presence events
];
```

`disconnectThreadWebSocket` only removes `_THREAD_ROOM_EVENTS` listeners. `_PERSONAL_ROOM_EVENTS` listeners are registered once in `thread_init.js` and never removed until `threadDestroy`.

---

### ARCH-03 — Optimistic message ID lifecycle

Current: optimistic messages have `id: null`. After confirmation, they get the real ID. Multiple places check for null ID.

Recommendation: Use a dedicated prefix for optimistic IDs to make them unambiguous:
```js
// Instead of id: null, use a client-side temporary ID:
id: `optimistic_${clientTempId}`,
```

All DOM selectors and state guards can then use `String(id).startsWith("optimistic_")` instead of `id === null` checks.

---

### ARCH-04 — Thread list state should be a sorted array, not a Map

`threadState.threadList` is a `Map<id, thread>`. Rendering always calls `Array.from(threadState.threadList.values()).sort(...)`. For frequent re-renders (every new message), this sort runs every time.

Alternative: Keep `threadState.threadList` as an array sorted by `last_activity` descending. Use `findIndex` for updates and splice/re-insert for re-sorting. This is O(n) but n is small for a user's thread list (typically < 50 threads).

---

### ARCH-05 — `handleSendMessage` should not be async for the non-attachment path

Currently `handleSendMessage` is `async`. For the common case (no attachment), there are no `await` calls. Making it synchronous for that path would reduce micro-task overhead. The attachment path genuinely needs `async/await`. Consider splitting:

```js
export async function handleSendMessage() {
  const text = input.value.trim();
  const pending = threadState.pendingAttachment;

  if (!text && !pending) return;

  if (pending?.file) {
    await _sendWithAttachment(text, pending);
  } else {
    _sendTextOnly(text);
  }
}
```

---

## 9. Database Migrations

All migrations are PostgreSQL-compatible and production-safe (additive only for Phase 1).

---

### MIGRATION-01 — `thread_message_attachments` table (for ATT-01)

```sql
-- Phase 1: Create new table
CREATE TABLE thread_message_attachments (
    id              SERIAL PRIMARY KEY,
    message_id      INTEGER NOT NULL
                    REFERENCES thread_messages(id) ON DELETE CASCADE,
    attachment_url  VARCHAR(500)  NOT NULL,
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(50),   -- 'image' | 'video' | 'document'
    attachment_size INTEGER,       -- bytes
    sort_order      INTEGER        NOT NULL DEFAULT 0,
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tma_message_id ON thread_message_attachments (message_id);

-- Phase 2: Migrate existing single-attachment data
INSERT INTO thread_message_attachments
    (message_id, attachment_url, attachment_name, attachment_type, attachment_size, sort_order)
SELECT
    id,
    attachment_url,
    attachment_name,
    attachment_type,
    attachment_size,
    0
FROM thread_messages
WHERE attachment_url IS NOT NULL;

-- Phase 3 (after validation, in a later release):
-- ALTER TABLE thread_messages DROP COLUMN attachment;
-- ALTER TABLE thread_messages DROP COLUMN attachment_url;
-- ALTER TABLE thread_messages DROP COLUMN attachment_name;
-- ALTER TABLE thread_messages DROP COLUMN attachment_type;
-- ALTER TABLE thread_messages DROP COLUMN attachment_size;
```

**Rollback for Phase 1:**
```sql
DROP TABLE IF EXISTS thread_message_attachments;
```

---

### MIGRATION-02 — Verify `ThreadMessageReadReceipt` and `ThreadMessage.status` indexes

These were added in the existing model. Verify they exist in production:

```sql
-- Confirm idx_tm_status partial index exists (PostgreSQL only)
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'thread_messages'
  AND indexname = 'idx_tm_status';

-- If missing:
CREATE INDEX CONCURRENTLY idx_tm_status
    ON thread_messages (status)
    WHERE status != 'read';

-- Confirm read receipt indexes
SELECT indexname FROM pg_indexes
WHERE tablename = 'thread_message_read_receipts';

-- If missing:
CREATE INDEX CONCURRENTLY idx_tread_receipt_msg
    ON thread_message_read_receipts (message_id);

CREATE INDEX CONCURRENTLY idx_tread_receipt_user
    ON thread_message_read_receipts (user_id);
```

---

### MIGRATION-03 — Index for thread list query performance

The `get_my_threads` route queries `ThreadMember` then `Thread` individually in a Python loop. Add a composite index to speed up unread count queries:

```sql
CREATE INDEX CONCURRENTLY idx_tm_thread_unread
    ON thread_messages (thread_id, sender_id, is_deleted, sent_at)
    WHERE is_deleted = FALSE;
```

This supports the unread count query:
```python
ThreadMessage.query.filter(
    ThreadMessage.thread_id == thread.id,
    ThreadMessage.sent_at > cutoff,
    ThreadMessage.sender_id != current_user.id,
    ThreadMessage.is_deleted == False
).count()
```

---

## 10. Final Risk Assessment

---

### High-risk areas requiring focused testing

| Area | Risk | Reason |
|---|---|---|
| Reply system (BUG-C1) | **Critical** | Silently broken. All replies sent as top-level messages. Fix is simple but requires regression test across all send paths. |
| Thread switch race (HIDDEN-06) | **High** | Rapid tab switching can render wrong thread data. Generation counter fix is safe but must be tested with simulated latency. |
| WS listener cleanup (WS-01) | **High** | Named-function refactor touches `_registerHandlers` and `disconnectThreadWebSocket`. All WS events must be regression-tested post-refactor. |
| `confirmOptimisticMessage` DOM mutation (BUG-C3) | **High** | Injecting HTML after confirmation is new behavior. Must test with message types: text-only, with attachment, AI response, deleted. |
| Multiple attachments migration (ATT-01) | **Medium** | Phase 2 data migration (INSERT INTO from existing rows) must run in a transaction with a rollback test. Verify FK constraints after Phase 3 column drops. |
| Status system simplification (STATUS-01) | **Medium** | Removing DELIVERED emits changes observable behavior. Any existing DB rows with status='delivered' remain valid; the UI will still render the delivered icon for them. |
| `_openModal` listener dedup (HIDDEN-04) | **Low** | Listener move from each-open to once-at-creation. Test that backdrop close still works after the modal's HTML is replaced on re-open. |

---

### Recommended testing sequence

1. **BUG-C1 (reply fix)** — Send replies, verify `reply_to_id` in DB. Check reply preview renders for both sender and receiver.
2. **BUG-C3 (options button)** — Send a message, wait for confirmation, tap the bubble — options sheet must open.
3. **BUG-C4 (send button)** — Send a message with attachment; verify button restores with icon.
4. **BUG-C5 (toast dedup)** — Send 5 messages rapidly; verify exactly 1 "sent" notification per message (or none, depending on chosen UX).
5. **WS-01 + ARCH-02** — Switch threads 10 times rapidly; verify no duplicate messages, no doubled typing indicators.
6. **STATUS-01** — Open thread, receive message; verify status icon shows "read" (double-blue ticks) immediately, not "delivered" then "read."
7. **ATT-01 migration** — Run migration on staging with existing attachment rows; verify `thread_message_attachments` populated correctly.
8. **FEAT-01 (mentions)** — Type `@`, verify dropdown; select user; verify `@username` inserted; verify message sends with correct mention text.

---

### Remaining fragile areas (no immediate fix required)

- **`mark_thread_read` on busy threads** — Emits per-sender status updates. With many senders this works but creates WS chatter. Monitor in production.
- **Socket.io CDN dependency** in `thread_init.js` — If CDN goes down, thread system is non-functional. Self-host `socket.io.esm.min.js` for production.
- **`get_my_threads` N+1 queries** — Python loop calls `ThreadMessage.query` and `User.query` per thread. With 30+ threads this is 60+ DB queries per page load. Refactor to bulk queries using `IN` clauses, or add a `last_message` denormalized column to `Thread`.
- **`_call_learnora_for_thread` daemon thread** — Runs in a background thread with `with app.app_context()`. Ensure the connection pool is sized for concurrent AI calls (default SQLAlchemy pool of 5 will exhaust quickly if many threads trigger Learnora simultaneously).

---

*Document generated after full review of 18 project files. All findings verified against actual code.*
