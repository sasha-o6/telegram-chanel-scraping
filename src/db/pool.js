function createPool(databaseUrl) {
  const { Pool } = require('pg')
  return new Pool({ connectionString: databaseUrl })
}

module.exports = {
  createPool
}
