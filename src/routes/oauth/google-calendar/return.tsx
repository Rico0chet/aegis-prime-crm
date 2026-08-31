import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { broadcastOAuthOutcome, type OAuthHandoffPayload } from "@/lib/oauth-handoff";

export const Route = createFileRoute("/oauth/google-calendar/return")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finishing calendar connection | Aegis Prime" },
      { name: "description", content: "Completing the Google Calendar connection for your Aegis Prime booking page." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OAuthReturn,
});

function OAuthReturn() {
  const [message, setMessage] = useState("Finishing connection…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const handOff = (
      type: OAuthHandoffPayload["type"],
      code?: string | null,
    ) => {
      const payload: OAuthHandoffPayload = {
        type,
        connectorId: "google_calendar",
        code: code ?? null,
        at: Date.now(),
      };
      const opener = window.opener as Window | null;
      if (opener) {
        try {
          opener.postMessage(payload, window.location.origin);
        } catch {
          /* ignore */
        }
        try {
          opener.postMessage(payload, "*");
        } catch {
          /* ignore */
        }
      }
      // Works even when this page was opened as a standalone tab (no opener).
      broadcastOAuthOutcome(payload);

      if (type === "appUserConnectorOAuthComplete") {
        setMessage(
          opener
            ? "Connected. You can close this window."
            : "Connected. You can close this tab and return to Aegis Prime.",
        );
        if (opener) window.setTimeout(() => window.close(), 600);
      }
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "The calendar connection did not complete.");
      handOff("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        handOff("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("The calendar connection completed without an exchange code.");
      handOff("appUserConnectorOAuthFailed");
      return;
    }
    handOff("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-brand-muted">{message}</p>
    </main>
  );
}
