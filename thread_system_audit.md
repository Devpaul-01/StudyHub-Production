# 🧾 Thread System Audit & Refinement Report

**Codebase:** StudyHub — Thread (Group Chat) Feature  
**Files Audited:** `threads.py`, `websocket_threads.py`, `models.py`, `thread_init.js`, `thread_delegation.js`, `thread_events.js`, `thread_websocket.js`, `thread_state.js`, `thread_api.js`, `thread_render.js`, `thread_templates.js`, `thread_modals.js`, `thread_longpress.js`, `thread_constants.js`, `threads.html`  
**Verdict:** ⚠️ Not production-ready. Multiple system-breaking bugs exist across every layer.

---

## Section 1 — 🔴 CRITICAL BUGS (Must Fix Immediately)

---

### BUG-01 · `showToast` called in `thread_api.js` without being imported — SYSTEM CRASH ON INIT

**Location:** `thread_api.js`, lines 50, 53, 57, 70  
**What happens:** `fetchCurrentUser()` calls `showToast(...)` four times. `showToast` is never imported in this file. The result is `ReferenceError: showToast is not defined` thrown on the very first line that calls it.  
**Why it matters:** `fetchCurrentUser()` is called as the FIRST operation in `threadInit()`. The crash is uncaught within `fetchCurrentUser`'s try-block because `showToast` is not a network error — it's a code error. The entire thread system silently fails to initialize for every user.  
**Fix:** Remove all `showToast` calls and the entire debug response-logging block from `fetchCurrentUser`. These are leftover debug artifacts. Replace them with a clean return:

```js
export async function fetchCurrentUser() {
  try {
    const res = await api.get("/users/me");
    return res.data?.user ?? null;
  } catch (err) {
    console.error("[fetchCurrentUser]", err);
    return null;
  }
}
```

---

### BUG-02 · Wrong WebSocket join event name — thread room is NEVER joined

**Location:** `thread_websocket.js` line 37; `websocket_threads.py` line 315  
**What happens:** `initThreadWebSocket()` emits `THREAD_WS.CONNECT` which equals `"thread_connect"`. The backend registers `@sio.on("join_thread_room")`. There is no `@sio.on("thread_connect")` handler on the server. The socket connects to the namespace successfully, but the user never joins the thread room. Every subsequent `new_thread_message` broadcast goes to room `"thread_{id}"` — a room the client is not in.  
**Result:** Real-time messages are never received. The chat appears to send messages (optimistic UI) but never receives any, including your own from other tabs. The entire real-time layer is dead.  
**Fix:** Change the emit in `initThreadWebSocket`:

```js
// Before:
socket.emit(THREAD_WS.CONNECT, { token, thread_id: threadId });

// After:
socket.emit("join_thread_room", { token, thread_id: threadId });
```

Also add the server's confirmation event to the listener (see BUG-04).

---

### BUG-03 · Wrong WebSocket leave event name — thread room is NEVER left

**Location:** `thread_websocket.js` line 43; `websocket_threads.py` line 358  
**What happens:** `disconnectThreadWebSocket()` emits `THREAD_WS.DISCONNECT = "thread_disconnect"`. The server expects `@sio.on("leave_thread_room")`. There is no server handler for `"thread_disconnect"`.  
**Result:** When a user navigates back from a thread, the server never calls `leave_room(f"thread_{id}")`. The user keeps receiving all broadcasts from that thread room on subsequent reconnects. After visiting 5 threads, the client receives messages from all 5 rooms simultaneously. Memory leak on the server-side room membership.  
**Fix:**

```js
// Before:
_socket.emit(THREAD_WS.DISCONNECT, { token, thread_id: threadId });

// After:
_socket.emit("leave_thread_room", { token, thread_id: threadId });
```

---

### BUG-04 · Connection ack event name mismatch — `"thread_room_joined"` vs `"thread_connected"`

**Location:** `thread_websocket.js` line 161; `websocket_threads.py` line 350  
**What happens:** After a successful `join_thread_room`, the server emits `emit("thread_room_joined", {...})`. The client listens for `socket.on(THREAD_WS.CONNECTED, ...)` which equals `"thread_connected"`. These do not match.  
**Result:** The connection acknowledgement handler never fires. No "Connected" system message is shown. No role-based state is set. If any critical logic depends on knowing when the room is joined, it silently fails.  
**Fix:** Either update `THREAD_WS.CONNECTED = "thread_room_joined"` in constants, or rename the server emit to `"thread_connected"`.

---

### BUG-05 · Reaction emit event name mismatch — reactions are completely broken

**Location:** `thread_events.js` line 309; `websocket_threads.py` line 633  
**What happens:** `handleReaction()` emits `"react_thread_message"`. The server registers `@sio.on("add_thread_reaction")`. No server handler exists for `"react_thread_message"`.  
**Result:** Emoji reactions silently do nothing. No server-side processing, no broadcast, no DB write.  
**Fix:**

```js
// Before:
socket.emit("react_thread_message", { token, message_id: messageId, emoji });

// After:
socket.emit("add_thread_reaction", { token, message_id: messageId, emoji });
```

---

### BUG-06 · Reaction broadcast event name mismatch — reaction updates never reach clients

**Location:** `websocket_threads.py` line 684; `thread_websocket.js` line 262  
**What happens:** Server broadcasts `"thread_reactions_updated"` (plural). Client listens for `THREAD_WS.REACTION_UPDATED = "thread_reaction_updated"` (singular — missing the 's').  
**Result:** Even if BUG-05 is fixed, the reaction update still never renders. Every user's reaction counts are frozen at load time.  
**Fix:** Update constant: `REACTION_UPDATED: "thread_reactions_updated"` (add the 's'), or change the server emit to `"thread_reaction_updated"`.

---

### BUG-07 · Typing start event name mismatch — typing indicators never appear

**Location:** `thread_websocket.js` line 124; `websocket_threads.py` line 566  
**What happens:** Client emits `THREAD_WS.TYPING_START = "thread_typing_start"`. Server registers `@sio.on("thread_typing")`.  
**Fix:** `emitTypingStart` should emit `"thread_typing"`.

---

### BUG-08 · Typing received event name mismatch — typing indicators still never appear

