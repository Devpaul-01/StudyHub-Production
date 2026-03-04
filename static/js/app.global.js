/**
 * ============================================================================
 * GLOBAL EVENT DELEGATION - CORRECTED
 * Handles: Modals, Forms, Global UI, POST OPTIONS MODAL actions
 * ✅ FIXED: Added all post option actions (follow, delete, fork, etc.)
 * ============================================================================
 */

import { feedState } from './move/feed.state.js';
import * as feedApi from './move/feed.api.js';
import { downloadResource, closeModal, openModal } from './move/feed.utils.js';

// Lazy load to avoid circular dependencies
let lazyModals = null;
async function getModals() {
  if (!lazyModals) {
    lazyModals = await import('./move/feed.modals.js');
  }
  return lazyModals;
}

let lazyEvents = null;
async function getEvents() {
  if (!lazyEvents) {
    lazyEvents = await import('./move/feed.events.js');
  }
  return lazyEvents;
}

/**
 * ✅ Helper: Determine container type from modal context
 */
function getContainerTypeFromModal() {
  const advancedModal = document.getElementById('advanced-post-options-modal');
  if (!advancedModal || advancedModal.classList.contains('hidden')) {
    return 'smart-feed';
  }
  
  // Check if modal has containerType in dataset
  const containerType = advancedModal.dataset.containerType;
  return containerType || 'smart-feed';
}

/**
 * ✅ Global action handlers
 */
