
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS parent_session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS rescheduled_from uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sessions_tutor_slot_unique
  ON public.sessions(tutor_id, scheduled_at) WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.sessions_protect_immutable_cols()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _bypass boolean := false;
BEGIN
  BEGIN _bypass := current_setting('app.allow_session_mutation', true) = 'on';
  EXCEPTION WHEN OTHERS THEN _bypass := false; END;
  IF public.has_role(auth.uid(), 'admin') OR _bypass THEN RETURN NEW; END IF;
  IF NEW.tutor_id IS DISTINCT FROM OLD.tutor_id THEN RAISE EXCEPTION 'tutor_id is immutable'; END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id THEN RAISE EXCEPTION 'student_id is immutable'; END IF;
  IF NEW.room_id IS DISTINCT FROM OLD.room_id THEN RAISE EXCEPTION 'room_id is immutable'; END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'created_at is immutable'; END IF;
  IF NEW.is_free IS DISTINCT FROM OLD.is_free THEN RAISE EXCEPTION 'is_free is immutable'; END IF;
  IF NEW.scheduled_at IS DISTINCT FROM OLD.scheduled_at THEN
    RAISE EXCEPTION 'scheduled_at can only be changed via reschedule_session'; END IF;
  IF NEW.subject IS DISTINCT FROM OLD.subject THEN RAISE EXCEPTION 'subject can only be changed by an admin'; END IF;
  IF NEW.duration_min IS DISTINCT FROM OLD.duration_min THEN RAISE EXCEPTION 'duration_min can only be changed by an admin'; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'scheduled' THEN RAISE EXCEPTION 'session status can no longer be changed'; END IF;
    IF NEW.status = 'cancelled' THEN
      IF auth.uid() <> OLD.tutor_id AND auth.uid() <> OLD.student_id THEN RAISE EXCEPTION 'only session participants can cancel'; END IF;
    ELSIF NEW.status = 'completed' THEN
      IF auth.uid() <> OLD.tutor_id THEN RAISE EXCEPTION 'only the tutor can mark a session completed'; END IF;
    ELSE RAISE EXCEPTION 'invalid status transition'; END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.booking_conflicts_check(_tutor uuid, _start timestamptz, _duration_min integer)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _tz text; _buffer int := 0; _end timestamptz;
        _local_start timestamp; _local_end timestamp;
        _weekday int; _start_min int; _end_min int; _ok boolean := false;
BEGIN
  IF _duration_min <= 0 OR _duration_min > 600 THEN RETURN false; END IF;
  _end := _start + make_interval(mins => _duration_min);
  SELECT COALESCE(MAX(timezone),'UTC'), COALESCE(MAX(buffer_minutes),0) INTO _tz, _buffer
    FROM public.tutor_availability WHERE tutor_id = _tutor;
  _tz := COALESCE(_tz,'UTC');
  _local_start := (_start AT TIME ZONE _tz);
  _local_end := (_end AT TIME ZONE _tz);
  _weekday := EXTRACT(DOW FROM _local_start)::int;
  _start_min := EXTRACT(HOUR FROM _local_start)*60 + EXTRACT(MINUTE FROM _local_start);
  _end_min := _start_min + _duration_min;
  IF _local_start::date <> (_local_end - interval '1 second')::date THEN RETURN false; END IF;
  SELECT EXISTS(SELECT 1 FROM public.tutor_availability
    WHERE tutor_id=_tutor AND weekday=_weekday AND start_min <= _start_min AND end_min >= _end_min) INTO _ok;
  IF NOT _ok THEN RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.tutor_holidays
    WHERE tutor_id=_tutor AND _local_start::date <= end_date AND _local_end::date >= start_date) THEN
    RETURN false; END IF;
  IF EXISTS(SELECT 1 FROM public.sessions s
    WHERE s.tutor_id=_tutor AND s.status='scheduled'
      AND tstzrange(s.scheduled_at - make_interval(mins=>_buffer),
                    s.scheduled_at + make_interval(mins=>s.duration_min+_buffer),'[)')
          && tstzrange(_start,_end,'[)')) THEN RETURN false; END IF;
  RETURN true;
