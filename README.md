# Cek Anggota
1. `npm install`
2. Salin `.env.example` -> `.env`, isi ADMIN_PASSWORD (atau set sebagai environment variable di hosting)
3. Uji lokal: `npm run dev` (buka http://localhost:5173, admin di /admin)
4. Produksi: `npm run build` lalu `npm start` (http://localhost:3000, admin di /admin)
Hosting harus mendukung Node.js + disk persisten (VPS, Railway, Render+Disk). Arahkan DATA_DIR ke disk tersebut.
