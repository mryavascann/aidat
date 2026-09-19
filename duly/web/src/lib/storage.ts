export const encode = (data: unknown) =>
  JSON.stringify(data, (_, v) => (typeof v === "bigint" ? v.toString() : v));
export function load<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(`duly:${key}`);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(
      "Saved Duly data is unreadable. Export browser storage before resetting it.",
    );
  }
}
export function save(key: string, value: unknown) {
  localStorage.setItem(`duly:${key}`, encode(value));
}
export function exclusive<T>(run: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error("Use a browser with Web Locks on HTTPS or localhost.");
  return navigator.locks.request(
    "duly-payments",
    { ifAvailable: true },
    (lock) => {
      if (!lock) throw new Error("Another Duly tab is processing a payment.");
      return run();
    },
  );
}
