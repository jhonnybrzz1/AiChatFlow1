# Inventário de Legados, Excesso e Itens Possivelmente Obsoletos

Data da análise: 2026-05-02

Status da aplicação: itens de baixo risco e evidência forte foram aplicados em 2026-05-02. Arquivos legados/experimentais foram removidos, artefatos gerados foram retirados do índice e o runtime foi ajustado para remover referências quebradas. Itens marcados como médio/alto risco sem evidência suficiente devem continuar passando por validação humana antes de novas remoções.

## Resumo Executivo

| Categoria | Candidatos | Confiança geral |
|---|---:|---|
| Código legado e obsoleto | 8 | Média/Alta |
| Funcionalidades não usadas | 7 | Média |
| Dependências e scripts não utilizados | 6 grupos | Média |
| Documentação e anotações antigas | 6 | Média |
| READMEs desatualizados | 4 | Média/Alta |

Escopo analisado: estrutura do repositório, entrypoints (`server/index.ts`, `server/routes.ts`, `client/src/main.tsx`, `client/src/App.tsx`), scripts de `package.json`, rotas Express, imports/referências via `rg`, docs, artefatos gerados e dependências declaradas.

Mapa rápido do projeto:

| Área | Pastas/arquivos principais | Observações |
|---|---|---|
| Frontend | `client/src`, `client/src/components`, `client/src/pages`, `client/src/lib`, `client/src/micro-frontends/legacy` | React + Vite + Wouter + TanStack Query. Há uma área explicitamente `legacy`. |
| Backend | `server/index.ts`, `server/routes.ts`, `server/services`, `server/cognitive-core`, `server/frameworks`, `server/routing`, `server/plugins` | Express com serviços de IA, PDF, rotas de demanda, governança, GitHub e métricas. |
| Dados/estado | `sqlite.db`, `data/*.json`, `data/*.csv`, `documents/`, `logs/` | Muitos arquivos parecem ser estado/runtime ou artefatos gerados. |
| Infra/config | `.github/workflows/ci.yml`, `render.yaml`, `drizzle.config.ts`, `vite.config.ts`, `vitest.config.ts`, `tailwind.config.ts` | CI roda `npm install`, `npm run check`, `npm test`. |
| Docs/scripts | `README*.md`, `SQUAD_INTEGRATION.md`, `docs/*`, scripts `test_*`, `autogen_*`, `convert_documents.py` | Há documentação de integrações antigas e scripts fora do fluxo npm/CI. |

## Código legado e obsoleto

### 1. Backup TypeScript de analisador GitHub

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | `github-analyzer.ts.bak` |
| Caminho | `server/services/github-analyzer.ts.bak` |
| Risco | Baixo |
| Validação humana necessária | Não, exceto se houver política de manter backups versionados. |

Descrição: arquivo `.bak` com implementação antiga de análise de repositório. Há rota comentada apontando para `githubAnalyzer`, mas o arquivo runtime esperado (`server/services/github-analyzer.ts`) não existe.

Evidências:
- Nome de backup: `server/services/github-analyzer.ts.bak`.
- Snippet do backup: `server/services/github-analyzer.ts.bak:5` declara `GitHub Analyzer Service - Lightweight repository analysis`.
- Rota/import desativados em `server/routes.ts:13` e `server/routes.ts:152-175`:
  ```ts
  // import { githubAnalyzer } from './services/github-analyzer';
  // app.get("/api/github/repos/:owner/:repo/analyze", ...
  ```
- Busca global por `github-analyzer` só encontra comentário/backup, sem import runtime ativo.

Impacto provável: manter aumenta ruído e sugere uma funcionalidade que não compila se reativada sem renomear/atualizar.

Recomendação: remover ou arquivar fora do código-fonte ativo.

### 2. JavaScript compilado duplicado de serviços TypeScript

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | `server/services/agent-interaction.js` e `server/storage.js` |
| Caminho | `server/services/agent-interaction.js`, `server/storage.js` |
| Risco | Médio |
| Validação humana necessária | Sim. Verificar se algum script local ainda depende desses JS. |

Descrição: arquivos JS gerados/antigos duplicam serviços que existem em TypeScript e ficam fora do fluxo de build atual.

