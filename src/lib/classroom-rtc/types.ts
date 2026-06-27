// Stable surface that the classroom UI talks to.
// A future LiveKit / mediasoup adapter can implement this without UI changes.

export type ParticipantStatus = "connecting" | "joined";

export type ConnectionQuality = "good" | "fair" | "poor" | "unknown";

export interface ConnectionStats {
  rttMs: number;
  jitterMs: number;
  packetLoss: number; // 0..1
  quality: ConnectionQuality;
}

export interface RemoteParticipant {
  id: string;
  displayName: string;
  status: ParticipantStatus;
  isScreenSharing: boolean;
}

export type DeviceKind = "camera" | "mic" | "speaker";

export interface MediaDeviceLists {
  cameras: MediaDeviceInfo[];
  mics: MediaDeviceInfo[];
  speakers: MediaDeviceInfo[];
}

export type RTCEventMap = {
  "local-stream": MediaStream | null;
  "remote-stream": MediaStream | null;
  "remote-participant": RemoteParticipant | null;
  "stats": ConnectionStats;
  "mic-state": boolean;
  "camera-state": boolean;
  "screen-share": boolean;
  "error": string;
  "joined": void;
};

export type RTCListener<K extends keyof RTCEventMap> = (payload: RTCEventMap[K]) => void;

export interface ClassroomRTCService {
  join(): Promise<void>;
  leave(): Promise<void>;
  toggleMic(on?: boolean): Promise<boolean>;
  toggleCamera(on?: boolean): Promise<boolean>;
  startScreenShare(): Promise<void>;
  stopScreenShare(): Promise<void>;
  setDevices(d: Partial<Record<DeviceKind, string>>): Promise<void>;
  enumerateDevices(): Promise<MediaDeviceLists>;
  on<K extends keyof RTCEventMap>(event: K, cb: RTCListener<K>): () => void;
  getLocalStream(): MediaStream | null;
  getRemoteStream(): MediaStream | null;
  getRemoteParticipant(): RemoteParticipant | null;
  getMicEnabled(): boolean;
  getCameraEnabled(): boolean;
  getScreenSharing(): boolean;
}

// Kept for legacy imports during transition.
export type Participant = { id: string; displayName?: string; status: ParticipantStatus };
