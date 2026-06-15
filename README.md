<div align="center">

# 📚 Study Hub

### *An AI-native educational platform built for how students actually learn*

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-2.x-000000?style=for-the-badge&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-010101?style=for-the-badge&logo=socket.io&logoColor=white)](https://socket.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

**Study Hub is a production-grade, full-stack educational platform that combines AI tutoring, peer matching, community knowledge-sharing, and gamified growth loops into a single coherent system.** It was designed not as a collection of isolated features but as a platform where every component reinforces the others — a post can become a study thread, a thread can produce a matched partnership, a partnership can lead to a scheduled session, and that session is coached by AI with full context of what was discussed.

[Why This Exists](#-why-this-exists) · [Features](#-features-in-depth) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Setup](#-installation--setup)

</div>

---

## 🧩 Why This Exists

Every student eventually hits the same wall: they are stuck on a concept late at night, the material is not clicking, and there is no one to ask. Most platforms solve only one piece of this problem — a chatbot, a forum, or a study planner. They do not solve the underlying issue: **learning is deeply social and contextual, and most tools treat it as solitary and generic.**

Study Hub was designed around three core observations:

**1. Students learn better from other students.** Peer explanation is among the most effective learning techniques known. But connecting students who complement each other — by subject strength, schedule, and learning style — is a logistics problem that software is uniquely positioned to solve. Study Hub automates this with a scored compatibility algorithm.

**2. AI is most useful when it has context.** Generic chatbots answer questions in a vacuum. Study Hub's AI (Learnora) is embedded throughout the platform — it knows the specific post being discussed, the user's preferred response style, their conversation history, and the files they have uploaded. The AI is not a sidebar feature; it is woven into the flow of how knowledge is created and shared.

**3. Engagement needs a feedback loop.** Students disengage when they cannot see progress. The platform's reputation system, badge engine, help streaks, and analytics dashboard are designed to make contribution feel meaningful and visible — not as game mechanics for their own sake, but as an honest reflection of real impact in the community.

---

## ✨ Features In Depth

### 🤖 Learnora — The AI Study Engine

Learnora is the AI core of the platform. Its design addresses two problems that consistently plague AI integrations in production: **availability** and **context quality**.

#### Multi-Provider Failover Architecture

Most applications bind to a single AI provider and degrade silently when that provider rate-limits or goes down. Learnora manages a pool of up to 9 providers simultaneously — five OpenRouter accounts, Groq, Together AI, and optionally a local Ollama instance — and rotates through them automatically, including mid-stream during a live response.

When a provider fails during a streaming response, the system marks it with a 1-hour cooldown, emits a `provider_switch` event to the client so the UI can show appropriate feedback, rotates to the next healthy provider, and resumes generation without interrupting the user. The client receives the switch event as a discrete SSE frame.

```
Provider Pool: [openrouter_1 → openrouter_2 → openrouter_3 → openrouter_4 → openrouter_5 → groq → together → ollama]
                     ↓ rate-limited
                     → cooldown (1hr) → rotate → resume stream on next provider
```

**Provider matrix:**

| Provider | Text Model | Vision Model |
|---|---|---|
| OpenRouter (×5 accounts) | `openai/gpt-oss-20b:free` | `meta-llama/llama-3.2-90b-vision-instruct:free` |
| Groq | `llama-3.1-8b-instant` | `llama-3.2-90b-vision-preview` |
| Together AI | `Meta-Llama-3.1-8B-Instruct-Turbo` | `Llama-3.2-90B-Vision-Instruct-Turbo` |
| Local Ollama | `llama3.2:3b` | `llama3.2-vision:11b` |

#### Conversation Architecture and Token Management

Every AI session lives in a persistent `AIConversation` record. When a conversation exceeds 10 messages, Learnora automatically summarizes older history into a compressed system-context block and retains only the 5 most recent exchanges as live turns. This bounds the effective token count while preserving continuity across long study sessions — a tradeoff that makes extended sessions economically viable without sacrificing coherence.

Each response is persisted with full metadata: model used, provider name, estimated token count, completeness flag, and any error. Truncated or dropped responses are detectable and recoverable — the client can send `continue=true` and Learnora resumes the incomplete thread.

#### Multi-Modal File Processing

Learnora accepts file uploads alongside any message. Files are classified as `code`, `document`, or `image` and processed through type-specific extractors before being injected into the AI message as structured context.

Images are base64-encoded and passed as `image_url` content parts, automatically triggering a switch to a vision-capable model. Documents (PDF via PyPDF2, DOCX via docx2txt, CSV via Pandas, plain text) are extracted and included up to 5,000 characters per file with a truncation notice if exceeded. Code files across 10+ languages (`.py`, `.js`, `.java`, `.cpp`, `.ts`, `.html`, `.css`, `.php`, `.rb`, `.c`, `.h`) are passed verbatim up to 400KB.

This means a student can attach a buggy Python file alongside a PDF of lecture slides and ask a single question — the AI receives all of it in structured, labeled form.

#### Smart Response Cache

Repeated queries — common in educational settings where many students ask similar questions — are served from an MD5-keyed in-memory LRU cache with a 1-hour TTL and a 1,000-entry capacity. Cache hits still write to conversation history and decrement the user's quota correctly. The key is derived from `message + mode + files_hash`, so identical questions in different modes or with different attachments are cached independently.

#### Streaming Response Format

All responses are delivered as Server-Sent Events:

```
data: {"type": "start", "cached": false}
data: {"type": "chunk", "content": "The chain rule states..."}
data: {"type": "provider_switch", "new_provider": "groq"}
data: {"type": "retry", "attempt": 1}
data: {"type": "done", "tokens": 214, "complete": true, "provider": "groq", "can_continue": false}
```

---

### 📝 Advanced Post System

The post system is the primary surface for community knowledge creation. Beyond standard CRUD, it includes two AI-powered capabilities that change what a post can be — and what a student can do with one.

#### AI-Assisted Post Refinement

**The problem it solves:** Students often have a useful question or insight but struggle to articulate it clearly. A poorly phrased post gets ignored or misunderstood, which discourages future contribution and degrades the quality of the community's knowledge base over time.

**How it is built:** A student can request AI refinement of either an unpublished draft (`POST /posts/refine-draft`) or an already-published post (`POST /posts/<id>/refine`) — with an optional natural-language instruction like "make this more concise" or "add more structure." The system constructs a strict prompt requiring the AI to return a JSON object of the shape `{"title": "...", "content": "..."}`, preserving the original intent while improving clarity, grammar, and structure.

The response streams back via SSE so the student sees the refinement appear in real time. A regex-based JSON extractor handles the common model behavior of wrapping JSON in prose, and structural validation ensures both `title` and `content` are present before marking the result successful. If the stream encounters a rate-limit or timeout mid-way, the system rotates to the next available provider and emits a `{"type": "retry", "attempt": N}` event to the client.

**The author-approval step:** The refined content is never applied automatically. A separate `PATCH /posts/<id>/apply-refinement` endpoint handles the actual write, and it requires the student to explicitly submit the refined title and content. On apply, the original content is snapshotted in the response body for reference, the `edited_at` timestamp is set, and `@mention` detection re-runs on the new content to ensure any newly mentioned users receive notifications. The student is always the author; the AI is an editor they choose to accept or reject.

#### Ask AI About a Specific Post

**The problem it solves:** Community posts generate long discussions. A student reading a 40-comment thread about a complex concept should not have to read all 40 comments to extract the key insight. More broadly, students need a way to interrogate specific content — not just ask generic questions.

**How it is built:** This does not require a separate endpoint. When a user opens the AI chat from the context of a post, the `post_id` is passed alongside their message to the standard `/learnora/api/chat` endpoint. The backend fetches the post's title and full text content and injects them into the message as a labeled `**Referenced Post:**` block before the user's question. From the model's perspective, it has the full post as grounding context and the user's question as the task.

This enables questions like "summarize the key argument in this post," "what is the strongest counterargument to this," or "explain the concept in the third paragraph" — all grounded in specific platform content. Because this flows through the same `StudyAssistant.build_messages()` pipeline as every other query, it automatically benefits from provider failover, response caching, and conversation persistence.

---

### 🔗 Connection System

The connection system is the social graph underpinning nearly every collaborative feature on the platform. Messaging, study buddy requests, help broadcasts, and thread invitations all check the connection graph first. This is a deliberate architectural decision: it prevents unsolicited contact, creates context for AI-generated compatibility analysis, and establishes a lightweight social contract between participants before any meaningful interaction begins.

#### How Connections Work

The `Connection` model is bidirectional and state-aware, existing in one of four states: `pending`, `accepted`, `rejected`, or `blocked`. The standard flow is:

1. User A sends a connection request with an optional personal note via `POST /connections/request/<user_id>`
2. User B receives it with mutual-connection count, last-active status, and onboarding preview injected into the response
3. User B accepts via `POST /connections/accept/<request_id>`, or rejects or blocks

On acceptance, both users are notified, and the connection immediately enables messaging, study buddy requests, and help broadcasts between them.

Two fast-path endpoints support the onboarding flow where frictionless connection is desirable: a single-connect endpoint (`POST /connections/onboard-connect/<email>/<user_id>`) that creates a directly-accepted connection without a pending step, and a bulk-connect endpoint (`POST /connections/onboard-connect-all/<email>`) that accepts a list of IDs and creates all connections simultaneously. Both are idempotent — calling them on an existing pair updates the status if needed and returns success without duplication.

#### AI-Powered Connection Overview

Before deciding to connect with someone, a student can request an AI-generated overview via `GET /connections/overview/<user_id>`. The system executes the following steps:

1. Gathers structured data for both users — subjects, strong subjects, department, class level, reputation, and recent platform activity
2. Calculates a compatibility score based on shared subjects, complementary skills (where A needs help with what B is strong in), schedule overlap, department match, and reputation standing
3. Generates a detailed AI prompt containing all of this data and requests a warm, specific narrative explaining why connecting would be mutually beneficial, what each student could offer the other, and a suggested opening message
4. Streams the result as SSE, emitting the structured compatibility score and user data first so the UI can render immediately while the AI narrative streams in

If no AI provider is available, the system falls back to a deterministic rule-based generator that produces a reasonable narrative from the compatibility data — the feature degrades gracefully rather than returning an error.

#### Connection Health Score

For existing connections, the platform computes a health score that surfaces in the connections list. The score is derived from shared thread participation, messaging activity, and other interaction signals. It is accompanied by a plain-text suggestion — for example, "You haven't studied together recently — consider scheduling a session" — turning the connections list from a static contact directory into a lightweight relationship management surface.

#### Real-Time Help Broadcasting

When a student is stuck and needs help immediately, they can broadcast a help request to their network via `POST /connections/help/broadcast`. The system:

1. Scores all accepted connections by subject relevance against the student's `strong_subjects` and `subjects` fields from their onboarding profile
2. Selects the top 10 most relevant connections
3. Sends FCM push notifications to their devices and creates in-app `Notification` records simultaneously
4. Emits a WebSocket event to any volunteers who are currently online via `ws_manager.emit_to_user()`

Help requests expire after 2 hours. Connections can volunteer via `POST /connections/help/<id>/volunteer`, and the requester is notified immediately by push notification, in-app notification, and — if they are online — a real-time WebSocket event containing the volunteer's full profile.

**Complete connection API surface:**

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/connections/request/<user_id>` | Send a connection request |
| `POST` | `/connections/accept/<request_id>` | Accept a pending request |
| `POST` | `/connections/reject/<request_id>` | Reject a request |
| `DELETE` | `/connections/cancel/<request_id>` | Cancel a request you sent |
| `DELETE` | `/connections/remove/<user_id>` | Remove an existing connection |
| `POST` | `/connections/block/<user_id>` | Block a user |
| `POST` | `/connections/unblock/<user_id>` | Unblock a user |
| `GET` | `/connections/list` | All accepted connections with health scores |
| `GET` | `/connections/requests/received` | Incoming requests with mutual-connection count |
| `GET` | `/connections/requests/sent` | Outgoing pending requests |
| `GET` | `/connections/mutual/<user_id>` | Mutual connections with another user |
| `GET` | `/connections/overview/<user_id>` | AI compatibility analysis (SSE stream) |
| `GET` | `/connections/<id>/details` | Full relationship analytics — messages, shared threads, timeline |
| `GET` | `/connections/status/<user_id>` | Connection state with a specific user |
| `GET` | `/connections/suggestions` | Ranked suggestions based on onboarding data |
| `GET` | `/connections/online` | Currently online connections |
| `POST` | `/connections/help/broadcast` | Broadcast a help request to relevant connections |
| `POST` | `/connections/help/<id>/volunteer` | Volunteer to help with a request |
| `POST` | `/connections/help/find` | Find users strong in a specific subject |

---

### 👥 Study Buddy Matching

The study buddy system formalizes peer learning partnerships. The core challenge in peer matching is not finding someone in the same department — it is finding someone who can genuinely help you while also benefiting from you in return. The matching algorithm is built around this bidirectional value question.

#### Compatibility Scoring Algorithm

Every potential match is evaluated on a 100-point scale:

| Factor | Max Points | Engineering Rationale |
|---|---|---|
| Subject overlap | 40 pts | Scored bidirectionally: what you need vs. what they know, and vice versa |
| Availability overlap | 30 pts | Shared available days (5 pts per day, capped at 6 days) |
| Same department | 10 pts | Shared academic context improves collaboration quality |
| Recent activity | 10 pts | Both users active in the past 7 days — reduces matching with inactive accounts |
| Partner track record | 10 pts | Prior partnerships that reached 3+ sessions signal reliability |

The bidirectional subject scoring is the most consequential design choice. If User A needs help with Calculus and User B is strong in Calculus, that scores 10 points. If User B also needs help with Python and User A is strong in Python, that scores another 10 points. A mutual-value match is more sustainable than a unidirectional tutor relationship, so the algorithm rewards it accordingly.

#### Request Workflow and Auto-Thread Creation

On match acceptance, the system automatically creates a private `Thread` between the two users — a purpose-built messaging space that is ready immediately, without any additional setup. All partnerships track `sessions_count`, `last_activity`, `is_active`, and `ended_at`, giving both users a clear record of the relationship and a path to graceful conclusion when it has run its course.

---

### 📬 Direct Messaging System

The messaging system is connection-gated: users must be mutually connected before they can exchange messages. This is intentional. Requiring a connection creates a social contract between participants, ensures both sides have accepted the relationship, and means every conversation already has context — shared threads, mutual connections, department overlap — available in the connection record.

#### Rich Message Types

Messages support text, file attachments, code snippets, and emoji reactions (`MessageReaction`). Each message can reference a previous message as a reply, with the full quoted message included in the response payload so clients can render threaded replies without an additional round-trip.

#### Real-Time Delivery

Flask-SocketIO handles real-time delivery. A `TypingStatusManager` tracks per-user typing state with 3-second auto-expiration, preventing stale "is typing" indicators from lingering after a user stops. Connections are authenticated on socket connect via JWT. Message content is sanitized with `bleach` before storage to prevent XSS in clients that render rich text.

**WebSocket event model:**

| Event | Direction | Description |
|---|---|---|
| `send_message` | Client → Server | Send a new message |
| `new_message` | Server → Client | Receive a new message |
| `typing_start` / `typing_stop` | Client → Server | Typing state control |
| `user_typing` | Server → Client | Typing indicator for a specific user |
| `message_read` | Client → Server | Mark messages as read |
| `messages_read` | Server → Client | Read receipt broadcast |
| `user_online` / `user_offline` | Server → Client | Presence events |

---

### 📚 Homework & Assignment System

The homework system addresses one of the most concrete daily needs of a student: tracking their own work and getting unstuck on specific problems.

#### Personal Assignment Tracking

Each student maintains a private assignment list with due dates, priority levels, and subject tags. Assignments can be linked directly to a `LiveStudySession`, giving every session a defined purpose and grounding the outcome in a real academic deliverable.

#### Peer Homework Help Network

Students can share an assignment with their connections to solicit solutions or explanations. The full workflow — share → solution submitted → feedback provided → completion marked — is tracked in `HomeworkSubmission` records. This creates a contribution history that feeds directly into the help-streak system.

#### Help Streak Tracking

The help streak increments when a user receives positive feedback on assistance they provided. The implementation explicitly handles three cases: the user already helped today (no double-increment), they helped yesterday (streak continues), or they missed a day (streak resets to 1). When a new personal record is set, the response includes `is_new_record: true` for the client to surface. The `total_helps_given` counter is tracked separately so lifetime contribution is preserved even after streak breaks.

---

### 🏆 Reputation System

The reputation system is designed to make quality contribution visible without creating winner-take-all dynamics. Point values scale with achievement difficulty, negative events are weighted conservatively, and five named levels create meaningful progression milestones.

**Point events:**

| Action | Points | Notes |
|---|---|---|
| Post reaches 10 likes | +5 | |
| Post reaches 50 likes | +20 | |
| Post reaches 100 likes | +50 | |
| Comment marked as solution | +15 | Strongest quality signal — human-verified by the asker |
| Comment marked helpful | +3 | |
| Post marked helpful | +5 | |
| 7 helpful reactions in one week | +10 | Consistency bonus |
| Thread created | +3 | |
| Thread reaches 10+ members | +10 | Community-building reward |
| Post receives dislike | -2 | Intentionally conservative penalty |
| Content reported and confirmed | -10 | |

**Reputation levels:**

| Level | Range | Icon |
|---|---|---|
| Newbie | 0–50 | 🌱 |
| Learner | 51–200 | 📚 |
| Contributor | 201–500 | 🎓 |
| Expert | 501–1,000 | 🌟 |
| Master | 1,001+ | 👑 |

Every point event is written to `ReputationHistory` with a human-readable description, making the full ledger auditable and queryable for the student's own review.

---

### 🎖️ Badges & Achievements

Badges complement reputation as a parallel recognition system. Reputation is a continuous score; badges are permanent, discrete markers of specific accomplishments. Five categories — `engagement`, `quality`, `consistency`, `social`, and `milestone` — cover the different dimensions of student contribution. Four rarity tiers create meaningful differentiation:

| Rarity | Color | Example |
|---|---|---|
| Common | `#6B7280` Gray | First Post |
| Rare | `#3B82F6` Blue | Prolific Writer (50 posts), Helpful Hero (50 helpful reactions) |
| Epic | `#8B5CF6` Purple | Content Creator (100 posts), Problem Solver (10 solutions marked) |
| Legendary | Gold | Genius (50 solutions marked by the community) |

Badge eligibility is checked automatically on qualifying actions and stored in `UserBadge` with an earned timestamp. Badges are publicly visible on student profiles as a portable record of contribution.

---

### 📊 Analytics & Insights

The analytics system exists to answer one question for a student: is what I am doing working? Without a feedback loop, students cannot calibrate their effort. With one, they can identify patterns and adjust.

#### 90-Day Activity Heatmap

A contribution graph is generated from `UserActivity` records over a rolling 90-day window. Each cell reflects total activity events — posts, comments, reactions, thread messages — giving students a visual record of their consistency across the semester.

#### Engagement Rate Formula

Each post's engagement rate is calculated as `(likes + comments × 2) / views × 100`. Comments are weighted 2× over likes because a comment represents deeper engagement than a passive reaction — a student writing a reply invested time and thought. This metric surfaces per-post in the analytics dashboard so students can identify which topics or formats generate genuine discussion.

#### Pattern-Based Insights Engine

The insights engine runs SQL aggregations over the user's activity history to detect behavioral patterns, with no external ML dependency. It identifies the weekday when a user's posts historically receive the most engagement, which subject tags generate the most discussion, and whether overall activity is trending up or down. Insights are returned as structured objects that the client renders as actionable suggestions — for example, "Your posts on Mondays get 3× more engagement on average. Consider posting your hardest questions then."

---

### 📅 Study Sessions

Study sessions formalize the structure of peer learning. A `LiveStudySession` links two users with a defined context. Before or during a session, either participant can set a `session_goal` with an optional `target_count` (e.g., "Complete 10 calculus problems") and link the session to a specific `Assignment`. This grounds the session in real academic work rather than leaving it as an unstructured meeting. `ConversationAnalytics` tracks session-level engagement metrics for post-session reflection.

---

### 🔐 Authentication

The auth layer is complete and production-ready.

**JWT lifecycle:** Access tokens expire in 50 minutes. Refresh tokens are stored as cookies and exchanged at `/auth/refresh-token` for a new access token without requiring a full re-login. The `@token_required` decorator validates the access token on every protected route.

**Google OAuth 2.0:** The full OAuth flow is handled via `flask-dance`. After callback, email and name are written to the Flask session and surfaced at `/auth/google_temp_info` for the frontend to pre-populate the registration form.

**Two-step registration:** Users verify their email first, then complete their profile (username and password) in a separate step at `/auth/complete-registration`. This prevents accounts from entering the platform with unverified emails or placeholder identities.

**Username policy:** Enforced by regex `^[a-z0-9]{3,20}$` — lowercase letters and numbers only, 3 to 20 characters — ensuring consistent, parseable handles across every surface of the platform.

---

## 🏗️ Architecture

```
study-hub/
│
├── learnora.py            # AI engine — provider rotation, cache, streaming, file processing
├── auth.py                # JWT, Google OAuth 2.0, two-step registration, token refresh
├── connections.py         # Social graph — request/accept/block, health scores, AI overview, help broadcast
├── study_buddy.py         # Compatibility algorithm, request workflow, session tracking
├── posts.py               # Post CRUD, AI refinement, mentions, reactions, comments, bookmarks
├── threads.py             # Study groups — creation, invites, join requests, in-thread messaging
├── messages.py            # Direct messaging — rich content, read receipts, conversation management
├── websocket_messages.py  # Flask-SocketIO — delivery, typing indicators, presence
├── homework_system.py     # Personal tasks, peer help workflow, help streak tracking
├── study_sessions.py      # Session scheduling, goal setting, assignment linking
├── badges.py              # Achievement engine — definitions, rarity tiers, auto-award logic
├── reputation.py          # Point events, level thresholds, history ledger, leaderboard
├── analytics.py           # Heatmap, engagement metrics, pattern-based insights
├── notifications.py       # Notification dispatch and per-user preference management
├── search.py              # Full-text search across posts, users, threads
├── profile.py             # Profile management, settings, privacy controls
└── storage.py             # Supabase Storage + Cloudinary dual-cloud file handling
```

### Request Flow

```
HTTP / WebSocket Request
          │
          ▼
  Flask Route Dispatch
          │
     @token_required  ←─── JWT cookie validation
          │
          ├── AI Request ────────────────► MultiProviderManager
          │                                        │
          │                              SmartChatCache (MD5, 1hr TTL)
          │                                        │
          │                           StudyAssistant.build_messages()
          │                             ↙                  ↘
          │                    FileHandler             ConversationHistory
          │               (code/doc/image extract)     (auto-summarize >10 msgs)
          │                                        │
          │                              SSE Streaming Response
          │                       (mid-stream provider failover + retry)
          │
          ├── WebSocket ──────────────────► Flask-SocketIO Room
          │                                        │
          │                           TypingStatusManager (3s auto-expiry)
          │                           JWT auth on connect
          │
          └── Data Write ──────────────► SQLAlchemy ORM → Supabase PostgreSQL
                                                  │
                                    ReputationEngine → BadgeAwarder → NotificationDispatch
```

### Storage Architecture

Two storage services are used for different data characteristics. **Cloudinary** handles media uploads (post images, avatars) because it provides CDN delivery and on-the-fly transformations. **Supabase Storage** handles AI file uploads (PDFs, documents, code files) because it lives in the same infrastructure as the database, simplifying access control via the service-role key. All filenames are sanitized with `werkzeug.secure_filename` and extended with a random token and timestamp to prevent collisions and path traversal.

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend** | Python 3.10+, Flask 2.x | Flexible routing, SocketIO support, rich ecosystem |
| **Real-Time** | Flask-SocketIO | Handles WebSocket and long-polling transports uniformly |
| **ORM / Database** | SQLAlchemy + Supabase PostgreSQL | Type-safe queries, relational integrity, managed hosting |
| **Authentication** | PyJWT + Flask-Dance | JWT lifecycle control, Google OAuth without heavyweight dependencies |
| **AI Providers** | OpenRouter ×5, Groq, Together AI, Ollama | Provider diversity eliminates single point of failure |
| **File Storage** | Supabase Storage + Cloudinary | Separated by data type: documents vs. media |
| **Image Processing** | Pillow (PIL) | Vision pre-processing and base64 encoding |
| **Document Extraction** | PyPDF2 + docx2txt + Pandas | Multi-format text extraction for AI context injection |
| **Security** | Werkzeug password hashing, bleach sanitization | Hashing at rest, XSS prevention on user-generated content |
| **Deployment** | Render / Railway | Free-tier compatible, zero-config deployment |

---

## 📡 API Reference

All protected routes require a valid `access_token` JWT cookie. All responses follow the envelope `{"status": "success"|"error", "data": {...}, "message": "..."}`.

### AI / Learnora

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/learnora/api/chat` | Send a message — multipart, file uploads, returns SSE stream |
| `POST` | `/learnora/api/conversation/new` | Create a new conversation |
| `GET` | `/learnora/api/conversation/list` | List recent conversations (last 50) |
| `GET` | `/learnora/api/conversations/:id` | Full conversation history |
| `GET` | `/learnora/api/stats` | Provider health, user quota, cache statistics |
| `POST` | `/learnora/api/cache/clear` | Purge expired cache entries |

**Chat request (multipart/form-data):**
```
message         = "Explain the chain rule"
conversation_id = 42
mode            = "deep_think"   # fast_response | programming | research | summarize | explain
post_id         = 123            # optional — injects referenced post as AI context
continue        = "false"        # resume an incomplete response
file0           = <upload>       # any number of mixed-type files
```

**Streaming response (SSE):**
```json
{"type": "start", "cached": false}
{"type": "chunk", "content": "The chain rule states..."}
{"type": "provider_switch", "new_provider": "groq"}
{"type": "done", "tokens": 214, "complete": true, "provider": "groq", "can_continue": false}
```

---

### Posts

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/posts/create` | Create post (multipart, supports images) |
| `GET` | `/posts/feed` | Cursor-paginated post feed |
| `PUT` | `/posts/:id` | Edit post |
| `DELETE` | `/posts/:id` | Delete post |
| `POST` | `/posts/:id/react` | Add or remove a reaction |
| `POST` | `/posts/:id/comment` | Add a comment |
| `POST` | `/posts/:id/bookmark` | Bookmark a post |
| `GET` | `/posts/:id/analytics` | Per-post engagement metrics |
| `POST` | `/posts/:id/refine` | AI-stream a refined version of a published post |
| `POST` | `/posts/refine-draft` | AI-stream a refined version of an unsaved draft |
| `PATCH` | `/posts/:id/apply-refinement` | Apply AI-refined content after author approval |

---

### Authentication

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/register` | Stage 1 — email registration and verification |
| `POST` | `/auth/complete-registration` | Stage 2 — username and password setup |
| `POST` | `/auth/login` | Login — sets JWT cookies |
| `GET` | `/auth/verify-auth` | Validate current access token |
| `POST` | `/auth/refresh-token` | Exchange refresh token for new access token |
| `POST` | `/auth/logout` | Clear all JWT cookies |
| `POST` | `/auth/reset-password` | Request a password reset |
| `POST` | `/auth/set-password` | Set a new password post-reset |
| `GET` | `/auth/me` | Current user identity |
| `GET` | `/google/start` | Initiate Google OAuth flow |

---

### Study Buddy

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/study-buddy/preferences` | Set matching preferences |
| `GET` | `/study-buddy/preferences` | Get current preferences |
| `GET` | `/study-buddy/suggestions` | Ranked suggestions based on compatibility score |
| `POST` | `/study-buddy/request/:id` | Send a study buddy request |
| `POST` | `/study-buddy/accept/:id` | Accept — auto-creates a shared thread |
| `POST` | `/study-buddy/reject/:id` | Reject a request |
| `DELETE` | `/study-buddy/cancel/:id` | Cancel a sent request |
| `GET` | `/study-buddy/requests/received` | Incoming requests with pre-computed match scores |
| `GET` | `/study-buddy/requests/sent` | Outgoing requests |
| `GET` | `/study-buddy/requests/connected` | All active partnerships |
| `GET` | `/study-buddy/match/:id` | Detailed partnership analytics |

---

### Messaging

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/messages/conversations` | All conversations |
| `GET` | `/messages/:userId` | Message history with a user |
| `POST` | `/messages/:userId` | Send a message |
| `DELETE` | `/messages/:id` | Delete a message |
| `POST` | `/messages/:id/react` | React to a message |
| `PUT` | `/messages/conversation/:userId/archive` | Archive a conversation |
| `PUT` | `/messages/conversation/:userId/mute` | Mute a conversation |

---

### Reputation & Badges

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/reputation` | Current score, level, and next-level progress |
| `GET` | `/reputation/history` | Full chronological point event ledger |
| `GET` | `/reputation/leaderboard` | Platform-wide ranked leaderboard |
| `GET` | `/badges` | All badge definitions with criteria and rarity |
| `GET` | `/badges/mine` | Badges earned by the current user |

---

### Analytics

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/analytics/dashboard` | Full personal analytics dashboard |
| `GET` | `/analytics/heatmap` | 90-day activity heatmap data |
| `GET` | `/analytics/insights` | Pattern-based behavioral insights |
| `GET` | `/analytics/posts/:id` | Per-post engagement breakdown |

---

## 🗃️ Database Schema Overview

The schema is fully relational. JSON columns (`user_metadata`, `messages`, `volunteers`) are reserved for schemaless configuration and append-only log structures where relational modeling would add complexity without benefit.

**Core identity:** `User` · `StudentProfile` · `OnboardingDetails`

**AI:** `AIConversation` · `AIUsageQuota`

**Content:** `Post` · `Comment` · `PostReaction` · `PostView` · `CommentLike` · `CommentHelpfulMark` · `PostReport` · `PostFollow` · `Bookmark` · `BookmarkFolder` · `Mention`

**Social graph:** `Connection` · `HelpRequest` · `Notification`

**Threads and messaging:** `Thread` · `ThreadMember` · `ThreadJoinRequest` · `ThreadMessage` · `Message` · `MessageReaction`

**Learning:** `StudyBuddyRequest` · `StudyBuddyMatch` · `Assignment` · `HomeworkSubmission` · `LiveStudySession` · `StudySessionCalendar` · `ConversationAnalytics`

**Gamification:** `Badge` · `UserBadge` · `ReputationHistory` · `UserActivity`

---

## 🚀 Installation & Setup

### Prerequisites

- Python 3.10+
- A Supabase project (PostgreSQL + Storage bucket)
- At least one AI provider API key — Groq is recommended for getting started (free tier, fast inference)
- A Cloudinary account for media uploads

### Steps

```bash
# Clone the repository
git clone https://github.com/yourusername/study-hub.git
cd study-hub

# Set up virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Open .env and fill in your keys

# Start the development server
flask run

# Production (SocketIO requires an async worker)
gunicorn --worker-class eventlet -w 1 app:app
```

### Environment Variables

```env
# Database
SUPABASE_URL=https://your-project.supabase.co
SERVICE_ROLE_KEY=your-service-role-key

# Auth
SECRET_KEY=your-jwt-secret-key
GOOGLE_OAUTH_CLIENT_ID=your-google-oauth-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-oauth-client-secret

# AI Providers — the more you configure, the higher the uptime
OPENROUTER_API_KEY_1=sk-or-...
OPENROUTER_API_KEY_2=sk-or-...
OPENROUTER_API_KEY_3=sk-or-...
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...
USE_LOCAL_OLLAMA=false              # Set "true" to include local Ollama in the pool

# File Storage
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# Email
MAIL_SERVER=smtp.gmail.com
MAIL_USERNAME=your@email.com
MAIL_PASSWORD=your-app-password
```

---

## 💡 Usage Examples

### Ask AI About a Specific Post

```javascript
// Pass post_id alongside any message — the post's content is fetched and
// injected as context server-side. No separate endpoint needed.
const formData = new FormData();
formData.append("message", "What is the main argument here and what would be the strongest counterargument?");
formData.append("conversation_id", "42");
formData.append("mode", "research");
formData.append("post_id", "189");

const res = await fetch("/learnora/api/chat", { method: "POST", body: formData });
// Read SSE stream for {"type": "chunk", "content": "..."} frames
```

### Refine a Draft Before Posting

```javascript
// AI suggests a refined version — student reviews and applies if they agree
const res = await fetch("/posts/refine-draft", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    title: "help with recursion",
    content: "I dont understand recursion at all can someone explain it",
    instructions: "Make this clearer and more specific. Add what I've already tried."
  })
});
// Stream SSE. On {"type": "done", "refined": {"title": "...", "content": "..."}}
// Show the result to the user. If they accept, call PATCH /posts/<id>/apply-refinement.
```

### Find a Study Buddy

```javascript
// Set preferences once — updated anytime
await fetch("/study-buddy/preferences", {
  method: "POST",
  body: JSON.stringify({
    needs_help: ["Calculus", "Linear Algebra"],
    good_at: ["Python", "Data Structures"],
    available_days: ["Monday", "Wednesday", "Friday"],
    available_times: ["evening"],
    study_style: ["video_call", "chat"]
  })
});

