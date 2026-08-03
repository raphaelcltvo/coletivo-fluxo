// Dispara o e-mail de alerta/lembrete real quando uma notificação é criada.
// Não é chamada pelo app — é chamada pelo Database Webhook do Supabase
// configurado para disparar em todo INSERT na tabela `notifications`
// (Database → Webhooks no dashboard; ver checklist no DEPLOY.md).
import { createClient } from "npm:@supabase/supabase-js@2";

function escapeHtml(s: string) {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return s.replace(/[&<>"']/g, (c) => map[c]);
}

Deno.serve(async (req) => {
  try {
    // Segredo compartilhado configurado no header do Database Webhook, pra
    // garantir que só o próprio Supabase consegue chamar esta função.
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (expectedSecret && req.headers.get("x-webhook-secret") !== expectedSecret) {
      return new Response("unauthorized", { status: 401 });
    }

    const payload = await req.json();
    const record = payload?.record;
    if (!record?.member_id || !record?.message) {
      return new Response("ignored", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const fromAddress = Deno.env.get("ALERT_FROM_EMAIL") || "alertas@agenciacoletivo.com";

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("email, name")
      .eq("id", record.member_id)
      .single();
    if (!profile?.email) return new Response("no recipient", { status: 200 });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Coletivo · Fluxo <${fromAddress}>`,
        to: [profile.email],
        subject: "Coletivo · Fluxo — novo alerta",
        html: `<p>Olá${profile.name ? ", " + escapeHtml(profile.name) : ""}.</p><p>${escapeHtml(record.message)}</p>`,
      }),
    });

    if (!res.ok) {
      console.error("Resend error", await res.text());
      return new Response("resend error", { status: 502 });
    }

    return new Response("sent", { status: 200 });
  } catch (e) {
    console.error(e);
    return new Response(String(e), { status: 500 });
  }
});
