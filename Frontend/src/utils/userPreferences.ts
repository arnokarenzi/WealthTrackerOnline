export interface LocalUserProfile {
  displayName: string;
}

const PROFILE_KEY = "fintrack.profile.v1";
export const PROFILE_UPDATED_EVENT = "fintrack-profile-updated";

export const getLocalUserProfile = (): LocalUserProfile => {
  if (typeof window === "undefined") return { displayName: "" };

  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    if (!raw) return { displayName: "" };
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "displayName" in parsed &&
      typeof (parsed as { displayName?: unknown }).displayName === "string"
    ) {
      return {
        displayName: (parsed as { displayName: string }).displayName.slice(0, 50),
      };
    }
  } catch {
    // If browser storage is unavailable or malformed, use the neutral default.
  }

  return { displayName: "" };
};

export const saveLocalUserProfile = (profile: LocalUserProfile): void => {
  if (typeof window === "undefined") {
    throw new Error("Profile settings are only available in a browser.");
  }

  const normalized = { displayName: profile.displayName.trim().slice(0, 50) };
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: normalized }));
};
