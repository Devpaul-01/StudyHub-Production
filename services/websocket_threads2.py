"""
Thread WebSocket Manager — PRODUCTION
Handles real-time group chat for the Thread (study group) system.

Features:
- Room-based architecture  → one SocketIO room per thread ("thread_{id}")
- JWT auth shared with MessageWebSocketManager (no duplicate auth state)
- Send / broadcast messages with full metadata
- Typing indicators per thread (multi-user aware)
- Emoji reactions  (add / toggle / remove)
- Reply-to-message (quoted context)
- Pin / unpin messages (creator + moderator)
- Edit and delete messages (ownership + role checks)
- Mark thread as read
- @mention detection + Notification creation
- Learnora (AI) trigger on @learnora mention — runs async so send never blocks

Fixes merged vs original:
  - join_thread_room: also joins user-specific room f"user_{user_id}"
    (enables per-user delivered/read status pushes)
  - _build_message_payload: includes `status` field ('sent'|'delivered'|'read')
  - send_thread_message: per-user sliding-window rate limiter added
  - mark_thread_read: upserts ThreadMessageReadReceipt rows and emits
    message_status_updated to each original sender's personal room
  - message_delivered handler: new — upgrades status sent→delivered,
    pushes message_status_updated to sender's personal room
  - _call_learnora_for_thread: uses app.config["LEARNORA_BOT_USER_ID"]
    with a hard guard so missing config never crashes the handler

Architecture:
  Shares the SocketIO instance created by MessageWebSocketManager.
  Auth state (socket_to_user) is read from message_ws_manager.
  Both managers register handlers on the same socketio object.

Usage in app factory:
  from websocket_messages import message_ws_manager, init_message_websocket
  from websocket_threads import thread_ws_manager

  socketio = init_message_websocket(app)
  thread_ws_manager.init_socketio(app, socketio)
"""

import bleach
import threading
import datetime
import time
import os

from flask_socketio import emit, join_room, leave_room
from flask import request, current_app
from sqlalchemy import func

from extensions import db
from models import (
    User, Thread, ThreadMember, ThreadMessage,
    ThreadMessageReaction, ThreadMessageReadReceipt,
    Mention, Notification
)

import logging
logger = logging.getLogger(__name__)

# ============================================================================
# CONSTANTS
# ============================================================================

MAX_MESSAGE_LENGTH   = 5_000
MAX_PINS_PER_THREAD  = 5
LEARNORA_TRIGGERS    = ["@learnora"]
EDIT_WINDOW_SECONDS  = 900

# Per-user rate limit  (env-overridable)
_RATE_LIMIT_MAX    = int(os.environ.get("THREAD_MSG_RATE_MAX",    "30"))
_RATE_LIMIT_WINDOW = int(os.environ.get("THREAD_MSG_RATE_WINDOW", "60"))  # seconds

# In-memory sliding-window buckets  { user_id: [monotonic_timestamp, …] }
_send_buckets: dict[int, list[float]] = {}


# ============================================================================
# MODULE-LEVEL HELPERS
# ============================================================================

def _user_room(user_id: int) -> str:
    """Personal SocketIO room for targeted per-user events (status ticks)."""
    return f"user_{user_id}"


def _is_rate_limited(user_id: int) -> bool:
    """
    Sliding-window rate limiter.
    Returns True (blocked) if the user has sent >= _RATE_LIMIT_MAX messages
    in the last _RATE_LIMIT_WINDOW seconds.
    """
    now    = time.monotonic()
    cutoff = now - _RATE_LIMIT_WINDOW
    bucket = [ts for ts in _send_buckets.get(user_id, []) if ts > cutoff]
    if len(bucket) >= _RATE_LIMIT_MAX:
        _send_buckets[user_id] = bucket
        return True
    bucket.append(now)
    _send_buckets[user_id] = bucket
    return False


# ============================================================================
# THREAD TYPING MANAGER
# ============================================================================

class ThreadTypingManager:
    """
    Tracks per-thread typing state for all active users.
    Structure: { thread_id: { user_id: last_typed_at } }
    Auto-expires after `timeout` seconds (3 s default).
    """

    def __init__(self, timeout: int = 3):
        self.typing: dict[int, dict[int, datetime.datetime]] = {}
        self.timeout = timeout

    def set_typing(self, thread_id: int, user_id: int) -> None:
        self.typing.setdefault(thread_id, {})[user_id] = datetime.datetime.utcnow()

    def stop_typing(self, thread_id: int, user_id: int) -> None:
        if thread_id in self.typing:
            self.typing[thread_id].pop(user_id, None)

    def cleanup_expired(self) -> None:
        """Called lazily on each typing event — removes stale indicators."""
        now = datetime.datetime.utcnow()
        for tid in list(self.typing):
            for uid in list(self.typing[tid]):
                if (now - self.typing[tid][uid]).total_seconds() > self.timeout:
                    del self.typing[tid][uid]
            if not self.typing[tid]:
                del self.typing[tid]


