/**
 * ============================================================================
 * LEARNORA EVENTS  —  Core business logic
 *
 * All functions that mutate state or the DOM live here.
 * Templates are imported from learnora.templates.js (pure HTML strings).
 * ============================================================================
 */

import { learnoraAPI }   from './learnora.api.js';
import { learnoraState } from './learnora.state.js';
import {
  scrollToBottom,
  isScrolledToBottom,
  renderMarkdown,
  MODE_LABELS,
  applyHighlighting,
} from './learnora.utils.js';
import {
  renderConversationItem,
  renderConversationsSkeleton,
  renderSidebarEmpty,
  renderSelectConversationState,
  renderNewConversationState,
  renderUserMessage,
  renderAiMessage,
  renderTypingIndicator,
  renderContinueBanner,
  renderQuotaDisplay,
  renderFileChip,
} from './learnora.templates.js';

// ---------------------------------------------------------------------------
// DOM refs (resolved once during init)
// ---------------------------------------------------------------------------

let $sidebar, $convList, $messages, $inputText, $sendBtn,
    $filePreviews, $fileInput, $modeSelect, $quotaDisplay,
    $chatTitle, $overlay;

function resolveRefs() {
  $sidebar      = document.getElementById('lr-sidebar');
  $convList     = document.getElementById('lr-conv-list');
  $messages     = document.getElementById('lr-messages');
  $inputText    = document.getElementById('lr-input-text');
  $sendBtn      = document.getElementById('lr-send-btn');
  $filePreviews = document.getElementById('lr-file-previews');
  $fileInput    = document.getElementById('lr-file-input');
  $modeSelect   = document.getElementById('lr-mode-select');
  $quotaDisplay = document.getElementById('lr-quota-display');
  $chatTitle    = document.getElementById('lr-chat-title');
  $overlay      = document.getElementById('lr-overlay');
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
// Add this to close menu when scrolling
export function closeConvMenuOnScroll() {
  const $messages = document.getElementById('lr-messages');
  if ($messages) {
    $messages.addEventListener('scroll', () => {
      closeConvMenu();
    });
  }
}

// Call this in initLearnora()

export async function initLearnora() {
  resolveRefs();
  setupInputAutoResize();
  setupKeyboardSend();
  setupFileInput();
  closeConvMenuOnScroll();
  setupConvMenuDelegation();
  setupSidebarOutsideClick();
  setupSidebarSwipeGesture();
  setupScrollFab();

  // Sync mode select initial value from state
  if ($modeSelect) $modeSelect.value = learnoraState.get('mode');

  // Restore sidebar preference
  const sidebarPref = localStorage.getItem('lr_sidebar_open');
  if (sidebarPref === 'false') {
    learnoraState.set({ isSidebarOpen: false });
    applySidebarState(false);
  }

  // Load in parallel
  await Promise.all([
    loadConversations(),
    loadStats(),
  ]);

  // Open conversation from URL param (?conversation_id=N) if present,
  // otherwise fall back to the most recent conversation in the sidebar.
  const urlConvId = new URLSearchParams(window.location.search).get('conversation_id');
  const convs     = learnoraState.get('conversations');

  if (urlConvId) {
    // Remove the param from the URL without triggering a reload
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('conversation_id');
    window.history.replaceState(null, '', cleanUrl.toString());

    await switchConversation(Number(urlConvId));
  } else if (convs.length > 0) {
    await switchConversation(convs[0].conversation_id);
  } else {
    setMessagesHtml(renderSelectConversationState());
  }
}

// ---------------------------------------------------------------------------
// Conversations — sidebar
// ---------------------------------------------------------------------------

export async function loadConversations() {
  if (!$convList) return;

  learnoraState.set({ isLoadingConversations: true });
  $convList.innerHTML = renderConversationsSkeleton();

  try {
    const res = await learnoraAPI.getConversations();

    if (res.status !== 'success') throw new Error(res.message ?? 'Failed to load conversations');

    const conversations = res.data ?? [];
    learnoraState.set({ conversations, isLoadingConversations: false });
    renderConversationList();
  } catch (err) {
    console.error('[Learnora] loadConversations:', err);
    $convList.innerHTML = `<div class="lr-sidebar-error">Failed to load. <button data-action="learnora-refresh-conversations" class="lr-link">Retry</button></div>`;
    learnoraState.set({ isLoadingConversations: false });
  }
}

function renderConversationList() {
  const convs   = learnoraState.get('conversations');
  const activeId = learnoraState.get('activeConversationId');

  if (!$convList) return;

  if (convs.length === 0) {
    $convList.innerHTML = renderSidebarEmpty();
    return;
  }

  $convList.innerHTML = convs
    .map(c => renderConversationItem(c, c.conversation_id === activeId))
    .join('');
}

// ---------------------------------------------------------------------------
// Create new conversation
// ---------------------------------------------------------------------------

export async function createNewConversation() {
  try {
    const res = await learnoraAPI.createConversation();
    if (res.status !== 'success') throw new Error(res.message);

    const newConv = {
      conversation_id: res.data.conversation_id,
      title:           res.data.title ?? 'New Conversation',
      total_messages:  0,
      last_message_at: res.data.created_at,
    };

    const convs = [newConv, ...learnoraState.get('conversations')];
    learnoraState.set({ conversations: convs });
    renderConversationList();

    await switchConversation(newConv.conversation_id);
  } catch (err) {
    console.error('[Learnora] createNewConversation:', err);
    if (typeof showToast === 'function') showToast('Could not create conversation', 'error');
  }
}

// ---------------------------------------------------------------------------
// Switch conversation
// ---------------------------------------------------------------------------

export async function switchConversation(id) {
  if (learnoraState.get('isStreaming')) return; // don't switch mid-stream

  learnoraState.set({
    activeConversationId: id,
    messages: [],
    isLoadingMessages: true,
    hasMoreMessages: false,
    currentPage: 1,
  });

  renderConversationList(); // update active highlight
  setMessagesHtml('<div class="lr-messages-loading"><div class="lr-spinner"></div></div>');
  updateChatTitle('Loading…');

  // Close sidebar on mobile after selecting
  if (window.innerWidth < 768) {
    setSidebarOpen(false);
  }

  try {
    const res = await learnoraAPI.getConversation(id, 1, 50);
    if (res.status !== 'success') throw new Error(res.message);

    const data = res.data;
    learnoraState.set({
      messages: data.messages ?? [],
      currentTitle: data.title ?? 'Conversation',
      hasMoreMessages: data.pagination?.has_more ?? false,
      isLoadingMessages: false,
    });

    updateChatTitle(data.title ?? 'Conversation');
    renderMessages();
    scrollToBottom($messages, false);

    // Show continue banner if last response was incomplete
    if (data.is_last_message_complete === false) {
      appendContinueBanner();
    }
  } catch (err) {
    console.error('[Learnora] switchConversation:', err);
    setMessagesHtml(`<div class="lr-error-state">Failed to load conversation.<br><button data-action="learnora-switch-conversation" data-conversation-id="${id}" class="lr-link">Retry</button></div>`);
    learnoraState.set({ isLoadingMessages: false });
  }
}

function renderMessages() {
  const msgs = learnoraState.get('messages');
  if (!$messages) return;

  if (msgs.length === 0) {
    setMessagesHtml(renderNewConversationState());
    return;
  }

  const html = msgs.map(msg => {
    if (msg.role === 'user') {
      return renderUserMessage(msg.content, msg.attachments ?? []);
    }
    return renderAiMessage(msg.content, false);
  }).join('');

  $messages.innerHTML = html;
  applyHighlighting($messages);
}

// ---------------------------------------------------------------------------
// Delete conversation
// ---------------------------------------------------------------------------

export async function deleteConversation(id) {
  try {
    const res = await learnoraAPI.deleteConversation(id);
    if (res.status !== 'success') throw new Error(res.message);

    const convs = learnoraState.get('conversations').filter(c => c.conversation_id !== id);
    learnoraState.set({ conversations: convs });
    renderConversationList();

    // If we deleted the active conversation, switch to next or clear
    if (learnoraState.get('activeConversationId') === id) {
      if (convs.length > 0) {
        await switchConversation(convs[0].conversation_id);
      } else {
        learnoraState.set({ activeConversationId: null, messages: [], currentTitle: 'Learnora AI' });
        updateChatTitle('Learnora AI');
        setMessagesHtml(renderSelectConversationState());
      }
    }

    if (typeof showToast === 'function') showToast('Conversation deleted', 'success');
  } catch (err) {
    console.error('[Learnora] deleteConversation:', err);
    if (typeof showToast === 'function') showToast('Could not delete conversation', 'error');
  }
}

// ---------------------------------------------------------------------------
// Send message + streaming
// ---------------------------------------------------------------------------

export async function sendMessage({ isContinue = false } = {}) {
  const conversationId = learnoraState.get('activeConversationId');

  if (!conversationId) return;

  // If streaming, queue the message instead of silently dropping it
  if (learnoraState.get('isStreaming') && !isContinue) {
    const text = $inputText?.value.trim() ?? '';
    if (!text) return;
    const pendingFiles = learnoraState.get('pendingFiles');
    const queue = [...learnoraState.get('pendingQueue'), { text, files: pendingFiles }];
    learnoraState.set({ pendingQueue: queue });
    if ($inputText) { $inputText.value = ''; $inputText.style.height = 'auto'; }
    clearPendingFiles();
    showQueuedIndicator(queue.length);
    return;
  }

  const text = $inputText?.value.trim() ?? '';
  if (!text && !isContinue) return;

  // Remove continue banner if visible
  document.getElementById('lr-continue-banner')?.remove();

  // Clear empty state if present
  const emptyState = $messages?.querySelector('.lr-empty-state, .lr-empty-state--new');
  if (emptyState) $messages.innerHTML = '';

  // Build FormData
  const formData = new FormData();
  formData.append('conversation_id', conversationId);
  formData.append('message', isContinue ? 'continue' : text);
  formData.append('mode', learnoraState.get('mode'));
  formData.append('is_continue', isContinue ? 'true' : 'false');

  // Attach files
  const pendingFiles = learnoraState.get('pendingFiles');
  pendingFiles.forEach((pf, i) => formData.append(`file_${i}`, pf.file, pf.name));

  // ── Optimistic UI ────────────────────────────────────────────────────────
  if (!isContinue) {
    const userMsgHtml = renderUserMessage(text, pendingFiles.map(f => ({ filename: f.name })));
    $messages.insertAdjacentHTML('beforeend', userMsgHtml);
  }

  // Clear input + files
  if ($inputText) { $inputText.value = ''; $inputText.style.height = 'auto'; }
  clearPendingFiles();

  // Show typing indicator
  $messages.insertAdjacentHTML('beforeend', renderTypingIndicator());
  scrollToBottom($messages);

  // ── Start stream ─────────────────────────────────────────────────────────
  learnoraState.set({ isStreaming: true });
  setInputEnabled(false);
  $sendBtn?.classList.add('lr-send-btn--streaming');
  $sendBtn?.setAttribute('title', 'Message queued — AI is responding');

  try {
    const response = await learnoraAPI.streamChat(formData);
    await processStream(response);
  } catch (err) {
    console.error('[Learnora] sendMessage error:', err);
    document.getElementById('lr-typing-indicator')?.remove();

    const is429 = err.message?.includes('429') || err.message?.toLowerCase().includes('limit');
    const errText = is429
      ? 'Daily message limit reached. Subscribe for more usage.'
      : 'Something went wrong on our end. Please try again in a moment.';

    $messages.insertAdjacentHTML('beforeend', renderAiMessage(errText, false));
    scrollToBottom($messages);
  } finally {
    learnoraState.set({ isStreaming: false });
    $sendBtn?.classList.remove('lr-send-btn--streaming');
    $sendBtn?.setAttribute('title', 'Send message');
    setInputEnabled(true);
    clearQueuedIndicator();
    $inputText?.focus();

    // Update sidebar without a full network refetch
    updateConvInSidebar(conversationId);

    // Drain queued messages one at a time
    const queue = learnoraState.get('pendingQueue');
    if (queue.length > 0) {
      const next = queue[0];
      learnoraState.set({ pendingQueue: queue.slice(1) });
      if ($inputText) $inputText.value = next.text;
      if (next.files.length > 0) {
        learnoraState.set({ pendingFiles: next.files });
        renderFilePreviews();
      }
      setTimeout(() => sendMessage(), 50);
    }
  }
}

// ---------------------------------------------------------------------------
// Stream processor — SSE over fetch ReadableStream
// ---------------------------------------------------------------------------

async function processStream(response) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer    = '';

  // Remove typing indicator; insert streaming AI message
  document.getElementById('lr-typing-indicator')?.remove();

  const streamHtml = renderAiMessage('', true);
  $messages.insertAdjacentHTML('beforeend', streamHtml);
  const $msgEl = $messages.lastElementChild;
  const $body  = $msgEl.querySelector('.lr-msg__body');

  // ── Smooth render state ───────────────────────────────────────────────────
  // rawContent  = full text received from server so far
  // displayedLen = how many characters have actually been painted to the DOM
  // We advance displayedLen → rawContent.length at a steady rate via rAF so
  // the text appears to "type out" smoothly rather than jumping in big bursts.
  let rawContent   = '';
  let displayedLen = 0;
  let animFrameId  = null;

  // Characters revealed per animation frame (~60 fps → ~720 chars/s).
  // Raise this if you want faster reveal; lower for a more dramatic effect.
  const CHARS_PER_FRAME = 12;

  /** One tick of the render loop — advances displayedLen and updates the DOM. */
  function renderLoop() {
    animFrameId = null;
    if (displayedLen >= rawContent.length) return;

    displayedLen = Math.min(displayedLen + CHARS_PER_FRAME, rawContent.length);

    // Use textContent (safe, no markdown flicker) during streaming
    $body.textContent = rawContent.slice(0, displayedLen);

    // Blinking cursor appended after text node
    const $cursor = document.createElement('span');
    $cursor.className = 'lr-cursor';
    $body.appendChild($cursor);

    if (!userScrolledUp) scrollToBottom($messages, false);

    if (displayedLen < rawContent.length) {
      animFrameId = requestAnimationFrame(renderLoop);
    }
  }

  /**
   * Cancel any running rAF loop and immediately sync displayedLen to the full
   * rawContent length.  Call this before finalising the message so markdown
   * render always gets the complete text.
   */
  function flushRender() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
    displayedLen = rawContent.length;
  }

  // ── Scroll suppression ────────────────────────────────────────────────────
  let userScrolledUp = false;
  const onUserScroll = () => {
    userScrolledUp = !isScrolledToBottom($messages, 120);
    const $fab = document.getElementById('lr-scroll-to-bottom');
    if ($fab) $fab.style.display = userScrolledUp ? 'flex' : 'none';
  };
  $messages.addEventListener('scroll', onUserScroll, { passive: true });

  // ── SSE read loop ─────────────────────────────────────────────────────────
  // streamAborted lets an inner-loop break also exit the outer while(true).
  let streamAborted = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? ''; // retain incomplete line for next iteration

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        let data;
        try { data = JSON.parse(payload); } catch (_) { continue; }

        // ── Content chunk ──────────────────────────────────────────────
        if (data.content) {
          rawContent += data.content;
          // Kick off the render loop if it isn't already running
          if (animFrameId === null) {
            animFrameId = requestAnimationFrame(renderLoop);
          }
          continue;
        }

        // ── Provider switch info ───────────────────────────────────────
        if (data.type === 'provider_switch') {
          console.info('[Learnora] Switched to provider:', data.new_provider);
          continue;
        }

        // ── Stream complete ────────────────────────────────────────────
        if (data.type === 'done' || data.complete !== undefined) {
          flushRender();
          finaliseAiMessage($msgEl, $body, rawContent, data);
          if (!userScrolledUp) scrollToBottom($messages);
          continue;
        }

        // ── Incomplete response (token limit hit) ──────────────────────
        if (data.incomplete) {
          flushRender();
          finaliseAiMessage($msgEl, $body, rawContent, data);
          appendContinueBanner();
          continue;
        }

        // ── Error from server ──────────────────────────────────────────
        // IMPORTANT: set streamAborted so the outer while loop also exits —
        // without this, isStreaming stays true and the UI is stuck.
        if (data.error && !data.content) {
          flushRender();
          $body.innerHTML = '<span class="lr-stream-error">Something went wrong generating a response. Please try again.</span>';
          $msgEl.classList.remove('lr-msg--streaming');
          scrollToBottom($messages);
          streamAborted = true;
          break; // exits the for-of loop
        }
      }

      if (streamAborted) break; // exits the while(true) loop
    }
  } catch (err) {
    console.error('[Learnora] processStream read error:', err);
    flushRender();
    if ($body) {
      finaliseAiMessage($msgEl, $body, rawContent || 'Something went wrong. Please try again.', { complete: false });
    }
  } finally {
    // Always cancel any lingering rAF so we don't write to a detached node
    flushRender();
    $messages.removeEventListener('scroll', onUserScroll);
  }
}

