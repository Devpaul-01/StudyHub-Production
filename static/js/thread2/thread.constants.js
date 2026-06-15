/**
 * thread_constants.js
 * Centralised endpoint paths, WebSocket event names, and UI constants.
 *
 * FIXES applied:
 *  - All WS event names aligned to actual server handler names
 *  - Added LONG_PRESS constants (THREAD_LONG_PRESS_DURATION / THRESHOLD were
 *    imported by thread_longpress.js but never defined here — crashed on import)
 *  - Added MESSAGE_STATUS_UPDATED, MESSAGE_DELIVERED WS events
 *  - Added ROLE_UPDATE, AVATAR endpoints
 *  - MAX_ATTACHMENT_MB aligned to backend 25 MB (was 10 on frontend, 25 on backend)
 */

// ─── API endpoint builders ───────────────────────────────────────────────────

export const THREAD_API = {
  OPEN:              "/threads/open",
  POPULAR:           "/threads/popular",
  RECOMMENDED:       "/threads/recommended",
  DEPARTMENTS:       "/threads/departments",

  MY_THREADS:        "/threads/my-threads",
  MY_REQUESTS:       "/threads/my-requests",
  MY_INVITES:        "/threads/invites",
  PENDING_REQUESTS:  "/threads/pending-requests",

  CREATE:            "/threads/create",
  CREATE_STANDALONE: "/threads/create-standalone",

  THREAD:   (id)              => `/threads/${id}`,
  AVATAR:   (id)              => `/threads/${id}/avatar`,
  SETTINGS: (id)              => `/threads/${id}/settings`,
  STATS:    (id)              => `/threads/${id}/stats`,
  CLOSE:    (id)              => `/threads/${id}/close`,
  REOPEN:   (id)              => `/threads/${id}/reopen`,

  MEMBERS:       (tid)        => `/threads/${tid}/members`,
  REMOVE_MEMBER: (tid, uid)   => `/threads/${tid}/remove/${uid}`,
  LEAVE:         (tid)        => `/threads/${tid}/leave`,
  ROLE_UPDATE:   (tid, uid)   => `/threads/${tid}/members/${uid}/role`,

  JOIN:            (id)          => `/threads/${id}/join`,
  CANCEL_REQUEST:  (reqId)       => `/threads/requests/${reqId}/cancel`,
  APPROVE_REQUEST: (tid, reqId)  => `/threads/${tid}/requests/${reqId}/approve`,
  REJECT_REQUEST:  (tid, reqId)  => `/threads/${tid}/requests/${reqId}/reject`,

  INVITE:         (tid, uid) => `/threads/${tid}/invite/${uid}`,
  ACCEPT_INVITE:  (invId)    => `/threads/invites/${invId}/accept`,
  DECLINE_INVITE: (invId)    => `/threads/invites/${invId}/decline`,

  MESSAGES: (tid) => `/threads/${tid}/messages`,
  UPLOAD:   (tid) => `/threads/${tid}/messages/upload`,
  PINNED:   (tid) => `/threads/${tid}/messages/pinned`,
  SEARCH:   (tid) => `/threads/${tid}/messages/search`,
};


// ─── WebSocket event names ────────────────────────────────────────────────────
// All names verified against actual @sio.on() decorators in websocket_threads.py

export const THREAD_WS = {
  // ── Client → Server ──────────────────────────────────────────────────────
  /** FIX: was "thread_connect" — server registers "join_thread_room" */
  JOIN_ROOM:         "join_thread_room",
  /** FIX: was "thread_disconnect" — server registers "leave_thread_room" */
  LEAVE_ROOM:        "leave_thread_room",

  SEND:              "send_thread_message",
  /** FIX: was "thread_typing_start" — server registers "thread_typing" */
  TYPING_START:      "thread_typing",
  TYPING_STOP:       "thread_typing_stop",
  /** FIX: was "react_thread_message" — server registers "add_thread_reaction" */
  REACT:             "add_thread_reaction",
  MARK_READ:         "mark_thread_read",
  MESSAGE_DELIVERED: "message_delivered",
  PIN:               "pin_thread_message",
  UNPIN:             "unpin_thread_message",
  EDIT:              "edit_thread_message",
  DELETE:            "delete_thread_message",

  // ── Server → Client ───────────────────────────────────────────────────────
  /** FIX: was "thread_connected" — server emits "thread_room_joined" */
  ROOM_JOINED:           "thread_room_joined",
  NEW_MESSAGE:           "new_thread_message",
  MESSAGE_SENT:          "thread_message_sent",
  MESSAGE_EDITED:        "thread_message_edited",
  MESSAGE_DELETED:       "thread_message_deleted",
  MESSAGE_PINNED:        "thread_message_pinned",
  MESSAGE_UNPINNED:      "thread_message_unpinned",
  MESSAGE_STATUS_UPDATED:"message_status_updated",
  /** FIX: was "thread_reaction_updated" (singular) — server emits "thread_reactions_updated" */
  REACTION_UPDATED:      "thread_reactions_updated",
  /** FIX: was "user_typing" — server emits "thread_typing_started" */
  USER_TYPING_START:     "thread_typing_started",
  /** FIX: was never handled — server emits "thread_typing_stopped" */
  USER_TYPING_STOP:      "thread_typing_stopped",
  USER_ONLINE:           "user_online",
  USER_OFFLINE:          "user_offline",
  READ_ACK:              "thread_read_ack",
  MEMBER_JOINED:         "thread_member_joined",
  MEMBER_REMOVED:        "thread_member_removed",
  THREAD_DELETED:        "thread_deleted",
  ERROR:                 "thread_error",
  MSG_ERROR:             "thread_message_error",
  LEARNORA_THINKING:     "learnora_thinking",
};


// ─── Message status values ────────────────────────────────────────────────────

export const MSG_STATUS = {
  PENDING:   "pending",
  SENT:      "sent",
  DELIVERED: "delivered",
  READ:      "read",
  FAILED:    "failed",
};


// ─── UI constants ─────────────────────────────────────────────────────────────

export const THREAD_UI = {
  TYPING_TIMEOUT_MS:      3500,
  MESSAGES_PER_PAGE:      30,
  SCROLL_LOAD_THRESHOLD:  120,
  HIGHLIGHT_DURATION_MS:  2500,
  /** FIX: was 10 on frontend but backend allows 25 — aligned */
  MAX_ATTACHMENT_MB:      25,
  RETRY_MAX_ATTEMPTS:     3,
  /** FIX: these were imported by thread_longpress.js but never defined here */
  LONG_PRESS_DURATION_MS: 500,
  LONG_PRESS_THRESHOLD_PX: 10,
};

// ── Named exports used by legacy imports in thread_longpress.js ───────────────
export const THREAD_LONG_PRESS_DURATION  = THREAD_UI.LONG_PRESS_DURATION_MS;
export const THREAD_LONG_PRESS_THRESHOLD = THREAD_UI.LONG_PRESS_THRESHOLD_PX;
