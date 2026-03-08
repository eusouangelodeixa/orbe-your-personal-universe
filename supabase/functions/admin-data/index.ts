import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return new Response(JSON.stringify({ error: "STRIPE_SECRET_KEY not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

      // Get all users count
      const { data: allUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      const totalUsers = allUsers?.users?.length || 0;

      // Get active subscriptions
      const activeSubscriptions = await stripe.subscriptions.list({ status: "active", limit: 100 });
      const trialingSubscriptions = await stripe.subscriptions.list({ status: "trialing", limit: 100 });
      const canceledSubscriptions = await stripe.subscriptions.list({ status: "canceled", limit: 100 });

      // Calculate MRR from active subscriptions
      let mrr = 0;
      const planBreakdown: Record<string, { count: number; revenue: number; name: string }> = {};

      for (const sub of activeSubscriptions.data) {
        for (const item of sub.items.data) {
          const amount = (item.price.unit_amount || 0) / 100;
          const interval = item.price.recurring?.interval;
          const monthlyAmount = interval === "year" ? amount / 12 : amount;
          mrr += monthlyAmount;

          const prodId = String(item.price.product);
          if (!planBreakdown[prodId]) {
            // Try to get product name
            let prodName = prodId;
            try {
              const product = await stripe.products.retrieve(prodId);
              prodName = product.name;
            } catch { /* ignore */ }
            planBreakdown[prodId] = { count: 0, revenue: 0, name: prodName };
          }
          planBreakdown[prodId].count += 1;
          planBreakdown[prodId].revenue += monthlyAmount;
        }
      }

      // Get recent charges for current month revenue
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const charges = await stripe.charges.list({
        created: { gte: Math.floor(startOfMonth.getTime() / 1000) },
        limit: 100,
      });

      const monthlyRevenue = charges.data
        .filter(c => c.status === "succeeded" && !c.refunded)
        .reduce((sum, c) => sum + (c.amount / 100), 0);

      const refunds = charges.data
        .filter(c => c.refunded || (c.amount_refunded && c.amount_refunded > 0))
        .reduce((sum, c) => sum + ((c.amount_refunded || 0) / 100), 0);

      // Get last 6 months revenue from charges
      const monthlyHistory: Array<{ month: number; year: number; revenue: number }> = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const mCharges = await stripe.charges.list({
          created: { gte: Math.floor(d.getTime() / 1000), lt: Math.floor(nextD.getTime() / 1000) },
          limit: 100,
        });
        const rev = mCharges.data
          .filter(c => c.status === "succeeded" && !c.refunded)
          .reduce((sum, c) => sum + (c.amount / 100), 0);
        monthlyHistory.push({ month: d.getMonth() + 1, year: d.getFullYear(), revenue: rev });
      }

      // Recent subscription events
      const recentInvoices = await stripe.invoices.list({ limit: 10, status: "paid" });
      const recentPayments = recentInvoices.data.map(inv => ({
        id: inv.id,
        email: inv.customer_email || "—",
        amount: (inv.amount_paid || 0) / 100,
        date: new Date((inv.created || 0) * 1000).toISOString(),
        description: inv.lines.data[0]?.description || "Assinatura ORBE",
      }));

      return new Response(JSON.stringify({
        totalUsers,
        totalSubscribers: activeSubscriptions.data.length,
        trialingUsers: trialingSubscriptions.data.length,
        canceledSubscriptions: canceledSubscriptions.data.length,
        mrr,
        monthlyRevenue,
        refunds,
        planBreakdown: Object.values(planBreakdown),
        monthlyHistory,
        recentPayments,
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
