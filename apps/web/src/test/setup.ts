import { config } from "dotenv";

// Tests always run against the isolated test database and settings.
config({ path: ".env.test", override: true });
// Vitest sets NODE_ENV=test itself.
