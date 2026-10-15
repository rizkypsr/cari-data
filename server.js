import 'dotenv/config'
import express from 'express'
import path from 'path'
import { fileURLToPath } from 'url'
import { cek } from './lib/core.js'

// Server lokal / VPS. Di Vercel yang dipakai adalah folder api/.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

const app = express()
app.get('/api/cek', async (req, res) => {
  const r = await cek(req.query.nama)
  res.status(r.status).json(r.body)
})
app.use(express.static(path.join(__dirname, 'dist')))
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`))
