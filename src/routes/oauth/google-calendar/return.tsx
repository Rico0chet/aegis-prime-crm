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
      window.opener?.postMessage(
        { type, connectorId: "google_calendar", code: code ?? null },
        window.location.origin,
      );
      window.close();
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
