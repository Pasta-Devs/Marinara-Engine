import type { preValidationHookHandler } from "fastify";

// These two resource endpoints only accept chat identity/roster fields. Transfer
// endpoints retain their own limits and never use this hook or body budget.
export const CHAT_REQUEST_BODY_LIMIT = 1024 * 1024;

export const validateChatRequestBody: preValidationHookHandler = (request, reply, done) => {
  const body = request.body;
  if (body && typeof body === "object" && "characterIds" in body && Array.isArray(body.characterIds)) {
    // Check the element shape before Zod can allocate one issue per invalid ID.
    // There is no roster-count limit; valid IDs still use the existing schema.
    const invalidIndex = body.characterIds.findIndex((id) => typeof id !== "string");
    if (invalidIndex !== -1) {
      return reply.status(400).send({
        error: "Validation Error",
        details: [{ path: `characterIds.${invalidIndex}`, message: "Each character ID must be a string." }],
      });
    }
  }
  done();
};

export const chatResourceRequestOptions = {
  bodyLimit: CHAT_REQUEST_BODY_LIMIT,
  preValidation: validateChatRequestBody,
};
