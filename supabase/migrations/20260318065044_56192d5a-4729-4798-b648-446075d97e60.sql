-- Drop existing check constraint
ALTER TABLE public.tasks DROP CONSTRAINT tasks_status_check;

-- Update existing data first
UPDATE public.tasks SET status = 'not_started' WHERE status = 'active';

-- Add new check constraint with all status options
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed'));

-- Update default value
ALTER TABLE public.tasks ALTER COLUMN status SET DEFAULT 'not_started';