import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHmac, timingSafeEqual } from "node:crypto";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  authorizeAppUserOAuth,
  disconnectAppUser,
  exchangeAppUserOAuthCode,
} from "@/integrations/lovable/appUserConnector";
import {
  deleteConnectionForUser,
  getConnectionKeyForUser,
  saveConnectionKeyForUser,
} from "@/server/appUserConnections.server";
import {
  addDaysISO,
  buildSlots,
  CALENDAR_CONNECTOR_ID,
  cleanText,
  createCalendarEvent,
  deleteCalendarEvent,
  filterAvailable,
  GATEWAY_BASE_URL,
  getAdminClient,
  isoDateInZone,
  loadBusy,
  slugify,
  type BookingSettingsRow,
  type PublicBookingPage,
} from "@/lib/booking.server";

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
];

const CALENDAR_HANDOFF_TTL_MS = 15 * 60 * 1000;

function calendarHandoffSecret() {
  const secret = process.env["APP_USER_CONNECTION_KEY_SECRET"];
  if (!secret) throw new Error("Calendar connection security is not configured.");
  return secret;
}

function createCalendarHandoff(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ userId, expiresAt: Date.now() + CALENDAR_HANDOFF_TTL_MS }),
  ).toString("base64url");
  const signature = createHmac("sha256", calendarHandoffSecret())
    .update(`calendar:${payload}`)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function readCalendarHandoff(handoff: string) {
  const [payload, signature, extra] = handoff.split(".");
  if (!payload || !signature || extra) throw new Error("This calendar connection link is invalid.");
  const expected = createHmac("sha256", calendarHandoffSecret())
    .update(`calendar:${payload}`)
    .digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "base64url");
  } catch {
    throw new Error("This calendar connection link is invalid.");
  }
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error("This calendar connection link is invalid.");
  }
  let parsed: { userId?: unknown; expiresAt?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("This calendar connection link is invalid.");
  }
  if (
    typeof parsed.userId !== "string" ||
    typeof parsed.expiresAt !== "number" ||
    parsed.expiresAt < Date.now()
  ) {
    throw new Error("This calendar connection link has expired. Start again from Booking.");
  }
  return parsed.userId;
}

const SETTINGS_COLUMNS =
  "user_id, slug, is_enabled, calendar_provider, headline, intro, timezone, work_days, start_time, end_time, slot_minutes, buffer_minutes, lead_hours, horizon_days";

async function loadSettingsBySlug(slug: string): Promise<BookingSettingsRow> {
  const supabaseAdmin = await getAdminClient();
  const { data, error } = await supabaseAdmin
    .from("booking_settings")
    .select(SETTINGS_COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("Booking page lookup failed", error);
    throw new Error("This booking page could not be opened.");
  }
  if (!data || !data.is_enabled) throw new Error("This booking page is not available.");
  return data as BookingSettingsRow;
}

/* ------------------------------ public reads ------------------------------ */


export const getBookingPage = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: cleanText(input.slug, 64) }))
  .handler(async ({ data }): Promise<PublicBookingPage> => {
    const settings = await loadSettingsBySlug(data.slug);
    const supabaseAdmin = await getAdminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, agency, title")
      .eq("id", settings.user_id)
      .maybeSingle();

    const name = profile?.full_name ?? "Your insurance advisor";
    return {
      slug: settings.slug,
      producerName: name,
      agency: profile?.agency ?? null,
      title: profile?.title ?? null,
      headline: settings.headline ?? `Book an appointment with ${name}`,
      intro:
        settings.intro ??
        "Pick a time that works for you. You'll get a calendar invite by email right away.",
      timezone: settings.timezone,
      slotMinutes: settings.slot_minutes,
      horizonDays: settings.horizon_days,
      workDays: settings.work_days,
    };
  });

