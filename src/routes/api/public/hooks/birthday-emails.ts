import { createFileRoute } from "@tanstack/react-router";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function safeHeader(value: string) {
  return value.replace(/[\r\n]/g, " ");
}

function encodeMessage(message: string) {
  return Buffer.from(message, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export const Route = createFileRoute("/api/public/hooks/birthday-emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const configuredAnonKey = process.env["SUPABASE_ANON_KEY"];
        const requestAnonKey = request.headers.get("apikey");

        if (!configuredAnonKey || requestAnonKey !== configuredAnonKey) {
          return jsonResponse({ error: "Unauthorized" }, 401);
        }

        const lovableApiKey = process.env["LOVABLE_API_KEY"];
        const gmailApiKey = process.env["GOOGLE_MAIL_API_KEY"];
        if (!lovableApiKey || !gmailApiKey) {
          console.error("Birthday email job is missing its Gmail connection configuration");
          return jsonResponse({ error: "Email configuration is unavailable" }, 500);
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const month = now.getUTCMonth() + 1;
        const day = now.getUTCDate();
        const year = now.getUTCFullYear();

        const { data: clients, error: clientsError } = await supabaseAdmin
          .from("clients")
          .select(
            "id, first_name, last_name, email, date_of_birth, birthday_email_enabled, birthday_email_last_sent_year",
          )
          .eq("birthday_email_enabled", true)
          .not("email", "is", null)
          .not("date_of_birth", "is", null);

        if (clientsError) {
          console.error("Birthday email job could not load clients", clientsError);
          return jsonResponse({ error: "Client records could not be loaded" }, 500);
        }

        const birthdayClients = (clients ?? []).filter((client) => {
          if (!client.date_of_birth || !client.email) return false;
          const birthday = new Date(`${client.date_of_birth}T00:00:00Z`);
          return birthday.getUTCMonth() + 1 === month && birthday.getUTCDate() === day;
        });

        if (birthdayClients.length === 0) {
          return jsonResponse({ sent: 0, skipped: 0, checked: clients?.length ?? 0 });
        }

        const profileResponse = await fetch(`${GATEWAY_URL}/users/me/profile`, {
          headers: {
            Authorization: `Bearer ${lovableApiKey}`,
            "X-Connection-Api-Key": gmailApiKey,
          },
        });

        if (!profileResponse.ok) {
          const errorBody = await profileResponse.text();
          console.error(`Gmail profile lookup failed [${profileResponse.status}]: ${errorBody}`);
          return jsonResponse({ error: "The connected Gmail account could not be verified" }, 502);
        }

        const profile = (await profileResponse.json()) as { emailAddress?: string };
        if (!profile.emailAddress) {
          console.error("Gmail profile did not include a sender address");
          return jsonResponse({ error: "The connected Gmail account has no sender address" }, 502);
        }

        let sent = 0;
        let skipped = 0;

        for (const client of birthdayClients) {
          const { data: claimedClient, error: claimError } = await supabaseAdmin
            .from("clients")
            .update({ birthday_email_last_sent_year: year })
            .eq("id", client.id)
            .or(`birthday_email_last_sent_year.is.null,birthday_email_last_sent_year.neq.${year}`)
            .select("id")
            .maybeSingle();

          if (claimError) {
            console.error("Birthday email job could not claim a client", claimError);
            skipped += 1;
            continue;
          }

          if (!claimedClient) {
            skipped += 1;
            continue;
          }

          const firstName = safeHeader(client.first_name);
          const recipient = safeHeader(client.email ?? "");
          const subject = `Happy Birthday, ${firstName}!`;
          const rawMessage = [
            `To: ${recipient}`,
            `From: ${safeHeader(profile.emailAddress)}`,
            `Subject: ${subject}`,
            "MIME-Version: 1.0",
            'Content-Type: text/plain; charset="UTF-8"',
            "",
            `Hi ${firstName},`,
            "",
            "Wishing you a very happy birthday! I hope your day is filled with joy and time with the people who matter most.",
            "",
            "Warmly,",
            "Your insurance advisor",
          ].join("\r\n");

          const sendResponse = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${lovableApiKey}`,
              "X-Connection-Api-Key": gmailApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ raw: encodeMessage(rawMessage) }),
          });

          if (!sendResponse.ok) {
            const errorBody = await sendResponse.text();
            console.error(`Birthday email send failed [${sendResponse.status}]: ${errorBody}`);
            await supabaseAdmin
              .from("clients")
              .update({ birthday_email_last_sent_year: client.birthday_email_last_sent_year })
              .eq("id", client.id)
              .eq("birthday_email_last_sent_year", year);
            skipped += 1;
            continue;
          }

          sent += 1;
        }

        return jsonResponse({ sent, skipped, checked: clients?.length ?? 0 });
      },
    },
  },
});
