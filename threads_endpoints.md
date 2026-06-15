# Thread System — API Endpoints

## Thread Creation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/threads/create` | Creates a thread linked to an existing post. Accepts optional `member_ids` to pre-populate members. Auto-adds the creator and notifies any added members. |
| `POST` | `/threads/create-standalone` | Creates a standalone study group thread with no associated post. Rate-limited to 3 threads per week per user. |

---

## Thread Discovery & Recommendations

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/threads/open` | Lists all open threads ordered by department match then recent activity. |
| `GET` | `/threads/popular` | Returns the most popular threads by member count, **excluding** the user's own department (designed for cross-department discovery). |
| `GET` | `/threads/recommended` | Returns personalised thread recommendations scored by department match, tag/subject overlap, friends already in the thread, and recent activity. |
| `GET` | `/threads/departments` | Returns thread statistics grouped by department — total threads, available slots, average member count, etc. |
| `GET` | `/threads/help/suggestions` | Suggests other users the current user could help, based on comparing the user's strong subjects against others' help subjects, schedule overlap, and department. |

---

## Thread Details & Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/threads/<thread_id>/details` | Returns detailed thread info including full member list with connection statuses. Accepts an optional `type: "post"` body param to look up a thread by post ID instead. |
| `GET` | `/threads/<thread_id>` | Returns full thread detail. Non-members see basic info; members see the full member list; creators/moderators also receive pending join requests. |
| `PATCH` | `/threads/<thread_id>` | Updates the thread's title, description, or max member cap (creator only). |
| `DELETE` | `/threads/<thread_id>` | Permanently deletes the thread and all related records (creator only). Notifies all members beforehand. |
| `POST` | `/threads/<thread_id>/close` | Closes the thread so no new join requests are accepted (creator only). |
| `POST` | `/threads/<thread_id>/reopen` | Reopens a previously closed thread to accept join requests again (creator only). |
| `GET` | `/threads/<thread_id>/stats` | Returns activity statistics for a thread — total messages, messages per day, per-member message counts, and most active member (members only). |
| `GET` | `/threads/<thread_id>/settings` | Returns the thread's current settings such as approval requirement and member cap (creator only). |
| `PATCH` | `/threads/<thread_id>/settings` | Updates thread settings — `requires_approval` flag and/or `max_members` cap (creator only). |

---

## My Threads & Requests

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/threads/my-threads` | Lists all threads the current user is a member of, including unread message counts and the user's role in each thread. |
| `GET` | `/threads/pending-requests` | Returns all pending join requests across threads created by the current user. |
| `GET` | `/threads/my-requests` | Returns all pending join requests the current user has sent to other threads. |

---

## Join Requests

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/threads/<resource_id>/join` | Sends a join request for a thread. Supports re-requesting after a rejected request (with a 24-hour cooldown). Optionally accepts a `message` explaining why the user wants to join. |
| `POST` | `/threads/<thread_id>/approve/<user_id>` | Approves a pending join request (creator or moderator). Uses an atomic SQL increment to prevent race conditions on `member_count`. |
| `POST` | `/threads/<thread_id>/reject/<user_id>` | Rejects a pending join request (creator or moderator). |
| `DELETE` | `/threads/requests/<request_id>/cancel` | Cancels the current user's own pending join request. |

---

## Member Management

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/threads/<thread_id>/leave` | Removes the current user from a thread. The creator cannot leave — they must transfer ownership or delete the thread. |
| `DELETE` | `/threads/<thread_id>/remove/<user_id>` | Removes another member from the thread (creator or moderator only). The creator themselves cannot be removed. |
| `PATCH` | `/threads/<thread_id>/members/<user_id>/role` | Promotes or demotes a member between `member` and `moderator` roles (creator only). The creator role itself cannot be changed. |

---

## Invitations

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/threads/<thread_id>/invite/<user_id>` | Directly invites a user to a thread without requiring them to request access (creator or moderator only). The invited user must still explicitly accept. |
| `GET` | `/threads/invites` | Returns all pending thread invitations sent to the current user. |
| `POST` | `/threads/invites/<invite_id>/accept` | Accepts a thread invitation, adding the user as a member and notifying the creator. |
| `POST` | `/threads/invites/<invite_id>/decline` | Declines a thread invitation, marking it as rejected. |

---

## Messages

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/threads/<thread_id>/messages` | Fetches thread messages with cursor-based pagination (`before_id` / `after_id`). Always includes up to 5 pinned messages. Updates the user's `last_read_at` timestamp. Members only. |
| `POST` | `/threads/<thread_id>/messages` | Sends a new message to the thread. Detects and notifies `@username` mentions. Members only, 5000-character limit. |
| `PATCH` | `/threads/<thread_id>/messages/<message_id>` | Edits the content of the user's own message. Re-runs mention detection on the updated text. |
| `DELETE` | `/threads/<thread_id>/messages/<message_id>` | Soft-deletes a message (replaces content with `[deleted]`). Senders can delete their own messages; the thread creator can delete any message. |
| `POST` | `/threads/<thread_id>/messages/upload` | Uploads a file attachment (images, PDFs, documents, videos — max 25 MB) to Supabase storage. Returns a URL for use in a subsequent WebSocket message send event. |
| `GET` | `/threads/<thread_id>/messages/search` | Full-text search across messages in a thread by keyword (`q` param, min 2 characters). Members only. |
| `GET` | `/threads/<thread_id>/messages/pinned` | Returns all currently pinned messages for a thread. Members only. |

---

## Misc

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Renders the threads HTML page (`threads/threads.html`). |
