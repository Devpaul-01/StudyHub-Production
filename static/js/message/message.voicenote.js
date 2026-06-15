/**
 * Message Voice Note System — PRODUCTION
 * MediaRecorder-based recording with live waveform animation,
 * duration counter, and upload integration.
 *
 * Usage:
 *   import { VoiceNoteRecorder } from './message.voicenote.js';
 *   const recorder = new VoiceNoteRecorder({ onRecorded, onCancel });
 *   recorder.start();
 */

import { MAX_VOICE_NOTE_DURATION_MS } from './message.constants.js';

// ============================================================================
// VOICE NOTE RECORDER CLASS
// ============================================================================

export class VoiceNoteRecorder {
  /**
   * @param {object} options
   * @param {(blob: Blob, durationSec: number) => void} options.onRecorded
   * @param {() => void}  options.onCancel
   * @param {HTMLElement} options.toolbar  - The toolbar element that contains the UI slots
   */
  constructor({ onRecorded, onCancel, toolbar }) {
    this.onRecorded   = onRecorded;
    this.onCancel     = onCancel;
    this.toolbar      = toolbar;

    this._mediaRecorder  = null;
    this._audioChunks    = [];
    this._startTime      = null;
    this._timerInterval  = null;
    this._maxTimer       = null;
    this._stream         = null;
    this._animFrame      = null;
    this._analyser       = null;
    this._audioCtx       = null;
    this._isRecording    = false;

    this._ui = null;   // reference to the injected recording UI
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  async start() {
    if (this._isRecording) return;

    try {
      this._stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Microphone access denied:', err);
      if (typeof showToast === 'function') showToast('Microphone access denied', 'error');
      return;
    }

    // Set up MediaRecorder
    const mimeType = _bestMimeType();
    this._mediaRecorder = new MediaRecorder(this._stream, { mimeType });
    this._audioChunks   = [];

    this._mediaRecorder.ondataavailable = e => {
      if (e.data.size > 0) this._audioChunks.push(e.data);
    };

    this._mediaRecorder.onstop = () => {
      const blob        = new Blob(this._audioChunks, { type: mimeType || 'audio/webm' });
      const durationSec = (Date.now() - this._startTime) / 1000;
      this._cleanup();
      this.onRecorded(blob, durationSec);
    };

    this._mediaRecorder.start(100); // collect chunks every 100ms
    this._startTime   = Date.now();
    this._isRecording = true;

    // Inject recording UI
    this._injectRecordingUI();

    // Start duration counter
    this._timerInterval = setInterval(() => this._updateTimer(), 500);

    // Auto-stop at max duration
    this._maxTimer = setTimeout(() => this.stop(), MAX_VOICE_NOTE_DURATION_MS);

    // Waveform animation
    this._startWaveform();
  }

  stop() {
    if (!this._isRecording || !this._mediaRecorder) return;
    this._mediaRecorder.stop();
    this._isRecording = false;
    clearInterval(this._timerInterval);
    clearTimeout(this._maxTimer);
    cancelAnimationFrame(this._animFrame);
  }

  cancel() {
    if (!this._isRecording) return;
    this._mediaRecorder.ondataavailable = null;
    this._mediaRecorder.onstop          = null;
    this._mediaRecorder.stop();
    this._isRecording = false;
    this._cleanup();
    this.onCancel();
    this._removeRecordingUI();
  }

  // --------------------------------------------------------------------------
  // PRIVATE
  // --------------------------------------------------------------------------

  _injectRecordingUI() {
    const existing = document.getElementById('voice-recording-ui');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id        = 'voice-recording-ui';
    el.className = 'flex items-center gap-3 flex-1 animate-fade-in';
    el.innerHTML = `
      <!-- Cancel -->
      <button id="vn-cancel-btn"
              class="flex-shrink-0 p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/>
        </svg>
      </button>

      <!-- Live waveform bars -->
      <div id="vn-waveform" class="flex items-center gap-px flex-1 h-8">
        ${Array(30).fill(0).map(() => `
          <div class="vn-bar rounded-full flex-1 bg-indigo-400 transition-all duration-75" style="height:4px"></div>
        `).join('')}
      </div>

      <!-- Duration -->
      <span id="vn-duration"
            class="flex-shrink-0 text-sm font-mono font-semibold text-indigo-600 tabular-nums min-w-[3.5rem] text-right">
        0:00
      </span>

      <!-- Recording dot -->
      <span class="flex-shrink-0 w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>

      <!-- Send (stop) -->
      <button id="vn-send-btn"
              class="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 text-white
                     flex items-center justify-center shadow-md hover:bg-indigo-700
                     active:scale-95 transition-all">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    `;

    // Hide normal input area
    const normalInput = document.getElementById('message-input-wrapper');
    if (normalInput) normalInput.classList.add('hidden');

    // Insert recording UI into the toolbar
    const toolbar = this.toolbar || document.getElementById('message-toolbar');
    if (toolbar) toolbar.insertBefore(el, toolbar.firstChild);

    this._ui = el;

    el.querySelector('#vn-cancel-btn')?.addEventListener('click', () => this.cancel());
    el.querySelector('#vn-send-btn')?.addEventListener('click',  () => this.stop());
  }

  _removeRecordingUI() {
    this._ui?.remove();
    this._ui = null;
    const normalInput = document.getElementById('message-input-wrapper');
    if (normalInput) normalInput.classList.remove('hidden');
  }

  _updateTimer() {
    const elapsed = Date.now() - this._startTime;
    const secs    = Math.floor(elapsed / 1000);
    const m       = Math.floor(secs / 60);
    const s       = secs % 60;
    const label   = `${m}:${String(s).padStart(2, '0')}`;
    const durEl   = document.getElementById('vn-duration');
    if (durEl) durEl.textContent = label;
  }

  _startWaveform() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source   = this._audioCtx.createMediaStreamSource(this._stream);
      this._analyser = this._audioCtx.createAnalyser();
      this._analyser.fftSize = 64;
      source.connect(this._analyser);

      const bufLen  = this._analyser.frequencyBinCount;
      const dataArr = new Uint8Array(bufLen);
      const bars    = document.querySelectorAll('#vn-waveform .vn-bar');

      const draw = () => {
        this._animFrame = requestAnimationFrame(draw);
        this._analyser.getByteFrequencyData(dataArr);

        bars.forEach((bar, i) => {
          const idx = Math.floor((i / bars.length) * bufLen);
          const val = dataArr[idx] / 255;
          const h   = Math.max(4, Math.round(val * 28));
          bar.style.height = `${h}px`;
        });
      };
      draw();
    } catch (e) {
      // Waveform animation is cosmetic — fail silently
      console.warn('Waveform analyser unavailable:', e);
    }
  }

  _cleanup() {
    clearInterval(this._timerInterval);
    clearTimeout(this._maxTimer);
    cancelAnimationFrame(this._animFrame);

    this._stream?.getTracks().forEach(t => t.stop());
    this._audioCtx?.close().catch(() => {});

    this._stream      = null;
    this._audioCtx    = null;
    this._analyser    = null;
    this._mediaRecorder = null;

    this._removeRecordingUI();
  }
}

// ============================================================================
// MODULE-LEVEL SINGLETON  (consumed by message.events.js)
// ============================================================================

let _recorder = null;

/**
 * Start a new recording session.
 * @param {(blob: Blob, durationSec: number) => void} onRecorded
 * @param {() => void} onCancel
 */
export function startVoiceRecording(onRecorded, onCancel) {
  if (_recorder) return; // already recording

  _recorder = new VoiceNoteRecorder({
    onRecorded: (blob, dur) => {
      _recorder = null;
      onRecorded(blob, dur);
    },
    onCancel: () => {
      _recorder = null;
      onCancel?.();
    },
    toolbar: document.getElementById('message-toolbar'),
  });

  _recorder.start();
}

export function stopVoiceRecording() {
  _recorder?.stop();
}

export function cancelVoiceRecording() {
  _recorder?.cancel();
}

export function isRecording() {
  return !!_recorder;
}

// ============================================================================
// HELPERS
// ============================================================================

function _bestMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || '';
}
