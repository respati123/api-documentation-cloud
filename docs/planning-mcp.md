# Planning workspace melalui MCP

Satu workspace adalah satu project. PM mengunggah BRD di tab **Documents** (`PDF`, `DOCX`, `MD`, atau `TXT`, maksimal 10 MB). Server mengekstrak teks untuk agent dan menyimpan file asli. PDF berbasis gambar yang tidak memiliki lapisan teks belum dapat diproses; lakukan OCR sebelum diunggah.

## Alur PM dan agent

1. Owner workspace memberi PM role proyek `pm` di tab **Tim**. PM membuat API key sendiri di **Pengaturan → Akses MCP** (`/settings/mcp`) dengan nama dan masa berlaku 30, 90, atau 365 hari, atau tanpa kedaluwarsa. Nilai key hanya muncul sekali saat dibuat; daftar key hanya menampilkan 4 karakter terakhir. Satu anggota boleh punya maksimal 10 key aktif dan bisa mencabutnya sendiri.
2. Agent PM terhubung ke `/api/mcp` dengan `Authorization: Bearer <key>`. Halaman `/settings/mcp` menampilkan perintah setup untuk Claude Code dan Codex.
3. Kalau BRD belum ada di **Documents**, PM bisa memberikan teksnya ke agent. Agent mengunggahnya tanpa diubah dengan `planning_upload_brd` (teks Markdown atau plain text, `fileName` berakhiran `.md` atau `.txt`). BRD dari agent berstatus Draft sampai owner, PM, atau tech lead menekan **Konfirmasi BRD** di portal; BRD itu juga muncul di antrian **Menunggu kamu**. Server menolak PRD dari BRD yang belum dikonfirmasi (`PLANNING_CONFLICT`), dan backend belum melihatnya. BRD yang diunggah orang lewat portal tetap langsung Approved. PDF dan DOCX tetap diunggah lewat portal. Agent memanggil `workspaces_list`, lalu `planning_list` dengan `workspaceId` untuk menemukan BRD, lalu `documents_read` dengan `documentId`. Respons memuat teks BRD dan riwayat versi.
4. Agent menulis isi PRD dan memanggil `planning_draft_prd` dengan `sourceDocumentId` BRD, `title`, dan `content`. Cloud menyimpan draf; cloud tidak menjalankan model AI.
5. PM dan tim membahas PRD di **Documents**. PM memindahkan status `Draft → Review PM → Review tim`, lalu PM, tech lead, atau owner menyetujui ke `Approved`. Setiap revisi membuat versi baru. Perubahan BRD setelah PRD dibuat ditandai untuk ditinjau.
6. Agent memanggil `planning_draft_item` untuk Epic dari PRD Approved, lalu untuk Story dengan `parentId` Epic. Isi `acceptanceCriteria`, `sourceSection`, dan `participantIds` pada Story. `sourceSection` harus berupa kutipan teks yang benar-benar ada dalam PRD.
7. Agent memanggil `planning_draft_task` untuk setiap pekerjaan per anggota, dengan `storyId`, `title`, dan `assigneeId`.
8. PM dan tim melakukan refinement pada Story. PM atau tech lead memindahkan Story dan Epic ke `Ready`, lalu menekan **Publish epic & tasks**. Publish hanya berhasil jika Epic punya Story, setiap Story punya Task, dan seluruh Story sudah `Ready`. Task baru muncul pada board setelah publish.

## Panduan wajib agent

