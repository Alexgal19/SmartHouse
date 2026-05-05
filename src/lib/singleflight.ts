const inFlight = new Map<string, Promise<unknown>>();

export function singleflight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inFlight.has(key)) return inFlight.get(key) as Promise<T>;
  const promise = fn().finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