Evidências:
- `package.json:7-9` usa `node --import tsx ... server/index.ts` e build com `esbuild server/index.ts`, não esses JS.
- `server/services/agent-interaction.ts` é importado por runtime (`server/services/ai-squad.ts:13`, `server/cognitive-core/agent-orchestrator.ts:4`).
- `server/services/agent-interaction.js:1-5` usa CommonJS gerado:
  ```js
  "use strict";
  Object.defineProperty(exports, "__esModule", { value: true });
  const openai_ai_1 = require("./openai-ai");
  ```
- `server/storage.js:1-5` também é CommonJS gerado e não corresponde ao estilo ESM/TS do runtime.
- Única referência prática encontrada a `server/storage.js` foi em script solto `test_ai_squad.ts`, não no runtime.

Impacto provável: risco de drift entre TS e JS; alguém pode importar o arquivo errado e testar comportamento obsoleto.

Recomendação: remover após migrar scripts locais para `server/storage.ts` ou `tsx`.

### 3. Micro-frontend Legacy Repository Indexer

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | Legacy Repository Indexer |
| Caminho | `client/src/micro-frontends/legacy/LegacyRepositoryIndexer.tsx` |
| Risco | Médio |
| Validação humana necessária | Sim. Confirmar se usuários ainda alternam para fluxo legacy. |

Descrição: componente explicitamente marcado como legacy e depreciável, ainda acessível por toggle no seletor de repositórios.

Evidências:
- Diretório contém `legacy`: `client/src/micro-frontends/legacy/`.
- `LegacyRepositoryIndexer.tsx:1-2`:
  ```ts
  // Legacy Repository Indexer Micro-Frontend
  // Isolated legacy code for repository indexing functionality
  ```
- UI informa depreciação: `LegacyRepositoryIndexer.tsx:178-180` mostra `Legacy Repository Indexer` e `will be deprecated soon`.
- Ainda existe toggle em `RepositorySelector.tsx:16-27` e renderização em `RepositorySelector.tsx:71-77`.
- Documentação reforça intenção de migração em `REPOSITORY_MODAL.md:22-29`.

Impacto provável: mantém fluxo alternativo com mocks e comportamento diferente do modal moderno.

Recomendação: instrumentar uso por 1 ciclo; se eventos `legacy_*` forem zero, remover componente, CSS e toggle.

### 4. Serviço Mistral mantido como alias depreciado

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | `mistral-ai.ts` |
| Caminho | `server/services/mistral-ai.ts` |
| Risco | Baixo |
| Validação humana necessária | Sim. Confirmar scripts locais antigos. |

Descrição: serviço Mistral é apenas alias para OpenAI e se declara deprecated.

Evidências:
- `server/services/mistral-ai.ts:4-8`:
  ```ts
  /**
   * @deprecated Use openAIService from ./openai-ai.
   * Kept as a thin alias so older local scripts keep running.
   */
  export const mistralAIService = openAIService;
  ```
- Busca global por `mistralAIService`/`MistralAIService` não encontrou uso runtime ativo.
- README principal ainda diz `Inteligência Artificial: Mistral AI` em `README.md:45`, mas o serviço efetivo é `openai-ai.ts`.

Impacto provável: confusão de stack e dependência declarada possivelmente obsoleta.

Recomendação: remover após atualizar docs e qualquer script local para `openAIService`.

### 5. Código AutoGen/Python isolado do fluxo principal

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | AutoGen bridge e scripts Python |
| Caminho | `server/services/autogen-bridge.ts`, `autogen_mistral.py`, `autogen_squad_integration.py` |
| Risco | Médio |
| Validação humana necessária | Sim. Verificar se há uso manual fora do app. |

Descrição: integração AutoGen existe e é documentada, mas não aparece registrada em rotas/runtime atuais.

Evidências:
- `server/services/autogen-bridge.ts:36-39` aponta para `autogen_mistral.py`.
- `server/services/autogen-bridge.ts:141-149` aponta para `autogen_squad_integration.py`.
- Busca global por `autoGenBridge` encontra apenas docs e o próprio arquivo, sem import runtime:
  - `SQUAD_INTEGRATION.md`
  - `README_MISTRAL.md`
  - `server/services/autogen-bridge.ts`
- `README_MISTRAL.md:23-27` pede `pip install pyautogen python-dotenv`, dependências fora de `package.json`.

