# 🧪 Thread Feature — Manual Testing & QA Validation Guide

> **Generated after deep code review of:** `thread_init.js`, `thread_state.js`, `thread_websocket.js`,
> `thread_events.js`, `thread_delegation.js`, `thread_render.js`, `thread_templates.js`,
> `thread_modals.js`, `thread_longpress.js`, `thread_api.js`, `thread_constants.js`,
> `threads.py` (2,626 lines), `websocket_threads.py` (1,318 lines)

---

## 1. 🧠 System Understanding Summary

### What this system is
A **real-time group chat system** built on Flask + Socket.IO (backend) and vanilla ES-module JavaScript (frontend). Each "thread" is a study group room. Members send messages, react, pin, reply, and receive live updates via WebSocket.

### Core data flow
```
User types → handleSendMessage()
  → uploadAttachment() if file pending        [REST — Cloudinary]
  → wsSendMessage()                           [adds optimistic message to DOM + state]
  → socket.emit("send_thread_message")        [WebSocket → server]
    → server validates, persists, rate-checks
    → broadcasts "new_thread_message" to room [all members]
    → emits "thread_message_sent" to sender   [confirmation with real ID]
  → sender: confirmOptimisticMessage()        [replaces temp ID with real ID]
  → receiver: addMessage() + renderNewMessage()
    → socket.emit("message_delivered")        [receiver → server]
    → server pushes "message_status_updated" to sender's personal room
  → sender opens thread: mark_thread_read → "message_status_updated" with status=read
```

### Key realtime flows
| Flow | Client Event | Server Handler | Broadcast |
|---|---|---|---|
| Join thread | `join_thread_room` | `handle_join_thread_room` | `thread_room_joined` → sender only |
| Send message | `send_thread_message` | `handle_send_thread_message` | `new_thread_message` → room; `thread_message_sent` → sender |
| Deliver tick | `message_delivered` | `handle_message_delivered` | `message_status_updated` → sender's personal room |
| Read tick | `mark_thread_read` | `handle_mark_thread_read` | `message_status_updated` (read) → each original sender's personal room |
| Typing | `thread_typing` | `handle_thread_typing` | `thread_typing_started` → room (exclude sender) |
| React | `add_thread_reaction` | `handle_add_thread_reaction` | `thread_reactions_updated` → room |
| Pin | `pin_thread_message` | `handle_pin_thread_message` | `thread_message_pinned` → room |
| Delete | `delete_thread_message` | `handle_delete_thread_message` | `thread_message_deleted` → room |
| Edit | `edit_thread_message` | `handle_edit_thread_message` | `thread_message_edited` → room |

### Hard limits baked into the backend
| Rule | Value |
|---|---|
| Message max length | 5,000 characters |
| File upload max | 25 MB |
| Max pinned messages per thread | 5 |
| Max members per thread | 50 |
| Min members per thread | 2 |
| Thread creation limit | 3 per week per user |
| Min title length | 5 characters |
| Rate limit | 30 messages / 60 seconds per user |
| Edit window (non-moderators) | 15 minutes |

---

## 2. 🛠️ Required Test Environment

### Browsers needed
- **Browser A** — Primary tester (acts as creator/moderator)
- **Browser B** — Secondary tester (acts as member/participant)

> Use two **different browser apps** on your phone (e.g., Chrome + Safari, or Chrome + Firefox). Do NOT use two tabs in the same browser — they share cookies and socket sessions, which corrupts the test.

### Accounts needed
| Account | Role | Used In |
|---|---|---|
| User A | Thread Creator | Browser A |
| User B | Thread Member | Browser B |

Both accounts must be fully approved users in the system.

### Pre-test checklist
- [ ] Both users logged in and their session cookies active
- [ ] Both browsers can reach the app (same network or production URL)
- [ ] At least one thread already exists OR you create one in the first test section
- [ ] Backend server logs visible (check console/logs for WebSocket errors during testing)
- [ ] Cloudinary upload endpoint is live (needed for attachment tests)

### Recommended testing order
1. Thread Creation (Section 3.1) — establishes the thread used in all later tests
2. WebSocket connection (Section 3.2) — confirm realtime layer is alive before anything else
3. Messaging (Section 3.3)
4. Message Status (Section 3.4)
5. Attachments (Section 3.5)
6. Reactions → Replies → Edit → Delete → Pin (Sections 3.6–3.10)
7. Search (Section 3.11)
8. Member Management (Section 3.12)
9. Invites & Join Requests (Section 3.13)
10. UI/UX edge cases (Section 3.14)
11. Permissions (Section 3.15)
12. State consistency (Section 3.16)
13. Network failure (Section 3.17)
14. Stress testing (Section 3.18)

---

## 3. ✅ Full Manual Testing Checklist

---

### 3.1 🔴 Thread Creation & Setup

---

#### TC-001 — Create a thread with valid minimum data
**Scenario:** User creates a thread with only the required fields.
**Steps:**
1. Browser A: Open the threads section.
2. Tap the "Create a Thread" button.
3. The create modal should open with fields reset (title, description, tags cleared; max_members defaulting to 10; requires_approval checked).
4. Enter a title of exactly 5 characters (e.g., "Study").
5. Leave all other fields empty.
6. Tap "Create Thread."

**Expected:** Thread is created and immediately opens. Thread appears in the list.
**Edge case:** Title of 4 characters — must fail with "Title too short (minimum 5 characters)."
**Failure condition:** Modal does not open, submit silently fails, or thread created with 4-char title.

---

#### TC-002 — Create thread with all fields filled
**Steps:**
1. Browser A: Open create modal.
2. Enter title (20+ chars), a description, set max_members to 25, add tags as comma-separated values (e.g., "math, algebra, calculus"), check requires_approval.
3. Submit.

**Expected:** Thread created with all metadata visible (tags shown, member count 1/25, "Creator" badge, requires_approval honored).
**Edge case:** Tags — enter 6 tags. Backend accepts `tags[:5]` — verify only 5 are stored.
**Failure condition:** Tags truncated silently without user feedback.

---

#### TC-003 — Create thread with max_members boundary values
**Steps:**
1. Try creating with max_members = 1 → expect error "Thread must allow at least 2 members."
2. Try creating with max_members = 51 → expect error "Thread cannot exceed 50 members."
3. Try creating with max_members = 2 → should succeed.
4. Try creating with max_members = 50 → should succeed.

**Expected:** Boundary validation works on both ends.
**Failure condition:** Value of 1 or 51 is accepted.

---

#### TC-004 — Thread creation rate limit
**Scenario:** The backend limits each user to 3 thread creations per 7-day rolling window.
**Steps:**
1. Browser A: Create 3 threads (using TC-001 procedure).
2. Attempt to create a 4th thread immediately.

**Expected:** Error toast: "You can only create 3 threads per week."
**Failure condition:** 4th thread is created without error.

---

#### TC-005 — Thread creation modal resets on reopen
**Steps:**
1. Browser A: Open create modal. Fill in a title and description.
2. Close the modal by tapping the X or outside it.
3. Reopen the modal.

**Expected:** Title, description, and tags fields are empty. max_members resets to 10. requires_approval is checked.
**Failure condition:** Previous input values are still present.

---

#### TC-006 — Thread title with special characters and XSS
**Steps:**
1. Enter title: `<script>alert(1)</script>Study`
2. Submit.

**Expected:** Thread is created. The title displays as literal text — no alert fires. Backend sanitizes with bleach.
**Edge case:** Enter title with HTML like `<b>Bold</b>` — should display as literal `<b>Bold</b>`, not bold text.
**Failure condition:** Alert fires or HTML is rendered.

---

#### TC-007 — Verify thread appears in Browser B's list
**Steps:**
1. Browser A: Create a new thread (requires_approval = off so B can join directly).
2. Browser B: Invite or join the thread.
3. Browser B: Check thread list.

**Expected:** Thread appears in B's list with correct title, member count, and "No messages yet" preview.
**Failure condition:** Thread does not appear in B's list until manual refresh.

---

### 3.2 🟠 WebSocket Connection & Room Joining

---

#### TC-008 — Initial socket connection on page load
**Steps:**
1. Browser A: Open the threads section.
2. Watch for toast: "Connected to real-time server."
3. Open browser console — no errors related to socket.io.

**Expected:** Toast appears within 2–3 seconds. No console errors.
**Failure condition:** No toast, console shows connection errors, or socket.io CDN fails to load.

---

#### TC-009 — Room join on thread open
**Steps:**
1. Browser A: Tap a thread in the list.

**Expected:** Toast appears: "Joined thread as creator" (or "member").
This confirms `thread_room_joined` was received from the server.
**Failure condition:** No toast. This means the `join_thread_room` event did not reach the server, or the server did not emit `thread_room_joined`.

---

#### TC-010 — Room join only happens if user is a member
**Steps:**
1. Browser B: Attempt to open a thread URL (via URL hash `#thread-{id}`) that User B is NOT a member of.

**Expected:** Error toast from server: "You are not a member of this thread." Chat view does not open.
**Failure condition:** Thread chat opens despite B not being a member.

---