# ============================================================================
# THREAD WEBSOCKET MANAGER
# ============================================================================

class ThreadWebSocketManager:
    """
    Production WebSocket manager for the Thread group chat system.
    Registers all handlers on the shared SocketIO instance.
    """

    def __init__(self):
        self.socketio   = None
        self.app        = None
        self.typing_mgr = ThreadTypingManager(timeout=3)

    # ------------------------------------------------------------------ #
    # INIT                                                                 #
    # ------------------------------------------------------------------ #

    def init_socketio(self, app, socketio) -> None:
        """
        Attach to an existing SocketIO instance (created by message_ws_manager).
        Call this AFTER init_message_websocket().
        """
        self.socketio = socketio
        self.app      = app
        self.register_handlers()
        logger.info("Thread WebSocket handlers registered")

    # ------------------------------------------------------------------ #
    # HELPERS                                                              #
    # ------------------------------------------------------------------ #

    def _get_current_user(self) -> int | None:
        """
        Read user_id from the shared socket->user map owned by
        MessageWebSocketManager.  Avoids duplicating auth state.
        """
        from services.websocket_messages import message_ws_manager
        return message_ws_manager.socket_to_user.get(request.sid)

    def _emit_error(self, message: str) -> None:
        emit("thread_error", {"message": message})

    def _sanitize(self, text: str) -> str:
        """Strip all HTML — plain text only in thread messages."""
        if not text:
            return text
        return bleach.clean(text, tags=[], strip=True).strip()

    def _is_member(self, thread_id: int, user_id: int) -> "ThreadMember | None":
        return ThreadMember.query.filter_by(
            thread_id=thread_id,
            student_id=user_id
        ).first()

    def _is_moderator_or_creator(self, membership: "ThreadMember") -> bool:
        return membership.role in ("creator", "moderator")

    def _parse_mentions(self, text: str) -> list[int]:
        """Extract @username mentions. Returns list of matched user_ids."""
        import re
        found_ids = []
        for username in re.findall(r"@([A-Za-z0-9_]+)", text):
            if username.lower() == "learnora":
                continue
            user = User.query.filter_by(username=username).first()
            if user:
                found_ids.append(user.id)
        return found_ids

    def _build_message_payload(self, msg: "ThreadMessage", sender: "User") -> dict:
        """
        Serialize a ThreadMessage for WebSocket delivery.
        FIX: includes `status` field for client-side tick rendering.
        """
        reply_preview = None
        if msg.reply_to_id:
            parent = ThreadMessage.query.get(msg.reply_to_id)
            if parent:
                parent_sender = User.query.get(parent.sender_id)
                reply_preview = {
                    "id":        parent.id,
                    "text":      parent.text_content[:120],
                    "sender":    parent_sender.name if parent_sender else "Unknown",
                    "sender_id": parent.sender_id
                }

        reactions = self._build_reactions(msg.id)

        return {
            "id":              msg.id,
            "thread_id":       msg.thread_id,
            "text_content":    msg.text_content,
            "sender_id":       msg.sender_id,
            "sender": {
                "id":       sender.id,
                "name":     sender.name,
                "username": sender.username,
                "avatar":   sender.avatar
            },
            "is_ai_response":  msg.is_ai_response,
            "is_edited":       msg.is_edited,
            "is_pinned":       msg.is_pinned,
            "reply_to":        reply_preview,
            "reply_to_id":     msg.reply_to_id,
            "attachment_url":  msg.attachment_url,
            "attachment_name": msg.attachment_name,
            "attachment_type": msg.attachment_type,
            "attachment_size": msg.attachment_size,
            "reactions":       reactions,
            "status":          getattr(msg, "status", "sent"),  # NEW: delivery status
            "sent_at":         msg.sent_at.isoformat() + "Z",
            "edited_at":       msg.edited_at.isoformat() + "Z" if msg.edited_at else None,
        }

    def _build_reactions(self, message_id: int) -> dict:
        """Return grouped reaction counts for a message."""
        rows    = ThreadMessageReaction.query.filter_by(message_id=message_id).all()
        grouped: dict[str, dict] = {}
        for r in rows:
            if r.emoji not in grouped:
                grouped[r.emoji] = {"emoji": r.emoji, "count": 0, "users": []}
            grouped[r.emoji]["count"] += 1
            grouped[r.emoji]["users"].append(r.user_id)
        return grouped

    def broadcast_to_thread(self, thread_id: int, event: str, data: dict) -> None:
        """Emit an event to every connected member of a thread room."""
        if self.socketio:
            self.socketio.emit(event, data, room=f"thread_{thread_id}")

    def notify_user(self, user_id: int, event: str, data: dict) -> None:
        """Emit a targeted event to a single user's personal room."""
        if self.socketio:
            self.socketio.emit(event, data, room=_user_room(user_id))

    def broadcast_ai_message(self, thread_id: int, msg: "ThreadMessage", text: str) -> None:
        """
        Called from the Learnora background thread after saving the AI reply.
        Emits to the thread room so all connected members see it instantly.
        """
        bot_user = User.query.get(msg.sender_id)
        payload = {
            "id":             msg.id,
            "thread_id":      thread_id,
            "text_content":   text,
            "sender_id":      msg.sender_id,
            "sender": {
                "id":       msg.sender_id,
                "name":     bot_user.name if bot_user else "Learnora",
                "username": bot_user.username if bot_user else "learnora",
                "avatar":   bot_user.avatar if bot_user else None
            },
            "is_ai_response":  True,
            "is_edited":       False,
            "is_pinned":       False,
            "reply_to":        None,
            "reactions":       {},
            "status":          "sent",
            "sent_at":         msg.sent_at.isoformat() + "Z",
        }
        self.broadcast_to_thread(thread_id, "new_thread_message", payload)

    # ------------------------------------------------------------------ #
    # REGISTER ALL HANDLERS                                               #
    # ------------------------------------------------------------------ #

    def register_handlers(self) -> None:

        sio = self.socketio

        # ================================================================
        # JOIN / LEAVE ROOM
        # ================================================================

        @sio.on("join_thread_room")
        def handle_join_thread_room(data):
            """
            Client calls this when opening a thread chat view.
            FIX: also joins user-specific room f"user_{user_id}" so that
                 message_status_updated events reach the sender's socket.

            Payload: { "thread_id": <int> }
            Emits back: "thread_room_joined"
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            thread_id = data.get("thread_id")
            if not thread_id:
                self._emit_error("thread_id required")
                return

            membership = self._is_member(thread_id, user_id)
            if not membership:
                self._emit_error("You are not a member of this thread")
                return

            # Join shared thread room
            join_room(f"thread_{thread_id}")

            # FIX: join personal room for targeted status push-events
            join_room(_user_room(user_id))

            # Update last_read_at so unread count resets immediately
            membership.last_read_at = datetime.datetime.utcnow()
            db.session.commit()

            emit("thread_room_joined", {
                "thread_id": thread_id,
                "your_role": membership.role
            })
            logger.info(f"User {user_id} joined thread room {thread_id}")

        # ----------------------------------------------------------------

        @sio.on("leave_thread_room")
        def handle_leave_thread_room(data):
            """
            Client calls when closing a thread view.
            Note: personal room is intentionally NOT left — the user may
                  still be in other threads and needs status pushes.

            Payload: { "thread_id": <int> }
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            thread_id = data.get("thread_id")
            if not thread_id:
                return

            self.typing_mgr.stop_typing(thread_id, user_id)
            leave_room(f"thread_{thread_id}")
            logger.info(f"User {user_id} left thread room {thread_id}")

        # ================================================================
        # SEND MESSAGE
        # ================================================================

        @sio.on("send_thread_message")
        def handle_send_thread_message(data):
            """
            Send a new message to a thread.

            FIX: per-user sliding-window rate limiter applied before persist.
            FIX: `status` included in both confirmation and broadcast payloads.

            Payload:
              thread_id        int  (required)
              text_content     str  (required unless attachment present)
              reply_to_id      int  (optional)
              attachment_url   str  (optional)
              attachment_name  str  (optional)
              attachment_type  str  (optional)
              attachment_size  int  (optional)
              client_temp_id   str  (optional)

            Emits:
              -> "new_thread_message"   to thread room (all members)
              -> "thread_message_sent"  to sender only (confirmation with real ID)
              -> "learnora_thinking"    to thread room if @learnora detected
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                thread_id       = data.get("thread_id")
                text_content    = data.get("text_content", "").strip()
                reply_to_id     = data.get("reply_to_id")
                attachment_url  = data.get("attachment_url")
                attachment_name = data.get("attachment_name")
                attachment_type = data.get("attachment_type")
                attachment_size = data.get("attachment_size")
                client_temp_id  = data.get("client_temp_id")

                if not thread_id:
                    self._emit_error("thread_id required")
                    return

                if not text_content and not attachment_url:
                    self._emit_error("Message must have text or an attachment")
                    return

                if len(text_content) > MAX_MESSAGE_LENGTH:
                    self._emit_error(f"Message too long (max {MAX_MESSAGE_LENGTH} characters)")
                    return

                # ── Rate limit (FIX) ────────────────────────────────────
                if _is_rate_limited(user_id):
                    emit("thread_error", {
                        "message":        f"Slow down — max {_RATE_LIMIT_MAX} messages per minute",
                        "client_temp_id": client_temp_id
                    })
                    return

                membership = self._is_member(thread_id, user_id)
                if not membership:
                    self._emit_error("You are not a member of this thread")
                    return

                thread = Thread.query.get(thread_id)
                if not thread:
                    self._emit_error("Thread not found")
                    return

                if not thread.is_open:
                    self._emit_error("This thread is closed")
                    return

                # ── Validate reply_to_id ────────────────────────────────
                if reply_to_id:
                    parent = ThreadMessage.query.filter_by(
                        id=reply_to_id,
                        thread_id=thread_id,
                        is_deleted=False
                    ).first()
                    if not parent:
                        reply_to_id = None  # silently drop invalid ref

                # ── Sanitize ────────────────────────────────────────────
                text_content = self._sanitize(text_content) if text_content else ""

                # ── Persist ─────────────────────────────────────────────
                msg = ThreadMessage(
                    thread_id       = thread_id,
                    sender_id       = user_id,
                    text_content    = text_content,
                    reply_to_id     = reply_to_id,
                    attachment_url  = attachment_url,
                    attachment_name = attachment_name,
                    attachment_type = attachment_type,
                    attachment_size = attachment_size,
                    is_ai_response  = False,
                    status          = "sent",
                    sent_at         = datetime.datetime.utcnow()
                )
                db.session.add(msg)
                db.session.flush()

                # ── Atomic counter updates ──────────────────────────────
                ThreadMember.query.filter_by(
                    thread_id=thread_id, student_id=user_id
                ).update(
                    {ThreadMember.messages_sent: ThreadMember.messages_sent + 1},
                    synchronize_session=False
                )
                Thread.query.filter_by(id=thread_id).update(
                    {
                        Thread.message_count: Thread.message_count + 1,
                        Thread.last_activity: datetime.datetime.utcnow()
                    },
                    synchronize_session=False
                )

                # ── Mentions ────────────────────────────────────────────
                mentioned_ids = self._parse_mentions(text_content)
                for mid in mentioned_ids:
                    if mid == user_id:
                        continue
                    db.session.add(Mention(
                        mentioned_in_type    = "thread_message",
                        mentioned_in_id      = msg.id,
                        mentioned_user_id    = mid,
                        mentioned_by_user_id = user_id
                    ))
                    db.session.add(Notification(
                        user_id           = mid,
                        title             = "You were mentioned in a thread",
                        body              = f"{text_content[:80]}...",
                        notification_type = "thread_mention",
                        related_type      = "thread",
                        related_id        = thread_id
                    ))

                db.session.commit()

                # ── Build and broadcast ──────────────────────────────────
                sender  = User.query.get(user_id)
                payload = self._build_message_payload(msg, sender)
                payload["client_temp_id"] = client_temp_id

                # Broadcast to ALL room members (including sender's other tabs)
                self.broadcast_to_thread(thread_id, "new_thread_message", payload)

                # Confirmation to this socket with the real message ID
                emit("thread_message_sent", {
                    "id":             msg.id,
                    "client_temp_id": client_temp_id,
                    "sent_at":        msg.sent_at.isoformat() + "Z",
                    "status":         msg.status,
                })

                # ── Learnora trigger ────────────────────────────────────
                lower        = text_content.lower()
                ai_triggered = any(t in lower for t in LEARNORA_TRIGGERS)

                if ai_triggered:
                    self.broadcast_to_thread(thread_id, "learnora_thinking", {
                        "thread_id": thread_id
                    })
                    app_ref = current_app._get_current_object()
                    t = threading.Thread(
                        target=_call_learnora_for_thread,
                        args=(app_ref, thread_id, text_content, user_id),
                        daemon=True
                    )
                    t.start()

            except Exception as e:
                current_app.logger.error(f"send_thread_message error: {e}", exc_info=True)
                db.session.rollback()
                emit("thread_message_error", {
                    "message":        "Failed to send message",
                    "client_temp_id": data.get("client_temp_id")
                })

        # ================================================================
        # TYPING INDICATORS
        # ================================================================

        @sio.on("thread_typing")
        def handle_thread_typing(data):
            """
            Notify other thread members that this user is typing.
            Payload: { "thread_id": <int> }
            Emits:   "thread_typing_started" to room (except sender)
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            try:
                thread_id = data.get("thread_id")
                if not thread_id:
                    return

                if not self._is_member(thread_id, user_id):
                    return

                self.typing_mgr.cleanup_expired()
                self.typing_mgr.set_typing(thread_id, user_id)

                user = User.query.get(user_id)
                self.socketio.emit(
                    "thread_typing_started",
                    {"thread_id": thread_id, "user_id": user_id,
                     "user_name": user.name if user else "Someone"},
                    room=f"thread_{thread_id}",
                    include_self=False
                )

            except Exception as e:
                current_app.logger.error(f"thread_typing error: {e}")

        # ----------------------------------------------------------------

        @sio.on("thread_typing_stop")
        def handle_thread_typing_stop(data):
            """
            Payload: { "thread_id": <int> }
            Emits:   "thread_typing_stopped" to room (except sender)
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            try:
                thread_id = data.get("thread_id")
                if not thread_id:
                    return

                self.typing_mgr.stop_typing(thread_id, user_id)

                self.socketio.emit(
                    "thread_typing_stopped",
                    {"thread_id": thread_id, "user_id": user_id},
                    room=f"thread_{thread_id}",
                    include_self=False
                )

            except Exception as e:
                current_app.logger.error(f"thread_typing_stop error: {e}")

        # ================================================================
        # REACTIONS
        # ================================================================

        @sio.on("add_thread_reaction")
        def handle_add_thread_reaction(data):
            """
            Add or change an emoji reaction. Sending the same emoji toggles it off.
            Payload: { "message_id": <int>, "emoji": "🔥" }
            Emits:   "thread_reactions_updated" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                message_id = data.get("message_id")
                emoji      = data.get("emoji", "").strip()

                if not message_id or not emoji:
                    self._emit_error("message_id and emoji required")
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id, is_deleted=False
                ).first()
                if not msg:
                    self._emit_error("Message not found")
                    return

                if not self._is_member(msg.thread_id, user_id):
                    self._emit_error("You are not a member of this thread")
                    return

                existing = ThreadMessageReaction.query.filter_by(
                    message_id=message_id,
                    user_id=user_id
                ).first()

                if existing:
                    if existing.emoji == emoji:
                        db.session.delete(existing)
                    else:
                        existing.emoji = emoji
                else:
                    db.session.add(ThreadMessageReaction(
                        message_id=message_id,
                        user_id=user_id,
                        emoji=emoji
                    ))

                db.session.commit()

                reactions = self._build_reactions(message_id)
                self.broadcast_to_thread(msg.thread_id, "thread_reactions_updated", {
                    "message_id": message_id,
                    "reactions":  reactions
                })

            except Exception as e:
                current_app.logger.error(f"add_thread_reaction error: {e}", exc_info=True)
                db.session.rollback()

        # ----------------------------------------------------------------

        @sio.on("remove_thread_reaction")
        def handle_remove_thread_reaction(data):
            """
            Explicitly remove own reaction.
            Payload: { "message_id": <int> }
            Emits:   "thread_reactions_updated" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            try:
                message_id = data.get("message_id")
                if not message_id:
                    return

                msg = ThreadMessage.query.get(message_id)
                if not msg:
                    return

                reaction = ThreadMessageReaction.query.filter_by(
                    message_id=message_id,
                    user_id=user_id
                ).first()

                if reaction:
                    db.session.delete(reaction)
                    db.session.commit()

                reactions = self._build_reactions(message_id)
                self.broadcast_to_thread(msg.thread_id, "thread_reactions_updated", {
                    "message_id": message_id,
                    "reactions":  reactions
                })

            except Exception as e:
                current_app.logger.error(f"remove_thread_reaction error: {e}", exc_info=True)
                db.session.rollback()

        # ================================================================
        # EDIT MESSAGE
        # ================================================================

        @sio.on("edit_thread_message")
        def handle_edit_thread_message(data):
            """
            Edit own message within the edit window (15 min).
            Payload: { "message_id": <int>, "text_content": "new text" }
            Emits:   "thread_message_edited" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                message_id = data.get("message_id")
                new_text   = (data.get("text_content") or "").strip()

                if not message_id or not new_text:
                    self._emit_error("message_id and text_content required")
                    return

                if len(new_text) > MAX_MESSAGE_LENGTH:
                    self._emit_error(f"Message too long (max {MAX_MESSAGE_LENGTH} chars)")
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id,
                    sender_id=user_id,
                    is_deleted=False
                ).first()

                if not msg:
                    self._emit_error("Message not found or you don't own it")
                    return

                if msg.is_ai_response:
                    self._emit_error("AI messages cannot be edited")
                    return

                membership = self._is_member(msg.thread_id, user_id)
                if membership and not self._is_moderator_or_creator(membership):
                    seconds_old = (datetime.datetime.utcnow() - msg.sent_at).total_seconds()
                    if seconds_old > EDIT_WINDOW_SECONDS:
                        self._emit_error("Edit window expired (15 minutes)")
                        return

                msg.text_content = self._sanitize(new_text)
                msg.is_edited    = True
                msg.edited_at    = datetime.datetime.utcnow()
                db.session.commit()

                self.broadcast_to_thread(msg.thread_id, "thread_message_edited", {
                    "message_id":   message_id,
                    "text_content": msg.text_content,
                    "edited_at":    msg.edited_at.isoformat() + "Z"
                })

            except Exception as e:
                current_app.logger.error(f"edit_thread_message error: {e}", exc_info=True)
                db.session.rollback()

        # ================================================================
        # DELETE MESSAGE
        # ================================================================

        @sio.on("delete_thread_message")
        def handle_delete_thread_message(data):
            """
            Soft-delete a message.
            Sender can delete own; creator/moderator can delete anyone's.
            Payload: { "message_id": <int> }
            Emits:   "thread_message_deleted" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                message_id = data.get("message_id")
                if not message_id:
                    self._emit_error("message_id required")
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id, is_deleted=False
                ).first()
                if not msg:
                    self._emit_error("Message not found")
                    return

                membership = self._is_member(msg.thread_id, user_id)
                if not membership:
                    self._emit_error("Not a thread member")
                    return

                is_own_message = msg.sender_id == user_id
                is_privileged  = self._is_moderator_or_creator(membership)

                if not is_own_message and not is_privileged:
                    self._emit_error("You cannot delete this message")
                    return

                msg.is_deleted   = True
                msg.text_content = "[deleted]"

                Thread.query.filter_by(id=msg.thread_id).update(
                    {Thread.message_count: func.greatest(Thread.message_count - 1, 0)},
                    synchronize_session=False
                )

                db.session.commit()

                self.broadcast_to_thread(msg.thread_id, "thread_message_deleted", {
                    "message_id": message_id,
                    "deleted_by": user_id
                })

            except Exception as e:
                current_app.logger.error(f"delete_thread_message error: {e}", exc_info=True)
                db.session.rollback()

        # ================================================================
        # PIN / UNPIN MESSAGE
        # ================================================================

        @sio.on("pin_thread_message")
        def handle_pin_thread_message(data):
            """
            Pin a message (creator / moderator only). Max 5 per thread.
            Payload: { "message_id": <int> }
            Emits:   "thread_message_pinned" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                message_id = data.get("message_id")
                if not message_id:
                    self._emit_error("message_id required")
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id, is_deleted=False
                ).first()
                if not msg:
                    self._emit_error("Message not found")
                    return

                membership = self._is_member(msg.thread_id, user_id)
                if not membership or not self._is_moderator_or_creator(membership):
                    self._emit_error("Only creator or moderator can pin messages")
                    return

                if msg.is_pinned:
                    self._emit_error("Message is already pinned")
                    return

                pinned_count = ThreadMessage.query.filter_by(
                    thread_id=msg.thread_id, is_pinned=True, is_deleted=False
                ).count()
                if pinned_count >= MAX_PINS_PER_THREAD:
                    self._emit_error(f"Max {MAX_PINS_PER_THREAD} pinned messages per thread")
                    return

                msg.is_pinned    = True
                msg.pinned_by_id = user_id
                db.session.commit()

                sender = User.query.get(msg.sender_id)
                self.broadcast_to_thread(msg.thread_id, "thread_message_pinned", {
                    "message_id": message_id,
                    "is_pinned":  True,            # FIX: client sets msg.is_pinned = data.is_pinned
                    "pinned_by":  user_id,
                    "text":       msg.text_content[:120],
                    "sender":     sender.name if sender else "Unknown"
                })

            except Exception as e:
                current_app.logger.error(f"pin_thread_message error: {e}", exc_info=True)
                db.session.rollback()

        # ----------------------------------------------------------------

        @sio.on("unpin_thread_message")
        def handle_unpin_thread_message(data):
            """
            Unpin a message (creator / moderator only).
            Payload: { "message_id": <int> }
            Emits:   "thread_message_unpinned" to room
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                message_id = data.get("message_id")
                if not message_id:
                    self._emit_error("message_id required")
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id, is_deleted=False, is_pinned=True
                ).first()
                if not msg:
                    self._emit_error("Pinned message not found")
                    return

                membership = self._is_member(msg.thread_id, user_id)
                if not membership or not self._is_moderator_or_creator(membership):
                    self._emit_error("Only creator or moderator can unpin messages")
                    return

                msg.is_pinned    = False
                msg.pinned_by_id = None
                db.session.commit()

                self.broadcast_to_thread(msg.thread_id, "thread_message_unpinned", {
                    "message_id": message_id,
                    "is_pinned":  False            # FIX: client sets msg.is_pinned = data.is_pinned
                })

            except Exception as e:
                current_app.logger.error(f"unpin_thread_message error: {e}", exc_info=True)
                db.session.rollback()

        # ================================================================
        # MARK THREAD AS READ
        # ================================================================

        @sio.on("mark_thread_read")
        def handle_mark_thread_read(data):
            """
            Update the member's last_read_at so unread counts reset.
            Client should call this whenever the thread chat is visible.

            FIX: upserts ThreadMessageReadReceipt rows and emits
                 message_status_updated per sender, enabling blue ticks.

            Payload: { "thread_id": <int> }
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            try:
                thread_id = data.get("thread_id")
                if not thread_id:
                    return

                membership = self._is_member(thread_id, user_id)
                if not membership:
                    return

                now = datetime.datetime.utcnow()

                # FIX: batch query — 1 SELECT instead of one-per-message
                cutoff = membership.last_read_at or datetime.datetime.min
                unread_messages = ThreadMessage.query.filter(
                    ThreadMessage.thread_id == thread_id,
                    ThreadMessage.sender_id != user_id,
                    ThreadMessage.is_deleted == False,
                    ThreadMessage.sent_at > cutoff,
                ).all()

                sender_msg_map: dict[int, list[int]] = {}

                if unread_messages:
                    msg_ids = [m.id for m in unread_messages]

                    # FIX: single batch SELECT for existing receipts
                    existing_receipt_ids = {
                        r.message_id for r in ThreadMessageReadReceipt.query.filter(
                            ThreadMessageReadReceipt.message_id.in_(msg_ids),
                            ThreadMessageReadReceipt.user_id == user_id
                        ).all()
                    }

                    # Bulk insert missing receipts
                    new_receipts = [
                        ThreadMessageReadReceipt(message_id=mid, user_id=user_id, read_at=now)
                        for mid in msg_ids
                        if mid not in existing_receipt_ids
                    ]
                    if new_receipts:
                        db.session.add_all(new_receipts)

                    # FIX: single bulk UPDATE instead of one per message
                    ThreadMessage.query.filter(
                        ThreadMessage.id.in_(msg_ids),
                        ThreadMessage.status != 'read'
                    ).update({ThreadMessage.status: 'read'}, synchronize_session=False)

                    for msg in unread_messages:
                        sender_msg_map.setdefault(msg.sender_id, []).append(msg.id)

                ThreadMember.query.filter_by(
                    thread_id=thread_id, student_id=user_id
                ).update(
                    {ThreadMember.last_read_at: now},
                    synchronize_session=False
                )
                db.session.commit()

                # Push read status to each original sender's personal room
                for sender_id, msg_ids in sender_msg_map.items():
                    self.socketio.emit(
                        "message_status_updated",
                        {
                            "thread_id":   thread_id,
                            "message_ids": msg_ids,
                            "status":      "read",
                            "by_user_id":  user_id,
                        },
                        room=_user_room(sender_id)
                    )

            except Exception as e:
                current_app.logger.error(f"mark_thread_read error: {e}")
                db.session.rollback()

        # ================================================================
        # MESSAGE DELIVERED  (NEW)
        # ================================================================

        @sio.on("message_delivered")
        def handle_message_delivered(data):
            """
            NEW: Client emits this when it first renders a message sent by
            another user. Upgrades message.status sent->delivered and pushes
            message_status_updated to the sender's personal room.

            Payload: { "message_id": <int> }
            """
            user_id = self._get_current_user()
            if not user_id:
                return

            try:
                message_id = data.get("message_id")
                if not message_id:
                    return

                msg = ThreadMessage.query.filter_by(
                    id=message_id, is_deleted=False
                ).first()
                if not msg or msg.sender_id == user_id:
                    return

                if not self._is_member(msg.thread_id, user_id):
                    return

                # Only upgrade; never downgrade read -> delivered
                if getattr(msg, "status", "sent") == "sent":
                    msg.status = "delivered"
                    db.session.commit()

                    self.socketio.emit(
                        "message_status_updated",
                        {
                            "thread_id":   msg.thread_id,
                            "message_ids": [msg.id],
                            "status":      "delivered",
                            "by_user_id":  user_id,
                        },
                        room=_user_room(msg.sender_id)
                    )

            except Exception as e:
                current_app.logger.error(f"message_delivered error: {e}")
                db.session.rollback()

        # ================================================================
        # EXPLICIT AI REQUEST
        # ================================================================

        @sio.on("request_ai_response")
        def handle_request_ai_response(data):
            """
            Explicitly trigger Learnora without mentioning @learnora in chat.
            Useful for a dedicated "Ask AI" button in the UI.

            Payload:
              thread_id   int   (required)
              question    str   (required)
              mode        str   (optional: "summarize" | "quiz" | default)

            Emits: "learnora_thinking" immediately, then "new_thread_message"
            """
            user_id = self._get_current_user()
            if not user_id:
                self._emit_error("Authentication required")
                return

            try:
                thread_id = data.get("thread_id")
                question  = (data.get("question") or "").strip()
                mode      = data.get("mode", "")

                if not thread_id or not question:
                    self._emit_error("thread_id and question required")
                    return

                if not self._is_member(thread_id, user_id):
                    self._emit_error("You are not a member of this thread")
                    return

                prefix = ""
                if mode == "summarize":
                    prefix = "@learnora summarize "
                elif mode == "quiz":
                    prefix = "@learnora quiz me on "

                trigger_text = f"{prefix}{question}"

                self.broadcast_to_thread(thread_id, "learnora_thinking", {
                    "thread_id": thread_id
                })

                app_ref = current_app._get_current_object()
                t = threading.Thread(
                    target=_call_learnora_for_thread,
                    args=(app_ref, thread_id, trigger_text, user_id),
                    daemon=True
                )
                t.start()

            except Exception as e:
                current_app.logger.error(f"request_ai_response error: {e}", exc_info=True)


