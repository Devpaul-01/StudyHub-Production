/**
 * thread.modals.js — Tailwind edition
 *
 * FIXES vs previous version:
 *  - HIDDEN-04: backdrop-click listener now attached once at element CREATION,
 *    not on every _openModal() call. Previously each open added another listener,
 *    so after 10 opens a single backdrop click fired the close callback 10 times.
 *  - FEAT-02: openInfoModal() now includes Close / Reopen / Delete Thread buttons
 *    in the creator controls section. Delete uses a confirmation modal.
 *  - _closeModal(): uses classList.add('hidden') consistently with all static
 *    HTML modals in threads.html.
 */

import { threadState } from './thread.state.js';


// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * HIDDEN-04 FIX: backdrop listener added only at element creation time.
 * A Set tracks which modal IDs have already had a listener attached.
 */
const _listenersAttached = new Set();

function _openModal(id, html) {
  let modal = document.getElementById(id);
  if (!modal) {
    modal = document.createElement('div');
    modal.id        = id;
    modal.className =
      'hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    document.body.appendChild(modal);
  }

  modal.innerHTML = html;
  modal.classList.remove('hidden');

  // HIDDEN-04 FIX: attach listener exactly once per modal ID.
  if (!_listenersAttached.has(id)) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) _closeModal(id);
    });
    _listenersAttached.add(id);
  }

  return modal;
}

function _closeModal(id) {
  document.getElementById(id)?.classList.add('hidden');
}

function _closeBtn(modalId) {
  return `
    <button class="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center
                   text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            onclick="document.getElementById('${escAttr(modalId)}')?.classList.add('hidden')"
            aria-label="Close">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>`;
}

function _btnPrimary(label, attrs = '') {
  return `<button ${attrs}
            class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95
                   text-sm font-semibold text-white transition-all duration-150 shadow-sm">
            ${label}
          </button>`;
}

function _btnSecondary(label, attrs = '') {
  return `<button ${attrs}
            class="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold
                   text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors">
            ${label}
          </button>`;
}

function _inputClass() {
  return (
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-gray-50 ' +
    'focus:bg-white focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 ' +
    'outline-none text-sm text-gray-900 placeholder-gray-400 transition-all'
  );
}


// ─── Member row ───────────────────────────────────────────────────────────────

function _memberRowHtml(member, isPrivileged, isCreator, threadId) {
  const userId = member.user_id ?? member.id;

  const avatarHtml = member.avatar
    ? `<img src="${escAttr(member.avatar)}"
            class="w-10 h-10 rounded-full object-cover" loading="lazy" alt="${esc(member.name)}">`
    : `<div class="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold
                   flex items-center justify-center select-none">
         ${esc((member.name ?? '?').charAt(0).toUpperCase())}
       </div>`;

  const roleBadge = member.role === 'creator'
    ? `<span class="text-[10px] font-semibold text-indigo-700 bg-indigo-100 rounded-full px-2 py-0.5">Creator</span>`
    : member.role === 'moderator'
    ? `<span class="text-[10px] font-semibold text-violet-700 bg-violet-100 rounded-full px-2 py-0.5">Mod</span>`
    : '';

  const onlineDot = member.online
    ? `<span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white" title="Online"></span>`
    : `<span class="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-white" title="Offline"></span>`;

  let actionBtns = '';
  if (isPrivileged && member.role !== 'creator') {
    const tid = threadId ?? threadState.activeThreadId;
    // Role management is creator-only on the backend (update_member_role checks creator_id).
    if (isCreator) {
      if (member.role === 'moderator') {
        actionBtns += `
        <button class="text-xs text-violet-600 hover:bg-violet-50 rounded-lg px-2 py-1 transition-colors font-medium"
                data-action="thread-demote-member" data-user-id="${userId}" data-thread-id="${tid}">
          Remove Mod
        </button>`;
      } else {
        actionBtns += `
        <button class="text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg px-2 py-1 transition-colors font-medium"
                data-action="thread-promote-member" data-user-id="${userId}" data-thread-id="${tid}">
          Make Mod
        </button>`;
      }
    }
    // Both creator and moderator can remove members.
    actionBtns += `
      <button class="text-xs text-red-500 hover:bg-red-50 rounded-lg px-2 py-1 transition-colors font-medium"
              data-action="thread-remove-member" data-user-id="${userId}" data-thread-id="${tid}">
        Remove
      </button>`;
  }

  return `
    <div class="flex items-center justify-between gap-3 py-2.5 px-1 border-b border-gray-50 last:border-0"
         data-user-id="${userId}">
      <div class="flex items-center gap-3 min-w-0">
        <div class="relative flex-shrink-0">
          ${avatarHtml}
          ${onlineDot}
        </div>
        <div class="min-w-0">
          <span class="block text-sm font-semibold text-gray-900 truncate">
            ${esc(member.name ?? member.username ?? 'User')}
          </span>
          <span class="block text-xs text-gray-400 truncate">@${esc(member.username ?? '')}</span>
        </div>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        ${roleBadge}
        <span class="text-[11px] text-gray-400">${member.messages_sent ?? 0} msgs</span>
        ${actionBtns}
      </div>
    </div>`;
}


