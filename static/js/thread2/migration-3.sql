-- =============================================================================
-- StudyHub Thread Feature — Database Migrations
-- PostgreSQL / Supabase compatible
-- Run each phase separately with validation between phases.
-- =============================================================================


-- =============================================================================
-- MIGRATION-01: thread_message_attachments (ATT-01)
-- Adds a dedicated attachments child table to support multiple attachments
-- per message. The existing single-attachment columns on thread_messages are
-- preserved (as nullable) for backward compatibility with existing data.
--
-- Phase ordering:
--   Phase 1 — Create table  (run now, zero downtime)
--   Phase 2 — Back-fill existing rows  (run in the same deploy or next)
--   Phase 3 — Drop legacy columns  (run in a LATER release after validation)
-- =============================================================================

-- ── Phase 1: Create new table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS thread_message_attachments (
    id              SERIAL          PRIMARY KEY,
    message_id      INTEGER         NOT NULL
                        REFERENCES thread_messages(id) ON DELETE CASCADE,
    attachment_url  VARCHAR(500)    NOT NULL,
    attachment_name VARCHAR(255),
    attachment_type VARCHAR(50),        -- 'image' | 'video' | 'document'
    attachment_size INTEGER,            -- bytes
    sort_order      INTEGER         NOT NULL DEFAULT 0,
    created_at      TIMESTAMP       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tma_message_id
    ON thread_message_attachments (message_id);

CREATE INDEX IF NOT EXISTS idx_tma_message_sort
    ON thread_message_attachments (message_id, sort_order);

-- ── Phase 1 rollback ─────────────────────────────────────────────────────────
-- DROP TABLE IF EXISTS thread_message_attachments;


-- ── Phase 2: Back-fill existing single-attachment rows ────────────────────────
-- Copies all rows that have an attachment_url into the new table.
-- Safe to re-run: INSERT ... WHERE NOT EXISTS avoids duplicates.

INSERT INTO thread_message_attachments
    (message_id, attachment_url, attachment_name, attachment_type, attachment_size, sort_order, created_at)
SELECT
    tm.id,
    tm.attachment_url,
    tm.attachment_name,
    tm.attachment_type,
    tm.attachment_size,
    0,
    COALESCE(tm.sent_at, NOW())
FROM thread_messages tm
WHERE tm.attachment_url IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM thread_message_attachments tma
      WHERE tma.message_id = tm.id
        AND tma.attachment_url = tm.attachment_url
  );


-- ── Phase 3: Drop legacy columns (LATER RELEASE — after full validation) ──────
-- Run only after confirming the application no longer reads these columns
-- directly and all attachment rendering goes through thread_message_attachments.

-- ALTER TABLE thread_messages DROP COLUMN IF EXISTS attachment;
-- ALTER TABLE thread_messages DROP COLUMN IF EXISTS attachment_url;
-- ALTER TABLE thread_messages DROP COLUMN IF EXISTS attachment_name;
-- ALTER TABLE thread_messages DROP COLUMN IF EXISTS attachment_type;
-- ALTER TABLE thread_messages DROP COLUMN IF EXISTS attachment_size;


-- =============================================================================
-- MIGRATION-02: Verify and create missing indexes on thread_message_read_receipts
-- and thread_messages (added in models.py but may be absent in older deployments).
-- Uses CONCURRENTLY so the table stays online during index creation.
-- =============================================================================

-- Partial index on thread_messages.status — avoids bloat from fully-read history.
-- Only indexes rows where status is NOT 'read' since those are the ones queried.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tm_status
    ON thread_messages (status)
    WHERE status != 'read';

-- Read receipt indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tread_receipt_msg
    ON thread_message_read_receipts (message_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tread_receipt_user
    ON thread_message_read_receipts (user_id);

-- Verify unique constraint exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'unique_thread_read_receipt'
    ) THEN
        ALTER TABLE thread_message_read_receipts
            ADD CONSTRAINT unique_thread_read_receipt
            UNIQUE (message_id, user_id);
    END IF;
END$$;


-- =============================================================================
-- MIGRATION-03: Composite index for unread-count queries (MIGRATION-03)
-- Speeds up the per-thread unread count loop in get_my_threads.
-- Currently the route runs one COUNT query per thread in a Python loop;
-- this index makes each COUNT fast enough that the loop is acceptable until
-- a full SQL rewrite is done.
-- =============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tm_thread_unread
    ON thread_messages (thread_id, sender_id, is_deleted, sent_at)
    WHERE is_deleted = FALSE;


-- =============================================================================
-- MIGRATION-04: user_active_thread — NOT a DB change.
-- This is an in-memory dict on ThreadWebSocketManager. No migration needed.
-- See websocket_threads.py fix summary.
-- =============================================================================


-- =============================================================================
-- VERIFICATION QUERIES
-- Run these after migration to confirm all objects exist.
-- =============================================================================

-- Check thread_message_attachments table and indexes
SELECT
    t.tablename,
    i.indexname,
    i.indexdef
FROM pg_tables t
LEFT JOIN pg_indexes i ON i.tablename = t.tablename
WHERE t.tablename = 'thread_message_attachments'
ORDER BY i.indexname;

-- Check back-fill count matches source
SELECT
    (SELECT COUNT(*) FROM thread_messages WHERE attachment_url IS NOT NULL)        AS source_rows,
    (SELECT COUNT(*) FROM thread_message_attachments)                              AS migrated_rows,
    (SELECT COUNT(*) FROM thread_messages WHERE attachment_url IS NOT NULL)
    = (SELECT COUNT(*) FROM thread_message_attachments)                            AS counts_match;

-- Check all required indexes exist
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname IN (
    'idx_tma_message_id',
    'idx_tma_message_sort',
    'idx_tm_status',
    'idx_tread_receipt_msg',
    'idx_tread_receipt_user',
    'idx_tm_thread_unread'
)
ORDER BY tablename, indexname;
