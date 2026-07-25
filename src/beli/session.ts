import type { LoggedInUser, Session } from "./types";

const SESSION_KEY = "beliSession";
const USER_KEY = "beliUser";

export async function loadSession(): Promise<Session | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  const s = result[SESSION_KEY] as Session | undefined;
  if (!s?.access || !s?.refresh || !s?.userId) return null;
  return s;
}

export async function saveSession(session: Session): Promise<void> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
}

export async function loadCachedUser(): Promise<LoggedInUser | null> {
  const result = await chrome.storage.local.get(USER_KEY);
  const user = result[USER_KEY] as LoggedInUser | undefined;
  return user?.id && user?.username ? user : null;
}

export async function saveCachedUser(user: LoggedInUser): Promise<void> {
  await chrome.storage.local.set({ [USER_KEY]: user });
}

export async function clearSession(): Promise<void> {
  await chrome.storage.local.remove([SESSION_KEY, USER_KEY]);
}
