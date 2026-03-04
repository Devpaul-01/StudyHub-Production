// ============================================================================
// FEED SYSTEM WITH WIDGETS - Add this to your existing feed4.html
// Place this code in your <script> section or separate JS file
// ============================================================================

// ============================================================================
// API Helper
// ============================================================================
const api = {
  get: async (endpoint) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/student${endpoint}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`API Error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      return null;
    }
  }
};

// ============================================================================
// FEED CLASS - Manages posts and widgets
// ============================================================================
class PostFeed {
  constructor() {
    this.posts = {
      all: [],
      department: [],
      trending: [],
      connections: [],
      unsolved: []
    };
    
    this.currentFilter = 'all';
    this.canSolveTypes = ["problem", "question"]
    
    this.widgets = {
      suggestedConnections: [],
      popularTags: {},
      risingStars: [],
      openThreads: [],
      studyBuddyMatches: [],
      canHelp: [],
      topBadgeEarners: []
    };
    
    // Widget insertion pattern
    this.widgetOrder = [
      { id: 'suggestedConnections', every: 3 },
      { id: 'popularTags', every: 5 },
      { id: 'risingStars', every: 4 },
      { id: 'openThreads', every: 6 },
      { id: 'studyBuddyMatches', every: 7 },
      { id: 'canHelp', every: 8 },
      { id: 'topBadgeEarners', every: 9 }
    ];
    
    this.loadedFilters = {
      all: false,
      department: false,
      trending: false,
      connections: false,
      unsolved: false
    };
    
    this.widgetsLoaded = false;
  }

  // ============================================================================
  // LOAD ALL DATA
  // ============================================================================
  async loadAllData() {
    try {
      // Load all feed types in parallel
      const [allPosts, departmentPosts, trendingPosts, connectionsPosts, unsolvedPosts] = 
        await Promise.all([
          api.get('/posts/feed?filter=all'),
          api.get('/posts/feed?filter=department'),
          api.get('/posts/feed?filter=trending'),
          api.get('/posts/feed?filter=connections'),
          api.get('/posts/feed?filter=unsolved')
        ]);

      this.posts.all = allPosts?.data?.posts || [];
      this.posts.department = departmentPosts?.data?.posts || [];
      this.posts.trending = trendingPosts?.data?.posts || [];
      this.posts.connections = connectionsPosts?.data?.posts || [];
      this.posts.unsolved = unsolvedPosts?.data?.posts || [];

      // Mark all as loaded
      Object.keys(this.loadedFilters).forEach(key => {
        this.loadedFilters[key] = true;
      });

      // Load widgets (shared across all filters)
      await this.loadWidgets();

    } catch (error) {
      console.error('Error loading feed data:', error);
    }
  }

  // ============================================================================
  // LOAD WIDGETS
  // ============================================================================
  async loadWidgets() {
    if (this.widgetsLoaded) return;

    try {
      const [
        suggestedConnections,
        popularTags,
        risingStars,
        openThreads,
        studyBuddyMatches,
        canHelp,
        topBadgeEarners
      ] = await Promise.all([
        api.get('/connections/suggestions?limit=10'),
        api.get('/posts/tags'),
        api.get('/reputation/rising-stars?limit=10'),
        api.get('/threads/recommended?limit=10'),
        api.get('/study-buddy/suggestions?limit=10'),
        api.get('/threads/help/suggestions?limit=10'),
        api.get('/badges/top-earners?limit=10')
      ]);

      this.widgets.suggestedConnections = suggestedConnections?.data?.suggestions || suggestedConnections?.data || [];
      this.widgets.popularTags = popularTags?.data || {};
      this.widgets.risingStars = risingStars?.data?.rising_stars || risingStars?.data || [];
      this.widgets.openThreads = openThreads?.data?.recommendations || openThreads?.data || [];
      this.widgets.studyBuddyMatches = studyBuddyMatches?.data?.suggestions || studyBuddyMatches?.data || [];
      this.widgets.canHelp = canHelp?.data?.suggestions || canHelp?.data || [];
      this.widgets.topBadgeEarners = topBadgeEarners?.data || [];

      this.widgetsLoaded = true;
    } catch (error) {
      console.error('Error loading widgets:', error);
    }
  }

  // ============================================================================
  // RENDER FEED
  // ============================================================================
  async renderFeed(filterType) {
    this.currentFilter = filterType;
    
    // Get container
    const containerId = `feed-${filterType}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    // Show loading state
    container.innerHTML = this.getLoadingSkeleton();

    // Load data if not loaded yet
    if (!this.loadedFilters[filterType]) {
      const response = await api.get(`/posts/feed?filter=${filterType}`);
      this.posts[filterType] = response?.data?.posts || [];
      this.loadedFilters[filterType] = true;
    }

    // Load widgets if not loaded
    if (!this.widgetsLoaded) {
      await this.loadWidgets();
    }

    // Get posts for this filter
    const posts = this.posts[filterType];

    if (!posts || posts.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 3rem 1rem; text-align: center; color: var(--text-secondary);">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 1rem; opacity: 0.3;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <p>No posts found</p>
        </div>
      `;
      return;
    }

    // Render posts with widgets
    const feedHTML = this.interleaveFeed(posts);
    container.innerHTML = feedHTML;
  }

  // ============================================================================
  // INTERLEAVE POSTS WITH WIDGETS
  // ============================================================================
  interleaveFeed(posts) {
    const items = [];
    let widgetIndex = 0;

    posts.forEach((post, index) => {
      // Add post
      items.push(this.createPostCard(post));

      // Check if we should insert widgets after this post
      this.widgetOrder.forEach(({ id, every }) => {
        if ((index + 1) % every === 0 && this.hasWidgetData(id)) {
          items.push(this.createWidget(id, widgetIndex++));
        }
      });
    });

    return items.join('');
  }

  // ============================================================================
  // CHECK IF WIDGET HAS DATA
  // ============================================================================
  hasWidgetData(widgetId) {
    const data = this.widgets[widgetId];
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return false;
  }

  // ============================================================================
  // CREATE POST CARD
  // ============================================================================
  
    // Enhanced createPostCard method with proper resource handling
createPostCard(post) {
  const tags = post.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || '';
  const postTypeIcon = this.getPostTypeIcon(post.post_type);
  const canSolveType = this.canSolveTypes.includes(post.post_type);
  const comments = post.comments_data;
  
  // Build resources HTML
  let resourcesHTML = '';
  if (post.resources && post.resources.length > 0) {
    const maxDisplay = 4;
    const displayResources = post.resources.slice(0, maxDisplay);
    const remainingCount = post.resources.length - maxDisplay;
    
    const mediaItems = [];
    const documentItems = [];
    
    displayResources.forEach((resource, index) => {
      if (resource.type === "image") {
        mediaItems.push(`
          <div class="post-resource media-resource" data-type="image">
            <img src="${resource.url}" alt="${resource.filename || 'Image'}" 
                 onclick="event.stopPropagation(); viewResource('${resource.url}', 'image')">
          </div>
        `);
      } else if (resource.type === "video") {
        mediaItems.push(`
          <div class="post-resource media-resource" data-type="video">
            <video src="${resource.url}" controls 
                   onclick="event.stopPropagation()">
            </video>
          </div>
        `);
      } else {
        // Documents get separate treatment
        documentItems.push(`
          <div class="post-resource document-resource" data-type="document">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="document-name">${resource.filename || 'Document'}</span>
            <button class="download-btn" onclick="event.stopPropagation(); downloadResource('${resource.url}', '${resource.filename}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        `);
      }
    });
    
    // Add "more" indicator if there are remaining resources
    if (remainingCount > 0) {
      mediaItems.push(`
        <div class="post-resource more-resources" onclick="event.stopPropagation(); viewAllResources(${post.id})">
          <div class="more-count">+${remainingCount}</div>
          <div class="more-text">more</div>
        </div>
      `);
    }
    
    // Combine media and document sections
    if (mediaItems.length > 0) {
      resourcesHTML += `<div class="resource-container media-grid">${mediaItems.join('')}</div>`;
    }
    if (documentItems.length > 0) {
      resourcesHTML += `<div class="resource-container documents-list">${documentItems.join('')}</div>`;
    }
  }
  
  return `
    <div class="post-card" id="post-${post.id}" onclick="viewPost(${post.id})">
      <div class="post-header">
        <img src="${post.author?.avatar || '/static/default-avatar.png'}" 
             alt="${post.author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="post-author">
          <div class="post-author-name">${post.author?.name || 'Anonymous'}</div>
          <div class="post-time">${this.formatTime(post.posted_at)}</div>
        </div>
        ${post.is_solved ? '<span class="solved-badge">✓ Solved</span>' : ''}
        ${post.thread_enabled ? '<span class="thread-badge">🧵 Thread</span>' : ''}
      </div>
      
      <div class="post-type-indicator">
        ${postTypeIcon}
        <span class="post-type-label">${post.post_type}</span>
      </div>
      
      <button onclick="event.stopPropagation(); togglePostOptions(${post.id})" 
              class="post-options-btn" 
              id="options-btn-${post.id}">
        ⋯ More
      </button>
      
      <div class="advanced-post-options hidden" id="options-${post.id}">
        <button onclick="event.stopPropagation(); reportPost(${post.id})">🚩 Report Post</button>
        <button onclick="event.stopPropagation(); openForkModal(${post.id})">🔀 Fork Post</button>
        <button onclick="event.stopPropagation(); openLearnora(${post.id})">🤖 Ask Learnora</button>
        <button onclick="event.stopPropagation(); sharePost(${post.id})">📤 Share</button>
        
        ${post.thread_enabled && !post.user_interactions?.requested_thread ? 
          `<button onclick="event.stopPropagation(); joinThread(${post.id})">🧵 Join Thread</button>` : ''}
        
        ${post.is_author ? `
          ${post.is_pinned ? 
            `<button onclick="event.stopPropagation(); unpinPost(${post.id})">📌 Unpin</button>` :
            `<button onclick="event.stopPropagation(); pinPost(${post.id})">📌 Pin</button>`}
        ` : `
          ${post.user_interactions?.user_followed ?
            `<button onclick="event.stopPropagation(); unfollowPost(${post.id})">👁️ Unfollow</button>` :
            `<button onclick="event.stopPropagation(); followPost(${post.id})">👁️ Follow</button>`}
        `}
        
        ${post.user_interactions?.bookmarked ?
          `<button onclick="event.stopPropagation(); unbookmarkPost(${post.id})">🔖 Unbookmark</button>` :
          `<button onclick="event.stopPropagation(); bookmarkPost(${post.id})">🔖 Bookmark</button>`}
        
        ${!post.is_author && !post.connection_status ?
          `<button onclick="event.stopPropagation(); connectRequest(${post.author?.id})">🤝 Connect</button>` : ''}
        ${!post.is_author && post.connection_status ?
          `<button class="disabled">${post.connection_status}</button>` : ''}
        
        ${post.is_author ? `
          <button onclick="event.stopPropagation(); refinePost(${post.id})">✨ Refine Post</button>
          <button onclick="event.stopPropagation(); deletePost(${post.id})">🗑️ Delete Post</button>
          ${canSolveType ? 
            post.is_solved ?
              `<button onclick="event.stopPropagation(); markUnsolved(${post.id})">❌ Mark Unsolved</button>` :
              `<button onclick="event.stopPropagation(); markSolved(${post.id})">✅ Mark Solved</button>`
            : ''}
        ` : ''}
        
        <button onclick="event.stopPropagation(); listenPost(${post.id})">🔊 Listen (Audio)</button>
      </div>
      
      <div class="post-title">${post.title}</div>
      <div class="post-content">${post.excerpt || ''}</div>
      
      ${resourcesHTML}
      
      ${tags ? `<div class="post-tags">${tags}</div>` : ''}
      
      <div class="post-stats">
        <button class="stat-btn reaction-btn" onclick="event.stopPropagation(); toggleReactions(${post.id})">
          ${post.user_interactions?.has_reacted ?
            `<span class="post-reaction reacted>onclick="toggleLike(${post.id})"${this.getReactionType(post.user_interactions.reaction_type)} ${post.reactions_count || 0}</span>` :
            `<span onclick=toggleReaction(${post.id}, "like") class="post-like">👍 ${post.reactions_count || 0}</span>`}
        </button>
        <span onclick=openCommentModal(${post.id})class="stat-item">💬 ${post.comments_count || 0}</span>
        ${!post.user_interactions.has_bookmarked ?  && post.bookmarks_count > 0 ?
          `<span onclick=toggleBookmark(${post.id}) class="stat-item">🔖${post.bookmarks_count}</span>` : `<span class="stat-item" onclick="toggleBookmark(${post.id})">🔖</span>`}`:
          `<span onclick="UnbookmarkPost(${post.id})"🔖<span>
      </div>
    </div>
  `
  comments_data = post.comments_data;
  const html = comments_data.map(comment => {
    `img src="${comment.avatar || '/static/default-avatar.png'}" 
             alt="${comment.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">`
        <div class="comment-author">
          <div class="comment-author-name">${post.author?.name || 'Anonymous'}</div>
          <div class="comment-time">${this.formatTime(comment.posted_at)}</div>
        </div>
        ${comment.likes_count > 0
          `<button>👍</button>`:
          `<button>👍<span>${comment.likes_count}</span></button>`
        }
        ${comment.helpful_count > 0
          `<button>💡</button>`:
          `<button>💡<span>${comment.helpful_count}</span></button>`
        }
        ${comment.is_solution?
          `<button>🧠</button>`: ``
        }
  document.getElementById(`post-${post.id}`).insertAdjacentElement("beforend", html);
    
  })
}

function renderPostComments(comments){
  postComments = comments.map(comment => {
    const repliesData = comment.repliesData;
    const userInteractions = comment.user_interactions;
    const author = comment.author;
    const resources = comment.resources;
    if(repliesData || repliesData.length == 0){
      const repliesContainer = document.createElement("div");
      repliesContainer = repliesData.map(reply => {
        `<div onclick=openCommentsModal(${reply.id})class="reply-preview">
          <img src=${reply.author.avatar}><img>
          <h1>${reply.author.name}</h1>
          <h2>${reply.text_content}</h1>`
      })
    }
    if(resources && resources.length == 0){
      const resourcesHTML = document.createElement("div");
      resourcesHTML.classList.add("resou")
      let mediaItems = [];
      let documentItems = []
      resources.forEach((resource, index) => {
        if (resource.type === "image") {
        mediaItems.push(`
          <div class="comment-resource media-resource" data-type="image">
            <img src="${resource.url}" alt="${resource.filename || 'Image'}" 
                 onclick="event.stopPropagation(); viewResource('${resource.url}', 'image')">
          </div>
        `);
      } else if (resource.type === "video") {
        mediaItems.push(`
          <div class="comment-resource media-resource" data-type="video">
            <video src="${resource.url}" controls 
                   onclick="event.stopPropagation()">
            </video>
          </div>
        `);
      } else {
        // Documents get separate treatment
        documentItems.push(`
          <div class="comment-resource document-resource" data-type="document">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span class="document-name">${resource.filename || 'Document'}</span>
            <button class="download-btn" onclick="event.stopPropagation(); downloadResource('${resource.url}', '${resource.filename}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
            </button>
          </div>
        `);
      }
    });
    
    // Add "more" indicator if there are remaining resources
    if (remainingCount > 0) {
      mediaItems.push(`
        <div class="comment-resource more-resources" onclick="event.stopPropagation(); viewAllResources(${comment.id})">
          <div class="more-count">+${remainingCount}</div>
          <div class="more-text">more</div>
        </div>
      `);
    }
    
    // Combine media and document sections
    if (mediaItems.length > 0) {
      resourcesHTML += `<div class="resource-container media-grid">${mediaItems.join('')}</div>`;
    }
    if (documentItems.length > 0) {
      resourcesHTML += `<div class="resource-container documents-list">${documentItems.join('')}</div>`;
    }
  }
        }
      }
    return `
    <div data-depth=${comment.depth_level} class="comment-card" id="comment-card-${comment.id}">
      <img src="${author.avatar || '/static/default-avatar.png'}" 
             alt="${author.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="comment-author">
          <div class="comment-author-name">${author.name || 'Anonymous'}</div>
          <div class="comment-time">${this.formatTime(comment.posted_at)}</div>
        </div>
        ${comment.is_solution ? '<span class="solution-badge">✓ Solved</span>' : ''}
        ${comment.is_you && ${!comment.post_is_solved?
          <button onclick=markSolution({comment.id})>Mark Solution</button>: ''
        <span>${comment.likes_count > 0?
          <span>👍<span></span>${comment.likes_count}</span>
        ${!comment.user_interactions.has_liked?
          `<span>Like</span>`: ``
        ${comment.helpful_count > 0?
            <span>${comment.helpful_count}<span>💡</span></span>: ''
        ${!comment.user_interactions.has_marked_helpul?
          <button onclick=markHelpful(${comment.id})>Mark Helpful💡</button>
        }: ''
        ${comment.is_you?
          <span onclick=openCommentSettings(${comment.id})>...<span>: ''
        }
        <div class='comment-settings hidden>
          <button onclick=openEditModal(${comment.id})>Edit Comment</button>
          <button onclick=openDeleteModal(${comment.id})>Delete Comment</button>
        <span onclick='openReplyModal(${comment.id})'>Reply</span>
      ${resourcesHTML}
      ${repliesContainer}
      ${comment.has_more_replies?
        <button onclick=showMoreReplies(${comment.id})>View More Replies</button>
    }
  documnent.getElementById("post-commrnts-modal").appendChild(postComents);
      
      
async function showCommentModal(postId){
  const commentsModal = document.getElementById("post-comments-modal");
  commentsModal.classList.remove("hidden");
  commentsModal.innerHTML = this.getLoadingSkeleton;
  try{
    const response = await api.get(`/posts/${postId}/comments`);
    if(response.status == "success"){
      if(!response.data.comments || response.data.comments.length == 0){
        commentsModal.innerHTML = `<div class="empry-comments">No comments found for this post yet be the first to comment</div>`
        return;
      }
      renderPostComments(response.data.comments);
    }
    else{
      commentsModal.innerHTML = `<div class="error-state">Error loading post comments>
        <button class="reload-comments" onclick=showCommentModal(${postId})>Try again</button>
        </div>`
    }
  }
}

// Helper method for reaction types
getReactionType(type) {
  const postReactions = {
    like: "👍",
    love: "❤️",
    helpful: "💡",
    fire: "🔥",
    wow: "🤯",
    celebrate: "🎉",
    laugh: "😂",
    solution: "🧠"
  };
  return postReactions[type] || "❤️";
}

// Global helper functions for resource handling
function downloadResource(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function viewResource(url, type) {
  // Open resource in modal or new tab
  if (type === 'image') {
    // You can implement a lightbox here
    window.open(url, '_blank');
  } else {
    window.open(url, '_blank');
  }
}

function viewAllResources(postId) {
  // Navigate to post detail to see all resources
  viewPost(postId);
}

function togglePostOptions(postId) {
  const optionsDiv = document.getElementById(`options-${postId}`);
  if (optionsDiv) {
    optionsDiv.classList.toggle('hidden');
  }
}
    
    

  // ============================================================================
  // CREATE WIDGETS
  // ============================================================================
  createWidget(widgetId, index) {
    const widgetMap = {
      'suggestedConnections': () => this.createSuggestedConnectionsWidget(),
      'popularTags': () => this.createPopularTagsWidget(),
      'risingStars': () => this.createRisingStarsWidget(),
      'openThreads': () => this.createOpenThreadsWidget(),
      'studyBuddyMatches': () => this.createStudyBuddyWidget(),
      'canHelp': () => this.createHelpSuggestionsWidget(),
      'topBadgeEarners': () => this.createTopBadgeEarnersWidget()
    };

    return widgetMap[widgetId] ? widgetMap[widgetId]() : '';
  }

  createSuggestedConnectionsWidget() {
    const connections = this.widgets.suggestedConnections.slice(0, 10);
    const cards = connections.map(item => `
      <div class="user-card" onclick="viewProfile(${item.user?.id})">
        <img src="${item.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
        <div class="user-name">${item.user?.name}</div>
        <div class="user-bio">${item.user?.department || 'Student'}</div>
        <div class="match-score">Match: ${item.match_score}%</div>
        <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${item.user?.id})">Connect</button>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            Suggested Connections
          </h3>
          <button class="widget-action" onclick="navigateTo('connections')">See All</button>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createPopularTagsWidget() {
    const tags = Object.entries(this.widgets.popularTags).slice(0, 10);
    const cards = tags.map(([tag, count]) => `
      <div class="tag-card" onclick="searchTag('${tag}')">
        <div class="tag-icon">🏷️</div>
        <div class="tag-name">${tag}</div>
        <div class="tag-count">${count} posts</div>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
            Popular Tags
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createRisingStarsWidget() {
    const stars = this.widgets.risingStars.slice(0, 10);
    const cards = stars.map(star => `
      <div class="user-card" onclick="viewProfile(${star.user?.id})">
        <img src="${star.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
        <div class="user-name">${star.user?.name}</div>
        <div class="user-bio">${star.user?.department || 'Student'}</div>
        <div class="stat-badge">${star.trend || '📈'} +${star.weekly_gain || 0} pts</div>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
              <polyline points="17 6 23 6 23 12"></polyline>
            </svg>
            Rising Stars
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createOpenThreadsWidget() {
    const threads = this.widgets.openThreads.slice(0, 10);
    const cards = threads.map(thread => {
      const progress = (thread.member_count / thread.max_members) * 100;
      return `
        <div class="thread-card" onclick="viewThread(${thread.id})">
          <div class="thread-title">${thread.title}</div>
          <div class="thread-meta">${thread.member_count}/${thread.max_members} members</div>
          <div class="thread-progress">
            <div class="thread-progress-bar" style="width: ${progress}%"></div>
          </div>
          ${thread.recommendation_score ? `<div class="thread-score">Match: ${thread.recommendation_score}%</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
            Open Study Threads
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createStudyBuddyWidget() {
    const matches = this.widgets.studyBuddyMatches.slice(0, 10);
    const cards = matches.map(match => `
      <div class="user-card" onclick="viewProfile(${match.user?.id})">
        <img src="${match.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
        <div class="user-name">${match.user?.name}</div>
        <div class="user-bio">${match.user?.department || 'Student'}</div>
        <div class="match-score">Match: ${match.match_score}%</div>
        <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${match.user?.id})">Connect</button>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
              <line x1="9" y1="9" x2="9.01" y2="9"></line>
              <line x1="15" y1="9" x2="15.01" y2="9"></line>
            </svg>
            Study Buddy Matches
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createHelpSuggestionsWidget() {
    const suggestions = this.widgets.canHelp.slice(0, 10);
    const cards = suggestions.map(item => `
      <div class="user-card" onclick="viewProfile(${item.user?.id})">
        <img src="${item.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
        <div class="user-name">${item.user?.name}</div>
        <div class="user-bio">${item.match_details?.can_help_with?.[0] || 'Needs help'}</div>
        <div class="match-score">Match: ${item.match_details?.match_score || 0}%</div>
        <button class="connect-btn" onclick="event.stopPropagation(); offerHelp(${item.user?.id})">Offer Help</button>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
            People You Can Help
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }

  createTopBadgeEarnersWidget() {
    const earners = this.widgets.topBadgeEarners.slice(0, 10);
    const cards = earners.map(earner => `
      <div class="user-card" onclick="viewProfile(${earner.user?.id})">
        <img src="${earner.user?.avatar || '/static/default-avatar.png'}" alt="" class="user-avatar">
        <div class="user-name">${earner.user?.name}</div>
        <div class="user-bio">${earner.user?.department || 'Student'}</div>
        <div class="stat-badge">🏆 ${earner.stats?.total_badges || 0} badges</div>
      </div>
    `).join('');

    return `
      <div class="carousel-widget">
        <div class="widget-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="8" r="7"></circle>
              <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
            </svg>
            Top Badge Earners
          </h3>
        </div>
        <div class="carousel-container">${cards}</div>
      </div>
    `;
  }
  

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  getPostTypeIcon(type) {
    const icons = {
      question: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      problem: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>',
      discussion: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
      resource: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      announcement: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>'
    };
    return icons[type] || icons.discussion;
  }
formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return date.toLocaleDateString();
  }

  getLoadingSkeleton() {
    return `
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text"></div>
        </div>
        <div class="skeleton-content"></div>
      </div>
      <div class="skeleton-card">
        <div class="skeleton-header">
          <div class="skeleton-avatar"></div>
          <div class="skeleton-text"></div>
        </div>
        <div class="skeleton-content"></div>
      </div>
    `;
  }
}

// ============================================================================
// GLOBAL FUNCTIONS - Call from HTML
// ============================================================================

// Global feed instance
let feed = null;

// Initialize feed on page load
async function initFeed() {
  feed = new PostFeed();
  
  // Load all data in background
  await feed.loadAllData();
  
  // Render current filter (default: all)
  await feed.renderFeed('all');
}

// Filter feed function - called from HTML buttons
async function filterFeed(type) {
  if (!feed) {
    feed = new PostFeed();
  }
  
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.filter-btn').classList.add('active');
  
  // Hide all feed containers
  document.querySelectorAll('.posts-feed').forEach(container => {
    container.classList.remove('active');
  });
  
  // Show selected container
  const targetContainer = document.getElementById(`feed-${type}`);
  if (targetContainer) {
    targetContainer.classList.add('active');
  }
  
  // Render feed
  await feed.renderFeed(type);
}

// View post detail
function viewPost(postId) {
  // Navigate to post detail or open modal
  window.location.href = `/post/${postId}`;
}

// View user profile
function viewProfile(userId) {
  window.location.href = `/profile/${userId}`;
}

// View thread
function viewThread(threadId) {
  window.location.href = `/thread/${threadId}`;
}

// Connect with user
async function connectUser(userId) {
  try {
    const response = await api.get(`/connections/send?user_id=${userId}`);
    if (response && response.status === 'success') {
      alert('Connection request sent!');
    }
  } catch (error) {
    console.error('Connect error:', error);
  }
}

// Offer help
function offerHelp(userId) {
  // Open message modal or navigate to chat
  alert(`Opening chat with user ${userId}`);
}

// Search by tag
function searchTag(tag) {
  // Navigate to search with tag filter
  window.location.href = `/search?tag=${encodeURIComponent(tag)}`;
}

// ============================================================================
// INITIALIZE ON PAGE LOAD
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize feed if on feed section
  const feedSection = document.getElementById('feed');
  if (feedSection && feedSection.classList.contains('active')) {
    await initFeed();
  }
});

// Also init when navigating to feed
const originalNavigateTo = window.navigateTo;
window.navigateTo = async function(sectionId) {
  // Call original navigate function
  if (originalNavigateTo) {
    await originalNavigateTo(sectionId);
  }
  
  // If navigating to feed, initialize it
  if (sectionId === 'feed' && (!feed || !feed.widgetsLoaded)) {
    await initFeed();
  }
};
