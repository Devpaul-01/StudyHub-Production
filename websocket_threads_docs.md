# WebSocket Thread Events — Documentation

> **File:** `websocket_threads.py`  
> **Purpose:** Handles real-time group chat for the Thread (study group) system via a room-based SocketIO architecture.  
> **Room pattern:** One SocketIO room per thread — `thread_{id}`  
> **Auth:** JWT auth is shared with `MessageWebSocketManager`; no duplicate auth state.

---

## Constants

| Constant | Value | Description |
|---|---|---|
| `MAX_MESSAGE_LENGTH` | 5,000 chars | Maximum allowed length of a thread message |
| `MAX_PINS_PER_THREAD` | 5 | Maximum number of pinned messages per thread |
| `LEARNORA_TRIGGERS` | `["@learnora"]` | Case-insensitive strings that trigger the AI assistant |
| `EDIT_WINDOW_SECONDS` | 900 (15 min) | Time window within which regular users may edit messages |

---

## Inbound Events (Client → Server)

These are events the client emits that the server listens for and handles.

---

### 🔌 Room Management

#### `join_thread_room`
**Payload:** `{ "thread_id": int }`  
**Description:** Called by the client when a user opens a thread chat view. Verifies that the user is a member of the thread, places the socket into the `thread_{id}` room, and resets the user's unread count by updating `last_read_at`.  
**Emits back:** `thread_room_joined` → `{ "thread_id": int, "your_role": str }`

---

#### `leave_thread_room`
**Payload:** `{ "thread_id": int }`  
**Description:** Called by the client when a user closes the thread view. Stops any active typing indicator for the user and removes the socket from the thread room.  
**Emits back:** Nothing.

---

### 💬 Messaging

#### `send_thread_message`
**Payload:**
```
{
  "thread_id":       int,   // required
  "text_content":    str,   // required unless attachment is present
  "reply_to_id":     int,   // optional — ID of message being replied to
  "attachment_url":  str,   // optional — URL from a prior REST upload
  "attachment_name": str,   // optional
  "attachment_type": str,   // optional — "image" | "document" | "video"
  "attachment_size": int,   // optional — size in bytes
  "client_temp_id":  str    // optional — for optimistic UI deduplication
}
```
**Description:** Sends a new message to a thread. Performs validation (membership, thread open/closed status, message length, valid `reply_to_id`), sanitizes text (strips all HTML), persists the message, atomically increments message/activity counters, parses `@mentions` to create `Mention` records and in-app `Notification`s, then broadcasts to the full room. If `@learnora` is detected, emits a `learnora_thinking` indicator and fires the AI call in a background daemon thread (non-blocking).  
**Emits:**
- `new_thread_message` → full message payload, to all room members
- `thread_message_sent` → `{ "id", "client_temp_id", "sent_at" }`, to sender only (confirmation)
- `learnora_thinking` → `{ "thread_id" }`, to all room members (if AI triggered)
- `thread_message_error` → `{ "message", "client_temp_id" }`, to sender only (on failure)

---

#### `edit_thread_message`
**Payload:** `{ "message_id": int, "text_content": str }`  
**Description:** Allows a user to edit their own message. Enforces a 15-minute edit window for non-moderators. AI-generated messages cannot be edited. New text is sanitized before saving.  
**Emits:** `thread_message_edited` → `{ "message_id", "text_content", "edited_at" }`, to all room members.

---

#### `delete_thread_message`
**Payload:** `{ "message_id": int }`  
**Description:** Soft-deletes a message, replacing its content with `"[Message deleted]"`. The message sender can delete their own messages; thread creators and moderators can delete any message. Atomically decrements the thread's `message_count` (floored at 0).  
**Emits:** `thread_message_deleted` → `{ "message_id", "deleted_by" }`, to all room members.

---

### ⌨️ Typing Indicators

#### `thread_typing`
**Payload:** `{ "thread_id": int }`  
**Description:** Notifies other members that this user has started typing. Cleans up any expired typing states (older than 3 seconds) before updating. Does not emit back to the sender's own socket.  
**Emits:** `thread_typing_started` → `{ "thread_id", "user_id", "user_name" }`, to all room members except sender.

---

#### `thread_typing_stop`
**Payload:** `{ "thread_id": int }`  
**Description:** Notifies other members that this user has stopped typing. Removes the user's entry from the typing state manager.  
**Emits:** `thread_typing_stopped` → `{ "thread_id", "user_id" }`, to all room members except sender.

---

### 😀 Reactions

#### `add_thread_reaction`
**Payload:** `{ "message_id": int, "emoji": str }`  
**Description:** Adds or updates an emoji reaction on a message. Enforces one reaction per user per message. If the user sends the same emoji they already have, it is toggled off (removed). If a different emoji is sent, the existing reaction is updated.  
**Emits:** `thread_reactions_updated` → `{ "message_id", "reactions": { emoji: { emoji, count, users[] } } }`, to all room members.

---

#### `remove_thread_reaction`
**Payload:** `{ "message_id": int }`  
**Description:** Explicitly removes the current user's reaction from a message.  
**Emits:** `thread_reactions_updated` → `{ "message_id", "reactions" }`, to all room members.

---

### 📌 Pinning

#### `pin_thread_message`
**Payload:** `{ "message_id": int }`  
**Description:** Pins a message in the thread. Restricted to thread creators and moderators only. Enforces a maximum of 5 pinned messages per thread.  
**Emits:** `thread_message_pinned` → `{ "message_id", "pinned_by", "text" (preview), "sender" }`, to all room members.

---

