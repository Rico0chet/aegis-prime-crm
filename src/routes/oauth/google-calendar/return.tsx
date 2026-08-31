import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

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
    const notifyOpenerAndClose = (
      type: "appUserConnectorOAuthComplete" | "appUserConnectorOAuthFailed",
      code?: string,
    ) => {
      const payload = { type, connectorId: "google_calendar", code: code ?? null };
      const opener = window.opener as Window | null;
      if (opener) {
        // Same-origin first; fall back to a wildcard target for embedded
        // previews where the opener runs on a different preview host.
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
      if (type === "appUserConnectorOAuthComplete") {
        // Give the opener a moment to receive the message before closing.
        window.setTimeout(() => window.close(), 400);
      }
    };

    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "The calendar connection did not complete.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notifyOpenerAndClose("appUserConnectorOAuthComplete");
        return;
      }
      setMessage("The calendar connection completed without an exchange code.");
      notifyOpenerAndClose("appUserConnectorOAuthFailed");
      return;
    }
    notifyOpenerAndClose("appUserConnectorOAuthComplete", code);
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <p className="text-sm text-brand-muted">{message}</p>
    </main>
  );
}
