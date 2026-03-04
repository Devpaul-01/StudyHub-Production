/**
 * ============================================================================
 * POST RESOURCE VIEWER — PRODUCTION
 * Fullscreen modal for viewing post images / videos in isolation.
 *
 * HOW TO WIRE UP:
 *  1. Add  data-action="view-post-resource"  to each .post-resource element
 *     (see the patched buildPostResourcesContainer below).
 *  2. Drop the modal HTML into your feed template.
 *  3. Import this file and call initResourceViewer() once on DOMContentLoaded.
 *  4. Route clicks through your existing delegated-event handler:
 *       case 'view-post-resource': openResourceViewer(e.target.closest('[data-action]')); break;
 * ============================================================================
 */

// ─── State ───────────────────────────────────────────────────────────────────

let _resources   = [];   // full resources array for the current post
let _currentIdx  = 0;    // which item is showing
let _touchStartX = 0;

// ─── DOM refs (populated after initResourceViewer) ────────────────────────────

let _modal, _stage, _counter, _prevBtn, _nextBtn, _dlBtn, _closeBtn;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once on DOMContentLoaded.
 * Caches DOM refs and attaches internal listeners.
 */
export function initResourceViewer() {
  _modal    = document.getElementById('post-resource-viewer-modal');
  _stage    = document.getElementById('prv-stage');
  _counter  = document.getElementById('prv-counter');
  _prevBtn  = document.getElementById('prv-prev');
  _nextBtn  = document.getElementById('prv-next');
  _dlBtn    = document.getElementById('prv-download');
  _closeBtn = document.getElementById('prv-close');

  if (!_modal) {
    console.warn('[ResourceViewer] Modal HTML not found in DOM. Did you add resource_viewer_modal.html?');
    return;
  }

  // Close actions
  _closeBtn.addEventListener('click', closeResourceViewer);
  _modal.addEventListener('click', (e) => { if (e.target === _modal) closeResourceViewer(); });
  document.addEventListener('keydown', _onKeydown);

  // Navigation
  _prevBtn.addEventListener('click', () => _navigate(-1));
  _nextBtn.addEventListener('click', () => _navigate(+1));

  // Touch swipe
  _stage.addEventListener('touchstart', (e) => { _touchStartX = e.changedTouches[0].screenX; }, { passive: true });
  _stage.addEventListener('touchend',   (e) => {
    const dx = e.changedTouches[0].screenX - _touchStartX;
    if (Math.abs(dx) > 50) _navigate(dx < 0 ? 1 : -1);
  });
}

/**
 * Open the viewer.
 * @param {Element} triggerEl - the element with data-action="view-post-resource"
 */
export function openResourceViewer(triggerEl) {
  if (!_modal) return;

  const raw = triggerEl.dataset.resources;
  _resources  = raw ? JSON.parse(raw) : [];
  _currentIdx = parseInt(triggerEl.dataset.index ?? '0', 10);

  if (_resources.length === 0) return;

  _render();
  _modal.classList.add('prv-open');
  document.body.style.overflow = 'hidden';
  _modal.focus();
}

/**
 * Close the viewer and tear down any playing media.
 */
export function closeResourceViewer() {
  if (!_modal) return;
  _modal.classList.remove('prv-open');
  document.body.style.overflow = '';
  // Pause any video that may be playing
  _stage.querySelectorAll('video').forEach(v => v.pause());
  // Clear stage after transition
  setTimeout(() => { _stage.innerHTML = ''; }, 300);
}

// ─── Private ─────────────────────────────────────────────────────────────────

function _navigate(dir) {
  const next = _currentIdx + dir;
  if (next < 0 || next >= _resources.length) return;
  // Pause any playing video before leaving
  _stage.querySelectorAll('video').forEach(v => v.pause());
  _currentIdx = next;
  _render();
}

