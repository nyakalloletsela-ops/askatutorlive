GRANT SELECT, INSERT, DELETE ON public.whiteboard_strokes TO authenticated;
GRANT ALL ON public.whiteboard_strokes TO service_role;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whiteboard_strokes;
ALTER TABLE public.whiteboard_strokes REPLICA IDENTITY FULL;