/** Convert streaming message to finalised markdown */
function finaliseAiMessage($msgEl, $body, rawContent, data) {
  $msgEl.classList.remove('lr-msg--streaming');
  if (rawContent) {
    $body.innerHTML = renderMarkdown(rawContent);
    applyHighlighting($body);
  } else {
    $body.innerHTML = '<span style="color:#9ca3af;font-size:13px">No response was received. Please try again.</span>';
  }
  scrollToBottom($messages);

  if (data.can_continue) appendContinueBanner();
}

// ---------------------------------------------------------------------------
// Continue incomplete response
// ---------------------------------------------------------------------------

export function continueResponse() {
  document.getElementById('lr-continue-banner')?.remove();
  sendMessage({ isContinue: true });
}

// ---------------------------------------------------------------------------
// Quota / stats
// ---------------------------------------------------------------------------

export async function loadStats() {
  try {
    const res = await learnoraAPI.getStats();
    if (res.status !== 'success') return;

    const quota = res.data.user_quota;
    learnoraState.set({ quota });
    renderQuota();
  } catch (err) {
    console.warn('[Learnora] loadStats:', err);
  }
}

function renderQuota() {
  if (!$quotaDisplay) return;
  $quotaDisplay.innerHTML = renderQuotaDisplay(learnoraState.get('quota'));
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------

export function handleModeChange(mode) {
  learnoraState.set({ mode });
  if ($modeSelect) $modeSelect.value = mode;
}

// ---------------------------------------------------------------------------
// File attachments
// ---------------------------------------------------------------------------

export function addPendingFiles(fileList) {
  const current = learnoraState.get('pendingFiles');
  const next = [...current];

  Array.from(fileList).forEach(file => {
    if (next.length >= 5) {
      if (typeof showToast === 'function') showToast('Max 5 files per message', 'info');
      return;
    }
    // Generate a local preview URL for images (revoked when file is removed/sent)
    const previewURL = file.type.startsWith('image/')
      ? URL.createObjectURL(file)
      : null;

    next.push({ file, name: file.name, type: file.type, previewURL, progress: 0 });
  });

  learnoraState.set({ pendingFiles: next });
  renderFilePreviews();
}

export function removePendingFile(index) {
  const files = learnoraState.get('pendingFiles');
  const removed = files[index];
  if (removed?.previewURL) URL.revokeObjectURL(removed.previewURL);
  learnoraState.set({ pendingFiles: files.filter((_, i) => i !== index) });
  renderFilePreviews();
}

function clearPendingFiles() {
  const files = learnoraState.get('pendingFiles');
  files.forEach(f => { if (f.previewURL) URL.revokeObjectURL(f.previewURL); });
  learnoraState.set({ pendingFiles: [] });
  if ($fileInput) $fileInput.value = '';
  renderFilePreviews();
}

function renderFilePreviews() {
  if (!$filePreviews) return;
  const files = learnoraState.get('pendingFiles');

  if (files.length === 0) {
    $filePreviews.innerHTML = '';
    $filePreviews.classList.add('hidden');
    return;
  }

  $filePreviews.classList.remove('hidden');
  $filePreviews.innerHTML = files.map((f, i) => renderFileChip(f, i)).join('');
}

// ---------------------------------------------------------------------------
// Sidebar toggle
// ---------------------------------------------------------------------------

export function toggleSidebar() {
  const next = !learnoraState.get('isSidebarOpen');
  setSidebarOpen(next);
}

export function setSidebarOpen(open) {
  learnoraState.set({ isSidebarOpen: open });
  applySidebarState(open);
  localStorage.setItem('lr_sidebar_open', String(open));
}

function applySidebarState(open) {
  if (!$sidebar) return;

  if (open) {
    $sidebar.classList.remove('lr-sidebar--closed');
    // Only show overlay on mobile
    if (window.innerWidth < 768 && $overlay) {
      $overlay.classList.add('visible');
    }
  } else {
    $sidebar.classList.add('lr-sidebar--closed');
    $overlay?.classList.remove('visible');
  }
}

// ---------------------------------------------------------------------------
// Use a suggestion prompt
// ---------------------------------------------------------------------------

export function useSuggestion(text) {
  if (!$inputText) return;
  $inputText.value = text;
  $inputText.dispatchEvent(new Event('input')); // trigger auto-resize
  $inputText.focus();
}

// ---------------------------------------------------------------------------
// Conversation rename modal
// ---------------------------------------------------------------------------

export function startTitleEdit() {
  const id = learnoraState.get('activeConversationId');
  if (!id) return;

  const $modal  = document.getElementById('lr-rename-modal');
  const $input  = document.getElementById('lr-rename-input');
  const $save   = document.getElementById('lr-rename-save');
  const $cancel = document.getElementById('lr-rename-cancel');
  if (!$modal || !$input) return;

  const current = learnoraState.get('currentTitle') ?? '';
  $input.value = current;
  $modal.style.display = 'flex';
  $input.focus();
  $input.select();

  const close = () => {
    $modal.style.display = 'none';
    $save.removeEventListener('click', onSave);
    $cancel.removeEventListener('click', close);
    $modal.removeEventListener('click', onBackdrop);
    document.removeEventListener('keydown', onKeydown);
  };

  const onSave = async () => {
    const newTitle = $input.value.trim();
    close();
    if (!newTitle || newTitle === current) return;

    try {
      await learnoraAPI.updateTitle(id, newTitle);
      learnoraState.set({ currentTitle: newTitle });
      updateChatTitle(newTitle);
      const convs = learnoraState.get('conversations').map(c =>
        c.conversation_id === id ? { ...c, title: newTitle } : c
      );
      learnoraState.set({ conversations: convs });
      renderConversationList();
      if (typeof showToast === 'function') showToast('Conversation renamed', 'success');
    } catch (_) {
      if (typeof showToast === 'function') showToast('Could not rename conversation', 'error');
    }
  };

  const onBackdrop = (e) => { if (e.target === $modal) close(); };
  const onKeydown  = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); onSave(); }
    if (e.key === 'Escape') close();
  };

  $save.addEventListener('click', onSave);
  $cancel.addEventListener('click', close);
  $modal.addEventListener('click', onBackdrop);
  document.addEventListener('keydown', onKeydown);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setMessagesHtml(html) {
  if ($messages) $messages.innerHTML = html;
}

