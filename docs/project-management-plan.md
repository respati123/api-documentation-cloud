# Rencana project management agentic

Dokumen ini menyimpan rencana kerja project management di cloud portal, supaya pekerjaan tidak hilang di antara sesi. Kerjakan satu task sekali jalan, centang task yang selesai, dan tulis catatan singkat di bawahnya kalau ada keputusan baru.

Alur yang sudah berjalan hari ini dijelaskan di `planning-mcp.md`. Dokumen ini menjelaskan apa yang akan ditambah dan dalam urutan apa.

## Tujuan

Setiap anggota tim memakai AI agent miliknya sendiri (Claude Code, Codex, dan lainnya). Agent terhubung ke tools MCP cloud dengan API key pribadi. Izin setiap key dibatasi oleh role anggota di project. Alurnya:

1. PM menulis BRD. Agent PM menyusun PRD dari BRD.
2. Owner, PM, atau tech lead menyetujui PRD.
3. Agent PM memecah PRD menjadi epic dan story. Story memuat flow, acceptance criteria, dan Definition of Done.
4. Semua role yang terlibat bergabung di story. UI/UX mengerjakan desain lebih dulu.
5. Setelah desain disetujui, backend menyusun kontrak API di dokumentasi API workspace, QA menulis test case, lalu frontend dan mobile mengimplementasikan.
6. Frontend memakai test case QA sebagai dasar E2E Playwright.

Prototype yang disetujui: <https://claude.ai/artifact/2XRjdnnYY1XZ1YDDVBjq75>

## Aturan kerja

Setiap task di dokumen ini mengikuti aturan di `cloud/AGENTS.md`, `cloud/web/AGENTS.md`, dan `cloud/server/AGENTS.md`. Ringkasan yang paling sering dilanggar:

- **Git:** mulai dari `main` terbaru, satu branch per topik (`feat/<scope>-<desc>`, `fix/...`), Conventional Commits, satu perubahan logis per commit beserta test-nya. Push, PR, merge, tag, dan deploy hanya kalau diminta.
- **Library:** cek API lewat Context7 sebelum menulis kode yang memanggil library, termasuk Bun, zod, driver PostgreSQL, React, TanStack Query, Base UI, dan @dnd-kit.
- **Server:** TDD wajib. Route memanggil service, service memanggil repository, repository menjalankan SQL. Setiap route workspace memeriksa role di service sebelum membaca atau menulis data. Kode dan pesan error adalah konstanta dengan teks `id` dan `en`. Perubahan skema selalu berupa migration bernomor baru. Migration yang sudah diterapkan tidak diedit.
- **Web:** MVVM per feature. Page tanpa logika, view hanya render, logika di viewmodel. Fetch lewat TanStack Query. View memakai komponen di `src/shared/components/primitives/`, tanpa elemen mentah. Tidak ada teks literal di view: semua lewat constants dan locale `id` dan `en`. Setiap elemen interaktif punya `data-testid`. Import absolut dengan `@/`. Antar feature hanya lewat `@/features/<nama>`.
- **Server dan web dikerjakan paralel.** Setiap perubahan server tetap menjaga perilaku lama, supaya web yang sudah ter-deploy tidak rusak. Web baru memakai field atau endpoint baru setelah server-nya ada di `main`.
- **Cek sebelum push:** `cloud:typecheck`, `cloud:lint`, `cloud:test`, `cloud:build`, `api:typecheck`, dan test server dengan `TEST_DATABASE_URL`. Baca jumlah `skip` di hasil test server.

## Keputusan yang sudah disepakati

