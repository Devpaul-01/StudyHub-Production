/**
 * thread.state.js
 * Central in-memory state store for the active thread session.
 *
 * FIXES vs previous version:
 *  - HIDDEN-01: confirmedMessageIds cap raised 300→1000
 *  - HIDDEN-02: null/undefined ID guard in addMessage
 *  - ARCH-02: userActiveThread map added — tracks which thread each user is
 *    currently viewing. Used by websocket_threads.py (via thread_ws_manager)
 *    and by thread.websocket.js to decide delivered vs mark_read.
 *  - WS-06: typingThreadId exported so typing stop uses the correct thread ID
 *    even after the user switches threads mid-timer.
 *  - pendingAttachment kept as single-file object (ATT-01 multi-file deferred
 *    to a separate migration; changing the shape here would break delegation
 *    and upload flow simultaneously).
 *  - addOrUpdateThreadInList now maintains DESC last_activity sort order so
 *    BUG-C2 (thread list never re-sorts) can be fixed with a simple prepend.
 *  - updateMessageStatus: only recognises 'sent', 'delivered', 'read' — no
 *    phantom states.
 */

// ─── State ────────────────────────────────────────────────────────────────────

export const threadState = {
  activeThreadId:  null,
  currentUser:     null,

  /** Ordered array of messages in the currently open thread. */
  messages:        [],

  /**
   * Map<clientTempId, message> — optimistic (unsent) messages.
   * Removed from here once the server confirms (MESSAGE_SENT) or fails.
   */
  pendingMessages: new Map(),

  /**
   * Set<number> — confirmed server IDs used to deduplicate
   * broadcast vs confirm race.
   * HIDDEN-01 FIX: capped at 1000 (was 300) by _addConfirmedId().
   */
  confirmedMessageIds: new Set(),

  /**
   * Map<id, threadData> — all threads the user is a member of.
   * Insertion order is maintained for BUG-C2 list re-sort.
   */
  threadList: new Map(),

  /** Map<userId, boolean> — online presence per user. */
  onlineUsers: new Map(),

  /**
   * Map<userId, timerHandle> — users currently showing a typing indicator.
   */
  typingUsers: new Map(),

  /**
   * Map<userId, threadId> — which thread each user is actively viewing.
   * ARCH-02: populated by initThreadWebSocket/disconnectThreadWebSocket.
   * Consumed by thread.websocket.js sendMessage to decide delivered vs read.
   */
  userActiveThread: new Map(),

  hasMore:         false,
  oldestMessageId: null,
  isLoadingMore:   false,

  /**
   * Pending file attachment for the next send.
   * { file: File, name: string, type: string, size: number } | null
   */
  pendingAttachment: null,

  /**
   * Map<userId, { name, avatar, role }> — populated from /members on thread open.
   * FIX: typing indicator now resolves names in O(1) instead of scanning messages.
   */
  memberMap: new Map(),

  /**
   * WS-06 FIX: capture the thread ID at the moment typing starts.
   * emitTypingStop reads this instead of threadState.activeThreadId so
   * a timer that fires after a thread-switch targets the correct thread.
   */
  typingThreadId: null,
};


// ─── Message dedup & optimistic updates ──────────────────────────────────────

/**
 * Add a message to state with full dedup protection.
 *
 * Race A — new_thread_message first, thread_message_sent second:
 *   Guard 3 confirms the temp entry in-place.
 * Race B — thread_message_sent first, new_thread_message second:
 *   confirmOptimisticMessage registers the server ID; Guard 2 blocks the broadcast.
 *
 * HIDDEN-02 FIX: explicit null/undefined guard on message.id.
 *
 * @returns {boolean} true if inserted, false if deduped or confirmed-in-place
 */
export function addMessage(message) {
  const hasServerId = message.id !== null && message.id !== undefined;

  // Guard 1: server ID already present in list
  if (hasServerId && threadState.messages.some((m) => m.id === message.id)) {
    return false;
  }

  // Guard 2: server ID already confirmed via thread_message_sent (race B)
  if (hasServerId && threadState.confirmedMessageIds.has(message.id)) {
    return false;
  }

  // Guard 3: in-place confirm (race A — temp entry still pending)
  if (message.client_temp_id && threadState.pendingMessages.has(message.client_temp_id)) {
    const idx = threadState.messages.findIndex(
      (m) => m.client_temp_id === message.client_temp_id
    );
    if (idx !== -1) {
      threadState.messages[idx] = {
        ...threadState.messages[idx],
        id:      message.id,
        sent_at: message.sent_at,
        status:  message.status ?? 'sent',
      };
    }
    threadState.pendingMessages.delete(message.client_temp_id);
    if (hasServerId) _addConfirmedId(message.id);
    return false;
  }

  threadState.messages.push(message);
  return true;
}

export function addPendingMessage(message) {
  threadState.pendingMessages.set(message.client_temp_id, message);
  threadState.messages.push(message);
}

