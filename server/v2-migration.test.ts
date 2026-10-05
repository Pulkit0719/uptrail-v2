import { describe, expect, it } from "vitest";
import {
  assertSafeMigrationTarget,
  splitMigrationSql,
  validateAppliedPrefix,
  validateMigrationSql,
  type V2Migration,
} from "../scripts/v2-migration-lib";

const migrations: V2Migration[] = [
  { name: "0000_baseline", file: "0000.sql", timestamp: 1, kind: "baseline", sha256: "a" },
  { name: "0001_auth", file: "0001.sql", timestamp: 2, kind: "sql", sha256: "b" },
];

describe("guarded v2 migration safeguards", () => {
  it("requires parsed, expected, and live database names to match", () => {
    expect(() => assertSafeMigrationTarget("dryrun", "dryrun", "dryrun")).not.toThrow();
    expect(() => assertSafeMigrationTarget("other", "dryrun", "dryrun")).toThrow();
    expect(() => assertSafeMigrationTarget("dryrun", "dryrun", "other")).toThrow();
    expect(() => assertSafeMigrationTarget("defaultdb", "defaultdb", "defaultdb")).toThrow(/protected/);
    expect(() => assertSafeMigrationTarget("defaultdb", "defaultdb", "defaultdb", true)).not.toThrow();
    expect(() => assertSafeMigrationTarget("other", "defaultdb", "defaultdb", true)).toThrow();
    expect(() => assertSafeMigrationTarget("defaultdb", "defaultdb", "other", true)).toThrow();
  });

  it("allows only CREATE TABLE statements", () => {
    const safe = "CREATE TABLE `one` (`id` int);\n--> statement-breakpoint\nCREATE TABLE `two` (`id` int);";
    expect(splitMigrationSql(safe)).toHaveLength(2);
    expect(validateMigrationSql(safe)).toHaveLength(2);
    expect(() => validateMigrationSql("DROP TABLE users;")).toThrow();
    expect(() => validateMigrationSql("UPDATE `users` SET `role`='admin';")).toThrow();
    expect(() => validateMigrationSql("CREATE TABLE x (id int); DELETE FROM users;")).toThrow();
  });

  it("accepts only a hash- and timestamp-consistent applied prefix", () => {
    expect(() => validateAppliedPrefix(migrations, [{ name: "0000_baseline", hash: "a", createdAt: 1 }])).not.toThrow();
    expect(() => validateAppliedPrefix(migrations, [{ name: "0001_auth", hash: "b", createdAt: 2 }])).toThrow();
    expect(() => validateAppliedPrefix(migrations, [{ name: "0000_baseline", hash: "wrong", createdAt: 1 }])).toThrow();
  });
});
