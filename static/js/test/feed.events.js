/**
 * ============================================================================
 * FEED EVENTS
 * Event listeners and interaction handlers
 * ============================================================================
 */

/**
 * ============================================================================
 * FEED EVENTS
 * ============================================================================
 */
// This will finally show up after the fix!
import { feedState } from './feed.state.js';
import { LONG_PRESS_TIME, AVAILABLE_TAGS, MAX_TAGS } from './feed.constants.js';
import * as feedApi from './feed.api.js';

// --- FIX 1: Import renderSelectedForkTags from render.js, NOT modals.js ---
import { 
  renderFeed, 
  updateFilterButtons, 
  updateFeedContainerVisibility,
  highlightPost,
  clearAllHighlights,
  updateReactionDisplay,
  showReactionMenu,
  hideReactionMenu,
  updateCommentLikeButton,
  updateCommentHelpfulButton,
  removePostFromDOM,
  removeCommentFromDOM,
  updatePostBookmarkDisplay,
  renderSelectedForkTags // <--- MOVED HERE
} from './feed.render.js';

import { getReactionType } from './feed.templates.js';

// --- FIX 2: Removed renderSelectedForkTags from here ---
import { openCommentModal, openBookmarkFoldersModal } from './feed.modals.js';

// ... rest of the file ...


/**
 * Setup all event listeners
 */
export function setupAllEventListeners() {
  setupReactionListeners();
  setupViewTracking();
  setupBulkSelectionListeners();
  setupFileUploadListeners();
  setupForkTagsListeners();
  setupBookmarkModalListeners();
  setupPostMedias();
  setupThreadListeners();
  setupThreadTags();
  setupGlobalClickListeners();
}

/**
 * Setup reaction listeners (likes, long press reactions)
 */
 
export function setupThreadListeners(){
  const avatarInput = document.getElementById("thread-avatar-input");
  const threadAvatar = document.getElementById('thread-avatar')
  avatarInput.addEventListener("change", function(e) => {
    const file = (e.target.files)[0];
    const url = URL.createObjectURL(file);
    threadAvatar.src = url;
    const result = await feedApi.uploadResource(file);
    const resource = {
      url: result.data.url,
      type: result.data.type,
      filename: result.data.filename
    };
    feedState.setThreadAvatar(result);
  });
  
   
 }
export function handleCreatePost(event){
  const postTitle = document.getElementById("post-title");
  const postContent = document.getElementById("post-content");
  const postTags = feedState.getPostTags;
  const postType = document.getElementById('post-type').value;
  const postResources = feedState.getPostResources();
  const threadEnabled = document.getElementById('thread-toggle').checked;
  if(threadEnabled){
    const threadTitle = document.getElementById("thread-title").value;
    const threadDescription = document.getElementById('thread-description').value:
    const maxMembers = document.getElementById("thread-max-members").value;
    const requiresApproval = document.getElementById("thread-approval-toggle").checked;
  }
  const payload = {
    thread_enabled:threadEnabled,
    title: postTitle,
    text_content: postContent,
    post_type: postType,
    tags: postTags,
    resources:postResources,
    thread_enabled: threadEnabled,
    thread_title: threadTitle,
    thread_description: threadDescription,
    max_members: maxMembers,
    requires_approval: requiresApproval
  }
  const result = feedApi.uploadPost(payload);
  if(result){
    showToast("Post uploaded successfully", 'info');
    closeModal("create-post-modal");
  }
}

export function handleCreateThread(){
  const threadTitle = document.getElementById("thread-title-input");
  const threadDescription = document.getElementById("thread-description-input");
  const threadTags = feedState.getThreadTags();
  const maxMembers = document.getElementById("thread-maximum-members").value;
  const requiresApproval = document.getElementById("thread-require-approval");
  const threadResource = feedState.getThreadResource();
  const payload = {
    title: threadTitle,
    description: threadDescription,
    max_members: maxMembers,
    requires_approval: requiresApproval,
    resources:threadResource,
  }
  const result = await feedApi.createThread(payload);
  if(result){
    showToast("Thread created successfully", "success");
    closeModal("thread-create-modal");
  }
  }
