import { vi } from "vitest";

type Result = { data: unknown; error: unknown };

export interface MockConfig {
  tables?: Record<string, Result>;
  rpcs?: Record<string, Result>;
}

const empty: Result = { data: null, error: null };

// A minimal chainable stand-in for the supabase-js client covering the call
// shapes the API routes use: from(table).select().eq().order()/.maybeSingle()
// and rpc(fn, args). Each from()/rpc() returns a fresh thenable builder so
// Promise.all (metrics route) works without shared state.
export function createSupabaseMock(config: MockConfig = {}) {
  const calls: { kind: "from" | "rpc"; name: string; args?: unknown }[] = [];

  function builder(result: Result) {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "order", "limit", "insert", "upsert", "update", "delete", "filter", "in", "gte", "lte"]) {
      b[m] = vi.fn(chain);
    }
    b.maybeSingle = vi.fn(() => b);
    b.single = vi.fn(() => b);
    // Thenable: awaiting the builder resolves to the configured result.
    b.then = (onF: (r: Result) => unknown, onR?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onF, onR);
    return b;
  }

  const client = {
    calls,
    from(table: string) {
      calls.push({ kind: "from", name: table });
      return builder(config.tables?.[table] ?? empty);
    },
    rpc(fn: string, args?: unknown) {
      calls.push({ kind: "rpc", name: fn, args });
      return builder(config.rpcs?.[fn] ?? empty);
    },
  };

  return client;
}
