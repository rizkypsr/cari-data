import 'dotenv/config'
import express from 'express'
import * as XLSX from 'xlsx'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
const FILE = path.join(DATA_DIR, 'anggota.xlsx')
const PORT = process.env.PORT || 3000
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || ''

if (!ADMIN_PASSWORD) console.warn('PERINGATAN: ADMIN_PASSWORD belum diatur di .env, halaman /admin dikunci.')

const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

// Baca SEMUA kolom. Kolom nama dicari dari judul berisi "nama" (default: kolom pertama).
function parse(buf) {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false })
  if (!rows.length) return []
  const head = rows[0].map((c) => String(c).trim())
  let nameCol = head.findIndex((h) => norm(h).includes('nama'))
  const hasHeader = nameCol >= 0
  if (!hasHeader) nameCol = 0
  const width = Math.max(...rows.map((r) => r.length))
  const labels = Array.from({ length: width }, (_, i) => (hasHeader && head[i]) || `Kolom ${i + 1}`)
  return rows.slice(hasHeader ? 1 : 0)
    .filter((r) => String(r[nameCol] ?? '').trim())
    .map((r) => {
      const nama = String(r[nameCol]).trim()
      const fields = labels
        .map((label, i) => ({ label, value: String(r[i] ?? '').trim() }))
        .filter((_, i) => i !== nameCol)
      return { nama, key: norm(nama), fields }
    })
}

let members = [], updated = null
function load() {
  if (!fs.existsSync(FILE)) return
  members = parse(fs.readFileSync(FILE))
  updated = fs.statSync(FILE).mtime
}
fs.mkdirSync(DATA_DIR, { recursive: true })
load()

// ---- proteksi password admin (dengan pembatasan percobaan salah)
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest()
const fails = new Map()
function auth(req, res, next) {
  if (!ADMIN_PASSWORD) return res.status(503).json({ error: 'ADMIN_PASSWORD belum diatur di file .env' })
  const ip = req.ip
  const f = fails.get(ip)
  if (f && f.until > Date.now()) return res.status(429).json({ error: 'Terlalu banyak percobaan. Coba lagi 1 menit.' })
  if (crypto.timingSafeEqual(sha(req.get('x-admin-password') || ''), sha(ADMIN_PASSWORD))) {
    fails.delete(ip)
    return next()
  }
  const n = (f?.n || 0) + 1
  fails.set(ip, { n, until: n >= 10 ? Date.now() + 60_000 : 0 })
  if (n >= 10) fails.set(ip, { n: 0, until: Date.now() + 60_000 })
  res.status(401).json({ error: 'Password salah.' })
}

const app = express()

app.get('/api/cek', (req, res) => {
  const key = norm(req.query.nama)
  if (!key) return res.status(400).json({ error: 'Nama kosong' })
  const found = members.find((m) => m.key === key)
  if (found) return res.json({ terdaftar: true, nama: found.nama, fields: found.fields })
  const words = key.split(' ')
  const mirip = members.filter((m) => words.every((w) => m.key.includes(w))).slice(0, 3).map((m) => m.nama)
  res.json({ terdaftar: false, mirip })
})

app.post('/api/login', auth, (_req, res) => res.json({ ok: true }))
app.get('/api/status', auth, (_req, res) => res.json({ total: members.length, updated }))

app.post('/api/upload', auth, express.raw({ type: () => true, limit: '20mb' }), (req, res) => {
  try {
    const b = req.body
    const isXlsx = Buffer.isBuffer(b) && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b // zip: PK
    const isXls = Buffer.isBuffer(b) && b.length > 4 && b[0] === 0xd0 && b[1] === 0xcf // OLE
    if (!isXlsx && !isXls) throw new Error('bukan excel')
    const data = parse(b)
    if (!data.length) return res.status(400).json({ error: 'Tidak ada nama ditemukan di file.' })
    fs.writeFileSync(FILE, b)
    members = data
    updated = new Date()
    res.json({ total: members.length, updated })
  } catch {
    res.status(400).json({ error: 'File tidak valid. Gunakan file Excel (.xlsx).' })
  }
})

app.use(express.static(path.join(__dirname, 'dist'), { extensions: ['html'] }))
app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`))
