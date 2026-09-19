import { deviceProvider } from './device';
import { timeProvider } from './time';
import { weatherProvider } from './weather';

/** Every provider whose output appears in kiosk.data. Add new providers here. */
export const providers = [timeProvider, weatherProvider, deviceProvider] as const;

type AnyProvider = (typeof providers)[number];

export type ProviderData = {
  [P in AnyProvider as P['key']]: Awaited<ReturnType<P['fetch']>>;
};