END; $$;
GRANT EXECUTE ON FUNCTION public.booking_conflicts_check(uuid,timestamptz,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.book_session(
  _tutor uuid, _start timestamptz, _duration_min integer, _subject text,
  _is_free boolean DEFAULT false, _recurrence_weeks integer DEFAULT 1
) RETURNS uuid[] LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _student uuid := auth.uid(); _ids uuid[] := ARRAY[]::uuid[];
        _parent uuid; _cur timestamptz := _start; _new_id uuid; i int;
BEGIN
  IF _student IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _recurrence_weeks < 1 OR _recurrence_weeks > 26 THEN RAISE EXCEPTION 'Invalid recurrence'; END IF;
  FOR i IN 1.._recurrence_weeks LOOP
    IF NOT public.booking_conflicts_check(_tutor,_cur,_duration_min) THEN
      IF i=1 THEN RAISE EXCEPTION 'Slot not available'; ELSE EXIT; END IF;
    END IF;
    INSERT INTO public.sessions (tutor_id,student_id,subject,scheduled_at,duration_min,is_free,parent_session_id)
    VALUES (_tutor,_student,_subject,_cur,_duration_min,_is_free,_parent) RETURNING id INTO _new_id;
    IF i=1 THEN _parent := _new_id; END IF;
    _ids := _ids || _new_id;
    _cur := _cur + interval '7 days';
  END LOOP;
  IF _recurrence_weeks > 1 AND _parent IS NOT NULL THEN
    INSERT INTO public.session_recurrence (parent_session_id,rrule)
    VALUES (_parent,'FREQ=WEEKLY;COUNT='||array_length(_ids,1));
  END IF;
  RETURN _ids;
END; $$;
GRANT EXECUTE ON FUNCTION public.book_session(uuid,timestamptz,integer,text,boolean,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.reschedule_session(_session uuid, _new_start timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO _s FROM public.sessions WHERE id=_session FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _uid <> _s.tutor_id AND _uid <> _s.student_id AND NOT public.has_role(_uid,'admin') THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _s.status <> 'scheduled' THEN RAISE EXCEPTION 'Session not reschedulable'; END IF;
  IF NOT public.booking_conflicts_check(_s.tutor_id,_new_start,_s.duration_min) THEN
    RAISE EXCEPTION 'New slot not available'; END IF;
  PERFORM set_config('app.allow_session_mutation','on',true);
  UPDATE public.sessions SET scheduled_at=_new_start, rescheduled_from=id WHERE id=_session;
END; $$;
GRANT EXECUTE ON FUNCTION public.reschedule_session(uuid,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_session(_session uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _uid uuid := auth.uid();
BEGIN
  SELECT * INTO _s FROM public.sessions WHERE id=_session FOR UPDATE;
  IF _s.id IS NULL THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF _uid <> _s.tutor_id AND _uid <> _s.student_id AND NOT public.has_role(_uid,'admin') THEN
    RAISE EXCEPTION 'Not authorized'; END IF;
  IF _s.status <> 'scheduled' THEN RAISE EXCEPTION 'Already finalized'; END IF;
  PERFORM set_config('app.allow_session_mutation','on',true);
  UPDATE public.sessions SET status='cancelled', cancelled_at=now(), cancelled_by=_uid, cancel_reason=_reason WHERE id=_session;
END; $$;
GRANT EXECUTE ON FUNCTION public.cancel_session(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_tutor_availability_public(_tutor uuid)
RETURNS TABLE(weekday smallint, start_min smallint, end_min smallint, timezone text, buffer_minutes integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT weekday,start_min,end_min,timezone,buffer_minutes FROM public.tutor_availability
  WHERE tutor_id=_tutor ORDER BY weekday,start_min;
$$;
GRANT EXECUTE ON FUNCTION public.get_tutor_availability_public(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_tutor_busy_slots(_tutor uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(scheduled_at timestamptz, duration_min integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT scheduled_at,duration_min FROM public.sessions
  WHERE tutor_id=_tutor AND status='scheduled' AND scheduled_at >= _from AND scheduled_at < _to;
$$;
GRANT EXECUTE ON FUNCTION public.get_tutor_busy_slots(uuid,timestamptz,timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_tutor_holidays_public(_tutor uuid)
RETURNS TABLE(start_date date, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT start_date,end_date FROM public.tutor_holidays WHERE tutor_id=_tutor;
$$;
GRANT EXECUTE ON FUNCTION public.get_tutor_holidays_public(uuid) TO anon, authenticated;
