CREATE TABLE public.apple_reminder_sync_settings (
  user_id uuid PRIMARY KEY,
  reminders_list_id text NOT NULL,
  reminders_list_title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.apple_reminder_sync_settings TO authenticated;
GRANT ALL ON public.apple_reminder_sync_settings TO service_role;

ALTER TABLE public.apple_reminder_sync_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own Apple Reminders settings"
  ON public.apple_reminder_sync_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);