Impacto provável: código de integração pode estar morto no app e exigir dependências Python não provisionadas.

Recomendação: arquivar como experimento ou criar feature flag/rota real se ainda for estratégico.

### 6. Assets anexados Python e imagens sem referências

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | `attached_assets/*` |
| Caminho | `attached_assets/` |
| Risco | Baixo |
| Validação humana necessária | Não para remoção do runtime; sim se forem histórico importante. |

Descrição: arquivos Python e imagens com timestamps parecem anexos/importações antigas, sem referência global.

Evidências:
- `attached_assets/analista_de_dados_1752689843803.py`, `attached_assets/main_1752689809301.py`, `attached_assets/image_1752689939973.png`, etc.
- Comando executado: para cada arquivo em `attached_assets/*`, busca por basename/stem via `rg`; não retornou referências fora dos próprios arquivos.
- Alguns scripts citam paths inexistentes como `prompts/frameworks/...`, por exemplo `attached_assets/main_1752689809301.py`.

Impacto provável: aumenta tamanho e ruído do repositório sem afetar runtime.

Recomendação: mover para arquivo histórico externo ou remover do repo.

### 7. Rota de teste PDF exposta no servidor

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | `/api/test-pdf` |
| Caminho | `server/routes.ts:803-852` |
| Risco | Médio |
| Validação humana necessária | Sim. Confirmar se usada em smoke test manual. |

Descrição: endpoint de teste gera PDFs hardcoded e escreve em `documents/` durante runtime.

Evidências:
- `server/routes.ts:803-804`:
  ```ts
  // Test PDF generation endpoint
  app.get("/api/test-pdf", async ...
  ```
- `server/routes.ts:832-846` gera e grava `test_prd.pdf` e `test_tasks.pdf`.
- `server.log` contém várias chamadas a `/api/test-pdf`, indicando uso manual/histórico, não CI.
- Testes automatizados de PDF já existem em `tests/pdf-layout.test.ts` e scripts top-level.

Impacto provável: endpoint de teste em produção pode gerar arquivos e expor superfície desnecessária.

Recomendação: remover do runtime ou proteger por `NODE_ENV !== 'production'`.

### 8. Arquivos gerados/runtimes versionados

| Campo | Valor |
|---|---|
| Tipo | Código legado e obsoleto |
| Candidato | DB, logs, documentos e métricas geradas |
| Caminho | `sqlite.db`, `server.log`, `logs/*`, `documents/*`, `data/demand_metrics.json`, `data/system_metrics.json` |
| Risco | Médio/Alto |
| Validação humana necessária | Sim. Confirmar se algum dado é seed necessário. |

Descrição: repositório contém estado runtime e outputs gerados. Parte disso já é ignorada por `.gitignore`, mas ainda aparece rastreada.

Evidências:
- `.gitignore:10-13` ignora `documents/`, `*.pdf`, `*.txt`.
- `git ls-files documents logs server.log sqlite.db data/*.json` listou documentos gerados, logs e banco SQLite rastreados.
- `server/db.ts:5` usa `sqlite.db` como database runtime.
- `server/utils/logger.ts:78-87` escreve `logs/error.log` e `logs/combined.log`.
- `data/demand_metrics.json` tem dezenas de KB de métricas runtime.

Impacto provável: commits futuros podem carregar dados locais, PDFs, logs e estado de desenvolvimento.

Recomendação: remover do índice (`git rm --cached`) depois de confirmar seeds; manter apenas fixtures mínimas versionadas.

## Funcionalidades não usadas

### 1. Endpoint GitHub Analyzer comentado

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | Lightweight repository analysis |
| Caminho | `server/routes.ts:152-175`, `server/services/github-analyzer.ts.bak` |
| Risco | Baixo |
| Validação humana necessária | Não, se o endpoint não está no roadmap imediato. |

Descrição: funcionalidade de análise leve de repositório está totalmente comentada e depende de arquivo `.bak`.

Evidências:
- `server/routes.ts:152` diz `disabled temporarily`.
- `server/routes.ts:159` chama `githubAnalyzer.analyzeRepository`, mas import está comentado em `server/routes.ts:13`.
- Não há `server/services/github-analyzer.ts`, apenas `.bak`.

Impacto provável: nenhuma no runtime atual; mantém ruído e documentação implícita de feature inativa.

