# Uptrail v2 migration lineage

This lineage starts from a verified database imported from the legacy Uptrail
deployment. It does not replace or rewrite the historical `drizzle/` directory
and never changes the authentic `__drizzle_migrations` ledger.

`0000_imported_legacy_baseline.sql` is a verification-only marker. The guarded
runner validates the imported tables and data before recording it in the
separate `__uptrail_v2_migrations` ledger. It does not recreate legacy tables.

`0001_add_independent_auth.sql` adds only the three independent authentication
tables. Run this lineage only through `pnpm db:v2:migrate` with an explicit
environment file, expected database name, and write acknowledgement. Never use
`drizzle-kit push` against an imported database.
