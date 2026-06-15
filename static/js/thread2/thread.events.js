/**
 * thread.events.js
 * High-level user action handlers for the thread system.
 *
 * FIXES vs previous version:
 *  - BUG-C1: _replyContext captured into a local variable BEFORE handleCancelReply()
 *    nulls the module-level reference. All replies now send reply_to_id correctly.
 *  - BUG-C4: send button HTML saved before upload and restored on both success
 *    and failure paths.
 *  - BUG-C5: success toast removed from here — it lives in thread.websocket.js
 *    MESSAGE_SENT handler only.
 *  - BUG-C7: handleBackToList() reloads the thread list so membership changes
 *    (leave, removal) are reflected immediately.
 *  - HIDDEN-06: generation counter prevents stale Promise.all results from a
 *    previous handleOpenThread() call from overwriting a newer thread's UI when
 *    the user switches threads rapidly.
 *  - FE-02: textarea height reset after send.
 *  - FE-03: handleScrollToMessage closes search panel before scrolling.
 *  - FE-04: iterative page loading in handleScrollToMessage for pinned messages
 *    that are far back in history.
 *  - WS-06: emitTypingStart/Stop uses threadState.typingThreadId (set at start
 *    time) so stop targets the right thread after a switch.
 *  - HIDDEN-09: handleLeaveThread deletes thread from list before navigating back.
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
  changeMemberRole,
  uploadThreadAvatar,
  uploadAttachment,
  createStandaloneThread,
  updateThreadSettings,
  closeThread,
  reopenThread,
  deleteThread,
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


// ─── Module-level guards ──────────────────────────────────────────────────────

const _retryInFlight    = new Set();
let _typingTimer        = null;
let _isTyping           = false;
let _replyContext       = null;

/**
 * HIDDEN-06 FIX: incremented on every handleOpenThread() call.
 * Each call snapshot its own generation value. After any await, it checks
 * whether the global counter still matches. If not, a newer call has superseded
 * this one and we abort to avoid overwriting the new thread's UI.
 */
