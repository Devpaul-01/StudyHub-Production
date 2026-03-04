/**
 * ============================================================================
 * UNIFIED DELEGATION SYSTEM
 * Single listener on document.body
 * Smart container detection
 * All actions in one place
 * ============================================================================
 */


import { downloadResource, closeModal, openModal } from './feed/feed.utils.js';

import { HomeworkHandlers } from '../js/homework/homework.delegation.js';

import { MessageHandlers } from '../js/message/message.delegation.js';
import { AnalyticsHandlers }  from '../js/analytics/analytics.delegation.js';

import { ConnectionHandlers } from '../js/connection/connection.delegation.js';
import { NotificationHandlers } from '../js/notification/notification.delegation.js';



import { ProfileHandlers } from '../js/profile/profile.delegation.js';
import { FeedHandlers } from '../js/feed/feed.delegation.js';



let lazyModals = null;
let lazyEvents = null;
let lazyUtils = null;

async function getModals() {
  if (!lazyModals) {
    lazyModals = await import('./move/feed.modals.js');
  }
  return lazyModals;
}

async function getEvents() {
  if (!lazyEvents) {
    lazyEvents = await import('./move/feed.events.js');
  }
  return lazyEvents;
}

async function getUtils() {
  if (!lazyUtils) {
    lazyUtils = await import('./move/feed.utils.js');
  }
  return lazyUtils;
}

const UNIFIED_ACTIONS = {

  ...FeedHandlers,
  ...AnalyticsHandlers,
  ...ConnectionHandlers,
  ...HomeworkHandlers,
  ...NotificationHandlers,
  ...MessageHandlers,

  ...ProfileHandlers
  // ...HomeworkHandlers  ← see below
};


/**
 * ✅ Smart container detection
 * Returns: 'tag-modal' | 'comments-modal' | 'smart-feed' | 'global'
 */
 
 function detectContainer(element) {
   const tagModal = document.getElementById('tag-posts-container');
   if (tagModal && tagModal.contains(element)) return 'tag-modal';
   const commentsContainer = document.getElementById('comments-container');
   if (commentsContainer && commentsContainer.contains(element)) return 'comments-modal';
   const profileSection = document.getElementById('profile');
   if (profileSection && profileSection.classList.contains('active') && profileSection.contains(element)) {
     return 'profile';
   }
   const postsContainer = document.getElementById('posts-container');
   if (postsContainer && postsContainer.contains(element)) return 'smart-feed';
   return 'global';
}
/*
function detectContainer(element) {
  // Check tag modal first (most specific)
  const tagModal = document.getElementById('tag-posts-container');
  if (tagModal && tagModal.contains(element)) {
    return 'tag-modal';
  }
  
  // Check comments modal
  const commentsContainer = document.getElementById('comments-container');
  if (commentsContainer && commentsContainer.contains(element)) {
    return 'comments-modal';
  }
  
  // Check if in main feed
  const postsContainer = document.getElementById('posts-container');
  if (postsContainer && postsContainer.contains(element)) {
    return 'smart-feed';
  }
  
  // Otherwise it's global (modals, overlays, etc.)
  return 'global';
}
*/

/**
 * ✅ Get active feed container for syncing
 */
function getActiveContainer(containerType) {
  if (containerType === 'tag-modal') {
    return document.getElementById('tag-posts-container');
  } else if (containerType === 'comments-modal') {
    return document.getElementById('comments-container');
  } else if (containerType === 'smart-feed') {
    return document.querySelector('.posts-feed.active');
  }
  else if(containerType === 'profile'){
    return document.getElementById("profile");
  }
  return null;
}

/**
 * ✅ UNIFIED ACTION HANDLERS
 * All actions in one place
 */


/**
 * ✅ UNIFIED EVENT HANDLER
 */
function unifiedEventHandler(event) {
  event.stopPropagation();
  const target = event.target.closest('[data-action]');
  if (!target) return;
  
  const action = target.dataset.action;
  const handler = UNIFIED_ACTIONS[action];
  
  if (!handler) {
    console.debug(`No handler for action: ${action}`);
    return;
  }
  
  // Detect container type
  const containerType = detectContainer(target);
  
  // Execute handler
  try {
    handler(target, event, containerType);
  } catch (error) {
    console.error(`Error in handler for ${action}:`, error);
  }
}

/**
 * ✅ UNIFIED FORM HANDLER
 */
function unifiedFormHandler(event) {
  event.stopPropagation();
  const form = event.target.closest('form[data-action]');
  if (!form) return;
  
  const action = form.dataset.action;
  const handler = UNIFIED_ACTIONS[action];
  
  if (!handler) {
    console.debug(`No handler for form action: ${action}`);
    return;
  }
  
  const containerType = detectContainer(form);
  
  try {
    handler(form, event, containerType);
  } catch (error) {
    console.error(`Error in form handler for ${action}:`, error);
  }
}
/*


/**
 * ✅ SETUP UNIFIED DELEGATION
 */
export function setupUnifiedDelegation() {
  // Remove any existing listeners
  document.body.removeEventListener('click', unifiedEventHandler);
  document.body.removeEventListener('submit', unifiedFormHandler);
  
  // Add fresh listeners
  document.body.addEventListener('click', unifiedEventHandler);
  document.body.addEventListener('submit', unifiedFormHandler);
  
  console.log('✅ Unified delegation system initialized');
}

// Export helpers for other modules
export { detectContainer, getActiveContainer };

if (typeof window !== 'undefined') {
  window.setupUnifiedDelegation = setupUnifiedDelegation;
  
}