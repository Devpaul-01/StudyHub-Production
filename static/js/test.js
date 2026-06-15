//scroll from right to left
function postResourceScrollListeners(){
  const feedSection = document.querySelector('section#feed');
  const target = event.target;
  if(!event.target.dataset.action == 'scroll-post-resource') return;
  let scrollThreshold = 30px;
  let startX;
  let endX;
  feedSection.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
  }, {passive:True});
  feedSection.addEventListener("touchend", (e) => {
    endX = e.changedTouches[0].clientX;
  }, {passive:True});
  const target = e.target;
  const index = target.dataset.index;
  if(Math.abs(endX-startX) > scrollThreshold){
    if(endX-startX > 0){
      handlescrollPostResources(index, target, right);
    }
    else{
      handlescrollPostResources(index, target, left);
    }
  }
  }
  
}
*/
export function buildPostOptionsMenu(post, canSolveType) {
  return `
    <div class="advanced-post-options" id="options-${post.id}">
      <button data-action="report-post">🚩 Report Post</button>
      <button data-action="fork-post">🔀 Fork Post</button>
      <button data-action="open-learnora">🤖 Ask Learnora</button>
      <button data-action="share-post">📤 Share</button>
      
      ${post.thread_enabled && !post.user_interactions?.requested_thread ?
      `<button data-action="view-thread" data-thread-id="${post.id}" data-thread-type="post">🧵 Join Thread</button>` : ''}
      
      ${post.user_interactions?.user_followed ?
      `<button class="handle-follow-btn" data-action="unfollow-post">👁️ Unfollow</button>` :
      `<button class="handle-follow-btn" data-action="follow-post">👁️ Follow</button>`}
      
      ${post.is_author ? `
        <button data-action="refine-post">✨ Refine Post</button>
        <button data-action="delete-post">🗑️ Delete Post</button>
        ${canSolveType ? 
          post.is_solved && post.is_author?
            `<button data-action="unmark-solved">❌ Mark Unsolved</button>` :
            `<button data-action="mark-solved">✅ Mark Solved</button>`
          : ''}
      ` : ''}
      
      <button data-action="listen-post">🔊 Listen (Audio)</button>
    </div>
  `;
}

function togglePostOptions(postId, event){
  const post = event.target.closest(".post-card");
  const optionsHTML = post.querySelector(".advanced-options").innerHTML;
  const modal = document.getElementById("advanced-post-options-modal");
  const contentModal = modal.querySelector('modal-content');
  contentModal.innerHTML = optionsHTML;
  modal.classList.remove('hidden');
}