let _openThreadGeneration = 0;


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
  // HIDDEN-06 FIX: snapshot generation before any await.
  const generation = ++_openThreadGeneration;

  try {
    const {
      showThreadView,
      renderMessages,
      renderThreadHeader,
      renderPinnedBanner,
    } = await import('./thread.render.js');

    if (generation !== _openThreadGeneration) return;

    // Disconnect previous thread before joining new one.
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
        pendingAttachment:   null,
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

    // HIDDEN-06: abort if superseded.
    if (generation !== _openThreadGeneration) return;

    const { thread, user_status } = detail;

    members.forEach((m) =>
      setMember(m.user_id ?? m.id, {
        name:   m.name,
        avatar: m.avatar,
        role:   m.role,
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

  const { showThreadList } = await import('./thread.render.js');
  showThreadList();

  // BUG-C7 FIX: reload thread list so membership changes are reflected.
  await handleLoadThreadList();
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

    showToast('Thread created!', 'success');
    await handleLoadThreadList();

    const newId =
      result?.thread?.id ??
      result?.data?.thread?.id ??
      result?.data?.data?.thread?.id;
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

  const text    = input.value.trim();
  const pending = threadState.pendingAttachment;

  if (!text && !pending) return;

  let attachmentPayload = {};

  if (pending?.file) {
    const sendBtn      = document.getElementById('thread-send-btn');
    // BUG-C4 FIX: save innerHTML BEFORE overwriting it so we can restore it.
    const originalHTML = sendBtn?.innerHTML ?? '';

    if (sendBtn) { sendBtn.disabled = true; sendBtn.textContent = '…'; }

    try {
      showToast('Uploading file…', 'info');
      const result = await uploadAttachment(threadState.activeThreadId, pending.file);
      attachmentPayload = {
        attachment_url:  result.attachment_url,
        attachment_name: result.attachment_name,
        attachment_type: result.attachment_type,
        attachment_size: result.attachment_size,
      };
      threadState.pendingAttachment = null;
      _clearAttachmentStrip();

      // BUG-C4 FIX: restore button after successful upload.
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
    } catch {
      showToast('File upload failed. Message not sent.', 'error');
      // Restore button on failure.
      if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = originalHTML; }
      return;
    }
  }

  // BUG-C1 FIX: capture reply context BEFORE handleCancelReply nulls it.
  const replyCtx = _replyContext;

  // Clear input, reset height, re-evaluate send button.
  input.value        = '';
  input.style.height = '';     // FE-02 FIX: reset auto-expanded height.
  input.dispatchEvent(new Event('input'));

  handleCancelReply();
  _stopTyping();

  wsSendMessage({
    text_content: text,
    reply_to_id:  replyCtx?.id   ?? null,  // BUG-C1 FIX: uses captured value
    reply_to:     replyCtx       ?? null,
    ...attachmentPayload,
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
      attachment_url:  msg.attachment_url,
      attachment_name: msg.attachment_name,
      attachment_type: msg.attachment_type,
      attachment_size: msg.attachment_size,
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

/**
 * Toggle pin/unpin based on current message state.
 */
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
    emitTypingStart(threadId);   // WS-06: stores typingThreadId internally
  }

  clearTimeout(_typingTimer);
  _typingTimer = setTimeout(_stopTyping, THREAD_UI.TYPING_TIMEOUT_MS);
}

function _stopTyping() {
  if (!_isTyping) return;
  _isTyping = false;
  clearTimeout(_typingTimer);
  // WS-06 FIX: use captured typingThreadId instead of possibly-changed activeThreadId
  const tid = threadState.typingThreadId ?? threadState.activeThreadId;
  if (tid) emitTypingStop(tid);
}


// ─── Load more (older messages) ───────────────────────────────────────────────

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
    // HIDDEN-02 FIX: explicit null guard to keep optimistic messages separate.
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


// ─── IntersectionObserver for infinite scroll ─────────────────────────────────

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

/**
 * FE-03 FIX: close search panel before scrolling so the target is visible.
 * FE-04 FIX: iteratively load older pages until the message is found (up to
 * MAX_ATTEMPTS batches), covering pinned messages far back in history.
 */
export async function handleScrollToMessage(messageId) {
  const threadId = threadState.activeThreadId;
  if (!threadId || !messageId) return;

  // FE-03 FIX: close search panel first.
  const searchPanel = document.getElementById('thread-search-panel');
  if (searchPanel && !searchPanel.classList.contains('hidden')) {
    searchPanel.classList.add('hidden');
    searchPanel.classList.remove('flex');
  }

  let el         = document.querySelector(`[data-message-id="${messageId}"]`);
  let attempts   = 0;
  const MAX      = 10;

  while (!el && attempts < MAX && threadState.hasMore) {
    attempts++;
    try {
      const currentOldest = threadState.oldestMessageId;
      if (!currentOldest) break;

      const data    = await fetchMessages(threadId, {
        beforeId: currentOldest,
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

  if (!el) {
    showToast('Could not locate message in history.', 'error');
    return;
  }

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
    // rawDetail shape: { thread, user_status } or { data: { thread, user_status } }
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
  const attachments = threadState.messages.filter((m) => m.attachment_url && !m.is_deleted);
  const { openAttachmentViewer } = await import('./thread.render.js');
  openAttachmentViewer(attachments);
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
    // HIDDEN-09 FIX: remove thread from list immediately so it vanishes on back.
    removeThreadFromList(threadId);
    await handleBackToList();
    showToast('You left the thread', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to leave thread', 'error');
  }
}


// ─── Thread management (FEAT-02) ──────────────────────────────────────────────

export async function handleCloseThread(threadId) {
  try {
    await closeThread(threadId);
    addOrUpdateThreadInList({ id: threadId, is_open: false });
    showToast('Thread closed', 'success');
    // Refresh header to reflect closed status
    const { renderThreadHeader } = await import('./thread.render.js');
    const detail   = await fetchThread(threadId);
    const detail2  = detail.thread ?? detail.data?.thread ?? detail;
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
    showToast('Request approved', 'success');
  } catch (err) {
    showToast(err?.message ?? 'Failed to approve', 'error');
  }
}

export async function handleRejectRequest(threadId, requestId) {
  try {
    await rejectJoinRequest(threadId, requestId);
    document.querySelector(`[data-request-id="${requestId}"]`)?.remove();
    showToast('Request rejected', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to reject', 'error');
  }
}

export async function handleAcceptInvite(inviteId) {
  try {
    const result   = await acceptInvite(inviteId);
    const threadId =
      result?.thread_id ??
      result?.data?.thread_id ??
      result?.data?.data?.thread_id;
    showToast('Invitation accepted!', 'success');
    if (threadId) {
      await handleLoadThreadList();
      await handleOpenThread(threadId);
    } else {
      await handleLoadThreadList();
    }
  } catch (err) {
    showToast(err?.message ?? 'Failed to accept invite', 'error');
  }
}

export async function handleDeclineInvite(inviteId) {
  try {
    await declineInvite(inviteId);
    document.querySelector(`[data-invite-id="${inviteId}"]`)?.closest('[data-invite-row]')?.remove();
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
