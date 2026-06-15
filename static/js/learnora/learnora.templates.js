/**
 * ============================================================================
 * LEARNORA TEMPLATES
 * Pure functions: data → HTML string.
 * No side-effects; keep all DOM manipulation in learnora.events.js.
 * ============================================================================
 */

import { escapeHtml, formatRelativeTime, truncate, renderMarkdown, MODE_OPTIONS } from './learnora.utils.js';

// ---------------------------------------------------------------------------
// Sidebar — conversation list
// ---------------------------------------------------------------------------

export function renderConversationItem(conv, isActive = false) {
  const title = escapeHtml(conv.title || 'New Conversation');
  const time  = formatRelativeTime(conv.last_message_at);
  const count = conv.total_messages ?? 0;
  const activeClass = isActive ? 'lr-conv-item--active' : '';

  return `
    <div class="lr-conv-item ${activeClass}"
         data-action="learnora-switch-conversation"
         data-conversation-id="${conv.conversation_id}">
      <div class="lr-conv-item__body">
        <div class="lr-conv-item__title" title="${title}">${title}</div>
        <div class="lr-conv-item__meta">
          <span>${time}</span>
          <span>${count} msg${count !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <button class="lr-conv-item__opts"
              data-action="learnora-conv-options"
              data-conversation-id="${conv.conversation_id}"
              title="Conversation options"
              aria-label="Conversation options"
              aria-haspopup="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
      </button>
    </div>`;
}

export function renderConversationsSkeleton() {
  return Array(4).fill(0).map(() => `
    <div class="lr-conv-skeleton">
      <div class="lr-skel lr-skel--title"></div>
      <div class="lr-skel lr-skel--meta"></div>
    </div>`).join('');
}