export const getBookingSlots = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; date: string }) => ({
    slug: cleanText(input.slug, 64),
    date: cleanText(input.date, 10),
  }))
  .handler(async ({ data }) => {
    const settings = await loadSettingsBySlug(data.slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error("Pick a valid date.");

    const today = isoDateInZone(new Date(), settings.timezone);
    const last = addDaysISO(today, settings.horizon_days);
    if (data.date < today || data.date > last) return { slots: [] as string[] };

    const slots = buildSlots(settings, data.date);
    if (slots.length === 0) return { slots: [] as string[] };

    const timeMin = slots[0]!;
    const timeMax = new Date(
      slots[slots.length - 1]!.getTime() + settings.slot_minutes * 60_000,
    );
    const busy = await loadBusy(settings.user_id, timeMin, timeMax);
    const open = filterAvailable(slots, busy, settings.slot_minutes, settings.lead_hours);
    return { slots: open.map((slot) => slot.toISOString()) };
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      slug: string;
      startISO: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      reason: string;
    }) => ({
      slug: cleanText(input.slug, 64),
      startISO: cleanText(input.startISO, 40),
      first_name: cleanText(input.first_name, 80),
      last_name: cleanText(input.last_name, 80),
      email: cleanText(input.email, 160),
      phone: cleanText(input.phone, 40),
      reason: String(input.reason ?? "").trim().slice(0, 2000),
    }),
  )
  .handler(async ({ data }) => {
    const settings = await loadSettingsBySlug(data.slug);
    if (!data.first_name || !data.last_name) throw new Error("Please enter your first and last name.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
      throw new Error("Please enter a valid email address.");
    }
    const start = new Date(data.startISO);
    if (Number.isNaN(start.getTime())) throw new Error("Please pick a time slot.");
    const end = new Date(start.getTime() + settings.slot_minutes * 60_000);

    const dateISO = isoDateInZone(start, settings.timezone);
    const validSlot = buildSlots(settings, dateISO).some((s) => s.getTime() === start.getTime());
    if (!validSlot) throw new Error("That time is no longer available. Please pick another slot.");

    const busy = await loadBusy(settings.user_id, start, end);
    const stillOpen = filterAvailable([start], busy, settings.slot_minutes, settings.lead_hours);
    if (stillOpen.length === 0) {
      throw new Error("That time was just taken. Please pick another slot.");
    }

    const supabaseAdmin = await getAdminClient();

    const { data: existingClient } = await supabaseAdmin
      .from("clients")
      .select("id")
      .eq("user_id", settings.user_id)
      .eq("email", data.email)
      .maybeSingle();

    let clientId = existingClient?.id ?? null;
    if (!clientId) {
      const { data: created } = await supabaseAdmin
        .from("clients")
        .insert({
          user_id: settings.user_id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone || null,
          status: "prospect",
          notes: data.reason ? `Booked appointment: ${data.reason}` : null,
        })
        .select("id")
        .maybeSingle();
      clientId = created?.id ?? null;
    }

    const fullName = `${data.first_name} ${data.last_name}`;
    const { eventId, meetingUrl } = await createCalendarEvent({
      userId: settings.user_id,
      summary: `Consultation — ${fullName}`,
      description: [
        `Booked through Aegis Prime.`,
        `Name: ${fullName}`,
        `Email: ${data.email}`,
        data.phone ? `Phone: ${data.phone}` : null,
        data.reason ? `Reason: ${data.reason}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      start,
      end,
      timezone: settings.timezone,
      attendeeEmail: data.email,
      attendeeName: fullName,
    });

    const { error } = await supabaseAdmin.from("appointments").insert({
      user_id: settings.user_id,
      client_id: clientId,
      first_name: data.first_name,
      last_name: data.last_name,
      email: data.email,
      phone: data.phone || null,
      reason: data.reason || null,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      timezone: settings.timezone,
      calendar_provider: settings.calendar_provider,
      calendar_event_id: eventId,
      meeting_url: meetingUrl,
    });
    if (error) {
      console.error("Appointment insert failed", error);
      throw new Error("We couldn't confirm that booking. Please try again.");
    }

    if (clientId) {
      await supabaseAdmin.from("activities").insert({
        user_id: settings.user_id,
        client_id: clientId,
        type: "meeting",
        summary: `Appointment booked for ${start.toISOString()}`,
        occurred_at: new Date().toISOString(),
      });
    }

    return {
      ok: true as const,
      startISO: start.toISOString(),
      timezone: settings.timezone,
      addedToCalendar: Boolean(eventId),
    };
  });

/* ----------------------------- producer config ---------------------------- */

export const getMyBookingSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("booking_settings")
      .select(SETTINGS_COLUMNS)
      .eq("user_id", context.userId)
      .maybeSingle();
    const connected = Boolean(await getConnectionKeyForUser(context.userId, CALENDAR_CONNECTOR_ID));
    return { settings: (data as BookingSettingsRow | null) ?? null, calendarConnected: connected };
  });

export const saveMyBookingSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      slug: string;
      is_enabled: boolean;
      headline: string;
      intro: string;
      timezone: string;
      work_days: number[];
      start_time: string;
      end_time: string;
      slot_minutes: number;
      buffer_minutes: number;
      lead_hours: number;
      horizon_days: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const slug = slugify(cleanText(data.slug, 48));
    if (slug.length < 3) throw new Error("Your booking link needs at least 3 characters.");

    const supabaseAdmin = await getAdminClient();
    const { data: taken } = await supabaseAdmin
      .from("booking_settings")
      .select("user_id")
      .eq("slug", slug)
      .maybeSingle();
    if (taken && taken.user_id !== context.userId) {
      throw new Error("That booking link is already taken. Try another.");
    }

    const workDays = (data.work_days ?? []).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
    const payload = {
      user_id: context.userId,
      slug,
      is_enabled: Boolean(data.is_enabled),
      calendar_provider: CALENDAR_CONNECTOR_ID,
      headline: cleanText(data.headline, 120) || null,
      intro: String(data.intro ?? "").trim().slice(0, 600) || null,
      timezone: cleanText(data.timezone, 64) || "America/Denver",
      work_days: workDays.length ? workDays : [1, 2, 3, 4, 5],
      start_time: cleanText(data.start_time, 5) || "09:00",
      end_time: cleanText(data.end_time, 5) || "17:00",
      slot_minutes: Math.min(240, Math.max(10, Number(data.slot_minutes) || 30)),
      buffer_minutes: Math.min(120, Math.max(0, Number(data.buffer_minutes) || 0)),
      lead_hours: Math.min(336, Math.max(0, Number(data.lead_hours) || 0)),
      horizon_days: Math.min(120, Math.max(1, Number(data.horizon_days) || 21)),
      updated_at: new Date().toISOString(),
    };

    const { error } = await context.supabase
      .from("booking_settings")
      .upsert(payload, { onConflict: "user_id" });
    if (error) {
      console.error("Booking settings save failed", error);
      throw new Error("We couldn't save your booking page.");
    }
    return { ok: true as const, slug };
  });

export const listMyAppointments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("appointments")
      .select("id, first_name, last_name, email, phone, reason, starts_at, ends_at, timezone, status, meeting_url")
      .eq("user_id", context.userId)
      .gte("starts_at", new Date(Date.now() - 7 * 86_400_000).toISOString())
      .order("starts_at");
    return data ?? [];
  });

export const cancelAppointment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => ({ id: cleanText(input.id, 64) }))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("appointments")
      .select("id, calendar_event_id")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!row) throw new Error("Appointment not found.");
    if (row.calendar_event_id) await deleteCalendarEvent(context.userId, row.calendar_event_id);
    const { error } = await context.supabase
      .from("appointments")
      .update({ status: "cancelled" })
      .eq("id", data.id);
    if (error) throw new Error("We couldn't cancel that appointment.");
    return { ok: true as const };
  });

/* ------------------------------ calendar OAuth ----------------------------- */

export const startCalendarConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const clientAPIKey = process.env["GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY"];
    if (!clientAPIKey) throw new Error("Google Calendar connector is not configured yet.");

    const request = getRequest();
    if (!request) throw new Error("Calendar connect must start from an app request.");
    const url = new URL(request.url);
    const sandboxHost =
      url.hostname === "localhost" ? request.headers.get("x-forwarded-host") : null;
    const returnUrl = new URL(
      "/oauth/google-calendar/return",
      sandboxHost ? `https://${sandboxHost}` : url.origin,
    );
    returnUrl.searchParams.set("handoff", createCalendarHandoff(context.userId));

    const existing = await getConnectionKeyForUser(context.userId, CALENDAR_CONNECTOR_ID);
    const { authorizationUrl } = await authorizeAppUserOAuth({
      gatewayBaseUrl: GATEWAY_BASE_URL,
      connectorId: CALENDAR_CONNECTOR_ID,
      appUserId: context.userId,
      clientAPIKey,
      returnUrl: returnUrl.toString(),
      ...(existing ? { connectionAPIKey: existing } : {}),
      credentialsConfiguration: { scopes: GOOGLE_SCOPES },
    });
    return { authorizationUrl };
  });

export const completeCalendarConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => ({ code: cleanText(input.code, 512) }))
  .handler(async ({ data, context }) => {
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CALENDAR_CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector.");
    }
    await saveConnectionKeyForUser(context.userId, connectorId, connectionAPIKey);
    return { ok: true as const };
  });

