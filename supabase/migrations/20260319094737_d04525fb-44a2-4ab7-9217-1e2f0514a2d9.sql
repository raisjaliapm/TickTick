
-- Create product_tracker_boards table (each board = a product/project phase group)
CREATE TABLE public.product_tracker_boards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_tracker_boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own boards" ON public.product_tracker_boards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own boards" ON public.product_tracker_boards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own boards" ON public.product_tracker_boards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own boards" ON public.product_tracker_boards FOR DELETE USING (auth.uid() = user_id);

-- Create product_tracker_phases table (sections within a board like "Initial Hypothesis")
CREATE TABLE public.product_tracker_phases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.product_tracker_boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_tracker_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own phases" ON public.product_tracker_phases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own phases" ON public.product_tracker_phases FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own phases" ON public.product_tracker_phases FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own phases" ON public.product_tracker_phases FOR DELETE USING (auth.uid() = user_id);

-- Create product_tracker_items table (tasks within a phase)
CREATE TABLE public.product_tracker_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phase_id UUID NOT NULL REFERENCES public.product_tracker_phases(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_tracker_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own items" ON public.product_tracker_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own items" ON public.product_tracker_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own items" ON public.product_tracker_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own items" ON public.product_tracker_items FOR DELETE USING (auth.uid() = user_id);
