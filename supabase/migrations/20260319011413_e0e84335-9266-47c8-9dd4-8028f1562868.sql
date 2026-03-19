
CREATE OR REPLACE FUNCTION public.notify_task_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, task_id)
  VALUES (
    NEW.user_id,
    'Task Created',
    'New task: ' || NEW.title,
    'info',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_task_created
  AFTER INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_task_created();
