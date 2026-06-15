# Thread Feature — New Features Summary

## 🐛 Critical Bug Fixes

**@mention autocomplete inserted display names instead of usernames**
Typing `@john` would insert `@John Smith` instead of `@johndee`, silently breaking all mention notifications. Now correctly inserts `@username` and filters suggestions by username.

---

## 💬 Message Enhancements

**Syntax-highlighted code blocks**
Fenced code blocks (` ```python `, ` ```sql `, etc.) in messages now render with full syntax highlighting via highlight.js. Includes a Copy button. Supports Python, JS, TS, SQL, Java, C++, Bash, JSON, CSS, XML and auto-detection for everything else.

**Inline code**
Single backtick `` `code` `` renders styled inline code spans.

**@mention highlighting**
`@username` and `@learnora` / `@teacherai` etc. appear as coloured pills inside messages — blue for humans, violet for AI bots.

**Swipe-to-reply (mobile)**
Swipe right on any message to instantly trigger a reply — no long-press required. Haptic feedback on trigger.

**Quick-reply button (desktop)**
Hovering over someone else's message shows a `↩` button for one-click reply.

---

## 🤖 AI Enhancements

**Multiple AI personalities**
Five distinct AI bots, each with its own personality and trigger word:
- `@learnora` — general study assistant (default)
- `@teacherai` — structured educator, depth over brevity
- `@coderai` — senior engineer, always provides code examples
- `@productai` — product manager, structured Problem → Solution → Trade-offs
- `@funnyai` — humour and analogies

The "Learnora is thinking…" indicator shows the active personality's name.

**AI message actions (long-press any message)**
New AI Actions section in the options sheet:
- 💡 **Explain** — plain-language explanation
- 📝 **Summarize** — bullet-point summary
- 🌍 **Translate** — to any language (prompts for target)
- 💻 **Convert to Code** — description/pseudocode → working code
- 🔍 **Fact Check** — verdict + confidence + analysis (others' messages only)

**Auto-reply on AI message reply**
Replying directly to an AI message automatically triggers the AI to continue the conversation (rate-limited to 3 auto-replies per user per 5 minutes).

**AI knowledge detection**
Ask `@learnora who knows the most about databases here?` and Learnora analyses member message history to answer.

**AI history search**
Ask `@learnora when did we discuss Supabase RLS?` and Learnora searches the thread history and cites who said what and when.

**📋 AI Meeting Notes**
New button in the chat header. Generates structured notes from the last 50, 100, or 500 messages. Output includes: Topics Discussed, Decisions Made, Action Items, Open Questions, and a summary. Notes are saved to the database for later retrieval.

---

## 📎 Attachment Improvements

**Thumbnail previews**
Attachment strip shows image thumbnails and file-type icons before sending, instead of plain text chips.

**Gallery +X truncation**
Messages with more than 2 images show the first 2 inline with a `+N` overlay on the second. Clicking opens the full gallery.

**Download overlay on images**
Hovering any inline image reveals a `⬇` download button.

---

## 📬 Invites Tab — Three Sections

The Invites tab now shows three sections instead of one flat list:

| Section | Contents | Actions |
|---|---|---|
| 📬 Invitations | Threads others invited me to | Accept / Decline |
| 📤 My Requests | Join requests I sent | Cancel |
| 🛡 Moderation Queue | Requests pending in threads I moderate/own | Approve / Reject |

Badge count reflects the number of items needing action (invitations + moderation queue).

---

## 🧵 Thread List Improvements

- **Department badge** — small pill showing the thread's department in the list item
- **Closed indicator** — 🔒 next to closed threads

---

## 🗄️ Database

Two new additions:
- `thread_messages.ai_personality` — records which AI personality sent each AI message
- `thread_meeting_notes` table — stores generated meeting notes per thread