#### TC-011 — Reconnect does NOT double event listeners
**Steps:**
1. Browser A: Open a thread and send one message (1 appears in chat).
2. Simulate a reconnect: toggle airplane mode off then on, or disable/re-enable Wi-Fi.
3. Wait for "Connected to real-time server" toast.
4. Send one more message from Browser B.

**Expected:** Exactly 1 new message bubble appears on Browser A's screen.
**Failure condition:** 2 or 4 duplicate message bubbles appear. This is the exact bug that was fixed (reconnect was re-registering listeners without removing old ones).

---

#### TC-012 — Leave room on thread close
**Steps:**
1. Browser A: Open a thread.
2. Tap the back button to return to the thread list.
3. Browser B: Send a message in that thread.

**Expected:** Browser A does NOT receive a toast or new message event (it left the room).
**Failure condition:** Browser A still receives realtime events for the thread it closed.

---

### 3.3 🟠 Real-Time Messaging

---

#### TC-013 — Basic send and receive between two users
**Steps:**
1. Both browsers open the same thread.
2. Browser A: Type "Hello from A" and send.

**Expected on Browser A:** Message appears immediately as a bubble (optimistic, slightly dimmed/pending). Within ~1 second it transitions to confirmed (opacity restored, pending class removed, single checkmark tick).
**Expected on Browser B:** Message appears within ~1–2 seconds without any action from B.
**Failure condition:** Message not delivered to B; message stays in "pending" state on A indefinitely.

---

#### TC-014 — Optimistic message display
**Scenario:** The frontend renders the message locally before the server confirms.
**Steps:**
1. Browser A: Type a message and tap Send very quickly.
2. Watch the message bubble immediately.

**Expected:** Message appears in the chat with opacity ~0.7 and a dashed-circle icon (pending status). This is the optimistic render — it happens before server responds.
**Failure condition:** There is a noticeable delay before the message appears in A's own chat.

---

#### TC-015 — Message send failure → Retry
**Scenario:** Simulate a failed message.
**Steps:**
1. Browser A: Disable network AFTER opening the thread and joining the room.
2. Type a message and tap Send.
3. Wait ~5 seconds.

**Expected:** Message bubble transitions to "failed" state — red error icon + "Retry" button below the bubble. Toast: "Message failed to send. Tap Retry to try again."
**Steps continued:**
4. Re-enable network.
5. Tap "Retry" on the failed message.

**Expected:** Message transitions back to pending, then to confirmed. No duplicate message appears.
**Failure condition:** Retry causes a duplicate message, or no Retry button appears, or the pending message stays in limbo forever (the original bug that was fixed).

---

#### TC-016 — Simultaneous send from both browsers
**Steps:**
1. Both browsers have the thread open.
2. Browser A and Browser B both type and send a message within 2 seconds of each other.

**Expected:** Both messages appear on both screens in chronological order. No messages are lost or duplicated.
**Failure condition:** One message disappears; messages are out of order; one browser doesn't receive the other's message.

---

#### TC-017 — Rapid-fire sending (10 messages fast)
**Steps:**
1. Browser A: Send 10 messages as fast as possible (type short text, tap Send repeatedly).

**Expected:** All messages appear in order. No duplicates. After message 30 within 60 seconds, expect a rate-limit error toast: "Slow down — max 30 messages per minute."
**Edge case:** Test exactly the 30-message boundary.
**Failure condition:** Messages appear out of order; duplicates appear; rate limit is not enforced.

---

#### TC-018 — Message max length (5,000 characters)
**Steps:**
1. Browser A: Paste 5,000 characters into the input and send. Should succeed.
2. Try 5,001 characters. Backend rejects with an error.

**Expected:** 5,000 chars: message sends. 5,001 chars: error toast from server.
**Note:** Frontend has no character counter — user will not know the limit until it's rejected.
**Failure condition:** 5,001-char message is accepted, or 5,000-char message is rejected.

---

#### TC-019 — Empty message prevention
**Steps:**
1. Browser A: Click inside the message input but type nothing. Tap Send button.
2. Press Enter with empty input.

**Expected:** Nothing happens. Send button should be disabled when input is empty and no attachment is pending.
**Failure condition:** Empty message is sent (blank bubble appears).

---

#### TC-020 — Send button enable/disable logic
**Steps:**
1. Observe Send button with empty input — must be disabled.
2. Type one character — button must enable.
3. Delete that character — button must re-disable.
4. Attach a file (no text) — button must enable.
5. Remove the attachment — button must re-disable.

**Expected:** Button state changes in all 5 scenarios above.
**Failure condition:** Button is permanently disabled (the original bug that was fixed), or permanently enabled allowing empty sends.

---

#### TC-021 — Browser refresh behavior
**Steps:**
1. Browser A: Open a thread with some messages.
2. Hard-refresh Browser A (reload page).

**Expected:** Thread list reloads. The specific thread does NOT auto-open (no URL hash) unless the URL hash is present. No ghost socket listeners exist. Reconnect toast appears.
**Steps continued:**
3. Re-open the thread manually from the list.

**Expected:** Messages reload from the API. WebSocket re-joins the room exactly once.
**Failure condition:** Refreshing causes doubled messages on next send; thread does not reload messages.

---

#### TC-022 — Switching threads during incoming message
**Scenario:** The fragile "rapid tab-switching" case.
**Steps:**
1. Browser B: Keep a thread open. Browser A sends a stream of messages (rapid-fire).
2. Browser B: While messages are arriving, quickly tap a different thread in the list, then tap back to the original thread.

**Expected:** No messages are duplicated. Final message count is correct. The new thread loaded cleanly (its messages appear, old thread's messages gone).
**Failure condition:** Duplicate messages appear; messages from thread 1 appear in thread 2's chat; room is joined twice.

---

#### TC-023 — Thread open from URL hash
**Steps:**
1. Browser A: Note the URL hash when thread is open (e.g., `#thread-42`).
2. Close the thread, then paste that URL directly (reload with hash).

**Expected:** On load, the thread auto-opens and messages load. `handleOpenThread(42)` is called during init.
**Failure condition:** Thread does not open; shows blank chat panel.

---

### 3.4 🔵 Message Status System

---

#### TC-024 — Pending → Sent tick transition
**Steps:**
1. Browser A: Send a message. Watch the status icon in the bottom-right of the bubble.

**Expected:** Icon starts as dashed circle (pending). Transitions to single checkmark (sent) within ~1 second when `thread_message_sent` is received.
**Failure condition:** Icon stays as dashed circle indefinitely; never transitions to sent.

---

#### TC-025 — Sent → Delivered tick transition
**Steps:**
1. Browser A sends a message. Browser B has the same thread open.

**Expected on Browser A:** Within ~1–2 seconds of B receiving the message, the status icon transitions from single checkmark (sent) to double checkmark (delivered). This is triggered by B emitting `message_delivered` back to the server, which then pushes `message_status_updated` to A's personal room.
**Failure condition:** Icon never progresses past single checkmark even when B is online and has the thread open.

---

#### TC-026 — Delivered → Read (blue ticks) transition
**Steps:**
1. Browser A sends a message. Browser B has the thread open and sees the message.
2. Browser B scrolls to the message (thread is visible and focused).

**Expected on Browser A:** The double checkmarks turn blue (read status). This happens when B's `mark_thread_read` call goes through.
**Failure condition:** Ticks never turn blue; Browser A never knows if B read the message.

---

#### TC-027 — Status only upgrades, never downgrades
**Steps:**
1. Browser A sends a message to B. Wait for blue ticks (read).
2. Browser A: Close the thread and reopen it.

**Expected:** Messages that were "read" stay at read status after reopening. Status does not reset to "sent."
**Failure condition:** Status resets to "sent" or "delivered" on thread reopen.

---

#### TC-028 — Status of messages sent when B is offline
**Steps:**
1. Browser B: Close the app / go offline.
2. Browser A: Send 3 messages.

**Expected on Browser A:** All 3 messages show single checkmark (sent) — no delivery upgrade since B isn't connected.
**Steps continued:**
3. Browser B: Come back online and open the thread.

**Expected:** Browser B sees all 3 messages. Browser A's ticks eventually upgrade to delivered (when B renders them) and then read (when B's `mark_thread_read` fires).
**Failure condition:** Ticks never upgrade when B comes back; messages not shown to B.

---

#### TC-029 — Status icons render correctly on reload
**Steps:**
1. Browser A sends messages. Wait for read status.
2. Reload Browser A and reopen the thread.

**Expected:** Messages loaded from API have their status icons reflect the stored state (the `status` field in the API response).
**Note:** The API serializes `status` in `serialize_message()`. Check that loaded messages show the correct tick (not all showing "sent").
**Failure condition:** All old messages show "sent" tick even if they were previously "read."

---

### 3.5 🟡 Attachments & Media

---

#### TC-030 — Upload a valid image
**Steps:**
1. Browser A: Tap the attachment (paperclip) button.
2. Select a JPG or PNG under 25 MB.

**Expected:** Attachment strip appears below the input showing the filename, size in KB, and an image emoji (🖼️). The send button enables even if the text input is empty. Tapping Send: "Uploading file…" toast appears, then the message sends with the image rendered inline (thumbnail, max 220×220px, tappable to open full).
**Expected on Browser B:** Message arrives with the image embedded.
**Failure condition:** File is not uploaded (only stored as base64 and silently dropped — the original bug). Image does not appear; broken image icon shown.

