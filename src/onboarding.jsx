import React, { useState } from "react";
import { C, Btn, Ring } from "./ui.jsx";
import { Rss, Users, TrendingUp, Bell, ClipboardList, Megaphone, UserCog, Sparkles } from "lucide-react";

const STEPS_ADMIN = [
  { icon: Sparkles, title: "Bem-vindo(a) ao Fluxo", text: "Um tour rápido pra você já sair sabendo onde encontrar cada coisa." },
  { icon: Rss, title: "Novidades", text: "A timeline do time — poste avisos, filtre por tema ou cliente, marque pessoas específicas ou o time todo." },
  { icon: Users, title: "Clientes", text: "Cadastre seus clientes aqui: unidades, indicadores prioritários e briefing de diagnóstico." },
  { icon: TrendingUp, title: "Dashboard", text: "Converse com o Zeus: ele gera dashboards ao vivo a partir de uma planilha, analisa clientes e pode até criar alertas e demandas por você." },
  { icon: Bell, title: "Alertas", text: "O sistema compara os períodos sozinho e avisa quando algo foge do esperado." },
  { icon: ClipboardList, title: "Demandas", text: "Seu quadro de tarefas — do alerta ou pedido até a conclusão, com comprovação quando precisar." },
  { icon: Megaphone, title: "Réguas de comunicação", text: "Configure lembretes automáticos por prazo, por ação ou por alerta." },
  { icon: UserCog, title: "Equipe & Acessos", text: "Convide o time por aqui — cada pessoa recebe um e-mail pra definir a própria senha." },
];

const STEPS_STAFF = [
  { icon: Sparkles, title: "Bem-vindo(a) ao Fluxo", text: "Um tour rápido pra você já sair sabendo onde encontrar cada coisa." },
  { icon: Rss, title: "Novidades", text: "A timeline do time — poste avisos, filtre por tema ou cliente, veja o que te marcaram." },
  { icon: ClipboardList, title: "Minhas demandas", text: "Suas tarefas atribuídas — do recebimento até a conclusão, com comprovação quando pedido." },
];

export function Onboarding({ role, onFinish }) {
  const steps = role === "admin" ? STEPS_ADMIN : STEPS_STAFF;
  const [i, setI] = useState(0);
  const step = steps[i];
  const Icon = step.icon;
  const last = i === steps.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(8,9,13,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: C.surface, border: `1px solid ${C.borderLight}`, borderRadius: 16, width: "100%", maxWidth: 400, padding: "32px 28px", textAlign: "center", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
        <div style={{ width: 56, height: 56, borderRadius: 999, background: C.brand, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
          <Icon size={26} color="#fff" />
        </div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color: C.text, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 8 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, marginBottom: 24, minHeight: 40 }}>
          {step.text}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 22 }}>
          {steps.map((_, idx) => (
            <div key={idx} style={{ width: idx === i ? 18 : 6, height: 6, borderRadius: 999, background: idx === i ? C.brand : C.border, transition: "width .15s" }} />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <button onClick={onFinish} style={{ background: "none", border: "none", color: C.mutedDim, fontSize: 12, cursor: "pointer" }}>
            Pular tour
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {i > 0 && <Btn variant="ghost" onClick={() => setI((n) => n - 1)}>Voltar</Btn>}
            <Btn onClick={() => (last ? onFinish() : setI((n) => n + 1))}>{last ? "Começar a usar" : "Próximo"}</Btn>
          </div>
        </div>
      </div>
    </div>
  );
}