| Topik | Keputusan |
|---|---|
| Role | PM, tech lead (baru), UI/UX, backend, frontend, mobile, QA |
| Yang menyetujui | Owner project, PM, atau tech lead. Cukup satu persetujuan |
| Urutan kerja story | UI/UX selalu lebih dulu. Task role lain terkunci sampai desain story disetujui |
| Desain | Lampiran berupa link. Integrasi Stitchkit ditunda |
| Kontrak API | Ditautkan ke request di dokumentasi API workspace, bukan disalin |
| Test case | Teks terstruktur: judul, prasyarat, langkah, hasil yang diharapkan. Dipakai frontend untuk Playwright |
| Project | Satu project per workspace |
| Sprint dan estimasi | Ditunda sampai alur utama berjalan |
| API key MCP | Satu key per member, berlaku di semua workspace tempat member itu anggota |
| Admin aplikasi | Dibuat lewat seeder. Email dan password admin diambil dari env, bukan ditulis di kode |
| Pembuat key | Admin aplikasi membuat key untuk member. Member mengambilnya lewat link klaim, dan admin tidak pernah melihat secret |
| Link klaim | Dikirim lewat email dan juga muncul di notifikasi portal |
| Jumlah key | Satu key aktif per member, dipakai untuk semua agent (Claude Code, Codex, dan lainnya). Membuat key baru mencabut key lama |
| Member tanpa key | Admin melihatnya dari tabel di halaman admin. Tidak ada notifikasi tambahan |
| Member keluar workspace | Key member dicabut otomatis |
| Izin key | Per tool MCP (endpoint), ditentukan oleh role pada key. Role key berlaku sama di semua workspace. Keanggotaan workspace tetap wajib |
| Halaman MCP member | Avatar → Settings → MCP: key milik member, tombol klaim, dan cara setup untuk Claude Code, Codex, dan klien lain. Member tidak membuat key sendiri |
| Task board | Drag-and-drop antar kolom dengan @dnd-kit, plus menu "Pindah ke…". Urutan di dalam kolom ditunda |
| Detail task | Dialog besar di tengah, dua kolom: kiri deskripsi, sub-task, dan komentar; kanan properti |
| Buat task | Lewat dialog saja |
| Isi kartu | Prioritas, assignee, due date, cuplikan deskripsi, role, label story, progres sub-task |
| Filter board | Pencarian, Ditugaskan ke saya, Assignee, Prioritas, Due date |
| Mode view | Board saja |
| Viewer | Hanya lihat |
| Mobile | Tab status, satu kolom sekaligus, pindah status lewat menu kartu |
| Kolom Selesai | Ringkas otomatis, dengan "Tampilkan semua" |

## Kondisi sekarang

Sudah ada di server dan web (lihat migration `0007` sampai `0010` dan `planning-mcp.md`):

- Dokumen BRD dan PRD dengan versi dan status `draft`, `review_pm`, `review_team`, `approved`, `superseded`.
- Epic dan story di `planning_items` dengan status `draft`, `refinement`, `ready`, `in_progress`, `review`, `done`. Story wajib punya epic.
- Peserta story (`planning_participants`), komentar dengan penanda keputusan, dan catatan aktivitas (`planning_events`) yang mencantumkan ID key MCP.
- Task dengan `story_id` dan `published_at`. `story_id` belum dibaca portal.
- Role anggota project di `project_members.discipline`: `backend`, `frontend`, `mobile`, `pm`, `qa`, `ui_ux`, `devops`, `other`. UI-nya sempat dihapus dari Papan tugas.
- 15 tools MCP di `server/src/routes/mcp.ts`, semuanya menerima `workspaceId` kecuali `workspaces_list`.
- Satu key MCP per member, dibuat admin dan diklaim member (`/admin/mcp` dan `/settings/mcp`).

Belum ada: Definition of Done terstruktur, lampiran desain, tautan kontrak API, test case, penguncian task, sub-task, dan halaman portal sesuai prototype.

## Rencana

Setiap tahap punya task server (S) dan web (W). Task di tahap yang sama boleh dikerjakan paralel, dengan syarat web baru memakai data baru setelah task server yang dibutuhkannya selesai.

### Tahap 0 · Rapikan pekerjaan yang ada

- [x] **0.1** Pecah perubahan di branch `feat/project-management-mcp` menjadi commit yang rapi per topik: hapus shadcn dan primitives baru, perbaikan logout, tema dan sidebar, login, overview workspace, detail workspace, dokumentasi API, halaman MCP.
  - Catatan: dipecah per aplikasi (server, panduan, web, dokumen rencana), karena router, kode error, app shell, dan i18n dipakai bersama oleh semua topik.