function updateChatTitle(title) {
  if ($chatTitle) $chatTitle.textContent = title;
}

function setInputEnabled(enabled) {
  if ($inputText) $inputText.disabled = !enabled;
  if ($sendBtn)   $sendBtn.disabled   = !enabled;
  if ($sendBtn)   $sendBtn.classList.toggle('lr-send-btn--disabled', !enabled);
}

function appendContinueBanner() {
  document.getElementById('lr-continue-banner')?.remove(); // prevent duplicates
  $messages?.insertAdjacentHTML('beforeend', renderContinueBanner());
  scrollToBottom($messages);
}

// ---------------------------------------------------------------------------
// Input setup
// ---------------------------------------------------------------------------

function setupInputAutoResize() {
  if (!$inputText) return;
  $inputText.addEventListener('input', () => {
    $inputText.style.height = 'auto';
    const newH = Math.min($inputText.scrollHeight, 140);
    $inputText.style.height = newH + 'px';
    $inputText.classList.toggle('lr-textarea--multiline', $inputText.scrollHeight > 38);
  });
}

function setupKeyboardSend() {
  if (!$inputText) return;
  $inputText.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

function setupFileInput() {
  if (!$fileInput) return;
  $fileInput.addEventListener('change', () => {
    if ($fileInput.files.length > 0) addPendingFiles($fileInput.files);
  });
}

// ---------------------------------------------------------------------------
// Clear conversation messages
// ---------------------------------------------------------------------------

export async function clearConversation(id) {
  try {
    const res = await learnoraAPI.clearConversation(id);
    if (res.status !== 'success') throw new Error(res.message);

    learnoraState.set({ messages: [] });
    setMessagesHtml(renderNewConversationState());

    // Update sidebar message count
    const convs = learnoraState.get('conversations').map(c =>
      c.conversation_id === id ? { ...c, total_messages: 0 } : c
    );
    learnoraState.set({ conversations: convs });
    renderConversationList();

    if (typeof showToast === 'function') showToast('Conversation cleared', 'success');
  } catch (err) {
    console.error('[Learnora] clearConversation:', err);
    if (typeof showToast === 'function') showToast('Could not clear conversation', 'error');
  }
}

// ---------------------------------------------------------------------------
// Fix 6: Conversation context menu
// Single floating <div id="lr-conv-menu"> is repositioned on each open.
// Closed on outside-click or Escape.
// ---------------------------------------------------------------------------

let _menuConvId  = null;   // which conversation the open menu belongs to
let _menuCleanup = null;   // teardown function for listeners

export function openConvMenu(triggerEl, convId) {
  const $menu = document.getElementById('lr-conv-menu');
  if (!$menu) return;

  // Close any already-open menu first
  closeConvMenu();

  _menuConvId = convId;

  // Position: below the trigger, right-aligned
  const rect = triggerEl.getBoundingClientRect();
  $menu.style.display = 'block';
  $menu.style.top  = (rect.bottom + 4) + 'px';

  // Decide left/right so menu never clips viewport
  const menuWidth = 180;
  const spaceRight = window.innerWidth - rect.right;
  if (spaceRight >= menuWidth) {
    $menu.style.left  = rect.left + 'px';
    $menu.style.right = 'auto';
  } else {
    $menu.style.right = (window.innerWidth - rect.right) + 'px';
    $menu.style.left  = 'auto';
  }

  // Ensure it doesn't go below viewport
  const spaceBelow = window.innerHeight - rect.bottom - 4;
  if (spaceBelow < 140) {
    $menu.style.top    = 'auto';
    $menu.style.bottom = (window.innerHeight - rect.top + 4) + 'px';
  } else {
    $menu.style.bottom = 'auto';
  }

  // Focus the menu for keyboard nav
  $menu.querySelector('[role="menuitem"]')?.focus();

  // ── Teardown listeners ──────────────────────────────────────────────────
  const onOutsideClick = (e) => {
    if (!$menu.contains(e.target) && e.target !== triggerEl) closeConvMenu();
  };
  const onKeydown = (e) => {
    if (e.key === 'Escape') { closeConvMenu(); triggerEl.focus(); }
  };

  setTimeout(() => {
    document.addEventListener('click',   onOutsideClick, { capture: true });
    document.addEventListener('keydown', onKeydown);
  }, 0); // defer so the opening click doesn't immediately close it

  _menuCleanup = () => {
    document.removeEventListener('click',   onOutsideClick, { capture: true });
    document.removeEventListener('keydown', onKeydown);
  };
}

export function closeConvMenu() {
  const $menu = document.getElementById('lr-conv-menu');
  if ($menu) $menu.style.display = 'none';
  _menuCleanup?.();
  _menuCleanup = null;
  _menuConvId  = null;
}

/**
 * Called by delegation when user clicks an action inside the context menu.
 * @param {'rename'|'clear'|'delete'} action
 */
export function handleConvMenuAction(action) {
  const id = _menuConvId;
  closeConvMenu();

  if (!id) return;

  switch (action) {
    case 'rename':
      startTitleEdit();
      break;
    case 'clear':
      clearConversation(id);
      break;
    case 'delete':
      deleteConversation(id);
      break;
  }
}

// ---------------------------------------------------------------------------
// Sidebar — outside-click close (desktop) + swipe gesture (mobile)
// ---------------------------------------------------------------------------

function setupSidebarOutsideClick() {
  document.addEventListener('click', (e) => {
    if (!learnoraState.get('isSidebarOpen')) return;
    if (window.innerWidth < 768) return; // overlay handles mobile

    const toggleBtn = document.querySelector('[data-action="learnora-toggle-sidebar"]');
    if ($sidebar?.contains(e.target) || toggleBtn?.contains(e.target)) return;

    setSidebarOpen(false);
  });
}

function setupSidebarSwipeGesture() {
  let touchStartX = 0;
  let touchStartY = 0;
  const EDGE_ZONE = 32;       // px from left edge to trigger open gesture
  const SWIPE_THRESHOLD = 60; // min horizontal travel to register swipe

  document.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;

    // Ignore vertical-dominant swipes
    if (Math.abs(dy) > Math.abs(dx)) return;

    const isOpen = learnoraState.get('isSidebarOpen');

    // Swipe right from left edge → open
    if (!isOpen && touchStartX <= EDGE_ZONE && dx > SWIPE_THRESHOLD) {
      setSidebarOpen(true);
    }
    // Swipe left while open → close
    if (isOpen && dx < -SWIPE_THRESHOLD) {
      setSidebarOpen(false);
    }
  }, { passive: true });
}

