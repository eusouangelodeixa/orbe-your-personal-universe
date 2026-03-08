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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user with anon client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin email
    const adminEmailsRaw = Deno.env.get("ADMIN_EMAILS") || "";
    const adminEmails = adminEmailsRaw
      .split(",")
      .map((e) => e.trim().toLowerCase());

    if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role for admin queries
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "overview";

    if (action === "overview") {
      // Get all users from auth
      const {
        data: { users },
      } = await adminClient.auth.admin.listUsers({ perPage: 1000 });

      // Get table counts
      const [
        { count: tasksCount },
        { count: expensesCount },
        { count: subjectsCount },
        { count: fitProfilesCount },
      ] = await Promise.all([
        adminClient
          .from("tasks")
          .select("*", { count: "exact", head: true }),
        adminClient
          .from("expenses")
          .select("*", { count: "exact", head: true }),
        adminClient
          .from("subjects")
          .select("*", { count: "exact", head: true }),
        adminClient
          .from("fit_profiles")
          .select("*", { count: "exact", head: true }),
      ]);

      // Get recent profiles with names
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("user_id, display_name, phone, created_at, phone_verified")
        .order("created_at", { ascending: false });

      // Merge users + profiles
      const userList = (users || []).map((u) => {
        const profile = profiles?.find((p) => p.user_id === u.id);
        return {
          id: u.id,
          email: u.email,
          display_name: profile?.display_name || null,
          phone: profile?.phone || null,
          phone_verified: profile?.phone_verified || false,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
        };
      });

      // Recent tasks (activity log)
      const { data: recentTasks } = await adminClient
        .from("tasks")
        .select("id, title, status, category, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(20);

      // Recent expenses
      const { data: recentExpenses } = await adminClient
        .from("expenses")
        .select("id, name, amount, type, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(20);

      // Users by day (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      return new Response(
        JSON.stringify({
          users: userList,
          metrics: {
            totalUsers: users?.length || 0,
            totalTasks: tasksCount || 0,
            totalExpenses: expensesCount || 0,
            totalSubjects: subjectsCount || 0,
            totalFitProfiles: fitProfilesCount || 0,
          },
          recentActivity: {
            tasks: recentTasks || [],
            expenses: recentExpenses || [],
          },
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Categories management
    if (action === "categories") {
      const { data: categories } = await adminClient
        .from("categories")
        .select("*")
        .order("name");
      return new Response(JSON.stringify({ categories }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-category") {
      const body = await req.json();
      const { id, name, color, icon } = body;
      const { error } = await adminClient
        .from("categories")
        .update({ name, color, icon })
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create-category") {
      const body = await req.json();
      const { name, color, icon } = body;
      const { error } = await adminClient
        .from("categories")
        .insert({ name, color, icon });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete-category") {
      const body = await req.json();
      const { id } = body;
      const { error } = await adminClient
        .from("categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Settings management
    if (action === "settings") {
      const { data: settings } = await adminClient
        .from("admin_settings")
        .select("*")
        .order("key");
      return new Response(JSON.stringify({ settings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-setting") {
      const body = await req.json();
      const { key, value } = body;
      const { error } = await adminClient
        .from("admin_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Financial metrics
    if (action === "financial") {
      const { data: allUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const totalUsers = allUsers?.users?.length || 0;

      // Get all incomes and expenses for MRR-like calculations
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const [
        { data: monthlyExpenses },
        { data: monthlyIncomes },
        { data: allExpenses },
        { data: allIncomes },
        { data: wallets },
      ] = await Promise.all([
        adminClient.from("expenses").select("amount, paid, type").eq("month", currentMonth).eq("year", currentYear),
        adminClient.from("incomes").select("amount, recurring").eq("month", currentMonth).eq("year", currentYear),
        adminClient.from("expenses").select("amount, paid, month, year, type").order("year", { ascending: false }).order("month", { ascending: false }).limit(1000),
        adminClient.from("incomes").select("amount, month, year, recurring").order("year", { ascending: false }).order("month", { ascending: false }).limit(1000),
        adminClient.from("wallets").select("balance, name"),
      ]);

      const totalMonthlyRevenue = (monthlyIncomes || []).reduce((s, i) => s + Number(i.amount), 0);
      const totalMonthlyExpense = (monthlyExpenses || []).reduce((s, e) => s + Number(e.amount), 0);
      const paidExpenses = (monthlyExpenses || []).filter(e => e.paid).reduce((s, e) => s + Number(e.amount), 0);
      const pendingExpenses = totalMonthlyExpense - paidExpenses;
      const recurringRevenue = (monthlyIncomes || []).filter(i => i.recurring).reduce((s, i) => s + Number(i.amount), 0);
      const totalWalletBalance = (wallets || []).reduce((s, w) => s + Number(w.balance), 0);

      // Last 6 months revenue/expenses
      const monthlyHistory: Array<{month: number, year: number, revenue: number, expenses: number}> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(currentYear, currentMonth - 1 - i, 1);
        const m = d.getMonth() + 1;
        const y = d.getFullYear();
        const rev = (allIncomes || []).filter(inc => inc.month === m && inc.year === y).reduce((s, inc) => s + Number(inc.amount), 0);
        const exp = (allExpenses || []).filter(ex => ex.month === m && ex.year === y).reduce((s, ex) => s + Number(ex.amount), 0);
        monthlyHistory.push({ month: m, year: y, revenue: rev, expenses: exp });
      }

      return new Response(JSON.stringify({
        totalUsers,
        currentMonth: { revenue: totalMonthlyRevenue, expenses: totalMonthlyExpense, paid: paidExpenses, pending: pendingExpenses },
        mrr: recurringRevenue,
        totalWalletBalance,
        wallets: wallets || [],
        monthlyHistory,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