setupThreadTags(){
  const tagInput = document.getElementById("thread-tag-search");
  const tagsDropdown = document.getElementById("thread-tag-result");
  const selectedTags = document.getElementById("thread-selected-tags");
  if (!tagInput || !tagsDropdown) {
    console.warn("Tags elements not found");
    return;
  }

  tagInput.addEventListener("input", function(e) {
    const input = e.target.value.toLowerCase();
    
    if (input.length === 0) {
      tagsDropdown.classList.add("hidden");
      return;
    }
    
    if (feedState.getThreadTags().length >= MAX_TAGS) {
      tagsDropdown.classList.add('hidden');
      return;
    }
    
    const relatedTags = AVAILABLE_TAGS.filter(tag => 
      tag.toLowerCase().includes(input) && !feedState.getThreadTags().includes(tag)
    );
    
    if (relatedTags.length > 0) {
      tagsDropdown.innerHTML = relatedTags.slice(0, 10).map(tag => 
        `<div class="tag-option" onclick="addThreadTag('${tag}')">${tag}</div>`
      ).join('');
      tagsDropdown.classList.remove('hidden');
    } else {
      tagsDropdown.classList.add('hidden');
    }
  });

  tagInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = e.target.value.trim();
      if (value && feedState.getThreadTags().length < MAX_TAGS) {
        if (typeof window.addTag === 'function') {
          window.addThreadTag(value);
        }
      }
    }
  });
}

setupPostTags(){
  const tagInput = document.getElementById("tags-input");
  const tagsDropdown = document.getElementById("tags-dropdown");
  if (!tagInput || !tagsDropdown) {
    console.warn("Tags elements not found");
    return;
  }

  tagInput.addEventListener("input", function(e) {
    const input = e.target.value.toLowerCase();
    
    if (input.length === 0) {
      tagsDropdown.classList.add("hidden");
      return;
    }
    
    if (feedState.getPostTags().length >= MAX_TAGS) {
      tagsDropdown.classList.add('hidden');
      return;
    }
    
    const relatedTags = AVAILABLE_TAGS.filter(tag => 
      tag.toLowerCase().includes(input) && !feedState.getPostTags().includes(tag)
    );
    
    if (relatedTags.length > 0) {
      tagsDropdown.innerHTML = relatedTags.slice(0, 10).map(tag => 
        `<div class="tag-option" onclick="addTag('${tag}')">${tag}</div>`
      ).join('');
      tagsDropdown.classList.remove('hidden');
    } else {
      tagsDropdown.classList.add('hidden');
    }
  });

  tagInput.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const value = e.target.value.trim();
      if (value && feedState.getPostTags().length < MAX_TAGS) {
        if (typeof window.addTag === 'function') {
          window.addTag(value);
        }
      }
    }
  });
}

export function setupReactionListeners() {
  const reactionMenu = document.getElementById("reactionMenu");
  
  if (!reactionMenu) {
    console.warn("Reaction menu not found");
    return;
  }
  
  // Remove old listeners by cloning
  document.querySelectorAll(".post-card .reaction-btn").forEach(btn => {
    const clone = btn.cloneNode(true);
    btn.parentNode.replaceChild(clone, btn);
  });
  
  // Add new listeners
  document.querySelectorAll(".post-card .reaction-btn").forEach(btn => {
    btn.addEventListener("mousedown", function(e) {
      e.preventDefault();
      feedState.setReactionBtn(btn);
      startPress(e);
    });

    btn.addEventListener("mouseup", cancelPress);
    btn.addEventListener("mouseleave", cancelPress);

    btn.addEventListener("touchstart", function(e) {
      e.preventDefault();
      feedState.setReactionBtn(btn);
      startPress(e);
    }, { passive: false });

    btn.addEventListener("touchend", cancelPress);
    btn.addEventListener("touchmove", cancelPress);
    
    btn.addEventListener("click", function(e) {
      if (feedState.longPressTimer) return;
      
      e.stopPropagation();
      const postCard = btn.closest(".post-card");
      const postId = postCard?.dataset.postId;
      
      if (postId) {
        const reactionEl = btn.querySelector('.post-reaction') || btn.querySelector('.post-like') || btn;
        handleQuickReaction(postId, reactionEl);
      }
    });
  });
  
  // Reaction menu click handler
  reactionMenu.addEventListener("click", async function(e) {
    const reactionType = e.target.dataset.reaction;
    if (!reactionType) return;

    const reactionBtn = feedState.getReactionBtn();
    if (!reactionBtn) return;

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

    hideReactionMenu();
    cancelPress();
  });
}

/**
 * Start long press
 */
