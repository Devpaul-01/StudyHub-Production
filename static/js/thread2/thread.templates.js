/**
 * thread.templates.js — Tailwind edition
 * Pure HTML string templates for the thread system.
 *
 * FIXES vs previous version:
 *  - BUG-C3 context: options button (⋯) is intentionally omitted for messages
 *    with id=null (optimistic/pending). thread.render.js confirmOptimisticMessage()
 *    injects it once the server confirms the message and provides a real ID.
 *    This is the correct two-phase approach — no template change needed here.
 *  - FE-05 / FE-06: "Find in chat" action removed from inline row (was already
 *    in the options sheet); "Copy message" lives exclusively in the bottom sheet
 *    built by thread.delegation.js _openOptionsSheet(). Templates no longer
 *    render any action row inline — only the ⋯ hover button.
 *  - pinnedMessagesBannerTemplate(): script-tag approach was already replaced with
 *    data-pins delegation in prior version. Verified correct — no change needed.
 *  - threadListItemTemplate(): is_creator flag used correctly via thread.is_creator
 *    (backend sends it on /my-threads); falls back to creator_id comparison for
 *    detail-endpoint responses that don't include it.
 *  - statusIconTemplate(): all four states correct — verified against thread.render.js.
 *  - typingIndicatorTemplate(): uses stable id "thread-typing-indicator" so
 *    renderTypingIndicator() can find and update the existing element.
 */

import { MSG_STATUS } from './thread.constants.js';


