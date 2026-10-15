import './style.css'

const $ = (id) => document.getElementById(id)
const form = $('form'), input = $('nama'), btn = $('btn'), hasil = $('hasil')

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const q = input.value.trim()
  if (!q) return
  btn.disabled = true; btn.textContent = 'MENCARI…'
  try {
    const res = await fetch('/api/cek?nama=' + encodeURIComponent(q))
    const r = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(r.error)
    if (r.terdaftar) {
      hasil.innerHTML = `
        <div class="result ok">
          <small>NAMA ANGGOTA</small>
          <strong>${esc(r.nama)}</strong>
          <span class="badge">✔ TERDAFTAR</span>
          ${r.fields?.length ? `<dl class="detail">${r.fields.map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value) || '-'}</dd></div>`).join('')}</dl>` : ''}
        </div>`
    } else {
      hasil.innerHTML = `
        <div class="result no">
          <small>NAMA YANG DICARI</small>
          <strong>${esc(q)}</strong>
          <span class="badge">✖ BELUM TERDAFTAR</span>
          ${r.mirip?.length ? `<p>Mungkin maksud Anda: ${r.mirip.map((s) => `<b>${esc(s)}</b>`).join(', ')}</p>` : ''}
        </div>`
    }
  } catch (err) {
    hasil.innerHTML = `<div class="result no"><strong>${esc(err.message || 'Server tidak dapat dihubungi.')}</strong><p>Coba lagi beberapa saat.</p></div>`
  }
  btn.disabled = false; btn.textContent = 'CEK SEKARANG →'
})
