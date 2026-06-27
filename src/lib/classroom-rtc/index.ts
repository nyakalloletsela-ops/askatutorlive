import { PeerToPeerRTCService, type PeerToPeerRTCConfig } from "./PeerToPeerRTCService";
import type { ClassroomRTCService } from "./types";

export type { ClassroomRTCService, ConnectionStats, ConnectionQuality, RemoteParticipant, MediaDeviceLists, DeviceKind } from "./types";

/**
 * Factory — swap PeerToPeerRTCService for a LiveKit / mediasoup adapter later
 * without touching the UI; the contract in ./types stays identical.
 */
export function createClassroomRTC(cfg: PeerToPeerRTCConfig): ClassroomRTCService {
  return new PeerToPeerRTCService(cfg);
}
