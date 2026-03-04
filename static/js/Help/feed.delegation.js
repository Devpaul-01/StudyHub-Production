/**
 * ============================================================================
 * FEED EVENT DELEGATION - CORRECTED
 * ✅ ONLY handles actions that happen INSIDE feed containers
 * ✅ Modal actions handled by app.global.js
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import * as feedApi from './feed.api.js';

import { 
  viewProfile, 
  sharePost, 
  openLearnora, 
  searchTag,
  downloadResource,
  closeModal
} from './feed.utils.js';

import {
  renderPostComments,
  appendCommentToUI,
  updatePreviousButton
} from './feed.render.js';

// Lazy-load to avoid circular dependencies
let lazyModals = null;
async function getModals() {
  if (!lazyModals) {
    lazyModals = await import('./feed.modals.js');
  }
  return lazyModals;
}

let lazyEvents = null;
async function getEvents() {
  if (!lazyEvents) {
    lazyEvents = await import('./feed.events.js');
  }
  return lazyEvents;
}

/**
 * ✅ Determine container type from DOM element
 */
function getContainerType(element) {
  const tagModal = document.getElementById('tag-posts-container');
  if (tagModal && tagModal.contains(element)) {
    return 'tag-modal';
  }
  
  const commentsContainer = document.getElementById('comments-container');
  if (commentsContainer && commentsContainer.contains(element)) {
    return 'comments-modal';
  }
  
  return 'smart-feed';
}

/**
 * ✅ CORRECTED: Feed-only handlers
 * Actions that happen DIRECTLY on posts in feed (not in modals)
 */
const ACTION_HANDLERS = {
  // ==================== PROFILE ====================
  'view-profile': (target, event, containerType) => {
    const username = target.dataset.username || target.closest('[data-username]')?.dataset.username;
    if (username) viewProfile(username);
  },

  // ==================== POST CARD DIRECT INTERACTIONS ====================
  // ✅ These happen ON the post card itself, not in modal
  
  'toggle-post-options': async (target, event, containerType) => {
    event.stopPropagation();
    const postId = target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;
    
    const events = await getEvents();
    events.togglePostOptions(postId, event, containerType);
  },
  
  'toggle-reactions': async (target, event, containerType) => {
    if (target.closest('#reactionMenu')) return; // Global handles
    
    event.stopPropagation();
    const postId = target.closest('[data-post-id]')?.dataset.postId;
    const reactionType = target.dataset.reaction || 'like';
    if (!postId) return;
    
    const events = await getEvents();
    events.toggleReactions(postId, reactionType, event, containerType);
  },
  
  'open-comments': async (target, event, containerType) => {
    const postId = target.closest('[data-post-id]')?.dataset.postId;
    if (!postId) return;
    
    const modals = await getModals();
    modals.openCommentModal(postId, event);
  },
  
  // ==================== POST RESOURCES (SHOWN IN FEED) ====================
  'scroll-post-resource': async (target, event, containerType) => {
    event.stopPropagation();
    const direction = target.dataset.direction;
    
    const events = await getEvents();
    events.handleScrollPostResource(direction, target);
  },
  
  'view-post-resource-links': async (target, event, containerType) => {
    event.stopPropagation();
    const events = await getEvents();
    events.showPostResourceLinks(target);
  },
  
  'download-resource': (target, event, containerType) => {
    const url = target.dataset.url;
    const filename = target.dataset.filename;
    downloadResource(url, filename);
  },
  
  // ==================== TAGS (IN FEED) ====================
  'view-tag-posts': async (target, event, containerType) => {
    const tag = target.dataset.tag;
    event.stopPropagation();
    
    const events = await getEvents();
    events.handleViewTagPosts(tag);
  },
  
  'search-tag': (target, event, containerType) => {
    const tag = target.dataset.tag;
    if (tag) searchTag(tag);
  },
  
  // ==================== COMMENTS (IN COMMENTS MODAL) ====================
  'toggle-comment-like': async (target, event, containerType) => {
    const commentId = target.closest('[data-comment-id]')?.dataset.commentId;
    if (!commentId) return;
    
    const events = await getEvents();
    events.handleToggleCommentLike(commentId, event);
  },
  
  'toggle-comment-helpful': async (target, event, containerType) => {
    const commentId = target.closest('[data-comment-id]')?.dataset.commentId;
    if (!commentId) return;
    
    const events = await getEvents();
    events.handleToggleCommentHelpful(commentId, event);
  },
  
  'toggle-comment-settings': async (target, event, containerType) => {
    event.stopPropagation();
    const events = await getEvents();
    events.handleToggleCommentSettings(target);
  },
  
  'delete-comment': async (target, event, containerType) => {
    const commentId = target.closest('[data-comment-id]')?.dataset.commentId;
    if (!commentId) return;
    
    const events = await getEvents();
    events.handleDeleteComment(commentId, event);
  },
  
  'mark-solution': async (target, event, containerType) => {
    const commentId = target.dataset.commentId;
    const postId = target.dataset.postId;
    if (!commentId || !postId) return;
    
    const events = await getEvents();
    events.handleMarkSolution(postId, commentId, event);
  },
  
  'unmark-solution': async (target, event, containerType) => {
    const commentId = target.dataset.commentId;
    const postId = target.dataset.postId;
    if (!commentId || !postId) return;
    
    const events = await getEvents();
    events.handleUnmarkSolution(postId, commentId, event);
  },
  
  'open-reply': async (target, event, containerType) => {
    const commentId = target.dataset.commentId;
    const postId = target.dataset.postId;
    const username = target.dataset.username;
    if (!commentId || !postId || !username) return;
    
    const modals = await getModals();
    modals.openReplyModal(username, commentId, postId);
  },
  
  'view-comment-resource': async (target, event, containerType) => {
    event.stopPropagation();
    const url = target.dataset.url;
    const type = target.dataset.resourceType;
    
    const events = await getEvents();
    events.showCommentResource(url, type);
  },
  
  'view-comment-resources': async (target, event, containerType) => {
    event.stopPropagation();
    const resources = target.dataset.resources;
    
    const events = await getEvents();
    events.showCommentResources(resources);
  },
  
  'view-comment-resource-links': async (target, event, containerType) => {
    event.stopPropagation();
    const events = await getEvents();
    events.showCommentResourceLinks(target);
  }
};

