/**
 * ============================================================================
 * FEED API CALLS - WITH PAGINATION
 * All backend communication - uses global api from api.js
 * Fixed: Added pagination support, maintained all existing functionality
 * ============================================================================
 */

/**
 * Load posts by filter with pagination
 */
export async function loadPostsByFilter(filterType, page = 1) {
  const response = await api.get(`/posts/feed?filter=${filterType}&page=${page}&per_page=20`);
  return {
    posts: response?.data?.posts || [],
    pagination: response?.data?.pagination || { has_next: false, page: 1 }
  };
}

/**
 * Load initial feed data (page 1 only)
 */
export async function loadInitialFeedData() {
  const [allData, departmentData, trendingData, connectionsData, unsolvedData] = 
    await Promise.all([
      loadPostsByFilter('all', 1),
      loadPostsByFilter('department', 1),
      loadPostsByFilter('trending', 1),
      loadPostsByFilter('connections', 1),
      loadPostsByFilter('unsolved', 1)
    ]);

  return {
    all: allData.posts,
    department: departmentData.posts,
    trending: trendingData.posts,
    connections: connectionsData.posts,
    unsolved: unsolvedData.posts,
    pagination: {
      all: allData.pagination,
      department: departmentData.pagination,
      trending: trendingData.pagination,
      connections: connectionsData.pagination,
      unsolved: unsolvedData.pagination
    }
  };
}

/**
 * Load all feed data (DEPRECATED - use loadInitialFeedData for new code)
 * Kept for backward compatibility
 */
export async function loadAllFeedData() {
  const [allPosts, departmentPosts, trendingPosts, connectionsPosts, unsolvedPosts] = 
    await Promise.all([
      api.get('/posts/feed?filter=all'),
      api.get('/posts/feed?filter=department'),
      api.get('/posts/feed?filter=trending'),
      api.get('/posts/feed?filter=connections'),
      api.get('/posts/feed?filter=unsolved')
    ]);

  return {
    all: allPosts?.data?.posts || [],
    department: departmentPosts?.data?.posts || [],
    trending: trendingPosts?.data?.posts || [],
    connections: connectionsPosts?.data?.posts || [],
    unsolved: unsolvedPosts?.data?.posts || []
  };
}

/**
 * Load all widget data
 */
export async function loadWidgetData() {
  const [
    suggestedConnections,
    popularTags,
    risingStars,
    openThreads,
    studyBuddyMatches,
    canHelp,
    topBadgeEarners
  ] = await Promise.all([
    api.get('/connections/suggestions/flat?limit=10'),
    api.get('/posts/tags'),
    api.get('/reputation/rising-stars?limit=10'),
    api.get('/threads/recommended?limit=10'),
    api.get('/study-buddy/suggestions?limit=10'),
    api.get('/threads/help/suggestions?limit=10'),
    api.get('/badges/top-earners?limit=10')
  ]);

  return {
    suggestedConnections: suggestedConnections?.data?.suggestions || suggestedConnections?.data || [],
    popularTags: popularTags?.data || {},
    risingStars: risingStars?.data?.rising_stars || risingStars?.data || [],
    openThreads: openThreads?.data?.recommendations || openThreads?.data || [],
    studyBuddyMatches: studyBuddyMatches?.data?.suggestions || studyBuddyMatches?.data || [],
    canHelp: canHelp?.data?.suggestions || canHelp?.data || [],
    topBadgeEarners: topBadgeEarners?.data || []
  };
}

/**
 * Get posts by tag with pagination
 */
export async function getPostsByTag(tag, page = 1) {
  const response = await api.get(`/posts/tags/${encodeURIComponent(tag)}?page=${page}&per_page=20`);
  return {
    posts: response?.data?.posts || [],
    pagination: response?.data?.pagination || { has_next: false, page: 1 }
  };
}

/**
 * Bookmark single post
 */
export async function bookmarkPost(postId, folder, notes, tags) {
  const payload = {
    post_ids: [postId],
    folder_name: folder,
    notes: notes,
    tags: tags
  };
  const response = await api.post('/posts/bookmark/toggle', payload);
  return response;
}

/**
 * Bulk bookmark multiple posts
 */
export async function bulkBookmarkPosts(postIds, folder = 'Saved', notes = '', tags = []) {
  const payload = {
    post_ids: postIds,
    folder_name: folder,
    notes: notes,
    tags: tags
  };
  const response = await api.post('/posts/bookmark/toggle', payload);
  return response;
}

/**
 * Toggle bookmark - KEPT FOR BACKWARD COMPATIBILITY
 */
export async function toggleBookmark(postId) {
  const payload = {
    post_ids: [postId]
  };
  return await api.post('/posts/bookmark/toggle', payload);
}

/**
 * Toggle reactions
 */
export async function toggleReactions(postId, reaction) {
  const response = await api.post(`/posts/${postId}/react`, {reaction: reaction});
  return response;
}

/**
 * React to a post
 */
export async function reactToPost(postId, reactionType) {
  return await api.post(`/posts/${postId}/react`, { reaction_type: reactionType });
}

