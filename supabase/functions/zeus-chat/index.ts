// Zeus — agente de dados embutido no Fluxo. Chat com tool-use (Anthropic
// Messages API) rodando 100% no servidor (a chave da Anthropic nunca vai pro
// navegador). Admin-only. Ver o plano em C:\Users\usuário\.claude\plans\jazzy-snacking-manatee.md
// pra contexto completo da arquitetura.
// IMPORTANTE: este projeto Supabase é compartilhado com outro app (Forneria
// Original). Por isso todas as tabelas do Fluxo usam o prefixo `fluxo_` —
// nunca remova esse prefixo.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildSystemPrompt } from "./systemPrompt.ts";
import { generalToolDefs, handleGeneralTool, type ToolCtx } from "./tools/general.ts";
import { dashboardFtwToolDefs, handleDashboardFtwTool } from "./tools/dashboard-ftw.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const uid = () => Math.random().toString(36).slice(2, 10);
const MAX_TOOL_ITERATIONS = 12;
const MODEL = Deno.env.get("ZEUS_MODEL") || "claude-sonnet-4-5-20250929";

type StoredContent = { blocks: any[]; ui?: Record<string, unknown> };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) return json({ error: "Zeus ainda não está ativado — falta configurar a ANTHROPIC_API_KEY." }, 503);

    const callerClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await admin.from("fluxo_profiles").select("role, status").eq("id", user.id).single();
    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "ativo") {
      return json({ error: "Zeus é só pra administradores por enquanto." }, 403);
    }

    const body = await req.json();
    const { message, clientId, image } = body as { message: string; clientId?: string; image?: { mediaType: string; data: string } };
    let conversationId = body.conversationId as string | undefined;
    if (!message?.trim()) return json({ error: "Mensagem vazia." }, 400);

    if (!conversationId) {
      conversationId = uid();
      const { error } = await admin.from("fluxo_zeus_conversations").insert({
        id: conversationId,
        title: message.trim().slice(0, 60),
        client_id: clientId || null,
        created_by: user.id,
      });
      if (error) return json({ error: error.message }, 500);
    } else if (clientId) {
      await admin.from("fluxo_zeus_conversations").update({ client_id: clientId, updated_at: new Date().toISOString() }).eq("id", conversationId);
    } else {
      await admin.from("fluxo_zeus_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
    }

    const { data: history } = await admin
      .from("fluxo_zeus_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at");

    const messages: { role: string; content: any[] }[] = (history || []).map((m) => ({
      role: m.role,
      content: (m.content as StoredContent).blocks,
    }));

    const userBlocks: any[] = [{ type: "text", text: message.trim() }];
    if (image?.data) {
      userBlocks.unshift({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data } });
    }
    messages.push({ role: "user", content: userBlocks });
    await admin.from("fluxo_zeus_messages").insert({
      id: uid(),
      conversation_id: conversationId,
      role: "user",
      content: { blocks: userBlocks } as StoredContent,
    });

    let activeClient: { name: string; hasKnowledge: boolean } | null = null;
    if (clientId) {
      const [{ data: client }, { data: knowledge }] = await Promise.all([
        admin.from("fluxo_clients").select("name").eq("id", clientId).single(),
        admin.from("fluxo_zeus_client_knowledge").select("client_id").eq("client_id", clientId).maybeSingle(),
      ]);
      if (client) activeClient = { name: client.name, hasKnowledge: !!knowledge };
    }
    const system = await buildSystemPrompt(activeClient);
    const tools = [...generalToolDefs, ...dashboardFtwToolDefs];
    const ctx: ToolCtx = { admin, callerId: user.id, uiBlocks: {} };

    let finalText = "";
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, max_tokens: 8192, system, tools, messages }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return json({ error: `Erro da Anthropic: ${errText}` }, 502);
      }
      const data = await res.json();
      const content = data.content as any[];

      messages.push({ role: "assistant", content });
      await admin.from("fluxo_zeus_messages").insert({
        id: uid(),
        conversation_id: conversationId,
        role: "assistant",
        content: { blocks: content } as StoredContent,
      });

      finalText = content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();

      if (data.stop_reason !== "tool_use") break;

      const toolResults: any[] = [];
      for (const block of content) {
        if (block.type !== "tool_use") continue;
        let result: string;
        try {
          if ((generalToolDefs as any[]).some((t) => t.name === block.name)) {
            result = await handleGeneralTool(block.name, block.input, ctx);
          } else {
            result = await handleDashboardFtwTool(block.name, block.input, ctx);
          }
        } catch (e) {
          result = `Erro ao executar a tool: ${String((e as Error).message || e)}`;
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: result });
      }
      messages.push({ role: "user", content: toolResults });
      await admin.from("fluxo_zeus_messages").insert({
        id: uid(),
        conversation_id: conversationId,
        role: "user",
        content: { blocks: toolResults } as StoredContent,
      });
    }

    // Persiste os blocos de UI (chips/cards/link do dashboard) junto da última mensagem do assistente.
    const { data: lastAssistant } = await admin
      .from("fluxo_zeus_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (lastAssistant && Object.keys(ctx.uiBlocks).length) {
      const { data: row } = await admin.from("fluxo_zeus_messages").select("content").eq("id", lastAssistant.id).single();
      const content = row?.content as StoredContent;
      await admin.from("fluxo_zeus_messages").update({ content: { ...content, ui: ctx.uiBlocks } }).eq("id", lastAssistant.id);
    }

    return json({ conversationId, reply: finalText, ui: ctx.uiBlocks });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