- [ ] **0.2** Pastikan migration `0007` sampai `0010` belum diterapkan di produksi. Kalau belum, putuskan apakah boleh digabung sebelum merge pertama. Kalau sudah, semua perubahan berikutnya memakai migration baru.
- [ ] **0.3** Perbarui `planning-mcp.md` setiap kali alur berubah.

### Tahap 1 · Role, admin, dan key MCP lintas workspace

Model key berubah dari per workspace menjadi per member. Key lama yang per workspace tetap valid sampai kedaluwarsa atau dicabut, supaya agent yang sudah terhubung tidak putus di tengah jalan.

- [x] **1.1 S** Tambah role `tech_lead` di constraint `project_members.discipline` lewat migration baru. Role ini dipakai untuk persetujuan dan tampilan tim, terpisah dari role key.
  Catatan: migration `0011_tech_lead_discipline.sql`, daftar disiplin disatukan di `PROJECT_DISCIPLINES` (`models/project.ts`), test route pertama untuk projects di `routes/projects.test.ts`, dan helper HTTP bersama di `testing/http.ts`. Web: schema, constants, dan label `Tech lead`.
- [x] **1.2 S** Admin aplikasi: kolom admin di tabel user lewat migration, dan seeder yang membuat atau memperbarui akun admin dari env (misalnya `ADMIN_SEED_EMAIL` dan `ADMIN_SEED_PASSWORD`). Password di-hash dengan argon2id. Seeder aman dijalankan berulang, dan nilai contoh di `.env.example` hanya placeholder. Admin dicek di service, bukan di route.
  Catatan: migration `0012_user_admin.sql`, service `services/admin.ts` (`seedAdmin`, `requireAdmin`), skrip `bun run api:seed-admin`, dan kode error `ADMIN_REQUIRED` serta `ADMIN_SEED_INVALID`. Untuk produksi, jalankan skrip di container API dengan `ADMIN_SEED_EMAIL` dan `ADMIN_SEED_PASSWORD` diberikan saat menjalankan perintah.
- [x] **1.3 S** Model key baru lewat migration: key tanpa `workspace_id`, dengan `user_id` (member yang diwakili, dipakai semua cek MCP), `created_by` (admin), `role` key, daftar tool yang diizinkan, status klaim, kedaluwarsa, dan pencabutan. Hanya boleh ada satu key aktif atau menunggu klaim per member (unique constraint), dan membuat key baru mencabut yang lama. Secret dibuat saat member mengklaim, disimpan sebagai hash, dan tidak pernah ditampilkan ke admin.
  - Catatan: tabel `mcp_keys` di `0013_member_mcp_keys.sql`, dengan unique index satu key terbuka per member. Tabel lama `mcp_api_keys` dibiarkan tapi tidak dibaca lagi (fitur ini belum rilis). Kolom `planning_events.api_key_id` tidak lagi punya foreign key. Key lama per workspace tidak berlaku.
- [x] **1.4 S** Matriks role key → tool MCP default. Admin boleh mempersempit atau menambah tool per key. Test untuk setiap role.
  - Catatan: matriks di `server/src/models/mcp.ts`. PM dapat semua tool. Tech lead dapat tool anggota plus baca perencanaan, draf task, dan komentar. UI/UX, backend, frontend, mobile, dan QA dapat tool anggota saja. Key yang memegang tool `planning_*` bertindak sebagai PM untuk perencanaan, asal member masih anggota workspace itu.
- [x] **1.5 S** Endpoint admin: daftar member dan key, buat key dengan link klaim, buat ulang, batalkan klaim, cabut. Endpoint member: daftar key milik saya, klaim key (secret tampil sekali). Link klaim berlaku terbatas dan hanya untuk member yang dituju.
  - Catatan: klaim tidak memakai token di URL. Link di email hanya membuka `/settings/mcp`, dan klaim butuh sesi member yang dituju dalam 7 hari. Endpoint: `GET/POST /api/admin/mcp-keys`, `POST /api/admin/mcp-keys/:id/reissue`, `DELETE /api/admin/mcp-keys/:id` (cabut atau batalkan klaim), `GET /api/admin/mcp-tools`, `GET /api/me/mcp-key`, `POST /api/me/mcp-key/:id/claim` (secret sekali, `Cache-Control: no-store`). `/api/me` sekarang memuat `isAdmin`.