function startPress(e) {
  const timer = setTimeout(() => {
    showReactionMenu(e);
    feedState.setLongPressTimer(null);
  }, LONG_PRESS_TIME);
  
  feedState.setLongPressTimer(timer);
}

/**
 * Cancel long press
 */
function cancelPress() {
  feedState.clearLongPressTimer();
}

/**
 * Handle quick reaction (single click)
 */
async function handleQuickReaction(postId, element) {
  await toggleReactions("like", "👍", 0, false, postId, element);
}

/**
 * Toggle reactions
 */
async function toggleReactions(newType, oldEmoji, oldCount, reacted, postId, element) {
  try {
    const response = await feedApi.reactToPost(postId, newType);

    if (response.status !== "success") {
      if (typeof showToast === 'function') {
        showToast(response.message, "error");
      }
      return;
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
    if (typeof showToast === 'function') {
      showToast("Post reaction error: " + error.message, "error");
    }
  }
}

/**
 * Setup view tracking with Intersection Observer
 */
export function setupViewTracking() {
  // Disconnect previous observer
  feedState.disconnectViewObserver();
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const postId = entry.target.getAttribute("data-post-id");
        
        if (postId) {
          sendView(postId);
          observer.unobserve(entry.target);
        }
      }
    });
  }, {
    threshold: 0.4,
    rootMargin: '0px'
  });
  
  feedState.setViewObserver(observer);
  
  document.querySelectorAll(".post-card[data-post-id]").forEach(post => {
    observer.observe(post);
  });
}

/**
 * Send view tracking
 */
async function sendView(postId) {
  try {
    await feedApi.trackPostView(postId);
  } catch (error) {
    console.debug("View tracking error:", postId, error);
  }
}

/**
 * Setup bulk selection listeners
 */
export function setupBulkSelectionListeners() {
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
      if (feedState.isInHighlightMode() && !e.target.closest('button, a, .post-action')) {
        e.preventDefault();
        e.stopPropagation();
        highlightPost(post);
      }
    });
  });
}

/**
 * Start bulk selection
 */
function startBulk(e, post) {
  const timeout = setTimeout(() => {
    feedState.setHighlightMode(true);
    highlightPost(post);
    const bulkBtn = document.getElementById("bulk-bookmark");
    if (bulkBtn) bulkBtn.classList.remove("hidden");
  }, LONG_PRESS_TIME);
  
  feedState.setLongPressTimeout(timeout);
}

/**
 * Clear bulk selection timeout
 */
function clearBulk() {
  feedState.clearLongPressTimeout();
}

/**
 * Bookmark multiple posts
 */
export async function bookmarkPosts() {
  const selected = [...document.querySelectorAll(".post-card.choosed")];
  if (selected.length === 0) {
    if (typeof showToast === 'function') {
      showToast("No posts selected", "warning");
    }
    return;
  }

  const postIds = selected.map(p => p.dataset.postId);

  try {
    const response = await feedApi.bulkBookmarkPosts(postIds);

    if (response.status !== "success") {
      if (typeof showToast === 'function') {
        showToast(response.message || "Bookmark error", "error");
      }
      return;
    }

    if (typeof showToast === 'function') {
      showToast("Posts bookmarked!", "success");
    }

  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Bookmark error: " + error.message, "error");
    }
  } finally {
    clearAllHighlights();
  }
}
setupPostMedias(){
  document.getElementById("thread-toggle").addEventListener("change", function(e) => {
    if(e.target.checked){
      document.getElementById('thread-modal').classList.remove('hidden');
    }
    else{
      document.getElementById('thread-modal').classList.add('hidden');
    }
  });
  const imageInput = document.getElementById("input-image");
  const videoInput = document.getElementById("input-video");
  const fileInput = document.getElementById("input-file");
  const previewArea = document.getElementById("preview-area");
  
  [imageInput, videoInput, fileInput].forEach(input => {
    input.addEventListener("change", function(e) {
      const files = Array.from(e.target.files);
      feddState.
      if(!files || files.length == 0) return;
      for(const file of files){
        if(!file) return;
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
          const result = await feedApi.uploadResource(file);
          
          if (result.status === "success") {
            const resource = {
              url: result.data.url,
              type: result.data.type,
              filename: result.data.filename
            };
            
            feedState.addPostResource(resource);
            
            loader.remove();
            btn.style.display = "block";
            
            btn.onclick = function() {
              previewDiv.remove();
              feedState.removePostResource(resource.url);
            };
          } else {
            loader.textContent = "Failed";
            loader.style.background = "var(--danger)";
            if (typeof showToast === 'function') {
              showToast("Upload failed: " + (result.message || "Unknown error"), "error");
            }
          }
        } catch (error) {
          console.error("Upload error:", error);
          loader.textContent = "Error";
          loader.style.background = "var(--danger)";
          if (typeof showToast === 'function') {
            showToast("Error uploading file", "error");
          }
        }
      }
      
      e.target.value = "";
    });
      }
    )}
  
  

