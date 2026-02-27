import { describe, it, expect } from "vitest";
import {
  LnBotError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} from "../src/index.js";

describe("LnBotError", () => {
  it("stores status and body", () => {
    const err = new LnBotError("fail", 500, "body text");
    expect(err.message).toBe("fail");
    expect(err.status).toBe(500);
    expect(err.body).toBe("body text");
    expect(err.name).toBe("LnBotError");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("BadRequestError", () => {
  it("extracts message from JSON body", () => {
    const err = new BadRequestError(JSON.stringify({ message: "invalid amount" }));
    expect(err.message).toBe("invalid amount");
    expect(err.status).toBe(400);
    expect(err.name).toBe("BadRequestError");
    expect(err).toBeInstanceOf(LnBotError);
  });

  it("extracts error field from JSON body", () => {
    const err = new BadRequestError(JSON.stringify({ error: "bad input" }));
    expect(err.message).toBe("bad input");
  });

  it("falls back when body is not JSON", () => {
    const err = new BadRequestError("not json");
    expect(err.message).toBe("Bad Request");
    expect(err.body).toBe("not json");
  });

  it("falls back when JSON has no message or error field", () => {
    const err = new BadRequestError(JSON.stringify({ detail: "something" }));
    expect(err.message).toBe("Bad Request");
  });
});

describe("UnauthorizedError", () => {
  it("has correct status and fallback", () => {
    const err = new UnauthorizedError("{}");
    expect(err.status).toBe(401);
    expect(err.message).toBe("Unauthorized");
    expect(err.name).toBe("UnauthorizedError");
  });
});

describe("ForbiddenError", () => {
  it("has correct status and fallback", () => {
    const err = new ForbiddenError("{}");
    expect(err.status).toBe(403);
    expect(err.message).toBe("Forbidden");
    expect(err.name).toBe("ForbiddenError");
  });
});

describe("NotFoundError", () => {
  it("has correct status and fallback", () => {
    const err = new NotFoundError("{}");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not Found");
    expect(err.name).toBe("NotFoundError");
  });
});

describe("ConflictError", () => {
  it("has correct status and fallback", () => {
    const err = new ConflictError("{}");
    expect(err.status).toBe(409);
    expect(err.message).toBe("Conflict");
    expect(err.name).toBe("ConflictError");
  });
});
