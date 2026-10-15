import * as XLSX from 'xlsx'

// Link Google Sheet diatur lewat environment variable SHEET_URL.
// Data dibaca langsung dari Sheet, jadi perubahan isi Sheet terbaca otomatis.

export const norm = (s) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()

class SheetError extends Error {}

// Ubah link Google Sheets apa pun (edit / share / publish) menjadi link unduh CSV. Hanya host docs.google.com.
export function toCsvUrl(link) {
  let u
  try { u = new URL(String(link ?? '').trim()) } catch { return null }
  if (u.hostname !== 'docs.google.com') return null
  let gid = u.searchParams.get('gid') || (u.hash.match(/gid=(\d+)/) || [])[1]
  if (gid && !/^\d+$/.test(gid)) gid = null
  let m = u.pathname.match(/^\/spreadsheets\/d\/e\/([^/]+)/)
  if (m) {
    const q = new URLSearchParams({ output: 'csv' })
    if (gid) { q.set('gid', gid); q.set('single', 'true') }
    return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?${q}`
  }
  m = u.pathname.match(/^\/spreadsheets\/d\/([^/]+)/)
  if (!m) return null
  const q = new URLSearchParams({ format: 'csv' })
  if (gid) q.set('gid', gid)
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?${q}`
}

async function fetchSheet(link) {
  const url = toCsvUrl(link)
  if (!url) throw new SheetError('Link tidak valid. Tempelkan link Google Sheets (docs.google.com/spreadsheets/...).')
  const res = await fetch(url, { redirect: 'follow' })
  const ct = res.headers.get('content-type') || ''
  if (!res.ok || !ct.includes('csv')) {
    throw new SheetError('Sheet tidak dapat diakses. Atur Bagikan → "Siapa saja yang memiliki link" sebagai Viewer.')
  }
  return res.text()
}

// Baca SEMUA kolom. Kolom nama dicari dari judul berisi "nama" (default: kolom pertama).
// raw:true menjaga teks apa adanya (mis. "007" tidak berubah jadi 7).
export function parse(text) {
  const wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', raw: true })
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '', raw: false, blankrows: false })
  if (!rows.length) return { members: [], labels: [] }
  const head = rows[0].map((c) => String(c).trim())
  let nameCol = head.findIndex((h) => norm(h).includes('nama'))
  const hasHeader = nameCol >= 0
  if (!hasHeader) nameCol = 0
  const width = Math.max(...rows.map((r) => r.length))
  const labels = Array.from({ length: width }, (_, i) => (hasHeader && head[i]) || `Kolom ${i + 1}`)
  const members = rows.slice(hasHeader ? 1 : 0)
    .filter((r) => String(r[nameCol] ?? '').trim())
    .map((r) => {
      const nama = String(r[nameCol]).trim()
      const fields = labels.map((label, i) => ({ label, value: String(r[i] ?? '').trim() })).filter((_, i) => i !== nameCol)
      return { nama, key: norm(nama), fields }
    })
  return { members, labels }
}

// ---- data dari Sheet, cache 15 dtk
let cache = { at: 0, members: [], error: null }
async function getData() {
  if (cache.at && Date.now() - cache.at < 15_000) return cache
  try {
    const { members } = parse(await fetchSheet(process.env.SHEET_URL))
    cache = { at: Date.now(), members, error: null }
  } catch (e) {
    console.error(e)
    // jika gagal tapi data lama ada, tetap pakai data lama dan coba lagi sebentar lagi
    cache = { at: Date.now() - 10_000, members: cache.members, error: e.message }
  }
  return cache
}

export async function cek(nama) {
  const key = norm(Array.isArray(nama) ? nama[0] : nama)
  if (!key) return { status: 400, body: { error: 'Nama kosong' } }
  if (!process.env.SHEET_URL) return { status: 503, body: { error: 'Data anggota belum disiapkan (SHEET_URL belum diatur).' } }
  try {
    const d = await getData()
    if (d.error && !d.members.length) return { status: 502, body: { error: 'Data anggota sedang tidak dapat dibaca. Coba lagi nanti.' } }
    const found = d.members.find((m) => m.key === key)
    if (found) return { status: 200, body: { terdaftar: true, nama: found.nama, fields: found.fields } }
    const words = key.split(' ')
    const mirip = d.members.filter((m) => words.every((w) => m.key.includes(w))).slice(0, 3).map((m) => m.nama)
    return { status: 200, body: { terdaftar: false, mirip } }
  } catch (e) {
    console.error(e)
    return { status: 500, body: { error: 'Terjadi kesalahan server.' } }
  }
}
