/**
 * ============================================================================
 * LEARNORA STATE MANAGEMENT
 * A simple reactive store.  Components subscribe; state.set() triggers all
 * listeners with the new snapshot + the changed keys.
 * ============================================================================
 */

const DEFAULT_STATE = {
  /** Array of conversation summaries shown in the sidebar */
  conversations: [],

  /** ID of the currently open conversation (null = none selected) */
  activeConversationId: null,

  /** Full message array for the active conversation */
  messages: [],

  /** Title shown in the chat header */
  currentTitle: 'Learnora AI',

  /** True while an SSE stream is in-flight */
  isStreaming: false,

  /** Whether the sidebar is open */
  isSidebarOpen: true,

  /** Files queued to be sent with the next message [{file, name, type, previewURL}] */
  pendingFiles: [],

  /** Messages queued while a stream is in-flight [{text, files}] */
  pendingQueue: [],

  /** AI response mode */
  mode: 'fast_response',

  /** Quota info returned from /api/stats */
  quota: null,

  /** Loading flags */
  isLoadingConversations: false,
  isLoadingMessages: false,

  /** Pagination state for message history */
  hasMoreMessages: false,
  currentPage: 1,
};

class LearnoraState {
  constructor() {
    this._data = { ...DEFAULT_STATE };
    this._listeners = new Set();
  }

  /** Read a single key */
  get(key) {
    return this._data[key];
  }

  /** Read the entire snapshot (read-only reference) */
  snapshot() {
    return this._data;
  }

  /**
   * Merge partial updates and notify all subscribers.
   * @param {Partial<typeof DEFAULT_STATE>} updates
   */
  set(updates) {
    Object.assign(this._data, updates);
    this._notify(updates);
  }

  /**
   * Subscribe to state changes.
   * @param {(snapshot: object, changed: object) => void} fn
   * @returns {() => void}  Unsubscribe function
   */
  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  /** Hard-reset to defaults (e.g. on logout) */
  reset() {
    this._data = { ...DEFAULT_STATE };
    this._notify(DEFAULT_STATE);
  }

  _notify(changed) {
    const snapshot = this._data;
    this._listeners.forEach((fn) => {
      try {
        fn(snapshot, changed);
      } catch (e) {
        console.error('[LearnoraState] subscriber error:', e);
      }
    });
  }
}

/** Singleton instance shared across all learnora modules */
export const learnoraState = new LearnoraState();