// ─── Info modal ───────────────────────────────────────────────────────────────

export function openInfoModal(thread, members, user_status = {}) {
  const currentUserId = threadState.currentUser?.id;

  // Resolve role — user_status.your_role is the authoritative server signal.
  // Fall back to scanning the members list for the current user's role.
  const currentRole =
    user_status.your_role ??
    members.find((m) => (m.user_id ?? m.id) === currentUserId)?.role ??
    'member';

  const isCreator =
    user_status.is_creator ??
    (thread.creator?.id != null && thread.creator.id === currentUserId) ??
    (thread.creator_id === currentUserId);

  // Moderators get all management controls except Delete Thread (creator-only).
  const isModerator  = currentRole === 'moderator';
  const isPrivileged = isCreator || isModerator;

  const threadId = thread.id;

  const avatarHtml = thread.avatar
    ? `<img src="${escAttr(thread.avatar)}"
            class="w-20 h-20 rounded-full object-cover ring-2 ring-indigo-100"
            alt="${esc(thread.title)}">`
    : `<div class="w-20 h-20 rounded-full bg-indigo-100 text-indigo-700 text-2xl font-bold
                   flex items-center justify-center select-none">
         ${esc(thread.title.charAt(0).toUpperCase())}
       </div>`;

  // Avatar upload is creator-only on the backend (upload_thread_avatar checks creator_id).
  const avatarUploadBtn = isCreator
    ? `<button class="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-indigo-600 text-white
                       flex items-center justify-center shadow-sm hover:bg-indigo-700 transition-colors"
               data-action="thread-avatar-upload" title="Change avatar">
         <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
           <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
           <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
         </svg>
       </button>
       <input type="file" id="thread-avatar-file-input" class="hidden" accept="image/*">`
    : '';

  const deptHtml = thread.department
    ? `<span class="inline-flex items-center text-xs font-semibold text-indigo-700
                    bg-indigo-100 rounded-full px-2.5 py-0.5">
         ${esc(thread.department)}
       </span>`
    : '';

  const tagsHtml = (thread.tags ?? []).length
    ? thread.tags.map((t) =>
        `<span class="text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">${esc(t)}</span>`
      ).join('')
    : '';

  // isPrivileged → can remove members; isCreator → additionally can promote/demote roles.
  const membersHtml = members.length
    ? members.map((m) => _memberRowHtml(m, isPrivileged, isCreator, threadId)).join('')
    : `<p class="text-sm text-gray-400 py-4 text-center">No members found.</p>`;

  // Controls are split by what the backend actually permits per role:
  //   Creator      → all settings (approval toggle, close/reopen, delete) + media/pins
  //   Moderator    → media/pins/leave only (close, reopen, settings are creator-only on the backend)
  //   Member       → pinned messages, media, leave
  const privilegedControls = isCreator
    ? `<div class="pt-3 border-t border-gray-100 space-y-3">
         <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Settings</h4>
         <label class="flex items-center justify-between mb-2 cursor-pointer">
           <span class="text-sm text-gray-700">Requires Approval</span>
           <input type="checkbox"
                  id="thread-info-requires-approval"
                  data-action="thread-toggle-approval"
                  data-thread-id="${threadId}"
                  ${thread.requires_approval ? 'checked' : ''}
                  class="w-4 h-4 rounded accent-indigo-600 cursor-pointer">
         </label>
         <div class="flex flex-wrap gap-2">
           <button data-action="thread-open-attachments"
                   class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                          bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
             📎 Media &amp; Files
           </button>
           <button data-action="thread-open-pinned-list"
                   class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                          bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
             📌 All Pins
           </button>
         </div>
         <div class="flex flex-wrap gap-2 pt-1">
           <button data-action="thread-close-thread"
                   data-thread-id="${threadId}"
                   class="flex items-center gap-1.5 text-sm font-medium
                          ${thread.is_open
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                            : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'}
                          rounded-xl px-3 py-2 transition-colors">
             ${thread.is_open ? '🔒 Close Thread' : '🔓 Reopen Thread'}
           </button>
           <button data-action="thread-delete-thread"
                   data-thread-id="${threadId}"
                   class="flex items-center gap-1.5 text-sm font-medium text-red-600
                          bg-red-50 hover:bg-red-100 rounded-xl px-3 py-2 transition-colors">
             🗑 Delete Thread
           </button>
         </div>
       </div>`
    : isModerator
    ? `<div class="pt-3 border-t border-gray-100 space-y-3">
         <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
           Moderator <span class="normal-case font-normal text-violet-500"></span>
         </h4>
         <div class="flex flex-wrap gap-2">
           <button data-action="thread-open-attachments"
                   class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                          bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
             📎 Media &amp; Files
           </button>
           <button data-action="thread-open-pinned-list"
                   class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                          bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
             📌 All Pins
           </button>
         </div>
         <div class="flex flex-wrap gap-2 pt-1">
           <button data-action="thread-leave"
                   data-thread-id="${threadId}"
                   class="flex items-center gap-1.5 text-sm font-medium text-red-600
                          bg-red-50 hover:bg-red-100 rounded-xl px-3 py-2 transition-colors">
             Leave Thread
           </button>
         </div>
       </div>`
    : `<div class="pt-3 border-t border-gray-100 flex flex-wrap gap-2">
         <button data-action="thread-open-pinned-list"
                 class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                        bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
           📌 Pinned Messages
         </button>
         <button data-action="thread-open-attachments"
                 class="flex items-center gap-1.5 text-sm font-medium text-gray-600
                        bg-gray-100 hover:bg-gray-200 rounded-xl px-3 py-2 transition-colors">
           📎 Media &amp; Files
         </button>
         <button data-action="thread-leave"
                 data-thread-id="${threadId}"
                 class="flex items-center gap-1.5 text-sm font-medium text-red-600
                        bg-red-50 hover:bg-red-100 rounded-xl px-3 py-2 transition-colors">
           Leave Thread
         </button>
       </div>`;
  const html = `
    <div class="relative bg-white rounded-2xl w-full max-w-md shadow-2xl
                max-h-[85vh] flex flex-col overflow-hidden">
      ${_closeBtn('thread-info-modal')}

      <div class="flex flex-col items-center gap-2 px-5 pt-7 pb-5 text-center border-b border-gray-100 flex-shrink-0">
        <div class="relative">
          ${avatarHtml}
          ${avatarUploadBtn}
        </div>
        <h2 class="text-lg font-bold text-gray-900 mt-1">${esc(thread.title)}</h2>
        ${deptHtml}
        ${tagsHtml ? `<div class="flex flex-wrap justify-center gap-1.5">${tagsHtml}</div>` : ''}
        ${thread.description
          ? `<p class="text-sm text-gray-500 leading-relaxed max-w-xs">${esc(thread.description)}</p>`
          : ''}
        <p class="text-xs text-gray-400">
          Created ${_formatDate(thread.created_at)}
          · ${thread.member_count} / ${thread.max_members} members
          ${thread.is_open ? '' : `· <span class="text-red-500">Closed</span>`}
        </p>
      </div>

      <div class="flex-1 overflow-y-auto px-5 py-4">
        <h4 class="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
          Members (${members.length})
        </h4>
        <div>${membersHtml}</div>
      </div>

      <div class="flex-shrink-0 px-5 pb-6 pt-3">${privilegedControls}</div>
    </div>`;

  _openModal('thread-info-modal', html);
}


