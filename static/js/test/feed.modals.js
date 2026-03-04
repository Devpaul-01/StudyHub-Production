/**
 * ============================================================================
 * FEED MODALS
 * Modal-specific logic: comments, reactions, fork, refine, threads
 * ============================================================================
 */

import { feedState } from './feed.state.js';
import { MAX_TAGS } from './feed.constants.js';
// FIX: Import as feedApi to avoid conflict with global api variable
import * as feedApi from './feed.api.js';
import { getLoadingSkeleton, openModal, closeModal } from './feed.utils.js';
import { 
  renderPostComments, 
  renderBookmarkFolders, 
  appendCommentToUI, 
  renderThreadDetails,
  renderSelectedForkTags,
  renderSelectedPostTags,
  renderSelectedThreadTags
} from './feed.render.js';

/**
 * Open comment modal and load comments
 */
export async function openCommentModal(postId) {
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
  
  commentsContainer.innerHTML = getLoadingSkeleton();
  
  const commentInput = document.getElementById("commentInput");
  if (commentInput) {
    commentInput.dataset.postId = postId;
    delete commentInput.dataset.parentId;
    commentInput.value = "";
  }
  
  try {
    // FIX: Use feedApi
    const comments = await feedApi.getPostComments(postId);
    
    if (!comments || comments.length === 0) {
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
    
    const commentsHTML = renderPostComments(comments);
    commentsContainer.innerHTML = commentsHTML;
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast('Error loading comments: ' + error.message, 'error');
    }
    commentsContainer.innerHTML = `
      <div class="error-state" style="text-align: center; padding: 3rem 1rem;">
        <p style="color: var(--danger); margin-bottom: 1rem;">Error loading comments: ${error.message}</p>
        <button class="btn btn-primary" onclick="openCommentModal(${postId})">Try again</button>
      </div>
    `;
  }
}

/**
 * Open reply modal
 */
