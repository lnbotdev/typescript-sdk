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
    super("Bad Request", 400, body);
    this.name = "BadRequestError";
  }
}

export class NotFoundError extends LnBotError {
  constructor(body: string) {
    super("Not Found", 404, body);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends LnBotError {
  constructor(body: string) {
    super("Conflict", 409, body);
    this.name = "ConflictError";
  }
}