export function renderSidebarEmpty() {
  return `
    <div class="lr-sidebar-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <p>No conversations yet</p>
      <span>Click <strong>New Chat</strong> to begin</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// Chat area — messages
// ---------------------------------------------------------------------------

/** Shown before any conversation is selected */
export function renderSelectConversationState() {
  return `
    <div class="lr-empty-state">
      <div class="lr-empty-state__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="url(#lr-grad)" stroke-width="1.5">
          <defs>
            <linearGradient id="lr-grad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#7c3aed"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>
          </defs>
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/>
        </svg>
      </div>
      <h3>Welcome to Learnora</h3>
      <p>Your personal AI study companion. Select a conversation or start a new chat.</p>
    </div>`;
}

/** Shown inside a new, empty conversation */
export function renderNewConversationState() {
  const suggestions = [
    'Explain quantum entanglement simply',
    'Review my Python code for bugs',
    'Summarise the key causes of WW1',
    'Help me study for my calculus exam',
  ];

  return `
    <div class="lr-empty-state lr-empty-state--new">
      <div class="lr-empty-state__icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="url(#lr-grad2)" stroke-width="1.5">
          <defs>
            <linearGradient id="lr-grad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stop-color="#7c3aed"/>
              <stop offset="100%" stop-color="#ec4899"/>
            </linearGradient>
          </defs>
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 8v4l3 3"/>
        </svg>
      </div>
      <h3>New conversation</h3>
      <p>What would you like to learn today?</p>
      <div class="lr-suggestions">
        ${suggestions.map(s => `
          <button class="lr-suggestion"
                  data-action="learnora-use-suggestion"
                  data-suggestion="${escapeHtml(s)}">
            ${escapeHtml(s)}
          </button>`).join('')}
      </div>
    </div>`;
}

/** A user message bubble (right-aligned, styled wrapper as per spec) */
export function renderUserMessage(content, attachments = []) {
  const text = escapeHtml(content);
  const attachHtml = attachments.length
    ? `<div class="lr-msg-attachments">
        ${attachments.map(a => {
          const name = escapeHtml(a.filename ?? a.name ?? 'file');
          const isImage = (a.mime_type ?? '').startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
          if (isImage && a.url) {
            return `<a href="${a.url}" target="_blank" rel="noopener" class="lr-msg-attach-img" title="${name}">
              <img src="${a.url}" alt="${name}" class="lr-msg-attach-thumb" loading="lazy" />
            </a>`;
          }
          return `<span class="lr-attach-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            ${name}
          </span>`;
        }).join('')}
      </div>`
    : '';

  return `
    <div class="lr-msg lr-msg--user">
      <div class="lr-msg__bubble">
        ${attachHtml}
        <span>${text}</span>
      </div>
    </div>`;
}

/**
 * An AI message (left-aligned, minimal wrapper as per spec).
 * During streaming, content is plain text (streamed into .lr-msg__body).
 * After finalisation, the caller replaces .lr-msg__body content with rendered markdown.
 */
export function renderAiMessage(content = '', isStreaming = false) {
  const streamingClass = isStreaming ? 'lr-msg--streaming' : '';
  const cursor = isStreaming ? '<span class="lr-cursor" aria-hidden="true"></span>' : '';

  return `
    <div class="lr-msg lr-msg--ai ${streamingClass}">
      <div class="lr-msg__avatar" aria-label="Learnora AI">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/>
        </svg>
      </div>
      <div class="lr-msg__body">${isStreaming ? cursor : renderMarkdown(content)}</div>
    </div>`;
}

/** Three-dot typing indicator while waiting for the first token */
export function renderTypingIndicator() {
  return `
    <div class="lr-msg lr-msg--ai lr-msg--typing" id="lr-typing-indicator">
      <div class="lr-msg__avatar" aria-label="Learnora AI">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.14z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24A2.5 2.5 0 0 0 14.5 2z"/>
        </svg>
      </div>
      <div class="lr-typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>`;
}

/** Continue-response CTA (shown when last AI message was incomplete) */
export function renderContinueBanner() {
  return `
    <div class="lr-continue-banner" id="lr-continue-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Response was cut short.
      <button data-action="learnora-continue" class="lr-continue-btn">Continue →</button>
    </div>`;
}

/** Quota pill in the footer */
export function renderQuotaDisplay(quota) {
  if (!quota) return '';
  const { daily_used, daily_limit, remaining } = quota;
  const pct = Math.round((daily_used / daily_limit) * 100);
  const urgency = remaining <= 2 ? 'lr-quota--urgent' : remaining <= 5 ? 'lr-quota--low' : '';

  return `
    <div class="lr-quota ${urgency}" title="${daily_used}/${daily_limit} messages used today">
      <div class="lr-quota__bar">
        <div class="lr-quota__fill" style="width:${pct}%"></div>
      </div>
      <span>${remaining} left today</span>
    </div>`;
}

/** File attachment chip in the input preview bar */
export function renderFileChip(file, index) {
  const isImage  = file.type.startsWith('image/');
  const progress = file.progress ?? 0;
  const uploading = progress > 0 && progress < 100;

  if (isImage && file.previewURL) {
    // Square image thumbnail chip
    return `
      <div class="lr-file-chip lr-file-chip--image" data-file-index="${index}" title="${escapeHtml(file.name)}">
        <img src="${file.previewURL}" alt="${escapeHtml(file.name)}" class="lr-file-chip__thumb" />
        ${uploading ? `<div class="lr-file-chip__progress" style="height:${progress}%"></div>` : ''}
        ${uploading ? `<span class="lr-file-chip__pct">${progress}%</span>` : ''}
        <button class="lr-file-chip__remove"
                data-action="learnora-remove-file"
                data-file-index="${index}"
                aria-label="Remove ${escapeHtml(file.name)}">×</button>
      </div>`;
  }

  // Non-image file chip
  const ext = file.name.split('.').pop()?.toUpperCase() ?? 'FILE';
  const shortName = escapeHtml(truncate(file.name, 18));
  return `
    <div class="lr-file-chip lr-file-chip--doc" data-file-index="${index}" title="${escapeHtml(file.name)}">
      <span class="lr-file-chip__ext">${escapeHtml(ext.slice(0, 4))}</span>
      <span class="lr-file-chip__name">${shortName}</span>
      ${uploading
        ? `<div class="lr-file-chip__bar"><div class="lr-file-chip__bar-fill" style="width:${progress}%"></div></div>`
        : ''}
      <button class="lr-file-chip__remove"
              data-action="learnora-remove-file"
              data-file-index="${index}"
              aria-label="Remove ${escapeHtml(file.name)}">×</button>
    </div>`;
}
