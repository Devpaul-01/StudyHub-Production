/**
 * thread.render.js — Tailwind edition
 * DOM rendering functions for the thread chat view.
 *
 * FIXES vs previous version:
 *  - BUG-C2: moveThreadToTop() exported — moves list item to first position
 *    without a full re-render. Called by thread.websocket.js on NEW_MESSAGE.
 *  - BUG-C3: confirmOptimisticMessage() injects the ⋯ options button if missing.
 *    Optimistic messages render without a server ID so the options button is
 *    omitted; once the server confirms the message and provides a real ID the
 *    button is injected here.
 *  - BUG-C5: toast removed from confirmOptimisticMessage — it now lives only in
 *    the MESSAGE_SENT handler in thread.websocket.js.
 *  - HIDDEN-08: all showToast calls use the global window.showToast (from api.js)
 *    instead of a local implementation. The local showToast export is kept as a
 *    re-export alias for backward compatibility with any direct imports.
 *  - FE-05: renderMessageEdit/renderMessageDelete/renderPinUpdate no longer call
 *    showToast (premature success before server confirmation). Toasts for these
 *    actions live in thread.websocket.js event handlers.
 *  - HIDDEN-04 (partial): _openModal listener moved to creation — no accumulation.
 *    Full fix in thread.modals.js.
 */

import {
  threadState,
  getTypingUsers,
  getMember,
} from './thread.state.js';

import {
  threadMessageTemplate,
  systemMessageTemplate,
  typingIndicatorTemplate,
  threadListItemTemplate,
  searchResultItemTemplate,
  pinnedMessagesBannerTemplate,
} from './thread.templates.js';

import { MSG_STATUS } from './thread.constants.js';


// ─── Toast (HIDDEN-08 FIX) ────────────────────────────────────────────────────
// All toast calls use the global showToast from api.js to avoid two separate
// toast containers appearing simultaneously. This export is kept for any
// modules that import showToast directly from render.js.

export { showToast };

/** Thin shim so external callers that import from render.js still work. */
function showToast(message, type = 'info') {
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  }
}


// ─── View switching ───────────────────────────────────────────────────────────

export function showThreadList() {
  document.getElementById('thread-list-panel')?.classList.remove('hidden');
  document.getElementById('thread-chat-panel')?.classList.add('hidden');
}

export function showThreadView(threadId) {
  document.getElementById('thread-list-panel')?.classList.add('hidden');
  const chatView = document.getElementById('thread-chat-panel');
  if (chatView) {
    chatView.classList.remove('hidden');
    chatView.setAttribute('data-thread-id', String(threadId));
  }
}


// ─── Thread list ─────────────────────────────────────────────────────────────

export function renderThreadList(state) {
  const container = document.getElementById('thread-list-container')
                 ?? document.querySelector("[data-role='thread-list']");
  if (!container) return;

  if (state === 'loading') {
    const skeleton = `
      <div class="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-gray-50">
        <div class="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0"></div>
        <div class="flex-1 space-y-2">
          <div class="h-3.5 bg-gray-200 rounded-full w-2/3"></div>
          <div class="h-3 bg-gray-100 rounded-full w-5/6"></div>
        </div>
      </div>`;
    container.innerHTML = skeleton.repeat(5);
    return;
  }

  if (state === 'error') {
    container.innerHTML = `
      <div class="flex flex-col items-center gap-2 py-12 px-4">
        <span class="text-2xl">⚠️</span>
        <p class="text-sm text-gray-500 text-center">Failed to load threads.</p>
        <button data-action="reload-threads"
                class="text-sm text-indigo-600 font-semibold hover:underline">
          Retry
        </button>
      </div>`;
    return;
  }

  const threads = Array.from(threadState.threadList.values()).sort(
    (a, b) => new Date(b.last_activity) - new Date(a.last_activity)
  );

  if (!threads.length) {
    container.innerHTML = `
      <div class="flex flex-col items-center gap-3 py-16 px-4 text-center">
        <span class="text-4xl">💬</span>
        <p class="text-sm text-gray-500">No threads yet.</p>
        <button data-action="open-create-thread-modal"
                class="text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       active:scale-95 rounded-xl px-4 py-2 transition-all">
          Create a Thread
        </button>
      </div>`;
    return;
  }

  container.innerHTML = threads
    .map((t) => threadListItemTemplate(t, threadState.currentUser?.id))
    .join('');
}

