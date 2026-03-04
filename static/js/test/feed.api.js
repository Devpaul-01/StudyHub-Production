/**
 * ============================================================================
 * FEED API CALLS
 * All backend communication - uses global api from api.js
 * ============================================================================
 */

/**
 * Load all feed data (posts and widgets)
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
 * Load posts for specific filter
 */
export async function loadPostsByFilter(filterType) {
  const response = await api.get(`/posts/feed?filter=${filterType}`);
  return response?.data?.posts || [];
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
    api.get('/connections/suggestions?limit=10'),
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
  const response = await api.get("/posts/folders");
  if (response.status === "success") {
    return response.data;
  }
  throw new Error(response.message || 'Failed to load folders');
}

export async function uploadPost(payload){
  const response = await api.post("/posts/create", payload);
  if (response.status === "success") {
    return response.data;
  }
  showToast(response.message || 'Failed to upload post');
}
export async function createThread(payload){
  try{
    const response = await api.post("/threads/create", payload);
    if (response.status === "success") {
      return response.data;
    }
    else{
      showToast(response.message || 'Failed to create thread', 'error');
   }
  }
  catch(error){
    showToast('Failed to create thread' + response.message, 'error');
  }
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
export async function getThreadDetails(threadId) {
  const response = await api.get(`/threads/${threadId}/details`);
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
export async function getMoreReplies(commentId, page) {
  const response = await api.get(`/comments/${commentId}/replies?page=${page}`);
  return response?.data?.replies || [];
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
  return await api.post(`/posts/${postId}/unfollow`);
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
 * Toggle bookmark
 */
export async function toggleBookmark(postId, folder = null) {
  return await api.post(`/posts/${postId}/bookmark`, folder ? { folder } : {});
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
export async function joinThread(threadId) {
  return await api.post(`/threads/${threadId}/join`, {});
}

/**
 * Report a post
 */
export async function reportPost(postId) {
  return await api.post(`/posts/${postId}/report`);
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
 * React to a post
 */
export async function reactToPost(postId, reactionType) {
  return await api.post(`/posts/${postId}/react`, { reaction_type: reactionType });
}

/**
 * Bulk bookmark posts
 */
export async function bulkBookmarkPosts(postIds) {
  return await api.post('/posts/bulk/bookmark', { ids: postIds });
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
  return await api.post(`/posts/${postId}/mark-unsolved`);
}