/** Parse a UTC datetime string from the backend (no Z suffix) as UTC. */
export function parseUTC(ts: string): Date {
  return new Date(ts.endsWith("Z") ? ts : ts + "Z");
}