// Get scored suggestions — highest compatibility first
const { data } = await (await fetch("/study-buddy/suggestions")).json();
// Each entry: { user: {...}, match_score: 78, reasons: ["Complementary subjects", ...] }
```

### Broadcast a Help Request

```javascript
// Instantly notifies the top 10 most relevant connections by subject expertise
await fetch("/connections/help/broadcast", {
  method: "POST",
  body: JSON.stringify({
    subject: "Organic Chemistry",
    message: "Need help with reaction mechanisms before tomorrow's exam"
  })
});
// Returns: { help_request_id, notified_count, expires_at }
// Expires in 2 hours. Connections can volunteer via POST /connections/help/<id>/volunteer
```

---

## 🤝 Contributing

Contributions are welcome. A few guidelines that reflect deliberate decisions already made in the codebase:

**AI integration:** All AI calls must go through `MultiProviderManager.get_working_provider()` and `StudyAssistant`. Do not instantiate AI requests directly. Provider rotation, health tracking, and quota management are centralized for a reason — bypassing the manager breaks the accounting.

**Database writes:** Wrap state-changing operations in `db.session.begin_nested()` and always call `db.session.rollback()` in exception handlers. Partial writes in an educational context can silently corrupt streak counts, reputation scores, and badge states in ways that are difficult to detect and hard to reverse.

**Background work:** Anything that does not need to block the request — badge checks, reputation recalculation, bulk notification dispatch — should be deferred. Do not add latency to the response path for work that can be async.

**Streaming endpoints:** New streaming routes must use `Response(stream_with_context(generate()), mimetype='text/event-stream')` and emit properly formatted SSE frames. Include `Cache-Control: no-cache` and `X-Accel-Buffering: no` headers for correct behavior behind reverse proxies.

---

## 📄 License

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

---

## 📬 Contact

**Developer:** Paul  
**GitHub:** [github.com/yourusername/study-hub](https://github.com/yourusername/study-hub)  
**Email:** youremail@example.com

---

<div align="center">

*Built because learning should not be a solo sport, and the right infrastructure can make the difference between a student who gets through and one who gets left behind.*

</div>
