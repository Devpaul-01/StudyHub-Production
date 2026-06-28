/**
 * thread.events.js
 * High-level user action handlers for the thread system.
 *
 * CHANGES:
 *  - BUG FIX (CRITICAL): setMember() calls now include `username` field so
 *    @mention autocomplete inserts correct @username not display name.
 *  - Issue 2: handleBackToList() re-renders from state, no API call.
 *  - Issue 4: handleSaveThreadEdit() saves core fields + settings.
 *  - Issue 5: renderInvitesList replaced with renderInvitesTab (3 sections).
 *             loadAndRenderInvitesTab() fetches all three lists in parallel.
 *             handleCancelMyRequest() added.
 *             handleAcceptInvite / handleDeclineInvite update all three lists.
 *  - Issue 1: handleSendMessage() iterates pendingAttachments[]; revokes
 *             preview URLs after successful upload.
 *  - NEW: handleOpenMeetingNotes() triggers AI meeting notes generation.
 *  - Additional imports: cancelJoinRequest, getMyInvites, getMyJoinRequests,
 *    getPendingRequests, generateMeetingNotes.
 */

import {
  threadState,
  resetThreadSession,
  addOrUpdateThreadInList,
  removeThreadFromList,
  addPendingMessage,
  failPendingMessage,
  setMember,
} from './thread.state.js';

import {
  fetchMyThreads,
  fetchThread,
  fetchMessages,
  searchMessages,
  fetchPinnedMessages,
  fetchThreadMembers,
  requestJoinThread,
  leaveThread,
  removeMember,
  approveJoinRequest,
  rejectJoinRequest,
  acceptInvite,
  declineInvite,
  cancelJoinRequest,
  getMyInvites,
  getMyJoinRequests,
  getPendingRequests,
  changeMemberRole,
  uploadThreadAvatar,
  uploadAttachment,
  createStandaloneThread,
  updateThread,
  updateThreadSettings,
  closeThread,
  reopenThread,
  deleteThread,
  generateMeetingNotes,
  addMembersToThread,
} from './thread.api.js';

import {
  initThreadWebSocket,
  disconnectThreadWebSocket,
  sendMessage as wsSendMessage,
  emitTypingStart,
  emitTypingStop,
  emitMarkRead,
} from './thread.websocket.js';

import { THREAD_UI } from './thread.constants.js';