Recomendação: remover bloco comentado ou abrir issue/backlog e arquivar código.

### 2. Import não usado de `codeAnalysisService`

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | Code analysis service |
| Caminho | `server/routes.ts:14`, `server/services/codeAnalysis.ts` |
| Risco | Baixo |
| Validação humana necessária | Não para remover import; sim para remover serviço. |

Descrição: `codeAnalysisService` é importado em rotas mas não usado.

Evidências:
- `server/routes.ts:14`:
  ```ts
  import { codeAnalysisService } from './services/codeAnalysis'; // Import the new service
  ```
- Busca global por `codeAnalysisService` mostrou apenas export em `server/services/codeAnalysis.ts:33` e esse import.
- Não há rota usando o serviço.

Impacto provável: lint/TS pode não falhar, mas indica feature incompleta.

Recomendação: remover import agora; avaliar se `server/services/codeAnalysis.ts` deve virar rota real ou ser arquivado.

### 3. Document generator abstrato não usado no fluxo atual

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | `DocumentGenerator`, `PRDGenerator`, `TasksGenerator` |
| Caminho | `server/services/document-generator.ts` |
| Risco | Médio |
| Validação humana necessária | Sim. Pode ser uma implementação alternativa aguardando migração. |

Descrição: há gerador estruturado de documentos, mas o fluxo principal usa métodos privados em `ai-squad.ts` e `pdf-generator.ts`.

Evidências:
- Busca por `DocumentGenerator` encontrou declarações em `server/services/document-generator.ts`, sem import runtime.
- `server/services/ai-squad.ts:698` chama `this.generatePRDWithPM(...)`.
- `server/services/ai-squad.ts:1297` chama `pdfGenerator.generatePRDDocument(...)` diretamente.
- `server/services/document-generator.ts` possui classes `PRDGenerator` e `TasksGenerator`, mas sem instância registrada.

Impacto provável: duplicação de lógica de geração/validação de documentos.

Recomendação: validar intenção. Se não houver plano de migrar, remover/arquivar.

### 4. Summarization service não conectado ao runtime

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | `summarizationService` |
| Caminho | `server/services/summarization.ts` |
| Risco | Baixo/Médio |
| Validação humana necessária | Sim. Verificar se scripts de teste ainda importam. |

Descrição: serviço de sumarização aparece apenas em testes/scripts antigos, não no processamento atual.

Evidências:
- Busca por `summarizationService` encontrou export em `server/services/summarization.ts:188`.
- Referências funcionais aparecem em `test_summarization.ts` e `test_simple_summarization.ts`, fora de `tests/`.
- Não há import em `server/routes.ts`, `server/services/ai-squad.ts` ou `server/index.ts`.

Impacto provável: código morto ou protótipo de feature não integrada.

Recomendação: mover para `tests/` se ainda útil, ou remover junto com scripts top-level.

### 5. Testes e scripts top-level fora do runner

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | Scripts `test_*` e `test-*` na raiz |
| Caminho | `test_ai_squad.ts`, `test_pdf_direct.ts`, `test_pdf_generation.ts`, `test_pdf_integration.ts`, `test_simple_summarization.ts`, `test_standard_pdf.ts`, `test_summarization.ts`, `test-db-connection.js`, etc. |
| Risco | Médio |
| Validação humana necessária | Sim. Alguns podem ser smoke tests manuais úteis. |

Descrição: vários scripts de teste ficam fora de `tests/` e não são chamados por `package.json`.

Evidências:
- `package.json:12` roda apenas `vitest run`; `package.json:13` só chama `server/test-mistral.ts`.
- Busca por nomes dos scripts top-level retornou zero referências para a maioria; exceção: `test_mistral_debate.py` aparece em `README_MISTRAL.md`.
- Testes oficiais em `tests/*.test.ts` já cobrem parte do comportamento.

Impacto provável: testes manuais podem ficar quebrados sem serem percebidos pelo CI.

Recomendação: migrar os úteis para `tests/`/Vitest; arquivar/remover os demais.

### 6. Scripts Python utilitários sem referência

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | `convert_documents.py`, `test_pdf_generation.py`, `test_download.py` |
| Caminho | raiz do repo |
| Risco | Baixo |
| Validação humana necessária | Sim. Confirmar se usados manualmente. |

