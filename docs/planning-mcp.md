# Planning workspace melalui MCP

Satu workspace adalah satu project. PM mengunggah BRD di tab **Documents** (`PDF`, `DOCX`, `MD`, atau `TXT`, maksimal 10 MB). Server mengekstrak teks untuk agent dan menyimpan file asli. PDF berbasis gambar yang tidak memiliki lapisan teks belum dapat diproses; lakukan OCR sebelum diunggah.

## Alur PM dan agent

1. Owner workspace memberi PM role proyek `pm` di tab **Tim**. PM membuat API key sendiri di **Pengaturan → Akses MCP** (`/settings/mcp`) dengan nama dan masa berlaku 30, 90, atau 365 hari, atau tanpa kedaluwarsa. Nilai key hanya muncul sekali saat dibuat; daftar key hanya menampilkan 4 karakter terakhir. Satu anggota boleh punya maksimal 10 key aktif dan bisa mencabutnya sendiri.
2. Agent PM terhubung ke `/api/mcp` dengan `Authorization: Bearer <key>`. Halaman `/settings/mcp` menampilkan perintah setup untuk Claude Code dan Codex.
3. Kalau BRD belum ada di **Documents**, PM bisa memberikan teksnya ke agent. Agent mengunggahnya tanpa diubah dengan `planning_upload_brd` (teks Markdown atau plain text, `fileName` berakhiran `.md` atau `.txt`). BRD ini langsung berstatus Approved seperti unggahan dari portal, dan tercatat di aktivitas beserta nama key-nya. PDF dan DOCX tetap diunggah lewat portal. Agent memanggil `workspaces_list`, lalu `planning_list` dengan `workspaceId` untuk menemukan BRD, lalu `planning_read_document` dengan `documentId`. Respons memuat teks BRD dan riwayat versi.
4. Agent menulis isi PRD dan memanggil `planning_draft_prd` dengan `sourceDocumentId` BRD, `title`, dan `content`. Cloud menyimpan draf; cloud tidak menjalankan model AI.
5. PM dan tim membahas PRD di **Documents**. PM memindahkan status `Draft → Review PM → Review tim`, lalu PM, tech lead, atau owner menyetujui ke `Approved`. Setiap revisi membuat versi baru. Perubahan BRD setelah PRD dibuat ditandai untuk ditinjau.
6. Agent memanggil `planning_draft_item` untuk Epic dari PRD Approved, lalu untuk Story dengan `parentId` Epic. Isi `acceptanceCriteria`, `sourceSection`, dan `participantIds` pada Story. `sourceSection` harus berupa kutipan teks yang benar-benar ada dalam PRD.
7. Agent memanggil `planning_draft_task` untuk setiap pekerjaan per anggota, dengan `storyId`, `title`, dan `assigneeId`.
8. PM dan tim melakukan refinement pada Story. PM atau tech lead memindahkan Story dan Epic ke `Ready`, lalu menekan **Publish epic & tasks**. Publish hanya berhasil jika Epic punya Story, setiap Story punya Task, dan seluruh Story sudah `Ready`. Task baru muncul pada board setelah publish.

## Panduan wajib agent

- Saat `initialize`, server mengirim `instructions` yang meminta agent memanggil `planning_guide` lebih dulu. Panduan disusun dari semua role proyek anggota: PM mendapat playbook lengkap BRD → PRD → Epic → Story → Task, role lain mendapat panduan singkat untuk tugasnya. Anggota dengan beberapa role (misalnya backend dan QA) mendapat panduan tiap role. Anggota tanpa role mendapat panduan dasar. `planning_guide` selalu tersedia.
- Semua tool tulis ditolak dengan `MCP_GUIDE_REQUIRED` (409) sampai agent membaca panduan versi terbaru dalam 12 jam terakhir. Saat versi panduan naik, agent harus membacanya lagi.
- Server juga memeriksa hasil yang wajib dari panduan dan menolak dengan `MCP_DRAFT_INCOMPLETE` (400) jika: PRD punya kurang dari 6 bagian `## `; Epic atau Story tanpa `sourceSection`; Story tanpa `acceptanceCriteria`; Task tanpa `role`; atau `story_write_details` tidak berisi user story, flow, dan Definition of Done.
- Agent PM bisa memakai prompt MCP `pm_brd_to_prd`, `pm_prd_to_epics`, `pm_epic_to_stories`, dan `pm_story_to_tasks` (tech lead mendapat `pm_story_to_tasks`).
- Anggota melihat panduan untuk role-nya di `/settings/mcp`, bagian **Panduan wajib agent**.

## Kolaborasi dan akses