export function openReplyModal(username, commentId, postId) {
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

/**
 * Post a comment
 */
export async function postComment(event) {
  event.preventDefault();
  event.stopPropagation();
  
  const inputBox = document.getElementById("commentInput");
  if (!inputBox) {
    if (typeof showToast === 'function') {
      showToast("Comment input not found", "error");
    }
    return;
  }
  
  const textContent = inputBox.value.trim();
  
  if (!textContent) {
    if (typeof showToast === 'function') {
      showToast("Comment cannot be empty", "warning");
    }
    return;
  }
  
  const postId = inputBox.dataset.postId;
  const parentId = inputBox.dataset.parentId || null;
  
  if (!postId) {
    if (typeof showToast === 'function') {
      showToast("Invalid post context", "error");
    }
    return;
  }
  
  const btn = document.getElementById("postCommentBtn");
  if (!btn) {
    if (typeof showToast === 'function') {
      showToast("Post button not found", "error");
    }
    return;
  }
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Posting...";
  
  try {
    // FIX: Use feedApi
    const data = await feedApi.postComment(
      postId, 
      textContent, 
      parentId, 
      feedState.getReplyResources()
    );
    
    if (data.status === "success") {
      inputBox.value = "";
      delete inputBox.dataset.postId;
      delete inputBox.dataset.parentId;
      
      const previewArea = document.getElementById("previewArea");
      if (previewArea) previewArea.innerHTML = "";
      
      feedState.clearReplyResources();
      
      const newComment = data.data.comment;
      if (newComment) {
        appendCommentToUI(newComment, parentId);
      }
      
      if (typeof showToast === 'function') {
        showToast("Comment posted successfully!", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(data.message || "Failed to post comment", "error");
      }
    }
  } catch (error) {
    console.error("Post comment error:", error);
    if (typeof showToast === 'function') {
      showToast("Error posting comment: " + error.message, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

/**
 * Open fork modal
 */
export function openForkModal(postId) {
  feedState.clearForkTags();
  const modal = document.getElementById("post-fork-modal");
  if (!modal) {
    console.error("Fork modal not found");
    return;
  }
  
  modal.classList.remove('hidden');
  modal.classList.add('active');
  
  const post = document.querySelector(`[data-post-id="${postId}"]`);
  if (!post) {
    if (typeof showToast === 'function') {
      showToast("Post not found", "error");
    }
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
  tags.slice(0, MAX_TAGS).forEach(tag => {
    feedState.addForkTag(tag);
  });
  
  // This imports correctly from feed.render.js
  renderSelectedForkTags();
}

/**
 * Save forked post
 */
export async function saveForkedPost(event) {
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
    "tags": feedState.getForkTags()
  };
  
  if (saveBtn) saveBtn.disabled = true;
  
  try {
    // FIX: Use feedApi
    const response = await feedApi.createForkedPost(formData);
    if (response.status == "success") {
      if (typeof showToast === 'function') {
        showToast("Post created successfully", "success");
      }
      closeModal("post-fork-modal");
      feedState.clearForkTags();
      return;
    }
    if (typeof showToast === 'function') {
      showToast(response.message, 'error');
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast(error.message, 'error');
    }
  } finally {
    if (saveBtn) saveBtn.disabled = false;
  }
}

/**
 * Add fork tag
 */
export function addForkTag(tag) {
  if (feedState.getForkTags().length >= MAX_TAGS) {
    if (typeof showToast === 'function') {
      showToast(`You can only add up to ${MAX_TAGS} tags`, 'info');
    }
    return;
  }
  
  feedState.addForkTag(tag);
  renderSelectedForkTags();
  
  const input = document.getElementById('fork-tags-input');
  if (input) input.value = '';
  
  const dropdown = document.getElementById('fork-tags-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

/**
 * Remove fork tag
 */
export function removeForkTag(tag) {
  feedState.removeForkTag(tag);
  renderSelectedForkTags();
}

export function addTag(tag) {
  if (feedState.getPostTags().length >= MAX_TAGS) {
    if (typeof showToast === 'function') {
      showToast(`You can only add up to ${MAX_TAGS} tags`, 'info');
    }
    return;
  }
  
  feedState.addTag(tag);
  renderSelectedPostTags();
  
  const input = document.getElementById('tags-input');
  if (input) input.value = '';
  
  const dropdown = document.getElementById('tags-dropdown');
  if (dropdown) dropdown.classList.add('hidden');
}

/**
 * Remove fork tag
 */
export function removeTag(tag) {
  feedState.removeTag(tag);
  renderSelectedPostTags();
}
export function addThreadTag(tag) {
  if (feedState.getThreadTags().length >= MAX_TAGS) {
    if (typeof showToast === 'function') {
      showToast(`You can only add up to ${MAX_TAGS} tags`, 'info');
    }
    return;
  }
  
  feedState.addThreadTag(tag);
  renderSelectedThreadTags();
  
  const input = document.getElementById('thread-tag-search');
  if (input) input.value = '';
  
  const dropdown = document.getElementById('thread-tags-result');
  if (dropdown) dropdown.classList.add('hidden');
}

/**
 * Remove fork tag
 */
export function removeThreadTag(tag) {
  feedState.removeThreadTag(tag);
  renderSelectedThreadTags();
}

/**
 * Open thread view modal
 */
export async function viewThread(threadId) {
  const modal = document.getElementById("thread-view-modal");
  const modalBody = modal ? modal.querySelector('#thread-details-content') : null;
  
  if (!modal || !modalBody) {
    console.error("Thread modal not found");
    return;
  }
  
  modal.classList.remove('hidden');
  modalBody.innerHTML = getLoadingSkeleton();
  
  try {
    // FIX: Use feedApi
    const data = await feedApi.getThreadDetails(threadId);
    
    if (!data || Object.keys(data).length === 0) {
      modalBody.innerHTML = `
        <div class="empty-state">
          <h1>No data found for this thread</h1>
        </div>`;
      return;
    }
    
    renderThreadDetails(data);
  } catch (error) {
    console.error("View thread error:", error);
    if (typeof showToast === 'function') {
      showToast("Error loading thread: " + error.message, "error");
    }
    modalBody.innerHTML = `
      <div class="error-state">
        <h1>Error loading thread data</h1>
        <button onclick="viewThread(${threadId})">Try again</button>
      </div>`;
  }
}

/**
 * Open bookmark folders modal
 */
export async function openBookmarkFoldersModal(postId) {
  try {
    // FIX: Use feedApi
    const folders = await feedApi.getBookmarkFolders();
    renderBookmarkFolders(folders);
    openModal('bookmark-folders-modal');
    
    // Store postId for later use
    const modal = document.getElementById('bookmark-folders-modal');
    if (modal) {
      modal.dataset.postId = postId;
    }
  } catch (error) {
    console.error('Error loading bookmark folders:', error);
    if (typeof showToast === 'function') {
      showToast('Error loading folders', 'error');
    }
  }
}

/**
 * Refine post with AI
 */
export async function refinePost(postId) {
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
    
    // FIX: Use feedApi
    const response = await feedApi.getPostQuickView(postId);
    
    if (response) {
      const post = response;
      const origTitle = document.getElementById("original-title");
      const origContent = document.getElementById("original-content");
      if (origTitle) origTitle.textContent = post.title;
      if (origContent) origContent.textContent = post.content || "[No content]";
      
      startRefinement(postId);
    } else {
      if (typeof showToast === 'function') {
        showToast("Failed to load post", "error");
      }
      closeRefineModal();
    }
    
  } catch (error) {
    console.error("Refine post error:", error);
    if (typeof showToast === 'function') {
      showToast("Error initiating refinement: " + error.message, "error");
    }
  }
}
export async function applyRefinement(postId) {
  const refinement = feedState.getCurrentRefinement();
  if (!refinement) {
    if (typeof showToast === 'function') {
      showToast("No refinement to apply", "error");
    }
    return;
  }
  
  const applyBtn = document.getElementById("apply-btn");
  const originalText = applyBtn ? applyBtn.textContent : "";
  
  try {
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = "Applying...";
    }
    
    // FIX: Use feedApi
    const response = await feedApi.applyPostRefinement(postId, refinement);
    
    if (response && response.status === "success") {
      if (typeof showToast === 'function') {
        showToast("✨ Post refined successfully!", "success");
      }
      
      const postCard = document.querySelector(`[data-post-id="${postId}"]`);
      if (postCard) {
        const titleEl = postCard.querySelector(".post-title");
        const contentEl = postCard.querySelector(".post-content");
        
        if (titleEl) titleEl.textContent = refinement.title;
        if (contentEl) contentEl.textContent = refinement.content;
      }
      
      closeRefineModal();
      feedState.clearRefinement();
    } else {
      if (typeof showToast === 'function') {
        showToast(response?.message || "Failed to apply refinement", "error");
      }
    }
    
  } catch (error) {
    console.error("Apply refinement error:", error);
    if (typeof showToast === 'function') {
      showToast("Error applying refinement: " + error.message, "error");
    }
  } finally {
    if (applyBtn) {
      applyBtn.disabled = false;
      applyBtn.textContent = originalText;
    }
  }
}

/**
 * Close refine modal
 */
export function closeRefineModal() {
  const modal = document.getElementById("post-refine-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.innerHTML = "";
  }
  feedState.clearRefinement();
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.openCommentModal = openCommentModal;
  window.openReplyModal = openReplyModal;
  window.postComment = postComment;
  window.openForkModal = openForkModal;
  window.saveForkedPost = saveForkedPost;
  window.addForkTag = addForkTag;
  window.addTag = addTag;
  window.removeForkTag = removeForkTag;
  window.removeTag = removeTag;
  window.addThreadTag = addThreadTag;
  window.removeThreadTag = removeThreadTag;
  window.viewThread = viewThread;
  window.refinePost = refinePost;
  window.applyRefinement = applyRefinement;
  window.closeRefineModal = closeRefineModal;
}
/**
 * Start AI refinement process
 */
async function startRefinement(postId) {
  try {
    const instructionsEl = document.getElementById("refinement-instructions");
    const instructions = instructionsEl ? instructionsEl.value : "";
    
    // Note: api.getToken() uses the GLOBAL api variable (from core/api.js)
    // because we imported the local module as 'feedApi'. This is correct.
    const response = await fetch(`/student/posts/${postId}/refine`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api.getToken ? api.getToken() : ''}`
      },
      body: JSON.stringify({ instructions })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
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
              
              if (titleMatch && refinedTitleEl) {
                const title = titleMatch[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\');
                refinedTitleEl.textContent = title;
              }
              
              if (contentMatch && refinedContentEl) {
                const content = contentMatch[1]
                  .replace(/\\n/g, '\n')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\');
                refinedContentEl.textContent = content;
              }
            }
            else if (parsed.type === 'done') {
              if (parsed.success && parsed.refined) {
                feedState.setCurrentRefinement(parsed.refined);
                if (refinedTitleEl) refinedTitleEl.textContent = parsed.refined.title;
                if (refinedContentEl) refinedContentEl.textContent = parsed.refined.content;
                
                if (statusEl) statusEl.innerHTML = '<div class="success-indicator">✅ Refinement complete!</div>';
                const actionsEl = document.getElementById("refine-actions");
                if (actionsEl) actionsEl.classList.remove("hidden");
              } else {
                if (statusEl) statusEl.innerHTML = '<div class="error-indicator">❌ Failed to refine. Please try again.</div>';
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

/**
 * Apply refinement changes
 */
