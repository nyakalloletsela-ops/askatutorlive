
CREATE TABLE public.whiteboard_strokes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  stroke_id text NOT NULL,
  user_id uuid NOT NULL,
  page integer NOT NULL,
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, stroke_id)
);

CREATE INDEX idx_whiteboard_strokes_room ON public.whiteboard_strokes (room_id, created_at);

ALTER TABLE public.whiteboard_strokes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "room members read strokes"
  ON public.whiteboard_strokes FOR SELECT
  USING (public.can_access_classroom_room(room_id));

CREATE POLICY "room members insert own strokes"
  ON public.whiteboard_strokes FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.can_access_classroom_room(room_id));

CREATE POLICY "room members delete strokes"
  ON public.whiteboard_strokes FOR DELETE
  USING (public.can_access_classroom_room(room_id));
