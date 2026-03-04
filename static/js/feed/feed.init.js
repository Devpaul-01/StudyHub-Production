/**
 * ============================================================================
 * FEED INITIALIZATION
 * Updated: Infinite scroll now uses cursor-based pagination.
 *          - Reads nextCursor from feedState
 *          - Passes it to loadPostsByFilter(filter, cursor)
 *          - Stores the returned nextCursor back in state
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import { PULL_TO_REFRESH_THRESHOLD } from './feed.constants.js';
import * as feedApi from './feed.api.js';
import { setupUnifiedDelegation } from '../app.unified.js';
import { initVideoAutoplay, notifySlideChange } from './feed.video_autoplay.js';
import { openResourceViewer, initResourceViewer } from '../resource.viewer.js';

import {
  renderFeed,
  updateFilterButtons,
  updateFeedContainerVisibility,
  appendPostsToFeed,
} from './feed.render.js';
import {setupAllEventListeners} from './feed.events.js';
import { getLoadingSkeleton, hasWidgetData } from './feed.utils.js';

// ---------------------------------------------------------------------------
// IntersectionObserver registry (one observer per filter)
// ---------------------------------------------------------------------------

const infiniteScrollObservers = new Map();

function cleanupObserver(filter) {
  const observer = infiniteScrollObservers.get(filter);
  if (observer) {
    observer.disconnect();
    infiniteScrollObservers.delete(filter);
  }
}

// ---------------------------------------------------------------------------
// Infinite scroll
// ---------------------------------------------------------------------------

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
      if (!entries[0].isIntersecting) return;

      const filter          = feedState.getCurrentFilter();
      const paginationState = feedState.getPaginationState(filter);

      // Guard: skip if already loading or no more data
      if (paginationState.loading || !paginationState.hasMore) return;

      console.log(`📥 Loading more posts for "${filter}" (cursor: ${paginationState.nextCursor})`);
      feedState.setPaginationLoading(filter, true);

      try {
        const { posts, nextCursor, hasMore } = await feedApi.loadPostsByFilter(
          filter,
          paginationState.nextCursor  // pass current cursor → get next page
        );

        if (posts.length > 0) {
          feedState.appendPosts(filter, posts);
          await appendPostsToFeed(filter, posts);

          // Persist the new cursor + hasMore flag
          feedState.setPaginationState(filter, { nextCursor, hasMore, loading: false });

          console.log(`✅ Appended ${posts.length} posts. Has more: ${hasMore}`);

          if (!hasMore) {
            sentinel.remove();
            cleanupObserver(filter);
          }
        } else {
          // Backend returned an empty batch — treat as end of feed
          feedState.setPaginationState(filter, { nextCursor: null, hasMore: false, loading: false });
          sentinel.remove();
          cleanupObserver(filter);
        }
      } catch (error) {
        console.error('Infinite scroll error:', error);
        feedState.setPaginationLoading(filter, false);
        if (typeof showToast === 'function') showToast('Failed to load more posts', 'error');
      }
    },
    {
      root:       null,
      rootMargin: '200px',  // start loading before the sentinel is visible
      threshold:  0,
    }
  );

  observer.observe(sentinel);
  infiniteScrollObservers.set(currentFilter, observer);
  console.log(`✅ Infinite scroll observer attached to "${currentFilter}"`);
}

// ---------------------------------------------------------------------------
// Initial data load
// ---------------------------------------------------------------------------

async function loadInitialData() {
  try {
    const feedData = await feedApi.loadInitialFeedData();

    // Store posts
    feedState.setPosts('all',         feedData.all);
    feedState.setPosts('department',  feedData.department);
    feedState.setPosts('trending',    feedData.trending);
    feedState.setPosts('connections', feedData.connections);
    feedState.setPosts('unsolved',    feedData.unsolved);

    // Store cursor metadata returned for each filter
    Object.keys(feedData.cursors).forEach(filter => {
      const { nextCursor, hasMore } = feedData.cursors[filter];
      feedState.setPaginationState(filter, { nextCursor, hasMore, loading: false });
    });

    // Load widget data once
    if (!feedState.areWidgetsLoaded()) {
      const widgets = await feedApi.loadWidgetData();
      feedState.setWidgets(widgets);
    }
  } catch (error) {
    console.error('Error loading feed data:', error);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Filter switching
// ---------------------------------------------------------------------------

async function filterFeed(type) {
  const oldFilter = feedState.getCurrentFilter();
  if (oldFilter !== type) cleanupObserver(oldFilter);

  updateFilterButtons(type);
  updateFeedContainerVisibility(type);

  // Lazy-load filter data on first visit
  if (!feedState.isFilterLoaded(type)) {
    const { posts, nextCursor, hasMore } = await feedApi.loadPostsByFilter(type);
    feedState.setPosts(type, posts);
    feedState.setPaginationState(type, { nextCursor, hasMore, loading: false });
  }

  feedState.setCurrentFilter(type);
  await renderFeed(type);
  setupInfiniteScroll();
}

// ---------------------------------------------------------------------------
// Pull-to-refresh
// ---------------------------------------------------------------------------

class PullToRefresh {
  constructor() {
    this.startY      = 0;
    this.currentY    = 0;
    this.pulling     = false;
    this.threshold   = PULL_TO_REFRESH_THRESHOLD;
    this.refreshing  = false;
    this.element     = document.getElementById('pullToRefresh');
    this.contentArea = document.querySelector('.content-area');
    this.init();
  }

  init() {
    if (!this.element || !this.contentArea) return;
    this.contentArea.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: true });
    this.contentArea.addEventListener('touchmove',  this.onTouchMove.bind(this),  { passive: false });
    this.contentArea.addEventListener('touchend',   this.onTouchEnd.bind(this),   { passive: true });
    this.contentArea.addEventListener('mousedown',  this.onMouseDown.bind(this));
    this.contentArea.addEventListener('mousemove',  this.onMouseMove.bind(this));
    this.contentArea.addEventListener('mouseup',    this.onMouseUp.bind(this));
  }

  onTouchStart(e) {
    if (this.refreshing || this.contentArea.scrollTop > 0) return;
    this.startY  = e.touches[0].clientY;
    this.pulling = true;
  }

  onTouchMove(e) {
    if (!this.pulling || this.refreshing) return;
    this.currentY = e.touches[0].clientY;
    const diff    = this.currentY - this.startY;
    if (diff > 0 && this.contentArea.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(diff * 0.6, this.threshold * 1.5);
      this.element.style.transform = `translateY(${pullDistance - 80}px)`;
      this.element.classList.toggle('pulling', pullDistance >= this.threshold * 1.2);
    }
  }

  onTouchEnd() {
    if (!this.pulling || this.refreshing) return;
    if (this.currentY - this.startY >= this.threshold * 1.25) this.refresh();
    else this.reset();
    this.pulling = false;
  }

  onMouseDown(e) {
    if (this.refreshing || this.contentArea.scrollTop > 0) return;
    this.startY  = e.clientY;
    this.pulling = true;
  }

  onMouseMove(e) {
    if (!this.pulling || this.refreshing) return;
    this.currentY = e.clientY;
    const diff    = this.currentY - this.startY;
    if (diff > 0 && this.contentArea.scrollTop === 0) {
      e.preventDefault();
      const pullDistance = Math.min(diff, this.threshold * 1.5);
      this.element.style.transform = `translateY(${pullDistance - 80}px)`;
      this.element.classList.toggle('pulling', pullDistance >= this.threshold);
    }
  }

  onMouseUp() {
    if (!this.pulling || this.refreshing) return;
    if (this.currentY - this.startY >= this.threshold * 1.25) this.refresh();
    else this.reset();
    this.pulling = false;
  }

  async refresh() {
    this.refreshing = true;
    this.element.classList.add('refreshing');
    this.element.style.transform = 'translateY(0)';

    try {
      // Tear down all observers then do a clean reload
      infiniteScrollObservers.forEach(obs => obs.disconnect());
      infiniteScrollObservers.clear();

      await loadInitialData();
      await renderFeed(feedState.getCurrentFilter());

      setupAllEventListeners();
      setupInfiniteScroll();
    } catch (error) {
      console.error('Refresh error:', error);
      if (typeof showToast === 'function') showToast('Failed to refresh feed', 'error');
    }

    setTimeout(() => { this.reset(); this.refreshing = false; }, 500);
  }

  reset() {
    this.element.classList.remove('pulling', 'refreshing');
    this.element.style.transform = 'translateY(-100%)';
  }
}

// ---------------------------------------------------------------------------
// Feed init entry point
// ---------------------------------------------------------------------------

async function initFeed() {
  console.log('Initializing feed...');
  const container = document.getElementById("feed-all");
  container.innerHTML = getLoadingSkeleton();
  try {
    await loadInitialData();
    await renderFeed('all');
    console.log('Feed loaded successfully');
  } catch (error) {
    console.error('Feed initialization error:', error);
    if (typeof showToast === 'function') showToast('Failed to load feed: ' + error.message, 'error');
  }
}

// ---------------------------------------------------------------------------
// DOMContentLoaded bootstrap
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', async function () {
  console.log('=== LearnHub Feed Initialization Started ===');

  try {
    if (typeof api === 'undefined')       throw new Error('API helper not loaded');
    if (typeof showToast === 'undefined') window.showToast = msg => alert(msg);

    await initFeed();
    setupAllEventListeners();

    setupUnifiedDelegation();
  
    setupInfiniteScroll();
    initVideoAutoplay();
    initResourceViewer();


    window.pullToRefresh = new PullToRefresh();
    console.log('=== All systems initialized ===');

  } catch (error) {
    console.error('=== INITIALIZATION FAILED ===', error.message);
    alert('Failed to load feed: ' + error.message);
  }
});

// Expose to HTML onclick handlers
window.filterFeed        = filterFeed;
window.setupInfiniteScroll = setupInfiniteScroll;
