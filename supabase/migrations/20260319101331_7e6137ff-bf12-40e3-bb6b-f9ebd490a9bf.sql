
-- Create product_tracker_item_attachments table
CREATE TABLE public.product_tracker_item_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.product_tracker_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_tracker_item_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own item attachments" ON public.product_tracker_item_attachments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own item attachments" ON public.product_tracker_item_attachments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own item attachments" ON public.product_tracker_item_attachments FOR DELETE USING (auth.uid() = user_id);