- [x] **1.5b S** Link klaim dikirim lewat email (memakai `src/services/mail.ts`) dan dicatat sebagai notifikasi portal. Notifikasi butuh tabel baru (penerima, jenis, tautan, sudah dibaca) beserta endpoint daftar dan tandai dibaca. Token klaim disimpan sebagai hash.
  - Catatan: token klaim sekali pakai ada di fragmen link email (`/settings/mcp#claim=...`), jadi tidak terkirim ke server lewat URL. Portal mengirimnya di body saat klaim, lalu menghapusnya dari address bar. Klaim tetap butuh login member yang dituju. Kalau email gagal terkirim, admin mendapat link itu sekali untuk diteruskan. Migration `0017_mcp_claim_token.sql`.
  - Catatan: karena tidak ada token klaim (lihat 1.5), tidak ada yang perlu di-hash. Tabel `notifications`, endpoint `GET /api/me/notifications`, `POST /api/me/notifications/:id/read`, dan `POST /api/me/notifications/read-all`. Kalau email gagal, key tetap dibuat dan notifikasi tetap tercatat.
- [x] **1.6 S** Tools MCP menerima `workspaceId` di setiap panggilan, dan tool baru `workspaces_list` untuk workspace tempat member menjadi anggota. Setiap panggilan memeriksa keanggotaan workspace sebelum membaca atau menulis data.
  - Catatan: 15 tools. Key dicabut otomatis saat member keluar atau dikeluarkan dari workspace terakhirnya, atau workspace terakhirnya dihapus.
- [x] **1.7 S** Persetujuan dokumen, story, dan publish lewat portal boleh dilakukan owner, PM, atau tech lead workspace. Test penolakan untuk role lain.
  - Catatan: berlaku untuk status PRD `approved`, menandai story atau epic `ready` (kalau hanya status yang diubah), dan publish epic. Langkah review lain tetap hanya owner atau PM.
- [x] **1.8 W** Halaman admin untuk key MCP: tabel member dengan status key (Belum ada, Menunggu klaim, Aktif, Kedaluwarsa, Dicabut), dialog buat key (member, nama key, role, tool, masa berlaku), dan aksi cabut, buat ulang, serta batalkan klaim.
- [x] **1.9 W** Halaman member di avatar → Settings → MCP berubah menjadi "key saya": daftar key, tombol klaim, secret tampil sekali, dan panel cara setup. Form pembuatan key yang sekarang dihapus dari halaman ini.
- [x] **1.10 W** Penugasan role anggota project di tab Tim, menggantikan UI yang dihapus dari Papan tugas.
- [x] **1.11 W** Notifikasi di portal: penanda di avatar atau sidebar dan daftar notifikasi. Notifikasi klaim key membuka halaman MCP member.
  - Catatan: halaman admin di `/admin/mcp` (avatar → Admin → Akses MCP, hanya tampil untuk admin), fitur web `features/mcp-access` dan `features/notifications`. Lonceng notifikasi ada di samping avatar dan memuat ulang tiap menit. Role project di tab Tim bisa diubah oleh owner atau PM.

### Tahap 2 · Story yang lengkap

- [x] **2.1 S** Tentukan status story untuk alur desain-dulu, lalu migration. Usulan: `draft` → `design` → `design_approved` → `in_progress` → `qa` → `done`. Petakan status lama (`refinement`, `ready`, `review`) dan jaga data lama tetap valid.
  - Catatan: status lama tidak diubah dan tidak ada data yang dimigrasi. Tahap desain-dulu (`draft`, `design`, `design_approved`, `in_progress`, `qa`, `done`) dihitung di `server/src/models/story.ts` dari status dan persetujuan desain, jadi tidak ada dua sumber status.
- [x] **2.2 S** Field story: user story (peran, aksi, manfaat), flow, acceptance criteria, dan Definition of Done sebagai checklist dengan role per item.
  - Catatan: kolom user story dan flow di `planning_items`, tabel `story_dod_items` (migration `0014`). `PATCH /planning/stories/:id` untuk PM, `PATCH /planning/stories/:id/dod/:itemId` untuk PM atau peserta story.
