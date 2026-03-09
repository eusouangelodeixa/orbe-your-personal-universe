import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Get all recurring expenses from any previous month
    const { data: recurringExpenses, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("recurring", true);

    if (fetchError) throw fetchError;
    if (!recurringExpenses || recurringExpenses.length === 0) {
      return new Response(JSON.stringify({ message: "No recurring expenses found", created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Group by user + name + type + category to avoid duplicates
    const uniqueRecurring = new Map<string, typeof recurringExpenses[0]>();
    for (const exp of recurringExpenses) {
      const key = `${exp.user_id}|${exp.name}|${exp.type}|${exp.category_id || ""}`;
      // Keep the most recent one as the template
      const existing = uniqueRecurring.get(key);
      if (!existing || new Date(exp.created_at) > new Date(existing.created_at)) {
        uniqueRecurring.set(key, exp);
      }
    }

    let created = 0;

    for (const [key, template] of uniqueRecurring) {
      // Check if already exists for current month
      const { data: existing } = await supabase
        .from("expenses")
        .select("id")
        .eq("user_id", template.user_id)
        .eq("name", template.name)
        .eq("type", template.type)
        .eq("month", currentMonth)
        .eq("year", currentYear)
        .limit(1);

      if (existing && existing.length > 0) continue;

      // Calculate due_date
      const day = template.recurring_day || new Date(template.due_date).getDate();
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      const adjustedDay = Math.min(day, lastDay);
      const dueDate = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(adjustedDay).padStart(2, "0")}`;

      const { error: insertError } = await supabase.from("expenses").insert({
        user_id: template.user_id,
        name: template.name,
        amount: template.amount,
        type: template.type,
        category_id: template.category_id,
        wallet_id: template.wallet_id,
        due_date: dueDate,
        month: currentMonth,
        year: currentYear,
        paid: false,
        recurring: true,
        recurring_day: template.recurring_day,
      });

      if (!insertError) created++;
    }

    return new Response(JSON.stringify({ message: "Recurring expenses processed", created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