- Saat `initialize`, server mengirim `instructions` yang meminta agent memanggil `planning_guide` lebih dulu. Panduan disusun dari semua role proyek anggota: PM mendapat playbook lengkap BRD → PRD → Epic → Story → Task, role lain mendapat panduan singkat untuk tugasnya. Anggota dengan beberapa role (misalnya backend dan QA) mendapat panduan tiap role. Anggota tanpa role mendapat panduan dasar. `planning_guide` selalu tersedia.
- Semua tool tulis ditolak dengan `MCP_GUIDE_REQUIRED` (409) sampai agent membaca panduan versi terbaru dalam 12 jam terakhir. Penolakan itu sudah memuat panduannya di field `guide` dan dihitung sebagai sudah dibaca, jadi agent bisa langsung mengulang panggilannya. Saat versi panduan naik, agent harus membacanya lagi.
- Server juga memeriksa hasil yang wajib dari panduan dan menolak dengan `MCP_DRAFT_INCOMPLETE` (400) jika: PRD punya kurang dari 6 bagian `## `; Epic atau Story tanpa `sourceSection`; Story tanpa `acceptanceCriteria`; Task tanpa `role`; atau `story_write_details` tidak berisi user story, flow, dan Definition of Done.
- Playbook PM menulis PRD tanpa mewawancarai orang: agent merangkum BRD, isi percakapan, serta epic, story, dan API yang sudah ada di workspace. Strukturnya mengikuti template Product Requirements di Confluence: Product overview (target date, anggota tim sebagai `@handle (role)` dari `team_members_list`, link desain, Loom, dan work tracker), Objective, Success metrics (tabel Goal | Metric), Assumptions, Milestones, Requirements (tabel ID | Requirement | User story | Importance | Jira issue | Notes, dengan ID `R1`, `R2`, …), Out of scope, Design, Technical decisions, Open questions (tabel Question | Answer | Date answered), dan Reference links. Technical decisions adalah tambahan di luar template: keputusan implementasi (hanya yang sudah diputuskan, tanpa path file atau kode) dan keputusan pengujian (sesedikit mungkin titik uji, di level tertinggi), diadaptasi dari skill `to-spec` di mattpocock/skills. Tech lead memeriksa bagian ini saat review. Epic mengutip awal baris requirement, misalnya `R1 | Owner mengundang anggota lewat email`.
- Agent PM bisa memakai prompt MCP `pm_brd_to_prd`, `pm_prd_to_epics`, `pm_epic_to_stories`, dan `pm_story_to_tasks` (tech lead mendapat `pm_story_to_tasks`).
- Anggota melihat panduan untuk role-nya di `/settings/mcp`, bagian **Panduan wajib agent**.

## Kolaborasi dan akses

- Key tidak menyimpan role atau daftar tool. Setiap key berlaku di semua workspace tempat pemiliknya menjadi anggota, dan semua key milik satu anggota punya akses yang sama. Key dicabut otomatis saat pemiliknya tidak lagi menjadi anggota workspace mana pun.
- Admin aplikasi melihat semua workspace di **avatar → Admin → Semua workspace** (`/admin/workspaces`): nama, owner, jumlah anggota, dan tanggal dibuat. Klik nama workspace untuk membukanya. Admin yang bukan anggota membaca semua tab sebagai viewer (dokumen dan draft planning ikut terlihat), dengan label **Admin · hanya lihat**. Semua perubahan ditolak (`ROLE_NOT_ALLOWED`), dan admin tidak muncul di daftar anggota.
- Tool yang tersedia mengikuti role proyek yang diberikan owner di tab **Tim** pada tiap workspace (`pm`, `tech_lead`, `ui_ux`, `backend`, `frontend`, `mobile`, `qa`; `devops` dan `other` tidak menambah tool). Satu anggota boleh punya beberapa role, dan tool-nya digabung. Anggota tanpa role mendapat tool dasar: task miliknya, story yang diikutinya, dan panduan.
- `tools/list` menampilkan gabungan tool dari semua workspace anggota. Setiap panggilan dicek lagi terhadap role di workspace yang disebut; tool yang tidak diizinkan di workspace itu ditolak dengan `MCP_PERMISSION_DENIED`. Perubahan role di tab Tim langsung berlaku untuk key yang sudah ada.
- Admin melihat semua key di **avatar → Admin → Akses MCP** (`/admin/mcp`) beserta pemiliknya, dan bisa mencabut key. Admin tidak membuat key untuk anggota dan tidak pernah melihat nilai key.

- Diskusi tersedia pada PRD, Epic, Story, dan Task. Komentar mendukung balasan, resolve, dan penanda keputusan oleh PM.
- Agent ikut berdiskusi lewat MCP. `team_members_list` menampilkan semua anggota workspace beserta handle (bagian email sebelum `@`), role workspace, dan role proyek. `discussion_read` membaca komentar sebuah dokumen, epic, story, atau task sebagai thread beserta balasannya, dengan aturan baca yang sama seperti portal. Ketiga tool komentar (`planning_comment`, `tasks_comment_assigned`, `stories_comment_participating`) menerima `parentId` untuk membalas, dan `@handle` di isi komentar mengirim notifikasi mention ke anggota itu, sama seperti di portal. Hasilnya memuat `mentioned` dan `unknownMentions`, sehingga agent tahu handle mana yang tidak cocok dengan siapa pun.
- Draf BRD atau PRD yang tidak dilanjutkan bisa **dibuang** (status `discarded`) oleh owner, PM, atau tech lead, dari Draft, Review PM, atau Review tim. Dokumen yang dibuang tetap tersimpan untuk riwayat, tidak bisa diubah atau direview lagi, dan tidak muncul untuk agent. Dokumen Approved tetap memakai **Digantikan**.
- Owner atau PM bisa **menghapus** permanen dokumen berstatus Draft atau Dibuang, beserta versi dan diskusinya, selama belum ada PRD, epic, atau story yang dibuat darinya (`PLANNING_DOCUMENT_IN_USE`, 409). Penghapusan tercatat di activity log. Agent tidak punya tool untuk membuang atau menghapus dokumen.
- Hak baca mengikuti peran kerja di portal, dan role key di MCP:

  | Peran | BRD | PRD | Epic, story, task |
  |---|---|---|---|
  | PM dan owner | semua | semua status | semua, termasuk draf |
  | Tech lead | semua | semua status | semua, termasuk draf |
  | Backend | yang sudah dikonfirmasi | Approved | yang sudah dipublish |
  | UI/UX, frontend, mobile, QA, dan anggota tanpa peran | tidak | tidak | yang sudah dipublish |

  Untuk peran yang tidak membaca dokumen, tab **Documents** disembunyikan. Draf epic, story, dan task hanya terlihat oleh PM, owner, dan tech lead. Viewer workspace dengan role tech lead hanya membaca BRD dan PRD dari Review tim.
