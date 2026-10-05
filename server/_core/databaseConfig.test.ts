import { describe, expect, it } from "vitest";
import { getDatabaseConnectionOptions, parseDatabaseUrl, redactDatabaseError } from "./databaseConfig";

describe("database TLS configuration", () => {
  it("turns Aiven ssl-mode=REQUIRED into verified TLS", () => {
    const options = getDatabaseConnectionOptions(
      "mysql://user:password@example.test:22650/defaultdb?ssl-mode=REQUIRED",
      "",
    );

    expect(options.ssl).toMatchObject({
      rejectUnauthorized: true,
      verifyIdentity: true,
    });
  });

  it("leaves local URLs without an SSL mode unencrypted", () => {
    const options = getDatabaseConnectionOptions("mysql://user:password@127.0.0.1:3306/uptrail", "");
    expect(options.ssl).toBeUndefined();
  });

  it("rejects SSL modes that weaken verification", () => {
    expect(() => parseDatabaseUrl("mysql://user:password@example.test/defaultdb?ssl-mode=DISABLED"))
      .toThrow("ssl-mode must be REQUIRED, VERIFY_CA, or VERIFY_IDENTITY");
  });

  it("accepts an inline CA certificate PEM string for container deployments", () => {
    const pem = "-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJ...\n-----END CERTIFICATE-----";
    const options = getDatabaseConnectionOptions(
      "mysql://user:password@example.test:22650/defaultdb",
      "",
      pem,
    );
    expect(options.ssl).toMatchObject({
      ca: pem,
      rejectUnauthorized: true,
      verifyIdentity: true,
    });
  });

  it("keeps missing-configuration errors readable", () => {
    expect(redactDatabaseError(new Error("DATABASE_URL is required"), ""))
      .toBe("DATABASE_URL is required");
  });
});
