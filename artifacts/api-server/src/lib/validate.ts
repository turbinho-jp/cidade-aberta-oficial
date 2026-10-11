/**
 * Validação de entrada sem dependências externas.
 *
 * Uso típico em uma rota:
 *
 *   const body = parseBody(req.body, {
 *     title: text({ min: 5, max: 150 }),
 *     priority: optional(oneOf(["low", "high"] as const)),
 *   });
 *   if (!body.ok) return sendValidationError(res, body.errors);
 *   body.value.title // string
 *
 * Campos que não estão no schema são descartados (evita mass assignment).
 */
import type { Response } from "express";

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface Field<T> {
  /** true quando o campo pode ser omitido (ver `optional`). */
  optional: boolean;
  parse(value: unknown): FieldResult<T>;
}

const ok = <T>(value: T): FieldResult<T> => ({ ok: true, value });
const fail = (error: string): FieldResult<never> => ({ ok: false, error });

// ---------------------------------------------------------------------------
// Campos
// ---------------------------------------------------------------------------

export function text(opts: { min?: number; max: number; trim?: boolean }): Field<string> {
  const { min = 1, max, trim = true } = opts;
  return {
    optional: false,
    parse(value) {
      if (typeof value !== "string") return fail("deve ser um texto");
      const v = trim ? value.trim() : value;
      if (v.length < min) return fail(min <= 1 ? "não pode ser vazio" : `deve ter no mínimo ${min} caracteres`);
      if (v.length > max) return fail(`deve ter no máximo ${max} caracteres`);
      return ok(v);
    },
  };
}

export function email(): Field<string> {
  const base = text({ min: 3, max: 254 });
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return {
    optional: false,
    parse(value) {
      const r = base.parse(value);
      if (!r.ok) return r;
      const v = r.value.toLowerCase();
      return re.test(v) ? ok(v) : fail("e-mail inválido");
    },
  };
}

/** Número inteiro. Aceita number ou string só com dígitos (ex.: "12"). */
export function int(opts: { min?: number; max?: number } = {}): Field<number> {
  const { min = 1, max = 2_147_483_647 } = opts;
  return {
    optional: false,
    parse(value) {
      let n: number;
      if (typeof value === "number") n = value;
      else if (typeof value === "string" && /^-?\d{1,15}$/.test(value.trim())) n = Number(value.trim());
      else return fail("deve ser um número inteiro");
      if (!Number.isInteger(n)) return fail("deve ser um número inteiro");
      if (n < min || n > max) return fail(`deve estar entre ${min} e ${max}`);
      return ok(n);
    },
  };
}

/** Número finito (aceita decimais). */
export function num(opts: { min: number; max: number }): Field<number> {
  return {
    optional: false,
    parse(value) {
      const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) return fail("deve ser um número");
      if (n < opts.min || n > opts.max) return fail(`deve estar entre ${opts.min} e ${opts.max}`);
      return ok(n);
    },
  };
}

export function oneOf<const T extends readonly string[]>(values: T): Field<T[number]> {
  return {
    optional: false,
    parse(value) {
      if (typeof value === "string" && (values as readonly string[]).includes(value)) {
        return ok(value as T[number]);
      }
      return fail(`deve ser um de: ${values.join(", ")}`);
    },
  };
}

/** Data/hora ISO. Devolve um objeto Date. */
export function isoDate(): Field<Date> {
  return {
    optional: false,
    parse(value) {
      if (typeof value !== "string" || value.length > 40) return fail("deve ser uma data ISO válida");
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? fail("deve ser uma data ISO válida") : ok(d);
    },
  };
}

/** URL http(s) com no máximo 2048 caracteres. */
export function httpUrl(): Field<string> {
  const base = text({ min: 1, max: 2048 });
  return {
    optional: false,
    parse(value) {
      const r = base.parse(value);
      if (!r.ok) return r;
      try {
        const u = new URL(r.value);
        if (u.protocol !== "http:" && u.protocol !== "https:") return fail("deve ser uma URL http(s)");
      } catch {
        return fail("deve ser uma URL válida");
      }
      return ok(r.value);
    },
  };
}

/**
 * Torna o campo opcional: `undefined` (ausente) é aceito e vira `undefined`.
 * Com `blankAsMissing`, texto vazio ("") também conta como ausente
 * (o frontend envia "" em campos de formulário não preenchidos).
 */
export function optional<T>(field: Field<T>, opts: { blankAsMissing?: boolean } = {}): Field<T | undefined> {
  return {
    optional: true,
    parse(value) {
      if (value === undefined) return ok(undefined);
      if (opts.blankAsMissing && typeof value === "string" && value.trim() === "") return ok(undefined);
      return field.parse(value);
    },
  };
}

/** Aceita `null` explícito além do tipo do campo (ex.: limpar um valor). */
export function nullable<T>(field: Field<T>): Field<T | null> {
  return {
    optional: field.optional,
    parse(value) {
      return value === null ? ok(null) : field.parse(value);
    },
  };
}

// ---------------------------------------------------------------------------
// Corpo da requisição
// ---------------------------------------------------------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

type Infer<S extends Record<string, Field<any>>> = {
  [K in keyof S]: S[K] extends Field<infer T> ? T : never;
};

export function parseBody<S extends Record<string, Field<any>>>(body: unknown, schema: S): ParseResult<Infer<S>> {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, errors: { body: "o corpo da requisição deve ser um objeto JSON" } };
  }
  const input = body as Record<string, unknown>;
  const errors: Record<string, string> = {};
  const value: Record<string, unknown> = {};

  for (const key of Object.keys(schema)) {
    const field = schema[key]!;
    const raw = Object.prototype.hasOwnProperty.call(input, key) ? input[key] : undefined;
    if (raw === undefined && !field.optional) {
      errors[key] = "campo obrigatório";
      continue;
    }
    const r = field.parse(raw);
    if (r.ok) {
      if (r.value !== undefined) value[key] = r.value;
    } else {
      errors[key] = r.error;
    }
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value: value as Infer<S> };
}

export function sendValidationError(res: Response, errors: Record<string, string>): void {
  res.status(400).json({ error: "Dados inválidos", details: errors });
}

// ---------------------------------------------------------------------------
// Parâmetros de rota e query string
// ---------------------------------------------------------------------------

/** Id numérico positivo (parâmetro de rota). Devolve `null` se inválido. */
export function parseId(raw: unknown): number | null {
  if (typeof raw !== "string" || !/^\d{1,10}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= 2_147_483_647 ? n : null;
}

export type QueryResult<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/**
 * Valida a query string com o mesmo schema de campos do corpo.
 * Valores repetidos (?a=1&a=2) são rejeitados porque chegam como array.
 */
export function parseQuery<S extends Record<string, Field<any>>>(query: unknown, schema: S): QueryResult<Infer<S>> {
  return parseBody(query ?? {}, schema);
}

/**
 * Campos padrão de paginação: limit (1..maxLimit) e offset (>= 0).
 * Ambos são opcionais; a rota aplica os valores padrão (`value.limit ?? 20`).
 */
export function paginationFields(maxLimit: number) {
  return {
    limit: optional(int({ min: 1, max: maxLimit }), { blankAsMissing: true }),
    offset: optional(int({ min: 0, max: 1_000_000 }), { blankAsMissing: true }),
  };
}

/** Escapa curingas do LIKE/ILIKE para buscas literais. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
