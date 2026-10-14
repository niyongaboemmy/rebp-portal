/**
 * Uniform result for server actions. `error` and field errors are i18n keys
 * ("errors.*" / "validation.*") translated by the client.
 */
export type ActionResult<T = null> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string>;
      meta?: Record<string, unknown>;
    };
