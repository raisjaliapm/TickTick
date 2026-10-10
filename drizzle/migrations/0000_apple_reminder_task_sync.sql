CREATE TABLE public.apple_reminder_task_sync (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid,
  reminder_id text NOT NULL,
  reminders_list_id text NOT NULL,
  ignored boolean NOT NULL DEFAULT false,
  last_synced_title text,
  last_synced_due_date timestamptz,
  last_synced_completed boolean NOT NULL DEFAULT false,
  last_synced_notes text NOT NULL DEFAULT '',
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apple_reminder_task_sync TO authenticated;
GRANT ALL ON public.apple_reminder_task_sync TO service_role;

ALTER TABLE public.apple_reminder_task_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Apple Reminders sync mappings"
  ON public.apple_reminder_task_sync
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX apple_reminder_task_sync_user_reminder_unique
  ON public.apple_reminder_task_sync (user_id, reminder_id);

CREATE UNIQUE INDEX apple_reminder_task_sync_user_task_unique
  ON public.apple_reminder_task_sync (user_id, task_id)
  WHERE task_id IS NOT NULL AND ignored = false;

CREATE INDEX apple_reminder_task_sync_user_list_idx
  ON public.apple_reminder_task_sync (user_id, reminders_list_id);