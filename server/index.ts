import express from 'express'
import { MongoClient } from 'mongodb'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { construirConfig } from './config.ts'
import { createRepo } from './repo.ts'
import { createApp } from './app.ts'

let config: ReturnType<typeof construirConfig>
try {
  config = construirConfig(process.env)
} catch (e) {
  console.error((e as Error).message)
  process.exit(1)
}

const client = await MongoClient.connect(config.mongoUrl)
const repo = createRepo(client.db(config.dbName), config)
await repo.init()
if (!(await repo.tieneCredenciales())) {
  console.error('No hay correo y PIN de la tienda en la base. Define CAJA_EMAIL y CAJA_PIN para guardarlos la primera vez.')
  process.exit(1)
}

const app = createApp({ repo, config })

const dist = fileURLToPath(new URL('../dist', import.meta.url))
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get('/{*ruta}', (req, res) => res.sendFile(dist + '/index.html'))
}

const server = app.listen(config.port, () => console.log(`Fidelhop en ${config.baseUrl} (puerto ${config.port})`))
for (const señal of ['SIGINT', 'SIGTERM']) {
  process.on(señal, () => server.close(() => client.close().then(() => process.exit(0))))
}
