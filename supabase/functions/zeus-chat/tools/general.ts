// Tools gerais do Zeus — disponíveis em qualquer conversa, independente da
// atividade em andamento. Leitura de contexto (cliente/demandas/métricas) e
// as ações que podem gravar algo real no sistema (alerta/demanda), sempre em
// duas etapas: propose_* só mostra um resumo pro usuário confirmar; create_*
// só deve ser chamado pelo modelo depois que o usuário confirmar no chat.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type ToolCtx = {
  admin: SupabaseClient;
  callerId: string;
  uiBlocks: Record<string, unknown>;
};

export const generalToolDefs = [
  {
    name: "suggest_activities",
    description:
      "Mostra pro usuário uma lista de atividades sugeridas como botões clicáveis no chat. Use quando a pessoa não souber o que quer, ou quando fizer sentido oferecer opções (ex: início de conversa, ou depois de terminar algo).",
    input_schema: {
      type: "object",
      properties: {
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              description: { type: "string" },
            },
            required: ["id", "label"],
          },
        },
      },
      required: ["options"],
    },
  },
  {
    name: "get_client_knowledge",
    description:
      "Busca o cadastro do cliente (nome, unidades, indicadores prioritários, diagnóstico) e o que o Zeus já aprendeu sobre ele em conversas anteriores (planilha salva, indicadores-chave, notas). Chame isso sempre que uma conversa focar em um cliente específico, antes de mais nada.",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string" } },
      required: ["clientId"],
    },
  },
  {
    name: "save_client_knowledge",
    description:
      "Salva/atualiza o que o Zeus aprendeu sobre um cliente, pra não perguntar de novo nas próximas conversas. Chame depois de entender os indicadores-chave e o contexto de negócio de um cliente novo, ou sempre que aprender algo novo relevante.",
    input_schema: {
      type: "object",
      properties: {
        clientId: { type: "string" },
        sheetUrl: { type: "string", description: "Link da planilha do Drive desse cliente, se houver." },
        keyIndicators: {
          type: "array",
          items: {
            type: "object",
            properties: { nome: { type: "string" }, por_que: { type: "string" } },
            required: ["nome"],
          },
        },
        notes: { type: "string", description: "Resumo livre do que se entende do negócio desse cliente." },
      },
      required: ["clientId"],
    },
  },
  {
    name: "get_client_demands",
    description: "Lê as demandas mais recentes de um cliente (título, status, prazo, tipo) pra responder como consultor.",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string" } },
      required: ["clientId"],
    },
  },
  {
    name: "get_client_metrics",
    description: "Lê os lançamentos manuais de métricas mais recentes de um cliente (quando existirem).",
    input_schema: {
      type: "object",
      properties: { clientId: { type: "string" } },
      required: ["clientId"],
    },
  },
  {
    name: "propose_alert",
    description:
      "Mostra um resumo de um alerta que o Zeus quer criar, pro usuário confirmar antes de gravar de verdade. NUNCA grave um alerta sem antes mostrar essa proposta e esperar confirmação explícita na próxima mensagem do usuário.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        alertType: { type: "string", enum: ["relatorio", "comunicacao"] },
        destinoSummary: { type: "string", description: "Descrição em texto de quem vai receber (ex: 'todo atendimento', 'Maria Eduarda')." },
        clientName: { type: "string" },
      },
      required: ["title", "alertType", "destinoSummary"],
    },
  },
  {
    name: "propose_demand",
    description:
      "Mostra um resumo de uma demanda que o Zeus quer criar, pro usuário confirmar antes de gravar de verdade. NUNCA grave uma demanda sem antes mostrar essa proposta e esperar confirmação explícita na próxima mensagem do usuário.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        clientName: { type: "string" },
        assigneeName: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["normal", "urgente"] },
        dueDate: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "create_alert",
    description:
      "Grava de verdade um alerta em fluxo_alerts, disparando pra equipe. SÓ chame depois que o usuário confirmou explicitamente uma proposta feita com propose_alert.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        alertType: { type: "string", enum: ["relatorio", "comunicacao"] },
        everyone: { type: "boolean" },
        roles: { type: "array", items: { type: "string", enum: ["admin", "atendimento"] } },
        memberNames: { type: "array", items: { type: "string" } },
        clientId: { type: "string" },
      },
      required: ["title", "alertType"],
    },
  },
  {
    name: "create_demand",
    description:
      "Grava de verdade uma demanda em fluxo_demands. SÓ chame depois que o usuário confirmou explicitamente uma proposta feita com propose_demand.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        clientId: { type: "string" },
        assigneeName: { type: "string" },
        description: { type: "string" },
        priority: { type: "string", enum: ["normal", "urgente"] },
        dueDate: { type: "string" },
      },
      required: ["title"],
    },
  },
];

