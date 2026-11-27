// Vercel runs the `vercel-build` script instead of `build` when it exists.
//
// Migrations run automatically for production deploys. Preview deploys skip
// them unless MIGRATE_ON_PREVIEW=true — only set that when previews use their
// own database branch (e.g. Neon's Vercel integration), never the production DB.
import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV ?? "local";
const migrate = env === "production" || process.env.MIGRATE_ON_PREVIEW === "true";

if (migrate) {
  console.log(`[vercel-build] ${env}: applying database migrations`);
  execSync("npx drizzle-kit migrate", { stdio: "inherit" });
} else {
  console.log(`[vercel-build] ${env}: skipping migrations`);
}
execSync("npx next build", { stdio: "inherit" });