#### `unpin_thread_message`
**Payload:** `{ "message_id": int }`  
**Description:** Unpins a previously pinned message. Restricted to thread creators and moderators only.  
**Emits:** `thread_message_unpinned` → `{ "message_id" }`, to all room members.

---

### 👁️ Read State

#### `mark_thread_read`
**Payload:** `{ "thread_id": int }`  
**Description:** Updates the calling user's `last_read_at` timestamp for a thread, resetting their unread message count. The client should call this whenever the thread chat view is visible.  
**Emits:** Nothing.

---

### 🤖 AI Integration

#### `request_ai_response`
**Payload:**
```
{
  "thread_id": int,   // required
  "question":  str,   // required
  "mode":      str    // optional — "summarize" | "quiz" | (default: general question)
}
```
**Description:** Explicitly triggers the Learnora AI assistant without needing to type `@learnora` in chat. Useful for a dedicated "Ask AI" button in the UI. Emits a `learnora_thinking` indicator immediately, then fires the AI call in a background daemon thread. Supports three modes:
- **Default:** Passes the question directly to Learnora.
- **`"summarize"`:** Prefixes the question with `@learnora summarize`.
- **`"quiz"`:** Prefixes the question with `@learnora quiz me on`.

**Emits:**
- `learnora_thinking` → `{ "thread_id" }`, to all room members (immediately)
- `new_thread_message` → full AI message payload, to all room members (after AI responds)

---

## Outbound Events (Server → Client)

These are events the server emits to clients.

| Event | Trigger | Payload Summary |
|---|---|---|
| `thread_room_joined` | Successful `join_thread_room` | `{ thread_id, your_role }` |
| `new_thread_message` | New message sent (human or AI) | Full message object incl. sender, reactions, reply preview, attachments |
| `thread_message_sent` | Confirmation to sender | `{ id, client_temp_id, sent_at }` |
| `thread_message_edited` | Message edit | `{ message_id, text_content, edited_at }` |
| `thread_message_deleted` | Message deletion | `{ message_id, deleted_by }` |
| `thread_typing_started` | User starts typing | `{ thread_id, user_id, user_name }` |
| `thread_typing_stopped` | User stops typing | `{ thread_id, user_id }` |
| `thread_reactions_updated` | Reaction added/changed/removed | `{ message_id, reactions }` |
| `thread_message_pinned` | Message pinned | `{ message_id, pinned_by, text, sender }` |
| `thread_message_unpinned` | Message unpinned | `{ message_id }` |
| `learnora_thinking` | AI response is being generated | `{ thread_id }` |
| `thread_error` | Any validation or auth failure | `{ message: str }` |
| `thread_message_error` | Failed `send_thread_message` | `{ message, client_temp_id }` |

---

## Background Services

### `_call_learnora_for_thread` (Daemon Thread)
Runs asynchronously so it never blocks the WebSocket send path. Steps:
1. Guards against infinite loops — skips if the triggering user is the bot itself.
2. Loads the thread and fetches the last 12 non-deleted messages as conversation context.
3. Builds a system prompt using the thread's title, department, and tags.
4. Adjusts the prompt based on special commands (`@learnora summarize` → bullet summary; `@learnora quiz` → 3 comprehension questions).
5. Calls the AI provider (non-streaming, 30-second timeout).
6. Persists the AI reply as a `ThreadMessage` with `is_ai_response = True`.
7. Atomically updates the thread's `message_count` and `last_activity`.
8. Broadcasts the AI message to the thread room via `broadcast_ai_message`.

---

## Helper Methods

| Method | Description |
|---|---|
| `_get_current_user()` | Resolves `user_id` from the shared `socket_to_user` map (owned by `MessageWebSocketManager`) |
| `_emit_error(message)` | Emits a `thread_error` event with an error message to the current socket |
| `_sanitize(text)` | Strips all HTML tags using `bleach` — thread messages are plain text only |
| `_is_member(thread_id, user_id)` | Returns the `ThreadMember` record if the user belongs to the thread, else `None` |
| `_is_moderator_or_creator(membership)` | Returns `True` if the member's role is `"creator"` or `"moderator"` |
| `_parse_mentions(text)` | Extracts `@username` mentions from message text and returns a list of resolved `user_id`s; skips `@learnora` |
| `_build_message_payload(msg, sender)` | Serializes a `ThreadMessage` into a full WebSocket-ready dict, including reply preview and grouped reactions |
| `_build_reactions(message_id)` | Groups all `ThreadMessageReaction` rows for a message into `{ emoji: { emoji, count, users[] } }` |
| `broadcast_to_thread(thread_id, event, data)` | Emits any event to the `thread_{id}` room |
| `broadcast_ai_message(thread_id, msg, text)` | Called from the Learnora background thread to push the AI reply to all connected members |

---

## Architecture Notes

- **Shared SocketIO instance:** `ThreadWebSocketManager` attaches to the same SocketIO object created by `MessageWebSocketManager`. Both register handlers on the same instance.
- **Auth state sharing:** `socket_to_user` is read from `message_ws_manager` to avoid duplicating authentication logic.
- **Typing expiry:** `ThreadTypingManager` uses a 3-second timeout and cleans up stale states lazily on each typing event.
- **Non-blocking AI:** All calls to Learnora run in daemon threads so they never delay message delivery.
- **Optimistic UI support:** `client_temp_id` in `send_thread_message` lets the client replace temporary messages with the real server ID on confirmation.
- **Atomic DB updates:** Counter increments/decrements (`message_count`, `messages_sent`, `last_activity`) use SQL-level expressions to avoid race conditions.