---

#### TC-031 — Upload a non-image file (PDF)
**Steps:**
1. Browser A: Attach a PDF file.

**Expected:** Attachment strip shows 📎 icon, filename, size. Message sends as a file attachment — renders as a download link row (📎 icon + filename + file size + download arrow). Not as an inline image.
**Expected on Browser B:** Tapping the file link opens/downloads the PDF.
**Failure condition:** PDF is shown as a broken image.

---

#### TC-032 — Upload a video file
**Steps:**
1. Browser A: Attach an MP4 video (under 25 MB).

**Expected:** Sends as a `<video>` element with controls in the message bubble. Preload is `metadata` only (does not autoplay or auto-download).
**Failure condition:** Video does not play; renders as broken image or download link.

---

#### TC-033 — File over 25 MB is rejected before upload
**Steps:**
1. Browser A: Attempt to attach a file larger than 25 MB.

**Expected:** Error toast: "File too large (max 25 MB)." File is NOT uploaded. Attachment strip does not appear. Send button state unchanged.
**Failure condition:** Large file is accepted and sent (or silently fails mid-upload).

---

#### TC-034 — Clear pending attachment
**Steps:**
1. Browser A: Attach a file (strip appears).
2. Tap the ✕ button in the attachment strip.

**Expected:** Strip disappears. `pendingAttachment` is cleared from state. Send button re-evaluates — if text input is empty, button becomes disabled.
**Failure condition:** Strip disappears but attachment is still uploaded when Send is tapped; or button remains enabled after clearing.

---

#### TC-035 — Attachment + text message together
**Steps:**
1. Browser A: Attach a file AND type text in the input.
2. Send.

**Expected:** Message sends with both text content and the attachment. Both render in the bubble.
**Failure condition:** Only text sends (attachment lost), or only attachment sends (text lost).

---

#### TC-036 — Attachment strip disappears after send
**Steps:**
1. Browser A: Attach a file and send the message.

**Expected:** After successful send, the attachment strip is cleared from the UI. `pendingAttachment` is null.
**Failure condition:** Attachment strip remains visible after send; next message also sends the old attachment.

---

#### TC-037 — Attachment persists incorrectly across thread switch
**Scenario:** A previous bug where `pendingAttachment` leaked between threads (now fixed).
**Steps:**
1. Browser A: Attach a file to Thread 1 (do NOT send).
2. Navigate back to the thread list and open Thread 2.

**Expected:** No attachment strip visible in Thread 2. `pendingAttachment` is null after thread switch.
**Failure condition:** Attachment strip appears in Thread 2 with Thread 1's file.

---

#### TC-038 — Media & Files viewer
**Steps:**
1. Browser A: Open thread info (ⓘ button) → tap "Media & Files."

**Expected:** Full-screen modal opens listing all attachments sent in this thread with sender name, date, and a preview (image thumbnail / video player / file icon). Close button (✕) works.
**Edge case:** Thread with no attachments — shows "No attachments in this thread yet."
**Failure condition:** Modal is blank; modal does not open; close button doesn't work.

---

### 3.6 😊 Reactions

---

#### TC-039 — Add a reaction (long-press or ⋯ menu)
**Steps:**
1. Browser A: Long-press (500ms hold) any message — bottom sheet should slide up.
2. Tap "React" (😊) in the sheet.
3. Emoji picker grid appears. Tap 👍.

**Expected:** Picker closes. Reaction pill "👍 1" appears below the message bubble. On Browser B: same pill appears in real time via `thread_reactions_updated` event.
**Failure condition:** Long-press does nothing; picker doesn't open; reaction doesn't appear; B doesn't see it in real-time.

---

#### TC-040 — Reaction toggle (same emoji removes it)
**Steps:**
1. Browser A: React to a message with 👍.
2. Browser A: React to the same message with 👍 again.

**Expected:** Reaction is removed. Pill disappears (count goes to 0, pill removed). B sees the removal in real-time.
**Failure condition:** Second tap adds a second reaction instead of toggling it off; count shows "2" instead of being removed.

---

#### TC-041 — Change reaction to different emoji
**Steps:**
1. Browser A: React with 👍.
2. Browser A: Open the emoji picker for the same message, tap ❤️.

**Expected:** 👍 reaction is replaced by ❤️. Old pill disappears, new one appears.
**Failure condition:** Both reactions show simultaneously; old reaction is not replaced.

---

#### TC-042 — Reaction from Browser B visible in real time on Browser A
**Steps:**
1. Browser A sends a message.
2. Browser B: Long-press the message, react with 🔥.

**Expected on Browser A:** "🔥 1" pill appears on that message within 1–2 seconds, without any action by A.
**Failure condition:** A does not see B's reaction until refresh.

---

#### TC-043 — Reaction pill shows "my" highlight
**Steps:**
1. Browser A: React to a message with ❤️.

**Expected:** Browser A's ❤️ pill has an indigo ring/highlight (bg-indigo-100 + ring) because `mine=true`. Browser B's view of the same pill has no highlight.
**Failure condition:** Own reaction is not visually distinguished.

---

#### TC-044 — Tapping a reaction pill also reacts/toggles
**Steps:**
1. Browser B reacts to a message with 🎉.
2. Browser A: Tap the "🎉 1" pill that appears on that message.

**Expected:** Browser A also adds 🎉. Count becomes "🎉 2." Browser B sees the count update.
**Failure condition:** Tapping the pill does nothing; pill does not trigger reaction.

---

### 3.7 ↩️ Replies

---

#### TC-045 — Reply to a message
**Steps:**
1. Browser A: Long-press a message sent by B → bottom sheet → tap "Reply."

**Expected:** Bottom sheet closes. A reply preview strip appears above the input, showing the original sender name and first 80 characters of the message. Input gains focus.
2. Type a reply and send.

**Expected:** Message sends with a quoted reply block embedded in the bubble showing the original text. On Browser B: reply arrives with the same quoted block.
**Failure condition:** Reply context strip doesn't appear; reply is sent without the quote; B doesn't see the quoted context.

---

#### TC-046 — Cancel a reply
**Steps:**
1. Browser A: Long-press → Reply → reply preview appears.
2. Tap the ✕ in the reply preview strip.

**Expected:** Strip disappears. Next message sent will NOT have a reply context.
**Also test:** Press Escape key — should also cancel reply (Escape handler in delegation.js checks for active reply first).
**Failure condition:** Sending after cancel still includes the reply context.

---

#### TC-047 — Tapping a reply preview jumps to original message
**Steps:**
1. Browser A: Send a message that has a reply (see TC-045).
2. Tap the quoted reply preview block inside the message bubble.

**Expected:** Chat scrolls smoothly to the original quoted message, which briefly highlights (yellow flash for 2,500ms).
**Failure condition:** Nothing happens; scroll jumps to wrong message; original message is not highlighted.

---

#### TC-048 — Reply to a message not currently in DOM
**Scenario:** The original message was sent 200 messages ago and is not loaded.
**Steps:**
1. Use a thread with many messages (> 30, triggering pagination).
2. Tap a reply preview that references a message outside the current page.

**Expected:** `handleScrollToMessage()` fetches older messages from the API, prepends them to the list, and scrolls to the target message with highlight.
**Failure condition:** "Could not locate message" toast appears; crash; nothing happens.

---

### 3.8 ✏️ Edit Message

---

#### TC-049 — Edit own message (within 15 minutes)
**Steps:**
1. Browser A: Send a message.
2. Long-press that message → bottom sheet → "Edit."

**Expected:** Bottom sheet closes. An inline textarea appears inside the message bubble containing the current message text. "Save" and "Cancel" buttons appear below it.
3. Change the text and tap "Save."

**Expected:** Inline editor disappears. Message text updates in place. An "(edited)" label appears beside the timestamp. On Browser B: the message text updates in real time.
**Failure condition:** Inline editor doesn't appear (old bug used `prompt()`); edit doesn't broadcast to B; "(edited)" label missing.

---

#### TC-050 — Cancel inline edit
**Steps:**
1. Open inline editor (TC-049 steps 1–2).
2. Change the text.
3. Tap "Cancel."

**Expected:** Inline editor disappears. Original message text is restored (no change saved).
**Failure condition:** Changed text remains visible; edit is saved despite cancelling.

---

#### TC-051 — Edit window expired (> 15 minutes, non-moderator)
**Scenario:** Regular member trying to edit a message older than 15 minutes.
**Steps:**
1. Browser A (as a regular member, not creator): Send a message.
2. Wait 16 minutes OR test with a message from a previous session that is more than 15 min old.
3. Long-press → Edit.

**Expected:** Server returns error: "Edit window expired (15 minutes)." Toast appears on Browser A.
**Note:** Creators and moderators bypass the edit window — they can edit any message any time.
**Failure condition:** Edit succeeds past the 15-minute window for regular members.

---

#### TC-052 — Edit message text updates on Browser B in real time
**Steps:**
1. Both browsers have thread open.
2. Browser A edits a message.