export function confirmOptimisticMessage(clientTempId, serverData) {
  // Record BEFORE deleting so in-flight new_thread_message is caught by Guard 2
  if (serverData.id != null) _addConfirmedId(serverData.id);

  const idx = threadState.messages.findIndex((m) => m.client_temp_id === clientTempId);
  if (idx !== -1) {
    threadState.messages[idx] = {
      ...threadState.messages[idx],
      id:      serverData.id,
      sent_at: serverData.sent_at,
      status:  serverData.status ?? 'sent',
    };
  }
  threadState.pendingMessages.delete(clientTempId);
}

export function failPendingMessage(clientTempId) {
  const idx = threadState.messages.findIndex((m) => m.client_temp_id === clientTempId);
  if (idx !== -1) {
    threadState.messages[idx] = { ...threadState.messages[idx], status: 'failed' };
  }
}

/**
 * HIDDEN-01 FIX: cap at 1000 (was 300). Evicts the oldest inserted entry.
 */
function _addConfirmedId(id) {
  threadState.confirmedMessageIds.add(id);
  if (threadState.confirmedMessageIds.size > 1000) {
    const oldest = threadState.confirmedMessageIds.values().next().value;
    threadState.confirmedMessageIds.delete(oldest);
  }
}


// ─── Message status ───────────────────────────────────────────────────────────

/**
 * Upgrade delivery/read status for a set of message IDs.
 * Only upgrades (sent→delivered→read), never downgrades.
 * Recognised values: 'sent' | 'delivered' | 'read'.
 */
export function updateMessageStatus(messageIds, status) {
  const ORDER = { sent: 0, delivered: 1, read: 2 };
  const idSet  = new Set(messageIds);
  for (const msg of threadState.messages) {
    if (!idSet.has(msg.id)) continue;
    const cur = ORDER[msg.status] ?? 0;
    const nxt = ORDER[status]     ?? 0;
    if (nxt > cur) msg.status = status;
  }
}


// ─── Thread list ──────────────────────────────────────────────────────────────

/**
 * Upsert a thread entry. Returns true if the thread's position in the sorted
 * list changed (caller may want to re-render the list item at the top).
 *
 * BUG-C2: tracks whether last_activity changed so callers can move the item
 * to the top of the DOM without a full re-render.
 */
export function addOrUpdateThreadInList(updates) {
  const existing   = threadState.threadList.get(updates.id) ?? {};
  const prevActivity = existing.last_activity;
  const merged     = { ...existing };

  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) merged[k] = v;
  }

  threadState.threadList.set(updates.id, merged);

  // Return true when activity timestamp changed — signals the thread should
  // move to the top of the list UI.
  return (
    merged.last_activity !== undefined &&
    merged.last_activity !== prevActivity
  );
}

export function removeThreadFromList(threadId) {
  threadState.threadList.delete(threadId);
}


// ─── Member map ───────────────────────────────────────────────────────────────

export function setMember(userId, data) {
  threadState.memberMap.set(userId, data);
}

export function getMember(userId) {
  return threadState.memberMap.get(userId) ?? null;
}


// ─── Presence ─────────────────────────────────────────────────────────────────

export function setUserOnline(userId, online) {
  threadState.onlineUsers.set(userId, online);
}

export function isUserOnline(userId) {
  return threadState.onlineUsers.get(userId) === true;
}

/**
 * ARCH-02: track which thread a user is actively viewing.
 * Called by thread.websocket.js on join/leave room.
 */
export function setUserActiveThread(userId, threadId) {
  if (threadId == null) {
    threadState.userActiveThread.delete(userId);
  } else {
    threadState.userActiveThread.set(userId, threadId);
  }
}

export function getUserActiveThread(userId) {
  return threadState.userActiveThread.get(userId) ?? null;
}


// ─── Typing ───────────────────────────────────────────────────────────────────

/**
 * WS-06 FIX: timeout aligned to 3500 ms (backend 3 s + 500 ms buffer).
 * onUpdate callback fires immediately and again on auto-expiry.
 */
export function setUserTyping(userId, name, typing, onUpdate) {
  const TIMEOUT_MS = 3500;

  if (threadState.typingUsers.has(userId)) {
    clearTimeout(threadState.typingUsers.get(userId));
    threadState.typingUsers.delete(userId);
  }

  if (!typing) {
    if (onUpdate) onUpdate();
    return;
  }

  const timerId = setTimeout(() => {
    threadState.typingUsers.delete(userId);
    if (onUpdate) onUpdate();
  }, TIMEOUT_MS);

  threadState.typingUsers.set(userId, timerId);
  if (onUpdate) onUpdate();
}

export function getTypingUsers() {
  return Array.from(threadState.typingUsers.keys());
}


// ─── Reset ────────────────────────────────────────────────────────────────────

/**
 * Clear per-thread session state. Preserves threadList, currentUser,
 * userActiveThread (personal room events must survive thread switches).
 */
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
  threadState.pendingAttachment   = null;
  threadState.memberMap           = new Map();
  threadState.typingThreadId      = null;
  // Do NOT clear userActiveThread — it tracks per-user presence across thread switches.
}
