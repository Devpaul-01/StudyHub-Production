/**
 * StudyHub - Enhanced Feed System
 * Production-ready feed with intelligent widget placement
 */

// ============================================================================
// FEED MANAGER CLASS
// ============================================================================

class FeedManager {
  constructor() {
    this.currentFilter = 'all';
    this.page = 1;
    this.perPage = 20;
    this.loading = false;
    this.hasMore = true;
    
    // Cache for posts by filter
    this.postsCache = {
      all: [],
      department: [],
      trending: [],
      connections: [],
      unsolved: []
    };
    
    // Cache for widgets (shared across filters)
    this.widgetsCache = {
      topContributors: null,
      studyBuddyMatches: null,
      suggestedConnections: null,
      popularTags: null,
      openThreads: null,
      trendingPosts: null,
      lastUpdated: null
    };
    
    // Widget refresh interval (5 minutes)
    this.WIDGET_REFRESH_INTERVAL = 5 * 60 * 1000;
    
    this.init();
  }
  
  init() {
    this.setupFilterButtons();
    this.setupInfiniteScroll();
    this.loadInitialFeed();
  }
  
  // ============================================================================
  // FILTER MANAGEMENT
  // ============================================================================
  
  setupFilterButtons() {
    const filterButtons = document.querySelectorAll('[data-filter]');
    
    filterButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = e.target.dataset.filter;
        this.switchFilter(filter);
      });
    });
  }
  
  switchFilter(filter) {
    if (this.loading) return;
    
    // Update active button
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    
    // Hide all feed containers
    document.querySelectorAll('.feed-posts-container').forEach(container => {
      container.classList.remove('active');
    });
    
    // Show selected container
    const targetContainer = document.getElementById(`feed-${filter}`);
    if (targetContainer) {
      targetContainer.classList.add('active');
    }
    
    this.currentFilter = filter;
    this.page = 1;
    
    // Load data if not cached
    if (this.postsCache[filter].length === 0) {
      this.loadPosts(filter, 1);
    }
    
    // Load widgets if not cached or stale
    this.loadWidgetsIfNeeded();
  }
  
  // ============================================================================
  // POST LOADING
  // ============================================================================
  
  async loadInitialFeed() {
    try {
      // Load first page of posts AND widgets in parallel
      await Promise.all([
        this.loadPosts('all', 1),
        this.loadAllWidgets()
      ]);
      
      this.renderFeed('all');
    } catch (error) {
      console.error('Failed to load initial feed:', error);
      this.showError('Failed to load feed. Please refresh the page.');
    }
  }
  
  async loadPosts(filter, page) {
    if (this.loading) return;
    
    this.loading = true;
    this.showLoadingIndicator();
    
    try {
      const response = await api.get(`/posts/feed?filter=${filter}&page=${page}&per_page=${this.perPage}`);
      
      if (response.status === 'success') {
        const posts = response.data.posts;
        const pagination = response.data.pagination;
        
        // Cache posts
        if (page === 1) {
          this.postsCache[filter] = posts;
        } else {
          this.postsCache[filter].push(...posts);
        }
        
        this.hasMore = pagination.page < pagination.pages;
        this.page = page;
        
        return posts;
      }
    } catch (error) {
      console.error(`Error loading ${filter} posts:`, error);
      throw error;
    } finally {
      this.loading = false;
      this.hideLoadingIndicator();
    }
  }
  
  // ============================================================================
  // WIDGET LOADING
  // ============================================================================
  
  async loadWidgetsIfNeeded() {
    const now = Date.now();
    const lastUpdate = this.widgetsCache.lastUpdated;
    
    // Refresh if cache is older than 5 minutes
    if (!lastUpdate || (now - lastUpdate) > this.WIDGET_REFRESH_INTERVAL) {
      await this.loadAllWidgets();
    }
  }
  
  async loadAllWidgets() {
    try {
      // Load all widgets in parallel for performance
      const [
        topContributors,
        studyBuddies,
        connections,
        tags,
        threads,
        trending
      ] = await Promise.all([
        this.loadTopContributors(),
        this.loadStudyBuddyMatches(),
        this.loadSuggestedConnections(),
        this.loadPopularTags(),
        this.loadOpenThreads(),
        this.loadTrendingPosts()
      ]);
      
      // Update cache
      this.widgetsCache = {
        topContributors,
        studyBuddyMatches: studyBuddies,
        suggestedConnections: connections,
        popularTags: tags,
        openThreads: threads,
        trendingPosts: trending,
        lastUpdated: Date.now()
      };
      
      return this.widgetsCache;
    } catch (error) {
      console.error('Error loading widgets:', error);
      throw error;
    }
  }
  
  async loadTopContributors() {
    try {
      const response = await api.get('/reputation/rising-stars?limit=5');
      return response.status === 'success' ? response.data.rising_stars || [] : [];
    } catch (error) {
      console.error('Error loading top contributors:', error);
      return [];
    }
  }
  
  async loadStudyBuddyMatches() {
    try {
      const response = await api.get('/study-buddy/suggestions?limit=5');
      return response.status === 'success' ? response.data.suggestions || [] : [];
    } catch (error) {
      console.error('Error loading study buddy matches:', error);
      return [];
    }
  }
  
  async loadSuggestedConnections() {
    try {
      const response = await api.get('/connections/suggestions?limit=5');
      return response.status === 'success' ? response.data.suggestions || [] : [];
    } catch (error) {
      console.error('Error loading suggested connections:', error);
      return [];
    }
  }
  
  async loadPopularTags() {
    try {
      const response = await api.get('/posts/tags');
      if (response.status === 'success') {
        // Convert object to array and take top 10
        const tagsObj = response.data;
        return Object.entries(tagsObj)
          .map(([tag, count]) => ({ tag, count }))
          .slice(0, 10);
      }
      return [];
    } catch (error) {
      console.error('Error loading popular tags:', error);
      return [];
    }
  }
  
  async loadOpenThreads() {
    try {
      const response = await api.get('/threads/recommended?limit=5');
      return response.status === 'success' ? response.data.recommendations || [] : [];
    } catch (error) {
      console.error('Error loading open threads:', error);
      return [];
    }
  }
  
  async loadTrendingPosts() {
    try {
      const response = await api.get('/search/posts/trending?limit=5');
      return response.status === 'success' ? response.data.trending_posts || [] : [];
    } catch (error) {
      console.error('Error loading trending posts:', error);
      return [];
    }
  }
  
  // ============================================================================
  // FEED RENDERING
  // ============================================================================
  
  renderFeed(filter) {
    const container = document.getElementById(`feed-${filter}`);
    if (!container) return;
    
    container.innerHTML = '';
    
    const posts = this.postsCache[filter];
    const widgets = this.widgetsCache;
    
    // Intelligent widget placement strategy:
    // - Widget after every 3-4 posts
    // - Different widget types in rotation
    // - Most engaging widgets first
    
    const widgetSequence = [
      'studyBuddies',      // After 3 posts (most valuable)
      'connections',       // After 6 posts
      'trending',          // After 9 posts
      'tags',             // After 12 posts
      'threads',          // After 15 posts
      'contributors'      // After 18 posts
    ];
    
    let widgetIndex = 0;
    
    posts.forEach((post, index) => {
      // Render post
      container.appendChild(this.createPostCard(post));
      
      // Insert widget after every 3 posts
      if ((index + 1) % 3 === 0 && widgetIndex < widgetSequence.length) {
        const widgetType = widgetSequence[widgetIndex];
        const widgetElement = this.createWidget(widgetType, widgets);
        
        if (widgetElement) {
          container.appendChild(widgetElement);
        }
        
        widgetIndex++;
      }
    });
    
    // Add "Load More" button if has more posts
    if (this.hasMore) {
      container.appendChild(this.createLoadMoreButton(filter));
    }
  }
  
  // ============================================================================
  // POST CARD CREATION
  // ============================================================================
  
  createPostCard(post) {
    const card = document.createElement('div');
    card.className = 'post-card';
    card.dataset.postId = post.id;
    
    // Click to view post details
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.post-actions')) {
        window.location.href = `/student/posts/${post.id}`;
      }
    });
    
    card.innerHTML = `
      <div class="post-header">
        <div class="avatar" style="background: ${this.getAvatarColor(post.author?.name)}">
          ${post.author?.avatar ? `<img src="${post.author.avatar}" alt="${post.author.name}">` : this.getInitials(post.author?.name)}
        </div>
        <div class="post-author">
          <div class="post-author-name">${post.author?.name || 'Unknown'}</div>
          <div class="post-time">${this.formatTime(post.posted_at)}</div>
        </div>
        ${post.post_type !== 'discussion' ? `<span class="post-type-badge post-type-${post.post_type}">${post.post_type}</span>` : ''}
      </div>
      
      <div class="post-content">
        <h3 class="post-title">${this.escapeHtml(post.title)}</h3>
        ${post.excerpt ? `<p class="post-excerpt">${this.escapeHtml(post.excerpt).substring(0, 200)}${post.excerpt.length > 200 ? '...' : ''}</p>` : ''}
        
        ${post.tags && post.tags.length > 0 ? `
          <div class="post-tags">
            ${post.tags.slice(0, 3).map(tag => `<span class="tag">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      
      <div class="post-actions">
        <button class="post-action" onclick="event.stopPropagation(); feedManager.handleReaction(${post.id}, '${post.user_interaction?.reaction_type || ''}')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${post.user_interaction?.reaction_type ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="M7 10v12"></path>
            <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path>
          </svg>
          ${post.reactions_count || 0}
        </button>
        
        <button class="post-action" onclick="event.stopPropagation(); window.location.href='/student/posts/${post.id}#comments'">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          ${post.comments_count || 0}
        </button>
        
        <button class="post-action" onclick="event.stopPropagation(); feedManager.handleBookmark(${post.id}, ${post.user_interaction?.bookmarked || false})">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${post.user_interaction?.bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
            <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          ${post.user_interaction?.bookmarked ? 'Saved' : 'Save'}
        </button>
      </div>
    `;
    
    return card;
  }
  
  // ============================================================================
  // WIDGET CREATION
  // ============================================================================
  
  createWidget(type, widgets) {
    const widgetContainer = document.createElement('div');
    widgetContainer.className = 'carousel-section';
    
    let widgetContent = '';
    let widgetData = [];
    let title = '';
    let actionText = 'See All';
    let actionLink = '#';
    
    switch (type) {
      case 'studyBuddies':
        widgetData = widgets.studyBuddyMatches || [];
        title = '🎓 Study Buddy Matches';
        actionLink = '/student/study-buddy';
        widgetContent = widgetData.map(match => this.createStudyBuddyCard(match)).join('');
        break;
        
      case 'connections':
        widgetData = widgets.suggestedConnections || [];
        title = '👥 Suggested Connections';
        actionLink = '/student/connections/suggestions';
        widgetContent = widgetData.map(user => this.createConnectionCard(user)).join('');
        break;
        
      case 'trending':
        widgetData = widgets.trendingPosts || [];
        title = '🔥 Trending Now';
        actionLink = '/student/search?sort=trending';
        widgetContent = widgetData.map(post => this.createTrendingPostCard(post)).join('');
        break;
        
      case 'tags':
        widgetData = widgets.popularTags || [];
        title = '🏷️ Popular Tags';
        actionLink = '/student/search';
        widgetContent = widgetData.map(tag => this.createTagCard(tag)).join('');
        break;
        
      case 'threads':
        widgetData = widgets.openThreads || [];
        title = '🧵 Open Study Threads';
        actionLink = '/student/threads';
        widgetContent = widgetData.map(thread => this.createThreadCard(thread)).join('');
        break;
        
      case 'contributors':
        widgetData = widgets.topContributors || [];
        title = '⭐ Top Contributors';
        actionLink = '/student/reputation/leaderboard';
        widgetContent = widgetData.map(user => this.createContributorCard(user)).join('');
        break;
    }
    
    // Skip empty widgets
    if (widgetData.length === 0) {
      return null;
    }
    
    widgetContainer.innerHTML = `
      <div class="carousel-header">
        <h3 class="carousel-title">${title}</h3>
        <a href="${actionLink}" class="carousel-action">${actionText}</a>
      </div>
      <div class="carousel-container" id="carousel-${type}">
        ${widgetContent}
      </div>
      <div class="carousel-nav">
        <button class="carousel-nav-btn" onclick="feedManager.scrollCarousel('carousel-${type}', -1)">←</button>
        <button class="carousel-nav-btn" onclick="feedManager.scrollCarousel('carousel-${type}', 1)">→</button>
      </div>
    `;
    
    return widgetContainer;
  }
  
  createStudyBuddyCard(match) {
    return `
      <div class="user-card" onclick="window.location.href='/student/profile/${match.user.id}'">
        <div class="user-avatar" style="background: ${this.getAvatarColor(match.user.name)}">
          ${match.user.avatar ? `<img src="${match.user.avatar}" alt="${match.user.name}">` : this.getInitials(match.user.name)}
        </div>
        <div class="user-name">${match.user.name}</div>
        <div class="user-bio">${match.match_score}% match</div>
        <div class="user-meta">${match.preferences?.good_at?.slice(0, 2).join(', ') || 'Study buddy'}</div>
        <button class="connect-btn" onclick="event.stopPropagation(); feedManager.sendStudyBuddyRequest(${match.user.id})">
          Connect
        </button>
      </div>
    `;
  }
  
  createConnectionCard(user) {
    return `
      <div class="user-card" onclick="window.location.href='/student/profile/${user.user.id}'">
        <div class="user-avatar" style="background: ${this.getAvatarColor(user.user.name)}">
          ${user.user.avatar ? `<img src="${user.user.avatar}" alt="${user.user.name}">` : this.getInitials(user.user.name)}
        </div>
        <div class="user-name">${user.user.name}</div>
        <div class="user-bio">${user.user.department || ''}</div>
        <div class="user-meta">${user.match_score}% match</div>
        <button class="connect-btn" onclick="event.stopPropagation(); feedManager.sendConnectionRequest(${user.user.id})">
          Connect
        </button>
      </div>
    `;
  }
  
  createTrendingPostCard(post) {
    return `
      <div class="thread-card" onclick="window.location.href='/student/posts/${post.id}'">
        <div class="thread-title">${this.escapeHtml(post.title)}</div>
        <div class="thread-meta">${post.likes_count || 0} likes · ${post.comments_count || 0} comments</div>
        <div class="thread-progress">
          <div class="thread-progress-bar" style="width: ${Math.min((post.views / 100) * 100, 100)}%"></div>
        </div>
      </div>
    `;
  }
  
  createTagCard(tag) {
    return `
      <div class="tag-card" onclick="window.location.href='/student/search?tags=${encodeURIComponent(tag.tag)}'">
        <div class="tag-icon">#</div>
        <div class="tag-name">${tag.tag}</div>
        <div class="tag-count">${tag.count} posts</div>
      </div>
    `;
  }
  
  createThreadCard(thread) {
    return `
      <div class="thread-card" onclick="window.location.href='/student/threads/${thread.id}'">
        <div class="thread-title">${this.escapeHtml(thread.title)}</div>
        <div class="thread-meta">${thread.member_count}/${thread.max_members} members</div>
        <div class="thread-progress">
          <div class="thread-progress-bar" style="width: ${(thread.member_count / thread.max_members) * 100}%"></div>
        </div>
      </div>
    `;
  }
  
  createContributorCard(user) {
    return `
      <div class="user-card" onclick="window.location.href='/student/profile/${user.user.id}'">
        <div class="user-avatar" style="background: ${this.getAvatarColor(user.user.name)}">
          ${user.user.avatar ? `<img src="${user.user.avatar}" alt="${user.user.name}">` : this.getInitials(user.user.name)}
        </div>
        <div class="user-name">${user.user.name}</div>
        <div class="user-bio">${user.user.reputation_level}</div>
        <div class="user-meta">+${user.weekly_gain} this week ${user.trend}</div>
      </div>
    `;
  }
  
  // ============================================================================
  // INFINITE SCROLL
  // ============================================================================
  
  setupInfiniteScroll() {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && this.hasMore && !this.loading) {
          this.loadMore();
        }
      });
    }, { threshold: 0.5 });
    
    // Observe each feed container
    document.querySelectorAll('.feed-posts-container').forEach(container => {
      observer.observe(container);
    });
  }
  
  async loadMore() {
    const nextPage = this.page + 1;
    const posts = await this.loadPosts(this.currentFilter, nextPage);
    
    if (posts && posts.length > 0) {
      this.appendPosts(posts, this.currentFilter);
    }
  }
  
  appendPosts(posts, filter) {
    const container = document.getElementById(`feed-${filter}`);
    if (!container) return;
    
    // Remove "Load More" button if exists
    const loadMoreBtn = container.querySelector('.load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.remove();
    }
    
    // Append new posts
    posts.forEach(post => {
      container.appendChild(this.createPostCard(post));
    });
    
    // Add back "Load More" if has more
    if (this.hasMore) {
      container.appendChild(this.createLoadMoreButton(filter));
    }
  }
  
  createLoadMoreButton(filter) {
    const btn = document.createElement('button');
    btn.className = 'load-more-btn';
    btn.textContent = 'Load More Posts';
    btn.onclick = () => this.loadMore();
    return btn;
  }
  
  // ============================================================================
  // USER ACTIONS
  // ============================================================================
  
  async handleReaction(postId, currentReaction) {
    try {
      const reaction = currentReaction || 'like';
      const response = await api.post(`/posts/${postId}/react`, { reaction });
      
      if (response.status === 'success') {
        // Update UI
        this.updatePostReactionUI(postId, !currentReaction);
      }
    } catch (error) {
      console.error('Error reacting to post:', error);
    }
  }
  
  async handleBookmark(postId, isBookmarked) {
    try {
      const method = isBookmarked ? 'delete' : 'post';
      const response = await api[method](`/posts/${postId}/bookmark`);
      
      if (response.status === 'success') {
        this.updatePostBookmarkUI(postId, !isBookmarked);
      }
    } catch (error) {
      console.error('Error bookmarking post:', error);
    }
  }
  
  async sendConnectionRequest(userId) {
    try {
      const response = await api.post(`/connections/request/${userId}`);
      
      if (response.status === 'success') {
        alert('Connection request sent!');
        // Refresh connections widget
        this.widgetsCache.suggestedConnections = await this.loadSuggestedConnections();
        this.renderFeed(this.currentFilter);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send connection request');
    }
  }
  
  async sendStudyBuddyRequest(userId) {
    try {
      const response = await api.post(`/study-buddy/request/${userId}`);
      
      if (response.status === 'success') {
        alert('Study buddy request sent!');
        // Refresh study buddy widget
        this.widgetsCache.studyBuddyMatches = await this.loadStudyBuddyMatches();
        this.renderFeed(this.currentFilter);
      }
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to send study buddy request');
    }
  }
  
  updatePostReactionUI(postId, liked) {
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (!card) return;
    
    const likeBtn = card.querySelector('.post-action');
    const svg = likeBtn.querySelector('svg');
    const countText = likeBtn.childNodes[2];
    
    svg.setAttribute('fill', liked ? 'currentColor' : 'none');
    
    const currentCount = parseInt(countText.textContent);
    countText.textContent = liked ? currentCount + 1 : currentCount - 1;
  }
  
  updatePostBookmarkUI(postId, bookmarked) {
    const card = document.querySelector(`[data-post-id="${postId}"]`);
    if (!card) return;
    
    const bookmarkBtn = card.querySelectorAll('.post-action')[2];
    const svg = bookmarkBtn.querySelector('svg');
    const text = bookmarkBtn.childNodes[2];
    
    svg.setAttribute('fill', bookmarked ? 'currentColor' : 'none');
    text.textContent = bookmarked ? ' Saved' : ' Save';
  }
  
  // ============================================================================
  // CAROUSEL CONTROLS
  // ============================================================================
  
  scrollCarousel(carouselId, direction) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const scrollAmount = 220;
    carousel.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  }
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  getInitials(name) {
    if (!name) return '?';
    return name.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  }
  
  getAvatarColor(name) {
    if (!name) return '#6366f1';
    
    const colors = [
      '#6366f1', '#8b5cf6', '#10b981', 
      '#f59e0b', '#ef4444', '#3b82f6'
    ];
    
    const hash = name.split('').reduce((acc, char) => {
      return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);
    
    return colors[Math.abs(hash) % colors.length];
  }
  
  formatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const diff = now - date;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  showLoadingIndicator() {
    // Add loading spinner to current container
    const container = document.getElementById(`feed-${this.currentFilter}`);
    if (!container) return;
    
    const loader = document.createElement('div');
    loader.className = 'feed-loader';
    loader.innerHTML = '<div class="spinner"></div>';
    container.appendChild(loader);
  }
  
  hideLoadingIndicator() {
    const loader = document.querySelector('.feed-loader');
    if (loader) {
      loader.remove();
    }
  }
  
  showError(message) {
    // Show error toast
    alert(message);
  }
}

// ============================================================================
// INITIALIZE
// ============================================================================

let feedManager;

document.