# ============================================================================
# LEARNORA BACKGROUND FUNCTION
# ============================================================================

def _call_learnora_for_thread(app, thread_id: int, trigger_text: str, triggering_user_id: int) -> None:
    """
    Runs in a daemon thread. Never blocks the WebSocket send path.

    FIX: uses app.config.get("LEARNORA_BOT_USER_ID", 0) with a hard guard —
         if 0 or not configured, exits immediately without crashing.

    Steps:
      1. Fetch recent thread messages for context
      2. Build system + history + user prompt
      3. Call provider (non-streaming, 30s timeout)
      4. Save AI reply as ThreadMessage (sender = bot user)
      5. Broadcast to thread room via thread_ws_manager
    """
    with app.app_context():
        try:
            bot_user_id = app.config.get("LEARNORA_BOT_USER_ID", 0)

            # FIX: hard guard — skip entirely if bot not configured
            if not bot_user_id:
                logger.debug("Learnora: LEARNORA_BOT_USER_ID not configured — skipping")
                return

            if triggering_user_id == bot_user_id:
                return

            thread = Thread.query.get(thread_id)
            if not thread:
                return

            # ── Build conversation context ────────────────────────────
            recent = (
                ThreadMessage.query
                .filter_by(thread_id=thread_id, is_deleted=False)
                .order_by(ThreadMessage.sent_at.desc())
                .limit(12)
                .all()
            )
            recent.reverse()

            history = []
            for m in recent:
                sender = User.query.get(m.sender_id)
                role   = "assistant" if m.is_ai_response else "user"
                name   = "Learnora" if m.is_ai_response else (sender.name if sender else "Student")
                history.append({
                    "role":    role,
                    "content": f"[{name}]: {m.text_content}"
                })

            # ── System prompt ─────────────────────────────────────────
            system = (
                f"You are Learnora, an AI study assistant inside a group study thread "
                f"titled \"{thread.title}\". "
            )
            if thread.department:
                system += f"Department: {thread.department}. "
            if thread.tags:
                system += f"Topics: {', '.join(thread.tags)}. "
            system += (
                "Keep responses concise (2-4 sentences unless detail is requested). "
                "You are one participant among students — be helpful, not lecture-heavy. "
                "Never repeat information already stated in the thread."
            )

            lower = trigger_text.lower()
            if "@learnora summarize" in lower:
                system += (
                    " The user wants a concise bullet-point summary of "
                    "what was discussed in this thread so far."
                )
            elif "@learnora quiz" in lower:
                system += (
                    f" Generate exactly 3 short comprehension questions based on "
                    f"the conversation and the topic \"{thread.title}\". Number them 1, 2, 3."
                )

            messages = [
                {"role": "system", "content": system},
                *history,
                {"role": "user", "content": trigger_text}
            ]

            # ── Get provider and call AI ──────────────────────────────
            from learnora import provider_manager, _call_provider_sync
            provider = provider_manager.get_working_provider(needs_vision=False)
            if not provider:
                logger.warning("Learnora: all providers unavailable — skipping thread reply")
                return

            ai_text = _call_provider_sync(messages, provider)
            if not ai_text:
                return

            # ── Persist as ThreadMessage ──────────────────────────────
            bot_msg = ThreadMessage(
                thread_id      = thread_id,
                sender_id      = bot_user_id,
                text_content   = ai_text,
                is_ai_response = True,
                status         = "sent",
                sent_at        = datetime.datetime.utcnow()
            )
            db.session.add(bot_msg)

            Thread.query.filter_by(id=thread_id).update(
                {
                    Thread.message_count: Thread.message_count + 1,
                    Thread.last_activity: datetime.datetime.utcnow()
                },
                synchronize_session=False
            )

            try:
                db.session.commit()
            except Exception as commit_err:
                logger.error(f"Learnora commit error: {commit_err}")
                db.session.rollback()
                return

            # ── Broadcast to thread room ──────────────────────────────
            thread_ws_manager.broadcast_ai_message(thread_id, bot_msg, ai_text)

        except Exception as e:
            logger.error(f"_call_learnora_for_thread error: {e}", exc_info=True)
            db.session.rollback()


# ============================================================================
# GLOBAL INSTANCE
# ============================================================================

thread_ws_manager = ThreadWebSocketManager()


def init_thread_websocket(app, socketio) -> None:
    """
    Entry point called from the app factory, after init_message_websocket().

    Example:
        socketio = init_message_websocket(app)
        init_thread_websocket(app, socketio)
    """
    thread_ws_manager.init_socketio(app, socketio)
