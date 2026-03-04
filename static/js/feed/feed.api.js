/**
 * ============================================================================
 * FEED API CALLS - CURSOR-BASED PAGINATION
 * All backend communication - uses global api from api.js
 * Updated: Page-based pagination replaced with cursor-based pagination.
 *          Response shape: { posts, nextCursor, hasMore }
 * ============================================================================
 */

/**
 * Get the options menu for a specific post
 */
export async function getPostOptionsMenu(postId) {
  try {
    const response = await api.get(`/posts/${postId}/options-menu`);
    return response;
  } catch (error) {
    console.error('Get options menu error:', error);
    showToast(error.message, 'error');
  }
}

/**
 * Load posts by filter with cursor-based pagination.
 *
 * @param {string} filterType - 'all' | 'department' | 'trending' | 'connections' | 'unsolved'
 * @param {string|null} cursor - Opaque cursor string from a previous response (null = first page)
 * @param {number} limit - Max posts per request (backend caps at 50)
 * @returns {{ posts: Array, nextCursor: string|null, hasMore: boolean }}
 */
export async function loadPostsByFilter(filterType, cursor = null, limit = 20) {
  const params = new URLSearchParams({ filter: filterType, limit });
  if (cursor) params.set('cursor', cursor);

  const response = await api.get(`/posts/feed?${params}`);

  return {
    posts:      response?.data?.posts       || [],
    nextCursor: response?.data?.next_cursor ?? null,
    hasMore:    response?.data?.has_more    ?? false,
  };
}

/**
 * Load the first page for every filter tab in a single parallel burst.
 * Called once on feed init / pull-to-refresh.
 *
 * @returns {{
 *   all, department, trending, connections, unsolved : Array,
 *   cursors: { [filter]: { nextCursor: string|null, hasMore: boolean } }
 * }}
 */
export async function loadInitialFeedData() {
  const [allData, departmentData, trendingData, connectionsData, unsolvedData] =
    await Promise.all([
      loadPostsByFilter('all'),
      loadPostsByFilter('department'),
      loadPostsByFilter('trending'),
      loadPostsByFilter('connections'),
      loadPostsByFilter('unsolved'),
    ]);

  return {
    all:         allData.posts,
    department:  departmentData.posts,
    trending:    trendingData.posts,
    connections: connectionsData.posts,
    unsolved:    unsolvedData.posts,
    // Cursor metadata keyed by filter name — consumed by loadInitialData() in feed_init.js
    cursors: {
      all:         { nextCursor: allData.nextCursor,         hasMore: allData.hasMore },
      department:  { nextCursor: departmentData.nextCursor,  hasMore: departmentData.hasMore },
      trending:    { nextCursor: trendingData.nextCursor,    hasMore: trendingData.hasMore },
      connections: { nextCursor: connectionsData.nextCursor, hasMore: connectionsData.hasMore },
      unsolved:    { nextCursor: unsolvedData.nextCursor,    hasMore: unsolvedData.hasMore },
    },
  };
}

// ---------------------------------------------------------------------------
// Tag feed  (still page-based on the backend – keep the existing signature)
// ---------------------------------------------------------------------------

/**
 * Get posts by tag with page-based pagination.
 * NOTE: The /posts/tags/:tag backend has NOT been migrated to cursor pagination yet.
 */
export async function getPostsByTag(tag, page = 1) {
  const response = await api.get(
    `/posts/tags/${encodeURIComponent(tag)}?page=${page}&per_page=20`
  );
  return {
    posts:      response?.data?.posts                          || [],
    pagination: response?.data?.pagination || { has_next: false, page: 1 },
  };
}

// ---------------------------------------------------------------------------
// Widget data
// ---------------------------------------------------------------------------

