const ERROR_CODES = Object.freeze({
  INVALID_PAYLOAD: "INVALID_PAYLOAD",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  PROCESS_TIMEOUT: "PROCESS_TIMEOUT",
  PROCESS_NOT_FOUND: "PROCESS_NOT_FOUND",
  INVALID_PROTOCOL: "INVALID_PROTOCOL"
});

class IntegrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "IntegrationError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp
    };
  }
}

function isIntegrationError(error) {
  return error instanceof IntegrationError;
}

function normalizeIntegrationError(error) {
  if (isIntegrationError(error)) {
    return error;
  }

  return new IntegrationError(
    ERROR_CODES.INVALID_PROTOCOL,
    error && error.message ? error.message : "Unknown integration error.",
    { originalName: error && error.name ? error.name : "UnknownError" }
  );
}

module.exports = {
  ERROR_CODES,
  IntegrationError,
  isIntegrationError,
  normalizeIntegrationError
};