const uid = () => Math.random().toString(36).slice(2, 10);

async function resolveMemberIdByName(admin: SupabaseClient, name: string): Promise<string | null> {
  if (!name) return null;
  const { data } = await admin.from("fluxo_profiles").select("id, name").ilike("name", `%${name}%`).limit(1);
  return data?.[0]?.id || null;
}

export async function handleGeneralTool(name: string, input: any, ctx: ToolCtx): Promise<string> {
  const { admin, callerId, uiBlocks } = ctx;

  if (name === "suggest_activities") {
    uiBlocks.suggestedActivities = input.options || [];
    return "Sugestões mostradas ao usuário como botões.";
  }

  if (name === "get_client_knowledge") {
    const [{ data: client }, { data: knowledge }] = await Promise.all([
      admin.from("fluxo_clients").select("*").eq("id", input.clientId).single(),
      admin.from("fluxo_zeus_client_knowledge").select("*").eq("client_id", input.clientId).maybeSingle(),
    ]);
    return JSON.stringify({
      client: client
        ? { name: client.name, units: client.units, priorityMetrics: client.priority_metrics, diagnosis: client.diagnosis }
        : null,
      knowledge: knowledge
        ? { sheetUrl: knowledge.sheet_url, keyIndicators: knowledge.key_indicators, notes: knowledge.notes }
        : null,
    });
  }

  if (name === "save_client_knowledge") {
    const patch: Record<string, unknown> = { client_id: input.clientId, updated_at: new Date().toISOString() };
    if (input.sheetUrl !== undefined) patch.sheet_url = input.sheetUrl;
    if (input.keyIndicators !== undefined) patch.key_indicators = input.keyIndicators;
    if (input.notes !== undefined) patch.notes = input.notes;
    const { error } = await admin.from("fluxo_zeus_client_knowledge").upsert(patch, { onConflict: "client_id" });
    if (error) return `Erro ao salvar: ${error.message}`;
    return "Conhecimento salvo.";
  }

  if (name === "get_client_demands") {
    const { data } = await admin
      .from("fluxo_demands")
      .select("title, status, due_date, type, priority")
      .eq("client_id", input.clientId)
      .order("created_at", { ascending: false })
      .limit(20);
    return JSON.stringify(data || []);
  }

  if (name === "get_client_metrics") {
    const { data } = await admin
      .from("fluxo_entries")
      .select("period_start, period_end, metrics")
      .eq("client_id", input.clientId)
      .order("period_end", { ascending: false })
      .limit(10);
    return JSON.stringify(data || []);
  }

  if (name === "propose_alert") {
    uiBlocks.pendingConfirmation = { kind: "alert", payload: input };
    return "Proposta de alerta mostrada ao usuário, aguardando confirmação.";
  }

  if (name === "propose_demand") {
    uiBlocks.pendingConfirmation = { kind: "demand", payload: input };
    return "Proposta de demanda mostrada ao usuário, aguardando confirmação.";
  }

  if (name === "create_alert") {
    const memberIds: string[] = [];
    for (const n of input.memberNames || []) {
      const id = await resolveMemberIdByName(admin, n);
      if (id) memberIds.push(id);
    }
    const alertId = uid();
    const { error } = await admin.from("fluxo_alerts").insert({
      id: alertId,
      title: input.title,
      description: input.description || "",
      alert_type: input.alertType,
      client_ids: input.clientId ? [input.clientId] : [],
      destino: { everyone: !!input.everyone, roles: input.roles || [], memberIds },
      scheduled_date: new Date().toISOString().slice(0, 10),
      repeat_freq: "nenhuma",
      status: "agendado",
      created_by: callerId,
    });
    if (error) return `Erro ao criar alerta: ${error.message}`;
    uiBlocks.createdAlertId = alertId;
    return `Alerta "${input.title}" criado com sucesso (id ${alertId}). Vai disparar no próximo ciclo do app.`;
  }

  if (name === "create_demand") {
    const assigneeId = input.assigneeName ? await resolveMemberIdByName(admin, input.assigneeName) : null;
    const demandId = uid();
    const { error } = await admin.from("fluxo_demands").insert({
      id: demandId,
      title: input.title,
      client_id: input.clientId || null,
      description: input.description || "",
      priority: input.priority || "normal",
      due_date: input.dueDate || null,
      status: "aberta",
      origin: "zeus",
      type: "geral",
      assignee_id: assigneeId,
      recurring: { enabled: false, freq: "" },
      requires_proof: false,
      proof_status: "pendente",
    });
    if (error) return `Erro ao criar demanda: ${error.message}`;
    uiBlocks.createdDemandId = demandId;
    return `Demanda "${input.title}" criada com sucesso (id ${demandId}).`;
  }

  return `Tool desconhecida: ${name}`;
}
