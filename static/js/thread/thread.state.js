/**
 * thread.state.js
 * Central in-memory state store for the active thread session.
 *
 * CHANGES:
 *  - Issue 1: pendingAttachment (single) → pendingAttachments (array).
 *  - Issue 5: pendingInvites [], activeTab 'messages' added.
 *  - Issue 6: activeTab consumed by thread_list_update handler.
 *  - NEW: myJoinRequests [] — requests the current user has sent (Invites tab).
 *  - NEW: moderationQueue [] — pending requests in threads the user moderates.
 *  - Neither myJoinRequests nor moderationQueue is cleared in resetThreadSession.
 */

// ─── State ────────────────────────────────────────────────────────────────────

export const threadState = {
  activeThreadId:  null,
  currentUser:     null,

  /** Ordered array of messages in the currently open thread. */
  messages: [],

  /**
   * Map<clientTempId, message> — optimistic (unsent) messages.
   * Removed once the server confirms or fails.
   */
  pendingMessages: new Map(),

  /**
   * Set<number> — confirmed server IDs used to deduplicate
   * broadcast vs confirm race. Capped at 1000 (HIDDEN-01).
   */
  confirmedMessageIds: new Set(),

  /** Map<id, threadData> — all threads the user is a member of. */
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
   */
  userActiveThread: new Map(),

  hasMore:         false,
  oldestMessageId: null,
  isLoadingMore:   false,

  /**
   * Array of pending file attachments for the next send.
   * Each entry: { file: File, name: string, type: string, size: number, previewUrl: string|null }
   * Issue 1: replaces the old single pendingAttachment object.
   */
  pendingAttachments: [],

  /** Map<userId, { name, avatar, role, username }> — populated from /members on thread open. */
  memberMap: new Map(),

  /** WS-06 FIX: capture the thread ID at the moment typing starts. */
  typingThreadId: null,

  /**
   * Cached list of pending invites (threads others invited me to).
   * NOT cleared in resetThreadSession (list-panel state).
   */
  pendingInvites: [],

  /**
   * Cached list of join requests the current user sent that are pending.
   * NOT cleared in resetThreadSession.
   */
  myJoinRequests: [],

  /**
   * Cached list of join requests pending approval in threads the user moderates/owns.
   * NOT cleared in resetThreadSession.
   */
  moderationQueue: [],

  /**
   * Which tab is currently active in the thread list panel.
   * Values: 'messages' | 'invites'
   * NOT cleared in resetThreadSession.
   */
  activeTab: 'messages',
};


// ─── Message dedup & optimistic updates ──────────────────────────────────────

/**
 * Add a message to state with full dedup protection.
 * HIDDEN-02 FIX: explicit null/undefined guard on message.id.
 *
 * @returns {boolean} true if inserted, false if deduped or confirmed-in-place
 */
export function addMessage(message) {
  const hasServerId = message.id !== null && message.id !== undefined;

  if (hasServerId && threadState.messages.some((m) => m.id === message.id)) {
    return false;
  }

  if (hasServerId && threadState.confirmedMessageIds.has(message.id)) {
    return false;
  }

  if (message.client_temp_id && threadState.pendingMessages.has(message.client_temp_id)) {
    const idx = threadState.messages.findIndex(
      (m) => m.client_temp_id === message.client_temp_id
    );
    if (idx !== -1) {
      threadState.messages[idx] = {
        ...threadState.messages[idx],
        id:             message.id,
        sent_at:        message.sent_at,
        status:         message.status ?? 'sent',
        attachments:    message.attachments ?? threadState.messages[idx].attachments ?? [],
        ai_personality: message.ai_personality ?? null,
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

/** HIDDEN-01 FIX: cap at 1000; evicts oldest. */
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
 * Upsert a thread entry.
 * Returns true if last_activity changed (caller may want to move to top).
 */
export function addOrUpdateThreadInList(updates) {
  const existing     = threadState.threadList.get(updates.id) ?? {};
  const prevActivity = existing.last_activity;
  const merged       = { ...existing };

  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) merged[k] = v;
  }

  threadState.threadList.set(updates.id, merged);

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

/** ARCH-02: track which thread a user is actively viewing. */
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

/** WS-06: timeout aligned to 3500 ms. */
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
 * Clear per-thread session state.
 * Preserves: threadList, currentUser, userActiveThread,
 *            activeTab, pendingInvites, myJoinRequests, moderationQueue.
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
  threadState.pendingAttachments  = [];
  threadState.memberMap           = new Map();
  threadState.typingThreadId      = null;
  // Do NOT clear: userActiveThread, activeTab, pendingInvites,
  //               myJoinRequests, moderationQueue
}
