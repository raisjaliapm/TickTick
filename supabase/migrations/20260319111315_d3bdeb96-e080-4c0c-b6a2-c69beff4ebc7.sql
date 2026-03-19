
-- Trigger function for board creation
CREATE OR REPLACE FUNCTION public.notify_board_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, 'Board Created', 'New board: ' || NEW.name, 'info');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_board_created
AFTER INSERT ON public.product_tracker_boards
FOR EACH ROW EXECUTE FUNCTION public.notify_board_created();

-- Trigger function for phase creation
CREATE OR REPLACE FUNCTION public.notify_phase_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, 'Phase Created', 'New phase: ' || NEW.name, 'info');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_phase_created
AFTER INSERT ON public.product_tracker_phases
FOR EACH ROW EXECUTE FUNCTION public.notify_phase_created();

-- Trigger function for item creation
CREATE OR REPLACE FUNCTION public.notify_tracker_item_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (NEW.user_id, 'Item Created', 'New item: ' || NEW.title, 'info');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tracker_item_created
AFTER INSERT ON public.product_tracker_items
FOR EACH ROW EXECUTE FUNCTION public.notify_tracker_item_created();

-- Trigger function for item status change
CREATE OR REPLACE FUNCTION public.notify_tracker_item_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      NEW.user_id,
      'Item Status Changed',
      NEW.title || ' → ' || REPLACE(NEW.status, '_', ' '),
      CASE
        WHEN NEW.status = 'done' THEN 'success'
        WHEN NEW.status = 'on_hold' THEN 'warning'
        ELSE 'info'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_tracker_item_status_change
AFTER UPDATE ON public.product_tracker_items
FOR EACH ROW EXECUTE FUNCTION public.notify_tracker_item_status_change();