- [x] **2.3 S** Aksi setujui desain story oleh owner, PM, atau tech lead. Aksi ini membuka task role lain.
  - Catatan: `POST /planning/stories/:id/approve-design`, butuh minimal satu desain. Approver juga bisa membaca story yang sudah terbit.
- [x] **2.4 W** Halaman story sesuai prototype: stepper status, tab Flow dan Definition of Done, peserta per role, panel properti, dan aktivitas.
  - Catatan: dibuat dengan data contoh (tombol Lihat data contoh di tab Proyek). Stepper desain-dulu, user story, tab Flow dan Definition of Done, persetujuan desain, dan task per role. Data asli menunggu 2.1–2.3.

### Tahap 3 · Artefak story

- [x] **3.1 S** Lampiran desain: judul, URL, dan pembuat. Validasi URL `http` atau `https`.
  - Catatan: tabel `story_designs`, URL dicek http/https di service dan di constraint database. `POST /planning/stories/:id/designs`.
- [x] **3.2 S** Tautan kontrak API ke request di koleksi workspace. Tautan tetap valid kalau request diganti nama, dan ditandai kalau request dihapus.
  - Catatan: tabel `story_contracts` menyimpan id request. Method, path, dan nama dibaca dari koleksi terakhir workspace saat story dibaca, jadi tetap benar setelah request diganti nama, dan ditandai `missing` kalau request dihapus. `POST /planning/stories/:id/contracts`.
- [x] **3.3 S** Test case: judul, prasyarat, langkah, hasil yang diharapkan, dan pembuat. Respons juga menyediakan teks utuh untuk disalin.
  - Catatan: tabel `story_test_cases` dengan nomor per story (TC-1, TC-2). Teks untuk disalin disusun di portal dari prasyarat, langkah, dan hasil.
- [x] **3.4 S** Tools MCP: `story_attach_design` (UI/UX), `story_link_api_contract` (backend), `story_write_test_case` (QA), dan `story_read` yang memuat semua artefak. Izin mengikuti matriks di 1.2.
  - Catatan: `story_read`, `story_attach_design`, `story_link_api_contract`, `story_write_test_case`. Menulis artefak butuh PM atau peserta story.
- [x] **3.5 W** Tab Desain, Kontrak API, dan Test case di halaman story, termasuk tombol Salin teks untuk test case.
  - Catatan: dibuat dengan data contoh. Tab Desain, Kontrak API, dan Test case dengan Salin teks. Bentuk data di `models/story.model.ts`, endpoint yang ditiru: `GET /planning/stories/:id`, `POST /planning/stories/:id/approve-design`, `PATCH /planning/stories/:id/dod/:itemId`.

### Tahap 4 · Task, ketergantungan, dan sub-task

- [x] **4.1 S** Kirim `storyId` dan role task di respons task. Field role task lewat migration.
  - Catatan: kolom `tasks.role`. Respons task memuat `storyId`, `role`, `locked`, `dependsOn`, `subtaskDone`, dan `subtaskTotal`. Task draft dari PM atau agent bisa membawa `role`.
- [x] **4.2 S** Penguncian: task role selain UI/UX tidak bisa dipindah dari backlog sebelum desain story disetujui. Pesan error dari server.
  - Catatan: error `TASK_LOCKED` (409) di portal dan di tool MCP yang mengubah status.
- [x] **4.3 S** Ketergantungan antar task (misalnya E2E QA menunggu backend dan frontend).
  - Catatan: tabel `task_dependencies`. Diubah lewat `dependsOn` di `PATCH /tasks/:id`, hanya di project yang sama dan tidak boleh ke diri sendiri.
- [x] **4.4 S** Sub-task: tabel baru, terhubung ke task, dengan judul, status selesai, dan assignee. Endpoint dan test.
  - Catatan: tabel `task_subtasks`. `GET/POST /tasks/:id/subtasks`, `PATCH /tasks/:id/subtasks/:subtaskId`. Editor, owner, atau assignee task boleh mengubah.
- [x] **4.5 S** Tools MCP: `tasks_list_ready` (task milik saya yang sudah terbuka) dan sub-task untuk task milik saya.
  - Catatan: `tasks_list_ready` (milik saya, belum selesai, tidak terkunci, semua ketergantungan selesai), `subtasks_list`, `subtask_add`, `subtask_set_done` untuk task milik saya.
