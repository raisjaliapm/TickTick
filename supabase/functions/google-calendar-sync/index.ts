import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data;
}

async function getValidToken(
  supabase: any,
  userId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const { data: tokenRow, error } = await supabase
    .from("google_calendar_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !tokenRow) throw new Error("Google Calendar not connected");

  // Check if token is expired (with 5 min buffer)
  if (new Date(tokenRow.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)) {
    const refreshed = await refreshAccessToken(tokenRow.refresh_token, clientId, clientSecret);

    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await supabase
      .from("google_calendar_tokens")
      .update({
        access_token: refreshed.access_token,
        token_expires_at: newExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);

    return refreshed.access_token;
  }

  return tokenRow.access_token;
}

async function createCalendarEvent(
  accessToken: string,
  task: { title: string; description?: string; due_date?: string | null }
) {
  let event: any;

  if (task.due_date) {
    const startTime = new Date(task.due_date);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour duration
    event = {
      summary: task.title,
      description: task.description || "",
      start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
      end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    };
  } else {
    // No due date — create an all-day event for today
    const today = new Date().toISOString().split("T")[0];
    event = {
      summary: task.title,
      description: task.description || "",
      start: { date: today },
      end: { date: today },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    };
  }

  const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Create event failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  task: { title: string; description?: string; due_date: string; status: string }
) {
  const startTime = new Date(task.due_date);
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  const event: any = {
    summary: task.title,
    description: task.description || "",
    start: { dateTime: startTime.toISOString(), timeZone: "UTC" },
    end: { dateTime: endTime.toISOString(), timeZone: "UTC" },
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: 30 }],
    },
  };

  // Mark completed tasks
  if (task.status === "completed") {
    event.summary = `✅ ${task.title}`;
    event.colorId = "2"; // Green
  }

  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error(`Update event failed [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const res = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Delete event failed [${res.status}]: ${text}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
  const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Authenticate user
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, task } = await req.json();

    const accessToken = await getValidToken(supabase, userId, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);

    let result: any = { success: true };

    if (action === "create") {
      if (!task.due_date) {
        return new Response(JSON.stringify({ error: "Task has no due date" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const event = await createCalendarEvent(accessToken, task);

      // Store the calendar event ID on the task
      await supabase
        .from("tasks")
        .update({ google_calendar_event_id: event.id })
        .eq("id", task.id)
        .eq("user_id", userId);

      result = { success: true, eventId: event.id };
    } else if (action === "update") {
      if (!task.google_calendar_event_id) {
        // No existing event — create one if task has a due date
        if (task.due_date) {
          const event = await createCalendarEvent(accessToken, task);
          await supabase
            .from("tasks")
            .update({ google_calendar_event_id: event.id })
            .eq("id", task.id)
            .eq("user_id", userId);
          result = { success: true, eventId: event.id };
        } else {
          result = { success: true, message: "No event to update" };
        }
      } else if (!task.due_date) {
        // Due date removed — delete the calendar event
        await deleteCalendarEvent(accessToken, task.google_calendar_event_id);
        await supabase
          .from("tasks")
          .update({ google_calendar_event_id: null })
          .eq("id", task.id)
          .eq("user_id", userId);
        result = { success: true, message: "Event deleted (no due date)" };
      } else {
        await updateCalendarEvent(accessToken, task.google_calendar_event_id, task);
        result = { success: true };
      }
    } else if (action === "delete") {
      if (task.google_calendar_event_id) {
        await deleteCalendarEvent(accessToken, task.google_calendar_event_id);
      }
      result = { success: true };
    } else if (action === "check") {
      // Just check if connected
      result = { success: true, connected: true };
    } else if (action === "sync_all") {
      // Sync all tasks with due dates that don't have calendar events yet
      const { data: tasksToSync } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId)
        .not("due_date", "is", null)
        .is("google_calendar_event_id", null)
        .neq("status", "completed");

      let synced = 0;
      if (tasksToSync) {
        for (const t of tasksToSync) {
          try {
            const event = await createCalendarEvent(accessToken, t);
            await supabase
              .from("tasks")
              .update({ google_calendar_event_id: event.id })
              .eq("id", t.id);
            synced++;
          } catch (err) {
            console.error(`Failed to sync task ${t.id}:`, err);
          }
        }
      }
      result = { success: true, synced };
    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Calendar sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
