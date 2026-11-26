# Plan: web-new-2 — i18n, Admin Users, Admin Workspaces, OIDC

Status: Fase 0 sampai 3 selesai (belum di-commit). Fase 4 (OIDC browser) dihapus dari scope. Fase 5 belum selesai, menunggu persetujuan perubahan dokumentasi API.
Target: `cloud/web-new-2` (portal baru). Referensi: `cloud/web` (portal existing).

## 1. Ruang lingkup

Empat bagian, dikerjakan berurutan:

1. **i18n (Bahasa Inggris dan Indonesia)**: pemilih bahasa dan terjemahan untuk teks yang sudah ada di web-new-2.
2. **Admin Users**: daftar user, undangan user, dan pengelolaan role user. Khusus admin.
3. **Admin Workspaces**: daftar semua workspace untuk admin, dan membuka workspace tersebut.
4. ~~**OIDC (SSO)**~~: dihapus dari scope. StitchKit dan DBDesign akan masuk ke satu aplikasi web, sehingga halaman `/oidc/authorize` dan `/oidc/logout` tidak diperlukan. Signing key OIDC di server tetap dipakai untuk token service.

Di luar scope plan ini: Project (planning), Design (Stitchkit, DBDesign), detail commit dan diff di History, dan realtime. Itu dibahas terpisah.

## 2. Keputusan yang perlu kamu konfirmasi

| # | Pertanyaan | Usulan saya |
|---|---|---|
| D1 | "language ... 8N" saya artikan sebagai pemilih bahasa EN/ID. Benar? | Ya, pemilih bahasa di header/sidebar, disimpan di localStorage. |
| D2 | Locale dari `cloud/web` dipakai ulang bagaimana? README web-new-2 melarang import dari `web` dan `server`. | Salin file JSON locale ke `web-new-2/src/locales/`, dan pakai test yang sama dengan `web` untuk menjaga kunci EN dan ID tetap sama. Penyatuan ke package bersama ditunda. |
| D3 | Admin workspaces: server hanya punya `GET /api/admin/workspaces` (cari dan halaman). Tombol "buka" di `web` hanya navigasi. | Tidak ada perubahan server. Buka workspace = pindah ke workspace view di web-new-2 sebagai read-only. |
| D4 | Admin Users: `web` mendukung kelola role master (buat dan hapus role), ubah role user, undang user, dan batalkan undangan. | Semua ikut dipindah. Tidak ada endpoint baru. |
| D5 | OIDC: `/oidc/authorize` dan `/oidc/logout` perlu routing path di web-new-2. Sekarang web-new-2 hanya satu halaman dengan state tab. | Tambah deteksi path di entry (seperti `isOidcAuthorizeRoute` di `web`), tanpa router baru. |

## 3. Fase kerja

### Fase 0 — Persiapan (SELESAI)
- [x] Branch `feat/web-new-2-i18n-admin-oidc` dari `main` (9deade7). Perubahan lain di working tree di `cloud/web` tidak disentuh.
- [x] Baseline `typecheck`, `test`, `build` lolos sebelum mulai.
- [x] Baca `DESIGN_RULES.md` dan `ui-rules.test.ts`.
- [x] Context7 untuk `react-i18next` dan `i18next-browser-languagedetector` (`/websites/react_i18next`, `/i18next/i18next`).

### Fase 1 — i18n (SELESAI, belum di-commit)
- [x] Dependensi `i18next@^26.5.11`, `react-i18next@^17.1.9`, `i18next-browser-languagedetector@^8.2.3`. Versi sama dengan `web`.
- [x] Modul `src/shared/i18n/index.ts`: detector localStorage lalu navigator, fallback `en`, `document.documentElement.lang` ikut bahasa.
- [x] Locale EN dan ID di `src/shared/i18n/locales/{en,id}/portal.json` (355 key, satu namespace `portal`).
- [x] Pemilih bahasa `LanguageSelect` di halaman login dan di menu akun sidebar.
- [x] Semua teks UI di view portal diganti `t()`. Teks sample API di `collections-preview.data.ts` dan prompt agen di `mcp-setup-prompt.ts` tetap bahasa Inggris, karena itu konten data dan instruksi untuk agen.
- [x] Test: kesamaan key EN dan ID, tidak ada nilai kosong, semua key yang dipakai kode ada, placeholder interpolasi sama (`src/shared/i18n/i18n.test.ts`).
- [x] Playwright: `tests/i18n.spec.ts` (ganti bahasa, reload, bahasa tetap, `lang` pada `html`).

Deviasi dari D2: locale tidak disalin dari `web`. Kata-kata di `web-new-2` berbeda dari `web`, jadi saya menulis key baru di `portal.json` dengan terjemahan Indonesia sendiri. Tidak ada file dari `web` yang diimpor atau disalin.
Deviasi dari rencana: pemilih bahasa tidak ada di header utama. Ditaruh di halaman login dan di menu akun sidebar.