- Key tidak menyimpan role atau daftar tool. Setiap key berlaku di semua workspace tempat pemiliknya menjadi anggota, dan semua key milik satu anggota punya akses yang sama. Key dicabut otomatis saat pemiliknya tidak lagi menjadi anggota workspace mana pun.
- Admin aplikasi melihat semua workspace di **avatar → Admin → Semua workspace** (`/admin/workspaces`): nama, owner, jumlah anggota, dan tanggal dibuat. Klik nama workspace untuk membukanya. Admin yang bukan anggota membaca semua tab sebagai viewer (dokumen dan draft planning ikut terlihat), dengan label **Admin · hanya lihat**. Semua perubahan ditolak (`ROLE_NOT_ALLOWED`), dan admin tidak muncul di daftar anggota.
- Tool yang tersedia mengikuti role proyek yang diberikan owner di tab **Tim** pada tiap workspace (`pm`, `tech_lead`, `ui_ux`, `backend`, `frontend`, `mobile`, `qa`; `devops` dan `other` tidak menambah tool). Satu anggota boleh punya beberapa role, dan tool-nya digabung. Anggota tanpa role mendapat tool dasar: task miliknya, story yang diikutinya, dan panduan.
- `tools/list` menampilkan gabungan tool dari semua workspace anggota. Setiap panggilan dicek lagi terhadap role di workspace yang disebut; tool yang tidak diizinkan di workspace itu ditolak dengan `MCP_PERMISSION_DENIED`. Perubahan role di tab Tim langsung berlaku untuk key yang sudah ada.
- Admin melihat semua key di **avatar → Admin → Akses MCP** (`/admin/mcp`) beserta pemiliknya, dan bisa mencabut key. Admin tidak membuat key untuk anggota dan tidak pernah melihat nilai key.

- Diskusi tersedia pada PRD, Epic, Story, dan Task. Komentar mendukung balasan, resolve, dan penanda keputusan oleh PM.
- Hak baca mengikuti peran kerja di portal, dan role key di MCP:

  | Peran | BRD | PRD | Epic, story, task |
  |---|---|---|---|
  | PM dan owner | semua | semua status | semua, termasuk draf |
  | Tech lead | semua | Review tim dan Approved | yang sudah dipublish |
  | Backend | semua | Approved | yang sudah dipublish |
  | UI/UX, frontend, mobile, QA, dan anggota tanpa peran | tidak | tidak | yang sudah dipublish |

  Untuk peran yang tidak membaca dokumen, tab **Documents** disembunyikan. Draf epic, story, dan task hanya terlihat oleh PM.
- Semua key bisa membaca epic dan story yang sudah dipublish lewat `project_items_list`, task semua anggota lewat `project_tasks_list`, dan detail story lewat `story_read`. Key backend juga mendapat `documents_list` dan `documents_read` untuk BRD dan PRD Approved. Key yang dibuat sebelum tool ini ada otomatis mendapatkannya.
- Membaca tidak sama dengan menulis. Komentar pada story hanya untuk participant, tech lead, dan PM (`stories_comment_participating`). Komentar dan perubahan status task hanya untuk assignee-nya (`tasks_comment_assigned`, `tasks_update_assigned_status`), yang diperiksa pada setiap panggilan. Siapa pun yang membaca sebuah dokumen boleh berkomentar di dokumen itu.
- Perubahan realtime dikirim ke orang yang boleh membacanya dengan aturan yang sama.
- Lewat portal, perencanaan dikelola pemilik workspace atau anggota editor dengan peran kerja PM. Lewat MCP, key yang memegang tool `planning_*` bertindak sebagai PM di workspace tempat member menjadi anggota. Persetujuan PRD, menandai story `Ready`, dan publish epic juga boleh dilakukan tech lead. Perubahan peran kerja dibatasi pada owner atau PM yang sudah ada.
- Draf agent, revisi, komentar, persetujuan, dan publish dicatat pada aktivitas planning. Catatan mencantumkan ID dan nama key untuk tindakan melalui MCP, tanpa menyimpan nilai secret. Nama key disimpan saat aksi terjadi, jadi catatan tetap terbaca setelah key dicabut. Lampiran desain, tautan kontrak, test case, persetujuan desain, perubahan status task, dan sub-task juga masuk catatan. PM melihatnya di panel Aktivitas pada dokumen, story, dan dialog task, misalnya "lewat key claude-code laptop".

## Story, artefak, dan task

- Story punya user story, flow, dan Definition of Done per role. Tahapnya dihitung dari status dan persetujuan desain: Draft → Desain → Desain disetujui → Dikerjakan → QA → Selesai.
- Agent UI/UX melampirkan desain dengan `story_attach_design`. Owner, PM, atau tech lead menyetujuinya di portal. Sebelum disetujui, task role lain terkunci dan server menolak memindahkannya dari backlog (`TASK_LOCKED`).
- Agent backend menautkan request dari dokumentasi API workspace dengan `story_link_api_contract`. Agent QA menulis test case dengan `story_write_test_case`. Semua agent membaca story lengkap dengan `story_read`.
- Agent anggota mencari pekerjaan yang bisa dimulai dengan `tasks_list_ready`, lalu mencatat langkah kerjanya dengan `subtasks_list`, `subtask_add`, dan `subtask_set_done`.

## Perubahan kebutuhan

Setiap Epic dan Story menyimpan ID serta versi PRD asalnya. Jika PRD berubah, UI menandai pekerjaan yang merujuk versi lama. Publish draf baru ditolak sampai sumbernya kembali Approved dan sesuai versi terbaru. Pekerjaan yang sudah terbit tetap ada untuk ditinjau manusia.

Setelah meninjau perubahan PRD pada draf yang belum diterbitkan, PM dapat menekan **Sudah ditinjau terhadap PRD terbaru** pada Epic. Aksi ini memperbarui rujukan versi Epic dan Story anaknya serta masuk ke audit log.
