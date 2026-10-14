/**
 * Expected, user-facing failure. `message` is an i18n key in the "errors" namespace.
 */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string = `errors.${code}`,
    public readonly fieldErrors?: Record<string, string>,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const isAppError = (error: unknown): error is AppError => error instanceof AppError;
