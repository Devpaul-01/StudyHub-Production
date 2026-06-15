# Thread Feature Refinement & AI Enhancement Plan

> **Document type:** Production implementation roadmap  
> **Based on:** Full analysis of `threads.py`, `websocket_threads.py`, `websocket_messages.py`, `models.py`, and all 10 frontend JS modules + HTML template  
> **Intended consumer:** AI implementation agent or senior engineer  

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Confirmed Bugs (Fix Before Proceeding)](#3-confirmed-bugs-fix-before-proceeding)
4. [AI Enhancements](#4-ai-enhancements)
5. [UX Improvements](#5-ux-improvements)
6. [Attachment System Refinements](#6-attachment-system-refinements)
7. [Invites System Overhaul](#7-invites-system-overhaul)
8. [Thread List Improvements](#8-thread-list-improvements)
9. [Database Changes](#9-database-changes)
10. [API Changes](#10-api-changes)
11. [WebSocket Changes](#11-websocket-changes)
12. [Frontend Changes](#12-frontend-changes)
13. [Risks & Edge Cases](#13-risks--edge-cases)
14. [Recommended Implementation Order](#14-recommended-implementation-order)

---

## 1. Executive Summary

The thread system is architecturally sound. The REST layer, WebSocket architecture, state management, and rendering pipeline are well-structured and production-grade. The primary gaps are:

- **One confirmed data bug** (mention insertion uses display name not username) that will silently corrupt `@mention` notifications in every thread.
- **AI layer is functional but primitive** — single personality, no contextual message actions, no structured output, no auto-reply chain.
- **UX friction points** — reply requires 3 taps (long-press → sheet → Reply), mention text is not highlighted in rendered messages, attachment previews lack thumbnails.
- **Invites tab is undersized** — shows only one of the three invite-related workflows a user needs.

All proposed changes are backward-compatible. No breaking schema migrations. New tables and columns use nullable defaults.

---

## 2. Current Architecture Analysis

### 2.1 Backend

| Layer | Implementation | Notes |
|---|---|---|
| Auth | `@token_required` decorator on all routes | Shared with message system |
| REST | Flask Blueprint `student_threads` | All endpoints in `threads.py` |
| WebSocket | `ThreadWebSocketManager` in `websocket_threads.py` | Shares SocketIO instance with `MessageWebSocketManager` |
| AI | `_call_learnora_for_thread()` background daemon thread | Triggered on `@learnora` in text; uses `provider_manager` abstraction |
| Storage | Cloudinary for files/avatars | `cloudinary_storage` from `routes.student.storage` |
| DB | SQLAlchemy via `extensions.db` | Cascade deletes, atomic SQL counters, `with_for_update()` on approve |

**AI trigger path (current):**
```
send_thread_message WS handler
  → _parse_mentions() (for notification creation)
  → text.lower() contains "@learnora"
  → broadcast "learnora_thinking" to room
  → daemon Thread(_call_learnora_for_thread, app, thread_id, trigger_text, user_id)
  → context: last 12 messages
  → system prompt built inline
  → call provider_manager.get_working_provider()
  → save ThreadMessage(is_ai_response=True, sender_id=bot_user_id)
  → broadcast_ai_message() → new_thread_message to room
```

**Bot user:** Hardcoded as `bot_user_id = 99999999999` inside `_call_learnora_for_thread`. This is fragile — if the row doesn't exist in `users`, every foreign key constraint on `ThreadMessage.sender_id` will fail silently (the try/except swallows it).

**Context window:** Only 12 most recent messages. Meeting notes require 50–500. This limit is a per-call constant, not configurable.

### 2.2 Frontend Architecture

| Module | Responsibility |
|---|---|
| `thread.state.js` | Single source of truth; all WS and render decisions read from here |
| `thread.delegation.js` | Single root click/input/keydown handler; all UI interactions route through here |
| `thread.events.js` | Async business logic handlers; calls API + WS + render |
| `thread.websocket.js` | WS event registration; split into personal-room and thread-room handlers |
| `thread.render.js` | DOM mutations; no business logic |
| `thread.templates.js` | Pure HTML string builders; no state reads except what's passed in |
| `thread.modals.js` | Dynamically created modal dialogs |
| `thread.longpress.js` | Touch + right-click → dispatches `thread:open-options` custom event |

**Personal-room architecture (Issue 6 pattern):** Users join `user_{id}` room on connect. Thread-level metadata updates arrive here without requiring the user to be in any thread room. This is the correct pattern and must be preserved for all new WS events.

**State preserved across thread switches:** `threadList`, `currentUser`, `userActiveThread`, `activeTab`, `pendingInvites`. All per-session state is cleared in `resetThreadSession()`.

### 2.3 Message Status System

Three states: `sent → delivered → read`. The system is carefully designed:

- `sent`: Message persisted, nobody has received it yet.
- `delivered`: A non-sender member's client rendered the message (emits `message_delivered`).
- `read`: A member opened the thread and called `mark_thread_read`.

**Rule:** Personal-room handlers (`thread_list_update`, `thread_updated`, `thread_joined`) must NEVER call `emitDelivered` or `emitMarkRead`. This rule is documented in `thread.websocket.js` and must not be broken by any new feature.

### 2.4 Learnora Integration Points

```python
# websocket_threads.py

LEARNORA_TRIGGERS = ["@learnora"]

# In send_thread_message handler:
lower = text_content.lower()
ai_triggered = any(t in lower for t in LEARNORA_TRIGGERS)

# In _call_learnora_for_thread():
bot_user_id = 99999999999          # ← hardcoded, no DB lookup
recent = last 12 messages           # ← hardcoded context window
system = inline string builder      # ← no personality abstraction
```

---

## 3. Confirmed Bugs (Fix Before Proceeding)

### Bug 1 — Mention Insertion Uses Display Name, Not Username (CRITICAL)

**Location:** `thread.delegation.js` → `_showMentionSuggestions()` + `thread.events.js` → `handleOpenThread()` → `setMember()`

**Root cause:**

In `handleOpenThread()`:
```javascript
members.forEach((m) =>
  setMember(m.user_id ?? m.id, {
    name:   m.name,
    avatar: m.avatar,
    role:   m.role,
    // ← username is NEVER stored in memberMap
  })
);
```

In `_showMentionSuggestions()`:
```javascript
const uname = _esc(m.username ?? m.name ?? '');
// m.username is always undefined → falls back to m.name (display name)
// Button stores: data-username="John Smith"
// Insertion result: "@John Smith " instead of "@johndoe "
```

This means:
1. `@mention` notifications fail because `@John Smith` never matches a stored username.
2. `_parse_mentions()` on the backend uses `User.query.filter((User.username) == username_lower)` — display names don't match.
3. The `@learnora` trigger would also fail if someone's display name was "Learnora" while their username is different.

**Fix:**

In `setMember()` call sites (both `handleOpenThread` in `thread.events.js` and the `MEMBER_JOINED` WS handler in `thread.websocket.js`):
```javascript
setMember(m.user_id ?? m.id, {
  name:     m.name,
  username: m.username,   // ← ADD THIS
  avatar:   m.avatar,
  role:     m.role,
});
```

In `thread.state.js`, no change needed — `memberMap` stores arbitrary objects.

Verify `fetchThreadMembers()` response includes `username` — confirmed: `GET /threads/<id>/members` returns `username` field per member.

---

## 4. AI Enhancements

### 4.1 AI Message Actions (Summarize / Translate / Explain / Convert To Code)

**Feature:** Long-pressing an AI message (or any message) should offer contextual AI actions in the options sheet.

#### Backend Design

Create a new WebSocket event `thread_ai_action` handled in `websocket_threads.py`. This keeps the action in the real-time path so the "Learnora thinking" indicator and response delivery work identically to normal @mention triggers.

```python
# websocket_threads.py — add to register_handlers()

@sio.on("thread_ai_action")
def handle_thread_ai_action(data):
    """
    Client requests an AI action on a specific message.
    
    Payload:
      thread_id    int    (required)
      message_id   int    (required — the message to act on)
      action       str    (required: "summarize"|"translate"|"explain"|"to_code")
      target_lang  str    (optional — only for action="translate", e.g. "Spanish")
    """
    user_id = self._get_current_user()
    if not user_id:
        self._emit_error("Authentication required")
        return
    
    thread_id  = data.get("thread_id")
    message_id = data.get("message_id")
    action     = data.get("action", "")
    
    if not thread_id or not message_id or action not in ("summarize","translate","explain","to_code"):
        self._emit_error("Invalid ai_action payload")
        return
    
    if not self._is_member(thread_id, user_id):
        self._emit_error("Not a member")
        return
    
    target_msg = ThreadMessage.query.filter_by(id=message_id, is_deleted=False).first()
    if not target_msg:
        self._emit_error("Message not found")
        return
    
    self.broadcast_to_thread(thread_id, "learnora_thinking", {"thread_id": thread_id})
    
    app_ref = current_app._get_current_object()
    t = threading.Thread(
        target=_call_learnora_action,
        args=(app_ref, thread_id, message_id, action, data.get("target_lang"), user_id),
        daemon=True
    )
    t.start()
```

New function `_call_learnora_action()`:

```python
def _call_learnora_action(app, thread_id, message_id, action, target_lang, triggering_user_id):
    """
    Run an AI action on a specific message. Saves result as a reply to that message.
    """
    with app.app_context():
        bot_user_id = app.config.get("LEARNORA_BOT_USER_ID", 99999999999)
        if not bot_user_id:
            return
        
        target_msg = ThreadMessage.query.get(message_id)
        if not target_msg:
            return
        
        thread = Thread.query.get(thread_id)
        if not thread:
            return
        
        ACTION_PROMPTS = {
            "summarize": (
                "Summarize the following message in 2–3 concise bullet points. "
                "Be factual and do not add information not present in the message."
            ),
            "translate": (
                f"Translate the following message into {target_lang or 'Spanish'}. "
                "Provide only the translation, no explanation."
            ),
            "explain": (
                "Explain the following message in simple terms. "
                "Assume the reader is a student unfamiliar with the topic. "
                "Keep it under 4 sentences."
            ),
            "to_code": (
                "Convert the following description or pseudocode into working code. "
                "Use the most appropriate programming language based on context. "
                "Wrap in a code block with the language identifier. "
                "If the message is already code, clean and improve it."
            ),
        }
        
        system = (
            f"You are Learnora, an AI assistant in a study thread titled '{thread.title}'. "
            "You are performing a specific action on a user's message. "
            "Be concise, helpful, and accurate."
        )
        
        action_instruction = ACTION_PROMPTS[action]
        
        messages = [
            {"role": "system",  "content": system},
            {"role": "user",    "content": f"{action_instruction}\n\n---\n\n{target_msg.text_content}"},
        ]
        
        from learnora import provider_manager, _call_provider_sync
        provider = provider_manager.get_working_provider(needs_vision=False)
        if not provider:
            return
        
        ai_text = _call_provider_sync(messages, provider)
        if not ai_text:
            return
        
        bot_msg = ThreadMessage(
            thread_id      = thread_id,
            sender_id      = bot_user_id,
            text_content   = ai_text,
            reply_to_id    = message_id,      # ← ALWAYS reply to the source message
            is_ai_response = True,
            status         = "sent",
            sent_at        = datetime.datetime.utcnow()
        )
        db.session.add(bot_msg)
        Thread.query.filter_by(id=thread_id).update(
            {Thread.message_count: Thread.message_count + 1,
             Thread.last_activity: datetime.datetime.utcnow()},
            synchronize_session=False
        )
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"[AI_ACTION_COMMIT_ERROR] {e!r}")
            return
        
        thread_ws_manager.broadcast_ai_message(thread_id, bot_msg, ai_text)
```

#### Frontend Design

In `thread.delegation.js`, inside `_openOptionsSheet()`, add action buttons when the target message has text content (regardless of whether it's an AI message or a user message):

```javascript
// Add after existing rows, before the filter
const hasText = !isDeleted && msg.text_content && msg.text_content !== '[deleted]';

hasText ? `
  <div class="border-t border-gray-100 pt-1">
    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-5 pt-2 pb-1">
      AI Actions
    </p>
    <button class="${btnCls} text-violet-700 hover:bg-violet-50"
      data-action="thread-ai-action" data-message-id="${messageId}" data-ai-action="explain">
      <span class="text-xl w-7 text-center">💡</span><span class="font-medium">Explain</span>
    </button>
    <button class="${btnCls} text-violet-700 hover:bg-violet-50"
      data-action="thread-ai-action" data-message-id="${messageId}" data-ai-action="summarize">
      <span class="text-xl w-7 text-center">📝</span><span class="font-medium">Summarize</span>
    </button>
    <button class="${btnCls} text-violet-700 hover:bg-violet-50"
      data-action="thread-ai-action" data-message-id="${messageId}" data-ai-action="translate">
      <span class="text-xl w-7 text-center">🌍</span><span class="font-medium">Translate</span>
    </button>
    <button class="${btnCls} text-violet-700 hover:bg-violet-50"
      data-action="thread-ai-action" data-message-id="${messageId}" data-ai-action="to_code">
      <span class="text-xl w-7 text-center">💻</span><span class="font-medium">Convert to Code</span>
    </button>
  </div>` : ''
```

In `thread.delegation.js` `_onClick()`, add handler:
```javascript
const aiActionBtn = _closest(t, "[data-action='thread-ai-action']");
if (aiActionBtn) {
  const msgId  = Number(aiActionBtn.dataset.messageId);
  const action = aiActionBtn.dataset.aiAction;
  _closeOptionsSheet();
  
  // "translate" needs language selection — show a quick prompt
  if (action === 'translate') {
    const lang = window.prompt('Translate to which language?', 'Spanish');
    if (!lang) return;
    import('./thread.init.js').then(({ socket }) => {
      socket?.emit('thread_ai_action', {
        token: api.getToken(),
        thread_id: threadState.activeThreadId,
        message_id: msgId,
        action,
        target_lang: lang,
      });
    });
  } else {
    import('./thread.init.js').then(({ socket }) => {
      socket?.emit('thread_ai_action', {
        token: api.getToken(),
        thread_id: threadState.activeThreadId,
        message_id: msgId,
        action,
      });
    });
  }
  showToast('Asking Learnora…', 'info');
  return;
}
```

In `thread.constants.js`, add:
```javascript
THREAD_WS.AI_ACTION = "thread_ai_action";   // client → server
```

In `thread.websocket.js`, register the `learnora_thinking` handler (already exists) — no new client-side handler needed since the result arrives as `new_thread_message` with `is_ai_response=true` and `reply_to_id` set.

**Cost implications:** Each action call = 1 LLM completion. The same `provider_manager` rate-limiting applies. The `_is_rate_limited()` per-user bucket in the WS manager is on `send_thread_message`, not on AI actions. Add a separate in-memory rate limiter: max 10 AI actions per user per 60 seconds, tracked in `_ai_action_buckets: dict[int, list[float]]`.

---

### 4.2 Multiple AI Personalities

**Architecture decision:** Use a module-level configuration dict rather than a DB table for MVP. This avoids a migration and is fully runtime-configurable. The DB table is the Phase 2 upgrade path.

#### Backend Design

```python
# websocket_threads.py — replace LEARNORA_TRIGGERS constant block

# ── AI Personality Registry ────────────────────────────────────────────────────
# Each personality:
#   trigger     : the @mention text (lowercased, without @)
#   display_name: name shown as message sender
#   system_prompt: replaces the default Learnora system prompt
#   bot_user_id : can all point to the same bot user; display_name overrides UI name
#
# To add a new personality: append an entry. No code change needed elsewhere
# because the trigger-detection loop iterates this list.

AI_PERSONALITIES: dict[str, dict] = {
    "learnora": {
        "trigger":       "@learnora",
        "display_name":  "Learnora",
        "system_prompt": (
            "You are Learnora, a helpful AI study assistant. "
            "Be concise (2-4 sentences unless detail is requested). "
            "You are one participant among students — be helpful, not lecture-heavy."
        ),
        "bot_user_id":   None,  # falls back to app.config["LEARNORA_BOT_USER_ID"]
    },
    "teacherai": {
        "trigger":       "@teacherai",
        "display_name":  "TeacherAI",
        "system_prompt": (
            "You are TeacherAI, a patient and thorough educator. "
            "Structure your explanations clearly: first explain the concept, "
            "then give an example, then check for understanding. "
            "Never rush. Depth is preferred over brevity."
        ),
        "bot_user_id":   None,
    },
    "coderai": {
        "trigger":       "@coderai",
        "display_name":  "CoderAI",
        "system_prompt": (
            "You are CoderAI, a senior software engineer. "
            "Always respond with working code examples wrapped in code blocks. "
            "Prefer modern, idiomatic patterns. "
            "If multiple languages apply, ask which is preferred or show the most common one."
        ),
        "bot_user_id":   None,
    },
    "productai": {
        "trigger":       "@productai",
        "display_name":  "ProductAI",
        "system_prompt": (
            "You are ProductAI, a product manager with startup experience. "
            "Think in terms of user problems, not technical solutions. "
            "Give structured answers: Problem → Solution → Trade-offs → Recommendation."
        ),
        "bot_user_id":   None,
    },
    "funnyai": {
        "trigger":       "@funnyai",
        "display_name":  "FunnyAI",
        "system_prompt": (
            "You are FunnyAI. You explain academic concepts using humor, analogies, "
            "and pop culture references. Keep it educational but entertaining. "
            "Every response should include at least one (appropriate) joke or analogy."
        ),
        "bot_user_id":   None,
    },
}

# Build trigger lookup: "@teacherai" → personality dict
_TRIGGER_MAP: dict[str, dict] = {
    p["trigger"]: p for p in AI_PERSONALITIES.values()
}
LEARNORA_TRIGGERS = list(_TRIGGER_MAP.keys())  # backward compat for "any(t in lower...)"
```

Modify `send_thread_message` handler trigger section:

```python
# Replace the existing ai_triggered / daemon thread block:

lower        = text_content.lower()
matched_personality = None
for trigger, personality in _TRIGGER_MAP.items():
    if trigger in lower:
        matched_personality = personality
        break

if matched_personality:
    self.broadcast_to_thread(thread_id, "learnora_thinking", {
        "thread_id":    thread_id,
        "personality":  matched_personality["display_name"],
    })
    app_ref = current_app._get_current_object()
    t = threading.Thread(
        target=_call_learnora_for_thread,
        args=(app_ref, thread_id, text_content, user_id, matched_personality),
        daemon=True
    )
    t.start()
```

Modify `_call_learnora_for_thread` signature:

```python
def _call_learnora_for_thread(
    app, thread_id: int, trigger_text: str,
    triggering_user_id: int,
    personality: dict = None               # ← NEW
) -> None:
```

Inside the function, replace the inline system prompt:

```python
# Replace the hardcoded system = "You are Learnora..." block:

personality = personality or AI_PERSONALITIES["learnora"]
base_system = personality["system_prompt"]

system = (
    f"{base_system} "
    f"Thread title: \"{thread.title}\". "
)
if thread.department:
    system += f"Department: {thread.department}. "
if thread.tags:
    system += f"Topics: {', '.join(thread.tags)}. "

# Mode-specific overrides still apply (summarize / quiz)
lower = trigger_text.lower()
if "@learnora summarize" in lower or "summarize" in lower:
    system += " The user wants a concise bullet-point summary of what was discussed."
elif "@learnora quiz" in lower or "quiz" in lower:
    system += " Generate exactly 3 short comprehension questions. Number them 1, 2, 3."
```

**Phase 2 (DB-backed personalities):**

```sql
CREATE TABLE ai_personalities (
    id           SERIAL PRIMARY KEY,
    key          VARCHAR(50)  UNIQUE NOT NULL,  -- "coderai"
    trigger_word VARCHAR(50)  UNIQUE NOT NULL,  -- "@coderai"
    display_name VARCHAR(100) NOT NULL,
    system_prompt TEXT        NOT NULL,
    avatar_url   VARCHAR(300),
    bot_user_id  INTEGER REFERENCES users(id),
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Frontend Changes

In `thread.templates.js` `typingIndicatorTemplate()` (and the inline Learnora indicator in `thread.render.js`), use the personality name:

The `learnora_thinking` payload now includes `personality` field. Update `showLearnoraBotTyping` to accept and display the personality name:

```javascript
// thread.render.js
export function showLearnoraBotTyping(personalityName = 'Learnora') {
  // ...
  container.insertAdjacentHTML('beforeend', `
    <div id="thread-learnora-typing" ...>
      ...
      <span class="text-xs text-violet-600">${esc(personalityName)} is thinking…</span>
    </div>`);
}
```

In `thread.websocket.js`, update the `LEARNORA_THINKING` handler:
```javascript
_threadHandlers[THREAD_WS.LEARNORA_THINKING] = (data) => {
  import('./thread.render.js').then(({ showLearnoraBotTyping }) => {
    showLearnoraBotTyping(data.personality ?? 'Learnora');
  });
};
```

In `thread.templates.js` `threadMessageTemplate()`, use `sender.name` for the AI badge label (which will now show "TeacherAI", "CoderAI" etc.) — this already works if `broadcast_ai_message` fetches the bot user's `name` column. If all personalities share one bot user, the name stored in the DB won't differentiate them. 

**Resolution:** `broadcast_ai_message` should use `personality["display_name"]` from the message or a new `ThreadMessage.ai_personality` column, rather than looking up the bot user's `name`. See Database Changes section.

---

### 4.3 AI Meeting Notes

**Feature:** User requests a structured summary of recent thread activity. Output includes: Topics Discussed, Decisions Made, Action Items, Open Questions.

#### Backend Design

New REST endpoint (not WebSocket — this is a one-time pull operation, not real-time):

```python
# threads.py

@threads_bp.route("/threads/<int:thread_id>/meeting-notes", methods=["POST"])
@token_required
def generate_meeting_notes(current_user, thread_id):
    """
    Generate AI meeting notes for recent thread activity.
    
    Body: { "message_range": 50 }   (50 | 100 | 500, default 50)
    """
    membership = ThreadMember.query.filter_by(
        thread_id=thread_id, student_id=current_user.id
    ).first()
    if not membership:
        return error_response("Not a member", 403)
    
    thread = Thread.query.get(thread_id)
    if not thread:
        return error_response("Thread not found", 404)
    
    data          = request.get_json(silent=True) or {}
    message_range = int(data.get("message_range", 50))
    message_range = min(max(message_range, 10), 500)  # clamp 10–500
    
    messages = (
        ThreadMessage.query
        .filter_by(thread_id=thread_id, is_deleted=False)
        .order_by(ThreadMessage.sent_at.desc())
        .limit(message_range)
        .all()
    )
    messages.reverse()
    
    if len(messages) < 3:
        return error_response("Not enough messages to summarize (minimum 3)")
    
    # Build conversation text
    lines = []
    for m in messages:
        sender = User.query.get(m.sender_id)
        name   = "Learnora" if m.is_ai_response else (sender.name if sender else "Unknown")
        lines.append(f"[{name}]: {m.text_content}")
    conversation = "\n".join(lines)
    
    system = """You are a meeting notes assistant. 
Analyze the conversation and return a JSON object with exactly these keys:
{
  "topics_discussed": ["topic1", "topic2"],
  "decisions_made":   ["decision1"],
  "action_items":     ["action1"],
  "open_questions":   ["question1"],
  "summary":          "1-2 sentence overall summary"
}
Return ONLY the JSON. No markdown, no explanation."""

    user_prompt = f"""Thread: "{thread.title}"
Last {message_range} messages:

{conversation}"""
    
    try:
        from learnora import provider_manager, _call_provider_sync
        provider = provider_manager.get_working_provider(needs_vision=False)
        if not provider:
            return error_response("AI service unavailable", 503)
        
        ai_response = _call_provider_sync(
            [{"role":"system","content":system},
             {"role":"user","content":user_prompt}],
            provider
        )
        
        import json as _json
        clean = ai_response.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        notes = _json.loads(clean)
        
    except Exception as e:
        current_app.logger.error(f"Meeting notes AI error: {e!r}")
        return error_response("Failed to generate meeting notes")
    
    # Persist (optional but recommended)
    note = ThreadMeetingNote(
        thread_id       = thread_id,
        created_by      = current_user.id,
        message_range   = message_range,
        message_count   = len(messages),
        notes_json      = notes,
        created_at      = datetime.datetime.utcnow()
    )
    db.session.add(note)
    db.session.commit()
    
    return jsonify({
        "status": "success",
        "data": {
            "notes":           notes,
            "message_count":   len(messages),
            "message_range":   message_range,
            "note_id":         note.id,
            "generated_at":    note.created_at.isoformat()
        }
    })


@threads_bp.route("/threads/<int:thread_id>/meeting-notes", methods=["GET"])
@token_required
def get_meeting_notes(current_user, thread_id):
    """Get previously generated meeting notes."""
    membership = ThreadMember.query.filter_by(
        thread_id=thread_id, student_id=current_user.id
    ).first()
    if not membership:
        return error_response("Not a member", 403)
    
    limit = min(int(request.args.get("limit", 5)), 20)
    notes = (
        ThreadMeetingNote.query
        .filter_by(thread_id=thread_id)
        .order_by(ThreadMeetingNote.created_at.desc())
        .limit(limit)
        .all()
    )
    
    return jsonify({
        "status": "success",
        "data": {
            "notes": [
                {
                    "id":            n.id,
                    "notes_json":    n.notes_json,
                    "message_count": n.message_count,
                    "message_range": n.message_range,
                    "created_by":    n.created_by,
                    "created_at":    n.created_at.isoformat()
                }
                for n in notes
            ]
        }
    })
```

#### Frontend Design

Add a "Meeting Notes" button to the thread header (alongside search, pin, info buttons):

```html
<!-- In thread.render.js renderThreadHeader(), add to action buttons row: -->
<button data-action="thread-meeting-notes" title="Meeting Notes"
        class="w-9 h-9 rounded-full flex items-center justify-center text-gray-400
               hover:text-emerald-600 hover:bg-emerald-50 transition-colors text-base">
  📋
</button>
```

Add `generateMeetingNotes(threadId, range)` to `thread.api.js`:
```javascript
export async function generateMeetingNotes(threadId, messageRange = 50) {
  const res = await api.post(THREAD_API.MEETING_NOTES(threadId), { message_range: messageRange });
  return res.data ?? res;
}
```

Add `THREAD_API.MEETING_NOTES = (tid) => /threads/${tid}/meeting-notes` to constants.

In `thread.modals.js`, add `openMeetingNotesModal(notes)` that renders the structured JSON with collapsible sections for Topics, Decisions, Action Items, Open Questions.

In `thread.delegation.js`, add click handler for `[data-action='thread-meeting-notes']` that opens a range-picker dialog (50 / 100 / 500) then calls the API.

---

### 4.4 AI Knowledge Detection

**Feature:** `@learnora who knows the most about databases here?`

#### Backend Design

Detect query pattern in `_call_learnora_for_thread`. When trigger text contains "who knows" or "who is best at" or "expert in", activate knowledge-detection mode:

```python
# In _call_learnora_for_thread(), add after system prompt construction:

knowledge_query_keywords = ["who knows", "who is best", "who understands", "expert in", "who can help with"]
is_knowledge_query = any(kw in trigger_text.lower() for kw in knowledge_query_keywords)

if is_knowledge_query:
    # Fetch all thread messages (or last 200 for performance)
    all_messages = (
        ThreadMessage.query
        .filter_by(thread_id=thread_id, is_deleted=False, is_ai_response=False)
        .order_by(ThreadMessage.sent_at.desc())
        .limit(200)
        .all()
    )
    
    # Build per-member message digest
    member_digests = {}
    for msg in all_messages:
        sender = User.query.get(msg.sender_id)
        if not sender:
            continue
        if sender.id not in member_digests:
            member_digests[sender.id] = {
                "name":     sender.name,
                "username": sender.username,
                "messages": []
            }
        member_digests[sender.id]["messages"].append(msg.text_content[:200])
    
    member_summary = "\n\n".join([
        f"Member: {v['name']} (@{v['username']})\n"
        f"Recent contributions ({len(v['messages'])} messages):\n"
        + "\n".join(f"  - {m}" for m in v["messages"][:15])
        for v in member_digests.values()
    ])
    
    system = (
        "You are Learnora analyzing a study group's contribution history. "
        "Based on the messages each member has written, identify who demonstrates "
        "the strongest knowledge about the topic being asked about. "
        "Be specific and reference actual content from their messages. "
        "Format: '**@username** seems most knowledgeable about X because...'"
    )
    
    messages = [
        {"role": "system",  "content": system},
        {"role": "user",    "content": f"Question: {trigger_text}\n\nMember activity:\n{member_summary}"},
    ]
    # Proceed with normal _call_provider_sync
```

No database changes needed. This is pure LLM analysis over existing message data.

**Performance note:** 200 messages × 200 chars = ~40,000 chars of context. Within standard LLM context windows. Do not fetch more than 500 messages without checking provider context limits.

---

### 4.5 AI Fact Checking

**Feature:** Long-press any user message → "Fact Check" option.

#### Backend Design

Reuse `thread_ai_action` WebSocket event with `action="fact_check"`:

```python
# In ACTION_PROMPTS dict inside _call_learnora_action():
"fact_check": (
    "You are a fact-checking assistant. Analyze the following statement and respond with:\n"
    "1. **Verdict**: Accurate / Mostly Accurate / Uncertain / Likely Inaccurate / False\n"
    "2. **Confidence**: High / Medium / Low\n"
    "3. **Analysis**: 2-3 sentences explaining your assessment\n"
    "4. **Caveats**: Any important context the reader should know\n\n"
    "Be honest about uncertainty. Do not claim certainty you don't have. "
    "If the claim is subjective or opinion-based, say so."
),
```

#### Frontend Design

In `_openOptionsSheet()` in `thread.delegation.js`, show "Fact Check" for non-AI, non-deleted messages with text content:

```javascript
!isOwn && !isDeleted && hasText ? `
  <button class="${btnCls} text-blue-600 hover:bg-blue-50"
    data-action="thread-ai-action" data-message-id="${messageId}" data-ai-action="fact_check">
    <span class="text-xl w-7 text-center">🔍</span><span class="font-medium">Fact Check</span>
  </button>` : ''
```

Note: Show on others' messages (fact-checking your own message is redundant).

**False positive risk:** The AI may incorrectly flag correct statements. The system prompt explicitly requests confidence levels and caveats to mitigate this. The rendered AI reply (with `reply_to_id` pointing at the fact-checked message) will be visible to all members — this is desirable transparency.

---

### 4.6 Automatic AI Replies (When Replying to an AI Message)

**Feature:** If a user sends a message with `reply_to_id` pointing to an AI message, automatically trigger the AI to continue the conversation.

#### Backend Design

In `send_thread_message` WS handler, after the message is persisted and before the broadcast, add:

```python
# After db.session.commit(), before broadcast:

# Auto-reply trigger: user replied directly to an AI message
if reply_to_id and not ai_triggered:
    parent_msg = ThreadMessage.query.filter_by(
        id=reply_to_id, is_ai_response=True, is_deleted=False
    ).first()
    
    if parent_msg:
        # Rate limit: max 3 auto-AI-replies per user per thread per 5 minutes
        _auto_reply_key = (user_id, thread_id)
        _auto_reply_bucket = _auto_reply_buckets.get(_auto_reply_key, [])
        _now = time.monotonic()
        _auto_reply_bucket = [t for t in _auto_reply_bucket if _now - t < 300]
        
        if len(_auto_reply_bucket) < 3:
            _auto_reply_bucket.append(_now)
            _auto_reply_buckets[_auto_reply_key] = _auto_reply_bucket
            
            # Use default Learnora personality
            personality = AI_PERSONALITIES.get("learnora")
            
            self.broadcast_to_thread(thread_id, "learnora_thinking", {
                "thread_id": thread_id,
                "personality": personality["display_name"],
            })
            
            auto_trigger_text = text_content
            app_ref = current_app._get_current_object()
            t = threading.Thread(
                target=_call_learnora_for_thread,
                args=(app_ref, thread_id, auto_trigger_text, user_id, personality, msg.id),
                daemon=True
            )
            t.start()
```

Add module-level: `_auto_reply_buckets: dict[tuple, list[float]] = {}`

Modify `_call_learnora_for_thread` to accept optional `reply_to_message_id`:

```python
def _call_learnora_for_thread(
    app, thread_id, trigger_text, triggering_user_id,
    personality=None, reply_to_message_id=None   # ← NEW
):
    ...
    bot_msg = ThreadMessage(
        ...
        reply_to_id = reply_to_message_id,   # ← use when auto-replying
        ...
    )
```

**Loop prevention:** The auto-reply check is `if reply_to_id and not ai_triggered` — meaning explicitly mentioning `@learnora` takes precedence and no double-trigger occurs. The AI's own messages have `sender_id=bot_user_id` so the `send_thread_message` handler will never process them (AI messages come from `_call_learnora_for_thread`, not the WS handler). Rate limit (3 per 5 min) prevents conversation loops.

---

### 4.7 AI Thread History Search

**Feature:** `@learnora when did we discuss Supabase RLS?`

#### Backend Design

Detect search intent in `_call_learnora_for_thread`:

```python
search_keywords = ["when did we", "when was", "find message", "search for", "who said", "what was said about"]
is_history_search = any(kw in trigger_text.lower() for kw in search_keywords)

if is_history_search:
    # Extract the search term using a lightweight regex or just pass to LLM
    search_query = trigger_text.lower()
    for trigger in LEARNORA_TRIGGERS:
        search_query = search_query.replace(trigger, "").strip()
    for kw in search_keywords:
        search_query = search_query.replace(kw, "").strip()
    search_query = search_query.strip("?").strip()
    
    # Use existing DB text search
    matching_messages = (
        ThreadMessage.query
        .filter(
            ThreadMessage.thread_id == thread_id,
            ThreadMessage.is_deleted == False,
            ThreadMessage.text_content.ilike(f"%{search_query}%")
        )
        .order_by(ThreadMessage.sent_at.desc())
        .limit(10)
        .all()
    )
    
    if not matching_messages:
        # No DB results — tell LLM to say it wasn't found
        context_text = f"No messages found containing '{search_query}'."
    else:
        results_text = []
        for m in matching_messages:
            sender = User.query.get(m.sender_id)
            name   = sender.name if sender else "Unknown"
            date   = m.sent_at.strftime("%b %d, %Y at %H:%M")
            results_text.append(f"[{date}] {name}: {m.text_content[:300]}")
        context_text = "Found these relevant messages:\n" + "\n\n".join(results_text)
    
    system = (
        "You are Learnora helping a student find information in their thread history. "
        "Use the search results provided to answer the question. "
        "Always cite the date and person who said something. "
        "If no relevant messages were found, say so clearly."
    )
    
    messages = [
        {"role": "system",  "content": system},
        {"role": "user",    "content": f"Question: {trigger_text}\n\nSearch results:\n{context_text}"},
    ]
```

**Vector database:** Not recommended for MVP. The existing `ilike` SQL search covers most practical cases in a study thread context. Add vector search (pgvector or Pinecone) only if search quality is demonstrably poor after real user testing.

---

### 4.8 AI Reply Relationships

This is addressed in 4.6 (auto-reply sets `reply_to_id`) and 4.1 (`_call_learnora_action` always sets `reply_to_id` to the source message). The `reply_to_id` field already exists on `ThreadMessage`. No schema change needed.

The existing `_build_message_payload()` and `serialize_message()` already include `reply_preview` when `reply_to_id` is set. The frontend `threadMessageTemplate()` already renders the reply preview bubble. This works for AI replies as-is.

---

## 5. UX Improvements

### 5.1 Swipe-to-Reply

**Feature:** Swipe right on a message to instantly trigger reply — skip the options sheet.

#### Design

Create a new module `thread.swipe.js` (do not add to `thread.longpress.js` — separate concerns):

```javascript
// thread.swipe.js

const SWIPE_THRESHOLD    = 60;   // px right to trigger reply
const SWIPE_MAX_VERTICAL = 20;   // cancel if vertical movement exceeds this
const SWIPE_FEEDBACK_MAX = 50;   // max visual shift in px

export function attachThreadSwipe(listEl) {
  listEl.addEventListener('touchstart',  _onSwipeTouchStart,  { passive: true });
  listEl.addEventListener('touchmove',   _onSwipeTouchMove,   { passive: false });
  listEl.addEventListener('touchend',    _onSwipeTouchEnd,    { passive: true });
  listEl.addEventListener('touchcancel', _onSwipeTouchCancel, { passive: true });
}

let _swipeEl   = null;
let _swipeStartX = 0, _swipeStartY = 0;
let _swipeDeltaX = 0;
let _swipeCancelled = false;

function _onSwipeTouchStart(e) {
  const msgEl = e.target.closest('[data-message-id]');
  if (!msgEl || msgEl.classList.contains('message-deleted')) return;
  
  _swipeEl    = msgEl;
  _swipeStartX    = e.touches[0].clientX;
  _swipeStartY    = e.touches[0].clientY;
  _swipeDeltaX    = 0;
  _swipeCancelled = false;
}

function _onSwipeTouchMove(e) {
  if (!_swipeEl || _swipeCancelled) return;
  
  const dx = e.touches[0].clientX - _swipeStartX;
  const dy = Math.abs(e.touches[0].clientY - _swipeStartY);
  
  if (dy > SWIPE_MAX_VERTICAL) { _cancelSwipe(); return; }
  if (dx < 5) return;   // Only rightward swipes
  
  _swipeDeltaX = dx;
  const shift = Math.min(dx * 0.6, SWIPE_FEEDBACK_MAX);
  
  // Visual feedback: translate the bubble column right
  const bubble = _swipeEl.querySelector('.msg-bubble-col');
  if (bubble) {
    bubble.style.transform  = `translateX(${shift}px)`;
    bubble.style.transition = 'none';
  }
  
  // Show reply icon once threshold is close
  if (dx > SWIPE_THRESHOLD * 0.7) {
    _showSwipeReplyHint(_swipeEl);
  }
  
  // Prevent scroll while swiping
  if (dx > 15) e.preventDefault();
}

function _onSwipeTouchEnd() {
  if (!_swipeEl || _swipeCancelled) return;
  
  const triggered = _swipeDeltaX >= SWIPE_THRESHOLD;
  _resetSwipeEl(_swipeEl, triggered);
  
  if (triggered) {
    const messageId = Number(_swipeEl.dataset.messageId);
    if (messageId) {
      navigator.vibrate?.(15);
      import('./thread.events.js').then(({ handleReply }) => handleReply(messageId));
    }
  }
  
  _swipeEl = null;
}

function _cancelSwipe() {
  _swipeCancelled = true;
  if (_swipeEl) _resetSwipeEl(_swipeEl, false);
}

function _onSwipeTouchCancel() { _cancelSwipe(); }

function _resetSwipeEl(el, triggered) {
  const bubble = el?.querySelector('.msg-bubble-col');
  if (!bubble) return;
  bubble.style.transition = 'transform 0.2s ease-out';
  bubble.style.transform  = 'translateX(0)';
  setTimeout(() => { bubble.style.transition = ''; }, 210);
  _removeSwipeReplyHint(el);
}

function _showSwipeReplyHint(el) {
  if (el.querySelector('.swipe-reply-hint')) return;
  const hint = document.createElement('div');
  hint.className = 'swipe-reply-hint absolute left-1 top-1/2 -translate-y-1/2 ' +
                   'w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 ' +
                   'flex items-center justify-center text-sm animate-fade-in z-10';
  hint.textContent = '↩';
  el.style.position = 'relative';
  el.appendChild(hint);
}

function _removeSwipeReplyHint(el) {
  el?.querySelector('.swipe-reply-hint')?.remove();
}
```

In `thread.init.js`, import and attach:
```javascript
import { attachThreadSwipe } from './thread.swipe.js';
// In threadInit(), after attachThreadLongPress(listEl):
attachThreadSwipe(listEl);
```

**Desktop strategy:** On desktop, show a `↩` button on message hover (to the left for others' messages, right side for own). This button already exists conceptually as the "Reply" option in the options sheet — add it as a hover-reveal quick-action button alongside `msg-options-btn`.

In `thread.templates.js` `threadMessageTemplate()`, add a quick-reply button:
```javascript
const quickReplyBtn = !isMine && !message.is_deleted && hasId
  ? `<button class="msg-quick-reply-btn absolute right-0 translate-x-full top-0
                     w-7 h-7 rounded-full bg-white shadow-sm border border-gray-200
                     text-gray-500 hover:text-indigo-600 flex items-center justify-center
                     text-xs select-none"
             data-action="thread-reply"
             data-message-id="${message.id}"
             aria-label="Reply">↩</button>`
  : '';
```

CSS in `threads.html`:
```css
@media (min-width: 768px) {
  .msg-quick-reply-btn {
    opacity: 0;
    transition: opacity 0.15s;
  }
  .group:hover .msg-quick-reply-btn {
    opacity: 1;
  }
}
@media (max-width: 767px) {
  .msg-quick-reply-btn { display: none !important; }
}
```

---

### 5.2 Mention Highlighting

**Feature:** `@username` and `@learnora` appear visually distinct in rendered messages.

#### Implementation

This requires modifying how `text_content` is rendered in `thread.templates.js`. The challenge is safely escaping HTML while converting mentions to styled spans.

Create a helper function in `thread.templates.js`:

```javascript
/**
 * Render message text with @mention highlighting.
 * Security: escapes ALL content, then applies mention spans.
 * The mention pattern only matches word characters — no XSS vector.
 */
function _renderMessageText(text) {
  if (!text) return '';
  
  // Step 1: Split on @mention pattern, preserving delimiters
  const parts = text.split(/(@[a-zA-Z0-9_]{1,30})/g);
  
  return parts.map((part) => {
    if (/^@[a-zA-Z0-9_]{1,30}$/.test(part)) {
      const username = esc(part.slice(1));   // without @
      const isBot    = username.toLowerCase() === 'learnora' ||
                       username.toLowerCase() === 'teacherai' ||
                       username.toLowerCase() === 'coderai'   ||
                       username.toLowerCase() === 'productai' ||
                       username.toLowerCase() === 'funnyai';
      const colorCls = isBot
        ? 'text-violet-700 bg-violet-100'
        : 'text-indigo-700 bg-indigo-100';
      return `<span class="mention font-semibold rounded px-0.5 ${colorCls}" data-mention="${username}">@${username}</span>`;
    }
    return esc(part);
  }).join('');
}
```

In `threadMessageTemplate()`, replace:
```javascript
// Before:
const textHtml = message.is_deleted
  ? `<span class="msg-text italic opacity-50 text-sm">[deleted]</span>`
  : message.text_content
    ? `<span class="msg-text text-sm leading-relaxed break-words whitespace-pre-wrap">${esc(message.text_content)}</span>`
    : "";

// After:
const textHtml = message.is_deleted
  ? `<span class="msg-text italic opacity-50 text-sm">[deleted]</span>`
  : message.text_content
    ? `<span class="msg-text text-sm leading-relaxed break-words">${_renderMessageText(message.text_content)}</span>`
    : "";
```

Note: Remove `whitespace-pre-wrap` from the span — the `_renderMessageText` output contains HTML spans, and `whitespace-pre-wrap` will preserve literal newlines correctly but mixed with inline spans can cause layout issues. Test with multi-line messages.

Also update `renderMessageEdit()` in `thread.render.js` to use the same rendering:
```javascript
if (textEl) textEl.innerHTML = _renderMessageText(newText);
```

Import `_renderMessageText` or move it to a shared utility module.

**Security:** The regex `/^@[a-zA-Z0-9_]{1,30}$/` only matches alphanumeric + underscore. The non-mention parts go through `esc()`. The `data-mention` attribute uses the already-escaped username. No XSS risk.

---

### 5.3 Mention Detection Bug Fix

See Section 3 — Bug 1. This is a pre-requisite for all mention functionality.

Summary of fix: add `username` to every `setMember()` call:
- `thread.events.js` `handleOpenThread()` line where `members.forEach(m => setMember(...))`
- `thread.websocket.js` `MEMBER_JOINED` handler where `setMember(data.user.id, {...})`

Verify the `MEMBER_JOINED` payload from `approve_join_request` and `accept_thread_invite` includes `username`. Confirmed it does (see `broadcast_to_thread(thread_id, "thread_member_joined", {"user": {"id":..., "username":..., ...}})`).

---

## 6. Attachment System Refinements

### 6.1 Upload Preview Redesign

**Current state:** Small text chips with filename in `_renderAttachmentStrip()` inside `thread.delegation.js`. No thumbnails, no progress, no visual hierarchy.

#### Redesign

Replace `_renderAttachmentStrip()`:

```javascript
function _renderAttachmentStrip(attachments) {
  const strip = document.getElementById('thread-attachment-strip');
  if (!strip) return;

  if (!attachments?.length) {
    strip.innerHTML = '';
    strip.classList.add('hidden');
    return;
  }

  strip.classList.remove('hidden');
  strip.className = 'flex gap-2 px-3 pt-2.5 overflow-x-auto scrollbar-thin flex-nowrap';

  strip.innerHTML = attachments.map((att, idx) => {
    const isImage = att.type?.startsWith('image/');
    const sizeKb  = Math.round((att.size ?? 0) / 1024);
    const objUrl  = att.previewUrl ?? '';   // created below

    const preview = isImage && objUrl
      ? `<img src="${_escAttr(objUrl)}" class="w-full h-full object-cover rounded-lg" alt="${_esc(att.name)}">`
      : `<div class="flex flex-col items-center justify-center w-full h-full gap-1">
           <span class="text-2xl">${_fileEmoji(att.type)}</span>
           <span class="text-[10px] text-gray-500 font-medium text-center leading-tight px-1 truncate w-full">
             ${_esc(att.name.split('.').pop().toUpperCase())}
           </span>
         </div>`;

    return `
      <div class="relative flex-shrink-0 w-20 h-20 rounded-xl border-2 border-gray-200
                  bg-gray-50 overflow-hidden group"
           data-attach-index="${idx}">
        ${preview}
        <!-- Upload progress overlay (hidden until upload starts) -->
        <div class="attach-progress hidden absolute inset-0 bg-black/40 rounded-xl
                    flex items-center justify-center">
          <div class="w-10 h-10 rounded-full border-2 border-white/30 border-t-white
                      animate-spin"></div>
        </div>
        <!-- Remove button -->
        <button data-action="thread-remove-attachment"
                data-attach-index="${idx}"
                class="absolute top-1 right-1 w-5 h-5 rounded-full bg-gray-900/70
                       text-white flex items-center justify-center text-[10px]
                       opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                aria-label="Remove">✕</button>
        <!-- Size badge -->
        <div class="absolute bottom-1 left-1 text-[9px] text-white bg-black/50
                    rounded px-1 leading-tight">${sizeKb}K</div>
      </div>`;
  }).join('');
}

function _fileEmoji(mimeType) {
  if (!mimeType) return '📎';
  if (mimeType.startsWith('video/'))  return '🎬';
  if (mimeType.includes('pdf'))       return '📄';
  if (mimeType.includes('word'))      return '📝';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📋';
  if (mimeType.startsWith('text/'))   return '📃';
  return '📎';
}
```

**Image preview URLs:** When adding files to `pendingAttachments`, generate object URLs:

In the file input `change` handler:
```javascript
for (const file of files) {
  const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
  valid.push({ file, name: file.name, type: file.type, size: file.size, previewUrl });
}
```

**Important:** Revoke object URLs after send or removal to prevent memory leaks:
```javascript
// In handleSendMessage() after send:
(threadState.pendingAttachments ?? []).forEach((att) => {
  if (att.previewUrl) URL.revokeObjectURL(att.previewUrl);
});
```

Also revoke when individual attachment is removed (`thread-remove-attachment` handler).

**Upload progress:** The current `api.post()` uses `fetch` without progress. For the attachment upload specifically, swap to XHR in `uploadAttachment()`:

```javascript
// thread.api.js — replace uploadAttachment with XHR version
export function uploadAttachment(threadId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    
    const xhr = new XMLHttpRequest();
    xhr.open('POST', THREAD_API.UPLOAD(threadId));
    xhr.setRequestHeader('Authorization', `Bearer ${api.getToken()}`);
    
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data.data ?? data);
        else reject(new Error(data.message ?? 'Upload failed'));
      } catch { reject(new Error('Upload response parse error')); }
    };
    
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(form);
  });
}
```

In `handleSendMessage()` in `thread.events.js`, wire progress to the DOM:

```javascript
for (let i = 0; i < pendingAtts.length; i++) {
  const att = pendingAtts[i];
  const progressFn = (pct) => _updateAttachmentProgress(i, pct);
  const result = await uploadAttachment(threadState.activeThreadId, att.file, progressFn);
  attachmentResults.push({ ... });
}
```

Where `_updateAttachmentProgress(idx, pct)` finds the card at `data-attach-index="${idx}"` and animates the progress overlay.

---

### 6.2 Attachment Gallery (+X Truncation)

**Current state:** `_buildAttachmentHtml()` in `thread.templates.js` renders all attachments. No inline truncation.

#### Change

In `_buildAttachmentHtml()`, cap inline image display at 2:

```javascript
function _buildAttachmentHtml(message, isMine) {
  if (message.is_deleted) return '';
  
  const attachments = /* existing logic to build array */;
  if (!attachments.length) return '';
  
  const INLINE_MAX = 2;
  const images = attachments.filter(a => a.attachment_type === 'image');
  const others  = attachments.filter(a => a.attachment_type !== 'image');
  
  let html = '';
  
  const visibleImages = images.slice(0, INLINE_MAX);
  const hiddenCount   = images.length - visibleImages.length + 
                        (images.length <= INLINE_MAX ? 0 : 0);  // all hidden images
  
  // Show max 2 images; if more exist, show +N overlay on the 2nd
  if (visibleImages.length === 1) {
    html += `<div class="mb-1.5">${_renderAttachmentItem(visibleImages[0], isMine, false)}</div>`;
  } else if (visibleImages.length >= 2) {
    const extraCount = images.length - INLINE_MAX;
    const secondItem = `
      <div class="relative">
        ${_renderAttachmentItem(visibleImages[1], isMine, true)}
        ${extraCount > 0
          ? `<button class="absolute inset-0 flex items-center justify-center
                            bg-black/50 rounded-lg text-white text-lg font-bold
                            hover:bg-black/60 transition-colors"
                     data-action="thread-open-attachments"
                     aria-label="${extraCount} more attachments">
               +${extraCount}
             </button>`
          : ''}
      </div>`;
    html += `<div class="grid grid-cols-2 gap-1 mb-1 max-w-[220px]">
      ${_renderAttachmentItem(visibleImages[0], isMine, true)}
      ${secondItem}
    </div>`;
  }
  
  // Other file types always shown inline
  others.forEach(a => {
    html += `<div class="mb-1">${_renderAttachmentItem(a, isMine, false)}</div>`;
  });
  
  return html;
}
```

The `data-action="thread-open-attachments"` click handler already exists in `thread.delegation.js` and routes to `handleOpenAttachments()` which opens the full gallery. No additional handler needed.

---

### 6.3 Attachment Saving

**Current state:** Gallery links use `target="_blank"` and have `download` attribute on anchor tags. This works for files served from Cloudinary.

**Gap:** No download button on individual inline message attachments.

#### Change

In `_renderAttachmentItem()` in `thread.templates.js`, add a download overlay for images:

```javascript
if (aType === 'image') {
  return `
    <div class="relative group/img">
      <a href="${aUrl}" target="_blank" rel="noopener noreferrer">
        <img src="${aUrl}" class="msg-attachment-image ${imgCls}" loading="lazy" alt="${aName}">
      </a>
      <a href="${aUrl}" download="${aName}" target="_blank" rel="noopener noreferrer"
         class="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-lg bg-black/50 text-white
                flex items-center justify-center text-xs opacity-0 group-hover/img:opacity-100
                transition-opacity hover:bg-black/70"
         aria-label="Download ${aName}" title="Download">
        ⬇
      </a>
    </div>`;
}
```

For documents, the existing `<a href download>` anchor already provides saving.

**Mobile note:** On iOS, `download` attribute on `<a>` tags pointing to cross-origin URLs (Cloudinary) may not trigger file save — the file opens in Safari instead. No workaround without a server-side download proxy. Document this limitation.

---

## 7. Invites System Overhaul

### 7.1 Three-Section Invites Tab

**Current state:** Invites tab shows only `GET /threads/invites` (invites sent to me). Two other workflows exist in the API (`/threads/my-requests`, `/threads/pending-requests`) but have no tab UI.

#### New Tab Structure

Replace single flat list with three accordion sections:

```
Invites Tab
├── 📬 Invitations (N)     — threads others invited me to
│   └── [Accept] [Decline]
├── 📤 My Requests (N)     — join requests I sent
│   └── [Cancel]
└── 🛡 Moderation Queue (N) — requests pending in threads I moderate
    └── [Approve] [Reject]
```

#### API Changes

New additions to `thread.constants.js`:
```javascript
THREAD_API.CANCEL_MY_REQUEST = (reqId) => `/threads/requests/${reqId}/cancel`,
// Already exists as CANCEL_REQUEST — verify same endpoint
```

Confirm: `CANCEL_REQUEST: (reqId) => /threads/requests/${reqId}/cancel` — confirmed in constants. Same route.

New in `thread.api.js`:
```javascript
// Already exists:
export async function getMyJoinRequests() { ... }
export async function getPendingRequests() { ... }  // for moderation queue
```

Both already exist. No new API functions needed.

#### Frontend: `thread.events.js`

Rename and expand `renderInvitesList` → `renderInvitesTab`:

```javascript
export async function loadAndRenderInvitesTab() {
  try {
    const [invites, myRequests, pendingRequests] = await Promise.all([
      getMyInvites(),
      getMyJoinRequests(),
      getPendingRequests(),
    ]);
    
    threadState.pendingInvites   = invites;
    threadState.myJoinRequests   = myRequests;
    threadState.moderationQueue  = pendingRequests;
    
    renderInvitesTab(invites, myRequests, pendingRequests);
    
  } catch (err) {
    // Non-fatal — show empty state
    renderInvitesTab([], [], []);
  }
}

export function renderInvitesTab(invites, myRequests, pendingRequests) {
  const tab = document.getElementById('thread-tab-invites');
  if (!tab) return;
  
  const totalBadge = invites.length + pendingRequests.length;
  _updateInvitesBadge(totalBadge);  // include moderation queue in badge count
  
  const hasAny = invites.length || myRequests.length || pendingRequests.length;
  
  tab.innerHTML = hasAny
    ? `
      ${_renderInviteSection('📬 Invitations', invites,       _renderInviteRow)}
      ${_renderInviteSection('📤 My Requests',  myRequests,  _renderMyRequestRow)}
      ${_renderInviteSection('🛡 Queue',         pendingRequests, _renderModerationRow)}
    `
    : `<div class="flex flex-col items-center gap-3 py-16 px-4 text-center">
         <span class="text-4xl">📬</span>
         <p class="text-sm text-gray-500">Nothing pending.</p>
       </div>`;
}

function _renderInviteSection(title, items, rowRenderer) {
  if (!items.length) return '';
  return `
    <div class="mb-2">
      <div class="px-4 py-2 bg-gray-50 border-b border-gray-100">
        <span class="text-xs font-bold text-gray-500 uppercase tracking-wide">
          ${title}
          <span class="ml-1 text-indigo-600 font-bold">${items.length}</span>
        </span>
      </div>
      <div class="divide-y divide-gray-100">
        ${items.map(rowRenderer).join('')}
      </div>
    </div>`;
}

function _renderInviteRow(invite) {
  // Existing invite row HTML — keep current design
  const thread  = invite.thread ?? {};
  const inviter = invite.invited_by;
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4"
         data-invite-id="${invite.invite_id}">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 truncate">${_esc(thread.title ?? 'Thread')}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${thread.department ? _esc(thread.department) + ' · ' : ''}${thread.member_count ?? 0} members
        </p>
        <p class="text-xs text-gray-500 mt-0.5">
          From <strong>${_esc(inviter?.name ?? 'Someone')}</strong>
        </p>
      </div>
      <div class="flex gap-1.5 flex-shrink-0 mt-0.5">
        <button data-action="thread-accept-invite" data-invite-id="${invite.invite_id}"
                class="text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700
                       rounded-lg px-2.5 py-1.5 transition-all">Accept</button>
        <button data-action="thread-decline-invite" data-invite-id="${invite.invite_id}"
                class="text-xs font-semibold text-gray-600 border border-gray-200
                       hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">Decline</button>
      </div>
    </div>`;
}

function _renderMyRequestRow(req) {
  const thread = req.thread ?? {};
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4"
         data-request-id="${req.request_id}">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold text-gray-900 truncate">${_esc(thread.title ?? 'Thread')}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          ${thread.member_count ?? 0} / ${thread.max_members ?? '?'} members
          ${thread.is_full ? ' · <span class="text-red-500">Full</span>' : ''}
        </p>
        <p class="text-xs text-gray-400 mt-0.5">
          Requested ${_timeAgo(req.requested_at)}
        </p>
      </div>
      <button data-action="thread-cancel-request" data-request-id="${req.request_id}"
              class="text-xs font-semibold text-red-500 border border-red-200
                     hover:bg-red-50 rounded-lg px-2.5 py-1.5 transition-colors flex-shrink-0 mt-0.5">
        Cancel
      </button>
    </div>`;
}

function _renderModerationRow(req) {
  const thread    = req.thread ?? {};
  const requester = req.requester ?? {};
  return `
    <div class="flex items-start justify-between gap-3 py-3.5 px-4"
         data-request-id="${req.request_id}">
      <div class="min-w-0 flex-1">
        <p class="text-xs text-gray-500 truncate">${_esc(thread.title ?? '')}</p>
        <div class="flex items-center gap-2 mt-0.5">
          <p class="text-sm font-semibold text-gray-900">${_esc(requester.name ?? '')}</p>
          <span class="text-xs text-gray-400">@${_esc(requester.username ?? '')}</span>
        </div>
        ${req.message ? `<p class="text-xs text-gray-500 italic mt-0.5 line-clamp-1">"${_esc(req.message)}"</p>` : ''}
      </div>
      <div class="flex gap-1.5 flex-shrink-0 mt-0.5">
        <button data-action="thread-approve-request"
                data-thread-id="${thread.id}" data-request-id="${req.request_id}"
                class="text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700
                       rounded-lg px-2.5 py-1.5 transition-all">Approve</button>
        <button data-action="thread-reject-request"
                data-thread-id="${thread.id}" data-request-id="${req.request_id}"
                class="text-xs font-semibold text-gray-600 border border-gray-200
                       hover:bg-gray-100 rounded-lg px-2.5 py-1.5 transition-colors">Reject</button>
      </div>
    </div>`;
}
```

#### State Changes in `thread.state.js`

Add:
```javascript
myJoinRequests:   [],    // requests I sent
moderationQueue:  [],    // requests pending in my threads
```

These are NOT cleared in `resetThreadSession()` (list-panel state).

#### `thread.delegation.js` — new handler

```javascript
const cancelRequestBtn = _closest(t, "[data-action='thread-cancel-request']");
if (cancelRequestBtn) {
  const requestId = Number(cancelRequestBtn.dataset.requestId);
  if (requestId) {
    import('./thread.events.js').then(({ handleCancelMyRequest }) =>
      handleCancelMyRequest(requestId)
        .catch(() => showToast('Failed to cancel request', 'error'))
    );
  }
  return;
}
```

#### `thread.events.js` — new handler

```javascript
export async function handleCancelMyRequest(requestId) {
  try {
    await cancelJoinRequest(requestId);
    threadState.myJoinRequests = threadState.myJoinRequests.filter(
      (r) => r.request_id !== requestId
    );
    renderInvitesTab(
      threadState.pendingInvites,
      threadState.myJoinRequests,
      threadState.moderationQueue
    );
    showToast('Request cancelled', 'info');
  } catch (err) {
    showToast(err?.message ?? 'Failed to cancel request', 'error');
  }
}
```

Also update `handleApproveRequest` and `handleRejectRequest` to remove from `moderationQueue`:
```javascript
threadState.moderationQueue = threadState.moderationQueue.filter(
  (r) => r.request_id !== requestId
);
renderInvitesTab(threadState.pendingInvites, threadState.myJoinRequests, threadState.moderationQueue);
```

#### Badge Count

Badge should now count: `invites.length + moderationQueue.length` (things requiring action). Exclude `myJoinRequests` (those are informational).

#### `_loadPendingInvites` in `thread.init.js`

Replace with call to `loadAndRenderInvitesTab()` from `thread.events.js`:
```javascript
async function _loadPendingInvites() {
  try {
    const { loadAndRenderInvitesTab } = await import('./thread.events.js');
    await loadAndRenderInvitesTab();
  } catch { /* non-fatal */ }
}
```

---

## 8. Thread List Improvements

After analysis, the following additions are recommended. They require minimal changes and meaningfully improve the information density of the thread list.

### 8.1 Department Badge

In `threadListItemTemplate()` in `thread.templates.js`, add below the title:

```javascript
const deptBadge = thread.department
  ? `<span class="text-[10px] font-semibold text-indigo-600 bg-indigo-50 rounded-full px-1.5 py-0.5 ml-1 leading-tight flex-shrink-0">
       ${esc(thread.department)}
     </span>`
  : '';

// In title row:
`<span class="text-sm font-semibold text-gray-900 truncate">${esc(thread.title)}</span>
 ${deptBadge}`
```



### 8.3 Closed Thread Indicator

```javascript
const closedBadge = !thread.is_open
  ? `<span class="text-[10px] text-red-500 font-semibold ml-1">🔒</span>`
  : '';
```

### 8.4 Better Time Formatting

Current `_timeAgo()` shows "just now", "5m ago", "2h ago", "3d ago". No change recommended — this is already optimal for a mobile list.

---

## 9. Database Changes

### 9.1 New Table: `ThreadMeetingNote`

```python
class ThreadMeetingNote(db.Model):
    __tablename__ = "thread_meeting_notes"
    
    id            = db.Column(db.Integer, primary_key=True)
    thread_id     = db.Column(db.Integer, db.ForeignKey("threads.id", ondelete="CASCADE"), nullable=False, index=True)
    created_by    = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    message_range = db.Column(db.Integer, nullable=False)     # 50 | 100 | 500
    message_count = db.Column(db.Integer, nullable=False)     # actual messages analyzed
    notes_json    = db.Column(db.JSON,    nullable=False)     # structured output
    created_at    = db.Column(db.DateTime, default=datetime.datetime.utcnow, nullable=False)
    
    __table_args__ = (
        db.Index("idx_tmn_thread_id", "thread_id"),
        db.Index("idx_tmn_created_at", "created_at"),
    )
```

**Alembic migration:** `ALTER TABLE` + `CREATE TABLE thread_meeting_notes ...`

### 9.2 New Column: `ThreadMessage.ai_personality`

```python
# ThreadMessage model — add column:
ai_personality = db.Column(db.String(50), nullable=True)
# e.g. "teacherai", "coderai", None (for non-AI or default learnora)
```

Set in `_call_learnora_for_thread()`:
```python
bot_msg = ThreadMessage(
    ...
    ai_personality = personality.get("key") if personality else None,
    ...
)
```

Use in `broadcast_ai_message()` and `_build_message_payload()` to select the correct display name and badge color.

**Alembic:** `ALTER TABLE thread_messages ADD COLUMN ai_personality VARCHAR(50) NULL;`

### 9.3 New Table: `AIPersonality` (Phase 2 only)

Do not implement in Phase 1. Use the module-level dict (Section 4.2).

### 9.4 No Schema Changes Required For

- AI message actions (reuses existing `ThreadMessage` + `reply_to_id`)
- Auto AI reply (reuses existing fields)
- History search (uses existing messages)
- Knowledge detection (uses existing messages)
- Swipe to reply (frontend only)
- Mention highlighting (frontend only)
- Mention bug fix (frontend only)
- Attachment gallery truncation (frontend only)
- Attachment download (frontend only, Cloudinary URLs)
- Invites tab (existing API endpoints)
- Thread list improvements (frontend only)

### 9.5 Index Additions

```sql
-- For meeting notes queries
CREATE INDEX idx_tmn_thread_created ON thread_meeting_notes(thread_id, created_at DESC);

-- For AI personality queries (phase 2)
CREATE INDEX idx_tm_ai_personality ON thread_messages(ai_personality) 
  WHERE ai_personality IS NOT NULL;
```

---

## 10. API Changes

### New Endpoints

| Method | Path | Handler | Purpose |
|---|---|---|---|
| `POST` | `/threads/<id>/meeting-notes` | `generate_meeting_notes` | Generate structured notes |
| `GET` | `/threads/<id>/meeting-notes` | `get_meeting_notes` | Retrieve saved notes |

### Modified Endpoints

None. All existing endpoints remain unchanged.

### New Constants in `thread.constants.js`

```javascript
THREAD_API.MEETING_NOTES = (tid) => `/threads/${tid}/meeting-notes`;
```

### New Functions in `thread.api.js`

```javascript
export async function generateMeetingNotes(threadId, messageRange = 50) {
  const res = await api.post(THREAD_API.MEETING_NOTES(threadId), { message_range: messageRange });
  return res.data ?? res;
}

export async function getMeetingNotes(threadId) {
  const res = await api.get(THREAD_API.MEETING_NOTES(threadId));
  return res.data?.notes ?? [];
}
```

---

## 11. WebSocket Changes

### New Client → Server Events

| Event | Payload | Handler Location |
|---|---|---|
| `thread_ai_action` | `{thread_id, message_id, action, target_lang?}` | `websocket_threads.py` |

### Modified Server → Client Events

| Event | Change |
|---|---|
| `learnora_thinking` | Add `personality` field: `{thread_id, personality: "TeacherAI"}` |
| `new_thread_message` | Add `ai_personality` field for AI messages |

### New Constants in `thread.constants.js`

```javascript
THREAD_WS.AI_ACTION = "thread_ai_action";   // client → server
```

### No New Personal-Room Events

All proposed features use thread-room broadcast for AI results (delivered as `new_thread_message` with `reply_to_id`). The personal-room architecture is unchanged.

---

## 12. Frontend Changes

### Files Modified

| File | Changes |
|---|---|
| `thread.state.js` | Add `myJoinRequests`, `moderationQueue`; update `resetThreadSession` comment |
| `thread.constants.js` | Add `AI_ACTION` WS event, `MEETING_NOTES` API constant |
| `thread.api.js` | Add `generateMeetingNotes`, `getMeetingNotes`; XHR version of `uploadAttachment` |
| `thread.events.js` | Add `handleCancelMyRequest`, `loadAndRenderInvitesTab`, `renderInvitesTab`; update `handleApproveRequest`/`handleRejectRequest` for state sync |
| `thread.delegation.js` | Add handlers for `thread-ai-action`, `thread-cancel-request`, `thread-meeting-notes`; redesign `_renderAttachmentStrip`; add swipe cancel key |
| `thread.templates.js` | Add `_renderMessageText` with mention highlighting; update `_buildAttachmentHtml` for +X truncation; add quick-reply button; update `threadListItemTemplate` for dept badge/member count |
| `thread.render.js` | Update `showLearnoraBotTyping` to accept personality name; update `renderMessageEdit` for mention rendering |
| `thread.modals.js` | Add `openMeetingNotesModal` |
| `thread.websocket.js` | Update `LEARNORA_THINKING` handler for personality; register `AI_ACTION` in constants |
| `thread.longpress.js` | No change (swipe is separate module) |
| `thread.init.js` | Import and attach `attachThreadSwipe`; update `_loadPendingInvites` |
| `threads.html` | Add CSS for `.msg-quick-reply-btn`, `.swipe-reply-hint`, `.mention`; update media queries |

### New Files

| File | Purpose |
|---|---|
| `thread.swipe.js` | Swipe-to-reply touch gesture handler |

---

l

---

## 14. Recommended Implementation Order

This order minimizes dependency conflicts and allows incremental testing.

### Phase 1 — Bug Fixes & Zero-Cost Wins (1–2 days)

1. **Bug 1: Mention insertion fix** — `setMember()` call sites. 30-minute change, high impact.
2. **Mention highlighting in rendered messages** — `_renderMessageText()` function. Prerequisite for AI mention UX.
3. **`_parse_mentions` case-insensitive fix** — backend one-liner.
4. **Thread list improvements** — dept badge, member count, closed indicator. Pure template changes.

### Phase 2 — Core UX Improvements (3–5 days)

5. **Swipe-to-reply** — new `thread.swipe.js` module + init wiring.
6. **Upload preview redesign** — `_renderAttachmentStrip` redesign + object URL previews.
7. **XHR upload with progress** — `uploadAttachment` function replacement.
8. **Attachment gallery +X truncation** — `_buildAttachmentHtml` change.

### Phase 3 — Invites Tab Overhaul (2–3 days)

9. **State additions** — `myJoinRequests`, `moderationQueue` in `thread.state.js`.
10. **`renderInvitesTab` + section renderers** — in `thread.events.js`.
11. **`loadAndRenderInvitesTab`** — replaces `_loadPendingInvites`.
12. **Cancel request handler** — delegation + events.
13. **Moderation queue approve/reject state sync** — update existing handlers.
14. **Badge count logic update** — includes moderation queue.

### Phase 4 — AI Enhancements (5–7 days)

15. **AI personality system** — module-level dict + `send_thread_message` trigger loop.
16. **`ai_personality` DB column** — migration, model update, payload population.
17. **AI message actions** — `thread_ai_action` WS event + `_call_learnora_action()` function.
18. **Options sheet AI action buttons** — delegation change.
19. **Auto-reply on AI message reply** — `send_thread_message` handler addition.
20. **AI fact-checking** — adds to `ACTION_PROMPTS`, options sheet button.
21. **AI knowledge detection** — system prompt branch in `_call_learnora_for_thread`.
22. **AI history search** — system prompt branch in `_call_learnora_for_thread`.
23. **Learnora thinking indicator with personality name** — WS handler + render update.

### Phase 5 — Meeting Notes (2–3 days)

24. **`ThreadMeetingNote` model + migration.**
25. **REST endpoints** — `generate_meeting_notes`, `get_meeting_notes`.
26. **`generateMeetingNotes` API function** — `thread.api.js`.
27. **Meeting notes button in thread header** — `thread.render.js`.
28. **`openMeetingNotesModal`** — `thread.modals.js`.
29. **Daily rate limit** — per-thread notes generation cap.

### Phase 6 — Attachment Saving (1 day)

30. **Download overlay on inline images** — template change.
31. **iOS limitation documentation.**

---

### Migration Requirements Summary

| Migration | Type | Reversible |
|---|---|---|
| Add `thread_messages.ai_personality VARCHAR(50) NULL` | `ALTER TABLE` | Yes — drop column |
| Create `thread_meeting_notes` table | `CREATE TABLE` | Yes — drop table |
| Add indexes on new columns | `CREATE INDEX` | Yes — drop index |

All migrations are additive. No column removals. No data transforms. Safe to run on a live database with standard `ALTER TABLE ... ADD COLUMN` semantics (no table lock for nullable column additions in PostgreSQL).

---

*Document version 1.0 — based on codebase snapshot provided. Re-verify file contents before implementation if any files have been modified since this analysis.*