// ---------------------------------------------------------------------------
// Scroll-to-bottom FAB
// ---------------------------------------------------------------------------

function setupScrollFab() {
  const $fab = document.getElementById('lr-scroll-to-bottom');
  if (!$fab || !$messages) return;

  $messages.addEventListener('scroll', () => {
    $fab.style.display = isScrolledToBottom($messages, 120) ? 'none' : 'flex';
  }, { passive: true });

  $fab.addEventListener('click', () => {
    scrollToBottom($messages);
    $fab.style.display = 'none';
  });
}

// ---------------------------------------------------------------------------
// Queue indicator (shown while a message is queued during streaming)
// ---------------------------------------------------------------------------

function showQueuedIndicator(count) {
  let el = document.getElementById('lr-queue-indicator');
  if (!el) {
    el = document.createElement('div');
    el.id = 'lr-queue-indicator';
    el.className = 'lr-queue-indicator';
    document.getElementById('lr-quota-display')?.before(el);
  }
  el.textContent = `${count} message${count > 1 ? 's' : ''} queued`;
  el.style.display = 'block';
}

function clearQueuedIndicator() {
  const el = document.getElementById('lr-queue-indicator');
  if (el) el.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Update sidebar entry without a full network refetch
// ---------------------------------------------------------------------------

function updateConvInSidebar(id) {
  const convs = learnoraState.get('conversations').map(c => {
    if (c.conversation_id !== id) return c;
    return {
      ...c,
      total_messages: (c.total_messages ?? 0) + 2, // user msg + AI reply
      last_message_at: new Date().toISOString(),
    };
  });
  // Keep sorted by most-recent
  convs.sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));
  learnoraState.set({ conversations: convs });
  renderConversationList();
}

// ---------------------------------------------------------------------------
// Context menu delegation
// Attaches once; handles [data-conv-action] clicks inside #lr-conv-menu.
// ---------------------------------------------------------------------------

function setupConvMenuDelegation() {
  const $menu = document.getElementById('lr-conv-menu');
  if (!$menu) return;

  $menu.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-conv-action]');
    if (!btn) return;
    e.stopPropagation();
    handleConvMenuAction(btn.dataset.convAction);
  });
}
