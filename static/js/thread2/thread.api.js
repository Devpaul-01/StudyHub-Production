/**
 * thread.api.js
 * REST API helpers — delegates all HTTP calls to the global `api` instance.
 *
 * CHANGES vs previous version:
 *  - closeThread(), reopenThread(), deleteThread() added for FEAT-02.
 *    These were called by thread.events.js but never defined here.
 *  - All existing fixes retained (fetchCurrentUser no showToast,
 *    fetchPinnedMessages key fix, getPendingRequests key fix).
 *  - Token: global `api` handles cookie-based token refresh automatically.
 */

import { THREAD_API } from './thread.constants.js';


// ─── Current User ─────────────────────────────────────────────────────────────

export async function fetchCurrentUser() {
  try {
    const res = await api.get('/users/me');
    return res.data?.user ?? res.user ?? null;
  } catch (err) {
    console.error('[thread_api] fetchCurrentUser:', err);
    return null;
  }
}


// ─── Thread creation ──────────────────────────────────────────────────────────

export async function createStandaloneThread(data) {
  const res = await api.post(THREAD_API.CREATE_STANDALONE, {
    title:             data.title,
    description:       data.description ?? '',
    max_members:       data.max_members ?? 10,
    requires_approval: data.requires_approval !== false,
    tags:              data.tags ?? [],
    member_ids:        data.member_ids ?? [],
  });
  return res.data ?? res;
}


// ─── Thread list ──────────────────────────────────────────────────────────────

export async function fetchMyThreads() {
  const res = await api.get(THREAD_API.MY_THREADS);
  return res.data?.threads ?? [];
}

export async function fetchOpenThreads() {
  const res = await api.get(THREAD_API.OPEN);
  return res.data ?? [];
}

export async function fetchRecommendedThreads() {
  const res = await api.get(THREAD_API.RECOMMENDED);
  return res.data?.recommendations ?? [];
}

export async function fetchPopularThreads() {
  const res = await api.get(THREAD_API.POPULAR);
  return res.data?.threads ?? [];
}

export async function fetchDepartmentStats() {
  const res = await api.get(THREAD_API.DEPARTMENTS);
  return res.data?.departments ?? [];
}


// ─── Single thread ────────────────────────────────────────────────────────────

export async function fetchThread(threadId) {
  const res = await api.get(THREAD_API.THREAD(threadId));
  return res.data ?? res;
}

export async function fetchThreadMembers(threadId) {
  const res = await api.get(THREAD_API.MEMBERS(threadId));
  return res.data?.members ?? [];
}

export async function fetchThreadSettings(threadId) {
  const res = await api.get(THREAD_API.SETTINGS(threadId));
  return res.data?.settings ?? {};
}

export async function fetchThreadStats(threadId) {
  const res = await api.get(THREAD_API.STATS(threadId));
  return res.data ?? {};
}


// ─── Thread mutations ─────────────────────────────────────────────────────────

export async function updateThread(threadId, fields) {
  return api.patch(THREAD_API.THREAD(threadId), fields);
}

/** FEAT-02: Close an open thread (no new join requests accepted). */
export async function closeThread(threadId) {
  return api.post(THREAD_API.CLOSE(threadId));
}

/** FEAT-02: Reopen a closed thread. */
export async function reopenThread(threadId) {
  return api.post(THREAD_API.REOPEN(threadId));
}

/** FEAT-02: Permanently delete a thread (creator only). */
export async function deleteThread(threadId) {
  return api.delete(THREAD_API.THREAD(threadId));
}

export async function uploadThreadAvatar(threadId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(THREAD_API.AVATAR(threadId), form, true);
  return res.data ?? res;
}

export async function updateThreadSettings(threadId, settings) {
  return api.patch(THREAD_API.SETTINGS(threadId), settings);
}


// ─── Members ──────────────────────────────────────────────────────────────────

export async function removeMember(threadId, userId) {
  return api.delete(THREAD_API.REMOVE_MEMBER(threadId, userId));
}

export async function leaveThread(threadId) {
  return api.post(THREAD_API.LEAVE(threadId));
}

export async function changeMemberRole(threadId, userId, role) {
  return api.patch(THREAD_API.ROLE_UPDATE(threadId, userId), { role });
}


// ─── Join requests ────────────────────────────────────────────────────────────

export async function requestJoinThread(threadId, opts = {}) {
  return api.post(THREAD_API.JOIN(threadId), opts);
}

export async function cancelJoinRequest(requestId) {
  return api.delete(THREAD_API.CANCEL_REQUEST(requestId));
}

export async function approveJoinRequest(threadId, requestId) {
  return api.post(THREAD_API.APPROVE_REQUEST(threadId, requestId));
}

export async function rejectJoinRequest(threadId, requestId) {
  return api.post(THREAD_API.REJECT_REQUEST(threadId, requestId));
}

/** FIX: was reading res.data.requests — backend returns res.data.pending_requests */
export async function getPendingRequests() {
  const res = await api.get(THREAD_API.PENDING_REQUESTS);
  return res.data?.pending_requests ?? res.data?.requests ?? [];
}

export async function getMyJoinRequests() {
  const res = await api.get(THREAD_API.MY_REQUESTS);
  return res.data?.my_requests ?? [];
}


// ─── Invites ──────────────────────────────────────────────────────────────────

export async function inviteToThread(threadId, userId, opts = {}) {
  return api.post(THREAD_API.INVITE(threadId, userId), opts);
}

export async function getMyInvites() {
  const res = await api.get(THREAD_API.MY_INVITES);
  return res.data?.invites ?? [];
}

export async function acceptInvite(inviteId) {
  const res = await api.post(THREAD_API.ACCEPT_INVITE(inviteId));
  return res.data ?? res;
}

export async function declineInvite(inviteId) {
  return api.post(THREAD_API.DECLINE_INVITE(inviteId));
}


// ─── Messages ─────────────────────────────────────────────────────────────────

export async function fetchMessages(threadId, opts = {}) {
  const params = {};
  if (opts.beforeId) params.before_id = String(opts.beforeId);
  if (opts.afterId)  params.after_id  = String(opts.afterId);
  if (opts.limit)    params.limit     = String(opts.limit);
  const res = await api.get(THREAD_API.MESSAGES(threadId), params);
  return res.data ?? res;
}

export async function uploadAttachment(threadId, file) {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post(THREAD_API.UPLOAD(threadId), form, true);
  return res.data ?? res;
}

/** FIX: was reading res.data.pinned — backend key is res.data.pinned_messages */
export async function fetchPinnedMessages(threadId) {
  const res = await api.get(THREAD_API.PINNED(threadId));
  return res.data?.pinned_messages ?? res.data?.pinned ?? [];
}

export async function searchMessages(threadId, query, limit = 20) {
  const res = await api.get(THREAD_API.SEARCH(threadId), {
    q:     query,
    limit: String(limit),
  });
  return res.data?.results ?? [];
}
