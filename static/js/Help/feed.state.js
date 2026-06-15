/**
 * ============================================================================
 * FEED STATE MANAGEMENT - PRODUCTION READY
 * REMOVED: All bookmarking logic
 * ============================================================================
 */

import { FEED_FILTERS } from './feed.constants.js';

class FeedState {
  constructor() {
    // Post data by filter
    this.posts = {
      all: [],
      department: [],
      trending: [],
      connections: [],
      unsolved: []
    };
    
    // Pagination state per filter
    this.pagination = {
      all: { page: 1, hasNext: true, loading: false },
      department: { page: 1, hasNext: true, loading: false },
      trending: { page: 1, hasNext: true, loading: false },
      connections: { page: 1, hasNext: true, loading: false },
      unsolved: { page: 1, hasNext: true, loading: false }
    };
    
    this.widgets = {
      suggestedConnections: [],
      popularTags: {},
      risingStars: [],
      openThreads: [],
      studyBuddyMatches: [],
      canHelp: [],
      topBadgeEarners: []
    };
    
    this.loadedFilters = {
      all: false,
      department: false,
      trending: false,
      connections: false,
      unsolved: false
    };
    
    this.widgetsLoaded = false;
    this.currentFilter = FEED_FILTERS.ALL;
    
    // UI state
    this.selectedPostTags = [];
    this.selectedThreadTags = [];
    this.selectedForkTags = [];
    this.replyResources = [];
    this.postResources = [];
    this.threadAvatarResource = null;
    this.currentRefinement = null;
    this.commentModalHistory = [];
    
    this.longPressTimer = null;
    this.reactionBtn = null;
    this.originalTitle = null;
    this.originalContent = null;
    this.viewObserver = null;
    this.currentScrollResources = [];
  }
  
  // Pagination methods
  getPaginationState(filter) {
    return this.pagination[filter] || { page: 1, hasNext: true, loading: false };
  }
  
  setPaginationState(filter, state) {
    this.pagination[filter] = { ...this.pagination[filter], ...state };
  }
  
  incrementPage(filter) {
    this.pagination[filter].page++;
  }
  
  resetPagination(filter) {
    this.pagination[filter] = { page: 1, hasNext: true, loading: false };
  }
  
  setPaginationLoading(filter, loading) {
    this.pagination[filter].loading = loading;
  }
  
  appendPosts(filter, newPosts) {
    this.posts[filter] = [...this.posts[filter], ...newPosts];
  }
  
  setPosts(filter, posts) {
    this.posts[filter] = posts;
    this.loadedFilters[filter] = true;
  }

  getPosts(filter) {
    return this.posts[filter] || [];
  }

  setCurrentFilter(filter) {
    this.currentFilter = filter;
  }

  getCurrentFilter() {
    return this.currentFilter;
  }
  
  isFilterLoaded(filter) {
    return this.loadedFilters[filter];
  }
  
  setCommentModalHistory(history) {
    this.commentModalHistory.push(history);
  }
  
  getCommentModalHistory() {
    return this.commentModalHistory;
  }
  
  clearCommentModalHistory() {
    this.commentModalHistory = [];
  }
  
  setWidgets(widgetData) {
    Object.assign(this.widgets, widgetData);
    this.widgetsLoaded = true;
  }

  getWidgets() {
    return this.widgets;
  }

  areWidgetsLoaded() {
    return this.widgetsLoaded;
  }
  
  addForkTag(tag) {
    if (!this.selectedForkTags.includes(tag)) {
      this.selectedForkTags.push(tag);
      return true;
    }
    return false;
  }
  
  addPostTag(tag) {
    if (!this.selectedPostTags.includes(tag)) {
      this.selectedPostTags.push(tag);
      return true;
    }
    return false;
  }
  
  addThreadTag(tag) {
    if (!this.selectedThreadTags.includes(tag)) {
      this.selectedThreadTags.push(tag);
      return true;
    }
    return false;
  }

  removeForkTag(tag) {
    this.selectedForkTags = this.selectedForkTags.filter(t => t !== tag);
  }
  
  removePostTag(tag) {
    this.selectedPostTags = this.selectedPostTags.filter(t => t !== tag);
  }
  
  removeThreadTag(tag) {
    this.selectedThreadTags = this.selectedThreadTags.filter(t => t !== tag);
  }
  
  getPostResources() {
    return this.postResources;
  }

  clearForkTags() {
    this.selectedForkTags = [];
  }

  getForkTags() {
    return this.selectedForkTags;
  }
  
  getPostTags() {
    return this.selectedPostTags;
  }
  
  getThreadTags() {
    return this.selectedThreadTags;
  }
  
  addReplyResource(resource) {
    this.replyResources.push(resource);
  }
  
  addPostResource(resource) {
    this.postResources.push(resource);
  }
  
  removePostResource(url) {
    this.postResources = this.postResources.filter(resource => resource.url !== url);
  }

  clearReplyResources() {
    this.replyResources = [];
  }

  getReplyResources() {
    return this.replyResources;
  }

  removeReplyResource(url) {
    this.replyResources = this.replyResources.filter(r => r.url !== url);
  }
  
  setCurrentRefinement(refinement) {
    this.currentRefinement = refinement;
  }

  getCurrentRefinement() {
    return this.currentRefinement;
  }

  clearRefinement() {
    this.currentRefinement = null;
  }
  
  clearPostTags() {
    this.selectedPostTags = [];
  }
  
  clearThreadTags() {
    this.selectedThreadTags = [];
  }
  
  clearPostResources() {
    this.postResources = [];
  }
  
  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }
  
  getThreadResource() {
    return this.threadAvatarResource;
  }
  
  setThreadAvatar(resource) {
    this.threadAvatarResource = resource;
  }
  
  setReactionBtn(btn) {
    this.reactionBtn = btn;
  }

  getReactionBtn() {
    return this.reactionBtn;
  }
  
  setViewObserver(observer) {
    this.viewObserver = observer;
  }

  getViewObserver() {
    return this.viewObserver;
  }

  disconnectViewObserver() {
    if (this.viewObserver) {
      this.viewObserver.disconnect();
    }
  }
  
  setOriginalTitle(title) {
    this.originalTitle = title;
  }
  
  getOriginalTitle() {
    return this.originalTitle;
  }
  
  setOriginalContent(content) {
    this.originalContent = content;
  }
  
  getOriginalContent() {
    return this.originalContent;
  }
  
  setCurrentScrollResources(resources) {
    this.currentScrollResources = resources;
  }
  
  getCurrentScrollResources() {
    return this.currentScrollResources;
  }
  
  getCurrentPosts() {
    return this.posts;
  }

  reset() {
    this.posts = {
      all: [],
      department: [],
      trending: [],
      connections: [],
      unsolved: []
    };
    
    this.pagination = {
      all: { page: 1, hasNext: true, loading: false },
      department: { page: 1, hasNext: true, loading: false },
      trending: { page: 1, hasNext: true, loading: false },
      connections: { page: 1, hasNext: true, loading: false },
      unsolved: { page: 1, hasNext: true, loading: false }
    };
    
    this.loadedFilters = {
      all: false,
      department: false,
      trending: false,
      connections: false,
      unsolved: false
    };
    
    this.widgetsLoaded = false;
    this.currentFilter = FEED_FILTERS.ALL;
    this.clearForkTags();
    this.clearReplyResources();
    this.clearRefinement();
    this.clearLongPressTimer();
  }
}

export const feedState = new FeedState();