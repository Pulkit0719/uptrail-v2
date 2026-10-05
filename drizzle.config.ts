import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { getDatabaseConnectionOptions } from "./server/_core/databaseConfig";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

const connection = getDatabaseConnectionOptions(connectionString);

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: connection.host!,
    port: connection.port,
    user: connection.user,
    password: connection.password,
    database: connection.database!,
    ssl: connection.ssl && typeof connection.ssl === "object"
      ? {
          ca: connection.ssl.ca as string | undefined,
          rejectUnauthorized: true,
        }
      : undefined,
  },
});
