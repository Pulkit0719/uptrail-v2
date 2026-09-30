import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../server/db";

const outputArgument = process.argv[2];
if (!outputArgument) throw new Error("Output path is required");
const outputPath = resolve(outputArgument);

const db = await getDb();
if (!db) throw new Error("DATABASE_URL is required");

try {
  const [serverRows] = await db.execute(sql`
    SELECT VERSION() AS version, @@character_set_database AS databaseCharset,
           @@collation_database AS databaseCollation, @@sql_mode AS sqlMode,
           @@sql_require_primary_key AS sqlRequirePrimaryKey,
           @@lower_case_table_names AS lowerCaseTableNames
  `);
  const [tables] = await db.execute(sql`
    SELECT table_name AS tableName, engine, table_collation AS tableCollation,
           auto_increment AS autoIncrement
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const [columns] = await db.execute(sql`
    SELECT table_name AS tableName, ordinal_position AS ordinalPosition,
           column_name AS columnName, column_type AS columnType,
           is_nullable AS isNullable, column_default AS columnDefault,
           extra, character_set_name AS characterSet,
           collation_name AS collation, generation_expression AS generationExpression
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
    ORDER BY table_name, ordinal_position
  `);
  const [indexes] = await db.execute(sql`
    SELECT table_name AS tableName, index_name AS indexName,
           non_unique AS nonUnique, seq_in_index AS sequence,
           column_name AS columnName, sub_part AS subPart, index_type AS indexType
    FROM information_schema.statistics
    WHERE table_schema = DATABASE()
    ORDER BY table_name, index_name, seq_in_index
  `);
  const [foreignKeys] = await db.execute(sql`
    SELECT k.constraint_name AS constraintName, k.table_name AS tableName,
           k.column_name AS columnName, k.referenced_table_name AS referencedTableName,
           k.referenced_column_name AS referencedColumnName,
           r.update_rule AS updateRule, r.delete_rule AS deleteRule
    FROM information_schema.key_column_usage k
    JOIN information_schema.referential_constraints r
      ON r.constraint_schema = k.constraint_schema
     AND r.constraint_name = k.constraint_name
     AND r.table_name = k.table_name
    WHERE k.table_schema = DATABASE() AND k.referenced_table_name IS NOT NULL
    ORDER BY k.table_name, k.constraint_name, k.ordinal_position
  `);
  const [triggers] = await db.execute(sql`
    SELECT trigger_name AS triggerName, event_manipulation AS event,
           event_object_table AS tableName, action_timing AS timing
    FROM information_schema.triggers
    WHERE trigger_schema = DATABASE()
    ORDER BY trigger_name
  `);
  const [routines] = await db.execute(sql`
    SELECT routine_name AS routineName, routine_type AS routineType
    FROM information_schema.routines
    WHERE routine_schema = DATABASE()
    ORDER BY routine_name
  `);
  const [events] = await db.execute(sql`
    SELECT event_name AS eventName, status
    FROM information_schema.events
    WHERE event_schema = DATABASE()
    ORDER BY event_name
  `);

  const snapshot = {
    generatedAt: new Date().toISOString(),
    server: (serverRows as unknown[])[0],
    tables,
    columns,
    indexes,
    foreignKeys,
    triggers,
    routines,
    events,
  };
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, { flag: "wx" });
  console.log(`Schema-only snapshot created: ${outputPath}`);
  console.log(`Tables: ${(tables as unknown[]).length}; columns: ${(columns as unknown[]).length}; indexes: ${(indexes as unknown[]).length}; foreign keys: ${(foreignKeys as unknown[]).length}`);
} finally {
  await closeDb();
}
