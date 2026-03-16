
ALTER TABLE public.tasks 
ADD COLUMN recurrence TEXT DEFAULT NULL;
-- Values: 'daily', 'weekly', 'monthly', or NULL for non-recurring
