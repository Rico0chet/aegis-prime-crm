/**
 * Cross-window handoff for the Google Calendar OAuth return page.
 *
 * The return page may be opened in a plain new tab (the editor preview blocks
 * Google's consent page inside the iframe, so users open the link manually).
 * In that case `window.opener` is null, so postMessage alone never reaches the
 * CRM tab. We additionally broadcast the outcome over BroadcastChannel and
 * localStorage, both of which are shared across same-origin tabs.
 */
export const OAUTH_CHANNEL = "aegis-oauth-google-calendar";
export const OAUTH_STORAGE_KEY = "aegis:oauth:google_calendar";

export type OAuthHandoffPayload = {
  type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed";
  connectorId: "google_calendar";
  code: string | null;
  at: number;
};

export function broadcastOAuthOutcome(payload: OAuthHandoffPayload) {
  try {
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    channel.postMessage(payload);
    window.setTimeout(() => channel.close(), 1000);
  } catch {
    /* BroadcastChannel unavailable */
  }
  try {
    localStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* storage unavailable / partitioned */
  }
}

/** Reads and clears a recent outcome left behind by the return tab. */
export function takeStoredOAuthOutcome(since: number): OAuthHandoffPayload | null {
  try {
    const raw = localStorage.getItem(OAUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OAuthHandoffPayload;
    if (!parsed?.type || parsed.connectorId !== "google_calendar") return null;
    if (typeof parsed.at !== "number" || parsed.at < since) return null;
    localStorage.removeItem(OAUTH_STORAGE_KEY);
    return parsed;
  } catch {
    return null;
  }
}

export function clearStoredOAuthOutcome() {
  try {
    localStorage.removeItem(OAUTH_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
