// Tools da atividade "Dashboard FTW" — gera um dashboard HTML único, ao vivo,
// a partir de uma planilha pública do Google Sheets, seguindo a skill em
// ../activities/dashboard-ftw/ (SKILL.md é a fonte de verdade das regras).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";
import type { ToolCtx } from "./general.ts";

const skillDir = new URL("../activities/dashboard-ftw/", import.meta.url);

export async function readSkillFile(name: string): Promise<string> {
  return await Deno.readTextFile(new URL(name, skillDir));
}

export const dashboardFtwToolDefs = [
  {
    name: "request_sheet_link",
    description:
      "Mostra um campo pro usuário colar o link da planilha do Google Sheets, quando a atividade Dashboard FTW precisa de uma planilha e ainda não há nenhuma salva pra esse cliente (confira antes com get_client_knowledge).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fetch_google_sheet",
    description:
      "Baixa e mapeia a estrutura real de uma planilha pública do Google Sheets (abas, linhas de exemplo de cada uma). Use SEMPRE antes de gerar qualquer dashboard, mesmo se o link já era conhecido — nunca presuma a estrutura.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "Link da planilha do Google Sheets (precisa estar com permissão 'qualquer pessoa com o link pode ver')." } },
      required: ["url"],
    },
  },
  {
    name: "get_reference_template",
    description:
      "Devolve o HTML completo do molde de referência (tapi-template.html) pra usar como base de código/estrutura do dashboard — NUNCA como fonte de dado, só de layout/engine.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "run_boot_test",
    description:
      "Roda o teste de boot obrigatório (harness headless) contra o HTML gerado, antes de publicar. Devolve OK + os insights capturados, ou o erro exato com a linha, pra corrigir antes de tentar de novo.",
    input_schema: {
      type: "object",
      properties: { html: { type: "string", description: "HTML completo do dashboard gerado, incluindo a tag <script>." } },
      required: ["html"],
    },
  },
  {
    name: "publish_dashboard",
    description:
      "Publica o HTML final do dashboard no site (GitHub Pages), depois que o boot test passou. Devolve a URL pública. SÓ chame depois que run_boot_test confirmou OK.",
    input_schema: {
      type: "object",
      properties: {
        html: { type: "string" },
        clientId: { type: "string" },
        clientSlug: { type: "string", description: "Slug do cliente pro nome do arquivo, ex: 'cumbuca'." },
      },
      required: ["html", "clientSlug"],
    },
  },
];

function extractSpreadsheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/) || url.match(/^([a-zA-Z0-9_-]{20,})$/);
  return m ? m[1] : null;
}

