/**
 * ============================================================================
 * LEARNORA UTILITIES
 * ─ Markdown renderer (no CDN dependency)
 * ─ Relative-time formatter
 * ─ DOM helpers
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// XSS guard
// ---------------------------------------------------------------------------

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// Markdown → HTML renderer
// Strategy: protect code blocks first, then apply inline rules, then restore.
// This prevents markdown rules from mangling code content.
// ---------------------------------------------------------------------------

export function renderMarkdown(raw) {
  if (!raw) return '';

  const codeBlocks = [];

  // 1. Extract fenced code blocks  ``` lang\n code \n ```
  let html = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
    const langBadge = lang
      ? `<span class="lr-code-lang">${escapeHtml(lang)}</span>`
      : '';
    // data-needs-highlight is picked up by applyHighlighting() after DOM insertion
    codeBlocks.push(
      `<div class="lr-code-block" data-needs-highlight="1">` +
        `${langBadge}` +
        `<pre><code${langClass}>${escapeHtml(code.trimEnd())}</code></pre>` +
        `<button class="lr-copy-btn" title="Copy code" aria-label="Copy code">` +
          `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">` +
            `<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>` +
          `</svg>` +
        `</button>` +
      `</div>`
    );
    return `\x00CB${idx}\x00`;
  });

  // 2. Escape HTML in the rest (prevents XSS in AI output)
  html = escapeHtml(html);

  // 3. Restore code-block placeholders (they're already escaped internally)
  // We use a temp marker so escapeHtml above didn't touch them
  // Re-extract markers after escaping
  html = html.replace(/\x00CB(\d+)\x00/g, (_, i) => codeBlocks[Number(i)]);

  // 4. Inline code  `text`
  html = html.replace(/`([^`\n]+)`/g, '<code class="lr-inline-code">$1</code>');

  // 5. Headings  ## / ### / ####
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h6 class="lr-h">$1</h6>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h5 class="lr-h">$1</h5>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h4 class="lr-h lr-h2">$1</h4>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h3 class="lr-h lr-h1">$1</h3>');

  // 6. Bold + italic combos (order matters)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // 7. Unordered lists
  html = html.replace(/^[-*•]\s+(.+)$/gm, '<li class="lr-li">$1</li>');
  html = html.replace(/(<li class="lr-li">[\s\S]*?<\/li>\n?)+/g,
    (block) => `<ul class="lr-ul">${block}</ul>`);

  // 8. Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="lr-li lr-li-ol">$1</li>');
  html = html.replace(/(<li class="lr-li lr-li-ol">[\s\S]*?<\/li>\n?)+/g,
    (block) => `<ol class="lr-ol">${block}</ol>`);

  // 9. Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="lr-hr">');

  // 10. Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="lr-bq">$1</blockquote>');

  // 11. Paragraphs — double newline becomes paragraph break
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Don't wrap block-level elements in <p>
      if (/^<(h[1-6]|ul|ol|li|blockquote|hr|div|pre)[\s>]/.test(trimmed)) {
        return trimmed;
      }
      return `<p class="lr-p">${trimmed}</p>`;
    })
    .join('\n');

  // 12. Single newlines inside paragraphs → <br>
  html = html.replace(/([^>])\n([^<])/g, '$1<br>$2');

  return html;
}

// ---------------------------------------------------------------------------
// Relative time (mirrors formatHudTime in notification.utils.js)
// ---------------------------------------------------------------------------

export function formatRelativeTime(isoDate) {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHrs = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Scroll helpers
// ---------------------------------------------------------------------------

export function scrollToBottom(el, smooth = true) {
  if (!el) return;
  el.scrollTo({
    top: el.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  });
}

export function isScrolledToBottom(el, threshold = 80) {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
}

// ---------------------------------------------------------------------------
// Truncate text for sidebar previews
// ---------------------------------------------------------------------------

export function truncate(str, maxLen = 48) {
  if (!str || str.length <= maxLen) return str ?? '';
  return str.slice(0, maxLen - 1) + '…';
}

// ---------------------------------------------------------------------------
// Mode labels
// ---------------------------------------------------------------------------

export const MODE_LABELS = {
  fast_response: '⚡ Fast',
  deep_think:    '🧠 Deep Think',
  programming:   '💻 Code',
  research:      '🔬 Research',
  summarize:     '📋 Summarize',
  explain:       '🎓 Explain',
};

export const MODE_OPTIONS = Object.entries(MODE_LABELS);

// ---------------------------------------------------------------------------
// Highlight.js integration
// ---------------------------------------------------------------------------

/**
 * Run Highlight.js on all code blocks that haven't been highlighted yet.
 * Idempotent — uses data-needs-highlight to track state.
 * Also wires up the copy-to-clipboard button on each block.
 * @param {HTMLElement} container
 */
export function applyHighlighting(container = document.body) {
  if (!window.hljs) return;

  container.querySelectorAll('[data-needs-highlight="1"]').forEach((block) => {
    block.removeAttribute('data-needs-highlight');
    const codeEl = block.querySelector('code');
    if (codeEl) hljs.highlightElement(codeEl);

    // Wire copy button
    const copyBtn = block.querySelector('.lr-copy-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', async () => {
        const text = codeEl?.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
          setTimeout(() => {
            copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
          }, 1800);
        } catch (_) { /* clipboard unavailable */ }
      });
    }
  });
}
