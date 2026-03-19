
-- Create storage bucket for task attachments (100MB max)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('task-attachments', 'task-attachments', false, 104857600);

-- Storage policies: users can manage their own files (folder = user_id)
CREATE POLICY "Users can upload own attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'task-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create task_attachments table to track files per task
CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task attachments" ON public.task_attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own task attachments" ON public.task_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own task attachments" ON public.task_attachments FOR DELETE USING (auth.uid() = user_id);