/**
 * Setup file upload listeners
 */
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
          const result = await feedApi.uploadResource(file);
          
          if (result.status === "success") {
            const resource = {
              url: result.data.url,
              type: result.data.type,
              filename: result.data.filename
            };
            
            feedState.addReplyResource(resource);
            
            loader.remove();
            btn.style.display = "block";
            
            btn.onclick = function() {
              previewDiv.remove();
              feedState.removeReplyResource(resource.url);
            };
          } else {
            loader.textContent = "Failed";
            loader.style.background = "var(--danger)";
            if (typeof showToast === 'function') {
              showToast("Upload failed: " + (result.message || "Unknown error"), "error");
            }
          }
        } catch (error) {
          console.error("Upload error:", error);
          loader.textContent = "Error";
          loader.style.background = "var(--danger)";
          if (typeof showToast === 'function') {
            showToast("Error uploading file", "error");
          }
        }
      }
      
      e.target.value = "";
    });
  });
}

/**
 * Setup fork tags input listeners
 */
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
    
    if (feedState.getForkTags().length >= MAX_TAGS) {
      forkTagsDropdown.classList.add('hidden');
      return;
    }
    
    const relatedTags = AVAILABLE_TAGS.filter(tag => 
      tag.toLowerCase().includes(input) && !feedState.getForkTags().includes(tag)
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
      if (value && feedState.getForkTags().length < MAX_TAGS) {
        if (typeof window.addForkTag === 'function') {
          window.addForkTag(value);
        }
      }
    }
  });
}

/**
 * Setup bookmark modal listeners
 */
function setupBookmarkModalListeners() {
  const bookmarkModal = document.getElementById("bookmark-folders-modal");
  if (bookmarkModal) {
    bookmarkModal.addEventListener("click", async function(e) {
      if (e.target.closest(".bookmark-folder")) {
        const folder = e.target.dataset.value;
        const postId = bookmarkModal.dataset.postId;
        if (folder && postId) {
          await bookmarkPost(folder, postId);
        }
      }
    });
  }
}

/**
 * Bookmark a post to a folder
 */
async function bookmarkPost(folder, postId) {
  try {
    const response = await feedApi.toggleBookmark(postId, folder);
    
    if (response.status === "success") {
      if (typeof showToast === 'function') {
        showToast("Post bookmarked successfully", "success");
      }
      updatePostBookmarkDisplay(postId, true, (response.data?.count || 1));
      if (typeof closeModal === 'function') {
        closeModal('bookmark-folders-modal');
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, "error");
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error bookmarking post: " + error.message, 'error');
    }
  }
}

/**
 * Setup global click listeners
 */
function setupGlobalClickListeners() {
  document.addEventListener('click', function(e) {
    const reactionMenu = document.getElementById("reactionMenu");
    if (reactionMenu && !reactionMenu.contains(e.target) && !e.target.closest('.reaction-btn')) {
      hideReactionMenu();
    }
    
    if (!e.target.closest('.post-options-btn') && !e.target.closest('.advanced-post-options')) {
      document.querySelectorAll('.advanced-post-options').forEach(menu => {
        menu.classList.add('hidden');
      });
    }
  });
}

/**
 * Post action handlers
 */
