<!--
  ============================================================================
  PROFILE  — HTML to add to your feed2.html (or main layout file)
  ============================================================================
  
  1. Paste the <section id="my-profile"> block inside your main app wrapper,
     alongside your other sections (feed, threads, etc.)
  
  2. Paste each modal at the bottom of <body>, alongside your other modals.
  
  3. Add the nav trigger wherever your sidebar/nav is:
       <button data-action="open-my-profile">My Profile</button>
  
  4. In app_unified.js add:
       import { ProfileHandlers } from '../profile/profile_events.js';
     Then spread ...ProfileHandlers inside UNIFIED_ACTIONS.
  ============================================================================
-->


<!-- ══════════════════════════════════════════════════════════════════════════
     PROFILE SECTION  (add alongside your other sections)
     ════════════════════════════════════════════════════════════════════════ -->

<section id="my-profile" style="display:none;">
  <style>
    section#my-profile.active { display:block !important; }

    .profile-section-wrap {
      max-width: 720px;
      margin: 0 auto;
      padding: 1rem;
    }

    /* Tab bar */
    .profile-tab-bar {
      display: flex;
      gap: 0.4rem;
      background: var(--bg-secondary);
      border-radius: 12px;
      padding: 0.4rem;
      margin-bottom: 1rem;
      overflow-x: auto;
    }
    .profile-tab-btn {
      flex: 1;
      min-width: fit-content;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.82rem;
      font-weight: 600;
      white-space: nowrap;
      transition: background 0.18s, color 0.18s;
      background: transparent;
      color: var(--text-secondary);
    }

    /* Skeleton pulse */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.4; }
    }

    /* Modal overlay */
    .profile-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.55);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .profile-modal-overlay.active {
      display: flex;
    }
    .profile-modal-box {
      background: var(--bg-primary);
      border-radius: 16px;
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      padding: 1.5rem;
      position: relative;
    }
    .profile-modal-title {
      font-size: 1rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 1.25rem;
    }
    .profile-modal-close {
      position: absolute;
      top: 1rem;
      right: 1rem;
      background: var(--bg-tertiary);
      border: none;
      border-radius: 50%;
      width: 30px;
      height: 30px;
      cursor: pointer;
      font-size: 1rem;
      color: var(--text-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .profile-input {
      width: 100%;
      padding: 0.65rem 0.85rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-primary);
      font-size: 0.88rem;
      box-sizing: border-box;
      margin-bottom: 0.85rem;
    }
    .profile-input:focus {
      outline: none;
      border-color: var(--primary);
    }
    .profile-label {
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      display: block;
      margin-bottom: 0.35rem;
    }
    .profile-btn-primary {
      width: 100%;
      padding: 0.75rem;
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.9rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }
    .profile-btn-secondary {
      width: 100%;
      padding: 0.65rem;
      background: var(--bg-tertiary);
      color: var(--text-primary);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      margin-top: 0.4rem;
    }
    .profile-btn-danger {
      width: 100%;
      padding: 0.65rem;
      background: rgba(239,68,68,0.1);
      color: #ef4444;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.88rem;
      margin-top: 0.4rem;
    }
    .profile-helper-text {
      font-size: 0.75rem;
      color: var(--text-secondary);
      margin-top: -0.5rem;
      margin-bottom: 0.85rem;
    }
  </style>

  <div class="profile-section-wrap">

    <!-- Header (populated by JS) -->
    <div id="profile-header-container">
      <!-- Loading skeleton -->
      <div style="background:var(--bg-secondary);border-radius:16px;padding:1.5rem;margin-bottom:1rem;animation:pulse 1.5s ease-in-out infinite;">
        <div style="display:flex;gap:1rem;align-items:flex-start;">
          <div style="width:80px;height:80px;border-radius:50%;background:var(--bg-tertiary);flex-shrink:0;"></div>
          <div style="flex:1;">
            <div style="height:18px;background:var(--bg-tertiary);border-radius:6px;margin-bottom:0.5rem;width:60%;"></div>
            <div style="height:13px;background:var(--bg-tertiary);border-radius:6px;margin-bottom:0.5rem;width:40%;"></div>
            <div style="height:12px;background:var(--bg-tertiary);border-radius:6px;width:80%;"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="profile-tab-bar">
      <button class="profile-tab-btn active" data-action="profile-tab" data-tab="posts"
              style="background:var(--primary);color:#fff;">Posts</button>
      <button class="profile-tab-btn" data-action="profile-tab" data-tab="stats">Stats</button>
      <button class="profile-tab-btn" data-action="profile-tab" data-tab="connections">Connections</button>
      <button class="profile-tab-btn" data-action="profile-tab" data-tab="reputation">Reputation</button>
    </div>

    <!-- Tab content (populated by JS) -->
    <div id="profile-tab-content">
      <!-- Skeleton loaded by initProfile() -->
    </div>

  </div>
</section>


<!-- ══════════════════════════════════════════════════════════════════════════
     MODAL 1 — Edit Profile
     ════════════════════════════════════════════════════════════════════════ -->

<div id="profile-edit-modal" class="profile-modal-overlay">
  <div class="profile-modal-box">
    <button class="profile-modal-close"
            data-action="profile-close-modal" data-modal-id="profile-edit-modal">✕</button>

    <h2 class="profile-modal-title">✏️ Edit Profile</h2>

    <label class="profile-label">Display Name</label>
    <input id="edit-profile-name" class="profile-input" type="text" placeholder="Your full name" maxlength="100">

    <label class="profile-label">Bio</label>
    <textarea id="edit-profile-bio" class="profile-input" rows="3"
              placeholder="Tell us about yourself…" maxlength="500"
              style="resize:vertical;"></textarea>
    <div class="profile-helper-text">Max 500 characters</div>

    <!-- Learning goals section -->
    <label class="profile-label">Learning Goals</label>
    <div id="edit-goals-list" style="margin-bottom:0.75rem;"></div>
    <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
      <input id="edit-goal-input" class="profile-input"
             type="text" placeholder="Add a learning goal…" maxlength="100"
             style="margin-bottom:0;flex:1;">
      <button data-action="profile-add-goal"
              style="padding:0.65rem 1rem;background:var(--primary);color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:0.85rem;white-space:nowrap;">
        + Add
      </button>
    </div>

    <button class="profile-btn-primary" data-action="profile-save-edit">Save Changes</button>
    <button class="profile-btn-secondary"
            data-action="profile-close-modal" data-modal-id="profile-edit-modal">Cancel</button>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════════════════════════
     MODAL 2 — Edit Academic Info
     ════════════════════════════════════════════════════════════════════════ -->

<div id="profile-academic-modal" class="profile-modal-overlay">
  <div class="profile-modal-box">
    <button class="profile-modal-close"
            data-action="profile-close-modal" data-modal-id="profile-academic-modal">✕</button>

    <h2 class="profile-modal-title">🎓 Academic Info</h2>

    <label class="profile-label">Subjects I Study</label>
    <input id="academic-subjects" class="profile-input" type="text"
           placeholder="Math, Physics, Chemistry  (comma separated)">
    <div class="profile-helper-text">Separate subjects with commas</div>

    <label class="profile-label">Subjects I'm Strong In</label>
    <input id="academic-strong" class="profile-input" type="text"
           placeholder="Math, Biology  (comma separated)">

    <label class="profile-label">Subjects I Need Help With</label>
    <input id="academic-help" class="profile-input" type="text"
           placeholder="Chemistry, Physics  (comma separated)">

    <label class="profile-label">Learning Style</label>
    <textarea id="academic-learning-style" class="profile-input" rows="2"
              placeholder="e.g. I learn best through visual examples and practice problems"
              maxlength="300" style="resize:vertical;"></textarea>

    <label class="profile-label">Study Preferences</label>
    <input id="academic-study-prefs" class="profile-input" type="text"
           placeholder="Morning sessions, Group study, Flashcards  (comma separated)">

    <button class="profile-btn-primary" data-action="profile-save-academic">Save</button>
    <button class="profile-btn-secondary"
            data-action="profile-close-modal" data-modal-id="profile-academic-modal">Cancel</button>
  </div>
</div>


<!-- ══════════════════════════════════════════════════════════════════════════
     MODAL 3 — Change Avatar
     ════════════════════════════════════════════════════════════════════════ -->

<div id="profile-avatar-modal" class="profile-modal-overlay">
  <div class="profile-modal-box">
    <button class="profile-modal-close"
            data-action="profile-close-modal" data-modal-id="profile-avatar-modal">✕</button>

    <h2 class="profile-modal-title">🖼️ Change Profile Picture</h2>

    <!-- Preview area -->
    <div style="text-align:center;margin-bottom:1.25rem;">
      <div id="avatar-preview" style="width:90px;height:90px;border-radius:50%;background:var(--bg-tertiary);margin:0 auto 0.75rem;overflow:hidden;display:flex;align-items:center;justify-content:center;">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1.5">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>
      <label style="font-size:0.82rem;color:var(--text-secondary);">JPG, PNG, GIF or WEBP · max 5 MB</label>
    </div>

    <!-- File input -->
    <input
      id="avatar-file-input"
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      class="profile-input"
      style="padding:0.5rem;"
      onchange="
        const f = this.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = e => {
          const prev = document.getElementById('avatar-preview');
          prev.innerHTML = '<img src=\'' + e.target.result + '\' style=\'width:100%;height:100%;object-fit:cover;\'>';
        };
        reader.readAsDataURL(f);
      ">

    <button class="profile-btn-primary" data-action="profile-upload-avatar">Upload</button>
    <button class="profile-btn-danger"  data-action="profile-remove-avatar">Remove Current Photo</button>
    <button class="profile-btn-secondary"
            data-action="profile-close-modal" data-modal-id="profile-avatar-modal">Cancel</button>
  </div>
</div>