**Location:** `thread_websocket.js` line 272; `websocket_threads.py` line 591  
**What happens:** Server emits `"thread_typing_started"` / `"thread_typing_stopped"`. Client listens for `THREAD_WS.USER_TYPING = "user_typing"`.  
**Result:** Both the emission side and the reception side have mismatched names. Typing indicators are doubly broken.  
**Fix:** Add handlers for the actual server event names, or align constants:

```js
// In _registerHandlers:
socket.on("thread_typing_started", (data) => { ... });
socket.on("thread_typing_stopped", (data) => { ... });
```

---

### BUG-09 · Reconnect handler doubles all WebSocket event listeners

**Location:** `thread_init.js` lines 221–229  
**What happens:** On socket reconnect, `_bindSocketLifecycle` calls `initThreadWebSocket(sock, threadId, token)` which calls `_registerHandlers(socket, threadId, token)`. This calls `socket.on(...)` for every event a second time — without first calling `socket.off(...)`. After each reconnect, all handlers are duplicated.  
**Result:** After the first reconnect: each incoming message is processed twice — two DOM inserts, two state mutations, duplicate entries in `messages[]`. After 3 reconnects: 8× duplication. The chat becomes unusable with duplicated bubbles.  
**Fix:** Before re-registering, remove all old listeners:

```js
sock.on("reconnect", (attempt) => {
  if (threadId) {
    const token = ...;
    import("./thread.websocket.js").then(({ disconnectThreadWebSocket, initThreadWebSocket }) => {
      disconnectThreadWebSocket(threadId, token); // removes all .off listeners
      initThreadWebSocket(sock, threadId, token); // re-registers cleanly
    });
  }
});
```

---

### BUG-10 · Long-press module crashes on load — imports non-existent symbols

**Location:** `thread_longpress.js` lines 8–9  
**What happens:**
```js
import { THREAD_LONG_PRESS_DURATION, THREAD_LONG_PRESS_THRESHOLD } from './thread.constants.js';
import { openThreadMessageOptions } from './thread.modals.js';
```
Neither `THREAD_LONG_PRESS_DURATION` nor `THREAD_LONG_PRESS_THRESHOLD` exist in `thread_constants.js`. `openThreadMessageOptions` does not exist in `thread_modals.js`.  
**Result:** The module fails to import. Any module that imports from `thread_longpress.js` also fails. If it's ever added to `thread_init.js`, the whole init crashes.  
**Fix:** Add to `thread_constants.js`:
```js
export const THREAD_LONG_PRESS = {
  DURATION_MS: 500,
  THRESHOLD_PX: 10,
};
```
Add `openThreadMessageOptions()` to `thread_modals.js`, or replace the import with a delegated event handler approach.

---

### BUG-11 · Long-press uses wrong data attribute — never triggers on any message

**Location:** `thread_longpress.js` line 119  
**What happens:** `_getMessageWrapper()` looks for `[data-thread-message-id]`. All message templates generate `data-message-id` (no `thread-` prefix).  
**Result:** Long-press never finds a message element. Even if the module loaded correctly, no long-press would ever trigger on any message.  
**Fix:** Change to `el?.closest?.('[data-message-id]')` and `el?.dataset?.messageId`.

---

### BUG-12 · Pin event payload missing `is_pinned` field — pin state broken in real-time

**Location:** `websocket_threads.py` line 909; `thread_websocket.js` line 254  
**What happens:** The server's `pin_thread_message` broadcast payload is:
```python
{ "message_id": ..., "pinned_by": ..., "text": ..., "sender": ... }
```
No `is_pinned` key. The client does:
```js
if (msg) msg.is_pinned = data.is_pinned;
```
`data.is_pinned` is `undefined`. Setting `msg.is_pinned = undefined` is falsy. `renderPinUpdate(messageId, undefined)` toggles the CSS class off. Pinning a message visually unpins it from all clients' views.  
**Fix:** Add `"is_pinned": True` to the pin broadcast and `"is_pinned": False` to the unpin broadcast. Update the client handler to set `msg.is_pinned = data.is_pinned !== false` (since pin always = true, unpin always = false).

---

### BUG-13 · Send button is permanently `disabled` — click-to-send is broken

**Location:** `threads.html` line 144  
**What happens:** `<button id="thread-send-btn" ... disabled>` starts with the `disabled` attribute. No JavaScript ever removes it. No `input` event on the textarea enables/disables the button.  
**Result:** Clicking the send button does absolutely nothing. Users can only send messages by pressing Enter. Mobile users who expect to tap a send button are completely unable to send.  
**Fix:** Add an input listener to the textarea in `thread_init.js` or `thread_delegation.js`:
```js
document.getElementById("thread-message-input")?.addEventListener("input", (e) => {
  const btn = document.getElementById("thread-send-btn");
  if (btn) btn.disabled = !e.target.value.trim();
});
```

---

### BUG-14 · Attachment flow is broken — files are silently discarded when sending

**Location:** `thread_delegation.js` lines 238–261; `thread_events.js` `handleSendMessage()`  
**What happens:** When a file is selected via the attach button, delegation reads it as a base64 `DataURL` via `FileReader` and stores it in `threadState.pendingAttachment = { url: base64DataUrl, ... }`. When `handleSendMessage()` runs, it reads only the textarea text and calls `wsSendMessage(payload, token)`. There is NO code that:
1. Reads `threadState.pendingAttachment`
2. Calls `uploadAttachment()` to upload the file to Cloudinary
3. Waits for the upload URL
4. Includes `attachment_url` in the WS message payload

The `pendingAttachment` is stored and forgotten.  
**Result:** The attach button shows a toast saying "Attached: filename.jpg" but the file is never sent. Users think they've shared a file when they haven't.  
**Additional issue:** `threadState.pendingAttachment` is not defined in `thread_state.js`'s `threadState` object or cleared in `resetThreadSession()`. It leaks between thread sessions.  
**Fix:** In `handleSendMessage()`, before emitting, check for a pending attachment, upload it first, then include the result in the payload:
```js
export async function handleSendMessage() {
  const input = document.getElementById("thread-message-input");
  if (!input) return;
  const text = input.value.trim();
  const pending = threadState.pendingAttachment;
  if (!text && !pending) return;

  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  let attachmentData = null;

  if (pending?.file) {
    const { showToast } = await import("./thread.render.js");
    showToast("Uploading file…");
    const { uploadAttachment } = await import("./thread.api.js");
    const result = await uploadAttachment(threadState.activeThreadId, pending.file);
    attachmentData = result;
    threadState.pendingAttachment = null;
    // also clear the preview strip
  }

  input.value = "";
  handleCancelReply();
  _stopTyping();
  wsSendMessage({ text_content: text, ...attachmentData, reply_to_id: _replyContext?.id ?? null }, token);
}
```
Also store the actual `File` object (not just base64) in `pendingAttachment`, and add `pendingAttachment: null` to `threadState` and `resetThreadSession()`.