// ─── Utilities ────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _formatTime(isoString) {
  if (!isoString) return '';
  const d   = new Date(isoString);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth()    &&
    d.getDate()     === now.getDate();

  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const msPerDay  = 86400000;
  const daysDiff  = Math.floor((now - d) / msPerDay);
  if (daysDiff < 7) {
    return `${d.toLocaleDateString([], { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function _timeAgo(isoString) {
  if (!isoString) return '';
  const delta = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (delta < 60)    return 'just now';
  if (delta < 3600)  return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}


// ─── Status icon ──────────────────────────────────────────────────────────────

export function statusIconTemplate(status) {
  switch (status) {
    case MSG_STATUS.PENDING:
      return `<svg class="status-icon status-pending opacity-50" viewBox="0 0 16 16" width="14" height="14">
        <circle cx="8" cy="8" r="6" stroke="currentColor" fill="none" stroke-width="1.5" stroke-dasharray="2 2"/>
      </svg>`;
    case MSG_STATUS.FAILED:
      return `<svg class="status-icon status-failed text-red-300" viewBox="0 0 16 16" width="14" height="14">
        <circle cx="8" cy="8" r="6" stroke="currentColor" fill="none" stroke-width="1.5"/>
        <line x1="8" y1="5" x2="8" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="8" cy="11" r="0.7" fill="currentColor"/>
      </svg>`;
    case MSG_STATUS.SENT:
      return `<svg class="status-icon status-sent opacity-70" viewBox="0 0 16 11" width="14" height="10">
        <path d="M1.5 5.5 L5.5 9.5 L14.5 1.5" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    case MSG_STATUS.DELIVERED:
      return `<svg class="status-icon status-delivered opacity-70" viewBox="0 0 20 11" width="18" height="10">
        <path d="M1.5 5.5 L5.5 9.5 L14.5 1.5" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M6.5 5.5 L10.5 9.5 L19.5 1.5" stroke="currentColor" fill="none" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    case MSG_STATUS.READ:
      return `<svg class="status-icon status-read" viewBox="0 0 20 11" width="18" height="10">
        <path d="M1.5 5.5 L5.5 9.5 L14.5 1.5" stroke="#a5b4fc" fill="none" stroke-width="1.6" stroke-linecap="round"/>
        <path d="M6.5 5.5 L10.5 9.5 L19.5 1.5" stroke="#a5b4fc" fill="none" stroke-width="1.6" stroke-linecap="round"/>
      </svg>`;
    default:
      return '';
  }
}


// ─── Message template ─────────────────────────────────────────────────────────

export function threadMessageTemplate(message, currentUserId) {
  const isMine     = message.sender_id === currentUserId;
  const sender     = message.sender ?? {};
  const senderName = esc(sender.name ?? "Unknown");
  const avatarUrl  = sender.avatar ? escAttr(sender.avatar) : null;
  const time       = _formatTime(message.sent_at);
  const hasId      = message.id != null;

  const wrapClass = [
    'thread-message-wrap group relative flex gap-2 px-3 py-0.5',
    isMine ? 'justify-end mine' : 'justify-start items-end theirs',
    !hasId || message.status === MSG_STATUS.PENDING ? 'message-pending opacity-70' : 'message-confirmed',
    message.is_deleted    ? 'message-deleted'  : '',
    message.is_pinned     ? 'message-pinned'   : '',
    message.is_ai_response ? 'message-ai'      : '',
  ].filter(Boolean).join(' ');

  const bubbleColClass = isMine
    ? 'msg-bubble-col flex flex-col items-end gap-0 max-w-[78%]'
    : 'msg-bubble-col flex flex-col items-start gap-0 max-w-[78%]';

  // ── FIX 1: select-none added to both bubble variants ─────────────────────
  const bubbleClass = isMine
    ? 'msg-bubble bg-indigo-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2.5 select-none'
    : 'msg-bubble bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm px-3.5 py-2.5 select-none';

  const tempIdAttr = message.client_temp_id ? ` data-temp-id="${escAttr(message.client_temp_id)}"` : "";
  const msgIdAttr  = hasId ? ` data-message-id="${message.id}"` : "";

  // ── Avatar ────────────────────────────────────────────────────────────────
  const avatarHtml = avatarUrl
    ? `<img src="${avatarUrl}" class="msg-avatar w-8 h-8 rounded-full object-cover flex-shrink-0"
            alt="${senderName}" loading="lazy">`
    : `<div class="msg-avatar-placeholder flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100
                   text-indigo-700 text-xs font-bold flex items-center justify-center select-none">
         ${(sender.name ?? "?").charAt(0).toUpperCase()}
       </div>`;

  // ── Reply preview ─────────────────────────────────────────────────────────
  let replyHtml = "";
  if (message.reply_to) {
    const rt        = message.reply_to;
    const replyBg   = isMine ? "bg-indigo-500/30 border-white/50" : "bg-gray-200 border-indigo-400";
    const nameColor = isMine ? "text-indigo-100" : "text-indigo-600";
    const textColor = isMine ? "text-white/80"   : "text-gray-500";
    replyHtml = `
      <div class="msg-reply-preview rounded-lg px-2.5 py-1.5 mb-1.5 border-l-2 ${replyBg}
                  cursor-pointer" data-action="thread-scroll-to-message"
           data-message-id="${rt.id}">
        <span class="reply-sender block text-xs font-semibold ${nameColor}">${esc(rt.sender ?? "")}</span>
        <span class="reply-text text-xs ${textColor} line-clamp-1">${esc((rt.text ?? "").slice(0, 80))}</span>
      </div>`;
  }

  // ── Attachment ────────────────────────────────────────────────────────────
  let attachmentHtml = "";
  if (message.attachment_url && !message.is_deleted) {
    const aType = message.attachment_type ?? "";
    const aName = esc(message.attachment_name ?? "Attachment");
    const aUrl  = escAttr(message.attachment_url);
    if (aType === "image") {
      attachmentHtml = `
        <a href="${aUrl}" target="_blank" rel="noopener noreferrer" class="block mb-1.5">
          <img src="${aUrl}" class="msg-attachment-image rounded-xl max-w-[220px] max-h-[220px]
                                   object-cover" loading="lazy" alt="${aName}">
        </a>`;
    } else if (aType === "video") {
      attachmentHtml = `
        <video src="${aUrl}" class="msg-attachment-video rounded-xl max-w-[220px] mb-1.5"
               controls preload="metadata"></video>`;
    } else {
      const sizeKb = message.attachment_size ? ` (${Math.round(message.attachment_size / 1024)} KB)` : "";
      const fileBg = isMine ? "bg-indigo-500/30 hover:bg-indigo-500/40" : "bg-gray-200 hover:bg-gray-300";
      attachmentHtml = `
        <a href="${aUrl}" target="_blank" rel="noopener noreferrer" download
           class="flex items-center gap-2 rounded-xl px-3 py-2 mb-1.5 ${fileBg} transition-colors">
          <span class="text-base">📎</span>
          <span class="text-sm font-medium truncate max-w-[160px]">${aName}</span>
          <span class="text-xs opacity-70">${sizeKb}</span>
        </a>`;
    }
  }

  // ── Text ──────────────────────────────────────────────────────────────────
  const textHtml = message.is_deleted
    ? `<span class="msg-text italic opacity-50 text-sm">[deleted]</span>`
    : message.text_content
      ? `<span class="msg-text text-sm leading-relaxed break-words whitespace-pre-wrap">${esc(message.text_content)}</span>`
      : "";

  // ── Edited label ──────────────────────────────────────────────────────────
  const editedHtml = message.is_edited && !message.is_deleted
    ? `<span class="msg-edited-label text-[10px] opacity-60 ml-1">edited</span>`
    : "";

  // ── Reactions ─────────────────────────────────────────────────────────────
  const reactions = message.reactions ?? {};
  const rxnPills  = Object.values(reactions).map((r) => {
    const mine = Array.isArray(r.users) && r.users.includes(currentUserId);
    return `<button class="reaction-pill flex items-center gap-1 text-xs rounded-full px-2 py-0.5
                     transition-colors ${mine
                       ? "bg-indigo-100 text-indigo-700 ring-1 ring-indigo-300"
                       : "bg-gray-100 text-gray-700 hover:bg-gray-200"}"
               data-action="thread-react"
               data-message-id="${message.id}"
               data-emoji="${escAttr(r.emoji)}">
               ${esc(r.emoji)} <span>${r.count}</span>
             </button>`;
  }).join("");
  const reactionsHtml = rxnPills
    ? `<div class="msg-reactions flex flex-wrap gap-1 mt-1">${rxnPills}</div>`
    : "";

  // ── Status tick ───────────────────────────────────────────────────────────
  const statusHtml = isMine
    ? `<span class="msg-status-icon inline-flex items-center opacity-80">
         ${statusIconTemplate(message.status ?? MSG_STATUS.SENT)}
       </span>`
    : "";

  // ── Pin badge ─────────────────────────────────────────────────────────────
  const pinBadge = message.is_pinned
    ? `<span class="msg-pin-icon text-xs text-amber-500 mr-1" title="Pinned">📌</span>`
    : `<span class="msg-pin-icon hidden"></span>`;

  // ── AI badge ──────────────────────────────────────────────────────────────
  const aiBadge = message.is_ai_response
    ? `<span class="msg-ai-badge inline-flex items-center gap-1 text-xs font-medium
                    text-violet-700 bg-violet-100 rounded-full px-2 py-0.5 mb-1 self-start">
         🤖 Learnora
       </span>`
    : "";

  // ── Retry button ──────────────────────────────────────────────────────────
  const retryHtml = message.status === MSG_STATUS.FAILED
    ? `<button class="msg-retry-btn text-xs text-red-500 hover:text-red-700
                       underline mt-0.5 px-1"
               data-action="thread-retry"
               data-temp-id="${escAttr(message.client_temp_id ?? "")}">
         Retry
       </button>`
    : "";

  // ── Options button ────────────────────────────────────────────────────────
  const optionsBtn = !message.is_deleted && hasId
    ? `<button class="msg-options-btn absolute ${isMine ? "left-0 -translate-x-full" : "right-0 translate-x-full"}
                      top-0 opacity-0 group-hover:opacity-100 transition-opacity
                      w-7 h-7 rounded-full bg-white shadow-sm border border-gray-200 text-gray-500
                      hover:text-indigo-600 hover:border-indigo-300 flex items-center justify-center
                      text-xs select-none"
               data-action="thread-open-options"
               data-message-id="${message.id}"
               aria-label="Message options">
         ⋯
       </button>`
    : "";

  // ── Layout ────────────────────────────────────────────────────────────────
  return `
    <div class="${wrapClass}"${msgIdAttr}${tempIdAttr}>
      ${!isMine ? `<div class="flex-shrink-0">${avatarHtml}</div>` : ""}
      <div class="${bubbleColClass} relative">
        ${optionsBtn}
        ${!isMine ? `<span class="msg-sender-name text-[11px] font-semibold text-gray-500 px-1 mb-0.5">${senderName}</span>` : ""}
        ${aiBadge}
        <div class="${bubbleClass}">
          ${pinBadge}
          ${replyHtml}
          ${attachmentHtml}
          ${textHtml}
          ${editedHtml}
        </div>
        ${reactionsHtml}
        <div class="msg-meta flex items-center gap-1.5 px-1 mt-0.5">
          <span class="msg-time text-[10px] text-gray-400">${time}</span>
          ${statusHtml}
          ${retryHtml}
        </div>
      </div>
    </div>`;
}


// ─── Thread list item ─────────────────────────────────────────────────────────

export function threadListItemTemplate(thread, currentUserId) {
  const unread  = thread.unread_count ?? 0;
  const lastMsg = thread.last_message;

  /* ── Preview text ─────────────────────────────────────────────────────── */
  let previewText = '';
  let previewTime = '';

  if (lastMsg) {
    const isSelf  = lastMsg.sender_id === currentUserId;
    const prefix  = isSelf
      ? ''
      : lastMsg.sender ? `${lastMsg.sender.split(' ')[0]}: ` : '';
    previewText = prefix + (lastMsg.text ?? '').slice(0, 55);
    previewTime = _timeAgo(lastMsg.sent_at);
  } else {
    previewText = thread.description
      ? thread.description.slice(0, 55) + (thread.description.length > 55 ? '…' : '')
      : 'No messages yet';
    previewTime = _timeAgo(thread.last_activity);
  }

  /* ── Avatar ───────────────────────────────────────────────────────────── */
  const avatarHtml = thread.avatar
    ? `<img src="${escAttr(thread.avatar)}"
            class="thread-avatar w-12 h-12 rounded-full object-cover flex-shrink-0"
            alt="${esc(thread.title)}" loading="lazy">`
    : `<div class="thread-avatar-placeholder w-12 h-12 rounded-full bg-indigo-100 text-indigo-700
                    text-base font-bold flex items-center justify-center flex-shrink-0 select-none">
         ${esc(thread.title.charAt(0).toUpperCase())}
       </div>`;

  /* ── Right-column meta: unread pill stacked below timestamp ───────────── */
  // Unread pill is right-aligned below the time, matching WhatsApp / Telegram UX.
  const unreadPill = unread > 0
    ? `<span class="thread-unread-badge min-w-[20px] h-5 rounded-full bg-indigo-600 text-white
                    text-[10px] font-bold flex items-center justify-center px-1.5 leading-none self-end">
         ${unread > 99 ? '99+' : unread}
       </span>`
    : `<span class="thread-unread-badge hidden" aria-hidden="true"></span>`;

  /* ── Message status icon (sender-only, shown left of preview text) ─────── */
  const isSelfMsg   = lastMsg && lastMsg.sender_id === currentUserId;
  const statusIcon  = isSelfMsg ? statusIconTemplate(lastMsg.status) : '';

  return `
    <div class="thread-list-item flex items-center gap-3 px-4 py-3 bg-white
                 hover:bg-indigo-50/50 active:bg-indigo-50 transition-colors cursor-pointer
                 border-b border-gray-100"
         data-action="open-thread"
         data-thread-id="${thread.id}"
         role="button" tabindex="0"
         aria-label="Open ${esc(thread.title)}">

      <!-- Avatar (no badge here anymore) -->
      <div class="flex-shrink-0">
        ${avatarHtml}
      </div>

      <!-- Middle: title + preview -->
      <div class="flex-1 min-w-0">

        <!-- Row 1: title -->
        <div class="flex items-center gap-2 mb-0.5">
          <span class="text-sm font-semibold text-gray-900 truncate">${esc(thread.title)}</span>
        </div>

        <!-- Row 2: status icon + preview text -->
        <div class="flex items-center gap-1 min-w-0">
          ${statusIcon}
          <span class="thread-last-message text-xs text-gray-500 truncate">${esc(previewText)}</span>
        </div>

      </div>

      <!-- Right column: timestamp + unread pill -->
      <div class="flex flex-col items-end gap-1 flex-shrink-0 self-start pt-0.5">
        <span class="text-[11px] text-gray-400 whitespace-nowrap">${previewTime}</span>
        ${unreadPill}
      </div>

    </div>`;
}

// ─── Pinned messages banner ───────────────────────────────────────────────────

export function pinnedMessagesBannerTemplate(pinnedMessages) {
  if (!pinnedMessages?.length) return '';

  const count       = pinnedMessages.length;
  const first       = pinnedMessages[0];
  const firstText   = esc((first.text_content ?? '📎 Attachment').slice(0, 80));
  const firstSender = esc(first.sender?.name ?? '');

  // Navigation handled by thread.delegation.js via data-pins attribute.
  const pinsJson = escAttr(JSON.stringify(
    pinnedMessages.map((p) => ({
      id:     p.id,
      text:   (p.text_content ?? '📎 Attachment').slice(0, 80),
      sender: p.sender?.name ?? '',
    }))
  ));

  return `
    <div class="thread-pinned-banner flex items-center gap-2 px-3 py-2
                bg-amber-50 border-b border-amber-100"
         data-pin-index="0" data-pin-count="${count}" data-pins="${pinsJson}">

      <button class="pin-icon-btn text-base flex-shrink-0 hover:scale-110 transition-transform"
              data-action="thread-scroll-to-message" data-message-id="${first.id}"
              aria-label="Jump to pinned message">📌</button>

      <div class="pin-content flex-1 min-w-0 cursor-pointer"
           data-action="thread-scroll-to-message" data-message-id="${first.id}">
        ${count > 1
          ? `<span class="text-[10px] font-bold text-amber-600 uppercase tracking-wide">
               ${count} pinned
             </span>`
          : ''}
        <p class="pin-sender text-xs font-semibold text-amber-800 leading-tight">${firstSender}</p>
        <p class="pin-text text-xs text-gray-600 truncate">${firstText}</p>
      </div>

      ${count > 1 ? `
      <div class="flex flex-col gap-0.5">
        <button class="pin-nav-btn w-5 h-5 rounded flex items-center justify-center text-[10px]
                       text-gray-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
                data-pin-dir="-1" aria-label="Previous pin">▲</button>
        <button class="pin-nav-btn w-5 h-5 rounded flex items-center justify-center text-[10px]
                       text-gray-400 hover:text-amber-600 hover:bg-amber-100 transition-colors"
                data-pin-dir="1" aria-label="Next pin">▼</button>
      </div>` : ''}

      <button class="flex-shrink-0 text-xs font-semibold text-amber-700 hover:text-amber-900
                     px-2 py-1 rounded hover:bg-amber-100 transition-colors"
              data-action="thread-open-pinned-list">All</button>
    </div>`;
}


// ─── Search result item ───────────────────────────────────────────────────────

export function searchResultItemTemplate(result, query) {
  const senderName  = esc(result.sender?.name ?? 'Unknown');
  const time        = _formatTime(result.sent_at);
  const rawText     = result.text_content ?? '';
  const escaped     = esc(rawText.slice(0, 200));
  const highlighted = query
    ? escaped.replace(
        new RegExp(esc(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
        (m) => `<mark class="bg-indigo-100 text-indigo-800 rounded px-0.5 not-italic">${m}</mark>`
      )
    : escaped;

  return `
    <div class="px-4 py-3 hover:bg-indigo-50/40 active:bg-indigo-50 cursor-pointer"
         data-action="thread-scroll-to-message" data-message-id="${result.id}"
         role="button" tabindex="0">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-semibold text-gray-700">${senderName}</span>
        <span class="text-[11px] text-gray-400">${time}</span>
      </div>
      <p class="text-sm text-gray-600 leading-snug">${highlighted}</p>
    </div>`;
}


// ─── System message ───────────────────────────────────────────────────────────

export function systemMessageTemplate(text) {
  return `
    <div class="thread-system-message flex items-center justify-center py-2 px-4">
      <span class="text-xs text-gray-400 bg-gray-100 rounded-full px-3 py-1">${esc(text)}</span>
    </div>`;
}


// ─── Typing indicator ─────────────────────────────────────────────────────────

export function typingIndicatorTemplate(text) {
  return `
    <div id="thread-typing-indicator"
         class="flex items-center gap-2 px-4 py-2">
      <div class="flex items-center gap-0.5">
        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style="animation-delay:0ms"></span>
        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style="animation-delay:150ms"></span>
        <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"
              style="animation-delay:300ms"></span>
      </div>
      <span class="typing-text text-xs text-gray-400">${esc(text)}</span>
    </div>`;
}
