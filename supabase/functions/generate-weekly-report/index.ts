import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get all distinct user IDs from tasks
    const { data: users, error: usersError } = await supabase
      .from("tasks")
      .select("user_id")
      .limit(1000);

    if (usersError) throw usersError;

    const uniqueUserIds = [...new Set(users.map((u: any) => u.user_id))];

    const now = new Date();
    // Calculate last week: Monday to Sunday
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday - 7);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split("T")[0];
    const weekEndStr = weekEnd.toISOString().split("T")[0];

    const results = [];

    for (const userId of uniqueUserIds) {
      // Get all tasks for this user
      const { data: allTasks } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", userId);

      if (!allTasks || allTasks.length === 0) continue;

      // Get categories
      const { data: cats } = await supabase
        .from("categories")
        .select("*")
        .eq("user_id", userId);

      const categoryMap: Record<string, string> = {};
      (cats || []).forEach((c: any) => {
        categoryMap[c.id] = c.name;
      });

      const active = allTasks.filter((t: any) => t.status === "active");
      const completed = allTasks.filter((t: any) => t.status === "completed");
      const overdue = active.filter(
        (t: any) => t.due_date && new Date(t.due_date) < now
      );

      // Tasks completed during this week
      const completedThisWeek = completed.filter((t: any) => {
        if (!t.completed_at) return false;
        const d = new Date(t.completed_at);
        return d >= weekStart && d <= weekEnd;
      });

      // By priority
      const byPriority: Record<string, number> = {};
      allTasks.forEach((t: any) => {
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      });

      // By category
      const byCategory: Record<string, { active: number; completed: number }> = {};
      allTasks.forEach((t: any) => {
        const name = t.category_id
          ? categoryMap[t.category_id] || "Unknown"
          : "Uncategorized";
        if (!byCategory[name]) byCategory[name] = { active: 0, completed: 0 };
        if (t.status === "completed") byCategory[name].completed++;
        else byCategory[name].active++;
      });

      // Top completed tasks this week (max 10)
      const topCompleted = completedThisWeek.slice(0, 10).map((t: any) => ({
        title: t.title,
        priority: t.priority,
        completed_at: t.completed_at,
      }));

      const completionRate =
        allTasks.length > 0
          ? Math.round((completed.length / allTasks.length) * 100)
          : 0;

      // Upsert the report
      const { error: insertError } = await supabase
        .from("weekly_reports")
        .upsert(
          {
            user_id: userId,
            week_start: weekStartStr,
            week_end: weekEndStr,
            total_tasks: allTasks.length,
            completed_tasks: completed.length,
            active_tasks: active.length,
            overdue_tasks: overdue.length,
            completion_rate: completionRate,
            by_priority: byPriority,
            by_category: byCategory,
            top_completed: topCompleted,
          },
          { onConflict: "user_id,week_start" }
        );

      if (insertError) {
        console.error(`Error for user ${userId}:`, insertError);
      } else {
        results.push({ userId, weekStart: weekStartStr, status: "ok" });
      }
    }

    return new Response(
      JSON.stringify({ success: true, generated: results.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating weekly reports:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
