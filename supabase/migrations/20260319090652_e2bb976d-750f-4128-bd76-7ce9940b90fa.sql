ALTER TABLE public.tasks ADD COLUMN start_date timestamp with time zone DEFAULT NULL;
ALTER TABLE public.tasks ADD COLUMN end_date timestamp with time zone DEFAULT NULL;