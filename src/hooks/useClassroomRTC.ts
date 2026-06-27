import { useEffect, useMemo, useState } from "react";
import { createClassroomRTC, type ClassroomRTCService, type ConnectionStats, type RemoteParticipant } from "@/lib/classroom-rtc";

interface Options {
  roomId: string;
  userId: string;
  displayName: string;
  autoJoin?: boolean;
}

export interface ClassroomRTCState {
  service: ClassroomRTCService;
  joined: boolean;
  joining: boolean;
  error: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  remote: RemoteParticipant | null;
  micOn: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  stats: ConnectionStats;
  join: () => Promise<void>;
  leave: () => Promise<void>;
}

export function useClassroomRTC({ roomId, userId, displayName, autoJoin = false }: Options): ClassroomRTCState {
  const service = useMemo(
    () => createClassroomRTC({ roomId, userId, displayName }),
    [roomId, userId, displayName],
  );
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<RemoteParticipant | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [stats, setStats] = useState<ConnectionStats>({ rttMs: 0, jitterMs: 0, packetLoss: 0, quality: "unknown" });

  useEffect(() => {
    const offs = [
      service.on("local-stream", (s) => setLocalStream(s)),
      service.on("remote-stream", (s) => setRemoteStream(s)),
      service.on("remote-participant", (p) => setRemote(p)),
      service.on("mic-state", (s) => setMicOn(s)),
      service.on("camera-state", (s) => setCameraOn(s)),
      service.on("screen-share", (s) => setScreenSharing(s)),
      service.on("stats", (s) => setStats(s)),
      service.on("error", (m) => setError(m)),
      service.on("joined", () => setJoined(true)),
    ];
    return () => { offs.forEach((off) => off()); void service.leave(); };
  }, [service]);

  const join = async () => {
    if (joining || joined) return;
    setError(null);
    setJoining(true);
    try { await service.join(); } catch (e) { setError(e instanceof Error ? e.message : "Could not start"); }
    finally { setJoining(false); }
  };

  const leave = async () => { await service.leave(); setJoined(false); };

  useEffect(() => {
    if (autoJoin) void join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoJoin]);

  return { service, joined, joining, error, localStream, remoteStream, remote, micOn, cameraOn, screenSharing, stats, join, leave };
}