- Semua key bisa membaca epic dan story yang sudah dipublish lewat `project_items_list`, task semua anggota lewat `project_tasks_list`, detail story lewat `story_read`, request di dokumentasi API workspace lewat `api_requests_search`, dan notifikasinya sendiri lewat `notifications_list` dan `notifications_mark_read`. Key PM, tech lead, dan backend juga mendapat `documents_list` dan `documents_read`, dengan isi sesuai tabel di atas. Key yang dibuat sebelum tool ini ada otomatis mendapatkannya.
- Viewer workspace hanya membaca lewat MCP. Semua tool tulis ditolak dengan `MCP_PERMISSION_DENIED` di workspace tempat ia viewer, walaupun ia punya role PM.
- Membaca tidak sama dengan menulis. Komentar pada story hanya untuk participant, tech lead, dan PM (`stories_comment_participating`). Komentar dan perubahan status task hanya untuk assignee-nya (`tasks_comment_assigned`, `tasks_update_assigned_status`), yang diperiksa pada setiap panggilan. Siapa pun yang membaca sebuah dokumen boleh berkomentar di dokumen itu.
- Perubahan realtime dikirim ke orang yang boleh membacanya dengan aturan yang sama.
- Lewat portal, perencanaan dikelola pemilik workspace atau anggota editor dengan peran kerja PM. Lewat MCP, key yang memegang tool `planning_*` bertindak sebagai PM di workspace tempat member menjadi anggota, kecuali di workspace tempat ia viewer. Persetujuan PRD, menandai story `Ready`, dan publish epic juga boleh dilakukan tech lead. Perubahan peran kerja dibatasi pada owner atau PM yang sudah ada.
- Draf agent, revisi, komentar, persetujuan, dan publish dicatat pada aktivitas planning. Catatan mencantumkan ID dan nama key untuk tindakan melalui MCP, tanpa menyimpan nilai secret. Nama key disimpan saat aksi terjadi, jadi catatan tetap terbaca setelah key dicabut. Lampiran desain, tautan kontrak, test case, persetujuan desain, perubahan status task, dan sub-task juga masuk catatan. PM melihatnya di panel Aktivitas pada dokumen, story, dan dialog task, misalnya "lewat key claude-code laptop".

## Story, artefak, dan task

- Story punya user story, flow, dan Definition of Done per role. Tahapnya dihitung dari status dan persetujuan desain: Draft → Desain → Desain disetujui → Dikerjakan → QA → Selesai.
- Agent UI/UX melampirkan desain dengan `story_attach_design`. Owner, PM, atau tech lead menyetujuinya di portal. Sebelum disetujui, task role lain terkunci dan server menolak memindahkannya dari backlog (`TASK_LOCKED`).
- Agent backend mencari ID request dengan `api_requests_search` (nama, path, atau method), lalu menautkannya dengan `story_link_api_contract`. Agent QA menulis test case dengan `story_write_test_case`. Semua agent membaca story lengkap dengan `story_read`.
- Agent anggota mencari pekerjaan yang bisa dimulai dengan `tasks_list_ready`, lalu mencatat langkah kerjanya dengan `subtasks_list`, `subtask_add`, dan `subtask_set_done`.

## Issue, backlog, dan sprint

Pekerjaan disimpan sebagai issue: Epic, Story, Task, Bug, dan Sub-task. Satu project punya satu Product Backlog yang diurutkan, dan sprint berisi item dari backlog itu. Tool lama untuk story dan task tetap bekerja dengan nama dan bentuk yang sama; semuanya membaca dan menulis issue yang sama dengan portal.