const GLOBAL_ACTIONS = {
  // ==================== REACTION MENU (GLOBAL OVERLAY) ====================
  'select-reaction': async (target, event) => {
    const reactionType = target.dataset.reaction;
    if (!reactionType) return;

    const reactionBtn = feedState.getReactionBtn();
    if (!reactionBtn) return;

    const postCard = reactionBtn.closest(".post-card");
    const postId = postCard?.dataset.postId;
    if (!postId) return;
    
    let containerType = 'smart-feed';
    const tagModal = document.getElementById('tag-posts-modal');
    if (tagModal && !tagModal.classList.contains('hidden')) {
      containerType = 'tag-modal';
    }

    const events = await getEvents();
    events.toggleReactions(postId, reactionType, null, containerType);

    const reactionMenu = document.getElementById("reactionMenu");
    if (reactionMenu) reactionMenu.classList.add("hidden");
  },
  
  // ==================== MODAL CONTROLS ====================
  'open-modal': (target) => {
    const modalId = target.dataset.modalId;
    const closeModalId = target.dataset.closeModal;
    if (closeModalId) closeModal(closeModalId);
    if (modalId) openModal(modalId);
  },
  
  'close-modal': (target) => {
    const modalId = target.dataset.modalId;
    if (modalId) closeModal(modalId);
  },
  
  // ==================== POST OPTIONS MODAL ACTIONS ====================
  // ✅ These happen in advanced-post-options-modal (global)
  
  'follow-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleFollowPost(postId, event, containerType);
    
    // Close options modal
    closeModal('advanced-post-options-modal');
  },
  
  'unfollow-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleUnfollowPost(postId, event, containerType);
    
    closeModal('advanced-post-options-modal');
  },
  
  'delete-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleDeletePost(postId, event, containerType);
    
    closeModal('advanced-post-options-modal');
  },
  
  'report-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const events = await getEvents();
    events.handleOpenReportModal(postId, event);
    
    closeModal('advanced-post-options-modal');
  },
  
  'fork-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const modals = await getModals();
    modals.openForkModal(postId);
    
    closeModal('advanced-post-options-modal');
  },
  
  'refine-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const modals = await getModals();
    modals.refinePost(postId);
    
    closeModal('advanced-post-options-modal');
  },
  
  'share-post': (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    // Import sharePost from utils
    import('./move/feed.utils.js').then(({ sharePost }) => {
      sharePost(postId);
    });
    
    closeModal('advanced-post-options-modal');
  },
  
  'open-learnora': (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    import('./move/feed.utils.js').then(({ openLearnora }) => {
      openLearnora(postId);
    });
    
    closeModal('advanced-post-options-modal');
  },
  
  'listen-post': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleListenPost(postId, event, containerType);
    
    closeModal('advanced-post-options-modal');
  },
  
  'mark-solved': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleMarkSolved(postId, event, containerType);
    
    closeModal('advanced-post-options-modal');
  },
  
  'unmark-solved': async (target, event) => {
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const containerType = getContainerTypeFromModal();
    const events = await getEvents();
    events.handleUnmarkSolved(postId, event, containerType);
    
    closeModal('advanced-post-options-modal');
  },
  
  'create-thread-from-post': async (target, event) => {
    event.stopPropagation();
    const postId = target.dataset.postId;
    if (!postId) return;
    
    const events = await getEvents();
    events.handleCreateThreadFromPost(postId, event);
    
    closeModal('advanced-post-options-modal');
  },
  
  'view-thread': async (target, event) => {
    const threadId = target.dataset.threadId;
    const type = target.dataset.threadType || 'post';
    if (!threadId) return;
    
    const events = await getEvents();
    events.handleViewThread(threadId, type, event);
    
    closeModal('advanced-post-options-modal');
  },
  
  'view-user-overview': async (target, event) => {
    const userId = target.dataset.authorId;
    if (!userId) return;
    
    const modals = await getModals();
    modals.startAuthorOverviewStream(userId);
    
    closeModal('advanced-post-options-modal');
  },
  
  'connect-request': async (target, event) => {
    const userId = target.dataset.userId;
    if (!userId) return;
    
    const events = await getEvents();
    events.handleConnectRequest(userId, event);
    
    closeModal('advanced-post-options-modal');
  },
  
  // ==================== CREATE POST MODAL ====================
  'submit-create-post': async (target, event) => {
    event.preventDefault();
    const events = await getEvents();
    events.handleCreatePost(event);
  },
  
  'add-post-tag': async (target) => {
    const tag = target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.addPostTag(tag);
  },
  
  'remove-post-tag': async (target) => {
    const tag = target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.removePostTag(tag);
  },
  
  'toggle-thread-settings': (target) => {
    const modal = document.getElementById('create-post-thread-details-modal');
    if (modal) modal.classList.toggle('hidden');
  },
  
  'trigger-file-input': (target) => {
    const inputId = target.dataset.inputId;
    const modalId = target.dataset.closeModal;
    
    const input = document.getElementById(inputId);
    if (input) input.click();
    
    if (modalId) closeModal(modalId);
  },
  
  // ==================== CREATE THREAD MODAL ====================
  'submit-create-thread': async (target, event) => {
    event.preventDefault();
    const events = await getEvents();
    events.handleCreateThread(event);
  },
  
  'add-thread-tag': async (target) => {
    const tag = target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.addThreadTag(tag);
  },
  
  'remove-thread-tag': async (target) => {
    const tag = target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.removeThreadTag(tag);
  },
  
  // ==================== FORK MODAL ====================
  'submit-fork-post': async (target, event) => {
    event.preventDefault();
    const modals = await getModals();
    modals.saveForkedPost(event);
  },
  
  'add-fork-tag': async (target) => {
    const tag = target.dataset.tag || target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.addForkTag(tag);
  },
  
  'remove-fork-tag': async (target) => {
    const tag = target.dataset.tag || target.dataset.value;
    if (!tag) return;
    
    const modals = await getModals();
    modals.removeForkTag(tag);
  },
  
  // ==================== THREAD VIEW MODAL ====================
  'join-thread': async (target, event) => {
    event.stopPropagation();
    const events = await getEvents();
    events.handleJoinThread(event);
  },
  
  // ==================== REPORT MODAL ====================
  'submit-report-post': async (target, event) => {
    event.preventDefault();
    const events = await getEvents();
    events.handleReportPost(event);
  },
  
  // ==================== REFINEMENT MODALS ====================
  'start-refinement': async (target, event) => {
    event.stopPropagation();
    const modal = document.getElementById('post-refine-modal');
    const postId = modal?.dataset.id;
    if (!postId) return;
    
    const modals = await getModals();
    modals.startRefinement(postId);
  },
  
  'apply-refinement': async (target, event) => {
    event.stopPropagation();
    const modal = document.getElementById('post-refine-modal');
    const postId = modal?.dataset.id;
    if (!postId) return;
    
    const modals = await getModals();
    modals.applyRefinement(postId);
  },
  
  'refine-before-post': async (target, event) => {
    const context = target.dataset.context || 'create';
    const modals = await getModals();
    modals.refineBeforePost(context, event);
  },
  
  'start-inline-refinement': async (target, event) => {
    event.stopPropagation();
    const modals = await getModals();
    modals.startInlineRefinement();
  },
  
  'apply-inline-refinement': async (target, event) => {
    event.stopPropagation();
    const modals = await getModals();
    modals.applyInlineRefinement();
  },
  
  // ==================== COMMENTS MODAL ====================
  'post-comment': async (target, event) => {
    event.preventDefault();
    event.stopPropagation();
    const modals = await getModals();
    modals.postComment(event);
  },
  
  // ==================== DOWNLOAD ====================
  'download-resource': (target, event) => {
    const url = target.dataset.url;
    const filename = target.dataset.filename;
    downloadResource(url, filename);
  },
  
  // ==================== NAVIGATION ====================
  'filter-feed': (target) => {
    const filter = target.dataset.filter;
    if (filter && typeof window.filterFeed === 'function') {
      window.filterFeed(filter);
    }
  },
  
  'logout': (target, event) => {
    if (typeof logout === 'function') {
      logout(event);
    }
  }
};

