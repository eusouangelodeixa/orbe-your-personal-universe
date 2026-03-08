import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    const UAZAPI_TOKEN = Deno.env.get("UAZAPI_TOKEN");
    if (!UAZAPI_URL || !UAZAPI_TOKEN) throw new Error("UAZAPI não configurada");

    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"][now.getDay()];

    // Get all fit profiles with verified WhatsApp
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, phone, phone_verified, whatsapp_notifications, display_name")
      .eq("phone_verified", true)
      .eq("whatsapp_notifications", true);

    if (!profiles?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: "no verified users" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const profile of profiles) {
      try {
        // Get user's fit profile
        const { data: fitProfile } = await supabase
          .from("fit_profiles")
          .select("*")
          .eq("user_id", profile.user_id)
          .eq("onboarding_completed", true)
          .single();

        if (!fitProfile) continue;

        // Get active plans
        const [workoutRes, mealRes, logsRes] = await Promise.all([
          supabase.from("fit_workout_plans").select("title, plan_data").eq("user_id", profile.user_id).eq("active", true).maybeSingle(),
          supabase.from("fit_meal_plans").select("title, plan_data").eq("user_id", profile.user_id).eq("active", true).maybeSingle(),
          supabase.from("fit_workout_logs").select("workout_date").eq("user_id", profile.user_id).order("workout_date", { ascending: false }).limit(7),
        ]);

        const nome = profile.display_name?.split(" ")[0] || "Ei";
        const messages: string[] = [];

        // ===== SMART REMINDER LOGIC =====

        // 1. TRAINING REMINDERS - based on weekly_availability
        const availability = fitProfile.weekly_availability || [];
        const isTrainingDay = availability.includes(currentDay);

        if (isTrainingDay) {
          // Check if already trained today
          const today = now.toISOString().split("T")[0];
          const trainedToday = logsRes.data?.some((l: any) => l.workout_date === today);

          if (!trainedToday) {
            // Morning motivation (7-8h)
            if (currentHour === 7) {
              const workoutName = workoutRes.data?.title || "treino";
              messages.push(`🏋️ Bom dia, ${nome}! Hoje é dia de ${workoutName}. Bora! 💪`);
            }
            // Afternoon reminder if not trained yet (17-18h)
            if (currentHour === 17) {
              messages.push(`⏰ ${nome}, ainda dá tempo do treino hoje! Não deixa pra amanhã. 🔥`);
            }
          }
        }

        // 2. MEAL REMINDERS - based on meal plan times
        if (mealRes.data?.plan_data?.meals) {
          const meals = mealRes.data.plan_data.meals;
          for (const meal of meals) {
            if (!meal.time) continue;
            // Parse time like "07:00", "12:30"
            const mealHour = parseInt(meal.time.split(":")[0]);
            // Send reminder 15 min before (same hour)
            if (currentHour === mealHour) {
              messages.push(`🍽️ ${nome}, hora de ${meal.name.toLowerCase()}! Siga seu plano. 🥗`);
              break; // Only one meal reminder per cycle
            }
          }
        }

        // 3. HYDRATION - every 2-3 hours during active hours (8-20h)
        if (currentHour >= 8 && currentHour <= 20 && currentHour % 2 === 0) {
          const waterMessages = [
            `💧 ${nome}, beba água! Hidratação é fundamental.`,
            `💧 Hora de hidratar, ${nome}! Seu corpo agradece.`,
            `💧 Já bebeu água? Mantenha o corpo hidratado, ${nome}!`,
          ];
          // Only send hydration at 10h and 15h to avoid spam
          if (currentHour === 10 || currentHour === 15) {
            messages.push(waterMessages[currentHour === 10 ? 0 : 1]);
          }
        }

        // 4. SUPPLEMENT REMINDERS - if user takes supplements
        const supplements = fitProfile.supplements || [];
        if (supplements.length > 0) {
          // Morning supplements (8h)
          if (currentHour === 8) {
            messages.push(`💊 ${nome}, hora dos suplementos: ${supplements.slice(0, 3).join(", ")}. Não esquece!`);
          }
        }

        // 5. WEEKLY MOTIVATION - Monday morning
        if (currentDay === "seg" && currentHour === 7) {
          const goals: Record<string, string> = {
            perda_gordura: "queimar gordura",
            ganho_massa: "ganhar massa",
            hipertrofia: "hipertrofiar",
            condicionamento: "melhorar o condicionamento",
            manutencao: "manter a forma",
            saude_geral: "cuidar da saúde",
          };
          const goal = goals[fitProfile.goal] || "alcançar seu objetivo";
          messages.push(`🔥 Nova semana, ${nome}! Mais 7 dias pra ${goal}. Vamos com tudo! 💪`);
        }

        // 6. INACTIVITY ALERT - if hasn't trained in 3+ days on training days
        if (currentHour === 19 && logsRes.data) {
          const lastLog = logsRes.data[0];
          if (lastLog) {
            const daysSince = Math.floor((now.getTime() - new Date(lastLog.workout_date).getTime()) / 86400000);
            if (daysSince >= 3 && availability.length > 0) {
              messages.push(`⚠️ ${nome}, faz ${daysSince} dias sem treinar! Volta pra rotina, seu corpo precisa. 💪`);
            }
          } else if (availability.length > 0) {
            messages.push(`⚠️ ${nome}, você ainda não registrou nenhum treino. Que tal começar hoje? 🏋️`);
          }
        }

        // Send all messages (max 2 per cycle to avoid spam)
        const toSend = messages.slice(0, 2);
        for (const msg of toSend) {
          try {
            await fetch(`${UAZAPI_URL}/send/text`, {
              method: "POST",
              headers: { "Content-Type": "application/json", token: UAZAPI_TOKEN },
              body: JSON.stringify({ number: profile.phone, text: `*ORBE Fit*\n\n${msg}` }),
            });
            sentCount++;
          } catch (e) {
            console.error(`Failed to send to ${profile.user_id}:`, e);
          }
        }
      } catch (e) {
        console.error(`Error processing user ${profile.user_id}:`, e);
      }
    }

    return new Response(JSON.stringify({ sent: sentCount, users: profiles.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("fit-send-reminders error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