/**
 * Completes OAuth from the standalone return tab. The signed, short-lived
 * handoff identifies the producer without relying on browser storage or on
 * the popup inheriting the embedded preview's authenticated session.
 */
export const completeCalendarConnectionFromReturn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string; handoff: string }) => ({
    code: cleanText(input.code, 512),
    handoff: cleanText(input.handoff, 2048),
  }))
  .handler(async ({ data }) => {
    const userId = readCalendarHandoff(data.handoff);
    const { connectionAPIKey, connectorId } = await exchangeAppUserOAuthCode(
      GATEWAY_BASE_URL,
      data.code,
    );
    if (connectorId !== CALENDAR_CONNECTOR_ID) {
      throw new Error("OAuth completion returned the wrong connector.");
    }
    await saveConnectionKeyForUser(userId, connectorId, connectionAPIKey);
    return { ok: true as const };
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const key = await getConnectionKeyForUser(context.userId, CALENDAR_CONNECTOR_ID);
    if (key) {
      try {
        await disconnectAppUser({
          gatewayBaseUrl: GATEWAY_BASE_URL,
          connectionAPIKey: key,
          connectorId: CALENDAR_CONNECTOR_ID,
        });
      } catch (error) {
        console.error("Calendar disconnect failed", error);
      }
      await deleteConnectionForUser(context.userId, CALENDAR_CONNECTOR_ID);
    }
    return { ok: true as const };
  });
