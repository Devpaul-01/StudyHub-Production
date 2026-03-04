/**
 * ============================================================================
 * FEED TEMPLATES - REFACTORED
 * All HTML template generation using data-action attributes
 * NO inline onclick handlers
 * ============================================================================
 */
import { POST_TYPE_ICONS, REACTION_TYPES, CAN_SOLVE_TYPES, MAX_DISPLAY_RESOURCES, MAX_COMMENT_PREVIEW_RESOURCES } from './feed.constants.js';
import { formatTime } from './feed.utils.js';

/**
 * Get post type icon
 */
function getPostTypeIcon(type) {
  return POST_TYPE_ICONS[type] || POST_TYPE_ICONS.discussion;
}

/**
 * Get reaction emoji
 */
export function getReactionType(type) {
  return REACTION_TYPES[type] || REACTION_TYPES.like;
}

/**
 * Build resources HTML for posts
 */
export function buildResourcesHTML(resources, postId) {
  if (!resources || resources.length === 0) return '';
  
  const maxDisplay = MAX_DISPLAY_RESOURCES;
  const displayResources = resources.slice(0, maxDisplay);
  const remainingCount = resources.length - maxDisplay;
  
  const mediaItems = [];
  const documentItems = [];
  
  displayResources.forEach((resource, index) => {
    if (resource.type === "image") {
      mediaItems.push(`
        <div class="post-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}" 
               data-action="view-resource"
               data-post-id="${postId}"
               data-index="${index}">
        </div>
      `);
    } else if (resource.type === "video") {
      mediaItems.push(`
        <div class="post-resource media-resource" data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-action="view-resource"
                 data-post-id="${postId}"
                 data-index="${index}">
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
          <button class="download-btn" 
                  data-action="download-resource"
                  data-url="${resource.url}"
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
  
  if (remainingCount > 0) {
    mediaItems.push(`
      <div class="post-resource more-resources" 
           data-action="view-resource"
           data-post-id="${postId}"
           data-index="${maxDisplay}">
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

/**
 * Build comment resources HTML
 */
export function buildCommentResourcesHTML(resources, commentId, postId) {
  if (!resources || resources.length === 0) return '';
  
  const maxDisplay = MAX_COMMENT_PREVIEW_RESOURCES;
  const displayResources = resources.slice(0, maxDisplay);
  const remainingCount = resources.length - maxDisplay;
  
  const mediaItems = [];
  const documentItems = [];
  
  displayResources.forEach((resource, index) => {
    if (resource.type === "image") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="image">
          <img src="${resource.url}" 
               alt="${resource.filename || 'Image'}" 
               data-action="view-comment-resource"
               data-comment-id="${commentId}"
               data-index="${index}">
        </div>
      `);
    } else if (resource.type === "video") {
      mediaItems.push(`
        <div class="comment-resource media-resource" data-type="video">
          <video src="${resource.url}" 
                 controls 
                 data-action="view-comment-resource"
                 data-comment-id="${commentId}"
                 data-index="${index}">
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
          <button class="download-btn" 
                  data-action="download-resource"
                  data-url="${resource.url}"
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
  
  if (remainingCount > 0) {
    mediaItems.push(`
      <div class="comment-resource more-resources"
           data-action="view-comment-resource"
           data-comment-id="${commentId}"
           data-index="${maxDisplay}">
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

/**
 * Build comments preview HTML (for feed)
 */
export function buildCommentsPreviewHTML(comments, postId) {
  if (!comments || comments.length === 0) return '';
  
  const commentCards = comments.map(comment => `
    <div class="comment-preview" 
         data-action="open-comments"
         data-post-id="${postId}">
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

export function createRepliesCard(replies, parentId) {
  if (!replies || replies.length === 0) return '';

  const replyCards = replies.map(comment => {
    const author = comment.author || {};
    const resourcesHTML = buildCommentResourcesHTML(
      comment.resources || [],
      comment.id,
      comment.post_id
    );

    return `
      <div 
        data-resources='${JSON.stringify(comment.resources || {}).replace(/'/g, "&apos;")}'
        data-post-id="${comment.post_id}"
        data-comment-id="${comment.id}"
        data-depth="${comment.depth_level}"
        class="comment-card"
        data-parent-id="${parentId}"
        id="comment-card-${comment.id}"
      >
        <div class="comment-header">
          <img 
            src="${author.avatar || '/static/default-avatar.png'}"
            data-action="view-profile"
            data-username="${author.username || ''}"
            alt="${author.name || 'User'}"
            class="avatar"
            onerror="this.src='/static/default-avatar.png'"
          >

          <div class="comment-author">
            <div 
              data-action="view-profile"
              data-username="${author.username || ''}"
              class="comment-author-name"
            >
              ${author.name || 'Anonymous'}
            </div>
            <div class="comment-time">${formatTime(comment.posted_at)}</div>
          </div>

          ${comment.is_solution ? '<span class="solution-badge">✓ Solution</span>' : ''}
        </div>

        <div class="comment-content">${comment.text_content}</div>

        ${resourcesHTML}

        <div class="comment-actions">
          <button 
            class="comment-action-btn ${comment.user_interactions?.has_liked ? 'active' : ''}"
            data-action="toggle-comment-like"
          >
            👍 ${comment.likes_count > 0 ? comment.likes_count : 'Like'}
          </button>

          <button 
            class="comment-action-btn ${comment.user_interactions?.has_marked_helpful ? 'active' : ''}"
            data-action="toggle-comment-helpful"
          >
            💡 ${comment.helpful_count > 0 ? comment.helpful_count : 'Helpful'}
          </button>

          ${
            !comment.is_you &&
            comment.user_interactions?.is_author &&
            !comment.post_is_solved &&
            !comment.is_solution
              ? `
            <button 
              data-comment-id="${comment.id}"
              class="comment-action-btn"
              data-action="mark-solution"
            >
              🧠 Mark as Solution
            </button>`
              : ''
          }

          ${
            comment.is_you
              ? `
            <button class="comment-action-btn" data-action="toggle-comment-settings">
              ⋯
            </button>`
              : ''
          }
        </div>

        ${
          comment.is_you
            ? `
          <div>
            <button class="delete-comment hidden" data-action="delete-comment">
              🗑️ Delete
            </button>
          </div>`
            : ''
        }
      </div>
    `;
  }).join('');

  return replyCards;
}



/**
 * Build post options menu
 */
export function buildPostOptionsMenu(post, canSolveType) {
  return `
    <div class="advanced-post-options hidden" id="options-${post.id}">
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

/**
 * Create post card HTML
 */
export function createPostCard(post) {
  const tags = post.tags?.map(tag => `<span class="tag">#${tag}</span>`).join('') || '';
  const postTypeIcon = getPostTypeIcon(post.post_type);
  const canSolveType = CAN_SOLVE_TYPES.includes(post.post_type);
  const resourcesHTML = buildResourcesHTML(post.resources, post.id);
  const commentsPreviewHTML = buildCommentsPreviewHTML(post.comments, post.id);
  
  return `
    <div data-resources='${JSON.stringify(post.resources).replace(/'/g, "&apos;").replace(/"/g, "&quot;")}' 
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
      
      ${buildPostOptionsMenu(post, canSolveType)}
      
      <div class="post-type-indicator">
        <span style="display: flex; align-items: center;">${postTypeIcon}</span>
        <span class="post-type-label" style="text-transform: capitalize;">${post.post_type}</span>
      </div>
      
      <div class="post-title">${post.title}</div>
      <div class="post-content">${post.excerpt || ''}</div>
      
      ${resourcesHTML}
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

/**
 * Create comment card HTML
 */
export function createCommentCard(comment) {
  const author = comment.author;
  const resourcesHTML = buildCommentResourcesHTML(comment.resources, comment.id, comment.post_id);
  const replies = comment.replies;
  const repliesHTML = createRepliesCard(replies, comment.id);
  
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
      
      ${resourcesHTML}
      
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
        
        ${comment.is_you ?
          `<button class="comment-action-btn" data-action="toggle-comment-settings">
            ⋯
          </button>` : ''}
      </div>
      
      ${comment.is_you ? `
        <div>
          <button class="delete-comment hidden" data-action="delete-comment">🗑️ Delete</button>
        </div>
      ` : ''}
      
      ${repliesHTML}
    </div>
  `;
}

export function createLocalCommentCard(comment) {
  const author = comment.author;
  const resourcesHTML = buildCommentResourcesHTML(comment.resources, comment.id, comment.post_id);
  const repliesHTML = createRepliesCard(comment.replies, comment.id);
  
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
      
      ${resourcesHTML}
      
      <div class="comment-actions">
        <button class="comment-action-btn ${comment.user_interactions?.has_liked ? 'active' : ''}" 
                data-action="toggle-comment-like">
          👍 ${comment.likes_count > 0 ? comment.likes_count : 'Like'}
        </button>
        ${comment.is_you ?
          `<button class="comment-action-btn" data-action="toggle-comment-settings">
            ⋯
          </button>` : ''}
      </div>
      
      ${comment.is_you ? `
        <div>
          <button class="delete-comment hidden" data-action="delete-comment">🗑️ Delete</button>
        </div>
      ` : ''}
    ${repliesHTML}
    
    </div>
  `;
}

/**
 * Render thread details HTML
 */
export function renderThreadDetailsHTML(thread) {
  return `
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
      <button id="join-thread-btn" 
              data-action="join-thread"
              class="btn btn-primary" 
              style="flex: 1;">
        Join Thread
      </button>
      <button data-action='close-modal' data-modal-id='thread-view-modal'class="btn btn-secondary">
        Cancel
      </button>
    </div>
  `;
}