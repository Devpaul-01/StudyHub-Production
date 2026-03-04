
const availableTags = ["Accounting", "Acting", "Aerospace Engineering", "African Studies", "Agricultural Science", "Algebra", "Android Development", "Animation", "Anthropology", "Applied Mathematics", "Archaeology", "Architecture", "Art History", "Artificial Intelligence", "Artificial Intelligence Subfields", "AR/VR Learning", "Astronomy", "Automotive Engineering", "Audiology", "Biochemistry", "Bioinformatics", "Biology", "Biomedical Engineering", "Blockchain", "Botany", "Business Administration", "Business Analytics", "Career Advice", "Chemical Engineering", "Chemistry", "Civil Engineering", "Cloud Computing", "College Life", "Commerce", "Communication Studies", "Computer Engineering", "Computer Science", "Construction Management", "Content Creation", "Creative Writing", "Criminology", "Cultural Studies", "Cybersecurity", "Dance", "Data Analysis", "Data Engineering", "Data Science", "Data Visualization", "Database Management", "Dart", "Dentistry", "Dermatology", "Design Thinking", "Digital Art", "Digital Marketing", "Digital Productivity Tools", "Drama", "Drawing", "Early Childhood Education", "Ecology", "Economics", "Education", "Electrical Engineering", "Electronics Engineering", "Emergency Medicine", "Embedded Systems", "Emotional Intelligence", "Engineering", "English Language", "Entrepreneurship", "Environmental Science", "Epidemiology", "Ethics", "Excel Skills", "Fashion Design", "Film Production", "Finance", "Fine Art", "Food Science", "Forensic Science", "French Language", "Game Development", "Gender Studies", "Genetics", "Geography", "Geology", "Geometry", "Graphic Design", "Health Education", "Health Science", "History", "Homeschooling", "Hospitality Management", "Human Anatomy", "Human Resources", "Human Rights", "Human Physiology", "Immunology", "Industrial Engineering", "Information Technology", "International Relations", "iOS Development", "Journalism", "Java", "JavaScript", "Kindergarten Education", "Kotlin", "Languages", "Law", "Leadership", "Learning Analytics", "Learning Disabilities", "Linguistics", "Literature", "Machine Learning", "Machine Learning Subfields", "Marine Biology", "Marketing", "Mathematics", "Mechanical Engineering", "Mechatronics Engineering", "Media Studies", "Medical Laboratory Science", "Medicine and Surgery", "Mental Health", "Microbiology", "Mobile App Development", "Molecular Biology", "Moral Philosophy", "Music", "Network Engineering", "Neuroscience", "Nursing", "Nutrition", "Online Learning", "Occupational Therapy", "Optometry", "Pathology", "Pediatric Medicine", "Performing Arts", "Petroleum Engineering", "Pharmacy", "Philosophy", "Photography", "Physical Education", "Physical Therapy", "Physics", "Physiology", "PHP", "Pre-Med", "Primary Education", "Product Design", "Project Management", "Psychiatry", "Psychology", "Public Administration", "Public Health", "Public Speaking", "Python Libraries", "Python Programming", "Radiology", "React Development", "React Native", "Reading Skills", "R Programming", "Research Methods", "Robotics", "Ruby", "Rust", "Scholarship Opportunities", "Science Education", "Simulation-Based Learning", "Sculpture", "Secondary Education", "Self-Study", "Social Sciences", "Sociology", "Software Development", "Software Engineering", "Spanish Language", "Special Education", "SQL", "Statistics", "STEM", "Study Abroad", "Study Tips", "Surgery", "Swift", "Teacher Training", "Theology", "Theatre Studies", "TOEFL Prep", "TypeScript", "UI Design", "UI/UX Design", "URDU Language", "Veterinary Medicine", "Virtual Learning", "Visual Arts", "VR Learning", "Web Development", "Web Frameworks", "Wildlife Biology", "Writing Skills", "XR Learning", "Zoology"];

// ============================================================================
// GLOBAL VARIABLES
// ============================================================================
let feed = null;
let pullToRefresh = null;
let selectedForkTags = [];
let maxForkTags = 5;
let replyUrls = [];
let replyResources = [];
let replyFiles = [];
let currentRefinement = null;
let longPressTimer = null;
let reactionBtn = null;
let isHighlightMode = false;
let longPressTimeout = null;
const longPressTime = 800;
let selectedPosts = new Set();
let viewObserver = null;

// ============================================================================
// HELPER FUNCTION - Must be defined BEFORE PostFeed class
// ============================================================================
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