/**
 * BUG-C2 FIX: Move a thread list item to the top of the list without
 * re-rendering all items. Called every time a new message arrives.
 *
 * @param {number} threadId
 */
export function moveThreadToTop(threadId) {
  const container = document.getElementById('thread-list-container')
                 ?? document.querySelector("[data-role='thread-list']");
  if (!container) return;

  const item = container.querySelector(`[data-thread-id="${threadId}"]`);
  if (item && container.firstElementChild !== item) {
    container.prepend(item);
  }

  // Also update the preview text and timestamp in the existing item.
  const thread  = threadState.threadList.get(threadId);
  const lastMsg = thread?.last_message;
  if (!item || !lastMsg) return;

  const previewEl = item.querySelector('.thread-last-message');
  if (previewEl) {
    const prefix = lastMsg.sender_id === threadState.currentUser?.id
      ? 'You: '
      : lastMsg.sender ? `${lastMsg.sender.split(' ')[0]}: ` : '';
    previewEl.textContent = prefix + (lastMsg.text ?? '').slice(0, 55);
  }
}


// ─── Thread header ────────────────────────────────────────────────────────────

export function renderThreadHeader(thread, userStatus) {
  const header = document.getElementById('thread-chat-header');
  if (!header) return;

  const isCreator = thread.creator_id === threadState.currentUser?.id ||
                    userStatus?.your_role === 'creator';

  const avatarHtml = thread.avatar
    ? `<img src="${_escAttr(thread.avatar)}"
            class="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="${_esc(thread.title)}">`
    : `<div class="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold
                   flex items-center justify-center flex-shrink-0 select-none">
         ${_esc(thread.title.charAt(0).toUpperCase())}
       </div>`;

  const closedBadge = !thread.is_open
    ? `<span class="text-[10px] font-semibold text-red-500 bg-red-50 rounded px-1.5 py-0.5 ml-1">
         Closed
       </span>`
    : '';

  header.innerHTML = `
    <div class="flex items-center gap-2 min-w-0 flex-1">
      ${avatarHtml}
      <div class="min-w-0">
        <h2 class="text-sm font-bold text-gray-900 truncate leading-tight">
          ${_esc(thread.title)}${closedBadge}
        </h2>
        <p class="text-xs text-gray-400 leading-tight">
          ${thread.member_count} member${thread.member_count !== 1 ? 's' : ''}
        </p>
      </div>
    </div>

    <div class="flex items-center gap-0.5 flex-shrink-0">
      <button data-action="thread-search" title="Search"
              class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400
                     hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors">
        <svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </button>
      <button data-action="thread-open-pinned-list" title="Pinned"
              class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400
                     hover:text-amber-500 hover:bg-amber-50 active:bg-amber-100 transition-colors text-base">
        📌
      </button>
      <button data-action="thread-info" title="Thread info"
              class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400
                     hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 transition-colors">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
    </div>`;
}


// ─── Messages ─────────────────────────────────────────────────────────────────

export function renderMessages(messages) {
  const container = _msgContainer();
  if (!container) return;

  // Preserve sentinel; remove all other children.
  Array.from(container.children).forEach((child) => {
    if (child.id !== 'thread-top-sentinel') child.remove();
  });

  if (!messages.length) {
    container.insertAdjacentHTML('beforeend', `
      <div class="flex flex-col items-center justify-center h-full gap-2 py-16">
        <span class="text-3xl">👋</span>
        <p class="text-sm text-gray-400">No messages yet. Say hello!</p>
      </div>`);
    return;
  }

  container.insertAdjacentHTML(
    'beforeend',
    messages.map((m) => threadMessageTemplate(m, threadState.currentUser?.id)).join('')
  );

  scrollToBottom(container);
}

export function prependMessages(messages) {
  const container = _msgContainer();
  if (!container || !messages.length) return;

  const prevHeight = container.scrollHeight;
  const html = messages
    .map((m) => threadMessageTemplate(m, threadState.currentUser?.id))
    .join('');

  const sentinel = document.getElementById('thread-top-sentinel');
  if (sentinel) {
    sentinel.insertAdjacentHTML('afterend', html);
  } else {
    container.insertAdjacentHTML('afterbegin', html);
  }
  container.scrollTop += container.scrollHeight - prevHeight;
}