async function fetchGoogleSheet(url: string) {
  const id = extractSpreadsheetId(url.trim());
  if (!id) return { error: "Não consegui identificar o ID da planilha nesse link." };

  const exportUrl = `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx`;
  const res = await fetch(exportUrl);
  if (!res.ok) {
    return {
      error: `Não consegui baixar a planilha (status ${res.status}). Confirme que a permissão está como "qualquer pessoa com o link pode ver".`,
    };
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  const wb = XLSX.read(buf, { type: "array" });

  const sheets = wb.SheetNames.map((sheetName) => {
    const ws = wb.Sheets[sheetName];
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    const preview = rows.slice(0, 15).map((r) => r.slice(0, 12).map((c) => String(c).slice(0, 60)));
    return { name: sheetName, totalRows: rows.length, preview };
  });

  return { spreadsheetId: id, exportUrl, sheets };
}

function runBootTest(html: string) {
  const match = html.match(/<script>([\s\S]*)<\/script>/);
  if (!match) return { ok: false, error: "Não achei uma tag <script> no HTML." };
  const src = match[1];

  try {
    new Function(src.replace(/\bimport\s/g, "// import "));
  } catch (e) {
    return { ok: false, error: `Erro de sintaxe: ${String((e as Error).message)}` };
  }

  const g = globalThis as any;
  const els: Record<string, any> = {};
  function mkSel() {
    return {
      options: [] as any[],
      add(x: any) {
        this.options.push(x);
        if (this._v === undefined) this._v = x.value;
      },
      get value() { return this._v; },
      set value(x) { this._v = x; },
      set innerHTML(x) { this.options = []; this._v = undefined; this._h = x; },
      get innerHTML() { return this._h || ""; },
      set textContent(x) { this._t = x; },
      get textContent() { return this._t || ""; },
      onchange: null, onclick: null,
      appendChild() {}, insertAdjacentHTML() {},
      children: { length: 1 }, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    };
  }
  g.document = {
    querySelectorAll: () => [],
    getElementById: (id: string) => els[id] || (els[id] = mkSel()),
    createElement: () => ({ classList: { add() {} }, appendChild() {}, style: {}, onclick: null }),
    querySelector: () => null,
    addEventListener: () => {},
  };
  g.window = { innerWidth: 1200, addEventListener: () => {}, scrollY: 0 };
  g.Chart = function (this: any) { this.destroy = () => {}; };
  g.Chart.defaults = { font: {}, elements: { line: {} }, plugins: { legend: {} } };
  g.Chart.getChart = () => null;
  g.XLSX = {};
  g.fetch = async () => { throw new Error("offline"); };

  try {
    // deno-lint-ignore no-explicit-any
    const fn = new Function(src.replace(/\bimport\s/g, "// import "));
    fn();
  } catch (e) {
    return { ok: false, error: `Erro na execução: ${String((e as Error).stack || (e as Error).message).split("\n").slice(0, 6).join(" | ")}` };
  }

  const strip = (s: string) => String(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const captured: Record<string, string> = {};
  for (const key of Object.keys(els)) {
    if (els[key]?.innerHTML) captured[key] = strip(els[key].innerHTML).slice(0, 200);
  }
  return { ok: true, captured };
}

async function publishDashboard(admin: SupabaseClient, callerId: string, html: string, clientId: string | undefined, clientSlug: string) {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) return { error: "GITHUB_TOKEN não configurado ainda — peça pro admin configurar esse secret antes de publicar." };

  const repo = Deno.env.get("GITHUB_REPO") || "raphaelcltvo/coletivo-fluxo";
  const branch = Deno.env.get("GITHUB_BRANCH") || "main";
  const slug = clientSlug.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const path = `public/dashboards/${slug}.html`;
  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;

  let sha: string | undefined;
  const existing = await fetch(`${apiUrl}?ref=${branch}`, { headers: { Authorization: `Bearer ${token}`, "User-Agent": "zeus-chat" } });
  if (existing.ok) sha = (await existing.json()).sha;

  const content = btoa(unescape(encodeURIComponent(html)));
  const put = await fetch(apiUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "zeus-chat", "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Zeus: publica dashboard ${slug}`,
      content,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) return { error: `Erro ao publicar no GitHub: ${await put.text()}` };

  const siteBase = Deno.env.get("SITE_BASE_URL") || "https://raphaelcltvo.github.io/coletivo-fluxo";
  const url = `${siteBase}/dashboards/${slug}.html`;

  await admin.from("fluxo_zeus_dashboards").insert({
    id: Math.random().toString(36).slice(2, 10),
    client_id: clientId || null,
    file_path: path,
    url,
    created_by: callerId,
  });

  return { url, note: "O deploy do GitHub Pages leva 1-2 minutos pra ficar no ar depois desse commit." };
}

export async function handleDashboardFtwTool(name: string, input: any, ctx: ToolCtx): Promise<string> {
  const { admin, callerId, uiBlocks } = ctx;

  if (name === "request_sheet_link") {
    uiBlocks.sheetLinkRequest = true;
    return "Campo de link da planilha mostrado ao usuário.";
  }

  if (name === "fetch_google_sheet") {
    const result = await fetchGoogleSheet(input.url);
    return JSON.stringify(result);
  }

  if (name === "get_reference_template") {
    return await readSkillFile("tapi-template.html");
  }

  if (name === "run_boot_test") {
    return JSON.stringify(runBootTest(input.html));
  }

  if (name === "publish_dashboard") {
    const result = await publishDashboard(admin, callerId, input.html, input.clientId, input.clientSlug);
    if ((result as any).url) uiBlocks.dashboardUrl = (result as any).url;
    return JSON.stringify(result);
  }

  return `Tool desconhecida: ${name}`;
}