// ─── Module-level helpers ─────────────────────────────────────────────────────

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _timeAgo(isoString) {
  if (!isoString) return '';
  const delta = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (delta < 60)    return 'just now';
  if (delta < 3600)  return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

function _updateInvitesBadge(count) {
  const badge = document.getElementById('thread-invites-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.remove('hidden');
    badge.classList.add('flex');
  } else {
    badge.classList.add('hidden');
    badge.classList.remove('flex');
  }
}


// ─── Module-level guards ──────────────────────────────────────────────────────

const _retryInFlight = new Set();
let _typingTimer     = null;
let _isTyping        = false;
let _replyContext    = null;

/**
 * HIDDEN-06: incremented on every handleOpenThread() call.
 * Post-await checks abort stale calls.
 */
let _openThreadGeneration = 0;


// ─── Issue 5: Invites tab renderers ──────────────────────────────────────────

function _renderInviteRow(invite) {
  const thread  = invite.thread ?? {};
  const inviter = invite.invited_by;
  const msgText = invite.message && !invite.message.startsWith('[')
    ? ` · "${_esc(invite.message.slice(0, 60))}"`
    : '';
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4 border-b border-gray-100 last:border-0"
         data-invite-id="${invite.invite_id}">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 truncate">${_esc(thread.title ?? 'Thread')}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${thread.department ? _esc(thread.department) + ' · ' : ''}
          ${thread.member_count ?? 0} members
        </p>
        <p class="text-xs text-gray-500 mt-0.5">
          From <strong>${_esc(inviter?.name ?? 'Someone')}</strong>${msgText}
        </p>
      </div>
      <div class="flex gap-1.5 flex-shrink-0 mt-0.5">
        <button data-action="thread-accept-invite" data-invite-id="${invite.invite_id}"
                class="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       active:scale-95 rounded-lg px-2.5 py-1.5 transition-all">
          Accept
        </button>
        <button data-action="thread-decline-invite" data-invite-id="${invite.invite_id}"
                class="text-xs font-semibold text-gray-600 border border-gray-200
                       hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">
          Decline
        </button>
      </div>
    </div>`;
}

function _renderMyRequestRow(req) {
  const thread = req.thread ?? {};
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4 border-b border-gray-100 last:border-0"
         data-request-id="${req.request_id}">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 truncate">${_esc(thread.title ?? 'Thread')}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${thread.member_count ?? 0} / ${thread.max_members ?? '?'} members
          ${thread.is_full ? ' · <span class="text-red-500">Full</span>' : ''}
        </p>
        <p class="text-xs text-gray-400 mt-0.5">Requested ${_timeAgo(req.requested_at)}</p>
      </div>
      <button data-action="thread-cancel-request" data-request-id="${req.request_id}"
              class="text-xs font-semibold text-red-500 border border-red-200
                     hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors flex-shrink-0 mt-0.5">
        Cancel
      </button>
    </div>`;
}

function _renderModerationRow(req) {
  const thread    = req.thread    ?? {};
  const requester = req.requester ?? {};
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4 border-b border-gray-100 last:border-0"
         data-request-id="${req.request_id}">
      <div class="min-w-0 flex-1">
        <p class="text-[10px] text-gray-400 truncate">${_esc(thread.title ?? '')}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-sm font-semibold text-gray-900">${_esc(requester.name ?? '')}</p>
          <span class="text-xs text-gray-400">@${_esc(requester.username ?? '')}</span>
        </div>
        ${req.message
          ? `<p class="text-xs text-gray-500 italic mt-0.5 line-clamp-1">"${_esc(req.message)}"</p>`
          : ''}
      </div>
      <div class="flex gap-1.5 flex-shrink-0 mt-0.5">
        <button data-action="thread-approve-request"
                data-thread-id="${thread.id}" data-request-id="${req.request_id}"
                class="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700
                       rounded-lg px-2.5 py-1.5 transition-all">Approve</button>
        <button data-action="thread-reject-request"
                data-thread-id="${thread.id}" data-request-id="${req.request_id}"
                class="text-xs font-semibold text-gray-600 border border-gray-200
                       hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">Reject</button>
      </div>
    </div>`;
}

function _renderSection(title, emoji, items, rowRenderer) {
  if (!items.length) return '';
  return `
    <div class="mb-2">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
        <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">
          ${emoji} ${_esc(title)}
          <span class="ml-1 text-indigo-600 font-bold">${items.length}</span>
        </span>
      </div>
      <div>${items.map(rowRenderer).join('')}</div>
    </div>`;
}

/**
 * Render the full three-section Invites tab.
 * Badge counts: invites + moderationQueue (things needing action).
 */
export function renderInvitesTab(invites, myRequests, moderationQueue) {
  const tab   = document.getElementById('thread-tab-invites');
  const empty = document.getElementById('thread-invites-empty');
  if (!tab) return;

  // Badge: items that require the user's attention
  _updateInvitesBadge(invites.length + moderationQueue.length);

  const hasAny = invites.length || myRequests.length || moderationQueue.length;

  if (!hasAny) {
    tab.querySelector('#thread-invites-list') &&
      (tab.querySelector('#thread-invites-list').innerHTML = '');
    empty?.classList.remove('hidden');
    return;
  }
  empty?.classList.add('hidden');

  const listEl = tab.querySelector('#thread-invites-list') ?? tab;
  listEl.innerHTML =
    _renderSection('Invitations',        '📬', invites,         _renderInviteRow)     +
    _renderSection('My Requests',        '📤', myRequests,      _renderMyRequestRow)  +
    _renderSection('Moderation Queue',   '🛡',  moderationQueue, _renderModerationRow);
}

/**
 * Backward-compat shim — kept so any external caller (e.g. old WS handlers)
 * still works while we transition fully to renderInvitesTab.
 */
export function renderInvitesList(invites) {
  renderInvitesTab(
    invites,
    threadState.myJoinRequests   ?? [],
    threadState.moderationQueue  ?? []
  );
}

/**
 * Fetch all three invite-related lists in parallel, store in state, render.
 */
export async function loadAndRenderInvitesTab() {
  try {
    const [invites, myRequests, modQueue] = await Promise.all([
      getMyInvites(),
      getMyJoinRequests(),
      getPendingRequests(),
    ]);

    threadState.pendingInvites  = invites;
    threadState.myJoinRequests  = myRequests;
    threadState.moderationQueue = modQueue;

    renderInvitesTab(invites, myRequests, modQueue);

    // Toast only before first init completes (not on background refreshes)
    const totalActionable = invites.length + modQueue.length;
    if (totalActionable > 0 && typeof window._threadInitDone === 'undefined') {
      showToast(
        `You have ${totalActionable} pending invite${totalActionable > 1 ? 's/requests' : ''}`,
        'info'
      );
    }
  } catch {
    // Non-fatal — Invites tab stays empty
  }
}


// ─── Thread list ──────────────────────────────────────────────────────────────

export async function handleLoadThreadList() {
  try {
    const { renderThreadList } = await import('./thread.render.js');
    renderThreadList('loading');
    const threads = await fetchMyThreads();
    threads.forEach((t) => addOrUpdateThreadInList(t));
    renderThreadList('loaded');
  } catch {
    const { renderThreadList } = await import('./thread.render.js');
    renderThreadList('error');
  }
}


// ─── Open thread ─────────────────────────────────────────────────────────────

export async function handleOpenThread(threadId) {
  const generation = ++_openThreadGeneration;

  try {
    const {
      showThreadView,
      renderMessages,
      renderThreadHeader,
      renderPinnedBanner,
    } = await import('./thread.render.js');

    if (generation !== _openThreadGeneration) return;

    const prevId = threadState.activeThreadId;
    if (prevId && prevId !== threadId) {
      disconnectThreadWebSocket(prevId);
      Object.assign(threadState, {
        messages:            [],
        pendingMessages:     new Map(),
        confirmedMessageIds: new Set(),
        typingUsers:         new Map(),
        onlineUsers:         new Map(),
        hasMore:             false,
        oldestMessageId:     null,
        isLoadingMore:       false,
        pendingAttachments:  [],
        memberMap:           new Map(),
      });
    }

    showThreadView(threadId);
    threadState.activeThreadId = threadId;

    const [detail, msgData, members] = await Promise.all([
      fetchThread(threadId),
      fetchMessages(threadId, { limit: THREAD_UI.MESSAGES_PER_PAGE }),
      fetchThreadMembers(threadId),
    ]);

    if (generation !== _openThreadGeneration) return;

    const { thread, user_status } = detail;

    // BUG FIX: include username in memberMap so @mention autocomplete works
    members.forEach((m) =>
      setMember(m.user_id ?? m.id, {
        name:     m.name,
        username: m.username,  // ← WAS MISSING — caused @mention to insert display name
        avatar:   m.avatar,
        role:     m.role,
      })
    );

    addOrUpdateThreadInList({
      id:          thread.id,
      title:       thread.title,
      avatar:      thread.avatar,
      department:  thread.department,
      tags:        thread.tags,
      is_open:     thread.is_open,
      max_members: thread.max_members,
      your_role:   user_status?.your_role,
      ...(typeof thread.member_count === 'number' && { member_count: thread.member_count }),
    });

    renderThreadHeader(thread, user_status);

    threadState.messages        = msgData.messages ?? [];
    threadState.hasMore         = msgData.has_more  ?? false;
    threadState.oldestMessageId = msgData.oldest_id ?? null;

    renderMessages(threadState.messages);

    const pinned = threadState.messages.filter((m) => m.is_pinned && !m.is_deleted);
    if (pinned.length) renderPinnedBanner(pinned);

    const { socket } = await import('./thread.init.js');
    if (generation !== _openThreadGeneration) return;

    initThreadWebSocket(socket, threadId);
    emitMarkRead(threadId);
    addOrUpdateThreadInList({ id: threadId, unread_count: 0 });

    _observeTopSentinel();

  } catch (err) {
    if (generation !== _openThreadGeneration) return;
    showToast(err?.message ?? 'Failed to open thread. Please try again.', 'error');
    const { showThreadError } = await import('./thread.render.js');
    showThreadError('Failed to open thread. Please try again.');
  }
}


// ─── Back to list ─────────────────────────────────────────────────────────────

export async function handleBackToList() {
  const prevId = threadState.activeThreadId;
  if (_isTyping) _stopTyping();
  if (prevId) disconnectThreadWebSocket(prevId);
  resetSentinelObserver();
  resetThreadSession();

  const { showThreadList, renderThreadList } = await import('./thread.render.js');
  showThreadList();
  renderThreadList('loaded');  // Re-renders from state — no API call
}


// ─── Create thread ────────────────────────────────────────────────────────────

export async function handleCreateThread(dataOrForm) {
  let data;
  if (dataOrForm instanceof HTMLElement) {
    const form    = dataOrForm;
    const tagsRaw = form.querySelector("[name='tags']")?.value ?? '';
    data = {
      title:             form.querySelector("[name='title']")?.value?.trim() ?? '',
      description:       form.querySelector("[name='description']")?.value?.trim() ?? '',
      max_members:       Number(form.querySelector("[name='max_members']")?.value ?? 10),
      requires_approval: form.querySelector("[name='requires_approval']")?.checked ?? true,
      tags:              tagsRaw.split(',').map((t) => t.trim()).filter(Boolean),
    };
  } else {
    data = dataOrForm;
  }

  if (!data?.title || data.title.length < 5) {
    showToast('Thread title must be at least 5 characters', 'error');
    return;
  }

  try {
    showToast('Creating thread…', 'info');
    const result = await createStandaloneThread(data);

    const modal = document.getElementById('thread-create-modal');
    if (modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }

    const newThread = result?.thread ?? result?.data?.thread ?? result?.data?.data?.thread;

    if (newThread) {
      addOrUpdateThreadInList({
        ...newThread,
        your_role:    'creator',
        is_creator:   true,
        unread_count: 0,
      });
      const { renderThreadList } = await import('./thread.render.js');
      renderThreadList('loaded');
    }

    showToast('Thread created!', 'success');

    const newId = newThread?.id ?? result?.data?.thread?.id;
    if (newId) await handleOpenThread(newId);

  } catch (err) {
    showToast(err?.message ?? 'Failed to create thread', 'error');
  }
}


// ─── Send message ─────────────────────────────────────────────────────────────

export async function handleSendMessage() {
  const input = document.getElementById('thread-message-input')
              ?? document.querySelector("[data-role='thread-input']");
  if (!input) return;

  const text        = input.value.trim();
  const pendingAtts = [...(threadState.pendingAttachments ?? [])];

  if (!text && !pendingAtts.length) return;

  const attachmentResults = [];
  if (pendingAtts.length) {
    const sendBtn      = document.getElementById('thread-send-btn');
    const originalHTML = sendBtn?.innerHTML ?? '';

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    try {
      showToast(
        pendingAtts.length > 1 ? `Uploading ${pendingAtts.length} files…` : 'Uploading…',
        'info'
      );

      for (let i = 0; i < pendingAtts.length; i++) {
        const att = pendingAtts[i];
        const result = await uploadAttachment(
          threadState.activeThreadId,
          att.file,
          (pct) => {
            if (sendBtn && pct < 100) sendBtn.textContent = `${pct}%`;
          }
        );
        attachmentResults.push({
          attachment_url:  result.attachment_url,
          attachment_name: result.attachment_name,
          attachment_type: result.attachment_type,
          attachment_size: result.attachment_size,
        });
      }

      // Revoke preview URLs now that upload is done
      pendingAtts.forEach((att) => {
        if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
      });
      threadState.pendingAttachments = [];
      _clearAttachmentStrip();

      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
    } catch {
      showToast('File upload failed. Message not sent.', 'error');
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
      return;
    }
  }

  // BUG-C1: capture reply context BEFORE handleCancelReply nulls it
  const replyCtx = _replyContext;

  input.value        = '';
  input.style.height = '';
  input.dispatchEvent(new Event('input'));

  handleCancelReply();
  _stopTyping();

  wsSendMessage({
    text_content: text,
    reply_to_id:  replyCtx?.id ?? null,
    reply_to:     replyCtx     ?? null,
    attachments:  attachmentResults,
  });
}

function _clearAttachmentStrip() {
  const strip = document.getElementById('thread-attachment-strip');
  if (strip) { strip.innerHTML = ''; strip.classList.add('hidden'); }
}


// ─── Retry failed message ─────────────────────────────────────────────────────

export async function handleRetryMessage(clientTempId) {
  if (_retryInFlight.has(clientTempId)) return;
  _retryInFlight.add(clientTempId);

  try {
    const msg = threadState.messages.find((m) => m.client_temp_id === clientTempId);
    if (!msg || msg.status !== 'failed') return;

    msg.status = 'pending';
    const { renderRetryPending } = await import('./thread.render.js');
    renderRetryPending(clientTempId);

    wsSendMessage({
      text_content:    msg.text_content,
      reply_to_id:     msg.reply_to_id,
      attachments:     msg.attachments     ?? [],
      attachment_url:  msg.attachment_url  ?? null,
      attachment_name: msg.attachment_name ?? null,
      attachment_type: msg.attachment_type ?? null,
      attachment_size: msg.attachment_size ?? null,
    });

    const idx = threadState.messages.findIndex((m) => m.client_temp_id === clientTempId);
    if (idx !== -1) threadState.messages.splice(idx, 1);

    const { removeMessageFromDOM } = await import('./thread.render.js');
    removeMessageFromDOM(null, clientTempId);
  } finally {
    setTimeout(() => _retryInFlight.delete(clientTempId), 2000);
  }
}


// ─── Delete / edit / pin / react ──────────────────────────────────────────────

export async function handleDeleteMessage(messageId) {
  const { socket } = await import('./thread.init.js');
  socket.emit('delete_thread_message', { token: api.getToken(), message_id: messageId });
}

export async function handleEditMessage(messageId, newText) {
  if (!newText?.trim()) return;
  const { socket } = await import('./thread.init.js');
  socket.emit('edit_thread_message', {
    token:        api.getToken(),
    message_id:   messageId,
    text_content: newText.trim(),
  });
}

export async function handlePinMessage(messageId) {
  const msg   = threadState.messages.find((m) => m.id === messageId);
  const event = msg?.is_pinned ? 'unpin_thread_message' : 'pin_thread_message';
  const { socket } = await import('./thread.init.js');
  socket.emit(event, { token: api.getToken(), message_id: messageId });
}

export async function handleReaction(messageId, emoji) {
  const { socket } = await import('./thread.init.js');
  socket.emit('add_thread_reaction', {
    token:      api.getToken(),
    message_id: messageId,
    emoji,
  });
}


// ─── Reply ────────────────────────────────────────────────────────────────────

export async function handleReply(messageId) {
  const msg = threadState.messages.find((m) => m.id === messageId);
  if (!msg) return;
  _replyContext = { id: messageId, text: msg.text_content, sender: msg.sender?.name ?? '' };
  const { renderReplyPreview } = await import('./thread.render.js');
  renderReplyPreview(_replyContext);
  document.getElementById('thread-message-input')?.focus();
}

export async function handleCancelReply() {
  _replyContext = null;
  const { clearReplyPreview } = await import('./thread.render.js');
  clearReplyPreview();
}


// ─── Typing ───────────────────────────────────────────────────────────────────

export function handleInputTyping() {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;

  if (!_isTyping) {
    _isTyping = true;
    emitTypingStart(threadId);
  }

  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(_stopTyping, THREAD_UI.TYPING_TIMEOUT_MS);
}

function _stopTyping() {
  if (!_isTyping) return;
  _isTyping = false;
  clearTimeout(_typingTimer);
  const tid = threadState.typingThreadId ?? threadState.activeThreadId;
  if (tid) emitTypingStop(tid);
}


// ─── Load more ────────────────────────────────────────────────────────────────

export async function handleLoadMoreMessages() {
  if (threadState.isLoadingMore || !threadState.hasMore) return;
  const threadId = threadState.activeThreadId;
  if (!threadId) return;

  threadState.isLoadingMore = true;
  try {
    const data = await fetchMessages(threadId, {
      beforeId: threadState.oldestMessageId,
      limit:    THREAD_UI.MESSAGES_PER_PAGE,
    });

    const existingIds = new Set(threadState.messages.map((m) => m.id));
    const newMsgs = (data.messages ?? []).filter(
      (m) => m.id != null && !existingIds.has(m.id)
    );

    threadState.messages        = [...newMsgs, ...threadState.messages];
    threadState.hasMore         = data.has_more  ?? false;
    threadState.oldestMessageId = data.oldest_id ?? null;

    const { prependMessages } = await import('./thread.render.js');
    prependMessages(newMsgs);
  } catch {
    showToast('Failed to load older messages.', 'error');
  } finally {
    threadState.isLoadingMore = false;
  }
}


// ─── IntersectionObserver for infinite scroll ──────────────────────────────────

let _sentinel         = null;
let _sentinelObserver = null;

function _observeTopSentinel() {
  if (_sentinel && !_sentinel.isConnected) {
    _sentinelObserver?.disconnect();
    _sentinel = null;
    _sentinelObserver = null;
  }

  if (_sentinel || !('IntersectionObserver' in window)) return;

  _sentinel = document.getElementById('thread-top-sentinel');
  if (!_sentinel) return;

  const msgList = document.getElementById('thread-messages-list');
  _sentinelObserver = new IntersectionObserver(
    (entries) => { if (entries[0].isIntersecting) handleLoadMoreMessages(); },
    { root: msgList, threshold: 0.1 }
  );
  _sentinelObserver.observe(_sentinel);
}

export function resetSentinelObserver() {
  _sentinelObserver?.disconnect();
  _sentinel         = null;
  _sentinelObserver = null;
}


// ─── Search ───────────────────────────────────────────────────────────────────

export async function handleThreadSearch(query) {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;
  const q = (query ?? '').trim();
  if (q.length < 2) return;

  try {
    const results = await searchMessages(threadId, q);
    const { renderSearchResults } = await import('./thread.render.js');
    renderSearchResults(results, q);
    if (!results?.length) showToast('No messages matched your search.', 'info');
  } catch {
    showToast('Search failed. Please try again.', 'error');
  }
}

export async function handleClearSearch() {
  const { clearSearchResults } = await import('./thread.render.js');
  clearSearchResults();
}


// ─── Scroll to message ────────────────────────────────────────────────────────

export async function handleScrollToMessage(messageId) {
  const threadId = threadState.activeThreadId;
  if (!threadId || !messageId) return;

  const searchPanel = document.getElementById('thread-search-panel');
  if (searchPanel && !searchPanel.classList.contains('hidden')) {
    searchPanel.classList.add('hidden');
    searchPanel.classList.remove('flex');
  }

  let el       = document.querySelector(`[data-message-id="${messageId}"]`);
  let attempts = 0;
  const MAX    = 10;

  while (!el && attempts < MAX && threadState.hasMore) {
    attempts++;
    try {
      const data    = await fetchMessages(threadId, {
        beforeId: threadState.oldestMessageId,
        limit:    THREAD_UI.MESSAGES_PER_PAGE,
      });
      const existing = new Set(threadState.messages.map((m) => m.id));
      const newMsgs  = (data.messages ?? []).filter(
        (m) => m.id != null && !existing.has(m.id)
      );
      if (!newMsgs.length) break;

      threadState.messages        = [...newMsgs, ...threadState.messages];
      threadState.hasMore         = data.has_more  ?? false;
      threadState.oldestMessageId = data.oldest_id ?? null;

      const { prependMessages } = await import('./thread.render.js');
      prependMessages(newMsgs);
      el = document.querySelector(`[data-message-id="${messageId}"]`);
    } catch {
      break;
    }
  }

  if (!el) { showToast('Could not locate message in history.', 'error'); return; }

  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-highlight');
  setTimeout(() => el.classList.remove('message-highlight'), THREAD_UI.HIGHLIGHT_DURATION_MS);
}


// ─── Info panel ───────────────────────────────────────────────────────────────

export async function handleOpenInfo() {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;
  try {
    const [members, rawDetail] = await Promise.all([
      fetchThreadMembers(threadId),
      fetchThread(threadId),
    ]);
    const thread      = rawDetail.thread      ?? rawDetail.data?.thread;
    const user_status = rawDetail.user_status ?? rawDetail.data?.user_status ?? {};
    const { openInfoModal } = await import('./thread.modals.js');
    openInfoModal(thread, members, user_status);
  } catch {
    showToast('Failed to load thread info', 'error');
  }
}


// ─── Pinned messages ──────────────────────────────────────────────────────────

export async function handleOpenPinnedList() {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;
  try {
    const pins = await fetchPinnedMessages(threadId);
    const { openPinnedMessagesPanel } = await import('./thread.modals.js');
    openPinnedMessagesPanel(pins);
  } catch {
    showToast('Failed to load pinned messages', 'error');
  }
}


// ─── Attachments viewer ───────────────────────────────────────────────────────

export async function handleOpenAttachments() {
  const attachments = threadState.messages.filter(
    (m) => (m.attachment_url || m.attachments?.length) && !m.is_deleted
  );
  const { openAttachmentViewer } = await import('./thread.render.js');
  openAttachmentViewer(attachments);
}


// ─── Meeting Notes (NEW) ──────────────────────────────────────────────────────

/**
 * Open the range-picker, then generate AI meeting notes.
 */
export async function handleOpenMeetingNotes() {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;

  const { openMeetingNotesRangeModal, openMeetingNotesModal } =
    await import('./thread.modals.js');

  openMeetingNotesRangeModal(async (messageRange) => {
    try {
      showToast('Generating meeting notes…', 'info');
      const result = await generateMeetingNotes(threadId, messageRange);
      const notes  = result?.notes_json ?? result?.notes ?? result;
      openMeetingNotesModal(notes, result?.message_count ?? null);
    } catch (err) {
      showToast(err?.message ?? 'Failed to generate meeting notes', 'error');
    }
  });
}


// ─── Member management ────────────────────────────────────────────────────────

export async function handleRemoveMember(threadId, userId) {
  const confirmed = await _showConfirm(
    'Remove Member',
    'Are you sure you want to remove this member?'
  );
  if (!confirmed) return;

  try {
    await removeMember(threadId, userId);
    addOrUpdateThreadInList({
      id:           threadId,
      member_count: (threadState.threadList.get(threadId)?.member_count ?? 1) - 1,
    });
    showToast('Member removed', 'success');
    await handleOpenInfo();
  } catch (err) {
    showToast(err?.message ?? 'Failed to remove member', 'error');
  }
}

/**
 * Open the Add Members picker and add the selected connections directly.
 * Only the thread creator or a moderator can call this.
 */
export async function handleAddMembers(threadId) {
  try {
    const [rawDetail, members] = await Promise.all([
      fetchThread(threadId),
      fetchThreadMembers(threadId),
    ]);

    const thread      = rawDetail.thread ?? rawDetail.data?.thread;
    const memberIds   = members.map((m) => m.user_id ?? m.id);

    const { openAddMembersModal } = await import('./thread.modals.js');

    openAddMembersModal(thread, memberIds, async (selectedUserIds) => {
      try {
        showToast('Adding members…', 'info');
        const result = await addMembersToThread(threadId, selectedUserIds);

        const added   = result?.added   ?? [];
        const skipped = result?.skipped ?? [];

        if (added.length) {
          addOrUpdateThreadInList({
            id:           threadId,
            member_count: result.member_count ?? (
              (threadState.threadList.get(threadId)?.member_count ?? 0) + added.length
            ),
          });
          showToast(
            `Added ${added.length} member${added.length !== 1 ? 's' : ''}` +
            (skipped.length ? ` (${skipped.length} skipped)` : ''),
            'success'
          );
          // Re-open the info modal so the updated member list is visible
          await handleOpenInfo();
        } else {
          showToast('No new members were added', 'info');
        }
      } catch (err) {
        showToast(err?.message ?? 'Failed to add members', 'error');
      }
    });
  } catch (err) {
    showToast(err?.message ?? 'Failed to open member picker', 'error');
  }
}

export async function handleChangeMemberRole(threadId, userId, role) {
  try {
    await changeMemberRole(threadId, userId, role);
    showToast(`Role updated to ${role}`, 'success');
    await handleOpenInfo();
  } catch (err) {
    showToast(err?.message ?? 'Failed to update role', 'error');
  }
}

export async function handleLeaveThread(threadId) {
  const confirmed = await _showConfirm('Leave Thread', 'Are you sure you want to leave?');
  if (!confirmed) return;
  try {
    await leaveThread(threadId);
    removeThreadFromList(threadId);
    await handleBackToList();
    showToast('You left the thread', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to leave thread', 'error');
  }
}


// ─── Issue 4: Thread settings editing ────────────────────────────────────────

export async function handleSaveThreadEdit(threadId, fields) {
  try {
    showToast('Saving changes…', 'info');

    await updateThread(threadId, {
      title:       fields.title,
      description: fields.description,
      tags:        fields.tags,
      max_members: fields.max_members,
    });

    await updateThreadSettings(threadId, {
      requires_approval: fields.requires_approval,
      max_members:       fields.max_members,
    });

    addOrUpdateThreadInList({ id: threadId, ...fields });
    showToast('Thread updated!', 'success');

    const { renderThreadHeader } = await import('./thread.render.js');
    const detail  = await fetchThread(threadId);
    const thread2 = detail.thread ?? detail.data?.thread;
    if (thread2) renderThreadHeader(thread2, detail.user_status);

  } catch (err) {
    showToast(err?.message ?? 'Failed to save changes', 'error');
  }
}


// ─── Thread management ────────────────────────────────────────────────────────

export async function handleCloseThread(threadId) {
  try {
    await closeThread(threadId);
    addOrUpdateThreadInList({ id: threadId, is_open: false });
    showToast('Thread closed', 'success');
    const { renderThreadHeader } = await import('./thread.render.js');
    const detail  = await fetchThread(threadId);
    const detail2 = detail.thread ?? detail.data?.thread ?? detail;
    renderThreadHeader(detail2, detail.user_status);
  } catch (err) {
    showToast(err?.message ?? 'Failed to close thread', 'error');
  }
}

export async function handleReopenThread(threadId) {
  try {
    await reopenThread(threadId);
    addOrUpdateThreadInList({ id: threadId, is_open: true });
    showToast('Thread reopened', 'success');
    const { renderThreadHeader } = await import('./thread.render.js');
    const detail  = await fetchThread(threadId);
    const detail2 = detail.thread ?? detail.data?.thread ?? detail;
    renderThreadHeader(detail2, detail.user_status);
  } catch (err) {
    showToast(err?.message ?? 'Failed to reopen thread', 'error');
  }
}

export async function handleDeleteThread(threadId) {
  const confirmed = await _showConfirm(
    'Delete Thread',
    'This permanently deletes the thread and all messages. This cannot be undone.'
  );
  if (!confirmed) return;
  try {
    await deleteThread(threadId);
    removeThreadFromList(threadId);
    await handleBackToList();
    showToast('Thread deleted', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to delete thread', 'error');
  }
}


// ─── Thread avatar ────────────────────────────────────────────────────────────

export async function handleThreadAvatarUpload(threadId, file) {
  try {
    showToast('Uploading avatar…', 'info');
    const result = await uploadThreadAvatar(threadId, file);
    const url    = result.avatar_url ?? result.data?.avatar_url;
    if (url) {
      addOrUpdateThreadInList({ id: threadId, avatar: url });
      const { updateThreadAvatar } = await import('./thread.render.js');
      updateThreadAvatar?.(threadId, url);
      showToast('Avatar updated!', 'success');
    }
  } catch (err) {
    showToast(err?.message ?? 'Avatar upload failed', 'error');
  }
}


// ─── Join / invite ────────────────────────────────────────────────────────────

export async function handleJoinThread(threadId) {
  try {
    const detail = await fetchThread(threadId);
    const thread = detail.thread ?? detail.data?.thread;
    const { openJoinRequestModal } = await import('./thread.modals.js');

    openJoinRequestModal(thread, async (message) => {
      try {
        await requestJoinThread(threadId, message ? { message } : {});
        showToast(
          thread.requires_approval
            ? 'Join request sent! Waiting for approval.'
            : 'You joined the thread!',
          'success'
        );
        if (!thread.requires_approval) {
          await handleLoadThreadList();
          await handleOpenThread(threadId);
        }
      } catch (err) {
        showToast(err?.message ?? 'Failed to request join', 'error');
      }
    });
  } catch {
    showToast('Failed to load thread details', 'error');
  }
}

export async function handleApproveRequest(threadId, requestId) {
  try {
    await approveJoinRequest(threadId, requestId);
    document.querySelector(`[data-request-id="${requestId}"]`)?.remove();

    // Update moderation queue state
    threadState.moderationQueue = (threadState.moderationQueue ?? []).filter(
      (r) => r.request_id !== requestId
    );
    renderInvitesTab(
      threadState.pendingInvites  ?? [],
      threadState.myJoinRequests  ?? [],
      threadState.moderationQueue
    );

    showToast('Request approved', 'success');
  } catch (err) {
    showToast(err?.message ?? 'Failed to approve', 'error');
  }
}

export async function handleRejectRequest(threadId, requestId) {
  try {
    await rejectJoinRequest(threadId, requestId);
    document.querySelector(`[data-request-id="${requestId}"]`)?.remove();

    threadState.moderationQueue = (threadState.moderationQueue ?? []).filter(
      (r) => r.request_id !== requestId
    );
    renderInvitesTab(
      threadState.pendingInvites  ?? [],
      threadState.myJoinRequests  ?? [],
      threadState.moderationQueue
    );

    showToast('Request rejected', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to reject', 'error');
  }
}

/**
 * Cancel a join request the current user sent.
 */
export async function handleCancelMyRequest(requestId) {
  try {
    await cancelJoinRequest(requestId);
    document.querySelector(`[data-request-id="${requestId}"]`)?.remove();

    threadState.myJoinRequests = (threadState.myJoinRequests ?? []).filter(
      (r) => r.request_id !== requestId
    );
    renderInvitesTab(
      threadState.pendingInvites  ?? [],
      threadState.myJoinRequests,
      threadState.moderationQueue ?? []
    );

    showToast('Request cancelled', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to cancel request', 'error');
  }
}

export async function handleAcceptInvite(inviteId) {
  try {
    const result   = await acceptInvite(inviteId);
    const threadId = result?.thread_id ?? result?.data?.thread_id;
    const threadData = result?.thread ?? result?.data?.thread;

    // Update pending invites state
    threadState.pendingInvites = (threadState.pendingInvites ?? []).filter(
      (i) => i.invite_id !== inviteId
    );
    renderInvitesTab(
      threadState.pendingInvites,
      threadState.myJoinRequests  ?? [],
      threadState.moderationQueue ?? []
    );

    showToast('Invitation accepted!', 'success');

    if (threadData) {
      addOrUpdateThreadInList({ ...threadData, your_role: 'member', unread_count: 0 });
      const { renderThreadList } = await import('./thread.render.js');
      renderThreadList('loaded');
    }

    if (threadId) {
      await handleOpenThread(threadId);
    } else if (!threadData) {
      await handleLoadThreadList();
    }
  } catch (err) {
    showToast(err?.message ?? 'Failed to accept invite', 'error');
  }
}

export async function handleDeclineInvite(inviteId) {
  try {
    await declineInvite(inviteId);

    threadState.pendingInvites = (threadState.pendingInvites ?? []).filter(
      (i) => i.invite_id !== inviteId
    );
    renderInvitesTab(
      threadState.pendingInvites,
      threadState.myJoinRequests  ?? [],
      threadState.moderationQueue ?? []
    );

    showToast('Invitation declined', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to decline', 'error');
  }
}


// ─── Settings save ────────────────────────────────────────────────────────────

export async function handleSaveSettings(form) {
  const threadId = threadState.activeThreadId;
  if (!threadId) return;
  const maxMembers       = Number(form.querySelector("[name='max_members']")?.value);
  const requiresApproval = form.querySelector("[name='requires_approval']")?.checked ?? true;
  try {
    await updateThreadSettings(threadId, { max_members: maxMembers, requires_approval: requiresApproval });
    showToast('Settings saved', 'success');
  } catch (err) {
    showToast(err?.message ?? 'Failed to save settings', 'error');
  }
}


// ─── Custom confirm modal ─────────────────────────────────────────────────────

function _showConfirm(title, message) {
  return new Promise((resolve) => {
    const modal   = document.getElementById('thread-confirm-modal');
    const titleEl = document.getElementById('thread-confirm-title');
    const msgEl   = document.getElementById('thread-confirm-message');

    if (!modal) { resolve(window.confirm(message)); return; }

    if (titleEl) titleEl.textContent = title;
    if (msgEl)   msgEl.textContent   = message;
    modal.classList.remove('hidden');

    const okBtn  = document.getElementById('thread-confirm-ok');
    const cancel = modal.querySelector("[data-action='thread-confirm-cancel']");

    function cleanup() {
      modal.classList.add('hidden');
      okBtn?.removeEventListener('click',  onOk);
      cancel?.removeEventListener('click', onCancel);
    }
    function onOk()     { cleanup(); resolve(true);  }
    function onCancel() { cleanup(); resolve(false); }

    okBtn?.addEventListener('click',  onOk,     { once: true });
    cancel?.addEventListener('click', onCancel, { once: true });
  });
}

// ─── showToast (local fallback) ───────────────────────────────────────────────

function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[${type}] ${message}`);
  }
}
