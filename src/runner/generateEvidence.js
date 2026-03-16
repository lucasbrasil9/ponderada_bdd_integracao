const fs = require("fs");
const path = require("path");

const { INTEGRATION_CONTRACT } = require("../contracts/integrationContract");
const { runUploadFiscalFlow } = require("../flow/uploadFiscalFlow");

function ensureDirectoryExists(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true });
  }
}

async function buildEvidence(options = {}) {
  const flowInput = options.flowInput || {
    tenantId: "empresa-demo",
    fileName: "sped-fiscal.txt",
    content: "|0000|DEMO|"
  };

  const flowOptions = options.flowOptions || {
    thresholds: {
      maxUploadMs: 2000,
      maxProcessingMs: 10000,
      pollIntervalMs: 100
    }
  };

  const execution = await runUploadFiscalFlow(flowInput, flowOptions);

  return {
    integration: INTEGRATION_CONTRACT.integrationName,
    generatedAt: new Date().toISOString(),
    contract: {
      protocol: INTEGRATION_CONTRACT.protocol,
      apiVersion: INTEGRATION_CONTRACT.apiVersion,
      integrationVersion: INTEGRATION_CONTRACT.integrationVersion
    },
    execution
  };
}

function saveEvidence(evidence, options = {}) {
  const outputDir = options.outputDir || path.resolve(process.cwd(), "reports", "evidence");
  const filePrefix = options.filePrefix || "upload-fiscal-flow";
  ensureDirectoryExists(outputDir);

  const filePath = path.join(outputDir, `${filePrefix}_${Date.now()}.json`);
  fs.writeFileSync(filePath, JSON.stringify(evidence, null, 2), "utf8");
  return filePath;
}

async function runFromCli() {
  const evidence = await buildEvidence();
  const filePath = saveEvidence(evidence);
  const status = evidence.execution.statusFinal;

  console.log("--- [UPLOAD FISCAL INTEGRATION EVIDENCE] ---");
  console.log(`Status: ${status}`);
  console.log(`Evidence file: ${filePath}`);
  console.log("--- [END] ---");

  process.exit(status === "PASS" ? 0 : 1);
}

if (require.main === module) {
  runFromCli().catch((error) => {
    console.error("Evidence generation failed:", error.message);
    process.exit(1);
  });
}

module.exports = {
  buildEvidence,
  saveEvidence
};
