const { INTEGRATION_CONTRACT } = require("../contracts/integrationContract");
const { IntegrationError, ERROR_CODES } = require("../errors/integrationError");
const { validatePayload } = require("../quality/qualityGates");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createId(prefix, counter) {
  const numeric = String(counter).padStart(4, "0");
  return `${prefix}-${numeric}`;
}

function buildEnvelope(operation, payload) {
  return {
    operation,
    protocol: INTEGRATION_CONTRACT.protocol,
    apiVersion: INTEGRATION_CONTRACT.apiVersion,
    integrationVersion: INTEGRATION_CONTRACT.integrationVersion,
    payload
  };
}

function createSimulatedServices(config = {}) {
  const uploadDelayMs = Number(config.uploadDelayMs ?? 120);
  const processingDelayMs = Number(config.processingDelayMs ?? 1500);
  const resultDelayMs = Number(config.resultDelayMs ?? 80);

  let fileCounter = 1;
  let processCounter = 1;
  const processStore = new Map();

  async function upload(message) {
    validatePayload(
      message.payload,
      INTEGRATION_CONTRACT.operations.uploadRequest.requiredFields,
      INTEGRATION_CONTRACT.operations.uploadRequest.operation
    );

    await wait(uploadDelayMs);
    const arquivoId = createId("arquivo", fileCounter++);
    const processoId = createId("processo", processCounter++);

    processStore.set(processoId, {
      arquivoId,
      createdAt: Date.now(),
      readyAt: Date.now() + processingDelayMs,
      status: "PROCESSING"
    });

    return buildEnvelope(INTEGRATION_CONTRACT.operations.uploadResponse.operation, {
      arquivoId,
      processoId,
      status: "PROCESSING"
    });
  }

  async function getStatus(message) {
    validatePayload(
      message.payload,
      INTEGRATION_CONTRACT.operations.statusRequest.requiredFields,
      INTEGRATION_CONTRACT.operations.statusRequest.operation
    );

    const processRecord = processStore.get(message.payload.processoId);
    if (!processRecord) {
      throw new IntegrationError(
        ERROR_CODES.PROCESS_NOT_FOUND,
        `Process ${message.payload.processoId} was not found.`,
        { processoId: message.payload.processoId }
      );
    }

    if (Date.now() >= processRecord.readyAt) {
      processRecord.status = "COMPLETED";
    }

    await wait(10);
    return buildEnvelope(INTEGRATION_CONTRACT.operations.statusResponse.operation, {
      processoId: message.payload.processoId,
      status: processRecord.status
    });
  }

  async function getResult(message) {
    validatePayload(
      message.payload,
      INTEGRATION_CONTRACT.operations.resultRequest.requiredFields,
      INTEGRATION_CONTRACT.operations.resultRequest.operation
    );

    const processRecord = processStore.get(message.payload.processoId);
    if (!processRecord) {
      throw new IntegrationError(
        ERROR_CODES.PROCESS_NOT_FOUND,
        `Result could not be fetched because process ${message.payload.processoId} does not exist.`,
        { processoId: message.payload.processoId }
      );
    }

    if (processRecord.status !== "COMPLETED") {
      throw new IntegrationError(
        ERROR_CODES.PROCESS_TIMEOUT,
        `Result for process ${message.payload.processoId} is not ready yet.`,
        { processoId: message.payload.processoId, status: processRecord.status }
      );
    }

    await wait(resultDelayMs);
    return buildEnvelope(INTEGRATION_CONTRACT.operations.resultResponse.operation, {
      processoId: message.payload.processoId,
      arquivoId: processRecord.arquivoId,
      auditoria: {
        status: "OK",
        inconsistencias: 0
      }
    });
  }

  return {
    uploadService: { upload },
    processingService: { getStatus },
    resultService: { getResult }
  };
}

module.exports = {
  createSimulatedServices
};
