const { INTEGRATION_CONTRACT } = require("../contracts/integrationContract");
const { IntegrationError, ERROR_CODES } = require("../errors/integrationError");

function buildCheck(name, expected, observed, passed) {
  return {
    name,
    expected,
    observed,
    status: passed ? "PASS" : "FAIL"
  };
}

function assertEnvelope(message, expectedOperation, contract = INTEGRATION_CONTRACT) {
  const protocolOk = message.protocol === contract.protocol;
  if (!protocolOk) {
    throw new IntegrationError(
      ERROR_CODES.INVALID_PROTOCOL,
      `Protocol mismatch. Expected ${contract.protocol}, received ${message.protocol}.`,
      { expected: contract.protocol, observed: message.protocol, operation: expectedOperation }
    );
  }

  const operationOk = message.operation === expectedOperation;
  if (!operationOk) {
    throw new IntegrationError(
      ERROR_CODES.INVALID_PROTOCOL,
      `Operation mismatch. Expected ${expectedOperation}, received ${message.operation}.`,
      { expected: expectedOperation, observed: message.operation }
    );
  }

  const apiVersionOk = message.apiVersion === contract.apiVersion;
  const integrationVersionOk = message.integrationVersion === contract.integrationVersion;
  if (!apiVersionOk || !integrationVersionOk) {
    throw new IntegrationError(
      ERROR_CODES.VERSION_MISMATCH,
      "Version mismatch between message and contract.",
      {
        expectedApiVersion: contract.apiVersion,
        observedApiVersion: message.apiVersion,
        expectedIntegrationVersion: contract.integrationVersion,
        observedIntegrationVersion: message.integrationVersion
      }
    );
  }

  return [
    buildCheck("protocol", contract.protocol, message.protocol, true),
    buildCheck("operation", expectedOperation, message.operation, true),
    buildCheck("versions", `${contract.apiVersion}/${contract.integrationVersion}`, `${message.apiVersion}/${message.integrationVersion}`, true)
  ];
}

function validatePayload(payload, requiredFields, operationLabel) {
  const missingFields = requiredFields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });

  if (missingFields.length > 0) {
    throw new IntegrationError(
      ERROR_CODES.INVALID_PAYLOAD,
      `Invalid payload for operation ${operationLabel}.`,
      { operation: operationLabel, missingFields }
    );
  }

  return [
    buildCheck(
      `payload:${operationLabel}`,
      requiredFields.join(","),
      "all-required-fields-present",
      true
    )
  ];
}

function enforceSla(timings, thresholds) {
  const maxUploadMs = Number(thresholds.maxUploadMs);
  const maxProcessingMs = Number(thresholds.maxProcessingMs);

  const uploadOk = timings.uploadMs <= maxUploadMs;
  const processingOk = timings.processingMs <= maxProcessingMs;

  if (!uploadOk || !processingOk) {
    throw new IntegrationError(
      ERROR_CODES.PROCESS_TIMEOUT,
      "SLA exceeded for upload fiscal integration flow.",
      {
        maxUploadMs,
        observedUploadMs: timings.uploadMs,
        maxProcessingMs,
        observedProcessingMs: timings.processingMs
      }
    );
  }

  return [
    buildCheck("timing:upload", `<=${maxUploadMs}`, timings.uploadMs, true),
    buildCheck("timing:processing", `<=${maxProcessingMs}`, timings.processingMs, true)
  ];
}

module.exports = {
  assertEnvelope,
  validatePayload,
  enforceSla
};
