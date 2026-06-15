/**
 * ============================================================================
 * LEARNORA DELEGATION  —  Unified event handler exports
 *
 * Each key maps to a `data-action` value in the HTML.
 * These are spread into UNIFIED_ACTIONS in app.unified.js.
 *
 * Pattern mirrors notification.delegation.js exactly.
 * ============================================================================
 */

import {
  createNewConversation,
  switchConversation,
  deleteConversation,
  clearConversation,
  sendMessage,
  continueResponse,
  toggleSidebar,
  setSidebarOpen,
  handleModeChange,
  addPendingFiles,
  removePendingFile,
  useSuggestion,
  startTitleEdit,
  openConvMenu,
  handleConvMenuAction,
} from './learnora.events.js';

export const LearnoraHandlers = {

  /** Create a brand-new conversation */
  'learnora-new-chat': (_target, _event, _container) => {
    createNewConversation();
  },

  /** Switch to an existing conversation (click on sidebar item) */
  'learnora-switch-conversation': (target, _event, _container) => {
    const id = Number(target.dataset.conversationId);
    if (!id) return;
    switchConversation(id);
  },

  /** Open the ⋯ context menu for a conversation */
  'learnora-conv-options': (target, event, _container) => {
    event.stopPropagation(); // don't bubble to switch-conversation
    const id = Number(target.dataset.conversationId);
    if (!id) return;
    openConvMenu(target, id);
  },

  /** Context menu item clicked — data-conv-action on the menu button */
  'learnora-conv-menu-action': (target, _event, _container) => {
    const action = target.dataset.convAction;
    if (action) handleConvMenuAction(action);
  },

  /** Send the current message (send button click) */
  'learnora-send': (_target, _event, _container) => {
    sendMessage();
  },

  /** Continue an incomplete AI response */
  'learnora-continue': (_target, _event, _container) => {
    continueResponse();
  },

  /** Toggle the conversation sidebar */
  'learnora-toggle-sidebar': (_target, _event, _container) => {
    toggleSidebar();
  },

  /** Close sidebar via the mobile overlay tap */
  'learnora-close-sidebar': (_target, _event, _container) => {
    setSidebarOpen(false);
  },

  /** Open the hidden file input */
  'learnora-attach-file': (_target, _event, _container) => {
    document.getElementById('lr-file-input')?.click();
  },

  /** Remove a queued attachment chip */
  'learnora-remove-file': (target, event, _container) => {
    event.stopPropagation();
    const idx = Number(target.dataset.fileIndex);
    removePendingFile(idx);
  },

  /** Change AI mode via select dropdown */
  'learnora-change-mode': (target, _event, _container) => {
    handleModeChange(target.value);
  },

  /** Click on an empty-state suggestion chip */
  'learnora-use-suggestion': (target, _event, _container) => {
    const text = target.dataset.suggestion ?? '';
    if (text) useSuggestion(text);
  },

  /** Refresh conversations list (retry after error) */
  'learnora-refresh-conversations': (_target, _event, _container) => {
    import('./learnora.events.js').then(m => m.loadConversations?.());
  },

  /** Double-click on the chat title to edit inline */
  'learnora-edit-title': (_target, _event, _container) => {
    startTitleEdit();
  },
};