/**
 * Get post comments
 */
export async function getPostComments(postId) {
  const response = await api.get(`/posts/${postId}/comments`);
  return response?.data?.comments || [];
}

/**
 * Get bookmark folders
 */
export async function getBookmarkFolders() {
  const response = await api.get("/bookmarks/folders");
  if (response.status === "success") {
    return response.data;
  }
  throw new Error(response.message || 'Failed to load folders');
}

/**
 * Upload post
 */
export async function uploadPost(payload) {
  const response = await api.post("/posts/create", payload);
  return response;
}

/**
 * Create thread
 */
export async function createThread(payload) {
  const response = await api.post("/threads/create", payload);
  return response;
}

/**
 * Get post for quick view
 */
export async function getPostQuickView(postId) {
  const response = await api.get(`/posts/${postId}/quick-view`);
  return response?.data;
}

/**
 * Get thread details
 */
export async function getThreadDetails(threadId, type) {
  const response = await api.post(`/threads/${threadId}/details`, {type: type});
  if (!response) {
    throw new Error("Error: thread not returning response");
  }
  return response?.data;
}

/**
 * Get comment resources
 */
export async function getCommentResources(commentId) {
  const response = await api.get(`/comments/${commentId}/resources`);
  return response?.data?.resources || [];
}

/**
 * Get more replies for a comment
 */
export async function getCommentReplies(commentId) {
  try {
    const response = await api.get(`/comments/${commentId}/replies`);
    if (response.status !== 'success') {
      throw new Error(response.message || 'Failed to load replies');
    }
    return response?.data || { replies: [] };
  } catch (error) {
    console.error('Get replies error:', error);
    throw error;
  }
}

/**
 * Follow a post
 */
export async function followPost(postId) {
  return await api.post(`/posts/${postId}/follow`);
}

/**
 * Unfollow a post
 */
export async function unfollowPost(postId) {
  return await api.delete(`/posts/${postId}/unfollow`);
}

/**
 * Delete a post
 */
export async function deletePost(postId) {
  return await api.delete(`/posts/${postId}`);
}

/**
 * Delete a comment
 */
export async function deleteComment(commentId) {
  return await api.delete(`/comments/${commentId}`);
}

/**
 * Pin a post
 */
export async function pinPost(postId) {
  return await api.post(`/posts/${postId}/pin`);
}

/**
 * Unpin a post
 */
export async function unpinPost(postId) {
  return await api.post(`/posts/${postId}/unpin`);
}

/**
 * Join a thread
 */
export async function joinThread(threadId, type) {
  return await api.post(`/threads/${threadId}/join`, {type: type});
}

/**
 * Report a post
 */
export async function reportPost(postId, reason) {
  return await api.post(`/posts/${postId}/report`, {reason: reason});
}

/**
 * Toggle comment like
 */
export async function toggleCommentLike(commentId) {
  return await api.post(`/comments/${commentId}/like`);
}

/**
 * Toggle comment helpful
 */
export async function toggleCommentHelpful(commentId) {
  return await api.post(`/comments/${commentId}/mark-helpful`);
}

/**
 * Mark comment as solution
 */
export async function markCommentAsSolution(postId, commentId) {
  return await api.post(`/posts/${postId}/mark-solution`, { comment_id: commentId });
}

/**
 * Unmark comment as solution
 */
export async function unmarkCommentAsSolution(postId, commentId) {
  return await api.post(`/posts/${postId}/unmark-solution`, { comment_id: commentId });
}

/**
 * Post a comment
 */
export async function postComment(postId, textContent, parentId = null, resources = []) {
  return await api.post("/comments/create", {
    post_id: postId,
    text_content: textContent,
    parent_id: parentId,
    resources: resources
  });
}

/**
 * Create a forked post
 */
export async function createForkedPost(postData) {
  return await api.post("/posts/create", postData);
}

/**
 * Track post view
 */
export async function trackPostView(postId) {
  return await api.post(`/posts/${postId}/view`, {});
}

/**
 * Upload file resource
 */
export async function uploadResource(file) {
  const formData = new FormData();
  formData.append("file", file);
  return await api.post("/posts/resource/upload", formData, true);
}

/**
 * Apply post refinement
 */
export async function applyPostRefinement(postId, refinement) {
  return await api.post(`/posts/${postId}/apply-refinement`, refinement);
}

/**
 * Send connection request
 */
export async function sendConnectionRequest(userId) {
  return await api.post(`/connections/request/${userId}`);
}

/**
 * Mark post as solved
 */
export async function markPostSolved(postId) {
  return await api.post(`/posts/${postId}/mark-solved`);
}

/**
 * Mark post as unsolved
 */
export async function markPostUnsolved(postId) {
  return await api.post(`/posts/${postId}/unmark-solved`);
}

/**
 * Refine post with streaming
 */
export async function refinePostStream(postId, instructions = '') {
  const response = await fetch(`/student/posts/${postId}/refine`, {
    method: 'POST',
    headers: await api.getHeaders(),
    body: JSON.stringify({ instructions })
  });
  
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}