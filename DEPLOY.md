# Coletivo · Fluxo de demandas — deploy no GitHub Pages

## O que mudou em relação à versão do Claude
O sistema é o mesmo, com uma única mudança técnica: onde antes ele salvava dados usando
`window.storage` (que só existe dentro do Claude), agora ele usa `localStorage` do
navegador (arquivo `src/storage.js`). Isso significa:

- **Cada navegador guarda seus próprios dados.** Se você usar no Chrome do seu notebook e
  a Ana Paula usar no navegador dela, vocês NÃO veem os dados uma da outra — são cópias
  separadas. Para dados compartilhados de verdade entre a equipe, o próximo passo seria
  um backend com banco de dados (posso ajudar com isso depois, se quiser evoluir).
- Se você limpar o cache/dados do navegador, os dados lançados no sistema se perdem.
  Vale ir de vez em quando em Relatórios e guardar um print ou exportar os números
  importantes em outro lugar, até termos um banco de dados de verdade.

## Passo a passo para publicar

### 1. Criar o repositório no GitHub
No GitHub, crie um repositório novo (pode ser público ou privado — Pages funciona nos
dois, mas repositório privado exige plano pago do GitHub para Pages). Sugestão de nome:
`coletivo-fluxo` (se usar outro nome, ajuste a linha `base:` em `vite.config.js`).

### 2. Subir os arquivos
No terminal, dentro desta pasta:

```bash
git init
git add .
git commit -m "Primeira versão do sistema Fluxo"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/coletivo-fluxo.git
git push -u origin main
```

### 3. Ativar o GitHub Pages
No repositório no GitHub: **Settings → Pages → Build and deployment → Source**, selecione
**"GitHub Actions"** (não "Deploy from a branch"). O workflow que já está em
`.github/workflows/deploy.yml` cuida do resto sozinho.

### 4. Aguardar o build
Toda vez que você der `git push` na branch `main`, o GitHub builda e publica
automaticamente. Acompanhe em **Actions**, na aba do repositório. Quando o passo
"deploy" ficar verde, o site estará em:

```
https://SEU-USUARIO.github.io/coletivo-fluxo/
```

### 5. Testar localmente antes de subir (recomendado)
```bash
npm install
npm run dev
```
Abre em `http://localhost:5173`. Assim você vê se está tudo certo antes de publicar.

## Próximos ajustes possíveis (quando fizer sentido para vocês)
- Trocar `localStorage` por um banco de dados real (Supabase, Firebase, ou backend
  próprio) para os dados serem compartilhados entre toda a equipe, de qualquer navegador.
- Adicionar login de verdade (hoje o "Ver como" é só uma simulação de perfil).
- Conectar e-mail de verdade para as notificações (hoje é só o link `mailto:`).