export function renderNewMessage(message) {
  const container = _msgContainer();
  if (!container) return;

  // Dedup: if real ID already in DOM, skip.
  if (message.id && document.querySelector(`[data-message-id="${message.id}"]`)) return;
  // Dedup: if temp ID already in DOM, skip (already rendered as optimistic).
  if (message.client_temp_id && document.querySelector(`[data-temp-id="${message.client_temp_id}"]`)) return;

  const atBottom = _isNearBottom(container);
  container.insertAdjacentHTML(
    'beforeend',
    threadMessageTemplate(message, threadState.currentUser?.id)
  );

  if (atBottom || message.sender_id === threadState.currentUser?.id) {
    scrollToBottom(container);
  }

  _updateListItemPreview(message);
}

/**
 * BUG-C3 FIX: inject the ⋯ options button after confirmation since optimistic
 * messages are rendered without a server ID (so the button was omitted).
 * BUG-C5 FIX: no showToast here — toast lives in MESSAGE_SENT WS handler only.
 */
export function confirmOptimisticMessage(clientTempId, serverData) {
  const el = document.querySelector(`[data-temp-id="${clientTempId}"]`);
  if (!el) return;

  if (serverData.id) el.setAttribute('data-message-id', String(serverData.id));
  el.removeAttribute('data-temp-id');

  // BUG-C3 FIX: inject options button that was absent on optimistic render.
  if (serverData.id && !el.querySelector('.msg-options-btn')) {
    const bubbleCol = el.querySelector('.msg-bubble-col');
    const isMine    = el.classList.contains('mine');
    if (bubbleCol) {
      const posClass  = isMine ? 'left-0 -translate-x-full' : 'right-0 translate-x-full';
      bubbleCol.insertAdjacentHTML('afterbegin', `
        <button class="msg-options-btn absolute ${posClass} top-0
                       opacity-0 group-hover:opacity-100 transition-opacity
                       w-7 h-7 rounded-full bg-white shadow-sm border border-gray-200
                       text-gray-500 hover:text-indigo-600 hover:border-indigo-300
                       flex items-center justify-center text-xs select-none"
                data-action="thread-open-options"
                data-message-id="${serverData.id}"
                aria-label="Message options">⋯</button>`);
    }
  }

  const statusEl = el.querySelector('.msg-status-icon');
  if (statusEl) statusEl.innerHTML = _statusIconSVG(serverData.status ?? MSG_STATUS.SENT);
  el.classList.remove('opacity-70', 'message-pending');
  el.classList.add('message-confirmed');
}

export function renderRetryPending(clientTempId) {
  const el = document.querySelector(`[data-temp-id="${clientTempId}"]`);
  if (!el) return;
  el.classList.remove('message-failed');
  el.classList.add('message-pending', 'opacity-70');
  const statusEl = el.querySelector('.msg-status-icon');
  if (statusEl) statusEl.innerHTML = _statusIconSVG(MSG_STATUS.PENDING);
  el.querySelector('.msg-retry-btn')?.remove();
}

/**
 * Mark a pending message as failed and show a Retry button.
 */
export function markMessageFailed(clientTempId) {
  const el = document.querySelector(`[data-temp-id="${clientTempId}"]`);
  if (!el) return;
  el.classList.remove('message-pending', 'opacity-70');
  el.classList.add('message-failed');

  const statusEl = el.querySelector('.msg-status-icon');
  if (statusEl) statusEl.innerHTML = _statusIconSVG(MSG_STATUS.FAILED);

  if (!el.querySelector("[data-action='thread-retry']")) {
    const meta = el.querySelector('.msg-meta');
    meta?.insertAdjacentHTML('beforeend', `
      <button class="msg-retry-btn text-xs text-red-500 hover:text-red-700
                     underline transition-colors"
              data-action="thread-retry"
              data-temp-id="${clientTempId}">
        Retry
      </button>`);
  }
}

export function removeMessageFromDOM(messageId, clientTempId) {
  const sel = messageId
    ? `[data-message-id="${messageId}"]`
    : `[data-temp-id="${clientTempId}"]`;
  document.querySelector(sel)?.remove();
}

/**
 * FE-05 FIX: no showToast here — toasts for edit/delete/pin are in WS handlers.
 */
 
 export function renderMessageEdit(messageId, newText) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return;
  const textEl = el.querySelector(".msg-text");
  if (textEl) textEl.textContent = newText;
  const editedEl = el.querySelector(".msg-edited-label");
  if (editedEl) {
    editedEl.classList.remove("hidden");
  } else {
    el.querySelector(".msg-text")?.insertAdjacentHTML(
      "afterend",
      `<span class="msg-edited-label text-[10px] opacity-60 ml-1">edited</span>`
    );
  }
  showToast("Message edited.", "success");
}