class ResourceViewer {
  constructor() {
    this.currentIndex = 0;
    this.resources = [];
    this.initializeModals();
    this.commentResources = null;
  }
  setCommentResources(resources){
    this.commentResources = resources;
  }
  showCommentResources(){
    let html;
    const modal = document.getElementById("comment-resources-modal");
    const resources = this.commentResources;
    if(!resources || resources.length ==0){
      const html = `<div class='empty-state'>
       <h1>No resources found for this comments</h1>
      </div>`
      modal.appendChild(html);
    }
    else{
      html = resources.map(resource => {
      createResourceCard(resource).join("")
      });
      modal.appendChild(html);
    }
    modal.classList.remove('hidden');
  }
  createResourceCard(resource){
    const type = resource.type;
    const url = resource.url;
    let media;
    if(type == 'image'){
     media = document.createElement('img');
     media.className = 'comment-resource';
   }
   elif(type == 'video'){
     media = document.createElement('video');
     media.className = 'comment-resource';
   }
   return `<div class='resource-container'>
     ${media}</div>`
    
  }


export function buildPostResourceHTML(resource, postId, length) {
  let mediaItem;
  if (!resource)  return '';
  if (resource.type === "image") {
      mediaItem = `
        <div data-action='scroll-post-resource'  class="post-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}" 
               data-post-id="${postId}"
               data-index=1>
        </div>
      `
    } else if (resource.type === "video") {
     mediaItem = 
      `
        <div class="post-resource media-resource" data-action='scroll-post-resource'data-index=1 data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-post-id="${postId}"
                 data-index="${index}">
          </video>
        </div>
      `);
    } else { 
      mediaItem = 
        `
        <div class="post-resource document-resource" data-action='scroll-post-resource' data-index=1 data-type="document">
        <span class='post-resource-count'>'1/${length}'</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${resource.filename || 'Document'}</span>
                  data-filename="${resource.filename}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </button>
        </div>
      `
    }
  });
    html =${mediaItem};
  return html;
  
  export function buildCommentResourcesHTML(resources, commentId, postId) {
  const hasMore = resources.length > 0? true:false;
  if(hasMore){
    const remaining = resources.length - 1;
  }
  const resource = resources[0];
  if (!resource) return '';
  let mediaItems = [];
  if (resource.type === "image") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}"
               data-action='view-comment-resource'
               data-url="${resource.url}"
               data-resource-type='image'
               data-comment-id="${commentId}"
               data-index="${index}">
        </div>
      `;
    } else if (resource.type === "video") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-comment-id="${commentId}"
                 data-index="${index}">
                 data-action='view-comment-resource'
               data-url="${resource.url}"
               data-resource-type='video'
          </video>
        </div>
      `;
    } else {
      mediaItems.push (`
        <div class="comment-resource document-resource" data-type="document">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${resource.filename || 'Document'}</span>
          <button class="download-btn" 
                  data-filename="${resource.filename}">
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
  if(hasMore){
    mediaItems.push(`<div data-action='view-comment-resources' data-resources=${comment.resources} class="comment-more" >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
          <span class="document-name">${remaining}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        </div>
  }
  
  let html = '';
    html += `<div class="resource-container media-grid">${mediaItems}.join("")</div>`;
  }
  return html;
}
export function buildReesourceLinks(resources){
  if(!resources || resources.length == 0) return''
  const linkHTML = resources.map(resource => {
    `<div class='resource-link-container' data-url=${resource.url}>
      <button class="download-btn" data-action='download-resource' data-url=${resource.url} aria-label="Download">
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M12 3V14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M7 10L12 15L17 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <path d="M5 21H19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
</button>`
}).join("");
return linkHTML;
export function createPostCard(post) {
  const tags = post.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || '';
  const postTypeIcon = getPostTypeIcon(post.post_type);
  const resourceLinkHTML = post.resources? buildResourceLinks(post.resources): '';
  const canSolveType = CAN_SOLVE_TYPES.includes(post.post_type);
  const resourcesHTML = buildPostResourcesHTML(post.resources[0], post.id, post.resources.length);
  const commentsPreviewHTML = buildCommentsPreviewHTML(post.comments, post.id);
  
  return `
    <div data-resource-length=${post.resources.length} data-resources='${JSON.stringify(post.resources).replace(/'/g, "&apos;").replace(/"/g, "&quot;")}' 
         id="post-${post.id}" 
         data-post-id="${post.id}" 
         class="post-card">
      <div class="post-header">
        <img data-action="view-profile" 
             data-username="${post.author.username}"
             src="${post.author?.avatar || '/static/default-avatar.png'}" 
             alt="${post.author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        
        <div class="post-author">
          <div class="post-author-info">
            <div data-action="view-profile" 
                 data-username="${post.author.username}"
                 class="post-author-name">
              ${post.author?.name || 'Anonymous'}
            </div>
            ${!post.is_author && !post.connection_status ?
              `<button data-action="connect-request" data-user-id="${post.author?.id}">
                🤝 Connect
              </button>` : ''}
            ${!post.is_author && post.connection_status ?
              `<button class="connection-btn disabled">${post.connection_status}</button>` : ''}
          </div>
          <div class="post-time">${formatTime(post.posted_at)}</div>
          
          ${post.is_solved || post.thread_enabled ? `
            <div class="post-header-badges">
              ${post.is_solved ? '<span class="solved-badge">✓ Solved</span>' : ''}
              ${post.thread_enabled ? '<span class="thread-badge">🧵 Thread</span>' : ''}
            </div>
          ` : ''}
        </div>
        
        <button data-action="toggle-post-options"
                class="post-options-btn" 
                id="options-btn-${post.id}">
          ⋯
        </button>
      </div>
      
      <div class='advanced-options hidden'>
       ${buildPostOptionsMenu(${post}, ${canSolveType})}
      
      <div class="post-type-indicator">
        <span style="display: flex; align-items: center;">${postTypeIcon}</span>
        <span class="post-type-label" style="text-transform: capitalize;">${post.post_type}</span>
      </div>
      
      <div class="post-title">${post.title}</div>
      <div class="post-content">${post.excerpt || ''}</div>
      <div class='resource-container'>
      ${resourcesHTML}
      </div>
      ${post.resources?
        <h1>Download Medias</button>
        <button class="btn-toggle-details" data-action="view-post-resource-links">
        <span class="toggle-text">Show Download Links</span>
        <svg class="toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
        <div class='resource-link-modal hidden'>${resourceLinkHTML}</div>}
        
      ${tags ? `<div class="post-tags">${tags}</div>` : ''}
      ${commentsPreviewHTML}
      
      <div class="post-stats">
        <button class="stat-btn reaction-btn" 
        data-action="toggle-reactions"
        data-reaction="${post.user_interactions?.user_reacted ? post.user_interactions.reaction_type : 'like'}">
  ${post.user_interactions?.user_reacted ?
    `<span class="post-reaction reacted">${getReactionType(post.user_interactions.reaction_type)} ${post.reactions_count || 0}</span>` :
    `<span data-action=toggleReactions() data-reaction='like' class="post-reaction">👍 ${post.reactions_count || 0}</span>`}
    <span data-action="open-comments" class="stat-item">
          💬 ${post.comments_count || 0}
        </span>
        ${post.bookmarks_count > 0
  ? `
  <span
    data-action="toggle-bookmark"
    class="stat-item bookmark-btn ${post.user_interactions?.bookmarked ? 'bookmarked' : ''}"
    title="Save post"
  >
    <span class="bookmark-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
    <span class="bookmark-count">${post.bookmarks_count}</span>
  </span>
  `
  : `
  <span
    data-action="toggle-bookmark"
    class="stat-item bookmark-btn ${post.user_interactions?.bookmarked ? 'bookmarked' : ''}"
    title="Save post"
  >
    <span class="bookmark-icon">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
      </svg>
    </span>
  </span>
  `
}
      </div>
    </div>
  `;
}
export function createCommentCard(comment) {
  const author = comment.author;
  const resourceHTML = buildCommentResourcesHTML(comment.resources, comment.id, comment.post_id);
  const replies = comment.replies;
  const repliesHTML = createRepliesCard(replies, comment.id);
  const resourceLinkHTML = buildResourceLinks(comment.resources);
  
  return `
    <div data-resources='${JSON.stringify(comment.resources).replace(/'/g, "&apos;")}' 
         data-post-id="${comment.post_id}"
         data-comment-id="${comment.id}"
         data-depth="${comment.depth_level}" 
         class="comment-card" 
         id="comment-card-${comment.id}">
      <div class="comment-header">
        <img src="${author?.avatar || '/static/default-avatar.png'}" 
             data-action="view-profile"
             data-username="${comment.author.username}"
             alt="${author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="comment-author">
          <div data-action="view-profile" 
               data-username="${comment.author.username}"
               class="comment-author-name">${author?.name || 'Anonymous'}</div>
          <div class="comment-time">${formatTime(comment.posted_at)}</div>
        </div>
        ${comment.is_solution ? '<span class="solution-badge">✓ Solution</span>' : ''}
      </div>
      
      <div class="comment-content">${comment.text_content}</div>
      
      ${resourceHTML}
      
      <div class="comment-actions">
        <button class="comment-action-btn ${comment.user_interactions?.has_liked ? 'active' : ''}" 
                data-action="toggle-comment-like">
          👍 ${comment.likes_count > 0 ? comment.likes_count : 'Like'}
        </button>
        
        <button class="comment-action-btn ${comment.user_interactions?.has_marked_helpful ? 'active' : ''}" 
                data-action="toggle-comment-helpful">
          💡 ${comment.helpful_count > 0 ? comment.helpful_count : 'Helpful'}
        </button>
        
        ${!comment.is_you && comment.user_interactions.is_author && !comment.post_is_solved && !comment.is_solution ?
          `<button data-comment-id="${comment.id}" 
                   class="comment-action-btn" 
                   data-action="mark-solution">
            🧠 Mark as Solution
          </button>` : ''}
          
        ${comment.depth_level < 3 ?
        `<button class="comment-action-btn" 
                 data-action="open-reply"
                 data-username="${comment.author.username}"
                 data-comment-id="${comment.id}"
                 data-post-id="${comment.post_id}">💬 Reply</button>` : 
        `<span class="disabled-text">Max reply depth reached</span>`}
        
        <button class="comment-action-btn" data-action="toggle-comment-settings">
            ⋯
      </button>
      </div>
      <div class='advanced-comment-options hidden'>
      ${comment.is_you ? `
          <button class="delete-comment hidden" data-action="delete-comment">🗑️ Delete</button>
      ` : ''}
    ${comment.resources?
     `<button class='resource-btn' data-action='view-comment-resource-links' data-resources=${comment.resources}>Download Medias</button>`: ''}
     </div>
      ${repliesHTML}
    </div>
  `;
}