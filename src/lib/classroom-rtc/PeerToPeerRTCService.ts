import { supabase } from "@/integrations/supabase/client";
import type {
  ClassroomRTCService,
  ConnectionStats,
  DeviceKind,
  MediaDeviceLists,
  RTCEventMap,
  RTCListener,
  RemoteParticipant,
} from "./types";

type SignalPayload = {
  senderId: string;
  senderName?: string;
  targetId?: string;
  kind: "offer" | "answer" | "candidate" | "leave";
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
};

type PresencePayload = { userId: string; displayName: string };

const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

function classifyQuality(rttMs: number, packetLoss: number): ConnectionStats["quality"] {
  if (!Number.isFinite(rttMs) && packetLoss === 0) return "unknown";
  if (rttMs < 150 && packetLoss < 0.02) return "good";
  if (rttMs < 350 && packetLoss < 0.08) return "fair";
  return "poor";
}

export interface PeerToPeerRTCConfig {
  roomId: string;
  userId: string;
  displayName: string;
}

/**
 * 1:1 WebRTC over Supabase Realtime signaling.
 * Implements the ClassroomRTCService contract so the UI never depends on the underlying transport.
 */
export class PeerToPeerRTCService implements ClassroomRTCService {
  private listeners: { [K in keyof RTCEventMap]?: Set<RTCListener<K>> } = {};
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private cameraTrack: MediaStreamTrack | null = null;
  private screenStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private remoteUserId = "";
  private remoteParticipant: RemoteParticipant | null = null;
  private makingOffer = false;
  private deviceIds: Record<DeviceKind, string> = { camera: "", mic: "", speaker: "" };
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private isPolite = false;
  private joined = false;

  constructor(private readonly cfg: PeerToPeerRTCConfig) {}

  // ---------- event bus ----------
  on<K extends keyof RTCEventMap>(event: K, cb: RTCListener<K>): () => void {
    const set = (this.listeners[event] ?? new Set()) as Set<RTCListener<K>>;
    set.add(cb);
    (this.listeners as Record<string, Set<unknown>>)[event] = set as unknown as Set<unknown>;
    return () => set.delete(cb);
  }
  private emit<K extends keyof RTCEventMap>(event: K, payload: RTCEventMap[K]) {
    const set = this.listeners[event] as Set<RTCListener<K>> | undefined;
    if (!set) return;
    set.forEach((fn) => {
      try { fn(payload); } catch (e) { console.error(e); }
    });
  }