**Expected:** Browser B sees the updated text appear in real time without refresh. The "(edited)" label also appears on B's view.
**Failure condition:** B requires refresh to see the edit.

---

#### TC-053 — Cannot edit AI (Learnora) messages
**Steps:**
1. Trigger a Learnora response (see Section 3.19).
2. Long-press the Learnora message.

**Expected:** Bottom sheet does NOT show "Edit" option for AI messages. If attempted directly via socket event, server returns "AI messages cannot be edited."
**Failure condition:** Edit option appears for AI messages; AI message can be changed.

---

### 3.9 🗑️ Delete Message

---

#### TC-054 — Delete own message
**Steps:**
1. Browser A: Long-press own message → bottom sheet → "Delete."

**Expected:** Bottom sheet closes. Message bubble changes to "[deleted]" text in italic, faded style. Reactions are removed. The ⋯ options button disappears from that bubble. On Browser B: same visual change in real time.
**Failure condition:** Delete option doesn't appear; message is not visually marked as deleted; B does not see the change.

---

#### TC-055 — Regular member cannot delete another member's message
**Steps:**
1. Browser B (as member): Long-press a message sent by User A.

**Expected:** "Delete" option does NOT appear in Browser B's bottom sheet for A's message.
**Failure condition:** Delete option appears for other users' messages to non-moderators.

---

#### TC-056 — Creator/moderator CAN delete any message
**Steps:**
1. Browser A (as creator): Long-press a message sent by User B.

**Expected:** "Delete" option IS visible in the bottom sheet. Deleting succeeds. B sees message become "[deleted]."
**Failure condition:** Creator cannot delete B's messages.

---

#### TC-057 — Deleted message cannot be replied to or edited
**Steps:**
1. Delete a message (TC-054).
2. Long-press the "[deleted]" bubble.

**Expected:** Bottom sheet opens but does NOT show Reply, React, Edit, or Pin options — only options valid for deleted messages (currently none in the implementation).
**Failure condition:** Deleted message still shows action options.

---

### 3.10 📌 Pinned Messages

---

#### TC-058 — Pin a message (creator/moderator only)
**Steps:**
1. Browser A (as creator): Long-press any message → "Pin."

**Expected:** Bottom sheet closes. A 📌 pin badge appears on the message bubble. The pinned banner appears at the top of the chat (amber background) showing the pinned sender name and truncated text. On Browser B: same banner appears in real time.
**Failure condition:** Pin option not available; banner doesn't appear; B doesn't see the banner.

---

#### TC-059 — Pin option not available for regular members
**Steps:**
1. Browser B (as regular member): Long-press any message.

**Wait** — re-check the code. The options sheet code shows Pin is available to BOTH moderators AND non-moderators:
```js
canModerate ? pinBtn : (!isDeleted ? pinBtn : "")
```
This means ALL non-deleted messages show Pin in the sheet for ALL users.

**Expected actual behavior:** Pin button appears for everyone in the sheet. However, the server rejects non-moderator pin attempts with "Only creator or moderator can pin messages."
**Steps:**
1. Browser B (regular member): Long-press → Pin a message.
**Expected:** Error toast on B: "Only creator or moderator can pin messages."
**⚠️ This is a UI inconsistency bug to flag:** B sees the Pin option but it always fails — the option should be hidden for members.

---

#### TC-060 — Unpin a message
**Steps:**
1. Browser A: Pin a message (see TC-058).
2. Browser A: Long-press the same message → sheet shows "Unpin."

**Expected:** Banner updates or disappears if no more pinned messages. 📌 badge removed from bubble.
**Failure condition:** Sheet still shows "Pin" instead of "Unpin" for already-pinned messages; unpin doesn't update the banner.

---

#### TC-061 — Pin limit of 5
**Steps:**
1. Browser A: Pin 5 different messages.
2. Try to pin a 6th.

**Expected:** Error toast: "Max 5 pinned messages per thread."
**Failure condition:** More than 5 messages are pinned; no error on 6th pin.

---

#### TC-062 — Pin banner cycling with multiple pinned messages
**Steps:**
1. Pin 3 different messages (TC-058 × 3).
2. Tap the ▲ / ▼ navigation arrows in the pin banner.

**Expected:** Banner text cycles through the 3 pinned messages. The 📌 icon button and the content area `data-message-id` both update correctly. Index wraps around (from last → first).
**Failure condition:** Arrows do nothing; wrong message ID used for navigation; banner text doesn't change.

---

#### TC-063 — Tapping pinned banner message jumps to it
**Steps:**
1. With the pin banner showing, tap the message text or the 📌 icon.

**Expected:** Chat scrolls to that specific pinned message (highlight animation). `handleScrollToMessage()` is called with the correct message ID.
**Failure condition:** Tapping does nothing; scrolls to wrong message.

---

#### TC-064 — "All" button in banner opens pinned list panel
**Steps:**
1. Tap "All" in the pinned banner OR the 📌 button in the header.

**Expected:** A modal opens listing all pinned messages with sender name, date, and a "Pinned by" attribution. Tapping any item scrolls to that message. Modal closes when tapping the ✕ or outside.
**Failure condition:** Modal is empty; modal doesn't open; jumping to message fails.

---

#### TC-065 — Banner disappears when last pin is removed
**Steps:**
1. Have exactly 1 pinned message — banner shows.
2. Unpin it.

**Expected:** Banner disappears completely from both browsers.
**Failure condition:** Banner remains (empty or showing old data).

---

#### TC-066 — Deleted pinned message behavior
**Steps:**
1. Pin a message. Verify banner shows it.
2. Delete that message (soft-delete).

**Expected:** The pin banner should not show deleted messages. After deletion, the banner should re-render using only non-deleted pinned messages.
**Note:** The code filters `threadState.messages.filter((m) => m.is_pinned && !m.is_deleted)` before calling `renderPinnedBanner`. Verify this works correctly.
**Failure condition:** "[deleted]" text appears in the pin banner.

---

### 3.11 🔍 Search & Navigation

---

#### TC-067 — Open the search panel
**Steps:**
1. Browser A: Tap the 🔍 button in the thread header.

**Expected:** A search panel slides in / becomes visible. The search input gains focus automatically (within 50ms per the code). Previous results are cleared.
**Failure condition:** Panel doesn't open (the original bug — was calling `handleThreadSearch()` without opening the panel); input does not focus.

---

#### TC-068 — Search with results
**Steps:**
1. Browser A: Type a word you know exists in the thread (minimum 2 characters — shorter queries are ignored).
2. Wait ~300ms (debounce).

**Expected:** Results appear: each result shows sender name, timestamp, and the message text with the matching word highlighted in indigo. Tapping a result scrolls to that message in the chat.
**Failure condition:** No results appear despite messages matching; highlight doesn't work; tap on result does nothing.

---

#### TC-069 — Search with no results
**Steps:**
1. Search for a string that does not exist in any message (e.g., "zxqwerty999").

**Expected:** Empty state shown: "No results for 'zxqwerty999'". Toast: "No messages matched your search."
**Failure condition:** Blank results area with no message; crash.

---

#### TC-070 — Close search panel
**Steps:**
1. Open search panel (TC-067).
2. Press Escape key.

**Expected:** Panel closes. Search results are cleared.
**Also test:** Tapping the ✕ close button.
**Failure condition:** Escape closes the wrong thing (e.g., navigates back to thread list instead of closing panel); results remain visible after panel closes.

---

#### TC-071 — Jump to a message that IS in the DOM
**Steps:**
1. Search for a message visible in the current chat window.
2. Tap the search result.

**Expected:** Chat scrolls to that exact message. It flashes/highlights for 2,500ms, then returns to normal.
**Failure condition:** Scroll happens but to wrong message; highlight doesn't appear.

---

#### TC-072 — Jump to a message NOT in the DOM (pagination fetch)
**Scenario:** Most critical search test — searching for a message from 50+ messages ago.
**Steps:**
1. In a thread with 60+ messages, search for text from an older message (one that is NOT in the current 30-message window).
2. Tap that result.

**Expected:** `handleScrollToMessage()` detects the element is not in the DOM. It calls `fetchMessages()` with `beforeId = messageId + 1` to load the surrounding page. Those messages are prepended. Then the target message scrolls into view with a highlight.
**Failure condition:** "Could not locate message" error; nothing happens; page loads but wrong message is highlighted.

---

#### TC-073 — Thread list search (filter list)
**Steps:**
1. Browser A: In the thread list view, type in the search bar at the top.

**Expected:** Thread list filters in real time (debounced at 150ms) to show only threads matching the query against title, description, tags, or department. Clearing the search shows all threads again.
**Failure condition:** Filter doesn't work; clears the entire list; no debounce (laggy on each keystroke).

---

### 3.12 👥 Member Management

---

#### TC-074 — View thread members in info modal
**Steps:**
1. Browser A: Tap the ⓘ info button in the thread header.

**Expected:** Info modal opens with thread avatar, title, description, tags, department, creation date, member count, and a scrollable member list. Each member shows name, username, online/offline dot, role badge, and message count.
**Failure condition:** Modal content is blank; member list empty despite members existing; modal renders off-screen (the original bug where `flex` was missing from the modal class).

