/**
 * ============================================================================
 * FEED RENDERING
 * DOM manipulation only - reads from state, renders to DOM
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import { WIDGET_ORDER } from './feed.constants.js';
import { getLoadingSkeleton, hasWidgetData } from './feed.utils.js';
import { createPostCard, createCommentCard, renderThreadDetailsHTML } from './feed.templates.js';
import { createWidget } from './feed.widgets.js';

/**
 * Render feed for a specific filter
 */
export async function renderFeed(filterType) {
  const containerId = `feed-${filterType}`;
  const container = document.getElementById(containerId);
  
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Show loading state
  container.innerHTML = getLoadingSkeleton();

  const posts = feedState.getPosts(filterType);

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

  const feedHTML = interleaveFeed(posts);
  container.innerHTML = feedHTML;
}

/**
 * Interleave posts with widgets
 */
function interleaveFeed(posts) {
  const items = [];
  let widgetIndex = 0;
  const widgets = feedState.getWidgets();

  posts.forEach((post, index) => {
    items.push(createPostCard(post));

    WIDGET_ORDER.forEach(({ id, every }) => {
      if ((index + 1) % every === 0 && hasWidgetData(widgets[id])) {
        items.push(createWidget(id, widgetIndex++, widgets));
      }
    });
  });

  return items.join('');
}

/**
 * Render post comments in modal
 */
export function renderPostComments(comments) {
  return comments.map(comment => createCommentCard(comment)).join('');
}

/**
 * Append new comment to UI
 */
