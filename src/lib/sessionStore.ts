import type { Session } from "@/types/exercise";

const KEY_PREFIX = "session-";

export function getSession(id: string): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${id}`);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${KEY_PREFIX}${session.id}`,
      JSON.stringify(session)
    );
  } catch {
    // Ignore storage errors
  }
}
