import { productionEnvErrors } from "@/lib/env";

export function register() {
  if (process.env.NODE_ENV !== "production") return;
  // `next build` also loads this file; only enforce for a running server.
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const errors = productionEnvErrors(process.env);
  if (errors.length) {
    throw new Error(`Refusing to start: missing or invalid configuration:\n  - ${errors.join("\n  - ")}`);
  }
}
