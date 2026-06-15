/**
 * ============================================================================
 * FEED TEMPLATES
 * All HTML template generation - no DOM manipulation, pure string returns
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

/**
 * Build comment resources HTML
 */
export function buildCommentResourcesHTML(resources, commentId) {
  if (!resources || resources.length === 0) return '';
  
  const maxDisplay = MAX_COMMENT_PREVIEW_RESOURCES;
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

/**
 * Build comments preview HTML (for feed)
 */
export function buildCommentsPreviewHTML(comments, postId) {
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

/**
 * Build replies preview HTML
 */
export function buildRepliesPreviewHTML(replies, parentId) {
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

/**
 * Build post options menu
 */
export function buildPostOptionsMenu(post, canSolveType) {
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
    <div data-post-id=${post.id} class="post-card" data-id="post-${post.id}">
      <div class="post-header">
        <img onclick="viewProfile('${post.author.username}')" src="${post.author?.avatar || '/static/default-avatar.png'}" 
             alt="${post.author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="post-author">
          <div onclick="viewProfile('${post.author.username}')" class="post-author-name">${post.author?.name || 'Anonymous'}</div>
          <div class="post-time">${formatTime(post.posted_at)}</div>
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
      
      ${buildPostOptionsMenu(post, canSolveType)}
      
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

/**
 * Create comment card HTML
 */
export function createCommentCard(comment) {
  const author = comment.author;
  const resourcesHTML = buildCommentResourcesHTML(comment.resources, comment.id);
  const repliesHTML = buildRepliesPreviewHTML(comment.replies, comment.id);
  
  return `
    <div data-postId=${comment.post_id} data-depth="${comment.depth_level}" class="comment-card" id="comment-card-${comment.id}">
      <div class="comment-header">
        <img src="${author?.avatar || '/static/default-avatar.png'}" 
             onclick="viewProfile('${comment.author.username}')"
             alt="${author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'">
        <div class="comment-author">
          <div onclick="viewProfile('${comment.author.username}')" class="comment-author-name">${author?.name || 'Anonymous'}</div>
          <div class="comment-time">${formatTime(comment.posted_at)}</div>
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
        `<button class="comment-action-btn" onclick="event.stopPropagation(); openReplyModal('${comment.author.username}',${comment.id},${comment.post_id})">💬 Reply</button>` : 
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
      <button id="join-thread-btn" onclick="joinThread(${thread.id})" class="btn btn-primary" style="flex: 1;">
        Join Thread
      </button>
      <button onclick="closeModal('thread-view-modal')" class="btn btn-secondary">
        Cancel
      </button>
    </div>
  `;
}