Descrição: scripts Python não aparecem em `package.json`, CI ou rotas.

Evidências:
- `package.json` não possui scripts Python.
- Busca por `convert_documents.py` e `test_pdf_generation.py` não encontrou referências.
- `test_download.py` só se chama internamente (`test_download.py:51`, `test_download.py:93`).

Impacto provável: manutenção de ferramentas manuais não documentadas.

Recomendação: remover ou documentar em uma seção "manual tools".

### 7. Template de prompts JS não conectado

| Campo | Valor |
|---|---|
| Tipo | Funcionalidade não usada |
| Candidato | `prompts.js` |
| Caminho | `prompts.js` |
| Risco | Baixo |
| Validação humana necessária | Sim. Confirmar uso externo. |

Descrição: exporta prompts via JS, mas runtime atual carrega YAML em `agents/`.

Evidências:
- `prompts.js:51-52` exporta `prompts`.
- Busca por `from './prompts'`, `prompts.js` ou `loadPrompts` não encontrou import runtime.
- `server/services/ai-squad.ts` carrega configs de `agents/*.yaml`.

Impacto provável: caminho antigo de configuração de prompts.

Recomendação: remover ou migrar conteúdo relevante para `agents/*.yaml`.

## Dependências e scripts não utilizados

### 1. Dependências Mistral/AutoGen possivelmente órfãs

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | `@mistralai/mistralai`, docs/scripts AutoGen |
| Caminho | `package.json:18`, `README_MISTRAL.md`, `autogen_mistral.py` |
| Risco | Médio |
| Validação humana necessária | Sim. Confirmar se AutoGen/Mistral ainda é suportado oficialmente. |

Descrição: o runtime TypeScript não importa `@mistralai/mistralai`; Mistral virou alias para OpenAI.

Evidências:
- Heurística de imports (`rg` excluindo `package.json`, lockfile, dist, node_modules) retornou zero usos para `@mistralai/mistralai`.
- `server/services/mistral-ai.ts:4-8` declara serviço deprecated e alias para OpenAI.
- `README.md:45` e `README_MISTRAL.md` ainda destacam Mistral.

Impacto provável: dependência de runtime não usada e documentação conflitante.

Recomendação: remover dependência se AutoGen for arquivado; atualizar docs para OpenAI.

### 2. Stack de sessão/autenticação declarada sem uso

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | `express-session`, `connect-pg-simple`, `memorystore`, `passport`, `passport-local` |
| Caminho | `package.json:57`, `package.json:65`, `package.json:70`, `package.json:75-76` |
| Risco | Médio |
| Validação humana necessária | Sim. Pode estar planejado para autenticação futura. |

Descrição: dependências de sessão/auth aparecem no `package.json`, mas não há configuração de sessão/passport em `server/index.ts` ou `server/routes.ts`.

Evidências:
- `server/index.ts:5-8` só configura `express.json()` e `express.urlencoded()`.
- Busca por imports runtime dessas libs retornou zero usos.
- Não há `passport.initialize`, `session(...)` ou store configurada nas rotas.

Impacto provável: aumenta superfície de dependências sem benefício atual.

Recomendação: remover se auth não estiver ativa; caso contrário, implementar ou documentar roadmap.

### 3. Dependências de documentos/Markdown possivelmente órfãs

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | `docx`, `officegen`, `react-markdown`, `rehype-raw`, `rehype-sanitize`, `remark-gfm` |
| Caminho | `package.json:59`, `package.json:73`, `package.json:84`, `package.json:87-89` |
| Risco | Baixo/Médio |
| Validação humana necessária | Sim. Verificar se foram substituídas por PDF-lib/renderização própria. |

Descrição: o fluxo visível usa `pdf-lib` e visualização própria de documentos; essas libs não aparecem em imports runtime.

Evidências:
- Heurística de imports retornou zero usos para essas dependências.
- `server/routes.ts:803-852` e `server/services/ai-squad.ts` usam `pdfGenerator`, não `docx`/`officegen`.
- `client/src/components/document-viewer.tsx` carrega documento via fetch, sem import de `react-markdown`.

Impacto provável: dependências instaladas sem uso.

Recomendação: validar e remover em lote com `npm run check && npm test`.

