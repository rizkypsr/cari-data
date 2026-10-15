import { cek } from '../lib/core.js'

export default async function handler(req, res) {
  const r = await cek(req.query.nama)
  res.status(r.status).json(r.body)
}