// ============================================================================
// PULL TO REFRESH CLASS
// ============================================================================
class PullToRefresh {
    constructor() {
        this.startY = 0;
        this.currentY = 0;
        this.pulling = false;
        this.threshold = 80;
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
            if (feed) {
                await feed.loadAllData();
                await feed.renderFeed(feed.currentFilter);
                
                setupReactionListeners();
                setupViewTracking();
                attachBulkSelectionListeners();
            }
            
            showToast('Feed refreshed!', 'success');
        } catch (error) {
            console.error('Refresh error:', error);
            showToast('Failed to refresh feed', 'error');
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

// ============================================================================
// POST FEED CLASS
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
      throw error;
    }
  }

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
    setupViewTracking();
    attachBulkSelectionListeners();
  }

  renderBookmarkFolders(folders){
    const bookmarkModal = document.getElementById("bookmark-folders-list");
    if (!bookmarkModal) return;
    
    bookmarkModal.innerHTML = '';
    
    if(folders && folders.length > 0){
      folders.forEach(folder =>{
        const div = document.createElement("div");
        div.classList.add("bookmark-folder");
        div.textContent = folder;
        div.dataset.value = folder;
        bookmarkModal.appendChild(div);
      });
    } else {
      const div = document.createElement("div");
      div.classList.add("bookmark-folder");
      div.textContent = "Saved";
      div.dataset.value = "Saved";
      bookmarkModal.appendChild(div);
    }
    
    const btn = document.createElement('button');
    btn.textContent = "Cancel";
    btn.className = "btn btn-secondary";
    btn.onclick = () => {
      closeModal("bookmark-folders-modal");
    };
    bookmarkModal.appendChild(btn);
  }
  
  async getBookmarkFolders(){
    try{
      const response = await api.get("/posts/folders");
      if(response.status == "success"){
        return response.data;
      }
      else{
        showToast(response.message, "error");
        return null;
      }
    }
    catch(error){
      showToast("Error loading folders", "error");
      return null;
    }
  }

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

  hasWidgetData(widgetId) {
    const data = this.widgets[widgetId];
    if (Array.isArray(data)) return data.length > 0;
    if (typeof data === 'object') return Object.keys(data).length > 0;
    return false;
  }

  createPostCard(post) {
    const tags = post.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || '';
    const postTypeIcon = this.getPostTypeIcon(post.post_type);
    const canSolveType = this.canSolveTypes.includes(post.post_type);
    const resourcesHTML = this.buildResourcesHTML(post.resources, post.id);
    let commentsPreviewHTML = this.buildCommentsPreviewHTML(post.comments, post.id);
    
    return `
      <div data-post-id="${post.id}" class="post-card" data-id="post-${post.id}">
        <div class="post-header">
          <img onclick="viewProfile('${post.author.username}')" src="${post.author?.avatar || '/static/default-avatar.png'}" 
               alt="${post.author?.name}" 
               class="avatar" 
               onerror="this.src='/static/default-avatar.png'">
          <div class="post-author">
            <div onclick="viewProfile('${post.author.username}')" class="post-author-name">${post.author?.name || 'Anonymous'}</div>
            <div class="post-time">${this.formatTime(post.posted_at)}</div>
          </div>
          ${post.is_solved ? '<span class="solved-badge">✓ Solved</span>' : ''}
          ${post.thread_enabled ? '<span class="thread-badge">🧵 Thread</span>' : ''}
          ${!post.is_author && !post.connection_status ?
          `<button onclick="event.stopPropagation(); connectRequest(${post.author?.id})">🤝 Connect</button>` : ''}
        </div>
        
        <div class="post-type-indicator" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; color: var(--text-secondary); font-size: 0.875rem;">
          <span style="display: flex; align-items: center;">${postTypeIcon}</span>
          <span class="post-type-label" style="text-transform: capitalize;">${post.post_type}</span>
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
              `<span class="post-reaction reacted">${getReactionType(post.user_interactions.reaction_type)} ${post.reactions_count || 0}</span>` :
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

  renderPostComments(comments) {
    return comments.map(comment => this.createCommentCard(comment)).join('');
  }

  createCommentCard(comment) {
    const author = comment.author;
    const resourcesHTML = this.buildCommentResourcesHTML(comment.resources, comment.id);
    const repliesHTML = this.buildRepliesPreviewHTML(comment.replies, comment.id);
    
    return `
      <div data-postId="${comment.post_id}" data-depth="${comment.depth_level}" class="comment-card" id="comment-card-${comment.id}">
        <div class="comment-header">
          <img src="${author?.avatar || '/static/default-avatar.png'}" 
               onclick="viewProfile('${author?.username || 'unknown'}')"
               alt="${author?.name}" 
               class="avatar" 
               onerror="this.src='/static/default-avatar.png'">
          <div class="comment-author">
            <div onclick="viewProfile('${author?.username || 'unknown'}')" class="comment-author-name">${author?.name || 'Anonymous'}</div>
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
          `<button class="comment-action-btn" onclick="event.stopPropagation(); openReplyModal('${author?.username || 'user'}',${comment.id},${comment.post_id})">💬 Reply</button>` : 
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
          `<button data-page="${comment.page || 1}" class="show-more-replies-btn" onclick="event.stopPropagation(); showMoreReplies(${comment.id})">
            View More Replies
          </button>` : ''}
      </div>
    `;
  }

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
        <div onclick="event.stopPropagation();viewCommentResources(${commentId})" class="comment-resource more-resources">
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
        <button class="connect-btn" onclick="event.stopPropagation(); connectUser(${item.user?.id})">Offer Help</button>
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
// GLOBAL FUNCTIONS
// ============================================================================

async function initFeed() {
    console.log('initFeed() called');
    try {
        console.log('Initializing feed...');
        
        feed = new PostFeed();
        await feed.loadAllData();
        await feed.renderFeed('all');
        
        console.log('Feed loaded successfully');
        showToast('Feed loaded!', 'success');
    } catch (error) {
        console.error('Feed initialization error:', error);
        showToast('Failed to load feed: ' + error.message, 'error');
    }
}

async function filterFeed(type) {
  if (!feed) {
    feed = new PostFeed();
  }
  
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(`'${type}'`)) {
      btn.classList.add('active');
    }
  });
  
  document.querySelectorAll('.posts-feed').forEach(container => {
    container.classList.remove('active');
  });
  
  const targetContainer = document.getElementById(`feed-${type}`);
  if (targetContainer) {
    targetContainer.classList.add('active');
  }
  
  await feed.renderFeed(type);
}

async function openCommentModal(postId) {
    const modal = document.getElementById("post-comments-modal");
    if (!modal) {
        console.error("Comments modal not found");
        return;
    }
    
    modal.classList.remove("hidden");
    modal.classList.add("active");
    
    const commentsContainer = document.getElementById("comments-container");
    if (!commentsContainer) {
        console.error("Comments container not found");
        return;
    }
    
    commentsContainer.innerHTML = feed.getLoadingSkeleton();
    
    const commentInput = document.getElementById("commentInput");
    if (commentInput) {
        commentInput.dataset.postId = postId;
        delete commentInput.dataset.parentId;
        commentInput.value = "";
    }
    
    try {
        const response = await api.get(`/posts/${postId}/comments`);
        
        if (response && response.status === "success") {
            if (!response.data.comments || response.data.comments.length === 0) {
                commentsContainer.innerHTML = `
                    <div class="empty-state" style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin: 0 auto 1rem; opacity: 0.3;">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                        </svg>
                        <p>No comments yet. Be the first to comment!</p>
                    </div>
                `;
                return;
            }
            
            const commentsHTML = feed.renderPostComments(response.data.comments);
            commentsContainer.innerHTML = commentsHTML;
        } else {
            commentsContainer.innerHTML = `
                <div class="error-state" style="text-align: center; padding: 3rem 1rem;">
                    <p style="color: var(--danger); margin-bottom: 1rem;">Error loading comments</p>
                    <button class="btn btn-primary" onclick="openCommentModal(${postId})">Try again</button>
                </div>
            `;
        }
    } catch (error) {
        showToast('Error loading comments: ' + error.message, 'error');
        commentsContainer.innerHTML = `
            <div class="error-state" style="text-align: center; padding: 3rem 1rem;">
                <p style="color: var(--danger); margin-bottom: 1rem;">Error loading comments: ${error.message}</p>
                <button class="btn btn-primary" onclick="openCommentModal(${postId})">Try again</button>
            </div>
        `;
    }
}

function toggleCommentSettings(commentId) {
  const settingsDiv = document.getElementById(`comment-settings-${commentId}`);
  if (settingsDiv) {
    settingsDiv.classList.toggle('hidden');
  }
}

async function toggleCommentLike(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/like`);
    if (response && response.status === 'success') {
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const likeBtn = commentCard.querySelector('.comment-action-btn');
        if (likeBtn) {
          likeBtn.classList.toggle('active');
        }
      }
    }
  } catch (error) {
    showToast('Error toggling comment like: ' + error.message, 'error');
  }
}