### 4. Dependências UI/utilitárias sem import detectado

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | `framer-motion`, `react-icons`, `date-fns`, `tw-animate-css`, `zod-validation-error`, `ws` |
| Caminho | `package.json` |
| Risco | Baixo/Médio |
| Validação humana necessária | Sim. Heurística pode não detectar uso indireto em CSS/plugins. |

Descrição: dependências aparecem no manifest, mas busca por imports diretos não encontrou referências.

Evidências:
- Comando de heurística: `rg -l "['\"]<dep>(/|['\"]|$)" -g '!node_modules' -g '!dist' -g '!package*.json' .`.
- Retornaram zero usos para os candidatos acima.
- `tailwindcss-animate` é usado em config comum, mas `tw-animate-css` não apareceu como import.

Impacto provável: aumento de install time e árvore de dependências.

Recomendação: validar com ferramenta dedicada (`depcheck` ou equivalente) antes de remover.

### 5. Scripts npm reduzidos versus muitos testes soltos

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | scripts manuais não conectados ao npm |
| Caminho | `package.json:6-14`, raiz `test_*`, `test-*` |
| Risco | Médio |
| Validação humana necessária | Sim. Definir política de testes manuais. |

Descrição: `package.json` tem apenas `dev`, `build`, `start`, `check`, `db:push`, `test`, `test:mistral`, enquanto há muitos scripts de teste soltos.

Evidências:
- `package.json:12` `test` = `vitest run`.
- `package.json:13` `test:mistral` = `tsx server/test-mistral.ts`.
- Arquivos como `test_pdf_direct.ts`, `test_standard_pdf.ts`, `test_download.py`, `test-repo-service.js` não são acionados por scripts npm.

Impacto provável: falso senso de cobertura; scripts quebram sem CI perceber.

Recomendação: promover scripts relevantes a npm/Vitest ou arquivar.

### 6. CI usa `npm install`, não lockfile estrito

| Campo | Valor |
|---|---|
| Tipo | Dependências e scripts não utilizados |
| Candidato | CI install step |
| Caminho | `.github/workflows/ci.yml` |
| Risco | Baixo |
| Validação humana necessária | Não. |

Descrição: CI usa `npm install` apesar de haver `package-lock.json`.

Evidências:
- `.github/workflows/ci.yml` contém `run: npm install`.
- Repositório tem `package-lock.json`.

Impacto provável: builds menos reprodutíveis; não é legado, mas é candidato a ajuste.

Recomendação: trocar para `npm ci`.

## Documentação e anotações antigas

### 1. READMEs Mistral/AutoGen descrevem integração não conectada ao app

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | `README_MISTRAL.md`, `SQUAD_INTEGRATION.md` |
| Caminho | raiz |
| Risco | Baixo |
| Validação humana necessária | Sim. Confirmar status da feature. |

Descrição: documentação descreve AutoGen/Mistral como fluxo ativo, mas o bridge não é importado em runtime.

Evidências:
- `README_MISTRAL.md:23-27` instrui instalar `pyautogen`.
- `README_MISTRAL.md:66-81` instrui rodar `python autogen_mistral.py`.
- Busca por `autoGenBridge` encontra apenas docs e `server/services/autogen-bridge.ts`, sem rota ativa.

Impacto provável: setup confuso e dependências Python não instaladas pelo projeto Node.

Recomendação: mover para `docs/archive/` ou marcar como experimental.

### 2. Documentos de implementação/resumo possivelmente históricos

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | `IMPLEMENTATION_SUMMARY.md`, `COGNITIVE_CORE_IMPLEMENTATION.md`, `UX_IMPROVEMENTS_SUMMARY.md`, `REPO_SERVICE_FIXES.md` |
| Caminho | raiz |
| Risco | Baixo |
| Validação humana necessária | Sim. Confirmar se são registros históricos úteis. |

Descrição: arquivos parecem snapshots de entregas anteriores, não documentação operacional atual.

Evidências:
- Nomes indicam conclusão/histórico: `*_SUMMARY.md`, `*_FIXES.md`, `*_IMPLEMENTATION.md`.
- README principal não aponta todos esses documentos como fonte ativa.
- Alguns citam próximas ações já sobrepostas por código recente.

Impacto provável: ruído para onboarding e busca.

Recomendação: arquivar em `docs/archive/` ou consolidar no README/docs atuais.

