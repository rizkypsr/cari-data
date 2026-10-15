import './style.css'

const $ = (id) => document.getElementById(id)
const login = $('login'), pw = $('pw'), loginBtn = $('loginBtn')
const form = $('form'), file = $('file'), btn = $('btn'), hasil = $('hasil'), info = $('info')

const fmt = (d) => d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' }) : '-'
const box = (cls, small, strong, p = '') =>
  `<div class="result ${cls}"><small>${small}</small><strong>${strong}</strong>${p ? `<p>${p}</p>` : ''}</div>`

// fetch yang selalu menyertakan password & membaca JSON dengan aman
async function api(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...opts.headers, 'x-admin-password': sessionStorage.getItem('pw') || '' } })
  const text = await res.text()
  let data = {}
  try { data = JSON.parse(text) } catch {}
  return { res, data }
}

function showPanel(s) {
  login.hidden = true; form.hidden = false; info.hidden = false
  info.innerHTML = `Data saat ini: <b>${s.total} anggota</b> · diperbarui ${fmt(s.updated)}`
}
function showLogin(msg) {
  sessionStorage.removeItem('pw')
  login.hidden = false; form.hidden = true; info.hidden = true
  hasil.innerHTML = msg ? box('no', 'GAGAL', msg) : ''
}

// masuk otomatis jika password tersimpan di sesi tab ini
if (sessionStorage.getItem('pw')) {
  api('/api/status').then(({ res, data }) => (res.ok ? showPanel(data) : showLogin()))
}

login.addEventListener('submit', async (e) => {
  e.preventDefault()
  loginBtn.disabled = true; loginBtn.textContent = 'MEMERIKSA…'
  sessionStorage.setItem('pw', pw.value)
  try {
    const { res, data } = await api('/api/status')
    if (res.ok) { pw.value = ''; hasil.innerHTML = ''; showPanel(data) }
    else showLogin(data.error || `Server tidak merespons (kode ${res.status}). Pastikan server Node berjalan.`)
  } catch {
    showLogin('Server tidak dapat dihubungi.')
  }
  loginBtn.disabled = false; loginBtn.textContent = 'MASUK →'
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const f = file.files[0]
  if (!f) return
  btn.disabled = true; btn.textContent = 'MENGUNGGAH…'
  try {
    const { res, data } = await api('/api/upload', { method: 'POST', body: f })
    if (res.status === 401) return showLogin('Sesi berakhir, masukkan password lagi.')
    if (!res.ok || !data.total) {
      throw new Error(data.error || (res.status === 413
        ? 'File terlalu besar untuk server.'
        : `Server tidak merespons dengan benar (kode ${res.status}). Pastikan server Node berjalan.`))
    }
    showPanel(data)
    hasil.innerHTML = box('ok', 'BERHASIL', `${data.total} anggota tersimpan`, 'Data sudah aktif di halaman pengecekan.')
    form.reset()
  } catch (err) {
    hasil.innerHTML = box('no', 'GAGAL', err.message || 'Terjadi kesalahan')
  } finally {
    btn.disabled = false; btn.textContent = 'UNGGAH & GANTI DATA →'
  }
})