- **Status.** Story: `draft → in_design → ready → in_progress → in_qa → done`. Task, Bug, dan Sub-task: `todo → in_progress → in_review → done`. Status lama `backlog` kini `todo`. Epic tidak punya status sendiri; ia mengikuti isinya.
- **Poin.** Story, Task, dan Bug memakai skala 1, 2, 3, 5, 8, 13. Sub-task tidak punya poin, tetapi punya role.
- **Masuk sprint.** Item masuk sprint hanya jika punya poin, dan Story hanya jika sudah `ready`. PM bisa menimpa aturan ini dengan alasan yang tercatat. PM dan tech lead mengurutkan backlog dan mengatur sprint; agent tidak.
- **Tool baru.** `backlog_list` (sprint terbuka dengan itemnya, lalu backlog menurut urutan), `sprint_get_active`, `issue_read` (id atau key seperti `PARI-12`, beserta checklist dan tautan), `issue_draft`, `issue_comment`, `subtask_update_status`, dan `checklist_set_done`.
- **Batas agent.** `issue_draft` selalu menghasilkan draf yang baru terlihat setelah orang mempublikasikannya. Agent hanya mengubah status Sub-task yang ditugaskan kepada pemilik key, dan tidak bisa menerima Story sebagai `done`.
- Panduan agent memuat bagian ini, dan versinya dinaikkan sehingga agent harus membacanya lagi.
- Di portal, **Pengaturan → Akses MCP** menampilkan tool baru dengan labelnya.

## Perubahan kebutuhan

Setiap Epic dan Story menyimpan ID serta versi PRD asalnya. Jika PRD berubah, UI menandai pekerjaan yang merujuk versi lama. Publish draf baru ditolak sampai sumbernya kembali Approved dan sesuai versi terbaru. Pekerjaan yang sudah terbit tetap ada untuk ditinjau manusia.

Setelah meninjau perubahan PRD pada draf yang belum diterbitkan, PM dapat menekan **Sudah ditinjau terhadap PRD terbaru** pada Epic. Aksi ini memperbarui rujukan versi Epic dan Story anaknya serta masuk ke audit log.

## Protokol dan kenyamanan agent

- Endpoint `/api/mcp` memakai Streamable HTTP tanpa sesi: setiap pesan adalah satu `POST` dan dijawab dengan satu JSON. Versi protokol yang didukung adalah `2025-06-18` dan `2025-03-26`. `initialize` menjawab dengan versi yang diminta klien kalau didukung, dan `2025-06-18` kalau tidak. Header `MCP-Protocol-Version` yang tidak didukung ditolak dengan `400`.
- Key yang salah, kedaluwarsa, atau dicabut dijawab `401` dengan body JSON-RPC (`error.code` `-32001`, `error.data.code` `MCP_KEY_INVALID`) dan header `WWW-Authenticate: Bearer`, supaya agent bisa membaca alasannya.
- Setiap notifikasi JSON-RPC (pesan tanpa `id`) dijawab `202` tanpa body.
- Satu key boleh memanggil paling banyak 240 kali per menit. Lewat dari itu dijawab `429` dengan `MCP_RATE_LIMITED` dan `Retry-After: 60`. `last_used_at` key diperbarui paling sering sekali per menit.
- Setiap tool punya `title` dan anotasi: tool baca memakai `readOnlyHint`, tool draf dan komentar `destructiveHint: false`, dan `story_write_details` ditandai destruktif karena mengganti Definition of Done. Klien bisa menyetujui tool baca tanpa bertanya.
- Hasil tool dikirim sebagai teks JSON dan juga `structuredContent`. Daftar dibungkus menjadi `{ "items": [...] }`.
- Tool tulis yang menambah sesuatu menerima `clientRequestId` opsional. Panggilan ulang dengan ID yang sama dalam 24 jam mengembalikan hasil pertama, jadi retry setelah timeout tidak membuat draf ganda. Selama panggilan pertama masih berjalan, panggilan kedua mendapat `MCP_REQUEST_IN_PROGRESS`.
- BRD dan PRD yang boleh dibaca key juga tersedia sebagai MCP resource (`apidocs://workspaces/{workspaceId}/documents/{documentId}`), sehingga pengguna bisa melampirkannya ke konteks agent.
- `projects_list`, `stories_read_participating`, dan `planning_read_document` tidak lagi muncul di `tools/list` karena sama dengan tool lain (satu project per workspace, `story_read`, `documents_read`). Ketiganya masih menjawab supaya agent yang sedang berjalan tidak rusak.
