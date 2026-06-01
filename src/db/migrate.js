const fs = require('fs/promises')
const path = require('path')
const { loadEnv } = require('../config/env')
const { createPool } = require('./pool')

async function runMigrations(
  pool,
  migrationsDir = path.join(process.cwd(), 'migrations')
) {
  await pool.query(`
    create table if not exists schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    )
  `)

  const files = (await fs.readdir(migrationsDir))
    .filter(file => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const existing = await pool.query(
      'select filename from schema_migrations where filename = $1',
      [file]
    )

    if (existing.rowCount > 0) continue

    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8')
    const client = await pool.connect()
    try {
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into schema_migrations(filename) values($1)', [
        file
      ])
      await client.query('commit')
    } catch (err) {
      await client.query('rollback')
      throw err
    } finally {
      client.release()
    }
  }
}

async function main() {
  const env = loadEnv(process.env)
  const pool = createPool(env.databaseUrl)
  try {
    await runMigrations(pool)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}

module.exports = {
  runMigrations
}