async function toggleCommentHelpful(commentId) {
  try {
    const response = await api.post(`/comments/${commentId}/mark-helpful`);
    if (response && response.status === 'success') {
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

async function showMoreReplies(commentId) {
  const btn = event.target;
  const page = parseInt(btn.dataset.page || 1) + 1;
  
  try {
    const response = await api.get(`/comments/${commentId}/replies?page=${page}`);
    if (response && response.status === 'success') {
      const commentCard = document.getElementById(`comment-card-${commentId}`);
      if (commentCard) {
        const repliesContainer = commentCard.querySelector('.replies-container');
        if (repliesContainer && response.data.replies) {
          const newRepliesHTML = feed.buildRepliesPreviewHTML(response.data.replies, commentId);
          repliesContainer.innerHTML += newRepliesHTML;
          btn.dataset.page = page;
        }
      }
    }
  } catch (error) {
    console.error('Error loading more replies:', error);
  }
}

async function viewThread(threadId) {
  const modal = document.getElementById("thread-view-modal");
  const modalBody = modal ? modal.querySelector('#thread-details-content') : null;
  
  if (!modal || !modalBody) {
    console.error("Thread modal not found");
    return;
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('active');
  modalBody.innerHTML = feed.getLoadingSkeleton();
  
  try {
    const response = await api.get(`/threads/${threadId}/details`);
    
    if (response && response.status === "success") {
      const data = response.data;
      
      if (!data || Object.keys(data).length === 0) {
        modalBody.innerHTML = `
          <div class="empty-state">
            <h1>No data found for this thread</h1>
          </div>`;
        return;
      }
      
      renderThreadDetails(data, modalBody);
    } else {
      modalBody.innerHTML = `
        <div class="error-state">
          <h1>Error loading thread data</h1>
          <button onclick="viewThread(${threadId})">Try again</button>
        </div>`;
    }
  } catch (error) {
    console.error("View thread error:", error);
    showToast("Error loading thread: " + error.message, "error");
    modalBody.innerHTML = `
      <div class="error-state">
        <h1>Error loading thread data</h1>
        <button onclick="viewThread(${threadId})">Try again</button>
      </div>`;
  }
}

function renderThreadDetails(thread, modalBody) {
    modalBody.innerHTML = `
        <div class="thread-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 class="thread-title" style="font-size: 1.25rem; font-weight: 600;">${thread.title}</h3>
            <span style="padding: 0.25rem 0.75rem; background: ${thread.requires_approval ? 'var(--warning)' : 'var(--success)'}; color: white; border-radius: 9999px; font-size: 0.75rem;">
                ${thread.requires_approval ? "🔒 Private" : "🌎 Public"}
            </span>
        </div>

        <p style="margin-bottom: 1rem; color: var(--text-secondary);">${thread.description || 'No description'}</p>

        ${thread.tags && thread.tags.length > 0 ? `
        <div style="margin-bottom: 1rem;">
            <strong>Tags:</strong> 
            ${thread.tags.map(tag => `<span class="tag" style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border-radius: 9999px; font-size: 0.875rem; margin-right: 0.5rem;">#${tag}</span>`).join('')}
        </div>
        ` : ''}

        <p style="margin-bottom: 0.5rem;"><strong>Department:</strong> ${thread.department || "None"}</p>
        <p style="margin-bottom: 1rem;"><strong>Members:</strong> ${thread.total_users} / ${thread.max_members || '∞'}</p>
        <p style="margin-bottom: 1rem;"><strong>Last Activity:</strong> ${new Date(thread.last_activity).toLocaleString()}</p>
         ${thread.members_data && thread.members_data.length > 0 ? `
        <h4 style="margin-bottom: 0.75rem;">Members Preview:</h4>
        <div class="member-list" style="display: flex; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.5rem;">
            ${thread.members_data.slice(0, 5).map(member => `
                <div class="member" style="text-align: center;">
                    <img src="${member.avatar || '/static/default-avatar.png'}" style="width: 48px; height: 48px; border-radius: 50%; margin-bottom: 0.25rem;">
                    <div class="member-name" style="font-size: 0.75rem; font-weight: 500;">${member.name.substring(0, 10)}</div>
                    <div class="member-reputation-level" style="font-size: 0.625rem; color: var(--text-secondary);">${member.reputation_level || ''}</div>
                </div>
            `).join('')}
            ${thread.members_data.length > 5 ? `<div style="font-size: 0.875rem; color: var(--text-secondary); align-self: center;">+${thread.members_data.length - 5} more</div>` : ""}
        </div>
        ` : ''}

        <div style="display: flex; gap: 0.75rem;">
            <button id="join-thread-btn" onclick="joinThread(${thread.id})" class="btn btn-primary" style="flex: 1;">
                Join Thread
            </button>
            <button onclick="closeModal('thread-view-modal')" class="btn btn-secondary">
                Cancel
            </button>
        </div>
    `;
}
async function followPost(postId) {
  try {
    const response = await api.post(`/posts/${postId}/follow`);
    if (response.status == "success") {
      showToast("Post followed, you will receive updates related to this post", "success");
      const btn = event.target;
      btn.textContent = "Unfollow Post";
      btn.onclick = function(e) {
        e.stopPropagation();
        unfollowPost(postId);
      };
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error following post: " + error.message, 'error');
  }
}

async function unfollowPost(postId) {
  try {
    const response = await api.post(`/posts/${postId}/unfollow`);
    if (response.status == "success") {
      showToast("Post unfollowed", "success");
      const btn = event.target;
      btn.textContent = "Follow Post";
      btn.onclick = function(e) {
        e.stopPropagation();
        followPost(postId);
      };
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error unfollowing post: " + error.message, 'error');
  }
}

async function deletePost(postId) {
  try {
    const response = await api.delete(`/posts/${postId}`);
    if (response.status == "success") {
      const postEl = document.querySelector(`[data-post-id="${postId}"]`);
      if (postEl) postEl.remove();
      showToast("Post deleted", "success");
    } else {
      showToast(response.message, 'error');
    }
  } catch (error) {
    showToast("Error deleting post: " + error.message, 'error');
  }
}

async function deleteComment(commentId) {
  try {
    const response = await api.delete(`/comments/${commentId}`);
    if (response.status == "success") {
      const commentEl = document.getElementById(`comment-card-${commentId}`);
      if (commentEl) commentEl.remove();
      showToast("Comment deleted", "success");
    } else {
      showToast(response.message, 'error');
    }
  } catch (error) {
    showToast("Error deleting comment: " + error.message, 'error');
  }
}

function setupBookmarkModalListeners() {
  const bookmarkModal = document.getElementById("bookmark-folders-modal");
  if (bookmarkModal) {
    bookmarkModal.addEventListener("click", async function(e) {
      if (e.target.closest(".bookmark-folder")) {
        const folder = e.target.dataset.value;
        const postId = e.target.dataset.id;
        if (folder && postId) {
          await bookmarkPost(folder, postId);
        }
      }
    });
  }
}

async function toggleBookmark(postId) {
  const btn = event.target;
  
  if (!btn.classList.contains('bookmarked')) {
    const folders = await feed.getBookmarkFolders();
    if (folders) {
      feed.renderBookmarkFolders(folders);
      openModal('bookmark-folders-modal');
    }
    return;
  }
  
  try {
    const response = await api.post(`/posts/${postId}/bookmark`);
    if (response.status == "success") {
      btn.classList.remove("bookmarked");
      const content = btn.textContent;
      const count = parseInt(content.replace(/\D/g, ""), 10) || 0;
      btn.textContent = `🔖${Math.max(0, count - 1)}`;
      showToast("Bookmark removed", "success");
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error removing bookmark: " + error.message, 'error');
  }
}

async function bookmarkPost(folder, postId) {
  try {
    const response = await api.post(`/posts/${postId}/bookmark`, { folder });
    
    if (response.status === "success") {
      showToast("Post bookmarked successfully", "success");
      const btn = event.target;
      if (btn) {
        btn.classList.add('bookmarked');
        const content = btn.textContent;
        const count = parseInt(content.replace(/\D/g, ""), 10) || 0;
        btn.textContent = `🔖${count + 1}`;
      }
      closeModal('bookmark-folders-modal');
    } else {
      showToast(response.message, "error");
    }
  } catch (error) {
    showToast("Error bookmarking post: " + error.message, 'error');
  }
}

async function joinThread(threadId) {
  const btn = document.getElementById("join-thread-btn");
  if (!btn) return;
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Joining...";
  
  try {
    const response = await api.post(`/threads/${threadId}/join`, {});
    
    if (response && response.status === "success") {
      btn.textContent = "✓ Joined";
      btn.classList.add("success");
      showToast("Successfully joined thread!", "success");
      
      setTimeout(() => {
        btn.style.display = "none";
      }, 2000);
    } else {
      btn.disabled = false;
      btn.textContent = originalText;
      showToast(response?.message || "Failed to join thread", 'error');
    }
  } catch (error) {
    console.error("Join thread error:", error);
    showToast("Join thread error: " + error.message, 'error');
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

function listenPost(postId) {
    const post = document.querySelector(`[data-post-id="${postId}"]`);
    if (!post) {
        showToast("Post not found", "error");
        return;
    }
    
    const textEl = post.querySelector('.post-content');
    if (!textEl) {
        showToast("No content to read", "error");
        return;
    }
    
    const text = textEl.textContent.trim();
    if (text) {
        const speech = new SpeechSynthesisUtterance(text);
        speech.rate = 1;
        speech.pitch = 1;
        speech.lang = "en-US";
        window.speechSynthesis.speak(speech);
        showToast("Reading post...", "info");
    } else {
        showToast("No content to read", "warning");
    }
}

function openForkModal(postId) {
    selectedForkTags = [];
    const modal = document.getElementById("post-fork-modal");
    if (!modal) {
        console.error("Fork modal not found");
        return;
    }
    
    modal.classList.remove('hidden');
    modal.classList.add('active');
    
    const post = document.querySelector(`[data-post-id="${postId}"]`);
    if (!post) {
        showToast("Post not found", "error");
        return;
    }
    
    const postContent = post.querySelector('.post-content');
    const postTitle = post.querySelector('.post-title');
    const postTypeLabel = post.querySelector('.post-type-label');
    const threadBadge = post.querySelector('.thread-badge');
    const postTags = post.querySelectorAll('.post-tags .tag');
    
    const modalContent = modal.querySelector('.post-content');
    const modalTitle = modal.querySelector('.post-title');
    const modalThreadToggle = modal.querySelector('.thread-enabled');
    const modalPostType = modal.querySelector('.post-type-selection');
    
    if (modalContent && postContent) modalContent.value = postContent.textContent.trim();
    if (modalTitle && postTitle) modalTitle.value = postTitle.textContent.trim();
    if (modalThreadToggle) modalThreadToggle.checked = !!threadBadge;
    if (modalPostType && postTypeLabel) modalPostType.value = postTypeLabel.textContent.trim();
    
    const tags = Array.from(postTags).map(tag => tag.textContent.replace('#', '').trim());
    const tagsContainer = modal.querySelector('.selected-fork-tags');
    
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        tags.slice(0, 5).forEach(tag => {
            const span = document.createElement("span");
            span.classList.add("tag-badge");
            span.dataset.value = tag;
            span.innerHTML = `${tag}<button type="button" class="tag-remove" onclick="removeForkTag('${tag}')">×</button>`;
            tagsContainer.appendChild(span);
            selectedForkTags.push(tag);
        });
    }
}

async function saveForkedPost(event) {
  event.preventDefault();
  
  const modal = document.getElementById("post-fork-modal");
  const saveBtn = modal.querySelector(".save-post");
  const title = modal.querySelector('.post-title').value;
  const content = modal.querySelector('.post-content').value;
  const thread_enabled = modal.querySelector(".thread-enabled").checked;
  const postType = modal.querySelector(".post-type-selection").value;
  
  const formData = {
    "title": title,
    "text_content": content,
    "thread_enabled": thread_enabled,
    "post_type": postType,
    "tags": selectedForkTags
  };
  
  if (saveBtn) saveBtn.disabled = true;
  
  try {
    const response = await api.post("/posts/create", formData);
    if (response.status == "success") {
      showToast("Post created successfully", "success");
      closeModal("post-fork-modal");
      selectedForkTags = [];
      return;
    }
    showToast(response.message, 'error');
  } catch (error) {
    showToast(error.message, 'error');
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

function addForkTag(tag) {
  if (selectedForkTags.length >= maxForkTags) {
    showToast(`You can only add up to ${maxForkTags} tags`, 'info');
    return;
  }
  
  if (!selectedForkTags.includes(tag)) {
    selectedForkTags.push(tag);
    renderSelectedForkTags();
  }
  
  const input = document.getElementById('fork-tags-input');
  if (input) input.value = '';
  
  const dropdown = document.getElementById('fork-tags-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

function removeForkTag(tag) {
  selectedForkTags = selectedForkTags.filter(t => t !== tag);
  renderSelectedForkTags();
}

function renderSelectedForkTags() {
  const container = document.getElementById('selected-fork-tags');
  if (!container) return;
  
  container.innerHTML = selectedForkTags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeForkTag('${tag}')">×</button>
    </span>`
  ).join('');
}

function togglePostOptions(postId) {
  const optionsDiv = document.getElementById(`options-${postId}`);
  
  if (!optionsDiv) {
    console.warn(`Options menu not found for post ${postId}`);
    return;
  }
  
  document.querySelectorAll('.advanced-post-options').forEach(menu => {
    if (menu.id !== `options-${postId}`) {
      menu.classList.add('hidden');
    }
  });
  
  optionsDiv.classList.toggle('hidden');
}

function downloadResource(url, filename) {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function reportPost(postId) {
  try {
    const response = await api.post(`/posts/${postId}/report`);
    if (response.status == "success") {
      showToast("Post reported, our admin will review and take action", 'info');
      const btn = event.target;
      if (btn) btn.remove();
    } else {
      showToast(response.message, 'error');
    }
  } catch (error) {
    showToast("Report post error: " + error.message, 'error');
  }
}

function openReplyModal(username, commentId, postId) {
  const inputBox = document.getElementById("commentInput");
  
  if (!inputBox) {
    console.error("Comment input not found");
    return;
  }
  
  inputBox.dataset.postId = postId;
  inputBox.dataset.parentId = commentId;
  
  inputBox.value = `@${username} `;
  inputBox.focus();
  
  inputBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function postComment(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const inputBox = document.getElementById("commentInput");
    if (!inputBox) {
        showToast("Comment input not found", "error");
        return;
    }
    
    const textContent = inputBox.value.trim();
    
    if (!textContent) {
        showToast("Comment cannot be empty", "warning");
        return;
    }
    
    const postId = inputBox.dataset.postId;
    const parentId = inputBox.dataset.parentId || null;
    
    if (!postId) {
        showToast("Invalid post context", "error");
        return;
    }
    
    const btn = document.getElementById("postCommentBtn");
    if (!btn) {
        showToast("Post button not found", "error");
        return;
    }
    
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Posting...";
    
    try {
        const data = await api.post("/comments/create", {
            post_id: postId,
            text_content: textContent,
            parent_id: parentId,
            resources: replyResources
        });
        
        if (data.status === "success") {
            inputBox.value = "";
            delete inputBox.dataset.postId;
            delete inputBox.dataset.parentId;
            
            const previewArea = document.getElementById("previewArea");
            if (previewArea) previewArea.innerHTML = "";
            
            replyUrls = [];
            replyFiles = [];
            replyResources = [];
            
            const newComment = data.data.comment;
            if (newComment) {
                appendCommentToUI(newComment, parentId);
            }
            
            showToast("Comment posted successfully!", "success");
        } else {
            showToast(data.message || "Failed to post comment", "error");
        }
    } catch (error) {
        console.error("Post comment error:", error);
        showToast("Error posting comment: " + error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

function appendCommentToUI(comment, parentId) {
  const commentsContainer = document.getElementById("comments-container");
  
  if (!commentsContainer) return;
  
  const commentHTML = feed.createCommentCard(comment);
  
  if (parentId) {
    const parentCard = document.getElementById(`comment-card-${parentId}`);
    
    if (parentCard) {
      let repliesContainer = parentCard.querySelector('.replies-container');
      
      if (!repliesContainer) {
        repliesContainer = document.createElement('div');
        repliesContainer.className = 'replies-container';
        parentCard.appendChild(repliesContainer);
      }
      
      repliesContainer.insertAdjacentHTML('beforeend', commentHTML);
    }
  } else {
    commentsContainer.insertAdjacentHTML('afterbegin', commentHTML);
  }
}

// ============================================================================
// REACTION SYSTEM
// ============================================================================

function setupReactionListeners() {
  const reactionMenu = document.getElementById("reactionMenu");
  
  if (!reactionMenu) {
    console.warn("Reaction menu not found");
    return;
  }
  
  document.querySelectorAll(".post-card .reaction-btn").forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  
  document.querySelectorAll(".post-card .reaction-btn").forEach(btn => {
    btn.addEventListener("mousedown", function(e) {
      e.preventDefault();
      reactionBtn = btn;
      startPress(e);
    });

    btn.addEventListener("mouseup", cancelPress);
    btn.addEventListener("mouseleave", cancelPress);

    btn.addEventListener("touchstart", function(e) {
      e.preventDefault();
      reactionBtn = btn;
      startPress(e);
    }, { passive: false });

    btn.addEventListener("touchend", cancelPress);
    btn.addEventListener("touchmove", cancelPress);
    
    btn.addEventListener("click", function(e) {
      if (longPressTimer) return;
      
      e.stopPropagation();
      const postCard = btn.closest(".post-card");
      const postId = postCard?.dataset.postId;
      
      if (postId) {
        const reactionEl = btn.querySelector('.post-reaction') || btn.querySelector('.post-like') || btn;
        toggleReactions("like", "👍", 0, false, postId, reactionEl);
      }
    });
  });
  
  reactionMenu.addEventListener("click", async function(e) {
    const reactionType = e.target.dataset.reaction;
    if (!reactionType || !reactionBtn) return;

    const postReactionEl = reactionBtn.querySelector('.post-reaction') || reactionBtn.querySelector('.post-like') || reactionBtn;
    const reacted = postReactionEl.classList.contains("reacted");
    const text = postReactionEl.textContent.trim();

    const match = text.match(/^(.)\s*(\d+)?/);
    const oldEmoji = match?.[1] || "👍";
    const oldCount = parseInt(match?.[2]) || 0;

    const postCard = reactionBtn.closest(".post-card");
    const postId = postCard?.dataset.postId;

    if (postId) {
      await toggleReactions(reactionType, oldEmoji, oldCount, reacted, postId, postReactionEl);
    }

    reactionMenu.classList.add("hidden");
    cancelPress();
  });
}

function startPress(e) {
  longPressTimer = setTimeout(() => {
    showReactions(e);
    longPressTimer = null;
  }, longPressTime);
}

function cancelPress() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

function showReactions(e) {
  const reactionMenu = document.getElementById("reactionMenu");
  if (!reactionMenu) return;
  
  reactionMenu.classList.remove("hidden");

  const target = e.target.closest('.reaction-btn') || e.target;
  const rect = target.getBoundingClientRect();
  const menuWidth = 320;
  const menuHeight = 60;
  
  let left = rect.left + (rect.width / 2) - (menuWidth / 2);
  let top = rect.top - menuHeight - 10;
  
  if (left < 10) left = 10;
  if (left + menuWidth > window.innerWidth - 10) {
    left = window.innerWidth - menuWidth - 10;
  }
  
  if (top < 10) {
    top = rect.bottom + 10;
  }
  
  reactionMenu.style.left = left + "px";
  reactionMenu.style.top = top + "px";
}

async function toggleReactions(newType, oldEmoji, oldCount, reacted, postId, element) {
    try {
        const response = await api.post(`/posts/${postId}/react`, { reaction_type: newType });

        if (response.status !== "success") {
            return showToast(response.message, "error");
        }

        const newEmoji = getReactionType(newType);

        if (reacted) {
            if (newEmoji === oldEmoji) {
                element.textContent = `👍 ${oldCount - 1}`;
                element.classList.remove("reacted");
            } else {
                element.textContent = `${newEmoji} ${oldCount}`;
                element.classList.add("reacted");
            }
        } else {
            element.textContent = `${newEmoji} ${oldCount + 1}`;
            element.classList.add("reacted");
        }

    } catch (error) {
        showToast("Post reaction error: " + error.message, "error");
    }
}

// ============================================================================
// BULK SELECTION SYSTEM
// ============================================================================

function attachBulkSelectionListeners() {
  document.querySelectorAll(".post-card").forEach(post => {
    const clone = post.cloneNode(true);
    post.parentNode.replaceChild(clone, post);
  });
  
  document.querySelectorAll(".post-card").forEach(post => {
    post.addEventListener("touchstart", function(e) {
      if (e.target.closest('button, a, .post-action')) return;
      startBulk(e, post);
    });
    post.addEventListener("touchend", clearBulk);
    post.addEventListener("touchmove", clearBulk);

    post.addEventListener("mousedown", function(e) {
      if (e.target.closest('button, a, .post-action')) return;
      startBulk(e, post);
    });
    post.addEventListener("mouseup", clearBulk);
    post.addEventListener("mouseleave", clearBulk);

    post.addEventListener("click", function(e) {
      if (isHighlightMode && !e.target.closest('button, a, .post-action')) {
        e.preventDefault();
        e.stopPropagation();
        togglePostSelection(post);
      }
    });
  });
}

function startBulk(e, post) {
  longPressTimeout = setTimeout(() => {
    isHighlightMode = true;
    highlightPost(post);
    const bulkBtn = document.getElementById("bulk-bookmark");
    if (bulkBtn) bulkBtn.classList.remove("hidden");
  }, longPressTime);
}

function clearBulk() {
  clearTimeout(longPressTimeout);
}

function highlightPost(post) {
  const postId = post.dataset.postId;
  
  if (post.classList.contains("choosed")) {
    post.classList.remove("choosed");
    selectedPosts.delete(postId);
  } else {
    post.classList.add("choosed");
    selectedPosts.add(postId);
  }
  
  const bulkBtn = document.getElementById("bulk-bookmark");
  if (bulkBtn) {
    if (selectedPosts.size > 0) {
      bulkBtn.classList.remove("hidden");
      bulkBtn.textContent = `Bookmark ${selectedPosts.size} post${selectedPosts.size > 1 ? 's' : ''}`;
    } else {
      bulkBtn.classList.add("hidden");
      isHighlightMode = false;
    }
  }
}

function togglePostSelection(post) {
  if (!isHighlightMode) return;
  highlightPost(post);
}

async function bookmarkPosts() {
  const selected = [...document.querySelectorAll(".post-card.choosed")];
  if (selected.length === 0) {
    showToast("No posts selected", "warning");
    return;
  }

  const postIds = selected.map(p => p.dataset.postId);

  try {
    const response = await api.post('/posts/bulk/bookmark', { ids: postIds });

    if (response.status !== "success") {
      showToast(response.message || "Bookmark error", "error");
      return;
    }

    showToast("Posts bookmarked!", "success");

  } catch (error) {
    showToast("Bookmark error: " + error.message, "error");
  } finally {
    selected.forEach(p => p.classList.remove("choosed"));
    selectedPosts.clear();
    isHighlightMode = false;
    const bulkBtn = document.getElementById("bulk-bookmark");
    if (bulkBtn) bulkBtn.classList.add("hidden");
  }
}

// ============================================================================
// VIEW TRACKING SYSTEM
// ============================================================================

function setupViewTracking() {
  if (viewObserver) {
    viewObserver.disconnect();
  }
  
  viewObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const postId = entry.target.getAttribute("data-post-id");
        
        if (postId) {
          sendView(postId);
          viewObserver.unobserve(entry.target);
        }
      }
    });
  }, {
    threshold: 0.4,
    rootMargin: '0px'
  });
  
  document.querySelectorAll(".post-card[data-post-id]").forEach(post => {
    viewObserver.observe(post);
  });
}

async function sendView(postId) {
  try {
    await api.post(`/posts/${postId}/view`, {});
  } catch (error) {
    console.debug("View tracking error:", postId, error);
  }
}

// ============================================================================
// ADDITIONAL HELPER FUNCTIONS
// ============================================================================

function viewProfile(username) {
    if (typeof username === 'number') {
        window.location.href = `/profile/${username}`;
    } else {
        window.location.href = `/profile/${username}`;
    }
}

async function sharePost(postId) {
    const shareData = {
        title: 'Check out this post on LearnHub',
        url: `${window.location.origin}/posts/${postId}`
    };
    
    if (navigator.share) {
        try {
            await navigator.share(shareData);
            showToast('Post shared successfully!', 'success');
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
            }
        }
    } else {
        navigator.clipboard.writeText(shareData.url);
        showToast('Link copied to clipboard!', 'success');
    }
}

function openLearnora(postId) {
    showToast('Learnora feature coming soon!', 'info');
}

async function connectRequest(userId) {
    try {
        const response = await api.post(`/connections/request/${userId}`);
        if (response && response.status === 'success') {
            showToast('Connection request sent!', 'success');
            const btn = event.target;
            if (btn) {
                btn.textContent = "Pending";
                btn.disabled = true;
            }
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('Error sending request: ' + error.message, 'error');
    }
}

function setupFileUploadListeners() {
  const uploadImage = document.getElementById("uploadImage");
  const uploadVideo = document.getElementById("uploadVideo");
  const uploadDoc = document.getElementById("uploadDoc");
  const previewArea = document.getElementById("previewArea");
  
  if (!uploadImage || !uploadVideo || !uploadDoc || !previewArea) {
    console.warn("Comment upload inputs not found");
    return;
  }
  
  [uploadImage, uploadVideo, uploadDoc].forEach(input => {
    input.addEventListener("change", async function(e) {
      const files = Array.from(e.target.files);
      
      if (files.length === 0) return;
      
      for (const file of files) {
        if (!file) continue;
        
        const previewDiv = document.createElement("div");
        previewDiv.className = "preview-item";
        previewDiv.style.cssText = "position: relative; display: inline-block; margin: 0.5rem;";
        
        let media;
        if (file.type.startsWith("image/")) {
          media = document.createElement("img");
          media.src = URL.createObjectURL(file);
          media.style.cssText = "max-width: 150px; max-height: 150px; border-radius: 8px;";
        } else if (file.type.startsWith("video/")) {
          media = document.createElement("video");
          media.src = URL.createObjectURL(file);
          media.controls = true;
          media.style.cssText = "max-width: 150px; max-height: 150px; border-radius: 8px;";
        } else {
          media = document.createElement("div");
          media.className = "file-name";
          media.textContent = file.name;
          media.style.cssText = "padding: 1rem; background: var(--bg-tertiary); border-radius: 8px; font-size: 0.875rem;";
        }
        
        previewDiv.appendChild(media);
        
        const loader = document.createElement("div");
        loader.className = "loader";
        loader.style.cssText = "position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(0,0,0,0.7); color: white; padding: 0.5rem; border-radius: 4px; font-size: 0.75rem;";
        loader.textContent = "Uploading...";
        const btn = document.createElement('button');
        btn.className = "cancel-upload";
        btn.textContent = "×";
        btn.style.cssText = "position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; display: none;";
        
        previewDiv.appendChild(loader);
        previewDiv.appendChild(btn);
        previewArea.appendChild(previewDiv);
        
        try {
          const formData = new FormData();
          formData.append("file", file);
          
          const result = await api.post("/posts/resource/upload", formData);
          
          if (result.status === "success") {
            const resource = {
              url: result.data.url,
              type: result.data.type,
              filename: result.data.filename
            };
            replyResources.push(resource); 
            const secureUrl = result.data.url;
            const resourceType = result.data.type;
            
            replyUrls.push({
              url: secureUrl,
              type: resourceType,
              filename: file.name
            });
            
            replyFiles.push(file);
            
            loader.remove();
            btn.style.display = "block";
            
            btn.onclick = function() {
              previewDiv.remove();
              replyUrls = replyUrls.filter(r => r.url !== secureUrl);
              replyFiles = replyFiles.filter(f => f !== file);
              replyResources = replyResources.filter(r => r.url !== resource.url);
            };
          } else {
            loader.textContent = "Failed";
            loader.style.background = "var(--danger)";
            showToast("Upload failed: " + (result.message || "Unknown error"), "error");
          }
        } catch (error) {
          console.error("Upload error:", error);
          loader.textContent = "Error";
          loader.style.background = "var(--danger)";
          showToast("Error uploading file", "error");
        }
      }
      
      e.target.value = "";
    });
  });
}

function setupForkTagsListeners() {
  const forkTagsDropdown = document.getElementById("fork-tags-dropdown");
  const forkTagInput = document.getElementById("fork-tags-input");
  
  if (!forkTagInput || !forkTagsDropdown) {
    console.warn("Fork tags elements not found");
    return;
  }

  forkTagInput.addEventListener("input", function(e) {
    const input = e.target.value.toLowerCase();
    
    if (input.length === 0) {
      forkTagsDropdown.classList.add("hidden");
      return;
    }
    
    if (selectedForkTags.length >= maxForkTags) {
      forkTagsDropdown.classList.add('hidden');
      return;
    }
    
    const relatedTags = availableTags.filter(tag => 
      tag.toLowerCase().includes(input) && !selectedForkTags.includes(tag)
    );
    
    if (relatedTags.length > 0) {
      forkTagsDropdown.innerHTML = relatedTags.slice(0, 10).map(tag => 
        `<div class="tag-option" onclick="addForkTag('${tag}')">${tag}</div>`
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
      if (value && selectedForkTags.length < maxForkTags) {
        addForkTag(value);
      }
    }
  });
}

function viewResource(url, type) {
    if (typeof resourceViewer !== 'undefined') {
        resourceViewer.viewResource(url, type);
    } else {
        console.error('Resource viewer not loaded');
        showToast('Resource viewer unavailable', 'error');
    }
}

async function viewCommentResources(commentId) {
    try {
        const response = await api.get(`/comments/${commentId}/resources`);
        
        if (response && response.status === "success") {
            const resources = response.data.resources || [];
            
            const mediaResources = resources.filter(r => 
                r.type === 'image' || r.type === 'video'
            );
            
            if (mediaResources.length === 0) {
                showToast('No media resources available', 'info');
                return;
            }
            
            if (typeof resourceViewer !== 'undefined') {
                resourceViewer.resources = mediaResources;
                resourceViewer.currentIndex = 0;
                resourceViewer.viewAllResources();
            }
        }
    } catch (error) {
        console.error('View comment resources error:', error);
        showToast('Error loading resources', 'error');
    }
}

function searchTag(tag) {
    showToast(`Searching for tag: ${tag}`, 'info');
    navigateTo('search');
}

// ============================================================================
// EVENT LISTENER CLEANUP
// ============================================================================

document.addEventListener('click', function(e) {
  const reactionMenu = document.getElementById("reactionMenu");
  if (reactionMenu && !reactionMenu.contains(e.target) && !e.target.closest('.reaction-btn')) {
    reactionMenu.classList.add("hidden");
  }
  
  if (!e.target.closest('.post-options-btn') && !e.target.closest('.advanced-post-options')) {
    document.querySelectorAll('.advanced-post-options').forEach(menu => {
      menu.classList.add('hidden');
    });
  }
});

// ============================================================================
// SETUP LISTENERS
// ============================================================================

async function setupListeners() {
  console.log('Setting up listeners...');
  
  const threadToggle = document.getElementById("thread-toggle");
  if (threadToggle) {
    threadToggle.addEventListener("click", function(e) {
      const threadModal = document.getElementById("thread-modal");
      if (threadModal) {
        threadModal.classList.toggle("active");
      }
    });
  }
  
  const uploadDiv = document.getElementById("upload-div");
  if (uploadDiv) {
    uploadDiv.onclick = function() {
      const modal = document.querySelector(".modal-uploads");
      if (modal) {
        modal.classList.add("active");
      } else {
        console.warn("Upload modal not found");
      }
    };
  }
  
  const bulkBookmarkBtn = document.getElementById("bulk-bookmark");
  if (bulkBookmarkBtn) {
    bulkBookmarkBtn.onclick = bookmarkPosts;
  }
  
  setupFileUploadListeners();
  setupForkTagsListeners();
  setupBookmarkModalListeners();
  
  console.log('Listeners setup complete');
}
// Mark post as solved
async function markSolved(postId) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Marking...";
    
    try {
        const response = await api.post(`/posts/${postId}/mark-solved`);
        
        if (response && response.status === "success") {
            btn.textContent = "✓ Marked Solved";
            btn.classList.add("success");
            showToast("Post marked as solved!", "success");
            
            // Update UI
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const header = postCard.querySelector('.post-header');
                if (header && !header.querySelector('.solved-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'solved-badge';
                    badge.textContent = '✓ Solved';
                    header.appendChild(badge);
                }
            }
            
            setTimeout(() => {
                btn.onclick = function(e) {
                    e.stopPropagation();
                    markunSolved(postId);
                };
                btn.textContent = "❌ Mark Unsolved";
                btn.disabled = false;
                btn.classList.remove("success");
            }, 2000);
        } else {
            btn.disabled = false;
            btn.textContent = originalText;
            showToast(response?.message || "Failed to mark as solved", 'error');
        }
    } catch (error) {
        console.error("Mark solved error:", error);
        showToast("Mark solved error: " + error.message, 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Mark post as unsolved
async function markunSolved(postId) {
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Unmarking...";
    
    try {
        const response = await api.post(`/posts/${postId}/mark-unsolved`);
        
        if (response && response.status === "success") {
            btn.textContent = "✓ Unmarked";
            showToast("Post marked as unsolved", "success");
            
            // Update UI
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const solvedBadge = postCard.querySelector('.solved-badge');
                if (solvedBadge) {
                    solvedBadge.remove();
                }
            }
            
            setTimeout(() => {
                btn.onclick = function(e) {
                    e.stopPropagation();
                    markSolved(postId);
                };
                btn.textContent = "✅ Mark Solved";
                btn.disabled = false;
            }, 2000);
        } else {
            btn.disabled = false;
            btn.textContent = originalText;
            showToast(response?.message || "Failed to unmark", 'error');
        }
    } catch (error) {
        console.error("Unmark solved error:", error);
        showToast("Unmark solved error: " + error.message, 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// Mark comment as solution
async function markSolution(postId, commentId, event) {
    event.stopPropagation();
    const btn = event.target;
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Marking...";
    
    try {
        const response = await api.post(`/posts/${postId}/mark-solution`, {
            comment_id: commentId
        });
        
        if (response && response.status === "success") {
            showToast("Comment marked as solution!", "success");
            
            // Update UI
            const commentCard = document.getElementById(`comment-card-${commentId}`);
            if (commentCard) {
                const header = commentCard.querySelector('.comment-header');
                if (header && !header.querySelector('.solution-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'solution-badge';
                    badge.textContent = '✓ Solution';
                    header.appendChild(badge);
                }
                
                // Remove the mark as solution button
                btn.remove();
            }
            
            // Mark post as solved
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
            if (postCard) {
                const postHeader = postCard.querySelector('.post-header');
                if (postHeader && !postHeader.querySelector('.solved-badge')) {
                    const solvedBadge = document.createElement('span');
                    solvedBadge.className = 'solved-badge';
                    solvedBadge.textContent = '✓ Solved';
                    postHeader.appendChild(solvedBadge);
                }
            }
        } else {
            btn.disabled = false;
            btn.textContent = originalText;
            showToast(response?.message || "Failed to mark as solution", 'error');
        }
    } catch (error) {
        console.error("Mark solution error:", error);
        showToast("Error marking solution: " + error.message, 'error');
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

// View all resources for a post
async function viewAllResources(postId) {
    try {
        const response = await api.get(`/posts/${postId}/resources`);
        
        if (response && response.status === "success") {
            const resources = response.data.resources || [];
            
            // Filter for media resources only
            const mediaResources = resources.filter(r => 
                r.type === 'image' || r.type === 'video'
            );
            
            if (mediaResources.length === 0) {
                showToast('No media resources available', 'info');
                return;
            }
            
            // Use the resource viewer if available
            if (typeof resourceViewer !== 'undefined') {
                resourceViewer.resources = mediaResources;
                resourceViewer.currentIndex = 0;
                resourceViewer.viewAllResources();
            } else {
                // Fallback: open first resource
                window.open(mediaResources[0].url, '_blank');
            }
        }
    } catch (error) {
        console.error('View all resources error:', error);
        showToast('Error loading resources', 'error');
    }
}

// Connect with user (used in widgets)
async function connectUser(userId) {
    try {
        const response = await api.post(`/connections/request/${userId}`);
        if (response && response.status === 'success') {
            showToast('Connection request sent!', 'success');
            const btn = event.target;
            if (btn) {
                btn.textContent = "Pending";
                btn.disabled = true;
                btn.classList.add('disabled');
            }
        } else {
            showToast(response.message, 'error');
        }
    } catch (error) {
        showToast('Error sending request: ' + error.message, 'error');
    }
}

// Post refinement - from newfeed.html
async function refinePost(postId) {
    try {
        const modal = document.getElementById("post-refine-modal");
        if (!modal) {
            console.error("Refine modal not found");
            return;
        }
        
        modal.classList.remove("hidden");
        modal.classList.add("active");
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
        
        const response = await api.get(`/posts/${postId}/quick-view`);
        
        if (response && response.status === "success") {
            const post = response.data;
            const origTitle = document.getElementById("original-title");
            const origContent = document.getElementById("original-content");
            if (origTitle) origTitle.textContent = post.title;
            if (origContent) origContent.textContent = post.content || "[No content]";
            
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
async function startRefinement(postId) {
    try {
        const instructionsEl = document.getElementById("refinement-instructions");
        const instructions = instructionsEl ? instructionsEl.value : "";
        
        const response = await fetch(`/student/posts/${postId}/refine`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ instructions })
        });
        
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
        
        if (refinedTitleEl) refinedTitleEl.classList.remove("loading");
        if (refinedContentEl) refinedContentEl.classList.remove("loading");
        
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
                            if (statusEl) statusEl.innerHTML = '<div class="loading-indicator"><div class="spinner"></div><span>Analyzing and refining...</span></div>';
                        }
                        else if (parsed.content) {
                            fullResponse += parsed.content;
                            
                            const titleMatch = fullResponse.match(/"title"\s*:\s*"([^"]+)"/);
                            const contentMatch = fullResponse.match(/"content"\s*:\s*"([^"]+)"/);
                            
                            if (titleMatch) {
                                refinedTitle = titleMatch[1]
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\');
                                if (refinedTitleEl) refinedTitleEl.textContent = refinedTitle;
                            }
                            
                            if (contentMatch) {
                                refinedContent = contentMatch[1]
                                    .replace(/\\n/g, '\n')
                                    .replace(/\\"/g, '"')
                                    .replace(/\\\\/g, '\\');
                                if (refinedContentEl) refinedContentEl.textContent = refinedContent;
                            }
                        }
                        else if (parsed.type === 'retry') {
                            if (statusEl) statusEl.innerHTML = `<div class="warning-indicator">⚠️ Retrying with backup provider...</div>`;
                        }
                        else if (parsed.type === 'done') {
                            if (parsed.success && parsed.refined) {
                                currentRefinement = parsed.refined;
                                if (refinedTitleEl) refinedTitleEl.textContent = parsed.refined.title;
                                if (refinedContentEl) refinedContentEl.textContent = parsed.refined.content;
                                
                                if (statusEl) statusEl.innerHTML = '<div class="success-indicator">✅ Refinement complete!</div>';
                                const actionsEl = document.getElementById("refine-actions");
                                if (actionsEl) actionsEl.classList.remove("hidden");
                            } else {
                                if (statusEl) statusEl.innerHTML = '<div class="error-indicator">❌ Failed to refine. Please try again.</div>';
                                
                                if (parsed.raw_response && refinedContentEl) {
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
                            if (statusEl) statusEl.innerHTML = `<div class="error-indicator">❌ ${e.message}</div>`;
                        }
                    }
                }
            }
        }
        
    } catch (error) {
        console.error("Refinement stream error:", error);
        const statusEl = document.getElementById("refine-status");
        if (statusEl) statusEl.innerHTML = 
            `<div class="error-indicator">❌ Error: ${error.message}</div>`;
    }
}

async function applyRefinement(postId) {
    if (!currentRefinement) {
        showToast("No refinement to apply", "error");
        return;
    }
    
    const applyBtn = document.getElementById("apply-btn");
    const originalText = applyBtn ? applyBtn.textContent : "";
    
    try {
        if (applyBtn) {
            applyBtn.disabled = true;
            applyBtn.textContent = "Applying...";
        }
        
        const response = await api.post(`/posts/${postId}/apply-refinement`, currentRefinement);
        
        if (response && response.status === "success") {
            showToast("✨ Post refined successfully!", "success");
            
            const postCard = document.querySelector(`[data-post-id="${postId}"]`);
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
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.textContent = originalText;
        }
    }
}

function closeRefineModal() {
    const modal = document.getElementById("post-refine-modal");
    if (modal) {
        modal.classList.add("hidden");
        modal.classList.remove("active");
        modal.innerHTML = "";
    }
    currentRefinement = null;
}

// ============================================================================
// INITIALIZATION - SINGLE SOURCE OF TRUTH
// ============================================================================

console.log('feed.js: Script loaded at', new Date().toISOString());

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

async function initializeApp() {
    console.log('=== LearnHub Feed Initialization Started ===');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Document ready state:', document.readyState);
    
    try {
        console.log('Step 1: Checking dependencies...');
        
        if (typeof api === 'undefined') {
            throw new Error('❌ API helper not loaded. Check if api.js is loaded before feed.js');
        }
        console.log('✓ API helper found');
        
        if (typeof showToast === 'undefined') {
            console.warn('⚠️ showToast not available - using alert fallback');
            window.showToast = function(msg, type) { 
                console.log(`[${type}] ${msg}`);
                alert(msg); 
            };
        }
        console.log('✓ showToast available');
        
        console.log('Step 2: Setting up event listeners...');
        await setupListeners();
        console.log('✓ Event listeners ready');
        
        console.log('Step 3: Initializing feed system...');
        await initFeed();
        console.log('✓ Feed initialized successfully');
        
        console.log('Step 4: Setting up interaction features...');
        
        setupReactionListeners();
        console.log('✓ Reaction listeners ready');
        
        setupViewTracking();
        console.log('✓ View tracking ready');
        
        attachBulkSelectionListeners();
        console.log('✓ Bulk selection ready');
        
        console.log('Step 5: Initializing pull-to-refresh...');
        if (typeof PullToRefresh !== 'undefined') {
            pullToRefresh = new PullToRefresh();
            console.log('✓ Pull-to-refresh initialized');
        } else {
            console.warn('⚠️ PullToRefresh class not found');
        }
        
        console.log('=== ✅ All systems initialized successfully ===');
        showToast('Feed loaded successfully!', 'success');
        
    } catch (error) {
        console.error('=== ❌ INITIALIZATION FAILED ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        
        const errorMsg = `Failed to load feed: ${error.message}\n\nPlease refresh the page or contact support if the issue persists.`;
        
        if (typeof showToast !== 'undefined') {
            showToast(errorMsg, 'error');
        } else {
            alert(errorMsg);
        }
        
        const feedContainer = document.getElementById('feed-all');
        if (feedContainer) {
            feedContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--danger, #dc3545);">
                    <h3 style="margin-bottom: 1rem;">⚠️ Failed to Load Feed</h3>
                    <p style="margin-bottom: 1rem;">${error.message}</p>
                    <button onclick="window.location.reload()" 
                            style="padding: 0.75rem 1.5rem; background: var(--primary, #007bff); color: white; border: none; border-radius: 0.5rem; cursor: pointer;">
                        Reload Page
                    </button>
                </div>
            `;
        }
    }
}
  
   