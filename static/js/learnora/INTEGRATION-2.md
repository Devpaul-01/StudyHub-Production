# Learnora Integration Guide

## File Structure

Place all 7 JS files here:

```
/static/js/learnora/
  learnora.api.js
  learnora.state.js
  learnora.utils.js
  learnora.templates.js
  learnora.events.js
  learnora.delegation.js
  learnora.init.js
```

---

## Step 1 — Replace the learnora section in feed2.html

Find this block (lines ~1011–1025 in your feed2.html):

```html
<section id="learnora" class="section">
    <div style="display:flex;flex-direction:column;...">
        ...COMING SOON placeholder...
    </div>
</section>
```

Replace it entirely with the contents of `learnora_section.html`.

---

## Step 2 — Add the init script in feed2.html

At the bottom of feed2.html, alongside the other module scripts, add:

```html
<script type="module" src="{{url_for('static', filename='/js/learnora/learnora.init.js')}}"></script>
```

Place it after the existing module script tags, e.g. after `analytics.init.js`.

---

## Step 3 — Wire into app_unified.js

In your `app_unified.js`, add the import:

```js
import { LearnoraHandlers } from '../js/learnora/learnora.delegation.js';
```

Then spread it into `UNIFIED_ACTIONS`:

```js
const UNIFIED_ACTIONS = {
  ...FeedHandlers,
  ...AnalyticsHandlers,
  ...ConnectionHandlers,
  ...HomeworkHandlers,
  ...NotificationHandlers,
  ...MessageHandlers,
  ...ProfileHandlers,
  ...LearnoraHandlers,   // ← add this
};
```

---

## Step 4 — Verify auth setup (important)

The streaming chat endpoint uses a raw `fetch()` call (EventSource doesn't support POST).
`learnora.api.js` has a `_getFetchOptions()` helper that tries to pull your auth token from:

1. `window.api._token` / `window.api.token` / `window.api._authToken`
2. Cookies named `access_token`, `token`, `jwt`, or `auth_token`
3. Falls back to `credentials: 'include'` (cookie-based sessions)

If your `api.js` stores the token differently, open `learnora.api.js` and update
the `_getFetchOptions()` function accordingly. This is the only auth-sensitive piece.

---

## What changed vs the original placeholder

| Before | After |
|--------|-------|
| Static "Coming Soon" card | Fully functional AI chat |
| No sidebar | Collapsible conversations sidebar |
| No API integration | Full SSE streaming connected to `/learnora/api/*` |
| No state | Reactive state manager (learnora.state.js) |
| Hardcoded | Mode selector: Fast / Deep Think / Code / Research / Summarize / Explain |
| None | File attachment support (images, PDFs, code, docs) |
| None | Inline title editing (double-click the header) |
| None | Daily quota display |
| None | Continue-response flow for incomplete AI replies |
| None | Markdown rendering (code blocks, lists, headers, bold, italic) |

---

## Architecture overview

```
learnora.init.js        ← boot + MutationObserver (mirrors notification.init.js)
  └── learnora.events.js  ← all business logic + SSE stream processor
        ├── learnora.api.js       ← HTTP layer
        ├── learnora.state.js     ← reactive store
        ├── learnora.utils.js     ← markdown, time, helpers
        └── learnora.templates.js ← pure HTML string functions

learnora.delegation.js  ← data-action handlers → spread into UNIFIED_ACTIONS
```

## Extending later

**Multiple tabs / pinned convs**: add a `pinned` boolean to the state's conversations array and filter in `renderConversationList()`.

**Conversation search**: add a search input above `#lr-conv-list` and filter `learnoraState.get('conversations')` client-side.

**Post context** (already supported by backend): add a `post_id` field to the FormData in `sendMessage()` — the backend `post_id` param is already wired.