/**
 * ✅ Global click handler
 */
function globalClickHandler(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  
  // ✅ CRITICAL: Only handle if NOT inside feed containers
  // Exception: Allow advanced-post-options-modal even though it's in global-root-modal
  const postsContainer = document.getElementById('posts-container');
  const commentsContainer = document.getElementById('comments-container');
  const tagContainer = document.getElementById('tag-posts-container');
  const advancedModal = document.getElementById('advanced-post-options-modal');
  
  // Check if click is in a feed container
  const inFeedContainer = (postsContainer && postsContainer.contains(target)) || 
                          (commentsContainer && commentsContainer.contains(target)) || 
                          (tagContainer && tagContainer.contains(target));
  
  // Check if click is in advanced modal (which is inside global but should be handled globally)
  const inAdvancedModal = advancedModal && advancedModal.contains(target);
  
  // ✅ If in feed container (including comments) but NOT in advanced modal, let feed handle it
  if (inFeedContainer && !inAdvancedModal) {
    return; // Exit early - feed delegation will handle
  }
  
  // ✅ If in advanced modal, continue to global handler below
  // ✅ If not in any feed container, continue to global handler below
  
  const action = target.dataset.action;
  const handler = GLOBAL_ACTIONS[action];
  
  if (handler) {
    event.stopPropagation();
    handler(target, event);
  }
}

/**
 * ✅ Global form submit handler
 */
function globalSubmitHandler(event) {
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  
  const postsContainer = document.getElementById('posts-container');
  const commentsContainer = document.getElementById('comments-container');
  const tagContainer = document.getElementById('tag-posts-container');
  
  if (postsContainer?.contains(form) || 
      commentsContainer?.contains(form) || 
      tagContainer?.contains(form)) {
    return;
  }
  
  const action = form.dataset.action;
  const handler = GLOBAL_ACTIONS[action];
  
  if (handler) {
    event.preventDefault();
    event.stopPropagation();
    handler(form, event);
  }
}

/**
 * ✅ Setup global delegation
 */
export function setupGlobalDelegation() {
  const globalModal = document.getElementById("global-root-modal");
  
  if (!globalModal) {
    console.error('Global modal container not found');
    return;
  }
  
  globalModal.removeEventListener('click', globalClickHandler);
  globalModal.removeEventListener('submit', globalSubmitHandler);
  
  globalModal.addEventListener('click', globalClickHandler);
  globalModal.addEventListener('submit', globalSubmitHandler);
  
  console.log('✅ Global delegation initialized');
}

if (typeof window !== 'undefined') {
  window.setupGlobalDelegation = setupGlobalDelegation;
}