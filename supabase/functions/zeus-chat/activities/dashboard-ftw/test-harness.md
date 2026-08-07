# Harness de teste obrigatório

Antes de apresentar QUALQUER dashboard gerado ou editado por esta skill, rode este harness Node
contra o `<script>` inline extraído do HTML final. Ele simula um DOM mínimo o suficiente para
executar `boot()` e capturar o texto renderizado das seções principais, sem precisar de navegador.

## 1. Checagem de sintaxe (sempre primeiro, é rápida e pega a maioria dos erros)

```bash
python3 -c "
import re
h=open('ARQUIVO.html').read()
open('script_only.js','w').write(re.search(r'<script>([\s\S]*)</script>',h).group(1))
"
node --check script_only.js && echo "SINTAXE OK"
```

Se falhar, o Node aponta a linha exata — quase sempre é um bloco de dados que ficou duplicado ou
cortado no lugar errado numa edição "por cima" de um arquivo existente. Corrija por índice de linha
exato (não por substituição de string solta), reveja o resultado, e rode de novo antes de seguir.

## 2. Boot headless completo

Adapte os `vals` do stub de `<select>` para as abas que existirem no arquivo (nem todo cliente tem
todas as abas — pule os `els[...]` que não existirem, eles simplesmente não aparecem no objeto).

```js
global.Option=function(t,v){this.text=t;this.value=v;};
function mkSel(){const o={options:[],add(x){o.options.push(x);if(o._v===undefined)o._v=x.value},
 get value(){return o._v},set value(x){o._v=x},
 set innerHTML(x){o.options=[];o._v=undefined;o._h=x},get innerHTML(){return o._h||''},
 set textContent(x){o._t=x},get textContent(){return o._t||''},
 onchange:null,onclick:null,appendChild:()=>{},insertAdjacentHTML(p,x){},children:{length:1},style:{}};return o;}
const els={};
global.document={querySelectorAll:()=>[],
 getElementById:id=>els[id]||(els[id]=mkSel()),
 createElement:()=>({classList:{add:()=>{}},appendChild:()=>{},set className(v){this._c=v},get className(){return this._c||''},textContent:'',onclick:null}),
 querySelector:()=>null};
global.window={innerWidth:1200,addEventListener:()=>{},scrollY:0};
global.Chart=function(){this.destroy=()=>{}};
Chart.defaults={font:{},elements:{line:{}},plugins:{legend:{}}};
Chart.getChart=()=>null;
global.XLSX={};
global.fetch=async()=>{throw new Error('offline')}; // força o snapshot embutido, não a rede real

const src=require('fs').readFileSync('ARQUIVO.html','utf8').match(/<script>([\s\S]*)<\/script>/)[1];
(async()=>{
 try{ await new Function(src)(); }
 catch(e){ console.log('ERR:', e.stack.split('\n').slice(0,6).join(' | ')); return; }
 const strip=s=>String(s).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 console.log('=== BOOT OK ===');
 // imprima o insight/tabela de CADA aba que o arquivo realmente tiver, ex.:
 if(els['dashp-insight']) console.log('dashp:', strip(els['dashp-insight'].innerHTML).slice(0,200));
 if(els['dashf-insight']) console.log('dashf:', strip(els['dashf-insight'].innerHTML).slice(0,200));
 if(els['jjInsight'])     console.log('jj:',    strip(els['jjInsight'].innerHTML).slice(0,200));
 if(els['ftw-rede'])      console.log('ftw:',   strip(els['ftw-rede'].innerHTML).slice(0,200));
 if(els['alavInsight'])   console.log('alav:',  strip(els['alavInsight'].innerHTML).slice(0,200));
 if(els['mg-kpis'])       console.log('margem:',strip(els['mg-kpis'].innerHTML).slice(0,200));
})();
```

## 3. Conferência manual de fidelidade

Pegue 2–3 números impressos pelo harness e confirme manualmente contra a planilha original
(célula por célula). Isso pega o tipo de erro que passa despercebido no boot (dado errado mas
sintaticamente válido) — por exemplo, um valor que ficou da marca errada por causa de um `replace`
que não pegou todas as ocorrências.

## 4. Varredura de contaminação (só quando o arquivo foi editado por cima de outro já existente)

```bash
grep -n "NomeDoOutroCliente\|LojaDoOutroCliente1\|LojaDoOutroCliente2" ARQUIVO.html
```

Deve retornar vazio. Se aparecer qualquer coisa, NÃO entregue — o arquivo está misturando dados
de clientes diferentes (foi exatamente isso que causou o incidente registrado no SKILL.md).

## 5. Teste de mobile (se o header/menu foi tocado)

```js
class El{ /* ... reimplemente um DOM mínimo com classList/dataset/style, ver histórico da skill ... */ }
```
Cenários mínimos a cobrir: abrir/fechar o menu, fechar sozinho ao clicar numa aba, header
some ao rolar para baixo (só em innerWidth ≤ 820), header nunca some em innerWidth > 820.

Só depois de todos os passos acima passarem é que o arquivo deve ser apresentado ao usuário.
