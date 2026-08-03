// Convida um novo membro do time (admin-only).
// Chamada pelo AccessForm (aba Equipe) com o access token do admin logado.
// Usa a service role key (secret só do servidor) para:
//   1. criar o usuário no Supabase Auth e disparar o e-mail de convite
//      (supabase.auth.admin.inviteUserByEmail — e-mail automático do Supabase)
//   2. criar a linha correspondente em `fluxo_profiles`
// IMPORTANTE: este projeto Supabase é compartilhado com outro app (Forneria
// Original), que também tem sua própria tabela `profiles`. Por isso todas as
// tabelas do Fluxo usam o prefixo `fluxo_` — nunca remova esse prefixo.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Client "como quem chamou", só pra descobrir quem é o usuário do token.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return json({ error: "Não autenticado." }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: callerProfile } = await admin
      .from("fluxo_profiles")
      .select("role, status")
      .eq("id", user.id)
      .single();
    if (!callerProfile || callerProfile.role !== "admin" || callerProfile.status !== "ativo") {
      return json({ error: "Só administradores podem convidar novos membros." }, 403);
    }

    const { name, email, role } = await req.json();
    if (!name?.trim() || !email?.trim()) {
      return json({ error: "Nome e e-mail são obrigatórios." }, 400);
    }
    if (!["admin", "atendimento"].includes(role)) {
      return json({ error: "Papel inválido." }, 400);
    }

    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email.trim(), {
      data: { name: name.trim() },
    });
    if (inviteErr) return json({ error: inviteErr.message }, 400);

    const { error: profileErr } = await admin.from("fluxo_profiles").insert({
      id: invited.user.id,
      name: name.trim(),
      email: email.trim(),
      role,
      status: "convite pendente",
    });
    if (profileErr) return json({ error: profileErr.message }, 400);

    return json({ ok: true, id: invited.user.id });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
