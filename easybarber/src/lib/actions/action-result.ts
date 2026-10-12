import { NoCompanyError, NotAuthenticatedError } from "@/lib/supabase/current-user";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Postgres error codes we want to translate into friendly messages. */
const FRIENDLY_PG_ERRORS: Record<string, string> = {
  "23P01": "Esse horário acabou de deixar de estar disponível para este profissional. Escolha outro horário.",
  "23503": "Um dos dados selecionados não pertence mais à sua barbearia. Atualize a página e tente novamente.",
  "42501": "Você não tem permissão para fazer isso.",
};

/**
 * Wraps a Server Action body so every mutation in this app handles
 * errors the same way: known auth/scoping errors and known Postgres
 * error codes (conflict, cross-company reference, permission denied)
 * become a friendly message instead of a raw stack trace reaching the
 * client.
 */
export async function runAction<T>(
  fn: () => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (error) {
    if (error instanceof NotAuthenticatedError || error instanceof NoCompanyError) {
      return { ok: false, error: error.message };
    }

    if (isPostgrestError(error)) {
      const friendly = FRIENDLY_PG_ERRORS[error.code ?? ""];
      if (friendly) return { ok: false, error: friendly };
      if (error.message?.includes("business hours")) {
        return {
          ok: false,
          error: "A barbearia está fechada nesse horário.",
        };
      }
      if (error.message?.includes("blocked interval")) {
        return {
          ok: false,
          error: "Esse horário está bloqueado para este profissional.",
        };
      }
      return { ok: false, error: error.message };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erro inesperado.",
    };
  }
}

function isPostgrestError(
  error: unknown,
): error is { code?: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  );
}