export async function handleFollowPost(postId) {
  try {
    const response = await feedApi.followPost(postId);
    if (response.status == "success") {
      if (typeof showToast === 'function') {
        showToast("Post followed, you will receive updates related to this post", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, "error");
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error following post: " + error.message, 'error');
    }
  }
}

export async function handleUnfollowPost(postId) {
  try {
    const response = await feedApi.unfollowPost(postId);
    if (response.status == "success") {
      if (typeof showToast === 'function') {
        showToast("Post unfollowed", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, "error");
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error unfollowing post: " + error.message, 'error');
    }
  }
}

export async function handleDeletePost(postId) {
  try {
    const response = await feedApi.deletePost(postId);
    if (response.status == "success") {
      removePostFromDOM(postId);
      if (typeof showToast === 'function') {
        showToast("Post deleted", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, 'error');
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error deleting post: " + error.message, 'error');
    }
  }
}

export async function handleDeleteComment(commentId) {
  try {
    const response = await feedApi.deleteComment(commentId);
    if (response.status == "success") {
      removeCommentFromDOM(commentId);
      if (typeof showToast === 'function') {
        showToast("Comment deleted", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, 'error');
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error deleting comment: " + error.message, 'error');
    }
  }
}

export async function handleToggleBookmark(postId) {
  const btn = event.target;
  
  if (!btn.classList.contains('bookmarked')) {
    await openBookmarkFoldersModal(postId);
    return;
  }
  
  try {
    const response = await feedApi.toggleBookmark(postId);
    if (response.status == "success") {
      updatePostBookmarkDisplay(postId, false, 0);
      if (typeof showToast === 'function') {
        showToast("Bookmark removed", "success");
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, "error");
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Error removing bookmark: " + error.message, 'error');
    }
  }
}

export async function handleReportPost(postId) {
  try {
    const response = await feedApi.reportPost(postId);
    if (response.status == "success") {
      if (typeof showToast === 'function') {
        showToast("Post reported, our admin will review and take action", 'info');
      }
      const btn = event.target;
      if (btn) btn.remove();
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, 'error');
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast("Report post error: " + error.message, 'error');
    }
  }
}

export async function handleToggleCommentLike(commentId) {
  try {
    const response = await feedApi.toggleCommentLike(commentId);
    if (response && response.status === 'success') {
      updateCommentLikeButton(commentId, true);
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast('Error toggling comment like: ' + error.message, 'error');
    }
  }
}

export async function handleToggleCommentHelpful(commentId) {
  try {
    const response = await feedApi.toggleCommentHelpful(commentId);
    if (response && response.status === 'success') {
      updateCommentHelpfulButton(commentId, true);
    }
  } catch (error) {
    console.error('Error toggling comment helpful:', error);
  }
}

export async function handleJoinThread(threadId) {
  const btn = document.getElementById("join-thread-btn");
  if (!btn) return;
  
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Joining...";
  
  try {
    const response = await feedApi.joinThread(threadId);
    
    if (response && response.status === "success") {
      btn.textContent = "✓ Joined";
      btn.classList.add("success");
      if (typeof showToast === 'function') {
        showToast("Successfully joined thread!", "success");
      }
      
      setTimeout(() => {
        btn.style.display = "none";
      }, 2000);
    } else {
      btn.disabled = false;
      btn.textContent = originalText;
      if (typeof showToast === 'function') {
        showToast(response?.message || "Failed to join", 'error');
      }
    }
  } catch (error) {
    console.error("Join thread error:", error);
    if (typeof showToast === 'function') {
      showToast("Join thread error: " + error.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = originalText;
  }
}

export async function handleConnectRequest(userId) {
  try {
    const response = await feedApi.sendConnectionRequest(userId);
    if (response && response.status === 'success') {
      if (typeof showToast === 'function') {
        showToast('Connection request sent!', 'success');
      }
      const btn = event.target;
      if (btn) {
        btn.textContent = "Pending";
        btn.disabled = true;
      }
    } else {
      if (typeof showToast === 'function') {
        showToast(response.message, 'error');
      }
    }
  } catch (error) {
    if (typeof showToast === 'function') {
      showToast('Error sending request: ' + error.message, 'error');
    }
  }
}

// Make event handlers globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.followPost = handleFollowPost;
  window.unfollowPost = handleUnfollowPost;
  window.deletePost = handleDeletePost;
  window.deleteComment = handleDeleteComment;
  window.toggleBookmark = handleToggleBookmark;
  window.reportPost = handleReportPost;
  window.toggleCommentLike = handleToggleCommentLike;
  window.toggleCommentHelpful = handleToggleCommentHelpful;
  window.joinThread = handleJoinThread;
  window.connectRequest = handleConnectRequest;
  window.bookmarkPosts = bookmarkPosts;
  window.setupReactionListeners = setupReactionListeners;
  window.handleCreatePost = handleCreatePost;
  window.handleCreateThread = handleCreateThread;
  window.setupViewTracking = setupViewTracking;
  window.setupBulkSelectionListeners = setupBulkSelectionListeners;
}