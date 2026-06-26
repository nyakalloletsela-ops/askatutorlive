import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { ClassroomRTCService, MediaDeviceLists } from "@/lib/classroom-rtc";

interface Props {
  service: ClassroomRTCService;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function DeviceSettingsDialog({ service, open, onOpenChange }: Props) {
  const [devices, setDevices] = useState<MediaDeviceLists>({ cameras: [], mics: [], speakers: [] });
  const [cam, setCam] = useState("");
  const [mic, setMic] = useState("");
  const [spk, setSpk] = useState("");

  useEffect(() => {
    if (!open) return;
    void service.enumerateDevices().then((d) => {
      setDevices(d);
      setCam((c) => c || d.cameras[0]?.deviceId || "");
      setMic((m) => m || d.mics[0]?.deviceId || "");
      setSpk((s) => s || d.speakers[0]?.deviceId || "");
    });
  }, [open, service]);

  const onChange = async (kind: "camera" | "mic" | "speaker", id: string) => {
    if (kind === "camera") setCam(id);
    if (kind === "mic") setMic(id);
    if (kind === "speaker") setSpk(id);
    await service.setDevices({ [kind]: id });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Audio & video</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <Row label="Camera" value={cam} options={devices.cameras} onChange={(v) => onChange("camera", v)} />
          <Row label="Microphone" value={mic} options={devices.mics} onChange={(v) => onChange("mic", v)} />
          <Row label="Speakers" value={spk} options={devices.speakers} onChange={(v) => onChange("speaker", v)} />
          <p className="text-[11px] text-muted-foreground">If a device is missing, allow camera & mic in your browser's address-bar lock, then reopen this dialog.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, options, onChange }: { label: string; value: string; options: MediaDeviceInfo[]; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border bg-background px-2 text-sm"
      >
        {options.length === 0 && <option value="">No devices</option>}
        {options.map((d) => (
          <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.slice(0, 6)}`}</option>
        ))}
      </select>
    </div>
  );
}
