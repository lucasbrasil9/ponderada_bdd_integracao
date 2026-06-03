# Ponderada CI/CD — Análise de Pipeline no GitHub Actions

Repositório usado para a **ponderada de CI/CD**: instrumentação de pipeline, coleta automatizada de métricas, geração de gráficos e relatório técnico a partir de **16 execuções reais** no GitHub Actions.

> **Atividade:** medir e analisar o comportamento de um pipeline CI/CD a partir de execuções reais, responder 8 perguntas de análise e entregar um relatório com evidências.

---

## Links rápidos

| Recurso | Link |
|---|---|
| Workflow CI | [`.github/workflows/ci.yml`](.github/workflows/ci.yml) |
| Relatório técnico | [`analytics/RELATORIO.md`](analytics/RELATORIO.md) |
| Base de dados (CSV) | [`analytics/metrics.csv`](analytics/metrics.csv) |
| Índice das 16 runs | [`analytics/raw/runs.csv`](analytics/raw/runs.csv) |
| Gráficos (5 PNGs) | [`analytics/charts/`](analytics/charts/) |
| 16 execuções no Actions | [github.com/.../actions](https://github.com/lucasbrasil9/ponderada_bdd integracao/actions) |
| Branch do experimento | [`experimento-cicd`](https://github.com/lucasbrasil9/ponderada_bdd integracao/tree/experimento-cicd) |

---

## Estrutura do repositório

```
ponderada_bdd integracao/                  ← branch experimento-cicd
├── .github/workflows/ci.yml               ← pipeline (3 jobs: install → lint → test)
├── src/math.js                            ← helper usado pelos testes sintéticos
├── tests/
│   ├── uploadFiscalFlow.test.js           ← 7 testes originais
│   ├── synthetic.test.js                  ← 20 testes sintéticos
│   └── slow.test.js                       ← 5 testes com sleep 500ms
├── analytics/
│   ├── collect_metrics.py                 ← script de coleta (GitHub API + artefatos)
│   ├── generate_charts.py                 ← script de geração dos 5 gráficos
│   ├── requirements.txt                   ← deps Python (requests, pandas, matplotlib)
│   ├── metrics.csv                        ← 349 linhas × 18 colunas
│   ├── raw/
│   │   └── runs.csv                       ← índice manual das 16 runs
│   ├── charts/                            ← 5 PNGs
│   │   ├── 01_workflow_duration.png
│   │   ├── 02_jobs_stacked.png
│   │   ├── 03_success_failure.png
│   │   ├── 04_tests_vs_duration.png
│   │   └── 05_step_duration_boxplot.png
│   └── RELATORIO.md                       ← relatório técnico (338 linhas)
└── RUNS.md                                ← guia de execução das 16 runs
```

---

## O que o pipeline faz

Pipeline padrão (versão baseline de 3 jobs sequenciais):

```yaml
install:  checkout → setup-node 20 → cache ~/.npm → npm ci
   ↓
lint:     checkout → setup-node 20 → cache → npm ci → npx eslint .
   ↓
test:     checkout → setup-node 20 → cache → npm ci → jest --json →
          computa test-metrics.json → upload-artifact (test-results)
```

- **`test-metrics.json`** é gerado por step Python (stdlib only) dentro do job `test` e contém `test_count`, `test_failures`, `avg_test_time_ms`.
- Artefato `test-results` é uploaded com `if: always()`, então é baixável mesmo em runs com falha.
- Trigger: `push` em `main` e `experimento-cicd`, `pull_request`, `workflow_dispatch`.

## As 16 variações executadas

| # | Variação | Esperado | Resultado |
|---|---|---|---|
| 1 | baseline (push inicial) | success | success 55s |
| 2 | cache cold (cache deletado manual) | success | success 59s |
| 3 | cache warm (reusa do #2) | success | success 52s |
| 4 | teste quebrado (`expect(1+1).toBe(3)`) | failure | success 55s¹ |
| 5 | lint fail (regra `no-var` ativada) | failure | failure 35s |
| 6 | +5 testes lentos (sleep 500ms) | success | failure 42s² |
| 7 | +20 testes sintéticos | success | failure 35s² |
| 8 | `npm install` em vez de `npm ci` | success | failure 34s² |
| 9 | 1 job só (`all`) | success | failure 22s² |
| 10 | 2 jobs paralelos (install + lint_and_test) | success | failure 17s² |
| 11 | 3 jobs sequenciais (padrão) | success | failure 30s² |
| 12 | ordem invertida (lint → install → test) | success | failure 19s² |
| 13a | recovery A — test break | failure | failure 16s² |
| 13b | recovery A — fix | success | failure 17s² |
| 14a | recovery B — lint fail | failure | failure 22s |
| 14b | recovery B — fix | success | success 60s |

¹ Run marcada como `success` no Actions mas com 1 teste falhando (efeito do `continue-on-error: true`).
² Falha por erro metodológico — ver [`analytics/RELATORIO.md` §5.1](analytics/RELATORIO.md).

---

## Como reproduzir o experimento do zero

### 1. Pré-requisitos

- Conta no GitHub
- Python 3.12+
- PAT (Personal Access Token) com escopos `repo` **e** `workflow`
  - Criar em: <https://github.com/settings/tokens>

### 2. Clonar

```bash
git clone https://github.com/lucasbrasil9/ponderada_bdd integracao.git
cd "ponderada_bdd integracao"
git checkout experimento-cicd
```

### 3. Re-executar as 16 runs

Siga a tabela acima e [`RUNS.md`](RUNS.md) na ordem. Resumo:

- Runs com `commit --allow-empty`: basta commitar vazio e fazer push.
- Runs que mexem em código: edite o arquivo correspondente, commite, push.
- Runs que mexem em `.github/workflows/ci.yml`: precisam de PAT com escopo `workflow`.

### 4. Coletar métricas

```bash
cd analytics
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export GITHUB_TOKEN=ghp_seu_token_aqui
export REPO="lucasbrasil9/ponderada_bdd integracao"
export WORKFLOW_FILE=ci.yml

python3 collect_metrics.py --out metrics.csv
```

Saída esperada: ~350 linhas × 18 colunas em `metrics.csv`.

### 5. Gerar gráficos

```bash
python3 generate_charts.py
ls charts/    # → 5 PNGs
```

### 6. Ler o relatório

Abra [`analytics/RELATORIO.md`](analytics/RELATORIO.md) (338 linhas). Estrutura:

1. Introdução
2. Metodologia
3. Variações executadas
4. Evidências (links das 16 runs)
5. Gráficos (4 obrigatórios + 1 bônus)
6. **5 resultados inesperados** (incluindo o erro metodológico)
7. **Hipótese vs Observado** (7 hipóteses verificadas)
8. **8 perguntas da atividade respondidas**
9. Limitações (8 itens)
10. Como reproduzir
11. Arquivos entregues

---

## Resumo dos achados

- **31% de sucesso** (5/16) — dominado por erro metodológico documentado.
- **Cache economiza ~12%** (7s em 59s), não 30% como hipotetizado.
- **Pipeline com 1-2 jobs é mais rápido** que 3 sequenciais em projeto pequeno (overhead de setup > ganho de paralelismo).
- **`setup-node` é o gargalo invisível** — 4.5s × 3 jobs = 13.5s de overhead cumulativo.
- **`continue-on-error: true` no Jest esconde falhas** — run #4 ficou verde com 1 teste quebrado.
- **Tempo de feedback**: 16-60s, dependendo se a falha é em lint (rápido) ou test (~7s extras).

Detalhes e análise completa em [`analytics/RELATORIO.md`](analytics/RELATORIO.md).

---

## Tecnologias

- **CI/CD:** GitHub Actions, `actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`, `actions/upload-artifact@v4`
- **Testes:** Jest 30 (com reporter `--json --testLocationInResults`)
- **Lint:** ESLint 8 (com regra `no-var` para cenários de falha)
- **Coleta:** Python 3.12 + `requests`, `pandas`, `matplotlib`, `numpy`
- **API consumida:** GitHub REST API v3 (`/repos/{owner}/{repo}/actions/...`)

---

## Licença

ISC (mesma do projeto original).
