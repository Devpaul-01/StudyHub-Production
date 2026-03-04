/**
 * ============================================================================
 * FEED INITIALIZATION - UNIFIED DELEGATION VERSION
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import { PULL_TO_REFRESH_THRESHOLD } from './feed.constants.js';
import * as feedApi from './feed.api.js';
import { setupUnifiedDelegation } from '../app.unified.js'; // NEW IMPORT
import { 
  renderFeed, 
  updateFilterButtons, 
  updateFeedContainerVisibility,
  appendPostsToFeed
} from './feed.render.js';

import { setupAllEventListeners } from './feed.events.js';

const infiniteScrollObservers = new Map();

function cleanupObserver(filter) {
  const observer = infiniteScrollObservers.get(filter);
  if (observer) {
    observer.disconnect();
    infiniteScrollObservers.delete(filter);
  }
}

function setupInfiniteScroll() {
  const currentFilter = feedState.getCurrentFilter();
  cleanupObserver(currentFilter);
  
  const sentinel = document.getElementById(`feed-sentinel-${currentFilter}`);
  
  if (!sentinel) {
    console.warn(`Sentinel not found for filter: ${currentFilter}`);
    return;
  }
  
  const observer = new IntersectionObserver(
    async (entries) => {
      const entry = entries[0];
      
      if (!entry.isIntersecting) return;
      
      const filter = feedState.getCurrentFilter();
      const paginationState = feedState.getPaginationState(filter);
      
      if (paginationState.loading || !paginationState.hasNext) {
        return;
      }
      
      console.log(`📥 Loading more posts for ${filter} (page ${paginationState.page + 1})`);
      
      feedState.setPaginationLoading(filter, true);
      
      try {
        const { posts, pagination } = await feedApi.loadPostsByFilter(filter, paginationState.page + 1);
        
        if (posts.length > 0) {
          feedState.appendPosts(filter, posts);
          await appendPostsToFeed(filter, posts);
          
          feedState.setPaginationState(filter, {
            page: pagination.page,
            hasNext: pagination.has_next,
            loading: false
          });
          
          console.log(`✅ Loaded ${posts.length} posts. Has more: ${pagination.has_next}`);
          
          if (!pagination.has_next) {
            sentinel.remove();
            cleanupObserver(filter);
          }
        } else {
          feedState.setPaginationState(filter, {
            hasNext: false,
            loading: false
          });
          sentinel.remove();
          cleanupObserver(filter);
        }
      } catch (error) {
        console.error('Infinite scroll error:', error);
        feedState.setPaginationLoading(filter, false);
        
        if (typeof showToast === 'function') {
          showToast('Failed to load more posts', 'error');
        }
      }
    },
    {
      root: null,
      rootMargin: '200px',
      threshold: 0
    }
  );
  
  observer.observe(sentinel);
  infiniteScrollObservers.set(currentFilter, observer);
  
  console.log(`✅ Infinite scroll observer attached to ${currentFilter}`);
}

async function loadInitialData() {
  try {
    const feedData = await feedApi.loadInitialFeedData();
    
    feedState.setPosts('all', feedData.all);
    feedState.setPosts('department', feedData.department);
    feedState.setPosts('trending', feedData.trending);
    feedState.setPosts('connections', feedData.connections);
    feedState.setPosts('unsolved', feedData.unsolved);
    
    Object.keys(feedData.pagination).forEach(filter => {
      feedState.setPaginationState(filter, {
        page: feedData.pagination[filter].page,
        hasNext: feedData.pagination[filter].has_next,
        loading: false
      });
    });
    
    if (!feedState.areWidgetsLoaded()) {
      const widgets = await feedApi.loadWidgetData();
      feedState.setWidgets(widgets);
    }
  } catch (error) {
    console.error('Error loading feed data:', error);
    throw error;
  }
}

async function filterFeed(type) {
  const oldFilter = feedState.getCurrentFilter();
  if (oldFilter !== type) {
    cleanupObserver(oldFilter);
  }
  
  updateFilterButtons(type);
  updateFeedContainerVisibility(type);
  
  if (!feedState.isFilterLoaded(type)) {
    const { posts, pagination } = await feedApi.loadPostsByFilter(type, 1);
    feedState.setPosts(type, posts);
    feedState.setPaginationState(type, {
      page: pagination.page,
      hasNext: pagination.has_next,
      loading: false
    });
  }
  
  feedState.setCurrentFilter(type);
  await renderFeed(type);
  setupInfiniteScroll();
}

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
    
    this.contentArea.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    this.contentArea.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    this.contentArea.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: true });
    
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
      const visualPull = diff * 0.6;
      const pullDistance = Math.min(visualPull, this.threshold * 1.5);
      this.element.style.transform = `translateY(${pullDistance - 80}px)`;
      
      if (pullDistance >= this.threshold * 1.2) {
        this.element.classList.add('pulling');
      } else {
        this.element.classList.remove('pulling');
      }
    }
  }
  
  onTouchEnd(e) {
    if (!this.pulling || this.refreshing) return;
    
    const diff = this.currentY - this.startY;
    
    if (diff >= this.threshold * 1.25) {
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
    
    if (diff > 0 && this.contentArea.scrollTop === 0){
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
    
    if (diff >= this.threshold * 1.25) {
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
      infiniteScrollObservers.forEach((observer, filter) => {
        observer.disconnect();
      });
      infiniteScrollObservers.clear();
      
      await loadInitialData();
      await renderFeed(feedState.getCurrentFilter());
      
      setupAllEventListeners();
      setupInfiniteScroll();
      
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

async function initFeed() {
  console.log('initFeed() called');
  try {
    console.log('Initializing feed...');
    
    await loadInitialData();
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

document.addEventListener('DOMContentLoaded', async function() {
  console.log('=== LearnHub Feed Initialization Started ===');
  
  try {
    if (typeof api === 'undefined') {
      throw new Error('API helper not loaded');
    }
    if (typeof showToast === 'undefined') {
      console.warn('⚠ showToast not available');
      window.showToast = function(msg) { alert(msg); };
    }
    
    await initFeed();
    
    // ✅ NEW: Single unified delegation setup
    setupUnifiedDelegation();
    
    setupAllEventListeners(); // For non-delegation listeners (file uploads, etc.)
    setupInfiniteScroll();
    
    window.pullToRefresh = new PullToRefresh();
    
    console.log('=== All systems initialized ===');
    
  } catch (error) {
    console.error('=== INITIALIZATION FAILED ===');
    console.error('Error:', error.message);
    alert('Failed to load feed: ' + error.message);
  }
});

window.filterFeed = filterFeed;
window.setupInfiniteScroll = setupInfiniteScroll;