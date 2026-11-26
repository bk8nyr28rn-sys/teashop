/** Load .env.local (then .env) for CLI scripts; Next.js does this itself for the app. */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file missing — fine
  }
}
