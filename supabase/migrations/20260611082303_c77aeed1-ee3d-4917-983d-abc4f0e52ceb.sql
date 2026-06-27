-- Recording sessions for the tldraw whiteboard timeline
CREATE TABLE public.whiteboard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  title text,
  started_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX whiteboard_sessions_room_idx ON public.whiteboard_sessions (room_id, started_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_sessions TO authenticated;
GRANT ALL ON public.whiteboard_sessions TO service_role;

ALTER TABLE public.whiteboard_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read recording sessions"
  ON public.whiteboard_sessions FOR SELECT
  TO authenticated
  USING (public.can_access_classroom_room(room_id));

CREATE POLICY "Room members can start a recording"
  ON public.whiteboard_sessions FOR INSERT
  TO authenticated
  WITH CHECK (started_by = auth.uid() AND public.can_access_classroom_room(room_id));

CREATE POLICY "Owner or admin can update or end recording"
  ON public.whiteboard_sessions FOR UPDATE
  TO authenticated
  USING (started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owner or admin can delete recording"
  ON public.whiteboard_sessions FOR DELETE
  TO authenticated
  USING (started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));

-- Timeline deltas: chronological Yjs updates per recording session
CREATE TABLE public.canvas_timeline_deltas (
  id bigserial PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  t_offset_ms integer NOT NULL,
  delta_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX canvas_timeline_deltas_session_idx
  ON public.canvas_timeline_deltas (session_id, t_offset_ms);

GRANT SELECT, INSERT, DELETE ON public.canvas_timeline_deltas TO authenticated;
GRANT ALL ON public.canvas_timeline_deltas TO service_role;

ALTER TABLE public.canvas_timeline_deltas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Room members can read deltas"
  ON public.canvas_timeline_deltas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whiteboard_sessions ws
      WHERE ws.id = canvas_timeline_deltas.session_id
        AND public.can_access_classroom_room(ws.room_id)
    )
  );

CREATE POLICY "Recording owner can write deltas"
  ON public.canvas_timeline_deltas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.whiteboard_sessions ws
      WHERE ws.id = canvas_timeline_deltas.session_id
        AND (ws.started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
        AND ws.ended_at IS NULL
    )
  );

CREATE POLICY "Recording owner can delete deltas"
  ON public.canvas_timeline_deltas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.whiteboard_sessions ws
      WHERE ws.id = canvas_timeline_deltas.session_id
        AND (ws.started_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );