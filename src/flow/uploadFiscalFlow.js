const { INTEGRATION_CONTRACT } = require("../contracts/integrationContract");
const { normalizeIntegrationError, IntegrationError, ERROR_CODES } = require("../errors/integrationError");
const { createSimulatedServices } = require("../services/simulatedServices");
const { assertEnvelope, validatePayload, enforceSla } = require("../quality/qualityGates");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildMessage(operation, payload, input, contract = INTEGRATION_CONTRACT) {
  return {
    operation,
    protocol: input.protocol || contract.protocol,
    apiVersion: input.apiVersion || contract.apiVersion,
    integrationVersion: input.integrationVersion || contract.integrationVersion,
    payload
  };
}

function defaultThresholds(overrides = {}) {
  return {
    maxUploadMs: Number(overrides.maxUploadMs ?? 2000),
    maxProcessingMs: Number(overrides.maxProcessingMs ?? 10000),
    pollIntervalMs: Number(overrides.pollIntervalMs ?? 200)
  };
}

async function runUploadFiscalFlow(input = {}, options = {}) {
  const contract = options.contract || INTEGRATION_CONTRACT;
  const thresholds = defaultThresholds(options.thresholds || {});
  const services = options.services || createSimulatedServices(options.simulation || {});

  const qualityChecks = [];
  const errors = [];
  const timings = {
    uploadMs: null,
    processingMs: null,
    totalMs: null
  };

  const totalStart = Date.now();
  let arquivoId = null;
  let processoId = null;
  let resultado = null;

  try {
    const uploadRequest = buildMessage(
      contract.operations.uploadRequest.operation,
      {
        tenantId: input.tenantId,
        fileName: input.fileName,
        content: input.content
      },
      input,
      contract
    );

    qualityChecks.push(...assertEnvelope(uploadRequest, contract.operations.uploadRequest.operation, contract));
    qualityChecks.push(
      ...validatePayload(
        uploadRequest.payload,
        contract.operations.uploadRequest.requiredFields,
        contract.operations.uploadRequest.operation
      )
    );

    const uploadStart = Date.now();
    const uploadResponse = await services.uploadService.upload(uploadRequest);
    timings.uploadMs = Date.now() - uploadStart;

    qualityChecks.push(...assertEnvelope(uploadResponse, contract.operations.uploadResponse.operation, contract));
    qualityChecks.push(
      ...validatePayload(
        uploadResponse.payload,
        contract.operations.uploadResponse.requiredFields,
        contract.operations.uploadResponse.operation
      )
    );

    arquivoId = uploadResponse.payload.arquivoId;
    processoId = uploadResponse.payload.processoId;

    if (options.overrides && options.overrides.forceUnknownProcessId) {
      processoId = "processo-unknown";
    }

    const processingStart = Date.now();
    let completed = false;
    while (Date.now() - processingStart <= thresholds.maxProcessingMs) {
      const statusRequest = buildMessage(
        contract.operations.statusRequest.operation,
        { processoId },
        input,
        contract
      );

      qualityChecks.push(...assertEnvelope(statusRequest, contract.operations.statusRequest.operation, contract));
      qualityChecks.push(
        ...validatePayload(
          statusRequest.payload,
          contract.operations.statusRequest.requiredFields,
          contract.operations.statusRequest.operation
        )
      );

      const statusResponse = await services.processingService.getStatus(statusRequest);
      qualityChecks.push(...assertEnvelope(statusResponse, contract.operations.statusResponse.operation, contract));
      qualityChecks.push(
        ...validatePayload(
          statusResponse.payload,
          contract.operations.statusResponse.requiredFields,
          contract.operations.statusResponse.operation
        )
      );

      if (statusResponse.payload.status === "COMPLETED") {
        completed = true;
        break;
      }

      await wait(thresholds.pollIntervalMs);
    }

    timings.processingMs = Date.now() - processingStart;

    if (!completed) {
      throw new IntegrationError(
        ERROR_CODES.PROCESS_TIMEOUT,
        "Processing did not complete within the configured SLA window.",
        {
          maxProcessingMs: thresholds.maxProcessingMs,
          observedProcessingMs: timings.processingMs
        }
      );
    }

    const resultRequest = buildMessage(
      contract.operations.resultRequest.operation,
      { processoId },
      input,
      contract
    );

    qualityChecks.push(...assertEnvelope(resultRequest, contract.operations.resultRequest.operation, contract));
    qualityChecks.push(
      ...validatePayload(
        resultRequest.payload,
        contract.operations.resultRequest.requiredFields,
        contract.operations.resultRequest.operation
      )
    );

    const resultResponse = await services.resultService.getResult(resultRequest);
    qualityChecks.push(...assertEnvelope(resultResponse, contract.operations.resultResponse.operation, contract));
    qualityChecks.push(
      ...validatePayload(
        resultResponse.payload,
        contract.operations.resultResponse.requiredFields,
        contract.operations.resultResponse.operation
      )
    );

    resultado = resultResponse.payload;
    qualityChecks.push(...enforceSla(timings, thresholds));

    timings.totalMs = Date.now() - totalStart;
    return {
      statusFinal: "PASS",
      arquivoId,
      processoId,
      resultado,
      timings,
      qualityChecks,
      errors
    };
  } catch (error) {
    timings.totalMs = Date.now() - totalStart;
    const integrationError = normalizeIntegrationError(error);
    errors.push(integrationError.toJSON());

    return {
      statusFinal: "FAIL",
      arquivoId,
      processoId,
      resultado,
      timings,
      qualityChecks,
      errors
    };
  }
}

module.exports = {
  runUploadFiscalFlow
};