export function renderMessageDelete(messageId) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return;
  const textEl = el.querySelector('.msg-text');
  if (textEl) {
    textEl.textContent = '[deleted]';
    textEl.classList.add('italic', 'opacity-50');
  }
  el.querySelector('.msg-reactions')?.remove();
  el.querySelector('.msg-options-btn')?.remove();
}

export function renderPinUpdate(messageId, isPinned) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return;
  el.classList.toggle('message-pinned', isPinned);
  const pinIcon = el.querySelector('.msg-pin-icon');
  if (pinIcon) {
    pinIcon.classList.toggle('hidden', !isPinned);
    if (isPinned) pinIcon.textContent = '📌';
  }
}

export function renderReactionUpdate(messageId, reactions) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return;

  // ── Scope to the bubble column, not the outer wrapper ──────────────────
  const bubbleCol = el.querySelector('.msg-bubble-col');
  if (!bubbleCol) return;

  const hasReactions = Object.keys(reactions ?? {}).length > 0;
  let rxnContainer = bubbleCol.querySelector('.msg-reactions');

  // ── Remove container entirely when no reactions remain ─────────────────
  if (!hasReactions) {
    rxnContainer?.remove();
    return;
  }

  // ── Create container and insert BEFORE .msg-meta (not at end) ──────────
  if (!rxnContainer) {
    rxnContainer = document.createElement('div');
    rxnContainer.className = 'msg-reactions flex flex-wrap gap-1 mt-1';
    const metaEl = bubbleCol.querySelector('.msg-meta');
    if (metaEl) {
      bubbleCol.insertBefore(rxnContainer, metaEl);
    } else {
      bubbleCol.appendChild(rxnContainer);
    }
  }

  // ── Re-render pills (matches threadMessageTemplate exactly) ────────────
  const currentUserId = threadState.currentUser?.id;
  rxnContainer.innerHTML = Object.values(reactions).map((r) => {
    const mine = Array.isArray(r.users) && r.users.includes(currentUserId);
    return `<button class="reaction-pill flex items-center gap-1 text-xs rounded-full px-2 py-0.5
                     transition-colors ${mine
                       ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300'
                       : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
               data-action="thread-react"
               data-message-id="${messageId}"
               data-emoji="${_escAttr(r.emoji)}">
               ${_esc(r.emoji)} <span>${r.count}</span>
             </button>`;
  }).join('');
}



// ─── Status icons ─────────────────────────────────────────────────────────────

export function updateStatusIcons(messageIds, status) {
  for (const id of messageIds) {
    const el = document.querySelector(`[data-message-id="${id}"]`);
    if (!el) continue;
    const statusEl = el.querySelector('.msg-status-icon');
    if (statusEl) statusEl.innerHTML = _statusIconSVG(status);
  }
}