### 3. Backlogs extensos recém-versionados podem ser planejamento, não documentação runtime

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | `docs/INNOVATION_BACKLOG*.md`, `PRODUCT_DISCOVERY_REPORT.md` |
| Caminho | `docs/`, raiz |
| Risco | Baixo |
| Validação humana necessária | Sim. Verificar se devem estar no repo principal. |

Descrição: documentos de product discovery/backlog são úteis, mas não necessários ao build/runtime e podem envelhecer rápido.

Evidências:
- `PRODUCT_DISCOVERY_REPORT.md` é relatório estratégico, não referência operacional.
- `docs/INNOVATION_BACKLOG_COMPLETE.md` lista muitos épicos futuros e gaps.
- Não há links do README principal para esses novos backlogs.

Impacto provável: polui o repo se não houver processo de manutenção.

Recomendação: manter se forem fonte de produto; senão mover para wiki/PM docs.

### 4. Docs citam caminhos/comandos externos sem lock no repo

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | Docs AutoGen e attached assets |
| Caminho | `README_MISTRAL.md`, `SQUAD_INTEGRATION.md`, `attached_assets/*.py` |
| Risco | Baixo |
| Validação humana necessária | Sim. |

Descrição: documentos e scripts citam dependências Python e caminhos de prompt que não existem no repo atual.

Evidências:
- `README_MISTRAL.md:53-55` cita `.env.autogen.example`; o arquivo existe localmente, mas não aparece nos scripts npm/CI.
- `attached_assets/main_1752689809301.py` referencia `prompts/`, mas `find prompts` não encontrou pasta `prompts/`.
- `README_MISTRAL.md` pede `pip install`, mas não há `requirements.txt`/`pyproject.toml`.

Impacto provável: instruções manuais incompletas.

Recomendação: arquivar ou criar `requirements.txt` e scripts npm se essa integração continuar.

### 5. Comentários TODO/disabled no backend

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | comentários de rota desativada/TODO |
| Caminho | `server/routes.ts`, `server/routes/governance-routes.ts` |
| Risco | Baixo |
| Validação humana necessária | Não para limpeza de comentários; sim para features. |

Descrição: há blocos comentados e TODOs que funcionam como backlog inline.

Evidências:
- `server/routes.ts:152` `disabled temporarily`.
- `server/routes.ts:197-207` rota backend de repos comentada por conflito.
- `server/routes/governance-routes.ts:223` TODO de auth context.

Impacto provável: dívida de clareza; pode esconder features abandonadas.

Recomendação: transformar em issues/backlog e remover comentários longos.

### 6. Logs e métricas versionados confundem documentação histórica com estado runtime

| Campo | Valor |
|---|---|
| Tipo | Documentação e anotações antigas |
| Candidato | `server.log`, `logs/*.log`, `data/*.json` |
| Caminho | raiz, `logs/`, `data/` |
| Risco | Médio |
| Validação humana necessária | Sim. Confirmar se dados são fixtures. |

Descrição: logs/métricas têm valor investigativo local, mas não deveriam servir como documentação viva.

Evidências:
- `server.log` contém chamadas históricas a `/api/test-pdf`.
- `data/demand_metrics.json` e `data/system_metrics.json` são escritos por coletores de métricas.
- Não há README explicando que esses arquivos são fixtures.

Impacto provável: commits acidentais de dados locais e histórico enganoso.

Recomendação: mover dados de exemplo para `fixtures/` com tamanho mínimo; ignorar runtime.

## READMEs desatualizados

### 1. README principal aponta Mistral como IA principal

| Campo | Valor |
|---|---|
| Tipo | READMEs desatualizados |
| Candidato | README stack de IA |
| Caminho | `README.md:45`, `server/services/openai-ai.ts`, `server/services/mistral-ai.ts` |
| Risco | Baixo |
| Validação humana necessária | Não. |

Descrição: README diz Mistral AI, mas runtime usa OpenAI e Mistral é alias deprecated.

Evidências:
- `README.md:45`: `Inteligência Artificial: Mistral AI`.
- `server/services/mistral-ai.ts:4-8`: `@deprecated Use openAIService`.
- `server/services/openai-ai.ts` é usado por `ai-squad`, `agent-interaction` e plugins.

Impacto provável: onboarding configura provider errado.

Recomendação: atualizar README para OpenAI como provider atual e Mistral/AutoGen como experimental/arquivado.