export async function loadWidgetData() {
  const [
    suggestedConnections,
    popularTags,
    risingStars,
    openThreads,
    studyBuddyMatches,
    canHelp,
    topBadgeEarners,
  ] = await Promise.all([
    api.get('/connections/suggestions/flat?limit=10'),
    api.get('/posts/tags'),
    api.get('/reputation/rising-stars?limit=10'),
    api.get('/threads/recommended?limit=10'),
    api.get('/study-buddy/suggestions?limit=10'),
    api.get('/threads/help/suggestions?limit=10'),
    api.get('/badges/top-earners?limit=10'),
  ]);

  return {
    suggestedConnections: suggestedConnections?.data?.suggestions || suggestedConnections?.data || [],
    popularTags:          popularTags?.data || {},
    risingStars:          risingStars?.data?.rising_stars         || risingStars?.data         || [],
    openThreads:          openThreads?.data?.recommendations      || openThreads?.data         || [],
    studyBuddyMatches:    studyBuddyMatches?.data?.suggestions    || studyBuddyMatches?.data   || [],
    canHelp:              canHelp?.data?.suggestions              || canHelp?.data             || [],
    topBadgeEarners:      topBadgeEarners?.data                   || [],
  };
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

export async function bookmarkPost(postId, folder, notes, tags) {
  return await api.post('/posts/bookmark/toggle', {
    post_ids:    [postId],
    folder_name: folder,
    notes,
    tags,
  });
}

export async function bulkBookmarkPosts(postIds, folder = 'Saved', notes = '', tags = []) {
  return await api.post('/posts/bookmark/toggle', { post_ids: postIds, folder_name: folder, notes, tags });
}

/** @deprecated Use bookmarkPost() */
export async function toggleBookmark(postId) {
  return await api.post('/posts/bookmark/toggle', { post_ids: [postId] });
}

export async function getBookmarkFolders() {
  const response = await api.get('/bookmarks/folders');
  if (response.status === 'success') return response.data;
  throw new Error(response.message || 'Failed to load folders');
}

// ---------------------------------------------------------------------------
// Reactions & interactions
// ---------------------------------------------------------------------------

export async function toggleReactions(postId, reaction) {
  return await api.post(`/posts/${postId}/react`, { reaction });
}

export async function reactToPost(postId, reactionType) {
  return await api.post(`/posts/${postId}/react`, { reaction_type: reactionType });
}

export async function getPostComments(postId) {
  const response = await api.get(`/posts/${postId}/comments`);
  return response?.data?.comments || [];
}

export async function uploadPost(payload) {
  return await api.post('/posts/create', payload);
}

export async function createThread(payload) {
  return await api.post('/threads/create', payload);
}

export async function getPostQuickView(postId) {
  const response = await api.get(`/posts/${postId}/quick-view`);
  return response?.data;
}

export async function getThreadDetails(threadId, type) {
  const response = await api.post(`/threads/${threadId}/details`, { type });
  if (!response) throw new Error('Error: thread not returning response');
  return response?.data;
}

export async function getCommentResources(commentId) {
  const response = await api.get(`/comments/${commentId}/resources`);
  return response?.data?.resources || [];
}

export async function getCommentReplies(commentId) {
  try {
    const response = await api.get(`/comments/${commentId}/replies`);
    if (response.status !== 'success') throw new Error(response.message || 'Failed to load replies');
    return response?.data || { replies: [] };
  } catch (error) {
    console.error('Get replies error:', error);
    throw error;
  }
}

export async function followPost(postId)   { return await api.post(`/posts/${postId}/follow`); }
export async function unfollowPost(postId) { return await api.delete(`/posts/${postId}/unfollow`); }
export async function deletePost(postId)   { return await api.delete(`/posts/${postId}`); }
export async function deleteComment(commentId) { return await api.delete(`/comments/${commentId}`); }
export async function pinPost(postId)      { return await api.post(`/posts/${postId}/pin`); }
export async function unpinPost(postId)    { return await api.post(`/posts/${postId}/unpin`); }
export async function joinThread(threadId, type) { return await api.post(`/threads/${threadId}/join`, { type }); }
export async function reportPost(postId, reason) { return await api.post(`/posts/${postId}/report`, { reason }); }

export async function toggleCommentLike(commentId)    { return await api.post(`/comments/${commentId}/like`); }
export async function toggleCommentHelpful(commentId) { return await api.post(`/comments/${commentId}/mark-helpful`); }
export async function markCommentAsSolution(postId, commentId)   { return await api.post(`/posts/${postId}/mark-solution`, { comment_id: commentId }); }
export async function unmarkCommentAsSolution(postId, commentId) { return await api.post(`/posts/${postId}/unmark-solution`, { comment_id: commentId }); }

export async function postComment(postId, textContent, parentId = null, resources = []) {
  return await api.post('/comments/create', { post_id: postId, text_content: textContent, parent_id: parentId, resources });
}

export async function createForkedPost(postData) { return await api.post('/posts/create', postData); }
export async function trackPostView(postId)       { return await api.post(`/posts/${postId}/view`, {}); }

export async function uploadResource(file) {
  const formData = new FormData();
  formData.append('file', file);
  return await api.post('/posts/resource/upload', formData, true);
}

export async function applyPostRefinement(postId, refinement) {
  return await api.post(`/posts/${postId}/apply-refinement`, refinement);
}

export async function sendConnectionRequest(userId) { return await api.post(`/connections/request/${userId}`); }
export async function markPostSolved(postId)   { return await api.post(`/posts/${postId}/mark-solved`); }
export async function markPostUnsolved(postId) { return await api.post(`/posts/${postId}/unmark-solved`); }

export async function refinePostStream(postId, instructions = '') {
  const response = await fetch(`/student/posts/${postId}/refine`, {
    method:  'POST',
    headers: await api.getHeaders(),
    body:    JSON.stringify({ instructions }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response;
}