// ─── Pinned messages panel ────────────────────────────────────────────────────

export function openPinnedMessagesPanel(pinnedMessages) {
  const count = pinnedMessages?.length ?? 0;

  const itemsHtml = !count
    ? `<div class="flex flex-col items-center gap-2 py-12">
         <span class="text-3xl">📌</span>
         <p class="text-sm text-gray-400">No pinned messages yet.</p>
       </div>`
    : pinnedMessages.map((msg) => {
        const senderName = esc(msg.sender?.name ?? 'Unknown');
        const text       = esc((msg.text_content ?? '📎 Attachment').slice(0, 120));
        const time       = msg.sent_at
          ? new Date(msg.sent_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
          : '';
        const pinnedBy   = msg.pinned_by?.name
          ? `<span class="text-[10px] text-indigo-500 block mt-0.5">
               Pinned by ${esc(msg.pinned_by.name)}
             </span>`
          : '';
        return `
          <div class="px-5 py-3.5 hover:bg-indigo-50/40 cursor-pointer border-b border-gray-50 last:border-0"
               data-action="thread-scroll-to-message" data-message-id="${msg.id}"
               role="button" tabindex="0">
            <div class="flex items-center justify-between mb-1">
              <span class="text-xs font-semibold text-gray-700">${senderName}</span>
              <span class="text-[11px] text-gray-400">${time}</span>
            </div>
            <p class="text-sm text-gray-600 leading-snug">${text}</p>
            ${pinnedBy}
          </div>`;
      }).join('');

  const html = `
    <div class="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl
                max-h-[80vh] flex flex-col overflow-hidden">
      ${_closeBtn('thread-pinned-panel')}

      <div class="px-5 pt-5 pb-4 border-b border-gray-100 flex-shrink-0">
        <h3 class="text-base font-bold text-gray-900">
          📌 Pinned Messages
          <span class="ml-1 text-sm font-normal text-gray-400">(${count})</span>
        </h3>
      </div>

      <div class="flex-1 overflow-y-auto">${itemsHtml}</div>
    </div>`;

  _openModal('thread-pinned-panel', html);
}


// ─── Join request modal ───────────────────────────────────────────────────────

export function openJoinRequestModal(thread, onConfirm) {
  const html = `
    <div class="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl">
      ${_closeBtn('thread-join-modal')}

      <div class="px-5 pt-6 pb-4 border-b border-gray-100">
        <h3 class="text-base font-bold text-gray-900 mb-1">
          Join "${esc(thread.title)}"
        </h3>
        <p class="text-xs text-gray-400">
          ${thread.member_count} / ${thread.max_members} members
          ${thread.requires_approval ? '· Requires approval' : '· Open join'}
        </p>
        ${thread.description
          ? `<p class="text-sm text-gray-600 mt-2 leading-relaxed">
               ${esc(thread.description.slice(0, 160))}
             </p>`
          : ''}
      </div>

      <div class="px-5 py-4 space-y-3">
        ${thread.requires_approval ? `
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">
              Introduction <span class="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea id="join-request-message"
                      class="${_inputClass()} resize-none"
                      placeholder="Tell the creator why you want to join…"
                      maxlength="300" rows="3"></textarea>
          </div>` : ''}

        <div class="flex gap-3 pt-1">
          ${_btnSecondary('Cancel',
            `onclick="document.getElementById('thread-join-modal')?.classList.add('hidden')"`)}
          ${_btnPrimary(
            thread.requires_approval ? 'Send Request' : 'Join Now',
            `id="join-modal-confirm-btn"`)}
        </div>
      </div>
    </div>`;

  const modal = _openModal('thread-join-modal', html);

  modal.querySelector('#join-modal-confirm-btn')?.addEventListener('click', () => {
    const message = modal.querySelector('#join-request-message')?.value?.trim() ?? '';
    _closeModal('thread-join-modal');
    onConfirm(message);
  });
}


// ─── Invite modal ─────────────────────────────────────────────────────────────

export function openInviteModal(invite, onAccept, onDecline) {
  const thread  = invite.thread ?? {};
  const inviter = invite.invited_by;

  const html = `
    <div class="relative bg-white rounded-2xl w-full max-w-sm shadow-2xl">
      ${_closeBtn('thread-invite-modal')}

      <div class="px-5 pt-6 pb-4 border-b border-gray-100">
        <h3 class="text-base font-bold text-gray-900 mb-1">Thread Invitation</h3>
        <p class="text-sm text-gray-500">
          ${inviter
            ? `<strong class="text-gray-800">${esc(inviter.name)}</strong> invited you to:`
            : "You've been invited to:"}
        </p>
      </div>

      <div class="px-5 py-4 space-y-3">
        <div class="bg-indigo-50 rounded-xl p-3.5">
          <p class="font-bold text-gray-900 text-sm">${esc(thread.title ?? '')}</p>
          ${thread.description
            ? `<p class="text-xs text-gray-500 mt-1 leading-snug">
                 ${esc(thread.description.slice(0, 120))}
               </p>`
            : ''}
          <p class="text-xs text-gray-400 mt-1.5">
            ${thread.member_count ?? 0} / ${thread.max_members ?? '?'} members
            ${thread.department ? `· ${esc(thread.department)}` : ''}
          </p>
        </div>

        ${invite.message && !invite.message.startsWith('[')
          ? `<p class="text-sm text-gray-600 italic border-l-2 border-indigo-300 pl-3 py-1">
               "${esc(invite.message)}"
             </p>`
          : ''}

        <div class="flex gap-3 pt-1">
          ${_btnSecondary('Decline', `id="invite-decline-btn"`)}
          ${_btnPrimary('Accept Invite', `id="invite-accept-btn"`)}
        </div>
      </div>
    </div>`;

  const modal = _openModal('thread-invite-modal', html);
  modal.querySelector('#invite-accept-btn')?.addEventListener('click', () => {
    _closeModal('thread-invite-modal'); onAccept();
  });
  modal.querySelector('#invite-decline-btn')?.addEventListener('click', () => {
    _closeModal('thread-invite-modal'); onDecline();
  });
}
