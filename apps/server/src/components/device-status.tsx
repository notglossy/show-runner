import type { DeviceView } from '@/lib/devices/service';
import { StatusDot } from './ui';

export function DeviceStatus({ device }: { device: DeviceView }) {
  if (!device.online) return <StatusDot tone="gray" label="Offline" />;
  if (!device.connected) return <StatusDot tone="amber" label="Online, page not connected" />;
  return <StatusDot tone="green" label="Online" />;
}
