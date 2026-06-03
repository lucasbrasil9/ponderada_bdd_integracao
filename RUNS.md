# Guia de Execução — Ponderada CI/CD

**Repo:** `lucasbrasil9/ponderada_bdd_integracao`
**Branch local:** `experimento-cicd` (4 commits à frente do origin, working tree clean)
**Clone local:** `/mnt/c/Users/paiva/OneDrive/Documentos/Github/ponderada_cicd_work/`

---

## Estado atual

```
0af670f feat(analytics): add metric collection and chart generation scripts
3144c21 ci: add 3-job pipeline with cache and test artifact
9e919b0 test: add 20 synthetic + 5 slow tests for experiment
6d3b0f6 chore: add minimal eslint config
16e4c0d feat: initialize fiscal integration flow project   ← origin/main
```

Tudo commitado localmente. **Nada foi pushed ainda** — você decide quando empurrar cada commit.

---

## Ordem de execução recomendada

### Passo 0 — Autenticar no GitHub (se ainda não estiver)

```bash
cd /mnt/c/Users/paiva/OneDrive/Documentos/Github/ponderada_cicd_work
git config --global user.name "lucasbrasil9"
git config --global user.email "lucasbrasil9@users.noreply.github.com"
# Push inicial (vai pedir credenciais; use PAT como senha)
git push -u origin experimento-cicd
```

> Ao fazer o push, o Actions roda automaticamente em **run #1** (baseline) já que a branch tem workflow.
> **Anote o run_id** da URL: `https://github.com/lucasbrasil9/ponderada_bdd_integracao/actions/runs/<RUN_ID>`

### Passos 1-14 — Executar cada variação

Para cada run, faça:

1. **Edite** o arquivo (workflow, teste ou config) conforme a variação.
2. **Commit** com a mensagem exata.
3. **Push** → Actions roda.
4. **Anote** o `run_id` na tabela abaixo.

Use `git commit --allow-empty` quando a variação não exigir mudança de arquivo.

#### Tabela de runs

| # | Variação | Mensagem do commit | Comando extra | Esperado |
|---|---|---|---|---|
| 1 | baseline (já dispara no push inicial) | — | (já feito no passo 0) | success |
| 2 | cache cold | `chore: rerun baseline (cache cold)` | Antes: deletar cache em Settings→Actions→Caches | success |
| 3 | cache warm | `chore: rerun baseline (cache warm)` | `--allow-empty` | success |
| 4 | test fail | `test: break test on purpose` | Adicionar `expect(1+1).toBe(3)` em `tests/uploadFiscalFlow.test.js` | failure |
| 5 | lint fail | `lint: introduce style error` | Adicionar `"no-var": "error"` em `.eslintrc.json` + reverter test fail | failure |
| 6 | +5 testes lentos | `test: add 5 slow tests for experiment` | `--allow-empty` (já commitados em #9e919b0) | success |
| 7 | +20 testes sint | `test: add 20 synthetic tests for experiment` | `--allow-empty` | success |
| 8 | npm install | `ci: switch to npm install` | Trocar `npm ci` por `npm install` em todos os 3 jobs | success |
| 9 | 1 job | `ci: collapse jobs to single` | Colapsar para um job `all` | success |
| 10 | 2 jobs paralelos | `ci: parallelize lint and test` | install sozinho + lint_and_test paralelo | success |
| 11 | 3 jobs sequenciais | `ci: restore 3 sequential jobs` | Restaurar workflow original (install→lint→test) | success |
| 12 | ordem invertida | `ci: invert job order` | `lint` sem `needs: install`, `install` com `needs: lint` | success |
| 13a | recovery A (fail) | `test: temporarily break for recovery` | `expect(true).toBe(false)` em uploadFiscalFlow | failure |
| 13b | recovery A (fix) | `fix: revert test failure (recovery A)` | Remover linha quebrada | success |
| 14a | recovery B (fail) | `lint: reintroduce no-var for recovery` | `"no-var": "error"` de novo | failure |
| 14b | recovery B (fix) | `fix: revert lint error (recovery B)` | Remover regra | success |

**Total: 16 runs (1 baseline + 2 cache + 4 simples + 4 variações pipeline + 4 recovery) — ≥12 ✓**

> **Dica:** use `git commit --allow-empty -m "..."` quando o commit não tem mudança de arquivo (runs #3, #6, #7).

### Após cada run

Anote em `analytics/raw/runs.csv` (criar arquivo):

```csv
run_number,variation,run_id,commit_sha,status,workflow_duration,test_count,test_failures,notes
1,baseline,1234567890,abc1234,success,45,32,0,primeira run
2,cache_cold,1234567891,def5678,success,60,32,0,cache limpo
...
```

Para pegar o run_id, abra a run no GitHub e copie o número da URL.

---

## Passo 2 — Coletar métricas

Depois que as 16 runs terminarem:

### 2.1 Criar PAT

1. Abra https://github.com/settings/tokens
2. **Generate new token (classic)**
3. Scopes: marque `repo` (full) e (em alguns GitHub) `workflow` ou `actions:read`
4. Copie o token (ex: `ghp_xxxxxxxxxxxxxxxxxxxx`)

### 2.2 Instalar dependências

```bash
cd /mnt/c/Users/paiva/OneDrive/Documentos/Github/ponderada_cicd_work/analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2.3 Rodar coleta

```bash
export GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
export REPO=lucasbrasil9/ponderada_bdd_integracao
export WORKFLOW_FILE=ci.yml
python3 collect_metrics.py --out metrics.csv
```

Esperado: CSV com ~80-200 linhas (16 runs × 3 jobs × ~5 steps).

---

## Passo 3 — Gerar gráficos

```bash
cd /mnt/c/Users/paiva/OneDrive/Documentos/Github/ponderada_cicd_work/analytics
python3 generate_charts.py
ls charts/
```

Esperado: 5 PNGs em `charts/`.

---

## Passo 4 — Relatório

Quando me chamar de volta, eu escrevo `analytics/RELATORIO.md` com:
- Tabela das 16 runs (dados reais)
- Links para cada run no GitHub
- Interpretação dos 5 gráficos
- 8 perguntas da atividade respondidas
- 2+ resultados inesperados
- Hipótese vs Observado
- Limitações

---

## Troubleshooting

**"Actions não rodou"** → Verifique Settings → Actions → General: "Allow all actions and reusable workflows".

**"PAT não funciona"** → Confirme escopo `repo` (full) e que o token não expirou. Classic PAT é mais simples que fine-grained.

**"Rate limit exceeded"** → Aguarde 1h ou use token autenticado (5000 req/h vs 60 req/h).

**"Workflow não encontrado"** → Confirme que fez push do `.github/workflows/ci.yml`.

**"Artifact não baixa"** → Espere a run ficar `completed` (status verde) antes de rodar coleta.

---

## Dúvidas?

Se algo travar, me chame e eu te ajudo no comando exato.