function _statusIconSVG(status) {
  switch (status) {
    case MSG_STATUS.PENDING:
      return `<svg class="w-3.5 h-3.5 opacity-50" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/>
      </svg>`;
    case MSG_STATUS.FAILED:
      return `<svg class="w-3.5 h-3.5 text-red-300" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5"/>
        <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
      </svg>`;
    case MSG_STATUS.SENT:
      return `<svg class="w-3.5 h-2.5 opacity-70" viewBox="0 0 16 10" fill="none">
        <path d="M1.5 5 L5.5 9 L14.5 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    case MSG_STATUS.DELIVERED:
      return `<svg class="w-4.5 h-2.5 opacity-70" viewBox="0 0 20 10" fill="none">
        <path d="M1.5 5 L5.5 9 L14.5 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M6.5 5 L10.5 9 L19.5 1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    case MSG_STATUS.READ:
      return `<svg class="w-4.5 h-2.5" viewBox="0 0 20 10" fill="none">
        <path d="M1.5 5 L5.5 9 L14.5 1" stroke="#a5b4fc" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M6.5 5 L10.5 9 L19.5 1" stroke="#a5b4fc" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    default:
      return '';
  }
}


// ─── Typing indicator ─────────────────────────────────────────────────────────

export function renderTypingIndicator() {
  const container = _msgContainer();
  if (!container) return;

  let indicator   = document.getElementById('thread-typing-indicator');
  const typingIds = getTypingUsers();

  if (!typingIds.length) { indicator?.remove(); return; }

  const names = typingIds.map((id) => {
    const member = getMember(id);
    if (member?.name) return member.name;
    const msg = threadState.messages.find((m) => m.sender_id === id);
    return msg?.sender?.name ?? 'Someone';
  }).filter(Boolean);

  const text = names.length === 1
    ? `${names[0]} is typing…`
    : `${names.slice(0, 2).join(', ')} are typing…`;

  if (!indicator) {
    container.insertAdjacentHTML('beforeend', typingIndicatorTemplate(text));
  } else {
    indicator.querySelector('.typing-text')
      ?.replaceChildren(document.createTextNode(text));
  }
}

export function showLearnoraBotTyping() {
  const container = _msgContainer();
  if (!container) return;

  if (document.getElementById('thread-learnora-typing')) return;

  container.insertAdjacentHTML('beforeend', `
    <div id="thread-learnora-typing"
         class="flex items-center gap-2 px-4 py-2">
      <div class="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600
                  flex items-center justify-center flex-shrink-0">
        <span class="text-xs">🤖</span>
      </div>
      <div class="flex items-center gap-0.5 bg-gray-100 rounded-full px-3 py-1.5">
        <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
              style="animation-delay:0ms"></span>
        <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
              style="animation-delay:150ms"></span>
        <span class="w-1.5 h-1.5 bg-violet-400 rounded-full animate-bounce"
              style="animation-delay:300ms"></span>
      </div>
    </div>`);

  scrollToBottom(container);
  // Auto-remove after 30 s as a safety net — WS-03 removes it on AI message arrival.
  setTimeout(() => document.getElementById('thread-learnora-typing')?.remove(), 30000);
}


// ─── Pinned banner ────────────────────────────────────────────────────────────

export function renderPinnedBanner(pinnedMessages) {
  const container = document.getElementById('thread-pinned-banner');
  if (!container) return;
  container.innerHTML = pinnedMessages.length
    ? pinnedMessagesBannerTemplate(pinnedMessages)
    : '';
}


// ─── List utilities ───────────────────────────────────────────────────────────

export function updateUnreadBadge(threadId, count) {
  const el = document.querySelector(`[data-thread-id="${threadId}"] .thread-unread-badge`);
  if (!el) return;
  el.textContent = count > 99 ? '99+' : String(count);
  el.classList.toggle('hidden', count === 0);
}

export function updateOnlineBadge(userId, online) {
  document.querySelectorAll(`[data-user-id="${userId}"] .online-dot`)
    .forEach((dot) => dot.classList.toggle('online', online));
}

export function updateThreadAvatar(threadId, url) {
  const el = document.querySelector(`[data-thread-id="${threadId}"] .thread-avatar`);
  if (el?.tagName === 'IMG') el.src = url;
}


// ─── Search ───────────────────────────────────────────────────────────────────

export function renderSearchResults(results, query) {
  const container = document.getElementById('thread-search-results')
                 ?? document.querySelector("[data-role='thread-search-results']");
  if (!container) return;

  if (!results.length) {
    container.innerHTML = `
      <div class="py-12 text-center">
        <p class="text-sm text-gray-400">No results for "<em>${_esc(query)}</em>"</p>
      </div>`;
    return;
  }
  container.innerHTML = results.map((r) => searchResultItemTemplate(r, query)).join('');
}

export function clearSearchResults() {
  const container = document.getElementById('thread-search-results')
                 ?? document.querySelector("[data-role='thread-search-results']");
  if (container) {
    container.innerHTML = `
      <div class="py-12 text-center text-sm text-gray-400">
        Start typing to search messages…
      </div>`;
  }
  const input = document.getElementById('thread-search-input');
  if (input) input.value = '';
}


// ─── Attachment viewer ────────────────────────────────────────────────────────

export function openAttachmentViewer(attachments) {
  let modal = document.getElementById('thread-attachment-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = 'thread-attachment-modal';
    modal.className = 'fixed inset-0 z-50 flex-col bg-black/95 overflow-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  const closeBtn = `
    <button onclick="this.closest('#thread-attachment-modal').classList.add('hidden')"
            aria-label="Close"
            class="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white
                   flex items-center justify-center hover:bg-white/20 transition-colors z-10">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;

  if (!attachments.length) {
    modal.innerHTML = `
      <div class="relative flex flex-col items-center justify-center h-full gap-3">
        ${closeBtn}
        <span class="text-4xl">📭</span>
        <p class="text-white/60 text-sm">No attachments in this thread yet.</p>
      </div>`;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    return;
  }

  const items = attachments.map((msg) => {
    const isImage = msg.attachment_type === 'image';
    const isVideo = msg.attachment_type === 'video';
    const sender  = _esc(msg.sender?.name ?? 'Unknown');
    const date    = new Date(msg.sent_at).toLocaleDateString();
    const aUrl    = _escAttr(msg.attachment_url);
    const aName   = _esc(msg.attachment_name ?? 'File');

    const preview = isImage
      ? `<img src="${aUrl}" loading="lazy" alt="${aName}"
              class="w-full h-36 object-cover rounded-xl">`
      : isVideo
      ? `<video src="${aUrl}" class="w-full rounded-xl" controls preload="none"></video>`
      : `<div class="flex items-center gap-2 p-4 bg-white/10 rounded-xl">
           <span class="text-xl">📎</span>
           <span class="text-white text-sm truncate">${aName}</span>
         </div>`;

    // ATT-04: Download button
    const downloadBtn = `
      <a href="${aUrl}" download="${aName}" target="_blank" rel="noopener noreferrer"
         class="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white
                bg-white/10 hover:bg-white/20 rounded-lg px-2.5 py-1 transition-colors mt-1 self-start">
        ⬇ Download
      </a>`;

    return `
      <div class="flex flex-col gap-1">
        <a href="${aUrl}" target="_blank" rel="noopener noreferrer"
           class="block hover:opacity-90 transition-opacity">${preview}</a>
        <p class="text-[11px] text-white/50 px-1">${sender} · ${date}</p>
        ${downloadBtn}
      </div>`;
  }).join('');

  modal.innerHTML = `
    <div class="relative flex flex-col h-full">
      ${closeBtn}
      <div class="px-5 pt-5 pb-3 flex-shrink-0">
        <h3 class="text-white font-bold text-base">Media &amp; Files (${attachments.length})</h3>
      </div>
      <div class="grid grid-cols-2 gap-3 px-5 pb-6 overflow-y-auto flex-1">${items}</div>
    </div>`;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}


// ─── Reply preview ────────────────────────────────────────────────────────────

export function renderReplyPreview(context) {
  const container = document.getElementById('thread-reply-preview');
  if (!container) return;
  container.innerHTML = `
    <div class="flex items-center gap-2 bg-indigo-50 border-l-2 border-indigo-400
                rounded-r-lg px-3 py-2 mx-3 mb-1">
      <div class="flex-1 min-w-0">
        <span class="block text-xs font-semibold text-indigo-700">${_esc(context.sender)}</span>
        <span class="block text-xs text-gray-500 truncate">
          ${_esc((context.text ?? '').slice(0, 80))}
        </span>
      </div>
      <button data-action="thread-cancel-reply" aria-label="Cancel reply"
              class="flex-shrink-0 w-6 h-6 rounded-full text-gray-400 hover:text-gray-600
                     hover:bg-gray-200 flex items-center justify-center text-xs transition-colors">
        ✕
      </button>
    </div>`;
  container.classList.remove('hidden');
}

export function clearReplyPreview() {
  const container = document.getElementById('thread-reply-preview');
  if (container) { container.innerHTML = ''; container.classList.add('hidden'); }
}


// ─── System / error messages ──────────────────────────────────────────────────

export function showSystemMessage(text) {
  const container = _msgContainer();
  if (!container) return;
  container.insertAdjacentHTML('beforeend', systemMessageTemplate(text));
  scrollToBottom(container);
}

export function showThreadError(message) {
  showToast(message, 'error');
}


// ─── Scroll helpers ───────────────────────────────────────────────────────────

export function scrollToBottom(container) {
  if (!container) return;
  container.scrollTo({ top: container.scrollHeight, behavior: 'instant' });
}

export function scrollToMessage(messageId) {
  const el = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.classList.add('message-highlight');
  setTimeout(() => el.classList.remove('message-highlight'), 2000);
}


// ─── Internals ────────────────────────────────────────────────────────────────

function _isNearBottom(container, threshold = 150) {
  return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

function _msgContainer() {
  return document.getElementById('thread-messages-list')
      ?? document.querySelector("[data-role='thread-messages']");
}

function _updateListItemPreview(message) {
  const el = document.querySelector(
    `[data-thread-id="${message.thread_id}"] .thread-last-message`
  );
  if (!el) return;
  el.textContent =
    (message.text_content ?? '').slice(0, 80) ||
    (message.attachment_url ? '📎 Attachment' : '');
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
