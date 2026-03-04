/**
 * ============================================================================
 * FEED INITIALIZATION
 * Entry point for the feed system
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import { PULL_TO_REFRESH_THRESHOLD } from './feed.constants.js';
// FIX: Import as feedApi to avoid conflict with global api variable
import * as feedApi from './feed.api.js';

import { 
  renderFeed, 
  updateFilterButtons, 
  updateFeedContainerVisibility,
  highlightPost,
  clearAllHighlights,
  updateReactionDisplay,
  showReactionMenu,
  hideReactionMenu,
  updateCommentLikeButton,
  updateCommentHelpfulButton,
  removePostFromDOM,
  removeCommentFromDOM,
  updatePostBookmarkDisplay,
  renderSelectedForkTags
} from './feed.render.js';

import { setupAllEventListeners } from './feed.events.js';

/**
 * Pull to Refresh Class
 */
class PullToRefresh {
  constructor() {
    this.startY = 0;
    this.currentY = 0;
    this.pulling = false;
    this.threshold = PULL_TO_REFRESH_THRESHOLD;
    this.refreshing = false;
    this.element = document.getElementById('pullToRefresh');
    this.contentArea = document.querySelector('.content-area');
    
    this.init();
  }
  
  init() {
    if (!this.element || !this.contentArea) return;
    
    // Touch events
    this.contentArea.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    this.contentArea.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.contentArea.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
    
    // Mouse events (for testing on desktop)
    this.contentArea.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.contentArea.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.contentArea.addEventListener('mouseup', this.onMouseUp.bind(this));
  }
  
  onTouchStart(e) {
    if (this.refreshing || this.contentArea.scrollTop > 0) return;
    this.startY = e.touches[0].clientY;
    this.pulling = true;
  }
  
  onTouchMove(e) {
    if (!this.pulling || this.refreshing) return;
    
    this.currentY = e.touches[0].clientY;
    const diff = this.currentY - this.startY;
    
    if (diff > 0 && this.contentArea.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(diff, this.threshold * 1.5);
      this.element.style.transform = `translateY(${pullDistance - 80}px)`;
      
      if (pullDistance >= this.threshold) {
        this.element.classList.add('pulling');
      } else {
        this.element.classList.remove('pulling');
      }
    }
  }
  
  onTouchEnd(e) {
    if (!this.pulling || this.refreshing) return;
    
    const diff = this.currentY - this.startY;
    
    if (diff >= this.threshold) {
      this.refresh();
    } else {
      this.reset();
    }
    
    this.pulling = false;
  }
  
  onMouseDown(e) {
    if (this.refreshing || this.contentArea.scrollTop > 0) return;
    this.startY = e.clientY;
    this.pulling = true;
  }
  
  onMouseMove(e) {
    if (!this.pulling || this.refreshing) return;
    
    this.currentY = e.clientY;
    const diff = this.currentY - this.startY;
    
    if (diff > 0 && this.contentArea.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(diff, this.threshold * 1.5);
      this.element.style.transform = `translateY(${pullDistance - 80}px)`;
      
      if (pullDistance >= this.threshold) {
        this.element.classList.add('pulling');
      } else {
        this.element.classList.remove('pulling');
      }
    }
  }
  
  onMouseUp(e) {
    if (!this.pulling || this.refreshing) return;
    
    const diff = this.currentY - this.startY;
    
    if (diff >= this.threshold) {
      this.refresh();
    } else {
      this.reset();
    }
    
    this.pulling = false;
  }
  
  async refresh() {
    this.refreshing = true;
    this.element.classList.add('refreshing');
    this.element.style.transform = 'translateY(0)';
    
    try {
      await loadAllData();
      await renderFeed(feedState.getCurrentFilter());
      
      setupAllEventListeners();
      
      if (typeof showToast === 'function') {
        showToast('Feed refreshed!', 'success');
      }
    } catch (error) {
      console.error('Refresh error:', error);
      if (typeof showToast === 'function') {
        showToast('Failed to refresh feed', 'error');
      }
    }
    
    setTimeout(() => {
      this.reset();
      this.refreshing = false;
    }, 500);
  }
  
  reset() {
    this.element.classList.remove('pulling', 'refreshing');
    this.element.style.transform = 'translateY(-100%)';
  }
}

/**
 * Load all feed data
 */
async function loadAllData() {
  try {
    // FIX: Use feedApi here
    const posts = await feedApi.loadAllFeedData();
    
    feedState.setPosts('all', posts.all);
    feedState.setPosts('department', posts.department);
    feedState.setPosts('trending', posts.trending);
    feedState.setPosts('connections', posts.connections);
    feedState.setPosts('unsolved', posts.unsolved);
    
    if (!feedState.areWidgetsLoaded()) {
      // FIX: Use feedApi here
      const widgets = await feedApi.loadWidgetData();
      feedState.setWidgets(widgets);
    }
  } catch (error) {
    console.error('Error loading feed data:', error);
    throw error;
  }
}

/**
 * Filter feed by type
 */
export async function filterFeed(type) {
  updateFilterButtons(type);
  updateFeedContainerVisibility(type);
  
  // Load data if not already loaded
  if (!feedState.isFilterLoaded(type)) {
    // FIX: Use feedApi here
    const posts = await feedApi.loadPostsByFilter(type);
    feedState.setPosts(type, posts);
  }
  
  feedState.setCurrentFilter(type);
  await renderFeed(type);
  
  setupAllEventListeners();
}

/**
 * Initialize feed system
 */
async function initFeed() {
  console.log('initFeed() called');
  try {
    console.log('Initializing feed...');
    
    await loadAllData();
    await renderFeed('all');
    
    console.log('Feed loaded successfully');
    if (typeof showToast === 'function') {
      showToast('Feed loaded!', 'success');
    }
  } catch (error) {
    console.error('Feed initialization error:', error);
    if (typeof showToast === 'function') {
      showToast('Failed to load feed: ' + error.message, 'error');
    }
  }
}

/**
 * Initialize everything on DOM ready
 */
document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== LearnHub Feed Initialization Started ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    console.log('Checking dependencies...');
    
    if (typeof api === 'undefined') {
      throw new Error('API helper not loaded. Make sure api.js is loaded before feed.js');
    }
    if (typeof showToast === 'undefined') {
      console.warn('⚠ showToast not available - using alert fallback');
      window.showToast = function(msg) { alert(msg); };
    }
    
    console.log('✓ Dependencies verified');
    
    console.log('Step 2: Initializing feed system...');
    await initFeed();
    console.log('✓ Feed initialized');
    
    console.log('Step 3: Setting up interaction features...');
    setupAllEventListeners();
    console.log('✓ All event listeners ready');
    
    console.log('Step 4: Initializing pull-to-refresh...');
    window.pullToRefresh = new PullToRefresh();
    console.log('✓ Pull-to-refresh ready');
    
    console.log('=== All systems initialized successfully ===');
    if (typeof showToast === 'function') {
      showToast('Feed loaded successfully!', 'success');
    }
    
  } catch (error) {
    console.error('=== INITIALIZATION FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    alert('Failed to load feed: ' + error.message + '\n\nPlease refresh the page.');
  }
});

console.log('Feed init module loaded at:', new Date().toISOString());

// Export for global use
window.filterFeed = filterFeed;