### 2. README principal pede `MISTRAL_API_KEY`, mas app usa OpenAI

| Campo | Valor |
|---|---|
| Tipo | READMEs desatualizados |
| Candidato | README setup env |
| Caminho | `README.md:216-224`, `.env.example`, `server/services/openai-ai.ts` |
| Risco | Médio |
| Validação humana necessária | Não. |

Descrição: setup principal orienta preencher `MISTRAL_API_KEY`, mas serviço atual lê `OPENAI_API_KEY`.

Evidências:
- `README.md:218-222`:
  ```env
  MISTRAL_API_KEY="sua_chave_da_mistral_ai"
  ```
- `server/services/openai-ai.ts` usa `process.env.OPENAI_API_KEY`.
- `server/services/mistral-ai.ts` é alias deprecated.

Impacto provável: ambiente novo falha por variável errada.

Recomendação: atualizar README e `.env.example` para provider atual.

### 3. README principal fixa porta 5000, mas servidor escolhe porta dinâmica se `PORT` ausente

| Campo | Valor |
|---|---|
| Tipo | READMEs desatualizados |
| Candidato | instrução de URL local |
| Caminho | `README.md:227-232`, `server/index.ts:57-62` |
| Risco | Baixo |
| Validação humana necessária | Não. |

Descrição: README afirma que aplicação estará em `localhost:5000`; código usa `PORT` se existir, senão porta `0` (aleatória).

Evidências:
- `README.md:232`: `http://localhost:5000`.
- `server/index.ts:57`: `const port = process.env.PORT ? parseInt(...) : 0`.
- `server/index.ts:61-62` loga porta real atribuída.

Impacto provável: confusão em dev quando `.env` não define `PORT`.

Recomendação: documentar `PORT=5000` como obrigatório para URL fixa ou orientar observar log.

### 4. README_MISTRAL/SQUAD_INTEGRATION parecem documentação de experimento

| Campo | Valor |
|---|---|
| Tipo | READMEs desatualizados |
| Candidato | `README_MISTRAL.md`, `SQUAD_INTEGRATION.md` |
| Caminho | raiz |
| Risco | Baixo |
| Validação humana necessária | Sim. |

Descrição: docs tratam AutoGen como funcionalidade pronta, mas não há endpoint real ativo.

Evidências:
- `SQUAD_INTEGRATION.md` sugere endpoint exemplo `/api/demands/:id/squad-debate`, mas busca em `server/routes.ts` não encontra essa rota.
- `README_MISTRAL.md:132-145` define testes Python fora do CI.
- Busca por `autoGenBridge` não encontra import ativo fora da documentação.

Impacto provável: usuários esperam uma integração que não está exposta na aplicação.

Recomendação: mover para `docs/archive/experimental-autogen.md` ou implementar rota/feature flag.

## Próximos Passos

1. Baixo risco imediato:
   - Remover `server/services/github-analyzer.ts.bak`.
   - Remover import não usado `codeAnalysisService` de `server/routes.ts`.
   - Proteger ou remover `/api/test-pdf`.
   - Atualizar README para OpenAI/porta real.

2. Higienização de artefatos:
   - Rodar `git ls-files documents logs server.log sqlite.db data/*.json`.
   - Confirmar o que é fixture versus runtime.
   - Remover do índice o que for runtime: `git rm --cached ...`.
   - Adicionar padrões faltantes ao `.gitignore`: `*.log`, `server.pid`, `sqlite.db`, `data/*metrics*.json` se não forem fixtures.

3. Consolidação de testes/scripts:
   - Escolher quais scripts top-level são úteis.
   - Migrar para `tests/*.test.ts` ou `package.json`.
   - Remover scripts duplicados/obsoletos.

4. Decisão sobre integrações experimentais:
   - AutoGen/Mistral: manter como feature oficial, ou arquivar docs/scripts.
   - Legacy repository indexer: medir uso via eventos e remover toggle se não usado.

5. Dependências:
   - Validar lista candidata com ferramenta dedicada (`depcheck`/análise manual).
   - Remover em pequenos lotes, sempre rodando `npm run check` e `npm test`.

6. Documentação:
   - Consolidar documentos históricos em `docs/archive/`.
   - Manter README principal apenas com setup atual, endpoints atuais e provider atual.
