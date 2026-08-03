# Coletivo · Fluxo de demandas — deploy no GitHub Pages + Supabase

## ⚠️ Este projeto Supabase é compartilhado com outro app
O projeto Supabase usado aqui (`eaxrnxjzjotrzbuxhqmj`) também hospeda outro sistema, o
**Forneria Original** ([gestao-operacional](https://raphaelcltvo.github.io/gestao-operacional)),
com suas próprias tabelas (`profiles`, `insumos`, `lanches_registros`, etc). Por isso
**toda tabela e função do Fluxo usa o prefixo `fluxo_`** (`fluxo_profiles`, `fluxo_clients`,
`fluxo_is_admin()`...). Já aconteceu uma vez de uma migration sem prefixo colidir
silenciosamente com a tabela `profiles` da Forneria e apagar dados de produção dela — ao
mexer no schema deste projeto, sempre confirme o prefixo antes de rodar qualquer `create
table`/`create function`/`drop`.

## O que mudou nesta versão
O Fluxo agora tem **login de verdade** (e-mail/senha, via Supabase Auth) e **dados
compartilhados de verdade** entre a equipe (banco Postgres no Supabase, em vez do
`localStorage` isolado por navegador). O acesso continua sendo só por convite: o admin
cadastra a pessoa na aba Equipe e ela recebe um e-mail com um link para definir a senha.

Alertas de métrica e lembretes de prazo continuam aparecendo no sino da plataforma como
antes, e agora também disparam um **e-mail de verdade** para a pessoa responsável (via
Resend), assim que a trilha de configuração abaixo estiver completa.

**Login com Google** ainda não está implementado (ficou para uma próxima etapa — o botão
pode ser adicionado nas configurações de Auth do Supabase + um pequeno ajuste na tela de
login em `src/auth.jsx`, sem precisar redesenhar nada).

**Limitação atual do motor de réguas:** o disparo de lembretes por prazo (X dias antes,
dia fixo do mês) ainda roda no navegador de quem estiver com o app aberto, não em um
servidor — ou seja, se ninguém abrir o Fluxo num determinado dia, esses lembretes
específicos não disparam naquele dia (alertas de métrica e convites continuam
funcionando normalmente, pois são disparados na hora, por ação de alguém). Se isso virar
um problema no dia a dia, o próximo passo é mover essa checagem para uma função agendada
no Supabase (pg_cron + Edge Function).

## Arquitetura
- **Frontend**: React + Vite, publicado como site estático no GitHub Pages (sem mudança).
- **Backend**: [Supabase](https://supabase.com) — Postgres (dados), Auth (login) e Edge
  Functions (convite de novo membro + envio do e-mail de alerta via
  [Resend](https://resend.com)).
- O navegador conversa direto com o Supabase usando a "anon key" (pública por design — a
  segurança de verdade vem das regras de RLS no banco, não do sigilo dessa chave).

## Passo a passo para publicar

### 1. Banco de dados (Supabase)
No SQL Editor do seu projeto Supabase, rode o conteúdo de
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — cria as
tabelas, ativa RLS e as policies de acesso.

### 2. Variáveis de ambiente
Em **Project Settings → API** no Supabase, copie a **Project URL** e a **anon public
key**.
- Local: copie [`.env.local.example`](.env.local.example) para `.env.local` e preencha.
- GitHub Actions: no repositório, **Settings → Secrets and variables → Actions**, crie os
  secrets `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os mesmos valores.

### 3. Edge Functions
No terminal, dentro desta pasta (precisa do [Supabase CLI](https://supabase.com/docs/guides/cli)):
```bash
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase functions deploy invite-team-member
supabase functions deploy send-alert-email
```
Depois, configure os secrets que as functions usam (**Project Settings → API** tem a
`service_role key`; a `RESEND_API_KEY` você pega depois de criar a conta na Resend):
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=... RESEND_API_KEY=... ALERT_FROM_EMAIL=alertas@agenciacoletivo.com WEBHOOK_SECRET=escolha-uma-senha-aleatoria-aqui
```

### 4. E-mail de alerta (Resend)
Crie uma conta em [resend.com](https://resend.com), verifique o domínio
`agenciacoletivo.com` (a própria Resend mostra os registros DNS TXT/CNAME que faltam) e
gere uma API key — é o valor de `RESEND_API_KEY` acima.

Depois, em **Database → Webhooks** no Supabase, crie um webhook:
- Tabela: `fluxo_notifications`, evento: `INSERT`
- Tipo: HTTP Request → aponte para a URL da função `send-alert-email`
- Adicione o header `x-webhook-secret` com o mesmo valor de `WEBHOOK_SECRET` configurado
  acima (garante que só o próprio Supabase consegue chamar a função).

### 5. Login (Supabase Auth)
Em **Authentication → URL Configuration**, adicione a URL onde o site vai ficar
(`https://SEU-USUARIO.github.io/coletivo-fluxo/`) tanto em **Site URL** quanto em
**Redirect URLs** — sem isso, os links de convite/redefinição de senha não voltam pro
app corretamente.

Opcional (recomendado): em **Authentication → Emails → SMTP Settings**, configure o SMTP
da Resend pra os e-mails de convite/redefinição de senha também saírem de
`@agenciacoletivo.com` em vez do remetente genérico do Supabase.

### 6. Criar o primeiro admin
Como o cadastro é só por convite, o primeiríssimo acesso precisa ser criado direto no
Supabase: **Authentication → Users → Add user** (defina um e-mail, marque "Auto Confirm
User"), depois insira a linha correspondente na tabela `fluxo_profiles` (SQL Editor):
```sql
insert into fluxo_profiles (id, name, email, role, status)
values ('UUID-DO-USUARIO-CRIADO', 'Seu nome', 'voce@agenciacoletivo.com', 'admin', 'ativo');
```
A partir daí, esse admin consegue convidar o resto da equipe normalmente pela aba Equipe.

### 7. Repositório e GitHub Pages
```bash
git init
git add .
git commit -m "Primeira versão do sistema Fluxo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/coletivo-fluxo.git
git push -u origin main
```
No repositório no GitHub: **Settings → Pages → Build and deployment → Source**, selecione
**"GitHub Actions"**. O workflow em `.github/workflows/deploy.yml` builda e publica a
cada `git push` na `main` (acompanhe em **Actions**). O site fica em:
```
https://SEU-USUARIO.github.io/coletivo-fluxo/
```

### 8. Testar localmente antes de subir
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`. Sem sessão, aparece a tela de login.

## Próximos ajustes possíveis
- Login com Google (Google Cloud Console → OAuth Client → habilitar o provider Google em
  Authentication → Providers no Supabase → adicionar o botão em `src/auth.jsx`).
- Mover o motor de réguas por tempo (X dias antes do prazo, dia fixo do mês) para uma
  função agendada no Supabase, pra não depender de alguém com o app aberto no navegador.
- SMTP próprio para os e-mails de convite/redefinição de senha (passo 5 acima).
