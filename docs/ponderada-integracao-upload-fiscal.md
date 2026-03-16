# Ponderada - Integracao como Codigo (Fluxo Upload Fiscal)

## Objetivo da entrega
Implementar e documentar um fluxo de integracao como codigo que cubra:
1. Estrutura de integracao com camadas, modulos, componentes, servicos, hardware, software e processos.
2. Controle de qualidade codificado com tempos, protocolos, versoes e tratamento de excecoes.

## 1) Estrutura de integracao

### Camadas
- Camada de invocacao: comandos npm para executar testes e gerar evidencia.
- Camada de orquestracao: fluxo `upload -> polling de status -> resultado`.
- Camada de servicos simulados: upload, processamento e resultado.
- Camada de qualidade: validacao de contrato, SLA e erros padronizados.
- Camada de evidencia: geracao de JSON para auditoria da execucao.

### Modulos e componentes
- `src/contracts/integrationContract.js`: contrato de protocolo e versoes.
- `src/flow/uploadFiscalFlow.js`: orquestrador do fluxo ponta a ponta.
- `src/services/simulatedServices.js`: componentes `UploadService`, `ProcessingService`, `ResultService`.
- `src/quality/qualityGates.js`: regras de qualidade e validacao de SLA.
- `src/errors/integrationError.js`: tipos de erro padronizados.
- `src/runner/generateEvidence.js`: consolida evidencias em arquivo JSON.

### Servicos
- UploadService: recebe arquivo fiscal e retorna `arquivoId` e `processoId`.
- ProcessingService: simula processamento assincrono consultavel por polling.
- ResultService: devolve resultado consolidado da auditoria.

### Hardware, software e processos
- Hardware: maquina local de desenvolvimento.
- Software: Node.js + Jest.
- Processo operacional:
  1. Cliente envia upload fiscal.
  2. Sistema retorna ids de rastreabilidade.
  3. Cliente consulta status ate `COMPLETED`.
  4. Cliente consulta resultado final.

## 2) Controle de qualidade da integracao

### Tempos (SLA)
- Upload: `<= 2000 ms`.
- Processamento: `<= 10000 ms`.
- Violacao de SLA gera excecao `PROCESS_TIMEOUT`.

### Protocolo
- Protocolo esperado: `HTTP/1.1` (contrato interno simulado).
- Operacoes obrigatorias:
  - `upload.request` / `upload.response`
  - `status.request` / `status.response`
  - `result.request` / `result.response`
- Divergencias de protocolo ou operacao geram `INVALID_PROTOCOL`.

### Versoes
- `apiVersion` esperada: `v1`.
- `integrationVersion` esperada: `1.0.0`.
- Divergencia gera `VERSION_MISMATCH`.

### Tratamento de excecoes
- `INVALID_PAYLOAD`: payload incompleto ou invalido.
- `VERSION_MISMATCH`: versao de contrato incompativel.
- `PROCESS_TIMEOUT`: processamento fora do SLA.
- `PROCESS_NOT_FOUND`: processo inexistente.
- `INVALID_PROTOCOL`: operacao/protocolo fora do contrato.

## Execucao

```bash
npm install
npm test
npm run integration:evidence
```

## Evidencias geradas
- `reports/evidence/upload-fiscal-flow_<timestamp>.json`
- Campos principais:
  - `contract`: protocolo e versoes esperadas.
  - `execution.statusFinal`: PASS/FAIL.
  - `execution.timings`: tempos medidos.
  - `execution.qualityChecks`: validacoes realizadas.
  - `execution.errors`: excecoes capturadas.
