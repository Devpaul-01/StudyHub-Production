function getPostTypeIcon(type) {
  return POST_TYPE_ICONS[type] || POST_TYPE_ICONS.discussion;
}
export function createBookmarkPostCard(post) {
  const tags = post.tags?.map(tag => `
    <span class="tag" data-action="view-tag-posts" data-tag="${tag}" style="display: inline-block; padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border-radius: 9999px; font-size: 0.875rem; margin-right: 0.5rem; cursor: pointer;">#${tag}</span>
  `).join('') || '';
  
  const postTypeIcon = getPostTypeIcon(post.post_type);
  const resourceLinkHTML = post.resources ? buildResourceLinks(post.resources) : '';
  const canSolveType = CAN_SOLVE_TYPES.includes(post.post_type);
  const length = post.resources?.length || 0;
  
  const resourcesHTML = post.resources?.length > 0 
    ? buildPostResourcesContainer(post.resources, post.id)
    : '';
  
  const commentsPreviewHTML = buildCommentsPreviewHTML(post.comments, post.id);
  
  return `
    <div data-resource-length="${length}" 
         data-resources='${JSON.stringify(post.resources || []).replace(/'/g, "&apos;").replace(/"/g, "&quot;")}' 
         id="post-${post.id}" 
         data-post-id="${post.id}" 
         class="post-card"
         style="background: var(--bg-primary); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; position: relative;">
      
      <!-- ✅ NEW: Bulk Bookmark Checkbox -->
      <div class="bulk-select-checkbox" style="position: absolute; top: 1rem; left: 1rem; z-index: 10;">
        <input type="checkbox" 
               class="post-select-checkbox" 
               data-post-id="${post.id}"
               data-action="toggle-bulk-select"
               style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);">
      </div>
      
      <div class="post-header" style="display: flex; align-items: flex-start; gap: 1rem; margin-left: 2.5rem;">
        <img data-action="view-profile" 
             data-username="${post.author.username}"
             src="${post.author?.avatar || '/static/default-avatar.png'}" 
             alt="${post.author?.name}" 
             class="avatar" 
             onerror="this.src='/static/default-avatar.png'"
             style="width: 48px; height: 48px; border-radius: 50%; cursor: pointer;">
        
        <div class="post-author" style="flex: 1;">
         <div class="post-author-info" style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
            <div data-action="view-profile" 
                 data-username="${post.author.username}"
                 class="post-author-name"
                 style="font-weight: 600; cursor: pointer;">
              ${post.author?.name || 'Anonymous'}
            </div>
            ${!post.is_author && !post.connection_status ?
              `<button data-action="connect-request" 
                       data-user-id="${post.author?.id}"
                       style="padding: 0.25rem 0.75rem; background: var(--primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                🤝 Connect
              </button>` : ''}
            ${!post.is_author && post.connection_status ?
              `<button class="connection-btn disabled" style="padding: 0.25rem 0.75rem; background: var(--bg-tertiary); border: none; border-radius: 4px; font-size: 0.75rem; cursor: default;">${post.connection_status}</button>` : ''}
          </div>
          <div class="post-time" style="font-size: 0.875rem; color: var(--text-secondary);">${formatTime(post.posted_at)}</div>
          
          ${post.is_solved || post.thread_enabled ? `
            <div class="post-header-badges" style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
              ${post.is_solved ? '<span class="solved-badge" style="padding: 0.25rem 0.5rem; background: var(--success); color: white; border-radius: 4px; font-size: 0.75rem;">✓ Solved</span>' : ''}
              ${post.thread_enabled ? '<span class="thread-badge" style="padding: 0.25rem 0.5rem; background: var(--info); color: white; border-radius: 4px; font-size: 0.75rem;">🧵 Thread</span>' : ''}
            </div>
          ` : ''}
        </div>
        
        <button data-action="toggle-post-options"
                class="post-options-btn" 
                id="options-btn-${post.id}"
                style="padding: 0.5rem; background: var(--bg-tertiary); border: none; border-radius: 4px; cursor: pointer; font-size: 1.25rem; position: relative;">
          ⋯
        </button>
      </div>
      
      <div class="advanced-options" style="position: relative;">
        ${buildPostOptionsMenu(post, canSolveType)}
      </div>
      
      <div class="post-type-indicator" style="display: flex; align-items: center; gap: 0.5rem; margin-top: 1rem; margin-left: 2.5rem;">
        <span style="display: flex; align-items: center;">${postTypeIcon}</span>
        <span class="post-type-label" style="text-transform: capitalize; font-size: 0.875rem; color: var(--text-secondary);">${post.post_type}</span>
      </div>
      
      ${post.title ? `<div class="post-title" style="font-size: 1.25rem; font-weight: 600; margin-top: 1rem; margin-left: 2.5rem;">${post.title}</div>` : ''}
      <div class="post-content" style="margin-top: 0.75rem; line-height: 1.6; margin-left: 2.5rem;">${post.excerpt || post.text_content || ''}</div>
      
      ${resourcesHTML}
      
      ${post.resources?.length > 0 ? `
        <button class="btn-toggle-details" 
                data-action="view-post-resource-links"
                style="margin-top: 1rem; padding: 0.5rem 1rem; background: var(--bg-secondary); border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%;">
          <span class="toggle-text">Show Download Links</span>
          <svg class="toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class='resource-link-modal hidden' style="margin-top: 0.5rem; padding: 1rem; background: var(--bg-secondary); border-radius: 8px;">${resourceLinkHTML}</div>
      ` : ''}
        
      ${tags ? `<div class="post-tags" style="margin-top: 1rem;">${tags}</div>` : ''}
      ${commentsPreviewHTML}
      
      <div class="post-stats" style="display: flex; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
        <button class="stat-btn reaction-btn ${post.user_interactions?.user_reacted ? 'reacted' : ''}" 
          data-action="toggle-reactions"
          data-reaction="${post.user_interactions?.user_reacted ? post.user_interactions.reaction_type : 'like'}"
          style="padding: 0.5rem 1rem; background: ${post.user_interactions?.user_reacted ? 'var(--primary)' : 'var(--bg-secondary)'}; color: ${post.user_interactions?.user_reacted ? 'white' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          ${post.user_interactions?.user_reacted ?
            `<span class="post-reaction reacted">${getReactionType(post.user_interactions.reaction_type)} ${post.reactions_count || 0}</span>` :
            `<span class="post-reaction">👍 ${post.reactions_count || 0}</span>`}
        </button>
        
        <button data-action="open-comments" 
                class="stat-item"
                style="padding: 0.5rem 1rem; background: var(--bg-secondary); border: none; border-radius: 4px; cursor: pointer;">
          💬 ${post.comments_count || 0}
        </button>
        
        <button data-action="toggle-bookmark" class="stat-item bookmark-btn ${post.user_interactions?.bookmarked ? 'bookmarked' : ''}"
          title="Save post"
          style="padding: 0.5rem 1rem; background: ${post.user_interactions?.bookmarked ? 'var(--warning)' : 'var(--bg-secondary)'}; color: ${post.user_interactions?.bookmarked ? 'white' : 'var(--text-primary)'}; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;"
        >
          <span class="bookmark-icon">
            <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16" fill="currentColor">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
            </svg>
          </span>
          ${post.bookmarks_count > 0 ? `<span class="bookmark-count">${post.bookmarks_count}</span>` : ''}
        </button>
      </div>
    </div>
  `;
}