function _render() {
  const resource = _resources[_currentIdx];
  const total    = _resources.length;

  // ── Counter ──────────────────────────────────────────────────────────────
  _counter.textContent = total > 1 ? `${_currentIdx + 1} / ${total}` : '';

  // ── Nav visibility ───────────────────────────────────────────────────────
  _prevBtn.disabled = _currentIdx === 0;
  _nextBtn.disabled = _currentIdx === total - 1;
  _prevBtn.style.opacity = _currentIdx === 0       ? '0.3' : '1';
  _nextBtn.style.opacity = _currentIdx === total-1 ? '0.3' : '1';

  // ── Download button ──────────────────────────────────────────────────────
  _dlBtn.href     = resource.url;
  _dlBtn.download = resource.filename || 'download';

  // ── Stage content ─────────────────────────────────────────────────────────
  _stage.innerHTML = '';
  _stage.classList.remove('prv-stage--doc');

  if (resource.type === 'image') {
    const img = document.createElement('img');
    img.src       = resource.url;
    img.alt       = resource.filename || 'Image';
    img.className = 'prv-image';
    // Pinch-zoom hint via CSS `touch-action: pinch-zoom`
    _stage.appendChild(img);

  } else if (resource.type === 'video') {
    const vid       = document.createElement('video');
    vid.src         = resource.url;
    vid.controls    = true;
    vid.autoplay    = true;
    vid.playsInline = true;
    vid.className   = 'prv-video';
    if (resource.thumbnail) vid.poster = resource.thumbnail;
    _stage.appendChild(vid);

  } else {
    // Document — show a rich card, not just a download link
    _stage.classList.add('prv-stage--doc');
    const ext     = (resource.filename || '').split('.').pop().toLowerCase();
    const docMeta = _getDocMeta(ext);

    _stage.innerHTML = `
      <div class="prv-doc-card">
        <div class="prv-doc-icon" style="background:${docMeta.bg};">${docMeta.svg}</div>
        <p class="prv-doc-name">${resource.filename || 'Document'}</p>
        <p class="prv-doc-ext">${ext.toUpperCase()}</p>
        <a class="prv-doc-open-btn"
           href="${resource.url}"
           target="_blank"
           rel="noopener noreferrer">
          Open in new tab
        </a>
      </div>
    `;
  }
}

function _onKeydown(e) {
  if (!_modal?.classList.contains('prv-open')) return;
  if (e.key === 'Escape')     closeResourceViewer();
  if (e.key === 'ArrowLeft')  _navigate(-1);
  if (e.key === 'ArrowRight') _navigate(+1);
}

// Inline copy of _getDocMeta so this file is self-contained
function _getDocMeta(ext) {
  const map = {
    pdf:  { bg:'rgba(239,68,68,0.15)',   color:'#ef4444', label:'PDF' },
    doc:  { bg:'rgba(59,130,246,0.15)',  color:'#3b82f6', label:'Word' },
    docx: { bg:'rgba(59,130,246,0.15)',  color:'#3b82f6', label:'Word' },
    xls:  { bg:'rgba(16,185,129,0.15)', color:'#10b981', label:'Excel' },
    xlsx: { bg:'rgba(16,185,129,0.15)', color:'#10b981', label:'Excel' },
    csv:  { bg:'rgba(16,185,129,0.15)', color:'#10b981', label:'CSV' },
    ppt:  { bg:'rgba(245,158,11,0.15)', color:'#f59e0b', label:'PPT' },
    pptx: { bg:'rgba(245,158,11,0.15)', color:'#f59e0b', label:'PPT' },
    zip:  { bg:'rgba(139,92,246,0.15)', color:'#8b5cf6', label:'ZIP' },
    rar:  { bg:'rgba(139,92,246,0.15)', color:'#8b5cf6', label:'RAR' },
  };
  const m = map[ext] || { bg:'rgba(100,116,139,0.15)', color:'#64748b', label:'FILE' };
  return {
    bg:  m.bg,
    svg: `<svg width="56" height="56" viewBox="0 0 24 24" fill="none"
               stroke="${m.color}" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>`,
  };
}