- [x] **4.6 W** Model dan service portal membaca `storyId`, role, status kunci, ketergantungan, dan sub-task.
  - Catatan: dibuat dengan data contoh. Task membaca `storyId`, `role`, `locked`, `dependsOn`, dan jumlah sub-task (semua opsional sampai server mengirimnya). Sub-task lewat `GET/POST /tasks/:id/subtasks` dan `PATCH /tasks/:id/subtasks/:id`. Mock ada di `web/src/features/projects/services/mock/`. Sejak server 2–4 selesai, workspace asli memakai endpoint server, dan mock hanya untuk tombol Lihat data contoh.

### Tahap 5 · Halaman portal sesuai prototype

- [x] **5.1 W** Navigasi proyek: Alur, Dokumen, Epic & Story, Papan tugas.
- [x] **5.2 W** Alur: pipeline BRD → PRD → Epic → Story → Task, antrian "Menunggu kamu", dan tim proyek.
- [x] **5.3 W** Dokumen: daftar BRD dan PRD, halaman dokumen dengan daftar isi, banner draft agent, panel persetujuan, keputusan, dan riwayat versi.
- [x] **5.4 W** Epic: daftar story dengan status, progres, dan peserta.
- [x] **5.5 W** Papan tugas: kartu, filter, kolom Selesai yang diringkas, dan tampilan mobile dengan tab status.
- [x] **5.6 W** Drag-and-drop dengan @dnd-kit (cek API lewat Context7, termasuk sensor keyboard dan sentuh), update optimistik dengan rollback, dan menu "Pindah ke…".
  - Catatan 5.1–5.6 (2026-11-12): tab workspace "Proyek" berisi navigasi Alur, Dokumen, Epic & Story, dan Papan tugas, dengan data dan aksi yang sudah ada di server. Teks pindah ke namespace `planning` (id + en), dan `planning-copy.constants.ts` serta `planning.view.tsx` dihapus. Token baru di `index.css`: `approve` (hijau DESIGN.md) dan warna titik role. Drag-and-drop memakai `@dnd-kit/react` (sensor pointer dan keyboard bawaan), dengan update optimistik dan rollback, plus menu "Pindah ke". Server menambah `canApprove` di daftar dokumen. Yang menunggu tahap 2–4: stepper status desain-dulu, Definition of Done, tab Desain/Kontrak/Test case, role dan kunci task, ketergantungan, dan sub-task.
- [x] **5.7 W** Dialog task dua kolom untuk buat dan edit, dengan sub-task dan komentar.
  - Catatan: dialog dua kolom, komentar, dan sub-task sudah ada.
- [x] **5.8 W** Test viewmodel: filter, kolom Selesai, overdue, penguncian, dan rollback drag.
  - Catatan: test kolom Selesai, penguncian, dan rollback drag ada di `use-projects-board.viewmodel.test.tsx`.

### Tahap 6 · Jejak dan visibilitas agent

- [x] **6.1 S** Simpan nama key (bukan secret) di catatan aktivitas, supaya portal bisa menampilkan "lewat key claude-code · laptop maya".
- [x] **6.2 W** Tampilkan aksi agent beserta nama key di aktivitas story, task, dan dokumen.

### Nanti

- Integrasi Stitchkit untuk lampiran desain.
- Sprint dan estimasi.
- Urutan task di dalam kolom (server perlu menerima posisi).
- Notifikasi saat task terbuka atau butuh persetujuan.

## Pertanyaan terbuka

- Dengan role key berlaku sama di semua workspace, key PM bisa draft PRD di workspace tempat member itu hanya viewer. Ini sudah diputuskan; catat di sini kalau nanti perlu dibatasi.
- Status story di 2.1: apakah urutan usulan sudah sesuai?
- Filter due date di papan tugas: "Lewat tenggat", "Minggu ini", dan "Tanpa due date"?
- Kolom Selesai: berapa task yang ditampilkan sebelum "Tampilkan semua"?
- Apakah story tanpa tampilan (murni backend) boleh melewati tahap desain, dan siapa yang memutuskannya?