---

### BUG-15 · Pinned banner navigation script via `innerHTML` is never executed

**Location:** `thread_templates.js` lines 426–459  
**What happens:** `pinnedMessagesBannerTemplate()` inserts a `<script>` tag via the `innerHTML` of the banner container. Per the HTML spec (and enforced by all modern browsers), scripts inserted via `innerHTML` are NOT executed.  
**Result:** The previous/next pin navigation buttons (`▲ ▼`) have no event listeners and do nothing when clicked.  
**Fix:** Remove the inline `<script>` entirely. Instead, handle pin navigation in the delegation layer:
```js
// In _onClick (thread_delegation.js):
const pinNavBtn = _closest(t, ".pin-nav-btn");
if (pinNavBtn) {
  e.stopPropagation();
  const banner = pinNavBtn.closest(".thread-pinned-banner");
  const pins   = JSON.parse(banner?.dataset.pins ?? "[]");
  let idx      = parseInt(banner?.dataset.pinIndex ?? "0", 10);
  idx = (idx + parseInt(pinNavBtn.dataset.pinDir, 10) + pins.length) % pins.length;
  banner.dataset.pinIndex = idx;
  // update banner content
}
```
Embed the pins data as `data-pins` on the banner element via `JSON.stringify`.

---

### BUG-16 · Search is completely non-functional

**Location:** `thread_delegation.js` line 395; `thread_events.js` lines 393–394; `threads.html` lines 205–224  
**Multiple failures:**
1. Clicking `[data-action='thread-search']` calls `handleThreadSearch()` with no argument.
2. `handleThreadSearch()` tries to read `document.querySelector("[data-role='thread-search-input']")?.value`. No element with `data-role='thread-search-input'` exists in the HTML.
3. `#thread-search-panel` (the full-screen search overlay) is never shown — there's no code that removes its `hidden` class.
4. `renderSearchResults()` writes to `[data-role='thread-search-results']` which doesn't exist.
5. The HTML has `#thread-search-results` and `#thread-search-input` inside `#thread-search-panel` but these IDs are never referenced in JS.

**Fix:**
- Open `#thread-search-panel` when search button is clicked: `document.getElementById("thread-search-panel")?.classList.remove("hidden")`
- Add `data-role="thread-search-input"` to `#thread-search-input` in HTML
- Add `data-role="thread-search-results"` to `#thread-search-results` in HTML
- Add a close handler for `data-action="thread-close-search"` that hides the panel
- Wire the input's `input` event to `handleThreadSearch()` with a debounce

---

### BUG-17 · All modal overlays fail to center their content — missing `flex` class

