const fs = require("fs");
const os = require("os");
const path = require("path");

const { runUploadFiscalFlow } = require("../src/flow/uploadFiscalFlow");
const { ERROR_CODES } = require("../src/errors/integrationError");
const { buildEvidence, saveEvidence } = require("../src/runner/generateEvidence");

describe("Upload fiscal integration flow", () => {
  test("passes happy path with valid contract and SLA", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|"
      },
      {
        simulation: {
          uploadDelayMs: 50,
          processingDelayMs: 250,
          resultDelayMs: 30
        },
        thresholds: {
          maxUploadMs: 2000,
          maxProcessingMs: 10000,
          pollIntervalMs: 50
        }
      }
    );

    expect(result.statusFinal).toBe("PASS");
    expect(result.arquivoId).toBeTruthy();
    expect(result.processoId).toBeTruthy();
    expect(result.resultado).toBeTruthy();
    expect(result.errors).toHaveLength(0);
    expect(result.qualityChecks.every((check) => check.status === "PASS")).toBe(true);
  });

  test("fails with PROCESS_TIMEOUT when processing exceeds SLA", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|"
      },
      {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 1200,
          resultDelayMs: 20
        },
        thresholds: {
          maxUploadMs: 2000,
          maxProcessingMs: 200,
          pollIntervalMs: 30
        }
      }
    );

    expect(result.statusFinal).toBe("FAIL");
    expect(result.errors[0].code).toBe(ERROR_CODES.PROCESS_TIMEOUT);
  });

  test("fails with INVALID_PROTOCOL when protocol differs from contract", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|",
        protocol: "gRPC"
      },
      {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 100,
          resultDelayMs: 20
        }
      }
    );

    expect(result.statusFinal).toBe("FAIL");
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_PROTOCOL);
  });

  test("fails with VERSION_MISMATCH when apiVersion differs from contract", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|",
        apiVersion: "v2"
      },
      {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 100,
          resultDelayMs: 20
        }
      }
    );

    expect(result.statusFinal).toBe("FAIL");
    expect(result.errors[0].code).toBe(ERROR_CODES.VERSION_MISMATCH);
  });

  test("fails with INVALID_PAYLOAD when required payload is missing", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: ""
      },
      {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 100,
          resultDelayMs: 20
        }
      }
    );

    expect(result.statusFinal).toBe("FAIL");
    expect(result.errors[0].code).toBe(ERROR_CODES.INVALID_PAYLOAD);
  });

  test("fails with PROCESS_NOT_FOUND when process id is forced to unknown", async () => {
    const result = await runUploadFiscalFlow(
      {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|"
      },
      {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 80,
          resultDelayMs: 20
        },
        overrides: {
          forceUnknownProcessId: true
        }
      }
    );

    expect(result.statusFinal).toBe("FAIL");
    expect(result.errors[0].code).toBe(ERROR_CODES.PROCESS_NOT_FOUND);
  });

  test("builds and saves evidence json", async () => {
    const evidence = await buildEvidence({
      flowInput: {
        tenantId: "acme",
        fileName: "sped.txt",
        content: "|0000|sample|"
      },
      flowOptions: {
        simulation: {
          uploadDelayMs: 20,
          processingDelayMs: 100,
          resultDelayMs: 20
        },
        thresholds: {
          maxUploadMs: 2000,
          maxProcessingMs: 10000,
          pollIntervalMs: 30
        }
      }
    });

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ponderada-evidence-"));
    const savedPath = saveEvidence(evidence, { outputDir: tempDir });
    const savedData = JSON.parse(fs.readFileSync(savedPath, "utf8"));

    expect(fs.existsSync(savedPath)).toBe(true);
    expect(savedData.integration).toBe("upload-fiscal-flow");
    expect(savedData.execution.statusFinal).toBe("PASS");
  });

  test("recovery A: temporarily failing test", () => {
    expect(true).toBe(false);
  });
});
