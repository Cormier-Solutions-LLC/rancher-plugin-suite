import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [repo, output] = process.argv.slice(2);
if (!repo || !output) throw new Error('Expected the repository root and fixture output directory');
const root = resolve(repo);
const require = createRequire(resolve(root, 'package.json'));
const { PGlite } = await import(pathToFileURL(require.resolve('@electric-sql/pglite')).href);
const migrations = (await readdir(resolve(root, 'migrations')))
  .filter(name => /^\d+.*\.sql$/.test(name))
  .sort();
if (migrations.length === 0) throw new Error('No migrations found');
const statements = await Promise.all(migrations.map(name => readFile(resolve(root, 'migrations', name), 'utf8')));
const lock = await readFile(resolve(root, 'package-lock.json'));
const hash = createHash('sha256').update(lock).update(process.version);
for (const [index, name] of migrations.entries()) hash.update(name).update(statements[index]);
const key = hash.digest('hex');
const schema = async db => (await db.query(
  "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public' ORDER BY tablename",
)).rows;
const fresh = async () => {
  const db = await PGlite.create();
  try {
    for (const sql of statements) await db.exec(sql);
    return db;
  } catch (error) {
    await db.close();
    throw error;
  }
};

const seed = await fresh();
let contents;
try {
  contents = await seed.dumpDataDir('gzip');
} finally {
  await seed.close();
}
const results = [];
for (const sequence of [['cold', 'snapshot'], ['snapshot', 'cold'], ['cold', 'snapshot']]) {
  const schemas = {};
  for (const variant of sequence) {
    const start = performance.now();
    const db = variant === 'cold' ? await fresh() : await PGlite.create({ loadDataDir: contents });
    try {
      schemas[variant] = await schema(db);
      results.push({ variant, durationMs: Math.round(performance.now() - start) });
    } finally {
      await db.close();
    }
  }
  if (JSON.stringify(schemas.cold) !== JSON.stringify(schemas.snapshot)) throw new Error('PGlite fixture did not preserve the migrated schema');
}
await mkdir(output, { recursive: true });
await writeFile(resolve(output, `${key}.tar.gz`), Buffer.from(await contents.arrayBuffer()));
await writeFile(resolve(output, 'benchmark.json'), JSON.stringify({ key, migrations, results }, null, 2) + '\n');
console.log(JSON.stringify({ key, migrationCount: migrations.length, results }));
