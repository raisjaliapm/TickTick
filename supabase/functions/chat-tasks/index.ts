import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { messages, type } = await req.json();

    // Fetch user's tasks and categories for context
    const [{ data: tasks }, { data: categories }] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").eq("user_id", user.id),
    ]);

    const tasksSummary = (tasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      due_date: t.due_date,
      category_id: t.category_id,
      recurrence: t.recurrence,
      description: t.description,
      created_at: t.created_at,
      completed_at: t.completed_at,
    }));

    const categoriesMap = Object.fromEntries((categories || []).map((c: any) => [c.id, c.name]));
    const categoriesList = (categories || []).map((c: any) => ({ id: c.id, name: c.name }));

    const today = new Date().toISOString().split('T')[0];
    const activeTasks = tasksSummary.filter((t: any) => t.status !== 'completed');
    const completedToday = tasksSummary.filter((t: any) => t.status === 'completed' && t.completed_at?.startsWith(today));
    const overdueTasks = activeTasks.filter((t: any) => t.due_date && t.due_date < new Date().toISOString());

    const systemPrompt = `You are an intelligent AI task manager named "TickTick AI". You are proactive, insightful, and help users be more productive. Today is ${today}.

USER'S CATEGORIES: ${JSON.stringify(categoriesList)}
CATEGORY MAP: ${JSON.stringify(categoriesMap)}

ACTIVE TASKS (${activeTasks.length}): ${JSON.stringify(activeTasks)}
COMPLETED TODAY (${completedToday.length}): ${JSON.stringify(completedToday)}
OVERDUE TASKS (${overdueTasks.length}): ${JSON.stringify(overdueTasks)}

YOUR CAPABILITIES:
1. **Task Management**: Create, update, complete, delete tasks
2. **Smart Auto-Categorize**: When creating tasks, automatically assign the best category and priority based on the task content
3. **Task Breakdown**: Break complex tasks into smaller, actionable subtasks
4. **Daily Planning**: Provide intelligent daily summaries, suggest what to focus on, highlight overdue items
5. **Smart Suggestions**: Proactively suggest tasks based on patterns and context
6. **Productivity Insights**: Analyze completion patterns and provide tips

BEHAVIOR GUIDELINES:
- When user says something vague like "plan my day" or "what should I do", give a structured daily plan with priorities
- When creating tasks, ALWAYS auto-assign a category_id from available categories and set an appropriate priority
- When asked to break down a task, create multiple subtasks with proper priorities and categories
- Use markdown formatting: headers, bullet points, bold text, emojis for visual appeal
- Be conversational but efficient. Use emojis sparingly but effectively
- When showing tasks, format them beautifully with status indicators
- Proactively mention overdue tasks and suggest priorities
- If user greets you, give a brief daily summary with key metrics

STATUS INDICATORS: ⭕ Not Started | 🔵 In Progress | ⏸️ On Hold | ✅ Completed
PRIORITY INDICATORS: 🔴 Urgent | 🟠 High | 🟡 Medium | 🔵 Low`;

    const tools = [
      {
        type: "function",
        function: {
          name: "complete_task",
          description: "Mark a task as completed",
          parameters: {
            type: "object",
            properties: { task_id: { type: "string", description: "The task ID to complete" } },
            required: ["task_id"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a new task. Auto-assign category and priority based on content.",
          parameters: {
            type: "object",
            properties: {
              title: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              status: { type: "string", enum: ["not_started", "in_progress", "on_hold", "completed"] },
              due_date: { type: "string", description: "ISO date string or null" },
              category_id: { type: "string", description: "Category ID from available categories" },
              description: { type: "string", description: "Optional task description" },
            },
            required: ["title", "priority", "category_id"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "create_multiple_tasks",
          description: "Create multiple tasks at once (for task breakdown). Auto-assign category and priority.",
          parameters: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                    category_id: { type: "string" },
                    due_date: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["title", "priority", "category_id"],
                  additionalProperties: false,
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "update_task",
          description: "Update an existing task's properties",
          parameters: {
            type: "object",
            properties: {
              task_id: { type: "string" },
              title: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
              status: { type: "string", enum: ["not_started", "in_progress", "on_hold", "completed"] },
              due_date: { type: "string" },
              category_id: { type: "string" },
              description: { type: "string" },
            },
            required: ["task_id"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "delete_task",
          description: "Delete a task permanently",
          parameters: {
            type: "object",
            properties: { task_id: { type: "string" } },
            required: ["task_id"],
            additionalProperties: false,
          },
        },
      },
    ];

    const body: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      tools,
      stream: false,
    };

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const choice = aiData.choices?.[0];

    // Handle tool calls
    if (choice?.message?.tool_calls?.length) {
      const toolResults: string[] = [];

      for (const toolCall of choice.message.tool_calls) {
        const fn = toolCall.function;
        const args = JSON.parse(fn.arguments);

        if (fn.name === "complete_task") {
          const { error } = await supabase.from("tasks").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", args.task_id).eq("user_id", user.id);
          toolResults.push(error ? `Failed to complete task: ${error.message}` : `Task completed successfully.`);
        } else if (fn.name === "create_task") {
          const { error } = await supabase.from("tasks").insert({
            user_id: user.id,
            title: args.title,
            priority: args.priority || "medium",
            status: args.status || "not_started",
            due_date: args.due_date || null,
            category_id: args.category_id || null,
            description: args.description || null,
          });
          toolResults.push(error ? `Failed to create task: ${error.message}` : `Task "${args.title}" created.`);
        } else if (fn.name === "create_multiple_tasks") {
          const results: string[] = [];
          for (const task of args.tasks) {
            const { error } = await supabase.from("tasks").insert({
              user_id: user.id,
              title: task.title,
              priority: task.priority || "medium",
              status: "not_started",
              due_date: task.due_date || null,
              category_id: task.category_id || null,
              description: task.description || null,
            });
            results.push(error ? `Failed: "${task.title}"` : `Created: "${task.title}"`);
          }
          toolResults.push(results.join("\n"));
        } else if (fn.name === "update_task") {
          const updates: any = {};
          if (args.title) updates.title = args.title;
          if (args.priority) updates.priority = args.priority;
          if (args.status) {
            updates.status = args.status;
            updates.completed_at = args.status === 'completed' ? new Date().toISOString() : null;
          }
          if (args.due_date) updates.due_date = args.due_date;
          if (args.category_id) updates.category_id = args.category_id;
          if (args.description !== undefined) updates.description = args.description;
          const { error } = await supabase.from("tasks").update(updates).eq("id", args.task_id).eq("user_id", user.id);
          toolResults.push(error ? `Failed to update task: ${error.message}` : `Task updated.`);
        } else if (fn.name === "delete_task") {
          const { error } = await supabase.from("tasks").delete().eq("id", args.task_id).eq("user_id", user.id);
          toolResults.push(error ? `Failed to delete task: ${error.message}` : `Task deleted.`);
        }
      }

      // Second AI call to generate natural language response
      const followUpMessages = [
        ...body.messages,
        choice.message,
        ...choice.message.tool_calls.map((tc: any, i: number) => ({
          role: "tool",
          tool_call_id: tc.id,
          content: toolResults[i],
        })),
      ];

      const followUpResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followUpMessages,
          stream: false,
        }),
      });

      if (followUpResponse.ok) {
        const followUpData = await followUpResponse.json();
        const content = followUpData.choices?.[0]?.message?.content || toolResults.join("\n");
        return new Response(JSON.stringify({ content, actions: toolResults }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ content: toolResults.join("\n"), actions: toolResults }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Regular text response
    return new Response(JSON.stringify({ content: choice?.message?.content || "I'm not sure how to help with that." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat-tasks error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
