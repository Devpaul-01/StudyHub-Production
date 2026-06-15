/**
 * ============================================================================
 * FEED STATE MANAGEMENT
 * Centralized state - no DOM manipulation here
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
    
    // Widget data
    this.widgets = {
      suggestedConnections: [],
      popularTags: {},
      risingStars: [],
      openThreads: [],
      studyBuddyMatches: [],
      canHelp: [],
      topBadgeEarners: []
    };
    
    // Loading states
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
    this.replyFiles = [];
    this.postResources = [];
    this.postFiles = [];
    this.threadAvatarResource = [];
    this.currentRefinement = null;
    this.selectedPosts = new Set();
    this.isHighlightMode = false;
    
    // Interaction state
    this.longPressTimer = null;
    this.longPressTimeout = null;
    this.reactionBtn = null;
    this.viewObserver = null;
  }

  // Post methods
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

  // Widget methods
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

  // Fork tags methods
  addForkTag(tag) {
    if (!this.selectedForkTags.includes(tag)) {
      this.selectedForkTags.push(tag);
      return true;
    }
    return false;
  }
  addTag(tag){
    if(!this.selectedPostTags.includes(tag)){
      this.selectedPostTags.push(tag);
      return true;
    }
    return false;
  }
  addThreadTag(tag){
    if(!this.selectedThreadTags.includes(tag)){
      this.selectedThreadTags.push(tag);
      return true;
    }
    return false;
    
  }

  removeForkTag(tag) {
    this.selectedForkTags = this.selectedForkTags.filter(t => t !== tag);
  }
  removeTag(tag){
  this.selectedPostTags = this.selectedPostTags.filter(t => t !== tag);
  }
  removeThreadTag(tag) {
    this.selectedThreadTags = this.selectedThreadTags.filter(t => t !== tag);
  }
  getPostFilesUrl(){
    return this.postFilesUrl;
  }
  
  getPostResources(){
    return this.postResources;
  }

  clearForkTags() {
    this.selectedForkTags = [];
  }

  getForkTags() {
    return this.selectedForkTags;
  }
  getPostTags(){
    return this.selectedPostTags;
  }
  getThreadTags(){
    return this.selectedThreadTags;
  }

  // Reply resources methods
  addReplyResource(resource) {
    this.replyResources.push(resource);
  }
  addPostResources(resource){
    this.postResources.push(resource);
  }
  removePostResource(url){
    this.postResources = this.postResources.filter(resource => resource.url != url);
  }

  clearReplyResources() {
    this.replyUrls = [];
    this.replyResources = [];
    this.replyFiles = [];
  }

  getReplyResources() {
    return this.replyResources;
  }

  removeReplyResource(url) {
    this.replyResources = this.replyResources.filter(r => r.url !== url);
  }

  // Refinement methods
  setCurrentRefinement(refinement) {
    this.currentRefinement = refinement;
  }

  getCurrentRefinement() {
    return this.currentRefinement;
  }

  clearRefinement() {
    this.currentRefinement = null;
  }

  // Bulk selection methods
  togglePostSelection(postId) {
    if (this.selectedPosts.has(postId)) {
      this.selectedPosts.delete(postId);
    } else {
      this.selectedPosts.add(postId);
    }
  }

  clearSelectedPosts() {
    this.selectedPosts.clear();
  }

  getSelectedPosts() {
    return Array.from(this.selectedPosts);
  }

  hasSelectedPosts() {
    return this.selectedPosts.size > 0;
  }

  setHighlightMode(enabled) {
    this.isHighlightMode = enabled;
  }

  isInHighlightMode() {
    return this.isHighlightMode;
  }

  // Long press handlers
  setLongPressTimer(timer) {
    this.longPressTimer = timer;
  }

  clearLongPressTimer() {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  setLongPressTimeout(timeout) {
    this.longPressTimeout = timeout;
  }

  clearLongPressTimeout() {
    if (this.longPressTimeout) {
      clearTimeout(this.longPressTimeout);
      this.longPressTimeout = null;
    }
  }
  setThreadAvatar(resource){
    this.threadAvatarResource = resource;
  }

  // Reaction button reference
  setReactionBtn(btn) {
    this.reactionBtn = btn;
  }

  getReactionBtn() {
    return this.reactionBtn;
  }

  // View observer
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

  // Reset all state
  reset() {
    this.posts = {
      all: [],
      department: [],
      trending: [],
      connections: [],
      unsolved: []
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
    this.clearSelectedPosts();
    this.setHighlightMode(false);
    this.clearLongPressTimer();
    this.clearLongPressTimeout();
  }
}

// Export singleton instance
export const feedState = new FeedState();