  // ---------- public api ----------
  async join(): Promise<void> {
    if (this.joined) return;
    this.joined = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: this.deviceIds.camera ? { deviceId: { exact: this.deviceIds.camera } } : true,
        audio: this.deviceIds.mic ? { deviceId: { exact: this.deviceIds.mic } } : true,
      });
      this.localStream = stream;
      this.cameraTrack = stream.getVideoTracks()[0] ?? null;
      this.emit("local-stream", stream);
      this.emit("mic-state", true);
      this.emit("camera-state", true);
    } catch (err) {
      this.joined = false;
      const msg = err instanceof Error ? err.message : "Camera or microphone unavailable";
      this.emit("error", msg);
      throw err;
    }
    await this.startSignaling();
    this.emit("joined", undefined);
    this.startStatsLoop();
  }

  async leave(): Promise<void> {
    if (this.statsTimer) { clearInterval(this.statsTimer); this.statsTimer = null; }
    this.sendSignal({ kind: "leave", targetId: this.remoteUserId });
    this.localStream?.getTracks().forEach((t) => t.stop());
    this.screenStream?.getTracks().forEach((t) => t.stop());
    this.pc?.close();
    this.pc = null;
    if (this.channel) { await supabase.removeChannel(this.channel); this.channel = null; }
    this.localStream = null;
    this.screenStream = null;
    this.remoteStream = null;
    this.remoteParticipant = null;
    this.joined = false;
  }

  async toggleMic(on?: boolean): Promise<boolean> {
    const track = this.localStream?.getAudioTracks()[0];
    if (!track) return false;
    const next = on ?? !track.enabled;
    track.enabled = next;
    this.emit("mic-state", next);
    return next;
  }

  async toggleCamera(on?: boolean): Promise<boolean> {
    const track = this.localStream?.getVideoTracks()[0];
    if (!track) return false;
    const next = on ?? !track.enabled;
    track.enabled = next;
    this.emit("camera-state", next);
    return next;
  }

  async startScreenShare(): Promise<void> {
    if (this.screenStream) return;
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    this.screenStream = display;
    const screenTrack = display.getVideoTracks()[0];
    if (!screenTrack) return;
    const pc = this.ensurePc();
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    if (sender) await sender.replaceTrack(screenTrack);
    // local preview swap
    if (this.localStream) {
      this.cameraTrack?.stop?.call?.(this.cameraTrack);
      const newLocal = new MediaStream([
        ...this.localStream.getAudioTracks(),
        screenTrack,
      ]);
      this.localStream = newLocal;
      this.emit("local-stream", newLocal);
    }
    this.emit("screen-share", true);
    screenTrack.onended = () => { void this.stopScreenShare(); };
  }

  async stopScreenShare(): Promise<void> {
    if (!this.screenStream) return;
    this.screenStream.getTracks().forEach((t) => t.stop());
    this.screenStream = null;
    const cam = await navigator.mediaDevices.getUserMedia({
      video: this.deviceIds.camera ? { deviceId: { exact: this.deviceIds.camera } } : true,
      audio: false,
    });
    const newCam = cam.getVideoTracks()[0];
    this.cameraTrack = newCam;
    const pc = this.pc;
    if (pc) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newCam);
    }
    if (this.localStream) {
      const audio = this.localStream.getAudioTracks();
      const newLocal = new MediaStream([...audio, newCam]);
      this.localStream = newLocal;
      this.emit("local-stream", newLocal);
    }
    this.emit("screen-share", false);
  }

  async setDevices(d: Partial<Record<DeviceKind, string>>): Promise<void> {
    this.deviceIds = { ...this.deviceIds, ...d };
    if (!this.localStream || this.screenStream) return; // skip while sharing screen
    const stream = await navigator.mediaDevices.getUserMedia({
      video: this.deviceIds.camera ? { deviceId: { exact: this.deviceIds.camera } } : true,
      audio: this.deviceIds.mic ? { deviceId: { exact: this.deviceIds.mic } } : true,
    });
    const old = this.localStream;
    this.localStream = stream;
    this.cameraTrack = stream.getVideoTracks()[0] ?? null;
    const pc = this.pc;
    if (pc) {
      for (const track of stream.getTracks()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === track.kind);
        if (sender) await sender.replaceTrack(track);
      }
    }
    old.getTracks().forEach((t) => t.stop());
    this.emit("local-stream", stream);
  }

  async enumerateDevices(): Promise<MediaDeviceLists> {
    if (!navigator.mediaDevices?.enumerateDevices) {
      return { cameras: [], mics: [], speakers: [] };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: devices.filter((d) => d.kind === "videoinput"),
      mics: devices.filter((d) => d.kind === "audioinput"),
      speakers: devices.filter((d) => d.kind === "audiooutput"),
    };
  }

  getLocalStream() { return this.localStream; }
  getRemoteStream() { return this.remoteStream; }
  getRemoteParticipant() { return this.remoteParticipant; }
  getMicEnabled() { return this.localStream?.getAudioTracks()[0]?.enabled ?? false; }
  getCameraEnabled() { return this.localStream?.getVideoTracks()[0]?.enabled ?? false; }
  getScreenSharing() { return !!this.screenStream; }

  // ---------- internals ----------
  private ensurePc(): RTCPeerConnection {
    if (this.pc) return this.pc;
    const pc = new RTCPeerConnection(rtcConfig);
    this.pc = pc;
    this.localStream?.getTracks().forEach((t) => pc.addTrack(t, this.localStream!));
    pc.onicecandidate = (e) => {
      if (e.candidate) this.sendSignal({ kind: "candidate", targetId: this.remoteUserId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => {
      const [stream] = e.streams;
      this.remoteStream = stream;
      this.emit("remote-stream", stream);
      if (this.remoteParticipant) {
        this.remoteParticipant = { ...this.remoteParticipant, status: "joined" };
        this.emit("remote-participant", this.remoteParticipant);
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") this.emit("error", "Peer connection failed");
    };
    return pc;
  }

  private sendSignal(s: Omit<SignalPayload, "senderId" | "senderName">) {
    if (!this.channel) return;
    void this.channel.send({
      type: "broadcast",
      event: "signal",
      payload: { ...s, senderId: this.cfg.userId, senderName: this.cfg.displayName } satisfies SignalPayload,
    });
  }

  private async startSignaling() {
    if (this.channel) return;
    const channel = supabase.channel(`classroom-call:${this.cfg.roomId}`, {
      config: { broadcast: { self: false }, presence: { key: this.cfg.userId } },
    });
    this.channel = channel;

    channel.on("broadcast", { event: "signal" }, ({ payload }) => {
      void this.handleSignal(payload as SignalPayload);
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresencePayload>();
      const remote = Object.values(state).flat().find((p) => p.userId !== this.cfg.userId);
      if (remote) {
        this.remoteUserId = remote.userId;
        this.isPolite = this.cfg.userId > remote.userId;
        this.remoteParticipant = {
          id: remote.userId,
          displayName: remote.displayName,
          status: this.remoteStream ? "joined" : "connecting",
          isScreenSharing: false,
        };
        this.emit("remote-participant", this.remoteParticipant);
        // Impolite peer initiates
        if (!this.isPolite) void this.makeOffer(remote.userId);
      } else {
        this.remoteUserId = "";
        this.remoteParticipant = null;
        this.remoteStream = null;
        this.emit("remote-participant", null);
        this.emit("remote-stream", null);
      }
    });

    await new Promise<void>((resolve) => {
      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ userId: this.cfg.userId, displayName: this.cfg.displayName } satisfies PresencePayload);
          resolve();
        }
      });
    });
  }

  private async makeOffer(targetId: string) {
    if (!this.localStream || !targetId || this.makingOffer) return;
    const pc = this.ensurePc();
    if (pc.signalingState !== "stable") return;
    this.makingOffer = true;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.sendSignal({ kind: "offer", targetId, description: pc.localDescription?.toJSON() });
    } finally {
      this.makingOffer = false;
    }
  }

  private async handleSignal(payload: SignalPayload) {
    if (!payload || payload.senderId === this.cfg.userId) return;
    if (payload.targetId && payload.targetId !== this.cfg.userId) return;
    this.remoteUserId = payload.senderId;
    const pc = this.ensurePc();
    try {
      if (payload.kind === "offer" && payload.description) {
        await pc.setRemoteDescription(payload.description);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.sendSignal({ kind: "answer", targetId: payload.senderId, description: pc.localDescription?.toJSON() });
      } else if (payload.kind === "answer" && payload.description) {
        await pc.setRemoteDescription(payload.description);
      } else if (payload.kind === "candidate" && payload.candidate) {
        await pc.addIceCandidate(payload.candidate);
      } else if (payload.kind === "leave") {
        this.remoteUserId = "";
        this.remoteStream = null;
        this.remoteParticipant = null;
        this.emit("remote-stream", null);
        this.emit("remote-participant", null);
      }
    } catch (err) {
      this.emit("error", err instanceof Error ? err.message : "Signal error");
    }
  }

  private startStatsLoop() {
    if (this.statsTimer) return;
    let lastBytesLost = 0;
    let lastPacketsLost = 0;
    let lastPacketsReceived = 0;
    this.statsTimer = setInterval(async () => {
      const pc = this.pc;
      if (!pc) return;
      try {
        const report = await pc.getStats();
        let rtt = 0;
        let jitter = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        report.forEach((r) => {
          if (r.type === "candidate-pair" && (r as { state?: string }).state === "succeeded") {
            const cur = (r as { currentRoundTripTime?: number }).currentRoundTripTime;
            if (typeof cur === "number") rtt = cur * 1000;
          }
          if (r.type === "inbound-rtp" && (r as { kind?: string }).kind === "video") {
            jitter = ((r as { jitter?: number }).jitter ?? 0) * 1000;
            packetsLost = (r as { packetsLost?: number }).packetsLost ?? 0;
            packetsReceived = (r as { packetsReceived?: number }).packetsReceived ?? 0;
          }
        });
        const dLost = Math.max(0, packetsLost - lastPacketsLost);
        const dRecv = Math.max(0, packetsReceived - lastPacketsReceived);
        lastPacketsLost = packetsLost;
        lastPacketsReceived = packetsReceived;
        lastBytesLost = dLost;
        const loss = dRecv + dLost > 0 ? dLost / (dRecv + dLost) : 0;
        const stats: ConnectionStats = {
          rttMs: Math.round(rtt),
          jitterMs: Math.round(jitter),
          packetLoss: Number(loss.toFixed(3)),
          quality: classifyQuality(rtt, loss),
        };
        this.emit("stats", stats);
      } catch {
        /* noop */
      }
      void lastBytesLost;
    }, 3000);
  }
}
