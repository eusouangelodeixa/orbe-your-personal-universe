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
    const { subjectId, filePath } = await req.json();
    if (!subjectId || !filePath) {
      return new Response(JSON.stringify({ error: "Missing subjectId or filePath" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Download file from storage
    const { data: fileData, error: downloadErr } = await supabase.storage
      .from("ementas")
      .download(filePath);

    if (downloadErr || !fileData) {
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let extractedText = "";
    const fileName = filePath.split("/").pop()?.toLowerCase() || "";

    if (fileName.endsWith(".txt") || fileName.endsWith(".md") || fileName.endsWith(".csv")) {
      extractedText = await fileData.text();
    } else if (fileName.endsWith(".pdf")) {
      // Use Lovable AI to extract text from PDF via description
      const apiKey = Deno.env.get("LOVABLE_API_KEY");
      if (!apiKey) {
        // Fallback: convert PDF bytes to rough text extraction
        const arrayBuffer = await fileData.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const textDecoder = new TextDecoder("utf-8", { fatal: false });
        const rawText = textDecoder.decode(bytes);
        
        // Extract readable strings from PDF binary
        const strings: string[] = [];
        let current = "";
        for (const char of rawText) {
          const code = char.charCodeAt(0);
          if (code >= 32 && code < 127) {
            current += char;
          } else {
            if (current.length > 3) strings.push(current);
            current = "";
          }
        }
        if (current.length > 3) strings.push(current);
        
        // Filter out PDF syntax
        extractedText = strings
          .filter(s => !s.startsWith("/") && !s.startsWith("<<") && !s.includes("obj") && !s.includes("stream") && s.length > 5)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        // Use AI to clean up extracted text if available
        if (apiKey && extractedText.length > 50) {
          try {
            const aiResp = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "google/gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content: "Você recebe texto bruto extraído de um PDF. Limpe e organize o texto, removendo lixo e mantendo apenas o conteúdo legível da ementa/programa da disciplina. Responda APENAS com o texto limpo, sem explicações.",
                  },
                  { role: "user", content: extractedText.slice(0, 30000) },
                ],
                max_tokens: 8000,
              }),
            });
            if (aiResp.ok) {
              const aiData = await aiResp.json();
              const cleaned = aiData.choices?.[0]?.message?.content;
              if (cleaned && cleaned.length > 20) {
                extractedText = cleaned;
              }
            }
          } catch {}
        }
      }
    } else {
      // Try text extraction for other formats
      try {
        extractedText = await fileData.text();
      } catch {
        extractedText = `[Arquivo: ${fileName}] - Formato não suportado para extração automática de texto.`;
      }
    }

    // Limit and save
    const finalText = extractedText.slice(0, 50000);

    const { error: updateErr } = await supabase
      .from("subjects")
      .update({ ementa_text: finalText })
      .eq("id", subjectId);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Failed to update subject" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, textLength: finalText.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
