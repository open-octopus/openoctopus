export class OpenOctopusError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code: string, status = 500, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
  }
}

export class NotFoundError extends OpenOctopusError {
  constructor(resource: string, id: string, options?: ErrorOptions) {
    super(`${resource} not found: ${id}`, "NOT_FOUND", 404, options);
  }
}

export class ValidationError extends OpenOctopusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "VALIDATION_ERROR", 400, options);
  }
}

export class ConflictError extends OpenOctopusError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "CONFLICT", 409, options);
  }
}

export class RealmNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Realm", id);
  }
}

export class EntityNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Entity", id);
  }
}

export class AgentNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Agent", id);
  }
}

export class SkillNotFoundError extends NotFoundError {
  constructor(id: string) {
    super("Skill", id);
  }
}

export function toErrorResponse(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof OpenOctopusError) {
    return { status: err.status, code: err.code, message: err.message };
  }
  // Sanitize unexpected errors to avoid leaking internal details
  return { status: 500, code: "INTERNAL_ERROR", message: "Internal server error" };
}