### Fase 2 — Admin Users
Endpoint yang sudah ada (tidak perlu diubah):
- `GET /api/admin/roles`, `POST /api/admin/roles`, `DELETE /api/admin/roles/:id`
- `GET /api/admin/users` (cari, halaman), `PATCH /api/admin/users/:id` (body: `roles`)
- `GET /api/admin/user-invites`, `POST /api/admin/user-invites` (body: `email`), `DELETE /api/admin/user-invites/:id`

Tugas:
- [ ] Tambah model dan schema zod (salin dari `admin-users/models`), dengan service di `src/features/portal/services/admin-users.service.ts`.
- [ ] Tambah hook `use-admin-users.viewmodel.ts`, pagination dengan cursor seperti di `web` (10 per halaman).
- [x] Tambah tab `admin-users` di `WorkspaceSection` dan di sidebar, di grup "Admin" yang hanya muncul jika `me.isAdmin`.
- [x] View: tabel user (email, role, status), pencarian, dialog ubah role, tabel undangan dengan aksi batal, dan dialog undang user.
- [x] View: bagian kelola role master (daftar, buat, hapus). Hapus memakai konfirmasi.
- [x] Non-admin yang membuka tab ini mendapat state "tidak punya akses", bukan error mentah.
- [x] Tambahan di luar rencana: toggle app admin per akun (server `PATCH /api/admin/users/:id` dengan `isAdmin`, dan checkbox di dialog role). Test server di `server/src/routes/admin-users-status.test.ts`.
- [ ] Test unit: service dan viewmodel. Ditunda atas permintaan user.
- [x] Test Playwright: undang user, ubah role, batal undangan, dan app admin (data sintetis).

### Fase 3 — Admin Workspaces
Endpoint: `GET /api/admin/workspaces?q=&cursor=&limit=`.

- [ ] Service dan model dari `admin-workspaces`, dengan schema zod.
- [ ] Tab `admin-workspaces` di grup "Admin", hanya untuk admin.
- [x] View: tabel workspace (nama, owner, jumlah anggota, tanggal dibuat), pencarian, tombol "Muat lagi". Kolom "role saya" dan jumlah folder/request tidak ditampilkan karena endpoint tidak mengirimnya.
- [x] Aksi "Buka": pindah ke workspace view yang sudah ada. Jika admin bukan anggota workspace, tampilkan notice read-only.
- [ ] Test unit untuk viewmodel. Ditunda atas permintaan user.
- [x] Test Playwright: cari, muat lagi, buka, dan non-admin ditolak.

### Fase 4 — OIDC (SSO): DIHAPUS
Tidak dikerjakan. Halaman authorize dan logout di browser tidak dibuat. Jika nanti ada aplikasi eksternal yang memakai portal sebagai penyedia login, fase ini dibuka lagi sebagai plan baru.

### Fase 5 — Verifikasi dan PR
- [x] Jalankan di web-new-2: `typecheck`, `test`, `build`, `bunx playwright test` (2026-11-26: 27 unit, 20 Playwright, semua lolos).
- [x] Cek layout di 390px dan 1440px lewat Playwright. Pemeriksaan visual manual belum dicatat.
- [x] Server: ada perubahan (app admin toggle). Test di `server/src/routes/admin-users-status.test.ts` lolos di database test terpisah. Suite server penuh punya 3 kegagalan di `sessions.repository` dari perubahan lain yang belum di-commit, bukan dari fase ini.
- [x] Update `README.md` (bagian Scope) dan `VERIFICATION.md` dengan hasil nyata.
- [ ] Satu PR per fase, atau satu PR untuk semua. Ini pilihan kamu (lihat bagian 4).
- [ ] Commit memakai Conventional Commits, tanpa footer generated. Hanya setelah kamu minta push atau PR.

## 4. Pilihan urutan dan PR

Usulan: satu branch, empat commit (satu per fase), lalu satu PR dengan deskripsi per fase. Alternatif: empat PR kecil agar review lebih ringan. Saya condong ke empat PR karena fase 1 (i18n) menyentuh hampir semua view, dan itu akan menyulitkan review fase lain.

Urutan yang saya sarankan: Fase 1 dulu, karena fase 2 sampai 4 memakai teks i18n.

## 5. Risiko

- Fase 1 menyentuh banyak file dan bisa memicu konflik dengan pekerjaan lain di web-new-2. Ambil branch terbaru sebelum mulai.
- Admin Users dan Workspaces butuh akun admin untuk verifikasi nyata. Di test memakai data sintetis.
- Salinan locale (D2) bisa menyimpang dari `web`. Test kesamaan kunci hanya memeriksa struktur, bukan isi.
- Unit test halaman admin ditunda atas permintaan user. Cakupannya Playwright (desktop dan mobile).

## 6. Definisi selesai

- Semua teks di halaman yang tersentuh tampil dalam EN dan ID, dan bahasa tersimpan setelah reload.
- Admin Users dan Admin Workspaces hanya tampil untuk admin, dan semua aksi tulis memakai endpoint yang sudah ada.
- Typecheck, test, build, dan Playwright lolos. README dan VERIFICATION diperbarui sesuai hasil nyata.