---

#### TC-075 — Online status indicator in member list
**Steps:**
1. Browser B: Be logged in and have the thread open.
2. Browser A: Open the info modal.

**Expected:** Browser B's user shows a green dot (online). A user who is not connected shows a grey dot.
**Failure condition:** All dots are grey regardless of online status.

---

#### TC-076 — Promote member to moderator
**Steps:**
1. Browser A (creator): Open info modal.
2. Tap "Make Mod" next to Browser B's entry.

**Expected:** Success toast: "Member promoted to moderator." Info modal refreshes. B's entry now shows "Mod" badge. B can now pin/delete other users' messages.
**Failure condition:** "Make Mod" button not visible; promotion fails; B's badge doesn't update.

---

#### TC-077 — Demote moderator back to member
**Steps:**
1. After TC-076, Browser A: In the info modal, tap "Remove Mod" next to B.

**Expected:** B's role reverts to "member." "Remove Mod" button changes back to "Make Mod."
**Failure condition:** Demotion fails; B retains mod permissions.

---

#### TC-078 — Remove a member with confirmation modal
**Steps:**
1. Browser A (creator): In the info modal, tap "Remove" next to B.

**Expected:** A custom confirmation modal appears ("Are you sure you want to remove this member?") — NOT the browser's native `window.confirm()`. Tapping Cancel does nothing. Tapping OK removes B from the thread.
**Expected on Browser B:** Toast appears: "You were removed from this thread." Browser B is automatically navigated back to the thread list. B can no longer see or open the thread.
**Failure condition:** `window.confirm()` appears (browser native dialog — the original bug); removal works but B's screen doesn't navigate away; member count doesn't decrease.

---

#### TC-079 — Removed member cannot rejoin via direct socket
**Steps:**
1. Remove Browser B from the thread.
2. Browser B attempts to navigate to the thread URL hash (if they have it).

**Expected:** `join_thread_room` is rejected by the server: "You are not a member of this thread."
**Failure condition:** B can still join the room and receive messages.

---

#### TC-080 — Leave thread (member perspective)
**Steps:**
1. Browser B (member): Open info modal → "Leave Thread."

**Expected:** Custom confirmation modal appears. On confirm, B is navigated back to the list. Thread disappears from B's thread list.
**Failure condition:** Native `window.confirm()` appears (original bug); B stays in the thread after confirming leave; thread remains in B's list.

---

#### TC-081 — Creator cannot leave their own thread
**Steps:**
1. Browser A (creator): Check if "Leave Thread" option exists.

**Expected:** "Leave Thread" button is NOT shown for the creator (the info modal shows creator controls, not a leave button).
**Failure condition:** Creator can leave their own thread (would orphan it).

---

### 3.13 📨 Invitations & Join Requests

---

