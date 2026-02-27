function extractMessage(body: string, fallback: string): string {
  try {
    const data = JSON.parse(body);
    return data?.message || data?.error || fallback;
  } catch {
    return fallback;
  }
}

export class LnBotError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: string,
  ) {
    super(message);
    this.name = "LnBotError";
  }
}

export class BadRequestError extends LnBotError {
  constructor(body: string) {
    super(extractMessage(body, "Bad Request"), 400, body);
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends LnBotError {
  constructor(body: string) {
    super(extractMessage(body, "Unauthorized"), 401, body);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends LnBotError {
  constructor(body: string) {
    super(extractMessage(body, "Forbidden"), 403, body);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends LnBotError {
  constructor(body: string) {
    super(extractMessage(body, "Not Found"), 404, body);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends LnBotError {
  constructor(body: string) {
    super(extractMessage(body, "Conflict"), 409, body);
    this.name = "ConflictError";
  }
}
