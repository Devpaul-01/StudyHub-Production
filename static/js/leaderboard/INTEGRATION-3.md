# Leaderboard Feature — Integration Guide

## File inventory

| File | Purpose | Maps to existing pattern |
|------|---------|--------------------------|
| `leaderboard.api.js` | All HTTP calls | `notification.api.js` |
| `leaderboard.state.js` | Singleton state class | `notification.state.js` |
| `leaderboard.utils.js` | Pure helper functions | `notification.utils.js` |
| `leaderboard.templates.js` | HTML string builders | `notification.templates.js` |
| `leaderboard.events.js` | Async load/filter logic | `notification.events.js` |
| `leaderboard.delegation.js` | `data-action` handlers | `notification.delegation.js` |
| `leaderboard.init.js` | MutationObserver bootstrap | `notification.init.js` |
| `leaderboard_section.html` | `<section id="leaderboard">` snippet | Drop next to other sections |
| `leaderboard.css` | Feature styles | `notification.css` |
| `app_unified_updated.js` | `app.unified.js` with LeaderboardHandlers merged | Replace existing file |

---

## Step-by-step integration

### 1. Copy JS files

Place all `leaderboard.*.js` files into the same directory as your other
feature modules. If the existing pattern is `static/js/notification/`, use:

```
static/js/leaderboard/leaderboard.api.js
static/js/leaderboard/leaderboard.state.js
static/js/leaderboard/leaderboard.utils.js
static/js/leaderboard/leaderboard.templates.js
static/js/leaderboard/leaderboard.events.js
static/js/leaderboard/leaderboard.delegation.js
static/js/leaderboard/leaderboard.init.js
```

### 2. Add the CSS link

In `feed2.html`, inside `<head>` alongside the other stylesheet links:

```html
<link rel="stylesheet" href="{{ url_for('static', filename='css/leaderboard/leaderboard.css') }}">
```

### 3. Drop the HTML section

In `feed2.html`, paste the contents of `leaderboard_section.html` after the
`#notifications` section (or wherever your other `.section` elements live).

### 4. Import the init file

At the bottom of `feed2.html` (or your main script bundle), import the init
file so the MutationObserver wires up:

```html
<script type="module" src="{{ url_for('static', filename='js/leaderboard/leaderboard.init.js') }}"></script>
```

### 5. Merge into app.unified.js

Replace `app.unified.js` with `app_unified_updated.js`, OR manually apply
these two edits to your existing file:

**Add import at the top:**
```js
import { LeaderboardHandlers } from '../js/leaderboard/leaderboard.delegation.js';
```

**Spread into UNIFIED_ACTIONS:**
```js
const UNIFIED_ACTIONS = {
  // ... existing handlers ...
  ...LeaderboardHandlers,  // ← add this line
};
```

**Add leaderboard to detectContainer():**
```js
const lbSection = document.getElementById('leaderboard');
if (lbSection && lbSection.contains(element)) return 'leaderboard';
```

### 6. Verify `navigateTo` already handles leaderboard

Your `feed2.html` already has `'leaderboard'` in the `implementedSections`
array, so navigation works with zero changes needed.

---

## Backend endpoint mapping

| Frontend call | Backend route | Used in |
|---------------|--------------|---------|
| `leaderboardAPI.getGlobal()` | `GET /leaderboard/global` | `loadLeaderboard()` — global view |
| `leaderboardAPI.getConnections()` | `GET /leaderboard/connections` | `loadLeaderboard()` — connections view |
| `leaderboardAPI.getRising()` | `GET /leaderboard/rising` | `loadLeaderboard()` — rising view |
| `leaderboardAPI.getMyRank()` | `GET /leaderboard/me` | `loadLeaderboard()` — me view + strip |
| `leaderboardAPI.getNearby()` | `GET /leaderboard/nearby` | Inline during global load |
| `leaderboardAPI.getStats()` | `GET /leaderboard/stats` | Stats banner |
| `leaderboardAPI.getBreakdown()` | `GET /leaderboard/breakdown` | Breakdown panel |

All calls use the global `api` object already present in your app — no new
HTTP client needed.

---

## Department filter

The `<select id="lb-dept-filter">` in the HTML has hard-coded option values.
If your app has a known list of departments, match them here. If departments
are dynamic, you can populate the select from the stats response or a
dedicated endpoint in `leaderboard.init.js` after `initialLoad()`.

---

## Scoring tips / level thresholds

Level definitions in `leaderboard.utils.js` (`getLevelColor`) exactly mirror
`REPUTATION_LEVELS` in `leaderboard.py`. If you add new levels in the backend,
update this map too.

---

## What's intentionally not included

- **Real-time push updates** — not in the backend; add a Socket.IO listener
  calling `retryLoad()` if you add that later.
- **Share/celebrate rank** — easy addition in `LeaderboardHandlers` once UX
  direction is confirmed.
- **Admin snapshot trigger UI** — that lives in an admin panel, not this
  feature module.