**Location:** `threads.html` lines 226, 305, 350, 419; `thread_modals.js` `_openModal()` line 46  
**What happens:** All modals (both static HTML and dynamically created) have `items-center justify-center` in their class list — but NOT `flex`. Without `flex`, these Tailwind alignment utilities do nothing. When `hidden` is removed (or `open` is added), the modal container becomes a `block` element. Content stacks from the top-left with no centering.  
**Result:** Every modal in the system — create thread, info, AI, confirm — pops up top-left instead of centered. This is visually broken on every screen.  
**Fix:** Add `flex` to every static modal class list and to `_openModal`'s `className`:
```html
<!-- threads.html — add "flex" before "hidden" -->
<div id="thread-create-modal" class="hidden flex fixed inset-0 z-50 items-center ...">
```
For `_openModal()`:
```js
modal.className = "thread-modal fixed inset-0 z-50 flex items-center justify-center bg-black/40 ...";
```
And toggle `hidden` vs showing the modal (don't add `open` class — use `hidden` consistently):
```js
modal.classList.remove("hidden"); // to show
modal.classList.add("hidden");    // to close
```

---

## Section 2 — 🔴 Frontend Interaction Issues

---

### INTERACT-01 · Emoji reaction picker never opens

**Location:** `thread_templates.js` line 220  
**What happens:** The emoji trigger button is rendered as:
```html
<button class="msg-emoji-trigger ..." data-message-id="...">😊</button>
```
There is NO `data-action` attribute. The delegation layer keys off `data-action` for all routing. This button has no delegation handler. The emoji picker (`#thread-reaction-picker`) is never populated or shown.  
**Fix:** Add `data-action="thread-open-emoji-picker"` to the button and add a delegation handler that populates `#thread-reaction-picker` with emoji options and positions it near the message.

---

### INTERACT-02 · `handlePinMessage` can't unpin — pin button always sends `pin` regardless of state

**Location:** `thread_events.js` lines 300–304  
**What happens:**
```js
socket.emit("pin_thread_message", { token, message_id: messageId });
```
Always emits pin even when the message is already pinned. Server rejects with "Message is already pinned" but the error is not surfaced to the user (the `thread_error` event just goes to console).  
**Fix:** Check `msg.is_pinned` before deciding which event to emit:
```js
export async function handlePinMessage(messageId) {
  const msg   = threadState.messages.find((m) => m.id === messageId);
  const event = msg?.is_pinned ? "unpin_thread_message" : "pin_thread_message";
  const { socket } = await import("./thread.init.js");
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  socket.emit(event, { token, message_id: messageId });
}
```

---

### INTERACT-03 · Edit message uses `window.prompt()` — not production UI

**Location:** `thread_events.js` line 292  
**What happens:** `const newText = prompt("Edit message:", msg.text_content)`. Blocking browser dialog, unstyled, breaks mobile.  
**Fix:** Implement inline editing: replace the `.msg-text` span with a `<textarea>` pre-populated with the message, add save/cancel buttons, emit `edit_thread_message` on save.

---

### INTERACT-04 · `handleJoinThread` bypasses the join request modal

**Location:** `thread_events.js` lines 601–609  
**What happens:** `handleJoinThread` calls `requestJoinThread(threadId)` with no message argument. For threads with `requires_approval=true`, the join request is sent with a blank introduction. No UI prompt is shown.  
**Fix:** Check if the thread `requires_approval` and open `openJoinRequestModal(thread, (msg) => requestJoinThread(threadId, { message: msg }))` instead.

---

### INTERACT-05 · `confirm()` dialogs used for remove/leave — mobile hostile, non-dismissable

**Location:** `thread_events.js` lines 524, 562  
**Fix:** Replace with the `#thread-confirm-modal`: set its title/message via `dataset`, store a callback, then trigger the confirm via `thread-confirm-ok` delegation.

---

### INTERACT-06 · Thread list search input doesn't exist in HTML

**Location:** `thread_init.js` line 122; `threads.html`  
**What happens:** `_initThreadListSearch()` looks for `#thread-list-search` or `[data-role='thread-list-search']`. Neither exists. The sidebar filter is silently wired to nothing.  
**Fix:** Add a search input to the thread list panel header in `threads.html`:
```html
<input id="thread-list-search" data-role="thread-list-search"
       type="search" placeholder="Filter threads…"
       class="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 outline-none">
```

---

### INTERACT-07 · Pending invites section never populates

**Location:** `threads.html` lines 47–53; no corresponding JS  
**What happens:** `#thread-invites-container` starts `hidden`. No code calls `getMyInvites()` on init or renders results into `#thread-invites-list`.  
**Fix:** Call `getMyInvites()` in `threadInit()` after loading the thread list. If invites exist, populate the list and remove the `hidden` class from the container.

---

### INTERACT-08 · `handleAcceptInvite` reads wrong data key for thread ID

**Location:** `thread_events.js` line 641  
**What happens:**
```js
if (result.data?.thread_id) { handleOpenThread(result.data.thread_id); }
```
Backend returns `{ status, data: { thread_id: ... } }`. After API client unwrapping, `result.data = { thread_id: ... }`. Wait — this is actually `result.data.thread_id`. Let me clarify: the API response body is `{"status":"success","data":{"thread_id":X}}`. If `api.post` returns the axios response, `result.data` = the full body. The inner `data` key is `result.data.data`. The correct path is `result.data?.data?.thread_id`. 

However, there is also the API client unwrap pattern used elsewhere (see `fetchMyThreads()`). If the API client already unwraps to the inner `data`, then `result` itself might be `{thread_id:X}` in which case `result.data` is undefined.

**Fix:** Normalize the check to match however `api.post` returns data:
```js
const threadId = result?.data?.thread_id ?? result?.thread_id;
if (threadId) handleOpenThread(threadId);
```

---

## Section 3 — 🔴 WebSocket / Real-Time Issues

---

### WS-01 · Full event name audit — mismatch summary table

| Event Direction | Frontend Name | Backend Name | Status |
|---|---|---|---|
| Client → Server (join) | `"thread_connect"` | `"join_thread_room"` | ❌ BROKEN |
| Client → Server (leave) | `"thread_disconnect"` | `"leave_thread_room"` | ❌ BROKEN |
| Client → Server (typing start) | `"thread_typing_start"` | `"thread_typing"` | ❌ BROKEN |
| Client → Server (typing stop) | `"thread_typing_stop"` | `"thread_typing_stop"` | ✅ OK |
| Client → Server (react) | `"react_thread_message"` | `"add_thread_reaction"` | ❌ BROKEN |
| Client → Server (send) | `"send_thread_message"` | `"send_thread_message"` | ✅ OK |
| Client → Server (edit) | `"edit_thread_message"` | `"edit_thread_message"` | ✅ OK |
| Client → Server (delete) | `"delete_thread_message"` | `"delete_thread_message"` | ✅ OK |
| Client → Server (pin) | `"pin_thread_message"` | `"pin_thread_message"` | ✅ OK |
| Client → Server (unpin) | `"unpin_thread_message"` | `"unpin_thread_message"` | ✅ OK |
| Client → Server (mark read) | `"mark_thread_read"` | `"mark_thread_read"` | ✅ OK |
| Client → Server (delivered) | `"message_delivered"` | `"message_delivered"` | ✅ OK |
| Server → Client (room joined) | listens `"thread_connected"` | emits `"thread_room_joined"` | ❌ BROKEN |
| Server → Client (new msg) | listens `"new_thread_message"` | emits `"new_thread_message"` | ✅ OK |
| Server → Client (typing start) | listens `"user_typing"` | emits `"thread_typing_started"` | ❌ BROKEN |
| Server → Client (typing stop) | listens (none) | emits `"thread_typing_stopped"` | ❌ BROKEN |
| Server → Client (reactions) | listens `"thread_reaction_updated"` | emits `"thread_reactions_updated"` | ❌ BROKEN |
| Server → Client (pin) | listens `"thread_message_pinned"` | emits `"thread_message_pinned"` | ✅ OK (but payload broken — see BUG-12) |

**Summary:** 8 of 18 critical event channels are broken. Real-time for joining, reactions, typing, and connection ack are all dead.

---

### WS-02 · `mark_thread_read` updates `msg.status = "read"` for ALL messages regardless of group size

**Location:** `websocket_threads.py` lines 993–1013  
**What happens:** When a user opens a thread, `mark_thread_read` iterates every unread message and sets each one to `status = "read"`. In a thread with 500 messages, this generates 500 individual DB UPDATE statements (one per message) plus one read receipt INSERT per message.  
**Fix:** Batch-update the status in a single SQL statement:
```python
ThreadMessage.query.filter(
    ThreadMessage.thread_id == thread_id,
    ThreadMessage.sender_id != user_id,
    ThreadMessage.status != 'read'
).update({ThreadMessage.status: 'read'}, synchronize_session=False)
```

---

### WS-03 · Rate limiter `_send_buckets` is a module-level dict — not thread-safe under gevent/eventlet

**Location:** `websocket_threads.py` lines 77, 96–103  
**What happens:** `_send_buckets` is a plain `dict`. Flask-SocketIO with gevent uses greenlets. Concurrent modifications to the dict from multiple greenlets can cause data corruption or missed rate limit windows.  
**Fix:** Use `collections.defaultdict` with a lock, or switch to Redis-based rate limiting via `flask_limiter`.

---

### WS-04 · No handler for `thread_message_error` on the client

**Location:** `websocket_threads.py` line 557–560  
**What happens:** Server emits `"thread_message_error"` when a send fails. Client has no listener for this event. Failed messages stay in `pending` state forever — they never become `failed` and the retry flow never triggers.  
**Fix:** Add in `_registerHandlers`:
```js
socket.on("thread_message_error", (data) => {
  const { client_temp_id } = data;
  if (client_temp_id) {
    failPendingMessage(client_temp_id);
    import("./thread.render.js").then(({ confirmOptimisticMessage }) => {
      // mark as failed visually
    });
  }
});
```

---

## Section 4 — 🔴 Frontend ↔ Backend Contract Mismatches

---

### CONTRACT-01 · `send_thread_message` REST endpoint ignores attachments

**Location:** `threads.py` lines 1493–1505  
**What happens:** The REST fallback endpoint for sending messages only accepts `text_content`. Fields `attachment_url`, `attachment_name`, `attachment_type`, `attachment_size` are not read from the request body. If the REST path is ever hit with an attachment (e.g., WebSocket unavailable), the attachment is silently dropped.  
**Fix:** Read and assign attachment fields in the REST handler, same as the WS handler does.

---

### CONTRACT-02 · `deleted` message text inconsistency between WS and REST backends

**Location:** `websocket_threads.py` line 841 vs `threads.py` line 1585  
**WS sets:** `msg.text_content = "[Message deleted]"`  
**REST sets:** `msg.text_content = "[deleted]"`  
**Result:** Messages deleted via WS show `"[Message deleted]"` when fetched via REST later. Messages deleted via REST show `"[deleted]"`. The client renders `"[deleted]"`. If a message was WS-deleted, on reload it shows `"[Message deleted]"` (from DB) instead of the client's expected `"[deleted]"`.  
**Fix:** Standardize to `"[deleted]"` in both places.

---

### CONTRACT-03 · Thread list response missing `creator_id` — breaks `threadListItemTemplate`

**Location:** `threads.py` `get_my_threads()` lines 1650–1665; `thread_templates.js` line 283  
**What happens:** `get_my_threads()` returns `is_creator: bool` but NOT `creator_id`. Template checks:
```js
const isCreator = thread.creator_id === currentUserId || thread.is_creator;
```
`thread.creator_id` is `undefined`. The first half always fails. Relies entirely on `thread.is_creator`. Fine by accident, but fragile.  
**Fix:** Either add `creator_id` to the response, or remove the `thread.creator_id === currentUserId` check from the template.

---

### CONTRACT-04 · `get_thread()` GET endpoint and `openInfoModal()` use different member structures

**Location:** `threads.py` lines 2074–2087 (GET /threads/:id) vs `threads.py` lines 957–969 (GET /threads/:id/members)  
**GET `/threads/:id` members include:** `{id, username, name, avatar, role, joined_at, messages_sent}`  
**GET `/threads/:id/members` includes:** `{user_id, id, username, name, avatar, role, online, joined_at, messages_sent, last_read_at}`  

`openInfoModal()` is called after `fetchThreadMembers()` (the /members endpoint), so it gets `online` and `last_read_at`. But `handleOpenThread()` fetches via `fetchThread()` (the /threads/:id endpoint), which includes members without `online`. The info modal is always opened after a fresh `/members` fetch, so it's fine — but if the modal ever renders with member data from `fetchThread()`, the online dot will never show.  
**Fix:** Document the intended data source clearly and ensure `openInfoModal` always receives data from `/members`.

---

### CONTRACT-05 · `fetchRecommendedThreads()` response key mismatch (minor)

**Location:** `thread_api.js` line 115 vs `threads.py` lines 674–684  
**Frontend:** `return res.data?.recommendations ?? []`  
**Backend returns:** `{"status":"success","data":{"recommendations":[...],"total_found":..., ...}}`  
After API unwrapping, `res.data.recommendations` is the array. ✅ This one is actually fine.

---

### CONTRACT-06 · Unread count is always 0 for new members whose `last_read_at` is NULL

**Location:** `threads.py` lines 1617–1625  
**What happens:**
```python
if membership.last_read_at:
    unread_count = ThreadMessage.query.filter(...)...count()
```
If `last_read_at` is NULL, the count is never computed. New members who have never opened the thread see 0 unread messages even if hundreds exist.  
**Fix:**
```python
cutoff = membership.last_read_at or datetime.datetime(2000, 1, 1)
unread_count = ThreadMessage.query.filter(
    ThreadMessage.thread_id == thread.id,
    ThreadMessage.sent_at > cutoff,
    ThreadMessage.sender_id != current_user.id,
    ThreadMessage.is_deleted == False
).count()
```

---

## Section 5 — 🟠 UI/UX Issues

---

### UX-01 · Message bubble height excessive for short messages due to always-visible action buttons

**Location:** `thread_templates.js` lines 215–233  
**Root cause:** `actionsHtml` (reply, emoji, edit, pin, delete buttons) is rendered as a permanent flex row beneath every message bubble, including one-word messages. The `msg-meta` row (time + status) plus `actionsHtml` adds ~56px below every bubble. On mobile, a message like "ok" has 4x the content height of the actual text.  
**Fix:** Use CSS to hide actions by default, show on hover (desktop) or long-press (mobile):
```html
<div class="msg-actions ... opacity-0 group-hover:opacity-100 transition-opacity">
```
Add `group` class to the `thread-message-wrap` div. On mobile, actions should be triggered exclusively by long-press (already architectured in `thread_longpress.js` once its bugs are fixed).

---

### UX-02 · `scroll-smooth` CSS on message container causes perceived send latency

**Location:** `threads.html` line 93  
**What happens:** `scroll-smooth` makes all JS-triggered scrolls animated. `scrollToBottom()` uses `container.scrollTop = container.scrollHeight`. On Chromium, this triggers a smooth scroll animation of several hundred ms. New messages appear to "slide in" slowly rather than instantly appearing at bottom.  
**Fix:** Remove `scroll-smooth` from `#thread-messages-list`. Implement smooth scroll only for the specific case of scroll-to-message:
```js
el.scrollIntoView({ behavior: "smooth", block: "center" }); // existing
```
For bottom-scrolling, use direct assignment or `scrollTo({ top: ... , behavior: "instant" })`.

---

### UX-03 · Typing user name resolves from message history — shows "Someone" for new participants

**Location:** `thread_render.js` lines 386–390  
**What happens:** To get a typing user's name, the renderer searches `threadState.messages` for a message from that user. If they've never sent a message (they just joined), they're shown as "Someone".  
**Fix:** Build a `threadState.memberMap: Map<userId, {name, avatar}>` populated when the thread opens (from `fetchThreadMembers`). Use this in `renderTypingIndicator`.

---

### UX-04 · `handleEditMessage` uses `prompt()` — produces an overlay that freezes the entire page

**Location:** `thread_events.js` line 292  
Already listed in INTERACT-03. Expanding the UX impact: the browser `prompt()` dialog pauses ALL JavaScript execution. If the WebSocket receives a message while the dialog is open, the handler is queued and fires immediately on dialog close — this can cause visual jumps or duplicate state updates.

---

### UX-05 · No "load more" scroll sentinel or IntersectionObserver

**Location:** `thread_init.js` (comment says it's there, code doesn't implement it)  
**What happens:** Loading older messages requires clicking `[data-action='thread-load-more']`. But no such button is in the HTML. The only way to trigger it is a click, but there's nothing to click.  
**Fix:** Add a top sentinel `<div id="thread-top-sentinel">` to `#thread-messages-list` HTML and implement the IntersectionObserver in `threadInit()`:
```js
const sentinel = document.getElementById("thread-top-sentinel");
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting) handleLoadMoreMessages();
}, { threshold: 1.0 });
if (sentinel) observer.observe(sentinel);
```

---

### UX-06 · Thread closed state blocks existing member messaging — counterintuitive design

**Location:** `websocket_threads.py` line 451; `threads.py` `close_thread`  
**What happens:** `thread.is_open = False` is checked before every WS message send. If a creator closes the thread to stop new joins, they inadvertently lock themselves and all members out of chat.  
**Fix:** `is_open` should only gate `request_join_thread`. Remove the `is_open` check from `send_thread_message` WS and REST handlers. Add a separate `is_locked` boolean to the Thread model if message-muting is a desired feature.

---

### UX-07 · `delete_thread` sends no WebSocket notification — ghost chat for members

**Location:** `threads.py` lines 1097–1099  
**What happens:** When a creator deletes a thread, only DB notifications are created. Members who have the thread open see no change. The chat remains fully interactive until they refresh.  
**Fix:** After DB delete, broadcast a `thread_deleted` WebSocket event to the thread room before the data is gone:
```python
try:
    from websocket_threads import thread_ws_manager
    thread_ws_manager.broadcast_to_thread(thread_id, "thread_deleted", {"thread_id": thread_id})
except Exception:
    pass
db.session.delete(thread)
db.session.commit()
```
Add a client-side listener that calls `handleBackToList()` when received.

---

## Section 6 — 🟠 Attachment & Media Issues

---

### MEDIA-01 · Attachment preview strip exists in HTML but is never populated

**Location:** `threads.html` lines 107–109  
**What happens:** `#thread-attachment-strip` is in the compose area for showing a pending attachment preview (filename, file icon, remove button). No JavaScript ever populates or shows it.  
**Fix:** In the fixed `handleSendMessage` / file-selection flow: when a file is selected, populate and show `#thread-attachment-strip`. When the user cancels or sends, hide and clear it.

---

### MEDIA-02 · File size limit inconsistency between frontend and backend

**Location:** `thread_delegation.js` line 241; `threads.py` line 1311  
**Frontend check:** `file.size <= 10 * 1024 * 1024` (10 MB)  
**Backend limit:** `MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024` (25 MB)  
Users with files 10–25 MB will get a frontend rejection even though the backend would accept them.  
**Fix:** Align both to 25 MB, or add a constant to `thread_constants.js` (`THREAD_UI.MAX_ATTACHMENT_MB = 25`) and use it in both places.

---

### MEDIA-03 · Image viewer modal (`#thread-image-viewer-modal`) has no handler to open it

**Location:** `threads.html` lines 186–203  
**What happens:** `#thread-image-viewer-modal` is defined in HTML but no JS calls `document.getElementById("thread-image-viewer-modal").classList.remove("hidden")`. Clicking image attachments opens a new tab (via the `<a>` tag in the template) rather than an in-app viewer.  
**Fix:** Add a delegation handler for `data-action="thread-view-image"`. Set `#thread-viewer-img`'s `src` and `#thread-viewer-filename`'s text, then show the modal. Add `data-action="thread-view-image"` to image attachment links in `threadMessageTemplate`.

---

### MEDIA-04 · `openAttachmentViewer` only shows attachments currently in memory — misses older ones

**Location:** `thread_events.js` lines 511–512  
**What happens:**
```js
const attachments = threadState.messages.filter((m) => m.attachment_url);
```
Only messages already loaded in the current session are shown. If the thread has 200 attachment messages and only 30 are loaded, the media viewer shows only 30.  
**Fix:** Fetch all attachment messages from the server:
```js
const allMsgs = await fetchMessages(threadId, { limit: 50 }); // or a dedicated attachments endpoint
```

---

## Section 7 — 🟠 State Management Problems

---

### STATE-01 · `threadState.pendingAttachment` undefined in state definition and never reset

**Location:** `thread_state.js` `threadState` object; `thread_delegation.js` line 244  
**Fix:** Add to `threadState`:
```js
pendingAttachment: null,
```
Add to `resetThreadSession()`:
```js
threadState.pendingAttachment = null;
```

---

### STATE-02 · `confirmedMessageIds` Set grows indefinitely — memory leak

**Location:** `thread_state.js` line 37  
**What happens:** `confirmedMessageIds` is a `Set<number>` that adds server IDs whenever messages are confirmed. It is never trimmed. In a heavily-used thread, this set will contain thousands of IDs over a long session.  
**Fix:** Cap the set to the most recent 200 entries (the maximum a user would have in the pagination window):
```js
if (threadState.confirmedMessageIds.size > 200) {
  const iter = threadState.confirmedMessageIds.values();
  threadState.confirmedMessageIds.delete(iter.next().value);
}
```

---

### STATE-03 · Thread switch doesn't wait for WS disconnect to complete before opening new thread

**Location:** `thread_events.js` `handleOpenThread()` line 91; `thread_events.js` `handleBackToList()` line 143  
**What happens:** `handleOpenThread()` doesn't call `disconnectThreadWebSocket(prevThreadId)` before connecting to a new thread. If a user quickly taps between threads, they end up in multiple rooms simultaneously. Messages from all rooms arrive mixed together.  
**Fix:** In `handleOpenThread()`, disconnect any currently active thread before connecting to the new one:
```js
if (threadState.activeThreadId && threadState.activeThreadId !== threadId) {
  const token = localStorage.getItem("token") || sessionStorage.getItem("token");
  disconnectThreadWebSocket(threadState.activeThreadId, token);
  resetThreadSession();
}
```

---

### STATE-04 · `_typingTimer` and `_isTyping` are module-level, not per-thread

**Location:** `thread_events.js` lines 64–65  
**What happens:** When switching threads, `_typingTimer` and `_isTyping` are not reset. If a user was typing in Thread A and quickly switches to Thread B, the typing-stop event fires for Thread B's ID (from `_stopTyping()` using `threadState.activeThreadId` which is now B). Thread A's server-side typing state is never cleared.  
**Fix:** Clear typing state in `handleBackToList()` before resetting the session:
```js
if (_isTyping) _stopTyping();
```

---

## Section 8 — 🟡 Hidden / Subtle Bugs

---

### HIDDEN-01 · `_openModal({ once: true })` outside-click listener consumed by inner clicks

**Location:** `thread_modals.js` lines 55–59  
**What happens:**
```js
modal.addEventListener("click",
  (e) => { if (e.target === modal) _closeModal(id); },
  { once: true }
);
```
`once: true` removes the listener after the first event — regardless of whether `e.target === modal`. An inner click (e.g., typing in a textarea) bubbles to modal, `e.target !== modal`, listener checks false, does NOT close, but is REMOVED by `once`. After one inner click, clicking the backdrop no longer closes the modal.  
**Fix:** Remove `{ once: true }` (use the `e.target === modal` check as the sole guard):
```js
modal.addEventListener("click", (e) => { if (e.target === modal) _closeModal(id); });
```

---

### HIDDEN-02 · Rejected join request cooldown crashes if `reviewed_at` is NULL

**Location:** `threads.py` line 2194  
```python
time_since_rejection = datetime.datetime.utcnow() - existing_request.reviewed_at
```
If a request has `status="rejected"` but `reviewed_at=None` (edge case: direct DB mutation, migration, or old data), this throws `TypeError: unsupported operand type(s) for -: 'datetime.datetime' and 'NoneType'`.  
**Fix:**
```python
if existing_request.reviewed_at:
    time_since_rejection = datetime.datetime.utcnow() - existing_request.reviewed_at
    if time_since_rejection < cooldown_period:
        ...
```

---

### HIDDEN-03 · Learnora background thread uses `db.session` after it may have been closed

**Location:** `websocket_threads.py` `_call_learnora_for_thread` line 1168  
**What happens:** The function opens an app context via `with app.app_context()` and uses `db.session`. If the `_call_provider_sync` call takes >30s (slow AI provider), the SQLAlchemy session may timeout or become stale in the interim, and `db.session.commit()` at line 1267 throws `InvalidRequestError`.  
**Fix:** Wrap the commit in a try-except with rollback, and consider using a new session explicitly:
```python
try:
    db.session.add(bot_msg)
    db.session.commit()
except Exception:
    db.session.rollback()
    raise
```

---

### HIDDEN-04 · `get_recommended_threads()` does N+1 queries for friend names

**Location:** `threads.py` lines 622–628  
```python
friend_names = [User.query.get(fid).name for fid in list(friends_in_thread)[:2] if User.query.get(fid)]
```
Each `.get(fid)` is a separate DB round-trip. For 200 candidate threads each with 2 friends shown, this is 800 extra queries per recommendation request.  
**Fix:** Preload friend users into a dict before the loop:
```python
friend_user_map = {u.id: u for u in User.query.filter(User.id.in_(friend_ids)).all()}
```

---

### HIDDEN-05 · Thread `last_activity` sort uses ISO string comparison in Python

**Location:** `threads.py` line 1667  
```python
threads_data.sort(key=lambda x: x["last_activity"], reverse=True)
```
Sorting ISO strings lexicographically works correctly for UTC ISO 8601 timestamps with no timezone designator. ✅ Not a bug, but fragile — if `last_activity` ever contains a timezone suffix like `+00:00`, the sort would break. Safer to sort by `Thread.last_activity` directly in the SQL query.

---

### HIDDEN-06 · `createStandaloneThread` response path mismatch

**Location:** `thread_events.js` line 201  
```js
const newId = result.data?.thread?.id ?? result.thread?.id;
```
`createStandaloneThread` (thread_api.js) returns `res.data` which (after API unwrap) = `{thread: {id:...}, added_members:[...]}`. So `result.data?.thread?.id` is undefined (result = the inner data object, `result.data` is undefined). Should be `result?.thread?.id`.  
**Fix:** `const newId = result?.thread?.id ?? result?.data?.thread?.id;`

---

### HIDDEN-07 · `requiresApproval` inline `onchange` handler uses relative import path

**Location:** `thread_modals.js` line 281  
```html
onchange="(async()=>{ const {updateThreadSettings} = await import('./thread.api.js'); ... })()"
```
Inline `onchange` attributes with `import()` use a relative path resolved from the **document URL**, not the module's URL. If the page is served at `/student/threads`, `'./thread.api.js'` resolves to `/student/thread.api.js` which doesn't exist.  
**Fix:** Replace with a `data-action` attribute and handle in delegation, or use an absolute path `/static/js/thread/thread.api.js`.

---

## Section 9 — 🟡 Performance Risks

---

### PERF-01 · `get_my_threads()` does 3 extra queries per thread (last_msg + unread count + sender)

Every call to `get_my_threads()` for a user with N threads executes:
- 1 query to fetch memberships
- N queries to fetch Thread objects
- N queries for last message
- N queries for unread count
- N queries for last message sender

For a user with 20 threads: ~80+ queries. Use `joinedload` or a single aggregate SQL query.

---

### PERF-02 · `get_recommended_threads()` executes per-thread member queries in a Python loop

**Location:** `threads.py` line 622  
`ThreadMember.query.filter_by(thread_id=thread.id).all()` inside a for-loop over up to 200 threads = 200 extra queries per recommendation request.  
**Fix:** Preload all relevant thread members in one query using `ThreadMember.thread_id.in_(thread_ids)`.

---

### PERF-03 · `open_thread` returns ALL open threads without pagination

**Location:** `threads.py` line 1966  
No `limit` or `offset`. All open threads fetched and serialized in one response. At scale, this will be extremely slow.  
**Fix:** Add pagination (`limit` + `offset` or cursor-based).

---

### PERF-04 · `_send_buckets` grows without eviction

**Location:** `websocket_threads.py` line 77  
The in-memory rate-limit dictionary keeps all user buckets alive indefinitely. For 10,000 users, this is 10,000 list entries in memory at all times.  
**Fix:** Evict buckets after inactivity: if a user hasn't sent a message in `_RATE_LIMIT_WINDOW * 2` seconds, remove their bucket entry.

---

## Section 10 — 🟣 Product Refinements

---

### PRODUCT-01 · Add visual send-button state tied to textarea content
The send button should enable/disable based on whether the textarea has content or a pending attachment. Currently always disabled (bug), but even when fixed it should respond to input.

---

### PRODUCT-02 · Replace prompt() edit with inline edit
Double-click (desktop) or long-press (mobile) on own messages should turn the bubble into an editable textarea with a ✓ / ✗ icon row. This is the industry-standard UX for message editing.

---

### PRODUCT-03 · Add unpin button to message action row for pinned messages
The pin button title changes to "Unpin" but the action always pins. Show a distinct unpin icon (📌 with strikethrough, or just toggling the button's visual) and wire it to `unpin_thread_message`.

---

### PRODUCT-04 · Show "X is typing" banner in the compose area, not in the message list
The typing indicator is currently inserted as a child of `#thread-messages-list`. It displaces content and causes layout shifts. It should render in a dedicated strip between the messages list and the compose area.

---

### PRODUCT-05 · Thread creation flow should auto-navigate to the new thread
`handleCreateThread` does this (`if (newId) await handleOpenThread(newId)`) but `createStandaloneThread` result path is broken (HIDDEN-06). Once that's fixed, the flow works. Verify end-to-end.

---

### PRODUCT-06 · Add delivery status context to group threads
For group threads, "read" status should show how many members read (e.g., "Read by 3"). Currently, any one member marking read upgrades the status to `"read"` globally. The UI shows a blue double-tick implying everyone read. This is misleading for groups.

---

### PRODUCT-07 · Long-press action sheet (`#thread-message-options-sheet`) is defined in HTML but never opened
`#thread-message-options-sheet` and `#thread-options-panel` exist in `threads.html` with proper structure. `thread_longpress.js` tries to call `openThreadMessageOptions()` (which doesn't exist). Implement the sheet properly as a bottom sheet that slides up, showing Reply / React / Edit / Pin / Delete based on ownership.

---

## Section 11 — Missing Endpoints / Backend Support

All three discovery endpoints (`/threads/recommended`, `/threads/popular`, `/threads/departments`) **do exist** in `threads.py`. No missing endpoints.

**Missing WebSocket events (need adding to client):**
- `"thread_deleted"` — server should broadcast when a creator deletes a thread (currently not emitted)
- `"thread_member_removed"` — server should broadcast when a member is kicked (currently not emitted from the REST remove endpoint)
- `"thread_closed"` / `"thread_reopened"` — so members know in real-time when state changes

---

## Section 12 — Database / Schema Refinements

**ThreadMessage.status default migration:** The `status` column was added with `DEFAULT 'sent'`. Ensure the Alembic migration runs before the WS handlers that read `getattr(msg, "status", "sent")`. Once migrated, the `getattr` fallback can be removed.

**Index recommendation:** `ThreadMessage` queries frequently filter by `(thread_id, is_deleted, sent_at)`. Add a composite index:
```python
db.Index("idx_tm_thread_active_time", "thread_id", "is_deleted", "sent_at")
```

**ThreadMessageReadReceipt N+1 in mark_thread_read:** The current code does one `SELECT` per message to check if a receipt exists. Replace with a single query:
```python
existing_ids = {r.message_id for r in ThreadMessageReadReceipt.query.filter(
    ThreadMessageReadReceipt.message_id.in_([m.id for m in unread_messages]),
    ThreadMessageReadReceipt.user_id == user_id
).all()}
```

---

## Section 13 — Final System Verdict

### Current System Health: 🔴 Not Deployable

**What breaks first in production:**
1. **Everything fails on init** (BUG-01 — `showToast` crash) — no user can access threads
2. **After BUG-01 is fixed:** Messages are sent but never received in real-time (BUG-02 — wrong join event)
3. **After BUG-02 is fixed:** Reactions, typing, pin state, send button, search, attachments all fail independently

**Biggest architectural weaknesses:**
- The WebSocket event name contract between client and server is almost entirely broken. 8 of 18 event channels are mismatched. This suggests the WS layer was built in two separate sessions with no cross-reference.
- The attachment upload flow has a fundamental architectural gap: the delegation layer stores a base64 blob but never calls the upload endpoint, and the send handler has no attachment awareness.
- Debug code (`showToast` JSON dumps) was left in a production-critical path.
- The long-press module imports symbols that don't exist, indicating it was written against a different version of the constants/modals files.

**Confidence after all fixes applied:** 🟢 ~90%. The underlying architecture (state machine, optimistic updates, cursor pagination, read receipts, rate limiting) is solid and well-structured. The bugs are mostly naming mismatches and wiring gaps, not structural design flaws. Once the event name table is corrected and the 3 most critical functional bugs (BUG-01, BUG-02, BUG-13) are fixed, the system will be functional for the core chat flow.

**Recommended fix order:**
1. BUG-01 (showToast crash) — 5 min
2. BUG-02 + BUG-03 + BUG-04 (WS room join/leave/ack names) — 10 min
3. BUG-05 + BUG-06 + BUG-07 + BUG-08 (remaining WS name table) — 15 min
4. BUG-13 (send button) — 5 min
5. BUG-17 (modal flex) — 5 min
6. BUG-12 (pin payload) — 5 min
7. BUG-14 (attachment upload) — 2 hrs
8. BUG-15 (pinned banner script) — 30 min
9. BUG-16 (search panel) — 45 min
10. Remaining issues in priority order

**Estimated total critical-path fix time: ~5–6 hours of focused engineering.**