#### TC-082 — Send an invitation to a user
**Steps:**
1. Browser A (creator): Open the info modal → look for invite functionality (or use direct API if UI doesn't expose it).

**Expected:** User B receives a notification. On Browser B: the invite section at the top of the threads page shows the invite with Accept/Decline buttons.
**Failure condition:** Invite doesn't appear for B; invite section is empty (the original bug — invites were never populated on init).

---

#### TC-083 — Accept an invitation
**Steps:**
1. Browser B: See pending invite with "Accept" button.
2. Tap "Accept."

**Expected:** Invite row is removed. Thread immediately loads for B. B appears in A's member list. Thread list updates for B.
**Failure condition:** Accept works on API but thread doesn't open; invite row remains after accept.

---

#### TC-084 — Decline an invitation
**Steps:**
1. Browser B: Tap "Decline" on a pending invite.

**Expected:** Invite row disappears. B does NOT join the thread.
**Failure condition:** Declining accidentally joins the thread; row remains visible.

---

#### TC-085 — Join an approval-required thread
**Steps:**
1. Browser A: Create a thread with `requires_approval = true`.
2. Browser B: Find the thread in discovery/open list, tap "Join."

**Expected:** A join request modal appears for B with an optional introduction message textarea. Tapping "Send Request" sends the request. Toast: "Join request sent! Waiting for approval."
**Expected on Browser A:** The pending requests section shows B's request with Approve/Reject buttons.
**Failure condition:** B joins directly without approval; modal doesn't appear; A doesn't see the request.

---

#### TC-086 — Approve a join request
**Steps:**
1. After TC-085, Browser A: Tap "Approve" on B's request.

**Expected:** Request row disappears from A's view. Browser B automatically opens the thread (if B is active) or sees it in their list. B's member count increases.
**Failure condition:** Request disappears but B doesn't get access; member count wrong.

---

#### TC-087 — Reject a join request
**Steps:**
1. Browser A: Tap "Reject" on a pending request.

**Expected:** Request row disappears. The requesting user does not join the thread.
**Failure condition:** Rejection still adds the user to the thread.

---

#### TC-088 — Cancel own join request
**Steps:**
1. Browser B: Send a join request (TC-085).
2. Browser B: In "My Requests" view, tap Cancel.

**Expected:** Request is cancelled. B remains outside the thread. A no longer sees B's request in pending.
**Failure condition:** Cancel has no effect; request persists on A's side.

---

#### TC-089 — Duplicate join request prevention
**Steps:**
1. Browser B: Send a join request to Thread X.
2. Browser B: Attempt to send another join request to the same thread.

**Expected:** Server rejects the second request (409 conflict or similar). Toast on B: duplicate request error.
**Failure condition:** Multiple pending requests from the same user are created.

---

### 3.14 🎨 UI / UX Testing

---

#### TC-090 — Message bubble height with short messages
**Scenario:** The original bug was inline action rows making short messages very tall.
**Steps:**
1. Send a one-word message like "Hi."

**Expected:** Bubble is compact. Only text, timestamp, and status tick. No oversized action row. The ⋯ options button is hidden by default, visible only on hover (or via long-press on mobile).
**Failure condition:** Bubble is excessively tall for a short message; inline actions expand the bubble.

---

#### TC-091 — Long-press on mobile opens options sheet
**Steps:**
1. Browser A (mobile): Hold down on a message bubble for 500ms.

**Expected:** Device vibrates (if supported). Bottom sheet slides up from the bottom with message action options.
**Failure condition:** Nothing happens; long-press triggers text selection instead; bottom sheet doesn't slide up.

---

#### TC-092 — Escape key order of operations
**Scenario:** Escape key has a priority chain: sheet → emoji picker → reply → search panel → back to list.
**Steps:**
1. Open the options bottom sheet → press Escape → sheet closes. (Nothing else closes.)
2. Open emoji picker → press Escape → picker closes. (Sheet and reply unchanged.)
3. Have a reply active → press Escape → reply is cancelled. (Thread stays open.)
4. Open search panel → press Escape → search closes. (Thread stays open.)
5. In a thread with no sheet/picker/reply/search → press Escape → navigates back to thread list.

**Expected:** Each Escape press handles exactly one layer, in the correct priority order.
**Failure condition:** Escape skips a layer; pressing once goes all the way back to the thread list bypassing active sheets.

---

#### TC-093 — Modal backdrop click closes modal
**Scenario:** The original bug used `{ once: true }` on the backdrop listener, causing it to be consumed after one inner click and stop working.
**Steps:**
1. Open the info modal (ⓘ button).
2. Tap inside the modal content (e.g., tap a member's name).
3. Then tap the dark backdrop OUTSIDE the modal.

**Expected:** Modal closes on backdrop tap, even after prior inner interactions.
**Failure condition:** Backdrop click has no effect after any interaction inside the modal (original bug).

---

#### TC-094 — Thread list empty state
**Steps:**
1. Use an account that has no threads.

**Expected:** Empty state shows 💬 emoji, "No threads yet.", and a "Create a Thread" button.
**Failure condition:** Blank white screen; error state instead of empty state.

---

#### TC-095 — Thread list loading skeleton
**Steps:**
1. Browser A: Reload the page and immediately watch the thread list area.

**Expected:** 5 skeleton loading cards (animated gray rectangles) appear while the API loads. They are replaced by real thread items once the data arrives.
**Failure condition:** Blank space during loading; immediate error state; skeleton remains after data loads.

---

#### TC-096 — Scroll to bottom on new message
**Steps:**
1. Browser A: Scroll up in the thread to view older messages.
2. Browser B: Send a new message.

**Expected:** If A was scrolled near the bottom (within 150px), the chat auto-scrolls to the new message. If A was scrolled far up, no auto-scroll (A stays where they are).
**Failure condition:** Auto-scroll happens even when A is deep in message history (jarring); or never auto-scrolls even when A is at the bottom.

---

#### TC-097 — Typing indicator appears and disappears
**Steps:**
1. Both browsers have the thread open.
2. Browser B: Start typing in the input.

**Expected on Browser A:** A typing indicator appears ("UserB is typing…" with animated dots) within ~500ms.
3. Browser B: Stop typing and wait 3.5 seconds.

**Expected on Browser A:** Typing indicator disappears automatically (3,500ms timeout matching backend's 3-second expiry).
**Failure condition:** Typing indicator shows "Someone is typing…" (original bug — name lookup was broken); indicator never disappears; indicator appears for the typing user themselves.

---

#### TC-098 — Toast notifications stack properly
**Steps:**
1. Trigger multiple actions in quick succession that each produce toasts (e.g., send a message while also pinning).

**Expected:** Multiple toast notifications stack vertically without overlapping. Each auto-dismisses (success/info after 3s, error after 5s).
**Failure condition:** Toasts overlap each other; previous toast is replaced by new one.

---

#### TC-099 — Infinite scroll loads older messages
**Steps:**
1. Open a thread with 60+ messages.
2. Scroll to the very top of the message list.

**Expected:** The IntersectionObserver fires `handleLoadMoreMessages()`. Older messages prepend to the list. Scroll position is maintained (you don't jump to the top). Loading doesn't trigger again immediately after loading.
**Failure condition:** No older messages load; scroll position jumps; messages load infinitely in a loop; sentinel element is destroyed (the original bug — fixed by not doing `innerHTML = ""` on the container).

---

#### TC-100 — Shift+Enter inserts newline, Enter sends
**Steps:**
1. Browser A: Type in the message input.
2. Press Enter → message should send.
3. Press Shift+Enter → should insert a line break, not send.

**Expected:** Enter sends; Shift+Enter creates a newline for multi-line messages.
**Failure condition:** Enter inserts a newline instead of sending; Shift+Enter sends the message.

---

### 3.15 🔐 Permissions & Security

---

#### TC-101 — Non-member cannot access thread messages via API
**Steps:**
1. Browser B (not a member of Thread X): Manually call the API endpoint `/threads/{id}/messages` using browser dev tools or manually crafting a request.

**Expected:** 403 or 404 error. No messages returned.
**Failure condition:** Messages returned to non-members.

---

#### TC-102 — Only creator can delete the thread
**Steps:**
1. Browser B (member): Attempt to call `DELETE /threads/{id}` (via dev tools if no UI).

**Expected:** 403 Forbidden. Thread not deleted.
2. Browser A (creator): Delete the thread from settings if UI exists.

**Expected:** All members are booted from the room. Browser B receives `thread_deleted` event → toast "This thread was deleted" → navigated back to list. Thread removed from list.
**Failure condition:** Member can delete thread; thread_deleted event not received by B.

---

#### TC-103 — Only creator/moderator can pin messages
**Steps:**
1. Browser B (regular member): Tap Pin in the options sheet.

**Expected:** Toast on B: "Only creator or moderator can pin messages."
**Failure condition:** Member successfully pins a message.

---

#### TC-104 — Only message owner can edit
**Steps:**
1. Browser A: Long-press a message sent by Browser B.

**Expected:** "Edit" option does NOT appear in the bottom sheet (only "Delete" appears for moderators, not Edit). If attempted via direct socket emit, server returns "Message not found or you don't own it."
**Failure condition:** Edit option visible for other users' messages; edit succeeds on non-owned messages.

---

#### TC-105 — Closed thread rejects messages
**Steps:**
1. Browser A (creator): Close the thread via settings/admin action.
2. Browser B: Attempt to send a message.

**Expected:** Error toast: "This thread is closed." Message is not delivered.
**Failure condition:** Message is sent to a closed thread.

---

#### TC-106 — XSS in message text
**Steps:**
1. Browser A: Send message: `<img src=x onerror="alert(1)">`

**Expected:** Backend sanitizes with `bleach.clean(text, tags=[], strip=True)`. The literal HTML string appears as plain text in the bubble — no alert fires.
**Failure condition:** Alert fires; HTML is rendered.

---

#### TC-107 — Malformed reaction emoji
**Steps:**
1. Attempt to send a reaction with a very long emoji string or special characters.

**Expected:** Server handles gracefully — either accepts the emoji or returns an error without crashing.
**Failure condition:** Server 500 error; database error.

---

### 3.16 🧱 State Consistency

---

#### TC-108 — Unread count resets on thread open
**Steps:**
1. Browser B: Don't have thread open. Browser A sends 5 messages.
2. Browser B: Open the thread list — should see unread badge "5" on that thread.
3. Browser B: Open the thread.

**Expected:** Unread badge immediately shows "0" (cleared by `emitMarkRead` on thread open). Thread list item unread badge disappears.
**Failure condition:** Badge stays at "5" after opening; badge shows wrong count.

---

#### TC-109 — Thread list preview updates on new message
**Steps:**
1. Both browsers have the thread list visible (not inside a specific thread).
2. Browser A sends a message.

**Expected:** Browser B's thread list immediately updates the last message preview for that thread ("UserA: [message text]" and updated timestamp).
**Failure condition:** B's list doesn't update until refresh; preview shows wrong sender or text.

---

#### TC-110 — Member count updates in real time
**Steps:**
1. Browser A: Note member count in thread list and header.
2. Browser B: Join the thread.

**Expected:** Browser A sees member count increment in both the thread list item and in the header (if thread is open).
**Failure condition:** Member count only updates after refresh.

---

#### TC-111 — Rapid thread switching — no stale state
**Steps:**
1. Browser A: Open Thread 1 → quickly open Thread 2 → quickly open Thread 3.
2. Send a message in Thread 3.

**Expected:** Message appears only in Thread 3. No messages from Thread 1 or 2 bleed into Thread 3's view. The WebSocket room is correctly Thread 3 only.
**Failure condition:** Messages from a previous thread appear in the new thread; room is joined multiple times.

---

#### TC-112 — pendingAttachment cleared on thread switch
**Already covered in TC-037 but re-verify here as a state test.**
**Expected:** No attachment state leaks between threads.

---

#### TC-113 — confirmedMessageIds Set doesn't grow unbounded
**Scenario:** The code caps the Set at 300 entries.
**Steps:**
1. In a long session, send 350+ messages in one thread.

**Expected:** No memory leak. The Set stays at 300 entries max.
**Note:** This is impossible to verify visually — check browser memory usage doesn't grow continuously over a long chat session.

---

#### TC-114 — Typing users Map cleared on thread switch
**Steps:**
1. Browser B: Start typing in Thread 1 (typing indicator shows for A).
2. Browser A: Switch to Thread 2.
3. Browser A: Switch back to Thread 1.

**Expected:** No ghost typing indicator shows in Thread 1 after return (typingUsers Map was cleared on switch).
**Failure condition:** "UserB is typing…" appears even though B stopped typing.

---

### 3.17 🌐 Network Failure Scenarios

---

#### TC-115 — Socket disconnect banner and reconnect
**Steps:**
1. Browser A: Have a thread open.
2. Disable network for ~5 seconds, then re-enable.

**Expected:** Disconnect toast: "Disconnected from server: transport close." Reconnect is attempted automatically (up to 5 attempts). On success: "Connected to real-time server." The thread room is rejoined (`reconnect` handler calls `disconnectThreadWebSocket` + `initThreadWebSocket`).
**Failure condition:** No reconnect attempt; after reconnect, messages are doubled (listener doubling bug); thread room is not re-joined.

---

#### TC-116 — Server-initiated disconnect triggers manual reconnect
**Scenario:** Server sends `io server disconnect` (kicked).
**Expected:** Frontend waits 1,500ms then calls `sock.connect()` to reconnect. This is the "io server disconnect" branch in `_bindSocketLifecycle`.
**Note:** Hard to trigger manually without admin access to the backend.

---

#### TC-117 — Messages sent offline appear as failed
**Steps:**
1. Browser A: Disable network.
2. Type and send a message.

**Expected:** Optimistic message renders with pending status. Because the socket is null/disconnected, `wsSendMessage()` returns `null` early. The message stays in "pending" state. After a timeout, it should transition to "failed" (via `thread_message_error` handler on server).
**Note:** If socket is entirely disconnected, `sendMessage()` returns null but the optimistic message is already in the DOM. The pending message stays until the `thread_message_error` comes back. If the socket never reconnects, the message stays as pending indefinitely — there's no client-side timeout for this case.
**Expected:** After reconnecting, the pending message should show as failed if the send event was never delivered.
**Failure condition:** Pending message disappears; no retry button ever appears; duplicate message on reconnect.

---

#### TC-118 — File upload failure
**Steps:**
1. Attach a valid file.
2. Disable network just before tapping Send.
3. Tap Send.

**Expected:** "Uploading file…" toast, then "File upload failed. Message not sent." error toast. Send button re-enables. No partial message is sent. The text input is NOT cleared.
**Failure condition:** Partial message sent without attachment; input is cleared despite failed send.

---

#### TC-119 — API timeout on thread open
**Steps:**
1. Open a thread with very slow network (simulate via dev tools network throttle if available).

**Expected:** Loading state shown. If API times out, error toast: "Failed to open thread. Please try again."
**Failure condition:** Infinite loading spinner with no error; crash.

---

### 3.18 🔥 Stress & Abuse Testing

---

#### TC-120 — Spam clicking the Send button
**Steps:**
1. Type a message. Rapidly tap Send 10 times.

**Expected:** Only 1 message is sent. The send button becomes disabled after the first send (input cleared, button re-evaluates to disabled). No duplicate messages appear.
**Failure condition:** Multiple identical messages sent.

---

#### TC-121 — Rate limit enforcement at boundary
**Steps:**
1. Send 29 messages rapidly (copy-paste short text, tap send).
2. Send message 30 — should succeed.
3. Send message 31.

**Expected:** Message 31 returns error: "Slow down — max 30 messages per minute." The failed pending message gets the Retry button.
**Failure condition:** Rate limit not enforced; message 31 sends; or rate limit triggers before 30.

---

#### TC-122 — Rapid reaction tapping
**Steps:**
1. Open the emoji picker for a message.
2. Rapidly tap the same emoji 10 times.

**Expected:** Reaction toggles on/off. Server processes each request. Final state is either 1 or 0 (toggle). No "reaction count" of 10 or duplicate reactions appear.
**Failure condition:** Reaction count inflates; server 500 errors from race condition.

---

#### TC-123 — Rapid thread switching stress test
**Steps:**
1. Browser A: Rapidly tap Thread 1 → Thread 2 → Thread 3 → Thread 4 in the thread list, allowing ~200ms between each.

**Expected:** Final thread opened shows correct messages. No crash. No multiple room joins. Memory usage stays reasonable.
**Failure condition:** App freezes; messages from wrong threads appear; crash.

---

#### TC-124 — Retry button double-tap prevention
**Scenario:** The `_retryInFlight` Set prevents duplicate retries.
**Steps:**
1. Get a failed message with Retry button.
2. Double-tap Retry quickly.

**Expected:** Only one retry attempt is made. No duplicate message appears.
**Failure condition:** Tapping Retry twice sends 2 messages.

---

#### TC-125 — Join/leave thread repeatedly
**Steps:**
1. Browser B: Join a thread → leave it → join it → leave it → join it.

**Expected:** After each operation, B's membership state is correct. No duplicate ThreadMember records.
**Failure condition:** Database error after repeated joins; member count becomes incorrect; B gets stuck in an inconsistent state.

---

---

## 4. ⚡ High-Risk Areas

These are systems that are technically working but have fragile logic or high regression potential.

### 🔴 Critical Risk

**1. WebSocket listener doubling on reconnect**
The fix (`disconnectThreadWebSocket` before re-init) is critical. Any modification to the reconnect path could reintroduce 2× or 4× message duplication. Test after every code change in `thread_init.js`.

**2. Optimistic message dedup (3-guard system)**
The three guards in `addMessage()` (existing ID → confirmedMessageIds → in-place confirm) are intricate. Race condition between `new_thread_message` and `thread_message_sent` arriving in different orders could break dedup. Always test by watching for duplicate bubbles after sending.

**3. Attachment upload flow**
The original bug (storing base64 instead of uploading) was fixed, but the upload happens inline inside `handleSendMessage()`. If `uploadAttachment()` throws anything unexpected, the entire send flow aborts. Edge cases: Cloudinary down, file renamed by OS, MIME type mismatch.

**4. Thread switch mid-flight**
If a user switches threads while a message is mid-send (WebSocket emit sent, server ACK not yet received), the `activeThreadId` may have changed before `confirmOptimisticMessage` runs. The message could end up confirmed in the wrong thread's state.

### 🟠 High Risk

**5. Pin banner data-pins serialization**
The banner stores all pinned message data as a JSON attribute. If a message title contains quotes or backslashes, `escAttr()` must handle them correctly. Test with messages containing `"quotes"` and `\backslashes`.

**6. Infinite scroll sentinel element**
The IntersectionObserver watches `#thread-top-sentinel`. The `renderMessages()` fix (preserve sentinel instead of `innerHTML = ""`) is critical. Any other render operation that clears the container could silently break infinite scroll.

**7. Status tick pipeline: personal rooms**
The delivered/read tick system depends on users having joined their personal `user_{id}` room during `join_thread_room`. If a user joins a thread room but the personal room join fails (edge case in server code), they will never receive status updates.

**8. Learnora background thread**
The AI response runs in a Python daemon thread. If the thread crashes, `thread_ws_manager.broadcast_ai_message()` is never called, but there is no error visible to the user — the "Learnora thinking" dots just spin forever for 30 seconds.

### 🟡 Medium Risk

**9. Edit inline UI vs. state sync**
The inline edit (textarea in the bubble) is purely DOM-driven. If `renderMessageEdit()` fires from the WebSocket handler before the user saves their edit, their in-progress text could be overwritten.

**10. Modal outside-click after field interaction**
The `{ once: true }` bug was fixed, but the test (TC-093) should always be run after any modal code changes.

**11. Typing indicator name resolution**
Falls back to "Someone" if the user is not in `memberMap` and hasn't sent any message. `memberMap` is populated from `/members` on thread open — if that API call fails, all typing indicators show "Someone."

---

## 5. 💥 Stress Testing Scenarios

### ST-001 — 30-message burst (rate limit boundary)
Send 30 messages in under 60 seconds. Verify all 30 arrive on Browser B. Send the 31st. Verify it's rejected with correct error. After 60 seconds, verify sending works again.

### ST-002 — Rapid thread open/close (10 threads, 5 seconds)
Open 10 different threads in rapid succession. After settling on the last thread, verify: correct messages load; only one room is joined; no socket errors in console.

### ST-003 — Attachment spam
Upload 5 different files back-to-back (one at a time — attach, send, attach, send). Verify each upload succeeds. Verify each message shows the correct attachment. No cross-contamination of attachments.

### ST-004 — Long message body (exactly 5,000 characters)
Send a 5,000-character message. Verify it renders correctly (text wraps, bubble doesn't overflow). Verify it appears correctly on Browser B. Verify the 5,001-character attempt is rejected.

### ST-005 — Pin limit stress
Pin exactly 5 messages. Verify banner cycles through all 5 correctly. Attempt to pin the 6th. Unpin 1. Pin the formerly-rejected 6th message. Should now succeed. Total should be 5 again.

---

## 6. 🔄 Real-Time Multi-User Testing Matrix

> **All tests use exactly 2 browsers: Browser A (Creator) and Browser B (Member)**

---

### Matrix A — Message Lifecycle

| Step | Browser A | Browser B | Expected Result |
|---|---|---|---|
| 1 | Send "Hello" | Watching | B sees message within 2s |
| 2 | Watch | Send "Hi back" | A sees message within 2s |
| 3 | Send message, watch tick | Watching (thread open) | A's tick: pending → sent → delivered (within 2s of B rendering) |
| 4 | Send message, watch tick | Open thread, read message | A's tick: delivered → read (blue) |
| 5 | Send message | Thread NOT open (list view) | A's tick stays at delivered; B sees unread badge |
| 6 | Watching | Open thread | B's unread badge clears; A's tick → read |

---

### Matrix B — Reaction Exchange

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Send a message | Watching | B sees message |
| 2 | Watching | Long-press → React → 👍 | A sees "👍 1" pill appear on message |
| 3 | Tap the "👍 1" pill | Watching | Count becomes "👍 2"; B sees update |
| 4 | Long-press → React → 👍 (toggle off) | Watching | Count becomes "👍 1"; B sees update |
| 5 | Watching | Long-press → React → 👍 (toggle off) | Pill disappears for both |

---

### Matrix C — Edit / Delete Propagation

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Send "Original text" | Watching | B sees message |
| 2 | Long-press → Edit → change to "Edited text" → Save | Watching | B sees text change + "(edited)" label in real time |
| 3 | Long-press → Delete | Watching | B sees "[deleted]" in real time; reactions removed |
| 4 | Send a message | Long-press → Delete | A sees "[deleted]" in real time |
| 5 | Long-press B's deleted msg | — | No Edit/React/Pin options visible |

---

### Matrix D — Pin / Unpin Sync

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Long-press a message → Pin | Watching | B sees pin banner appear immediately |
| 2 | Long-press a different message → Pin | Watching | B's pin banner now shows 2 pins; ▲▼ nav appears |
| 3 | Cycle pin banner with ▲▼ | Watching | Banner cycles on A (B sees no change to banner unless B also scrolls) |
| 4 | Long-press pinned message → Unpin | Watching | B sees pin banner update (1 pin left); ▲▼ disappears |
| 5 | Unpin the last message | Watching | Banner disappears on both browsers |

---

### Matrix E — Typing Indicator

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Watching | Start typing | A sees "UserB is typing…" with animated dots |
| 2 | Watching | Stop typing, wait 4s | Indicator disappears from A's view |
| 3 | Start typing | Watching | B sees "UserA is typing…" |
| 4 | Send the message | Watching | Typing indicator disappears; message appears |
| 5 | Start typing | Also start typing | Both indicators would show on a 3rd client — with 2 clients, each only sees the other's indicator |

---

### Matrix F — Member Join / Remove

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Remove B from thread | B has thread open | B sees toast "You were removed." B navigated back to list. |
| 2 | Re-invite B | B sees invite | B sees invite in invite section |
| 3 | Watching | Accept invite | A sees member count +1. System message "UserB joined the thread." |
| 4 | Promote B to moderator | Watching | B's role badge updates. B can now pin/delete any message. |
| 5 | B tries to pin a message | Watching as creator | Pin succeeds. A sees pin banner update. |
| 6 | Demote B back to member | Watching | B loses mod privileges. B cannot pin other users' messages (server rejects). |

---

### Matrix G — Thread Deletion

| Step | Browser A | Browser B | Expected |
|---|---|---|---|
| 1 | Delete the thread | B has thread open | B receives `thread_deleted` event. Toast "This thread was deleted." B navigated to list. |
| 2 | — | Try to reopen via URL hash | Server rejects join: "You are not a member of this thread." |

---

## 7. 🐛 Potential Hidden Bugs

Based on deep code reading, these are scenarios that were **not explicitly fixed** in the code comments but carry risk.

---

### HB-001 — `confirmOptimisticMessage` renders a "sent" toast on EVERY confirmation
**Location:** `thread_websocket.js` → `MESSAGE_SENT` handler calls `showToast("Message sent", "success")`.
**Issue:** Also triggers `confirmOptimisticMessage` in `thread_render.js` which calls `showToast("Message sent.", "success")` again.
**Result:** Every message send produces **two** "Message sent" toasts simultaneously.
**Test:** Send a message and count the toasts.

---

### HB-002 — Pin option shown to ALL users in the options sheet (confirmed code issue)
**Location:** `thread_delegation.js` → `_openOptionsSheet()`
**Issue:** The pin button is rendered for all users regardless of role. The server rejects non-moderator pins, but the UI misleads users into thinking they can pin.
**Test:** TC-059 — confirm B sees Pin option, then gets an error.

---

### HB-003 — Inline edit overwritten by incoming WS edit event
**Scenario:** User A is editing a message. Another moderator (user B) edits the SAME message from their side. The `MESSAGE_EDITED` WS event fires and calls `renderMessageEdit()`, which updates `msg.textContent` — but the inline textarea in the DOM still shows A's in-progress edit. Save will now overwrite B's version without warning.
**Test:** Very hard to reproduce with only 2 browsers, but theoretically possible.

---

### HB-004 — Thread delete doesn't clear the thread from state
**Location:** `thread_websocket.js` → `THREAD_DELETED` handler calls `handleBackToList()` → `resetThreadSession()`.
**Issue:** `removeThreadFromList(threadId)` is NOT called. The deleted thread stays in `threadState.threadList`. If the user navigates back, the thread item may still appear briefly before the list reloads.
**Test:** Delete a thread, check if it briefly appears in the thread list before the reload.

---

### HB-005 — No error shown when `join_thread_room` is rejected for non-members
**Location:** `websocket_threads.py` calls `_emit_error("You are not a member of this thread")` which emits `thread_error`. The frontend `thread_error` handler shows a toast. BUT — `showThreadView(threadId)` is called BEFORE `initThreadWebSocket()` in `handleOpenThread()`. So the chat panel switches to the thread view visually, then the error toast fires, and the user is left on a blank chat panel with an error toast but no way to go back (unless they tap back manually).
**Test:** Try to open a thread you're not a member of — check if you end up on a blank chat screen.

---

### HB-006 — Avatar upload button click triggers file input, but `thread-avatar-file-input` may not exist in DOM
**Location:** `thread_delegation.js` → `thread-avatar-upload` action → `document.getElementById("thread-avatar-file-input")?.click()`.
**Issue:** The avatar file input is only injected by `openInfoModal()` if the viewer is the creator. If the HTML template includes a separate permanent avatar input, double-click could trigger twice. If not, and the modal was closed and reopened, the old input element may have been removed from the DOM.
**Test:** Click avatar upload button twice rapidly — check for double file picker or silent failure.

---

### HB-007 — `handleScrollToMessage` uses `beforeId = messageId + 1` which may not fetch the right page
**Location:** `thread_events.js` → `handleScrollToMessage()`
**Issue:** `fetchMessages(threadId, { beforeId: messageId + 1 })` fetches the 30 messages before `messageId + 1`. If the message is at the exact boundary between pages (e.g., message 31 in a 30-per-page setup), `messageId + 1` might fall on the next page, causing the fetch to return messages 1–30 instead of the page containing `messageId`.
**Test:** Search for a message that is exactly at the 30/31 boundary. Tap the result. Check if the target message is found and highlighted.

---

### HB-008 — Typing indicator not cleaned up if user navigates away while typing
**Scenario:** Browser A starts typing. Browser A rapidly taps Back to return to thread list. `handleBackToList()` calls `_stopTyping()` — which IS called. BUT `_isTyping` is a module-level variable. If `handleBackToList()` runs before the `_typingTimer` fires, the stop event is emitted correctly. If the timer fires AFTER navigation (unlikely but possible), a ghost typing indicator appears for 3.5s on B's screen for a user who is not even in the thread view.
**Test:** Type in Thread 1, immediately navigate back to list. Watch Browser B — indicator should disappear within 3.5s.

---

### HB-009 — `renderMessages()` does not attach `longpress` listener on new message list
**Location:** `thread_render.js` → `renderMessages()` is called when a thread opens, but `attachThreadLongPress(listEl)` (from `thread_longpress.js`) must be called on the message list element. Where is this called?
**Check:** Search all files — `attachThreadLongPress` is defined in `thread_longpress.js` but I do not see it called anywhere in the reviewed files.
**If confirmed:** Long-press would never fire on mobile — the `touchstart` listener is never attached.
**Test:** On mobile, long-press a message. If the bottom sheet never opens, this bug is confirmed.

---

### HB-010 — Learnora typing indicator is never removed after AI responds
**Location:** `thread_render.js` → `showLearnoraBotTyping()` adds `#thread-learnora-typing` with a 30s auto-remove. When the actual AI message arrives via `new_thread_message`, `renderNewMessage()` is called but does NOT remove the typing indicator.
**Result:** The Learnora "thinking" dots and the actual AI response message appear simultaneously for up to 30 seconds.
**Test:** Trigger `@learnora` → watch for 2–3 seconds after the response arrives — is the typing indicator still showing alongside the response?

---

## 8. 🏁 Final QA Verdict

### Production Readiness Assessment

| Area | Status | Notes |
|---|---|---|
| WebSocket connection & room management | ✅ Solid | Listener doubling fix is good — verify with TC-011 |
| Optimistic messaging & dedup | ✅ Solid | 3-guard system is well-designed — verify with TC-013/014/016 |
| Message status ticks | ⚠️ Needs verification | Full pipeline depends on personal rooms joining correctly |
| File attachments | ✅ Fixed | Original base64 bug fixed — verify with TC-030/031 |
| Pin system | ⚠️ Fragile | UI shows pin to all users; 5-pin limit; deleted pin in banner |
| Reactions | ✅ Solid | Toggle/change logic looks correct |
| Edit/Delete | ✅ Solid | Role checks correct; inline edit is clean |
| Search + jump to message | ⚠️ Needs verification | Pagination boundary case (HB-007) |
| Typing indicators | ⚠️ Needs verification | Timeout alignment fixed; name lookup fixed |
| Long-press on mobile | 🔴 Unverified | `attachThreadLongPress` may never be called (HB-009) |
| Member management | ✅ Solid | Confirm modal fixed; role system correct |
| Invites / Join requests | ✅ Solid | Invite populated on init (fix confirmed) |
| Learnora AI | ⚠️ Fragile | Typing indicator cleanup (HB-010); no error to user if AI fails |
| Infinite scroll | ✅ Solid | Sentinel preservation fix is correct |
| State consistency on switch | ✅ Solid | `pendingAttachment` + `memberMap` cleared on switch |
| Security/permissions | ✅ Solid | Server-side role checks throughout |

### Most likely failure points in production

1. **Long-press on mobile (HB-009)** — if `attachThreadLongPress` is never called, no message actions are accessible at all on mobile. This is a **P0 blocker** to verify immediately.

2. **Double "Message sent" toast (HB-001)** — minor UX issue but visually annoying. Easy to fix.

3. **Learnora typing dots persist after response (HB-010)** — visible cosmetic bug when AI feature is used.

4. **Scroll-to-message pagination boundary (HB-007)** — can cause confusing behavior when jumping to searched messages near page boundaries.

5. **Reconnect behavior under flaky mobile network** — the reconnect path is well-coded but mobile networks can drop and reconnect multiple times. Run TC-011 and TC-115 repeatedly.

### What to test repeatedly (regression targets)

Every time you change any of these files, re-run these tests:

| Changed File | Re-run Tests |
|---|---|
| `thread_websocket.js` | TC-008 through TC-012, TC-025/026, TC-115 |
| `thread_state.js` | TC-013/014/016, TC-108, TC-111, TC-112, TC-114 |
| `thread_delegation.js` | TC-019/020, TC-034, TC-039, TC-091, TC-092 |
| `thread_events.js` | TC-013, TC-015, TC-021, TC-022, TC-049, TC-072 |
| `thread_render.js` | TC-024 through TC-029, TC-058 through TC-066, TC-099 |
| `websocket_threads.py` | TC-009, TC-017/018, TC-025, TC-058, TC-102, TC-121 |
| `threads.py` | TC-001 through TC-007, TC-082 through TC-089 |

---

*Document generated from full code review. Total codebase reviewed: ~368 KB across 13 files.*
