const INTEGRATION_CONTRACT = Object.freeze({
  integrationName: "upload-fiscal-flow",
  integrationVersion: "1.0.0",
  apiVersion: "v1",
  protocol: "HTTP/1.1",
  operations: Object.freeze({
    uploadRequest: Object.freeze({
      operation: "upload.request",
      requiredFields: ["tenantId", "fileName", "content"]
    }),
    uploadResponse: Object.freeze({
      operation: "upload.response",
      requiredFields: ["arquivoId", "processoId", "status"]
    }),
    statusRequest: Object.freeze({
      operation: "status.request",
      requiredFields: ["processoId"]
    }),
    statusResponse: Object.freeze({
      operation: "status.response",
      requiredFields: ["processoId", "status"]
    }),
    resultRequest: Object.freeze({
      operation: "result.request",
      requiredFields: ["processoId"]
    }),
    resultResponse: Object.freeze({
      operation: "result.response",
      requiredFields: ["processoId", "arquivoId", "auditoria"]
    })
  })
});

module.exports = {
  INTEGRATION_CONTRACT
};