/**
 * ✅ Delegated event handler
 */
function handleDelegatedEvent(event, containerElement) {
  const target = event.target;
  const actionElement = target.closest('[data-action]');
  
  if (!actionElement) return;
  if (!event.currentTarget.contains(actionElement)) return;
  
  const action = actionElement.dataset.action;
  const handler = ACTION_HANDLERS[action];
  
  if (handler) {
    event.stopPropagation();
    const containerType = getContainerType(containerElement);
    handler(actionElement, event, containerType);
  }
}

/**
 * ✅ Setup delegation for smart feed
 */
export function setupSmartFeedDelegation() {
  const feedContainer = document.getElementById('posts-container');
  
  if (!feedContainer) {
    console.error('Smart feed container not found');
    return;
  }
  
  feedContainer.replaceWith(feedContainer.cloneNode(true));
  const newContainer = document.getElementById('posts-container');
  
  newContainer.addEventListener('click', (event) => {
    const activeFeed = newContainer.querySelector('.posts-feed.active');
    handleDelegatedEvent(event, activeFeed || newContainer);
  });
  
  console.log('✅ Smart feed delegation setup');
}

/**
 * ✅ Setup delegation for tag modal
 */
export function setupTagModalDelegation() {
  const tagModalContainer = document.getElementById('tag-posts-container');
  
  if (!tagModalContainer) {
    console.warn('Tag modal container not found');
    return;
  }
  
  tagModalContainer.replaceWith(tagModalContainer.cloneNode(true));
  const newContainer = document.getElementById('tag-posts-container');
  
  newContainer.addEventListener('click', (event) => {
    handleDelegatedEvent(event, newContainer);
  });
  
  console.log('✅ Tag modal delegation setup');
}

/**
 * ✅ Setup delegation for comments modal
 */
export function setupCommentsModalDelegation() {
  const commentsContainer = document.getElementById('comments-container');
  
  if (!commentsContainer) {
    console.error('Comments container not found');
    return;
  }
  
  commentsContainer.replaceWith(commentsContainer.cloneNode(true));
  const newContainer = document.getElementById('comments-container');
  
  newContainer.addEventListener('click', (event) => {
    handleDelegatedEvent(event, newContainer);
  });
  
  console.log('✅ Comments modal delegation setup');
}

/**
 * ✅ Setup all delegation handlers
 */
export function setupAllDelegation() {
  setupSmartFeedDelegation();
  setupTagModalDelegation();
  setupCommentsModalDelegation();
  
  console.log('✅ All delegation initialized');
}

if (typeof window !== 'undefined') {
  window.setupAllDelegation = setupAllDelegation;
  window.setupSmartFeedDelegation = setupSmartFeedDelegation;
  window.setupTagModalDelegation = setupTagModalDelegation;
  window.setupCommentsModalDelegation = setupCommentsModalDelegation;
}