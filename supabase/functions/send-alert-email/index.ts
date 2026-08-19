// Dispara o e-mail de notificação quando uma linha é criada em
// `fluxo_notifications`. Não é chamada pelo app — é chamada pelo Database
// Webhook do Supabase configurado para disparar em todo INSERT nessa tabela
// (Database → Webhooks no dashboard; ver checklist no DEPLOY.md).
// IMPORTANTE: este projeto Supabase é compartilhado com outro app (Forneria
// Original), que também tem sua própria tabela `notifications`-like. Por isso
// todas as tabelas do Fluxo usam o prefixo `fluxo_` — nunca remova esse prefixo.
import { createClient } from "npm:@supabase/supabase-js@2";

function esc(s: unknown): string {
  const str = s === null || s === undefined ? "" : String(s);
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return str.replace(/[&<>"']/g, (c) => map[c]);
}

const APP_URL = "https://fluxoapp.online/";

// ---------------------------------------------------------------------
// Layout comum a todo e-mail: wordmark, cartão branco, rodapé de confiança.
// ---------------------------------------------------------------------
function shell(bodyHtml: string, footerNote: string, unsubscribeLabel = "Gerenciar notificações") {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F1;font-family:Arial,Helvetica,sans-serif;">
<tr><td style="padding:22px 20px 14px;">
  <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:15px;letter-spacing:.5px;text-transform:uppercase;color:#0A57F5;">COLETIVO · FLUXO</div>
</td></tr>
<tr><td style="padding:0 20px 22px;">
${bodyHtml}
</td></tr>
<tr><td style="padding:4px 24px 28px;font-size:11.5px;color:#9C9FA4;line-height:1.7;">
  ${footerNote}<br>
  <a href="${APP_URL}" style="color:#666A70;">${esc(unsubscribeLabel)}</a> · Agência Coletivo
</td></tr>
</table>`;
}

function button(label: string, href: string, color = "#0A57F5") {
  return `<a href="${href}" style="display:inline-block;background:${color};color:#ffffff;font-size:13.5px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:8px;">${esc(label)}</a>`;
}

function pill(label: string, bg: string, fg: string) {
  return `<span style="display:inline-block;background:${bg};color:${fg};font-size:11px;font-weight:700;letter-spacing:.3px;padding:3px 10px;border-radius:999px;">${esc(label)}</span>`;
}

// ---------------------------------------------------------------------
// 1 · Etapa mudou — só disparado quando o novo status exige ação de quem
// recebe (ver regra no App.jsx). Inclui o texto do card pra não precisar
// abrir o app pra saber o que fazer.
// ---------------------------------------------------------------------
function etapaHtml(d: Record<string, unknown>) {
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;">
<tr><td style="padding:22px 24px 6px;">${d.cliente ? pill(String(d.cliente), "#E7EEFF", "#0A57F5") : ""}</td></tr>
<tr><td style="padding:10px 24px 0;">
  <div style="font-family:Arial,Helvetica,sans-serif;font-weight:800;font-size:19px;text-transform:uppercase;color:#1B1D22;line-height:1.25;">${esc(d.titulo)}</div>
</td></tr>
<tr><td style="padding:14px 24px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="background:#F1F1ED;color:#666A70;font-size:12px;font-weight:600;padding:5px 12px;border-radius:999px;">${esc(d.status_de)}</td>
    <td style="padding:0 8px;color:#9C9FA4;">→</td>
    <td style="background:#DEF5E9;color:#12875A;font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${esc(d.status_para)}</td>
  </tr></table>
</td></tr>
${d.texto ? `<tr><td style="padding:16px 24px 0;font-size:13.5px;color:#1B1D22;line-height:1.6;background:#F8F8F6;border-radius:8px;">${esc(d.texto)}</td></tr>` : ""}
<tr><td style="padding:16px 24px 0;font-size:13.5px;color:#666A70;line-height:1.6;">
  ${esc(d.quem_moveu)} moveu esse card.${d.prazo ? ` Prazo: <b style="color:#1B1D22;">${esc(d.prazo)}</b>.` : ""}
</td></tr>
<tr><td style="padding:22px 24px 24px;">${button("Ver card", APP_URL)}</td></tr>
</table>`;
  return shell(card, "Você recebeu isso porque é responsável por este card no Coletivo · Fluxo.");
}
function etapaText(d: Record<string, unknown>) {
  return `${d.titulo}\n${d.cliente ? d.cliente + " · " : ""}${d.status_de} → ${d.status_para}\n\n${d.texto ? d.texto + "\n\n" : ""}${d.quem_moveu} moveu esse card.${d.prazo ? " Prazo: " + d.prazo + "." : ""}\n\nVer no Fluxo: ${APP_URL}`;
}
function etapaSubject(d: Record<string, unknown>) {
  return `${d.cliente ? d.cliente + " · " : ""}"${d.titulo}" → ${d.status_para}`;
}

// ---------------------------------------------------------------------
// 2 · Resposta em thread
// ---------------------------------------------------------------------
function threadHtml(d: Record<string, unknown>) {
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;">
<tr><td style="padding:22px 24px 4px;font-size:13.5px;color:#1B1D22;"><b>${esc(d.autor)}</b> <span style="color:#9C9FA4;">respondeu sua thread</span></td></tr>
${d.post_original ? `<tr><td style="padding:12px 24px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F1ED;border-radius:8px;">
    <tr><td style="padding:10px 14px;font-size:12.5px;color:#666A70;border-left:3px solid #DDDEDA;">${esc(d.post_original)}</td></tr>
  </table>
</td></tr>` : ""}
<tr><td style="padding:12px 24px 0;font-size:14px;color:#1B1D22;line-height:1.6;">"${esc(d.resposta)}"</td></tr>
<tr><td style="padding:20px 24px 24px;">${button("Ver conversa", APP_URL)}</td></tr>
</table>`;
  return shell(card, "Você recebeu isso porque participa dessa thread no Coletivo · Fluxo.");
}
function threadText(d: Record<string, unknown>) {
  return `${d.autor} respondeu sua thread${d.post_original ? "\n\nVocê: " + d.post_original : ""}\n\n"${d.resposta}"\n\nVer no Fluxo: ${APP_URL}`;
}
function threadSubject(d: Record<string, unknown>) {
  return `${d.autor} respondeu "${d.titulo_curto}"`;
}

// ---------------------------------------------------------------------
// 3 · Alerta disparado
// ---------------------------------------------------------------------
function alertaHtml(d: Record<string, unknown>) {
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;">
<tr><td style="padding:22px 24px 6px;">${pill(`ALERTA${d.cliente ? " · " + d.cliente : ""}`, "#E7EEFF", "#0A57F5")}</td></tr>
<tr><td style="padding:10px 24px 0;">
  <div style="font-weight:800;font-size:19px;text-transform:uppercase;color:#1B1D22;line-height:1.25;">${esc(d.titulo)}</div>
</td></tr>
${d.descricao ? `<tr><td style="padding:10px 24px 0;font-size:13.5px;color:#666A70;line-height:1.6;">${esc(d.descricao)}</td></tr>` : ""}
${d.vira_card ? `<tr><td style="padding:16px 24px 0;">${pill("Vira card em Demandas", "#FBEBD6", "#B4700F")}</td></tr>` : ""}
<tr><td style="padding:22px 24px 24px;">${button("Ver no Fluxo", APP_URL)}</td></tr>
</table>`;
  return shell(card, "Você recebeu isso porque é destinatário deste alerta no Coletivo · Fluxo.");
}
function alertaText(d: Record<string, unknown>) {
  return `${d.titulo}\n${d.descricao || ""}\n\nVer no Fluxo: ${APP_URL}`;
}
function alertaSubject(d: Record<string, unknown>) {
  return `Lembrete: ${d.titulo}${d.cliente ? " — " + d.cliente : ""}`;
}

// ---------------------------------------------------------------------
// 4 · Prazo estourado
// ---------------------------------------------------------------------
function atrasadoHtml(d: Record<string, unknown>) {
  const dias = Number(d.dias) || 0;
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;border-top:3px solid #D03F39;">
<tr><td style="padding:20px 24px 6px;">${pill(`ATRASADO HÁ ${dias} DIA${dias === 1 ? "" : "S"}`, "#FBE1DE", "#D03F39")}</td></tr>
<tr><td style="padding:10px 24px 0;">
  <div style="font-weight:800;font-size:19px;text-transform:uppercase;color:#1B1D22;line-height:1.25;">${esc(d.titulo)}</div>
</td></tr>
<tr><td style="padding:10px 24px 0;font-size:13.5px;color:#666A70;">${d.cliente ? esc(d.cliente) + " · " : ""}prazo era <b style="color:#1B1D22;">${esc(d.prazo)}</b></td></tr>
<tr><td style="padding:18px 24px 0;font-size:13.5px;color:#666A70;line-height:1.6;">Se já resolveu, é só mover pra Concluída.</td></tr>
<tr><td style="padding:20px 24px 22px;">${button("Abrir card", APP_URL, "#D03F39")}</td></tr>
</table>`;
  return shell(card, "Você recebeu isso porque é responsável por este card no Coletivo · Fluxo.");
}
function atrasadoText(d: Record<string, unknown>) {
  return `${d.titulo}\n${d.cliente ? d.cliente + " · " : ""}prazo era ${d.prazo}\n\nAtrasado há ${d.dias} dia(s). Se já resolveu, mova pra Concluída.\n\nVer no Fluxo: ${APP_URL}`;
}
function atrasadoSubject(d: Record<string, unknown>) {
  const dias = Number(d.dias) || 0;
  return `Atrasado: "${d.titulo}" venceu há ${dias} dia${dias === 1 ? "" : "s"}`;
}

// ---------------------------------------------------------------------
// 5 · Resumo de pendências
// ---------------------------------------------------------------------
function digestSection(title: string, color: string, items: Array<Record<string, unknown>>, withDays: boolean) {
  if (!items.length) return "";
  const rows = items.map((it) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #EFEFEC;"><tr>
    <td style="padding:9px 0;font-size:13px;color:#1B1D22;">${esc(it.titulo)}${it.cliente ? ` <span style="color:#9C9FA4;">· ${esc(it.cliente)}</span>` : ""}</td>
    ${withDays ? `<td style="padding:9px 0;font-size:12px;color:${color};text-align:right;white-space:nowrap;">${esc(it.dias)}d</td>` : ""}
  </tr></table>`).join("");
  return `<tr><td style="padding:18px 24px 6px;"><div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${color};">${esc(title)} · ${items.length}</div></td></tr>
<tr><td style="padding:0 24px;">${rows}</td></tr>`;
}
function resumoHtml(d: Record<string, unknown>) {
  const atrasados = (d.atrasados as Array<Record<string, unknown>>) || [];
  const aguardando = (d.aguardando as Array<Record<string, unknown>>) || [];
  const alertas = (d.alertas as Array<Record<string, unknown>>) || [];
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;">
<tr><td style="padding:22px 24px 4px;">
  <div style="font-weight:800;font-size:19px;text-transform:uppercase;color:#1B1D22;">Seu resumo de ${esc(d.dia)}</div>
  <div style="font-size:13px;color:#666A70;margin-top:3px;">${esc(d.total)} ${Number(d.total) === 1 ? "item pedindo" : "itens pedindo"} atenção</div>
</td></tr>
${digestSection("Atrasados", "#D03F39", atrasados, true)}
${digestSection("Aguardando resposta", "#B4700F", aguardando, false)}
${digestSection("Alertas de hoje", "#0A57F5", alertas, false)}
<tr><td style="padding:22px 24px 24px;">${button("Abrir Demandas", APP_URL)}</td></tr>
</table>`;
  return shell(card, "Resumo diário — só chega se você tiver pelo menos 1 pendência.", "Desativar resumo diário");
}
function resumoText(d: Record<string, unknown>) {
  const list = (items: Array<Record<string, unknown>>, label: string) =>
    items.length ? `\n${label} (${items.length}):\n` + items.map((it) => `- ${it.titulo}${it.cliente ? " · " + it.cliente : ""}`).join("\n") + "\n" : "";
  return `Seu resumo de ${d.dia}: ${d.total} pendências\n${list((d.atrasados as any[]) || [], "Atrasados")}${list((d.aguardando as any[]) || [], "Aguardando resposta")}${list((d.alertas as any[]) || [], "Alertas de hoje")}\nVer no Fluxo: ${APP_URL}`;
}
function resumoSubject(d: Record<string, unknown>) {
  return `Seu resumo de ${d.dia}: ${d.total} pendências`;
}

// ---------------------------------------------------------------------
// Fallback — notificações sem kind reconhecido (ex: réguas de comunicação).
// ---------------------------------------------------------------------
function genericoHtml(message: string, name: string) {
  const card = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E3E4DF;border-radius:12px;">
<tr><td style="padding:22px 24px 4px;font-size:14px;color:#1B1D22;">Olá${name ? ", " + esc(name) : ""}.</td></tr>
<tr><td style="padding:8px 24px 0;font-size:14px;color:#1B1D22;line-height:1.6;">${esc(message)}</td></tr>
<tr><td style="padding:20px 24px 24px;">${button("Ver no Fluxo", APP_URL)}</td></tr>
</table>`;
  return shell(card, "Você recebeu isso pelo Coletivo · Fluxo.");
}

function render(kind: string, data: Record<string, unknown>, message: string, name: string) {
  switch (kind) {
    case "etapa":
      return { subject: etapaSubject(data), html: etapaHtml(data), text: etapaText(data) };
    case "thread":
      return { subject: threadSubject(data), html: threadHtml(data), text: threadText(data) };
    case "alerta":
      return { subject: alertaSubject(data), html: alertaHtml(data), text: alertaText(data) };
    case "atrasado":
      return { subject: atrasadoSubject(data), html: atrasadoHtml(data), text: atrasadoText(data) };
    case "resumo":
      return { subject: resumoSubject(data), html: resumoHtml(data), text: resumoText(data) };
    default:
      return {
        subject: message.length <= 78 ? message : message.slice(0, 75) + "...",
        html: genericoHtml(message, name),
        text: `${message}\n\nVer no Fluxo: ${APP_URL}`,
      };
  }
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
    const fromAddress = Deno.env.get("ALERT_FROM_EMAIL") || "alertas@fluxoapp.online";

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("fluxo_profiles")
      .select("email, name")
      .eq("id", record.member_id)
      .single();
    if (!profile?.email) return new Response("no recipient", { status: 200 });

    const { subject, html, text } = render(record.kind || "generico", record.data || {}, record.message, profile.name || "");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Coletivo · Fluxo <${fromAddress}>`,
        to: [profile.email],
        subject,
        html,
        text,
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