export function appendCommentToUI(comment, parentId) {
  const commentsContainer = document.getElementById("comments-container");
  
  if (!commentsContainer) return;
  
  const commentHTML = createCommentCard(comment);
  
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

/**
 * Render bookmark folders in modal
 */
export function renderBookmarkFolders(folders) {
  const bookmarkModal = document.getElementById("bookmark-folders-modal");
  
  if (!bookmarkModal) return;
  
  // Clear existing content
  const modalBody = bookmarkModal.querySelector('.modal-body');
  if (modalBody) {
    modalBody.innerHTML = '';
  }
  
  if (folders && folders.length > 0) {
    folders.forEach(folder => {
      const div = document.createElement("div");
      div.classList.add("bookmark-folder");
      div.textContent = folder;
      div.dataset.value = folder;
      modalBody.appendChild(div);
    });
  } else {
    const div = document.createElement("div");
    div.classList.add("bookmark-folder");
    div.textContent = "Saved";
    div.dataset.value = "Saved";
    modalBody.appendChild(div);
  }
  
  const btn = document.createElement('button');
  btn.textContent = "Cancel";
  btn.onclick = () => {
    if (typeof closeModal === 'function') {
      closeModal("bookmark-folders-modal");
    }
  };
  modalBody.appendChild(btn);
}

/**
 * Render thread details in modal
 */
export function renderThreadDetails(thread) {
  const modal = document.getElementById("thread-view-modal");
  if (!modal) return;
  
  const modalBody = modal.querySelector('#thread-details-content');
  if (modalBody) {
    modalBody.innerHTML = renderThreadDetailsHTML(thread);
  }
}

/**
 * Render selected fork tags
 */
export function renderSelectedForkTags() {
  const container = document.getElementById('selected-fork-tags');
  if (!container) return;
  
  const tags = feedState.getForkTags();
  container.innerHTML = tags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeForkTag('${tag}')">×</button>
    </span>`
  ).join('');
}
export function renderSelectedPostTags() {
  const container = document.getElementById('selected-tags');
  if (!container) return;
  
  const tags = feedState.getPostTags();
  container.innerHTML = tags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeTag('${tag}')">×</button>
    </span>`
  ).join('');
}
export function renderSelectedForkTags() {
  const container = document.getElementById('selected-fork-tags');
  if (!container) return;
  
  const tags = feedState.getForkTags();
  container.innerHTML = tags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeForkTag('${tag}')">×</button>
    </span>`
  ).join('');
}
export function renderSelectedThreadTags() {
  const container = document.getElementById('thread-selected-tags');
  if (!container) return;
  
  const tags = feedState.getThreadTags();
  container.innerHTML = tags.map(tag => 
    `<span data-value="${tag}" class="tag-badge">
      ${tag}
      <button type="button" class="tag-remove" onclick="removeThreadTag('${tag}')">×</button>
    </span>`
  ).join('');
}


/**
 * Update filter button active state
 */
export function updateFilterButtons(filterType) {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr && onclickAttr.includes(`'${filterType}'`)) {
      btn.classList.add('active');
    }
  });
}

/**
 * Update feed container visibility
 */
export function updateFeedContainerVisibility(filterType) {
  document.querySelectorAll('.posts-feed').forEach(container => {
    container.classList.remove('active');
  });
  
  const targetContainer = document.getElementById(`feed-${filterType}`);
  if (targetContainer) {
    targetContainer.classList.add('active');
  }
}

/**
 * Update bulk bookmark button
 */
export function updateBulkBookmarkButton() {
  const bulkBtn = document.getElementById("bulk-bookmark");
  const selectedCount = feedState.getSelectedPosts().length;
  
  if (bulkBtn) {
    if (selectedCount > 0) {
      bulkBtn.classList.remove("hidden");
      bulkBtn.textContent = `Bookmark ${selectedCount} post${selectedCount > 1 ? 's' : ''}`;
    } else {
      bulkBtn.classList.add("hidden");
      feedState.setHighlightMode(false);
    }
  }
}

/**
 * Highlight post for bulk selection
 */
export function highlightPost(post) {
  const postId = post.dataset.postId;
  
  if (post.classList.contains("choosed")) {
    post.classList.remove("choosed");
    feedState.togglePostSelection(postId);
  } else {
    post.classList.add("choosed");
    feedState.togglePostSelection(postId);
  }
  
  updateBulkBookmarkButton();
}

/**
 * Clear all post highlights
 */
export function clearAllHighlights() {
  document.querySelectorAll(".post-card.choosed").forEach(p => {
    p.classList.remove("choosed");
  });
  feedState.clearSelectedPosts();
  feedState.setHighlightMode(false);
  updateBulkBookmarkButton();
}

/**
 * Update reaction display
 */
export function updateReactionDisplay(postId, emoji, count, isReacted) {
  const post = document.querySelector(`[data-post-id="${postId}"]`);
  if (!post) return;
  
  const reactionBtn = post.querySelector('.reaction-btn');
  if (!reactionBtn) return;
  
  const element = reactionBtn.querySelector('.post-reaction') || 
                  reactionBtn.querySelector('.post-like') || 
                  reactionBtn;
  
  if (element) {
    element.textContent = `${emoji} ${count}`;
    if (isReacted) {
      element.classList.add('reacted');
    } else {
      element.classList.remove('reacted');
    }
  }
}

/**
 * Show reaction menu
 */
export function showReactionMenu(event) {
  const reactionMenu = document.getElementById("reactionMenu");
  if (!reactionMenu) return;
  
  reactionMenu.classList.remove("hidden");

  const target = event.target.closest('.reaction-btn') || event.target;
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

/**
 * Hide reaction menu
 */
export function hideReactionMenu() {
  const reactionMenu = document.getElementById("reactionMenu");
  if (reactionMenu) {
    reactionMenu.classList.add("hidden");
  }
}

/**
 * Update comment like button
 */
export function updateCommentLikeButton(commentId, isLiked) {
  const commentCard = document.getElementById(`comment-card-${commentId}`);
  if (commentCard) {
    const likeBtn = commentCard.querySelector('.comment-action-btn');
    if (likeBtn) {
      if (isLiked) {
        likeBtn.classList.add('active');
      } else {
        likeBtn.classList.remove('active');
      }
    }
  }
}

/**
 * Update comment helpful button
 */
export function updateCommentHelpfulButton(commentId, isHelpful) {
  const commentCard = document.getElementById(`comment-card-${commentId}`);
  if (commentCard) {
    const helpfulBtn = commentCard.querySelectorAll('.comment-action-btn')[1];
    if (helpfulBtn) {
      if (isHelpful) {
        helpfulBtn.classList.add('active');
      } else {
        helpfulBtn.classList.remove('active');
      }
    }
  }
}

/**
 * Remove post from DOM
 */
export function removePostFromDOM(postId) {
  const postEl = document.querySelector(`[data-post-id="${postId}"]`);
  if (postEl) {
    postEl.remove();
  }
}

/**
 * Remove comment from DOM
 */
export function removeCommentFromDOM(commentId) {
  const commentEl = document.getElementById(`comment-card-${commentId}`);
  if (commentEl) {
    commentEl.remove();
  }
}

/**
 * Update post bookmark display
 */
export function updatePostBookmarkDisplay(postId, isBookmarked, count) {
  const post = document.querySelector(`[data-post-id="${postId}"]`);
  if (!post) return;
  
  const bookmarkBtn = post.querySelector('.stat-item:last-child');
  if (!bookmarkBtn) return;
  
  if (isBookmarked) {
    bookmarkBtn.classList.add('bookmarked');
  } else {
    bookmarkBtn.classList.remove('bookmarked');
  }
  
  if (count > 0) {
    bookmarkBtn.textContent = `🔖 ${count}`;
  } else {
    bookmarkBtn.textContent = '🔖';
  }
}