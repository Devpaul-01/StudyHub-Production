// ============================================================================
// FEED SYSTEM WITH WIDGETS - Refined Version
// ============================================================================

// ============================================================================
// API Helper
// ============================================================================
<html>
  
</html>
<script>
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
    this.canSolveTypes = ["problem", "question"];
    
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

      Object.keys(this.loadedFilters).forEach(key => {
        this.loadedFilters[key] = true;
      });

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
    const containerId = `feed-${filterType}`;
    const container = document.getElementById(containerId);
    
    if (!container) {
      console.error(`Container ${containerId} not found`);
      return;
    }

    container.innerHTML = this.getLoadingSkeleton();

    if (!this.loadedFilters[filterType]) {
      const response = await api.get(`/posts/feed?filter=${filterType}`);
      this.posts[filterType] = response?.data?.posts || [];
      this.loadedFilters[filterType] = true;
    }

    if (!this.widgetsLoaded) {
      await this.loadWidgets();
    }

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

    const feedHTML = this.interleaveFeed(posts);
    container.innerHTML = feedHTML;
  }
  renderBookmarkFolders(folders){
    const bookmarkModal = document.getElementById("bookmark-folders-modal");
    if(folders){
      folders.forEach(folder =>{
        const div = document.createElement("div");
        div.classList.add("bookmark-folder");
        div.textContent = folder;
        div.dataset.value = folder;
        bookmarkModal.appendChild(div);
      });
    }
    if(!folders || folders.length == 0){
      const div = document.createElement("div");
      div.classList.add("bookmark-folder");
      div.textContent = "Saved";
      div.dataset.value = "Saved";
      bookmarkModal.appendChild(div);
    }
    const btn = document.createElement('button');
    btn.textContent = "Cancel";
    btn.onclick = () => {
      closeModal("bookmark-folders-modal");
    };
    bookmarkModal.appendChild(btn);
  }
  
  async getBookmarkFolders(){
    const bookmarkModal = document.getElementById("bookmark-folders-modal");
    try{
      const response = await api.get("/posts/folders");
      if(response.status == "success"){
        const data = response.data;
        return data;
      }
      else{
        showToast(response.message, "error");
      }
    }
    catch(error){
      bookmarkModal.innerHTML = `<div class="error-state">Error loading bookmark folders</div>`;
    }
  }

  // ============================================================================
  // INTERLEAVE POSTS WITH WIDGETS
  // ============================================================================
  interleaveFeed(posts) {
    const items = [];
    let widgetIndex = 0;

    posts.forEach((post, index) => {
      items.push(this.createPostCard(post));

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
  createPostCard(post) {
    const tags = post.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || '';
    const postTypeIcon = this.getPostTypeIcon(post.post_type);
    const canSolveType = this.canSolveTypes.includes(post.post_type);
    
    // Build resources HTML
    let resourcesHTML = this.buildResourcesHTML(post.resources, post.id);
    
    // Build comment previews HTML
    let commentsPreviewHTML = this.buildCommentsPreviewHTML(post.comments, post.id);
    
    return `
      <div data-post-id=${post.id} class="post-card" data-id="post-${post.id}">
        <div class="post-header">
          <img onclick='viewProfile(${post.author.username})' src="${post.author?.avatar || '/static/default-avatar.png'}" 
               alt="${post.author?.name}" 
               class="avatar" 
               onerror="this.src='/static/default-avatar.png'">
          <div class="post-author">
            <div onclick='viewProfile(`${post.author.username}`)' class="post-author-name">${post.author?.name || 'Anonymous'}</div>
            <div class="post-time">${this.formatTime(post.posted_at)}</div>
          </div>
          ${post.is_solved ? '<span class="solved-badge">✓ Solved</span>' : ''}
          ${post.thread_enabled ? '<span class="thread-badge">🧵 Thread</span>' : ''}
          ${!post.is_author && !post.connection_status ?
          `<button onclick="event.stopPropagation(); connectRequest(${post.author?.id})">🤝 Connect</button>` : ''}
        </div>
        
        <div class="post-type-indicator">
          ${postTypeIcon}
          <span class="post-type-label">${post.post_type}</span>
        </div>
        
        <button onclick="event.stopPropagation(); togglePostOptions(${post.id})" 
                class="post-options-btn" 
                id="options-btn-${post.id}">
          ⋯
        </button>
        
        ${this.buildPostOptionsMenu(post, canSolveType)}
        
        <div class="post-title">${post.title}</div>
        <div class="post-content">${post.excerpt || ''}</div>
        
        ${resourcesHTML}
        
        ${tags ? `<div class="post-tags">${tags}</div>` : ''}
        
        ${commentsPreviewHTML}
        
        <div class="post-stats">
          <button class="stat-btn reaction-btn" onclick="event.stopPropagation(); toggleReactions(${post.id})">
            ${post.user_interactions?.user_reacted ?
              `<span class="post-reaction reacted">${this.getReactionType(post.user_interactions.reaction_type)} ${post.reactions_count || 0}</span>` :
              `<span class="post-like">👍 ${post.reactions_count || 0}</span>`}
          </button>
          <span onclick="event.stopPropagation(); openCommentModal(${post.id})" class="stat-item">💬 ${post.comments_count || 0}</span>
          ${post.bookmarks_count > 0 ?
            `<span onclick="event.stopPropagation(); toggleBookmark(${post.id})" class="stat-item ${post.user_interactions?.bookmarked ? 'bookmarked' : ''}">🔖 ${post.bookmarks_count}</span>` :
            `<span onclick="event.stopPropagation(); toggleBookmark(${post.id})" class="stat-item ${post.user_interactions?.bookmarked ? 'bookmarked' : ''}">🔖</span>`}
        </div>
      </div>
    `;
  }

  // ============================================================================
  // BUILD POST OPTIONS MENU
  // ============================================================================
  buildPostOptionsMenu(post, canSolveType) {
    return `
      <div class="advanced-post-options hidden" id="options-${post.id}">
        <button onclick="event.stopPropagation(); reportPost(${post.id})">🚩 Report Post</button>
        <button onclick="event.stopPropagation(); openForkModal(${post.id})">🔀 Fork Post</button>
        <button onclick="event.stopPropagation(); openLearnora(${post.id})">🤖 Ask Learnora</button>
        <button onclick="event.stopPropagation(); sharePost(${post.id})">📤 Share</button>
        
        ${post.thread_enabled && !post.user_interactions?.requested_thread ?
        `<button onclick="event.stopPropagation(); viewThread(${post.id})">🧵 Join Thread</button>` : ''}
        ${post.user_interactions?.user_followed ?
        `<button onclick="event.stopPropagation(); unfollowPost(${post.id})">👁️ Unfollow</button>` :
        `<button onclick="event.stopPropagation(); followPost(${post.id})">👁️ Follow</button>`}
        ${!post.is_author && post.connection_status ?
          `<button class="disabled">${post.connection_status}</button>` : ''}
        
        ${post.is_author ? `
          <button onclick="event.stopPropagation(); refinePost(${post.id})">✨ Refine Post</button>
          <button onclick="event.stopPropagation(); deletePost(${post.id})">🗑️ Delete Post</button>
          ${canSolveType ? 
            post.is_solved && post.is_author?
              `<button onclick="event.stopPropagation(); markunSolved(${post.id})">❌ Mark Unsolved</button>` :
              `<button onclick="event.stopPropagation(); markSolved(${post.id})">✅ Mark Solved</button>`
            : ''}
        ` : ''}
        
        <button onclick="event.stopPropagation(); listenPost(${post.id})">🔊 Listen (Audio)</button>
      </div>
    `;
  }

  // ============================================================================
  // BUILD RESOURCES HTML
  // ============================================================================
  buildResourcesHTML(resources, postId) {
    if (!resources || resources.length === 0) return '';
    
    const maxDisplay = 4;
    const displayResources = resources.slice(0, maxDisplay);
    const remainingCount = resources.length - maxDisplay;
    
    const mediaItems = [];
    const documentItems = [];
    
    displayResources.forEach((resource) => {
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
    
    if (remainingCount > 0) {
      mediaItems.push(`
        <div class="post-resource more-resources" onclick="event.stopPropagation(); viewAllResources(${postId})">
          <div class="more-count">+${remainingCount}</div>
          <div class="more-text">more</div>
        </div>
      `);
    }
    
    let html = '';
    if (mediaItems.length > 0) {
      html += `<div class="resource-container media-grid">${mediaItems.join('')}</div>`;
    }
    if (documentItems.length > 0) {
      html += `<div class="resource-container documents-list">${documentItems.join('')}</div>`;
    }
    
    return html;
  }

  // ============================================================================
  // BUILD COMMENTS PREVIEW HTML (for feed)
  // ============================================================================
  buildCommentsPreviewHTML(comments, postId) {
    if (!comments || comments.length === 0) return '';
    
    const commentCards = comments.map(comment => `
      <div class="comment-preview" onclick="event.stopPropagation(); openCommentModal(${postId})">
        <img src="${comment.avatar || '/static/default-avatar.png'}" 
             alt="${comment.name}" 
             class="comment-avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="comment-preview-content">
          <div class="comment-preview-author">${comment.name || 'Anonymous'}</div>
          <div class="comment-preview-text">${comment.text_content}</div>
        </div>
        <div class="comment-preview-stats">
          ${comment.likes_count > 0 ? `<span>👍 ${comment.likes_count}</span>` : ''}
          ${comment.is_solution ? '<span class="solution-indicator">✓</span>' : ''}
        </div>
      </div>
    `).join('');
    
    return `<div class="comments-preview-container">${commentCards}</div>`;
  }

  // ============================================================================
  // RENDER POST COMMENTS (Full modal view)
  // ============================================================================
  renderPostComments(comments) {
    return comments.map(comment => this.createCommentCard(comment)).join('');
  }

  // ============================================================================
  // CREATE COMMENT CARD
  // ============================================================================
  createCommentCard(comment) {
    const author = comment.author;
    const resourcesHTML = this.buildCommentResourcesHTML(comment.resources, comment.id);
    const repliesHTML = this.buildRepliesPreviewHTML(comment.replies, comment.id);
    
    return `
      <div data-postId=${comment.post_id} data-depth="${comment.depth_level}" class="comment-card" id="comment-card-${comment.id}">
        <div class="comment-header">
          <img src="${author?.avatar || '/static/default-avatar.png'}" 
               onclick='viewProfile(${post.author.username})'
               alt="${author?.name}" 
               class="avatar" 
               onerror="this.src='/static/default-avatar.png'">
          <div class="comment-author">
            <div onclick='viewProfile(${post.author.username})' class="comment-author-name">${author?.name || 'Anonymous'}</div>
            <div class="comment-time">${this.formatTime(comment.posted_at)}</div>
          </div>
          ${comment.is_solution ? '<span class="solution-badge">✓ Solution</span>' : ''}
        </div>
        
        <div class="comment-content">${comment.text_content}</div>
        
        ${resourcesHTML}
        
        <div class="comment-actions">
          <button class="comment-action-btn ${comment.user_interactions?.has_liked ? 'active' : ''}" 
                  onclick="event.stopPropagation(); toggleCommentLike(${comment.id})">
            👍 ${comment.likes_count > 0 ? comment.likes_count : 'Like'}
          </button>
          
          <button class="comment-action-btn ${comment.user_interactions?.has_marked_helpful ? 'active' : ''}" 
                  onclick="event.stopPropagation(); toggleCommentHelpful(${comment.id})">
            💡 ${comment.helpful_count > 0 ? comment.helpful_count : 'Helpful'}
          </button>
          
          ${comment.is_you && !comment.post_is_solved && !comment.is_solution ?
            `<button class="comment-action-btn" onclick="event.stopPropagation(); markSolution(${comment.post_id}, ${comment.id}, event)">
              🧠 Mark as Solution
            </button>` : ''}
          ${comment.depth_level < 3 ?
          `<button class="comment-action-btn" onclick="event.stopPropagation(); openReplyModal('${comment.author.username}',${comment.id},${comment.post_id}, event)">💬 Reply</button>` : 
          `<span class="disabled-text">Max reply depth reached</span>`}
          ${comment.is_you ?
            `<button class="comment-action-btn" onclick="event.stopPropagation(); toggleCommentSettings(${comment.id})">
              ⋯
            </button>` : ''}
        </div>
        
        ${comment.is_you ? `
          <div>
            <button onclick="event.stopPropagation(); deleteComment(${comment.id})">🗑️ Delete Comment</button>
          </div>
        ` : ''}
        
        ${repliesHTML}
        
        ${comment.has_more_replies ?
          `<button data-page=comment.page class="show-more-replies-btn" onclick="event.stopPropagation(); showMoreReplies(${comment.id})">
            View More Replies
          </button>` : ''}
      </div>
    `;
  }

  // ============================================================================
  // BUILD COMMENT RESOURCES HTML
  // ============================================================================
  buildCommentResourcesHTML(resources, commentId) {
    if (!resources || resources.length === 0) return '';
    
    const maxDisplay = 3;
    const displayResources = resources.slice(0, maxDisplay);
    const remainingCount = resources.length - maxDisplay;
    
    const mediaItems = [];
    const documentItems = [];
    
    displayResources.forEach((resource) => {
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
    
    if (remainingCount > 0) {
      mediaItems.push(`
        <div class="comment-resource more-resources">
          <div class="more-count">+${remainingCount}</div>
        </div>
      `);
    }
    
    let html = '';
    if (mediaItems.length > 0) {
      html += `<div class="resource-container media-grid">${mediaItems.join('')}</div>`;
    }
    if (documentItems.length > 0) {
      html += `<div class="resource-container documents-list">${documentItems.join('')}</div>`;
    }
    
    return html;
  }

  // ============================================================================
  // BUILD REPLIES PREVIEW HTML
  // ============================================================================
  buildRepliesPreviewHTML(replies, parentId) {
    if (!replies || replies.length === 0) return '';
    
    const replyCards = replies.map(reply => `
      <div class="reply-preview" onclick="event.stopPropagation(); openCommentModal(${reply.id})">
        <img src="${reply.author?.avatar || '/static/default-avatar.png'}" 
             alt="${reply.author?.name}"
             class="reply-avatar"
             onerror="this.src='/static/default-avatar.png'">
        <div class="reply-content">
          <span class="reply-author-name">${reply.author?.name}</span>
          <span class="reply-text">${reply.text_content}</span>
        </div>
      </div>
    `).join('');
    
    return `<div class="replies-container">${replyCards}</div>`;
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================
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
    return postReactions[type] || "👍";
  }

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
}

// ============================================================================
// GLOBAL FUNCTIONS - Call from HTML
// ============================================================================

// Global feed instance
let feed = null;

// Initialize feed on page load
async function initFeed() {
  feed = new PostFeed();
  await feed.loadAllData();
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
  
  await feed.renderFeed(type);
}

// ============================================================================
// COMMENT MODAL FUNCTIONS
// ============================================================================

// Show comment modal for a post
async function openCommentModal(postId) {
  const commentsModal = document.getElementById("post-comments-modal");
  if (!commentsModal) {
    console.error("Comments modal not found");
    return;
  }
  
  commentsModal.classList.remove("hidden");
  commentsModal.innerHTML = feed.getLoadingSkeleton() || '<div>Loading...</div>';
  
  try {
    const response = await api.get(`/posts/${postId}/comments`);
    
    if (response && response.status === "success") {
      if (!response.data.comments || response.data.comments.length === 0) {
        commentsModal.innerHTML = `
          <div class="empty-comments">
            <p>No comments found for this post yet. Be the first to comment!</p>
          </div>
        `;
        return;
      }
      
      const commentsHTML = feed.renderPostComments(response.data.comments);
      commentsModal.innerHTML = commentsHTML;
    } else {
      commentsModal.innerHTML = `
        <div class="error-state">
          <p>Error loading post comments</p>
          <button class="reload-comments" onclick="openCommentModal(${postId})">Try again</button>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading comments:', error);
    commentsModal.innerHTML = `
      <div class="error-state">
        <p>Error loading post comments</p>
        <button class="reload-comments" onclick="openCommentModal(${postId})">Try again</button>
      </div>
    `;
  }
}

async function deleteComment(commentId){
  try{
    const response = await api.post('/comments/commentId/delete');
    if(response.status == "success"){
      document.getElementById(`comment-card-${commentId}`).remove();
    }
    else{
      showToast(response.message, 'error');
    }
  }
  catch(error){
    showToast("Error deletting comment"+ error, 'error');
  }
}

// Toggle comment settings
function toggleCommentSettings(commentId) {
  const settingsDiv = document.getElementById(`comment-settings-${commentId}`);
  if (settingsDiv) {
    settingsDiv.classList.toggle('hidden');
  }
}

// Toggle comment like
async function toggleCommentLike(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/like`);
    if (response && response.status === 'success') {
      // Update UI
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const likeBtn = commentCard.querySelector('.comment-action-btn');
        if (likeBtn) {
          likeBtn.classList.toggle('active');
          // Update count if needed
        }
      }
    }
  } catch (error) {
    showToast('Error toggling comment like:'+ error, 'error');
  }
}

// Toggle comment helpful
async function toggleCommentHelpful(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/mark-helpful`);
    if (response && response.status === 'success') {
      // Update UI
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const helpfulBtn = commentCard.querySelectorAll('.comment-action-btn')[1];
        if (helpfulBtn) {
          helpfulBtn.classList.toggle('active');
        }
      }
    }
  } catch (error) {
    console.error('Error toggling comment helpful:', error);
  }
}

// Show more replies for a comment
async function showMoreReplies(commentId) {
  const page = event.target.dataset.page + 1;
  try {
    const response = await api.get(`/comments/${commentId}/replies`, {"page": page});
    if (response && response.status === 'success') {
      // Update the replies container with new replies
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const repliesContainer = commentCard.querySelector('.replies-container');
        if (repliesContainer && response.data.replies) {
          const newRepliesHTML = feed.buildRepliesPreviewHTML(response.data.replies, commentId);
          repliesContainer.innerHTML  += newRepliesHTML;
        }
      }
    }
  } catch (error) {
    console.error('Error loading more replies:', error);
  }
}


// ============================================================================
// POST INTERACTION FUNCTIONS
// ============================================================================
function toggleCommentSettings(){
  const div = event.target.nextElementSibling;
  div.classList.toggle("hidden");
}
async function viewThread(threadId){
  const threadModal = document.getElementById("thread-view-modal");
  threadModal.innerHTML = feed.getLoadingSkeleton;
  try{
    const response = await api.get(`/threads/${threadId}/details`);
    if(response.status == "success"){
      const data = response.data;
      if(data || data.length == 0){
        threadModal.innerHTML = `<div class="empty-state"><h1>No data found for this thread</h1></div>`
        return;
      }
      renderThreadDetails(data, threadModal);
    }
    else{
      threadModal.innerHTML = `<div class="error-state"><h1>Error loading thread data</h1>
      <button onclick=viewThread(${threadId})>Try again</button></div>`
    }
      
    }
    catch(error){
    showToast(response.message, "error");
    threadModal.innerHTML = `<div class="error-state"><h1>Error loading thread data</h1>
      <button onclick=viewThread(${threadId})>Try again</button></div>`
      
    }
    
}

function renderThreadDetails(thread, modal) {
    modal.innerHTML = `
        <div class="thread-header">
            <div class="thread-title">${thread.title}</div>
            <div>${thread.requires_approval ? "🔒 Private" : "🌎 Public"}</div>
        </div>

        <p>${thread.description}</p>

        <div>
            <strong>Tags:</strong> 
            ${thread.tags.map(tag => `<span class="tag">#${tag}</span>`).join(' ')}
        </div>

        <p><strong>Department:</strong> ${thread.department || "None"}</p>

        <p><strong>Members:</strong> ${thread.total_users} / ${thread.max_members}</p>

        <p><strong>Last Activity:</strong> ${new Date(thread.last_activity).toLocaleString()}</p>

        <h4>Members Preview:</h4>
        <div class="member-list">
            ${thread.members_data.slice(0,5).map(member => `
                <div class="member">
                    <img src="${member.avatar || 'default.png'}">
                    <div class="member-name">${member.name.substring(0,10)}</div>
                    <div class="member-reputation-level">${member.reputation_level}</div>
                </div>
            `).join('')}
            ${thread.members_data.length > 5 ? `<div style="font-size:13px">+${thread.members_data.length - 5} more</div>` : ""}
        </div>

        <div id="join-thread-btn" onclick="joinThread(${thread.id})" class="big-button">Join Thread</div>
        <div onclick="closeModal('thread-view-modal')" class="cancel-thread-buttton">Cancel</button>
    `;
}
async function followPost(postId){
  try{
    const response = await api.post(`/posts/${postId}/follow`);
    if(response.status == "success"){
      showToast("Post followed you would receive updates rekated this post", "success");
      event.target.textContent = "Unfollow Post";
      event.target.onclick = () => {
        unfollowPost(postId);
    }
    else{
      showToast(response.messsge, "error")!
    }
  }
  catch(error){
    showToast("Error following post"+ error, 'error');
  }
}
async function toggleCommentHelpful(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/mark-helpful`);
    if (response && response.status === 'success') {
      // Update UI
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const helpfulBtn = commentCard.querySelectorAll('.comment-action-btn')[1];
        if (helpfulBtn) {
          helpfulBtn.classList.toggle('active');
        }
      }
    }
  } catch (error) {
    console.error('Error toggling comment helpful:', error);
  }
}

async function deletePost(postId){
  try{
    const response = await api.delete(`/posts/${postId}`);
    if(response.status == "success"){
      document.getElementById(`post-${postId})?.remove();
    }
    else{
      showToast(response.message, 'error');
    }
  }
  catch(error){
    showToast("Error deleting post"+ error.message, 'error');
  }
}
async function deleteComment(commentId){
  try{
    const response = await api.delete(`/comments/${commentId}`);
    if(response.status == "success"){
      document.getElementById(`comment-card-${commentId})?.remove();
    }
    else{
      showToast(response.message, 'error');
    }
  }
  catch(error){
    showToast("Error deleting comment"+ error.message, 'error');
  }
}
async function unfollowPost(postId){
  try{
    const response = await api.post(`/posts/${postId}/unfollow`);
    if(response.status == "success"){
      showToast("Post unfollowed", "success");
      event.target.textContent = "Follow Post";
      event.target.onclick = () => {
        followPost(${postId});
    }
    else{
      showToast(response.messsage, "error")!
    }
  }
  catch(error){
    showToast("Error unfollowing post"+ error, 'error');
  }
}
const bookmarkModal = document.getElementById("bookmark-folders-modal")
bookmarkModal.addEventListener("click", async(e) => {
  if(e.target.closest(".bookmark-folder")){
    const folder = e.target.dataset.value;
    const postId = e.target.dataset.id;
    await bookmarkPost(folder, postId);
  }
})

async function bookmarkPost(folder, postId){
  try {
    const response = await api.post(`/posts/${postId}/bookmark`, { folder });
    
    if (response.status === "success") {
      showToast("Post bookmarked successfully", "success");
      event.target.classList.add('bookmarked');
      event.target.onclick = () => unbookmarkPost(postId);
      const content = event.target.textContent;
      const count = parseInt(content.replace(/\D/g, ""), 10);
      event.target.textContent = `🔖${count + 1}`;
    } else {
      showToast(response.message, "error");
    }
  } catch(error) {
    showToast("Error bookmarking post: " + error, 'error');
  }
}
async function toggleBookmark(postId){
  if (!event.target.classList.contains('bookmarked')){
    const folders = feed.getBookmarkFolders();
    if(folders) feed.renderBookmarkFolders(folders);
    return;
  }
  try{
    const response = await api.post(`/posts/${postId}/unbookmark`);
    if(response.status == "success"){
      event.target.classList.remove("bookmarked");
    const content = event.target.textContent;
    const count = parseInt(content.replace(/\D/g, ""), 10);
    event.target.textContent = `🔖${count - 1}`;
    }
    else{
      showToast(response.messsge, "error")!
    }
  }
  catch(error){
    showToast("Error following post"+ error, 'error');
  }
}

async function pinPost(postId){
  try{
    const response = await api.post(`/posts/${postId}/pin`);
    if(response.status == "success"){
      showToast("Post pinned", "success");
      event.target.textContent = "Unpin Post";
      event.target.onclick = () => {
        unpinPost(${postId});
    }
    else{
      showToast(response.messsge, "error")!
    }
  }
  catch(error){
    showToast("Error pinning post"+ error, 'error');
  }
}
async function unpinPost(postId){
  try{
    const response = await api.post(`/posts/${postId}/unpin`);
    if(response.status == "success"){
      showToast("Post unpinned", "success");
      event.target.textContent = "Pin Post";
      event.target.onclick = () => {
        pinPost(${postId});
    }
    else{
      showToast(response.messsge, "error")!
    }
  }
  catch(error){
    showToast("Error unpinning post"+ error, 'error');
  }
}

function joinThread(threadId){
  setButtonLoading("join-thread-btn", true);
  try{
    const response = await api.post(`/threads/${threadId}/join`);
    if(response.status == "success"){
      setButtonLoading("join-thread-btn", false);
      document.getElementById("join-thread-btn").classList.add("hidden");
    }
    else{
      showToast(response.messsge, "error");
      setButtonLoading('join-thread-btn', false);
    }
    
  }
  catch(error){
    showToast("Error joining thread"+ error, 'error');
    setButtonLoading('join-thread-btn', false);
  }
}

// Connect with user
async function connectUser(userId) {
  try {
    const response = await api.post(`/connections/request/${userId}`);
    if (response && response.status === 'success') {
      alert('Connection request sent!');
      event.target.textContent = "Pending";
      event.target.classList.add("disabled");
    }
    else{
      showToast(response.message, 'error');
    }
  } catch (error) {
    showToast('Connect error:', error);
  }
}

async function markSolution(postId, commentId, event){
  try{
    const data = { comment_id: commentId };
    const response = await api.post("/posts/${postId}/mark-solution", data);
    if(response.status == "success"){
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      const badge = document.createElement("span")
      badge.classList.add("span-solved")
      badge.textContent = ">✓ Solution"
      event.target.insert("beforebegin", badge);
      event.target.textContent = 'Unmark Solution';
      event.target.onclick = () => {
        unMarkSolution(postId, commentId);
    }
    const commentsModal = document.getElementById("post-comments-modal").querySelectorAll(`comment-card[dataset.postId="${postId}"]`);
    
    commentsModal.querySelectorAll("button[data-type='mark-solution']").forEach(btn => {
        btn.classList.add("hidden");
      });
    }
    else{
      showToast(response.message, "error");
    }
  }
  catch(error){
    showToast("Mark solution error" + error.message, 'error');
  }
}
async function unmarkSolution(postId, commentId, event){
  try{
    const data = { comment_id: commentId };
    const response = await api.post("/posts/${postId}/unmark-solution", data);
    if(response.status == "success"){
      event.target.textContent = 'Mark Solution';
      event.target.onclick = () => {
        markSolution(postId, commentId);
    }
    const commentsModal = document.getElementById("post-comments-modal").querySelectorAll("comment-card[data-postId=${postId]")
      commentsModal.querySelectorAll("button[data-type='mark-solution']").forEach(btn => {
        btn.classList.remove("hidden");
      });
    }
    
    else{
      showToast(response.message, "error");
    }
  }
  catch(error){
    showToast("Unmark solution error" + error.message, 'error');
  }
}

async function markSolved(postId, event){
  try{
    const response = await api.post("/posts/${postId}/mark-solved");
    if(response.status == "success"){
      event.target.textContent = "Unmark Solved";
      event.target.onclick = function (){
        unmarkSolved(postId, event);
      }
      const span = document.createElement("span");
      span.classList.add("solved-badge");
      span.textContent = 
      const commentsModal = document.getElementById("post-comments-modal").querySelectorAll("comment-card[data-postId=${postId]")
      commentsModal.querySelectorAll("button[data-type='mark-solution']").forEach(btn => {
        btn.classList.add("hidden");
      });
      
    else{
      showToast(response.message, 'error');
    }
      
    }
  }
    catch(error){
      showToast("Mark solved error" + error.message);
    }
  }
async function unmarkSolved(postId, event){
  try{
    const response = await api.post("/posts/${postId}/unmark-solved");
    if(response.status == "success"){
      
      event.target.textContent = "Mark Solved";
      event.target.onclick = function (){
        markSolved(postId, event);
      }
      const postCard = document.getElementById(`post-${postId}`);
      postCard.querySelector('.solved-badge')?.remove();
      const commentsModal = document.getElementById("post-comments-modal").querySelectorAll("comment-card[data-postId=${postId]")
      commentsModal.querySelector("button[data-type='mark-solution']").forEach(btn => {
        btn.classList.remove('hidden');
    else{
      showToast(response.message, 'error');
    }
      
    }
  }
    catch(error){
      showToast("Mark solved error" + error.message);
    }
  }
async function toggleCommentLike(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/like`);
    if (response && response.status === 'success') {
      // Update UI
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const likeBtn = commentCard.querySelectorAll('.comment-action-btn')[0];
        if (likeBtn) {
          likeBtn.classList.toggle('active');
          // Update count if needed
        }
      }
    }
  } catch (error) {
    showToast('Error toggling comment like:'+ error, 'error');
  }
}

function listenPost(postId){
  const post = document.getElementById("post-${postId}");
  const text = post.querySelector('post-content').textContent;
  if (text){
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = 1; // speed
    speech.pitch = 1; 
    speech.lang = "en-US"; // or "en-GB", "en-NG"
    window.speechSynthesis.speak(speech);
}
  }
let  selectedForkTags =[];
let maxForkTags = 5;

function openForkModal(postId){
  const modal = document.getElementById("post-fork-modal");
  modal.classList.remove('hidden');
  modal.innerHTML = feed.getLoadingSkeleton;
  const post = document.getElementById("post-${postId}");
  modal.querySelector(".post-content").value= post.querySelector('post-content').textContent;
  modal.querySelector(".post-title").value= post.querySelector('post-title').textContent;
  modal.querySelector(".thread-enabled").checked = post.querySelector("thread-badge")? true:false;
  modal.querySelector("post-type-selection").value = post.querySelector(".post-type-label").textContent;
  const postTags = post.querySelectorAll(".post-tags .tag");
  const tagsDiv = document.createElement("div");
  const tags = Array.from(postTags).map(tag => tag.textContent.replace('#', ''));
  const tagsDiv = document.createElement("div");
  tags.forEach(tag => {
    const span = document.createElement("span");
    span.classList.add("tag-badge");
    const btn = document.createElement('button');
    span.textContent = tag
    span.appendChild(btn);
    btn.onclick = () => {
      span.remove();
    }
    tagsDiv.appendChild(span);
    selectedForkTags.push(tag);
  })
  
  modal.querySelector("selected-fork-tags").appendChild(tagsDiv.slice(0, 5));
  
async function saveForkedPost(){
  const modal = document.getElementById("post-fork-modal");
  const saveBtn = document.getElementById("post-fork-modal").querySelector("save-post")
  setButtonLoading(saveBtn, true);
  const title = modal.querySelector('post-title').value;
  const content = modal.querySelector('post-content').value;
  const thread_enabled = modal.querySelector(".thread-enabled").checked 
  const postType = modal.querySelector("post-type-selection").value
  const postTags = modal.querySelector("selected-fork-tags");
  
  const formData = {
  "title": title,
  "text_content": content,
  "thread_enabled": thread_enabled,
  "post_type": postType,
  "tags": postTags.split(',').filter(t => t.trim())
  };
  try{
    const response = await api.post("/posts/create", formData);
    if(response.status == "success"){
      showToast("Post created succesfully", "success");
      closeModal("post-fork-modal");
      return;
    }
    showToast(response.message, 'error');
  }
  catch(error){
    showToast(error.message, 'error');
  }
  finally{
    setButtonLoading(saveBtn, false)
  }
  
}

const modal = document.getElementById("post-fork-modal")
const forktTagsDropdown = document.getElementById("fork-tags-dropdown");
const forkTagInput = document.getElementById("fork-tags-input");

forkTagInput.addEventListener("input", function(e) {
  const input = e.target.value.toLowerCase();
  
  if (input.length === 0) {
    forkTagsDropdown.classList.add("hidden");
    return;
  }
  
  if (selectedForkTags.length >= maxTags) {
    tagsDropdown.classList.add('hidden');
    return;
  }
  
  const relatedTags = availableTags.filter(tag => 
    tag.toLowerCase().includes(input) && !selectedForkTags.includes(tag)
  );
  
  if (relatedTags.length > 0) {
    forkTagsDropdown.innerHTML = relatedTags.slice(0, 10).map(tag => 
      `<div class="tag-option" onclick="addTag('${tag}')">${tag}</div>`
    ).join('');
    forkTagsDropdown.classList.remove('hidden');
  } else {
    forkTagsDropdown.classList.add('hidden');
  }
});

forkTagInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const value = e.target.value.trim();
    if (value && selectedForkTags.length < maxTags) {
      addTag(value);
    }
  }
});

function addTag(tag) {
  if (selectedForkTags.length >= maxTags) {
    showToast(`You can only add up to ${maxTags} tags`, 'info');
    return;
  }
  
  if (!selectedForkTags.includes(tag)) {
    selectedForkTags.push(tag);
    renderSelectedTags();
  }
  
  document.getElementById('fork-tags-input').value = '';
  document.getElementById('fork-tags-dropdown').classList.add('hidden');
}

function removeTag(tag) {
  selectedForkTags = selectedForkTags.filter(t => t !== tag);
  renderSelectedTags();
}

function renderSelectedTags() {
  const container = document.getElementById('selected-fork-tags');
  container.innerHTML = selectedTags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeTag('${tag}')">×</button>
    </span>`
  ).join('');
}


// Offer help

// Toggle post options
function togglePostOptions(postId) {
  const optionsDiv = document.getElementById(`options-${postId}`);
  if (optionsDiv) {
    optionsDiv.classList.toggle('hidden');
  }
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

async function reportPost(postId){
  try{
    const response = await api.post(`/posts/post/report`);
    if(response.status == "success"){
      showToast("Post reported our admin would review and take action", 'info');
      event.target.remove();
    }
    else{
      showToast(response.message, 'error')
    }
  }
  catch(error){
    showToast("Report post error"+ error, 'error');
  }
}


function openReplyModal(commentId, username, postId, event){
  const replyBtn = event.target;
  const inputBox = document.getElementById("commentInput")
  inputBox.dataset.post = postId;
  inputBox.dataset.comment = commentId;
  inputBox.value = `@${username}`;
  inputBox.focus();
}
let replyUrls = []
let replyFiles = []
const replyBox = document.getElementById("comment-box")
const replyPreview = document.getElementById("previewArea");
replyBox.querySelectorAll("input").forEach(input => {
  input.addEventListener("change", function(e) {
    const files = Array.from(event.target.files)
    replyFiles.push(...files);
    
    files.forEach(file => {
      if (!file) return;
      
      const previewDiv = document.createElement("div");
      previewDiv.className = "preview-item";
      let media;
      if (file.type.startsWith("image/")) {
        media = document.createElement("img");
        media.src = URL.createObjectURL(file);
      } else if (file.type.startsWith("video/")) {
        media = document.createElement("video");
        media.src = URL.createObjectURL(file);
        media.controls = true;
      } else {
        media = document.createElement("div");
        media.className = "file-name";
        media.textContent = file.name;
      }
      
      previewDiv.appendChild(media);
      
      const loader = document.createElement("div");
      loader.className = "loader";
      
      const btn = document.createElement('button');
      btn.className = "cancel-upload";
      btn.textContent = "×";
      btn.style.display = "none"; // Hide until upload completes
      
      previewDiv.appendChild(loader);
      previewDiv.appendChild(btn);
      replyBox.appendChild(previewDiv);
      
      uploadCommentFile(file, btn, loader, previewDiv);
    });
  });
});

async function uploadCommentFile(file, btn, loader, previewDiv){
  const formData = new FormData();
    formData.append("file", file);
  try{
    const response = await api.post("/posts/resource/upload", formData);
    
    if (response.status === "success") {
      const secureUrl = response.data.url;
      replyUrls.push(secureUrl);
      loader.remove();
      btn.style.display = "block";
      
      btn.onclick = () => {
        previewDiv.remove();
        postFilesUrls = postFilesUrls.filter(url => url !== secureUrl);
        postFiles = postFiles.filter(f => f !== file);
      };
    } else {
      loader.classList.add("error");
      loader.textContent = "Upload failed";
    }
  } catch (error) {
    showToast("Error encountered uploading file", "error");
    loader.classList.add("error");
    loader.textContent = "Failed";
  }
}

async function postComment(event){
  const textContent = document.getElementById("commentInput").value;
  const inputBox = document.getElementById("commentInput");
  const postId = inputBox.dataset.post;
  const parentId = inputBox.dataset.comment;
  const formData = {
    "post_id": postId,
    "resources": replyUrls,
    "text_content": inputBox.value,
    "parent_id": parentId
  }
  try{
    const response = await api.post("/comments/create", formData);
    if(response.status == "success"){
      openCommentModal(postId);
      replyFilesUrls.length == 0;
      replyFiles.length = 0
    }
    else{
      showToast(response.message, 'error');
    }
  }
  catch(error){
    showToast("Error posting comment"+ error, 'error');
  }
}

let longPressTimer;
let reactionBtn = null;
const LONG_PRESS_TIME = 2000; // 2 seconds
const reactionMenu = document.getElementById("reactionMenu");

// Apply listeners to all reaction buttons
document.querySelectorAll(".post-card").forEach(post => {
    const btn = post.querySelector(".comment-action-btn");

    // Store the element being long-pressed
    btn.addEventListener("mousedown", (e) => {
        reactionBtn = e.target;
        startPress(e);
    });

    btn.addEventListener("mouseup", cancelPress);
    btn.addEventListener("mouseleave", cancelPress);

    // Touch events for mobile
    btn.addEventListener("touchstart", (e) => {
        e.preventDefault(); 
        reactionBtn = e.target;
        startPress(e);
    });

    btn.addEventListener("touchend", cancelPress);
    btn.addEventListener("touchmove", cancelPress);
});


// START long press
function startPress(e) {
    longPressTimer = setTimeout(() => {
        showReactions(e);
    }, LONG_PRESS_TIME);
}

// CANCEL long press
function cancelPress() {
    clearTimeout(longPressTimer);
}


// Show the reaction menu beside the pressed button
function showReactions(e) {
    reactionMenu.classList.remove("hidden");

    const rect = e.target.getBoundingClientRect();
    reactionMenu.style.left = rect.left + "px";
    reactionMenu.style.top = rect.top - 60 + "px";
}


// When user selects one of the reactions
reactionMenu.addEventListener("click", async (e) => {
    const reactionType = e.target.dataset.reaction;
    if (!reactionType || !reactionBtn) return;

    const postReactionEl = reactionBtn.closest(".post-reaction");
    const reacted = postReactionEl.classList.contains("reacted");
    const text = postReactionEl.textContent.trim();

    const oldEmoji = text[0];
    const oldCount = parseInt(text.substring(1)) || 0;

    const postCard = reactionBtn.closest(".post-card");
    const postId = postCard.id.replace("post-", "");

    await toggleReactions(reactionType, oldEmoji, oldCount, reacted, postId, postReactionEl);

    reactionMenu.classList.add("hidden");
});


// Map reaction types to emojis
function getReactionType(type) {
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
    return postReactions[type] || "👍";
}


// Actual reaction logic
async function toggleReactions(newType, oldEmoji, oldCount, reacted, postId, element) {
    try {
        const response = await api.post(`/posts/${postId}/react`);

        if (response.status !== "success") {
            return showToast(response.message, "error");
        }

        const newEmoji = getReactionType(newType);

        // If user already reacted
        if (reacted) {
            // User clicked the same reaction -> undo
            if (newEmoji === oldEmoji) {
                element.textContent = `👍${oldCount - 1}`;
                element.classList.remove("reacted");
            } else {
                // Switching from one reaction to another
                element.textContent = `${newEmoji}${oldCount}`;
                element.classList.add("reacted");
            }
        } 
        
        else {
            // First-time reaction
            element.textContent = `${newEmoji}${oldCount + 1}`;
            element.classList.add("reacted");
        }

    } catch (error) {
        showToast("Post reaction error: " + error, "error");
    }
}
  
}

let isHighlightMode = false;
let longPressTimeout = null;
const longPressTime = 800; // 0.8s long press

function startBulk(e, post) {
  // start long press timer
  longPressTimeout = setTimeout(() => {
    isHighlightMode = true;
    highlightPost(post);
    document.getElementById("bulk-bookmark").classList.remove("hidden");
  }, longPressTime);
}

function clearBulk() {
  clearTimeout(longPressTimeout);
}

function highlightPost(post) {
  post.classList.add("choosed");
}

function togglePostSelection(post) {
  if (!isHighlightMode) return;

  if (post.classList.contains("choosed")) {
    post.classList.remove("choosed");
  } else {
    post.classList.add("choosed");
  }
}

// Attach events
document.querySelectorAll(".post-card").forEach(post => {

  // long press (touch)
  post.addEventListener("touchstart", (e) => startBulk(e, post));
  post.addEventListener("touchend", clearBulk);
  post.addEventListener("touchmove", clearBulk);

  // long press (mouse)
  post.addEventListener("mousedown", (e) => startBulk(e, post));
  post.addEventListener("mouseup", clearBulk);
  post.addEventListener("mouseleave", clearBulk);

  // click to select/deselect
  post.addEventListener("click", () => togglePostSelection(post));
});


// Bulk bookmark
async function bookmarkPosts() {
  const selected = [...document.querySelectorAll(".post-card.choosed")];
  if (selected.length === 0) {
    showToast("No posts selected", "warning");
    return;
  }

  const postIds = selected.map(p => p.dataset.postId);

  try {
    const formData = new FormData();
    postIds.forEach(id => formData.append("ids[]", id));

    const response = await api.post('/posts/bulk/bookmark', formData);

    if (response.status !== "success") {
      showToast(response.message || "Bookmark error", "error");
      return;
    }

    showToast("Posts bookmarked!", "success");

  } catch (error) {
    showToast("Bookmark error: " + error.message, "error");
  } finally {
    // reset
    selected.forEach(p => p.classList.remove("choosed"));
    isHighlightMode = false;
    document.getElementById("bulk-bookmark").classList.add("hidden");
  }
}

const posts = document.querySelectorAll(".post-card");

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const postId = entry.target.getAttribute("data-post-id");

            console.log("Post is viewed:", postId);

            // Send view to backend only once
            sendView(postId);

            // Stop observing this post
            observer.unobserve(entry.target);
        }
    });
}, {
    threshold: 0.4  // 40% of post must be visible before counting view
});

posts.forEach(post => observer.observe(post));

function sendView(postId) {
  try{
    api.post(`/posts/${postId}/view`);
  }
  catch(error){
    showToast("Error viewing post", 'error');
  }
}
// ============================================================================
// POST REFINEMENT SYSTEM
// ============================================================================

let currentRefinement = null;

async function refinePost(postId) {
    try {
        const modal = document.getElementById("post-refine-modal");
        if (!modal) {
            console.error("Refine modal not found");
            return;
        }
        
        modal.classList.remove("hidden");
        modal.innerHTML = `
            <div class="modal-content refine-modal">
                <div class="modal-header">
                    <h3>✨ AI Post Refinement</h3>
                    <button class="close-btn" onclick="closeRefineModal()">×</button>
                </div>
                
                <div class="refine-instructions">
                    <label for="refinement-instructions">Refinement Instructions (Optional)</label>
                    <textarea 
                        id="refinement-instructions" 
                        placeholder="e.g., Make it more formal, Add more technical details, Simplify the language..."
                        rows="3"
                    ></textarea>
                </div>
                
                <div class="refine-content">
                    <div class="original-content">
                        <h4>📝 Original</h4>
                        <div id="original-title" class="content-preview"></div>
                        <div id="original-content" class="content-preview"></div>
                    </div>
                    
                    <div class="refined-content">
                        <h4>✨ Refined</h4>
                        <div id="refined-title" class="content-preview loading"></div>
                        <div id="refined-content" class="content-preview loading"></div>
                    </div>
                </div>
                
                <div class="refine-status" id="refine-status">
                    <div class="loading-indicator">
                        <div class="spinner"></div>
                        <span>Refining your post...</span>
                    </div>
                </div>
                
                <div class="modal-actions hidden" id="refine-actions">
                    <button class="btn-secondary" onclick="closeRefineModal()">Cancel</button>
                    <button class="btn-primary" onclick="applyRefinement(${postId})" id="apply-btn">
                        Apply Changes
                    </button>
                </div>
            </div>
        `;
        
        // Load original post content
        const response = await api.get(`/posts/${postId}/quick-view`);
        
        if (response && response.status === "success") {
            const post = response.data;
            document.getElementById("original-title").textContent = post.title;
            document.getElementById("original-content").textContent = post.content || "[No content]";
            
            // Start refinement
            startRefinement(postId);
        } else {
            showToast("Failed to load post", "error");
            closeRefineModal();
        }
        
    } catch (error) {
        console.error("Refine post error:", error);
        showToast("Error initiating refinement: " + error.message, "error");
    }
}
async function applyRefinement(postId) {
    if (!currentRefinement) {
        showToast("No refinement to apply", "error");
        return;
    }
    
    const applyBtn = document.getElementById("apply-btn");
    const originalText = applyBtn.textContent;
    
    try {
        applyBtn.disabled = true;
        applyBtn.textContent = "Applying...";
        
        const response = await api.post(`/posts/${postId}/apply-refinement`, currentRefinement);
        
        if (response && response.status === "success") {
            showToast("✨ Post refined successfully!", "success");
            
            // Update post in UI
            const postCard = document.getElementById(`post-${postId}`);
            if (postCard) {
                const titleEl = postCard.querySelector(".post-title");
                const contentEl = postCard.querySelector(".post-content");
                
                if (titleEl) titleEl.textContent = currentRefinement.title;
                if (contentEl) contentEl.textContent = currentRefinement.content;
            }
            
            closeRefineModal();
            currentRefinement = null;
        } else {
            showToast(response?.message || "Failed to apply refinement", "error");
        }
        
    } catch (error) {
        console.error("Apply refinement error:", error);
        showToast("Error applying refinement: " + error.message, "error");
    } finally {
        applyBtn.disabled = false;
        applyBtn.textContent = originalText;
    }
}

function closeRefineModal() {
    const modal = document.getElementById("post-refine-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.innerHTML = "";
    }
    currentRefinement = null;
}
async function startRefinement(postId) {
    try {
        const instructions = document.getElementById("refinement-instructions")?.value || "";
        
        const formData = new FormData();
        if (instructions) {
            formData.append("instructions", instructions);
        }
        
        const response = await api.post(`/student/posts/${postId}/refine`, formData);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        
        let refinedTitle = "";
        let refinedContent = "";
        let fullResponse = "";
        
        const refinedTitleEl = document.getElementById("refined-title");
        const refinedContentEl = document.getElementById("refined-content");
        const statusEl = document.getElementById("refine-status");
        
        refinedTitleEl.classList.remove("loading");
        refinedContentEl.classList.remove("loading");
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        
                        if (parsed.type === 'start') {
                            statusEl.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>Analyzing and refining...</span></div>';
                        }
                        else if (parsed.content) {
                            fullResponse += parsed.content;
                            
                            // Try to extract title and content in real-time
                            const titleMatch = fullResponse.match(/"title"\s*:\s*"([^"]+)"/);
                            const contentMatch = fullResponse.match(/"content"\s*:\s*"([^"]+)"/);
                            
                            if (titleMatch) {
                                refinedTitle = titleMatch[1]
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\');
                                refinedTitleEl.textContent = refinedTitle;
                            }
                            
                            if (contentMatch) {
                                refinedContent = contentMatch[1]
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\');
                                refinedContentEl.textContent = refinedContent;
                            }
                        }
                        else if (parsed.type === 'retry') {
                            statusEl.innerHTML = `<div class="warning-indicator">⚠️ Retrying with backup provider...</div>`;
                        }
                        else if (parsed.type === 'done') {
                            if (parsed.success && parsed.refined) {
                                // Use final parsed data
                                currentRefinement = parsed.refined;
                                refinedTitleEl.textContent = parsed.refined.title;
                                refinedContentEl.textContent = parsed.refined.content;
                                
                                statusEl.innerHTML = '<div class="success-indicator">✅ Refinement complete!</div>';
                                document.getElementById("refine-actions").classList.remove("hidden");
                            } else {
                                // Failed to parse
                                statusEl.innerHTML = '<div class="error-indicator">❌ Failed to refine. Please try again.</div>';
                                
                                if (parsed.raw_response) {
                                    refinedContentEl.textContent = parsed.raw_response;
                                    refinedContentEl.style.fontSize = "0.9em";
                                    refinedContentEl.style.opacity = "0.7";
                                }
                            }
                        }
                        else if (parsed.error) {
                            throw new Error(parsed.error);
                        }
                    } catch (e) {
                        if (e.message !== 'Unexpected end of JSON input') {
                            console.error('Parse error:', e);
                            statusEl.innerHTML = `<div class="error-indicator">❌ ${e.message}</div>`;
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("Refinement stream error:", error);
        document.getElementById("refine-status").innerHTML = 
            `<div class="error-indicator">❌ Error: ${error.message}</div>`;
    }
}



// ============================================================================
// INITIALIZE ON PAGE LOAD
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  initFeed();
});
</script>

// Navigation wrapper

  
  

          