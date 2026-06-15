export const ACTION_OWNERSHIP = {
  // ==================== GLOBAL ACTIONS ====================
  // These are ALWAYS handled by global coordinator
  'navigate-to': 'global',
  'logout': 'global',
  'open-modal': 'global',
  'close-modal': 'global',
  'toggle-mobile-sidebar': 'global',
  'filter-feed': 'global',
  
  // ==================== MODAL ACTIONS ====================
  // These are handled by modal.handlers.js
  'post-comment': 'modal',
  'submit-create-post': 'modal',
  'submit-create-thread': 'modal',
  'submit-fork-post': 'modal',
  'submit-report-post': 'modal',
  'join-thread': 'modal',
  
  // Modal tag management
  'add-post-tag': 'modal',
  'remove-post-tag': 'modal',
  'add-thread-tag': 'modal',
  'remove-thread-tag': 'modal',
  'add-fork-tag': 'modal',
  'remove-fork-tag': 'modal',
  
  // Modal utilities
  'trigger-file-input': 'modal',
  'toggle-thread-settings': 'modal',
  'refine-before-post': 'modal',
  'start-inline-refinement': 'modal',
  'apply-inline-refinement': 'modal',
  'start-refinement': 'modal',
  'apply-refinement': 'modal',
  
  // ==================== FEED ACTIONS ====================
  // These are handled by feed.handlers.js
  'toggle-reactions': 'feed',
  'select-reaction': 'feed',
  'open-comments': 'feed',
  'view-profile': 'feed',
  'view-author-overview': 'feed',
  'connect-request': 'feed',
  'follow-post': 'feed',
  'unfollow-post': 'feed',
  'fork-post': 'feed',
  'refine-post': 'feed',
  'share-post': 'feed',
  'open-learnora': 'feed',
  'listen-post': 'feed',
  'view-tag-posts': 'feed',
  'search-tag': 'feed',
  
  // Post resources
  'scroll-post-resource': 'feed',
  'view-post-resource-links': 'feed',
  'download-resource': 'feed',
  
  // Comments
  'toggle-comment-like': 'feed',
  'toggle-comment-helpful': 'feed',
  'open-reply': 'feed',
  'switch-comment': 'feed',
  'toggle-comment-settings': 'feed',
  'view-comment-resource': 'feed',
  'view-comment-resources': 'feed',
  'close-comment-resources': 'feed',
  'view-comment-resource-links': 'feed',
  
  // Threads
  'view-thread': 'feed',
  'create-thread-from-post': 'feed',
  
  // ==================== SHARED ACTIONS ====================
  // Context-dependent - routed based on location
  'toggle-post-options': 'shared',
  'delete-post': 'shared',
  'delete-comment': 'shared',
  'report-post': 'shared',
  'mark-solved': 'shared',
  'unmark-solved': 'shared',
};

/**
 * Get ownership type for an action
 */
export function getActionOwnership(action) {
  return ACTION_OWNERSHIP[action] || 'unknown';
}

/**
 * Check if action should be handled globally
 */
export function isGlobalAction(action) {
  return ACTION_OWNERSHIP[action] === 'global';
}

/**
 * Check if action should be handled by modal system
 */
export function isModalAction(action) {
  return ACTION_OWNERSHIP[action] === 'modal';
}

/**
 * Check if action should be handled by feed
 */
export function isFeedAction(action) {
  return ACTION_OWNERSHIP[action] === 'feed';
}

/**
 * Check if action is context-dependent
 */
export function isSharedAction(action) {
  return ACTION_OWNERSHIP[action] === 'shared';
}