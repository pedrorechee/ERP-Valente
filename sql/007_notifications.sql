-- NOTIFICAÇÕES
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  link          TEXT NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  reference_id  TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT notifications_unique_per_type UNIQUE (user_id, type, reference_id)
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notifications"
  ON notifications
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread
  ON notifications(user_id, read)
  WHERE read = FALSE;
