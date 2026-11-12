# Planning workspace melalui MCP

Satu workspace adalah satu project. PM mengunggah BRD di tab **Documents** (`PDF`, `DOCX`, `MD`, atau `TXT`, maksimal 10 MB). Server mengekstrak teks untuk agent dan menyimpan file asli. PDF berbasis gambar yang tidak memiliki lapisan teks belum dapat diproses; lakukan OCR sebelum diunggah.

## Alur PM dan agent

1. Admin aplikasi membuat key untuk PM di **avatar → Admin → Akses MCP** (`/admin/mcp`) dengan role key `pm`. PM menerima email dan notifikasi, lalu mengklaim key di **avatar → Settings → MCP** (`/settings/mcp`). Nilai key hanya muncul sekali saat diklaim. Admin tidak pernah melihatnya.
2. Agent PM terhubung ke `/api/mcp` dengan `Authorization: Bearer <key>`. Halaman `/settings/mcp` menampilkan perintah setup untuk Claude Code dan Codex.
3. Agent memanggil `workspaces_list`, lalu `planning_list` dengan `workspaceId` untuk menemukan BRD, lalu `planning_read_document` dengan `documentId`. Respons memuat teks BRD dan riwayat versi.
4. Agent menulis isi PRD dan memanggil `planning_draft_prd` dengan `sourceDocumentId` BRD, `title`, dan `content`. Cloud menyimpan draf; cloud tidak menjalankan model AI.
5. PM dan tim membahas PRD di **Documents**. PM memindahkan status `Draft → Review PM → Review tim`, lalu PM, tech lead, atau owner menyetujui ke `Approved`. Setiap revisi membuat versi baru. Perubahan BRD setelah PRD dibuat ditandai untuk ditinjau.
6. Agent memanggil `planning_draft_item` untuk Epic dari PRD Approved, lalu untuk Story dengan `parentId` Epic. Isi `acceptanceCriteria`, `sourceSection`, dan `participantIds` pada Story. `sourceSection` harus berupa kutipan teks yang benar-benar ada dalam PRD.
7. Agent memanggil `planning_draft_task` untuk setiap pekerjaan per anggota, dengan `storyId`, `title`, dan `assigneeId`.
8. PM dan tim melakukan refinement pada Story. PM atau tech lead memindahkan Story dan Epic ke `Ready`, lalu menekan **Publish epic & tasks**. Publish hanya berhasil jika Epic punya Story, setiap Story punya Task, dan seluruh Story sudah `Ready`. Task baru muncul pada board setelah publish.

## Panduan wajib agent

- Saat `initialize`, server mengirim `instructions` yang meminta agent memanggil `planning_guide` lebih dulu. Panduan ini berbeda per role key: PM mendapat playbook lengkap BRD → PRD → Epic → Story → Task, role lain mendapat panduan singkat untuk tugasnya. `planning_guide` selalu tersedia untuk semua key.
- Semua tool tulis ditolak dengan `MCP_GUIDE_REQUIRED` (409) sampai agent membaca panduan versi terbaru dalam 12 jam terakhir. Saat versi panduan naik, agent harus membacanya lagi.
- Server juga memeriksa hasil yang wajib dari panduan dan menolak dengan `MCP_DRAFT_INCOMPLETE` (400) jika: PRD punya kurang dari 6 bagian `## `; Epic atau Story tanpa `sourceSection`; Story tanpa `acceptanceCriteria`; Task tanpa `role`; atau `story_write_details` tidak berisi user story, flow, dan Definition of Done.
- Agent PM bisa memakai prompt MCP `pm_brd_to_prd`, `pm_prd_to_epics`, `pm_epic_to_stories`, dan `pm_story_to_tasks` (tech lead mendapat `pm_story_to_tasks`).
- Anggota melihat panduan untuk role key-nya di `/settings/mcp`, bagian **Panduan wajib agent**.

## Kolaborasi dan akses

- Satu key per member berlaku di semua workspace tempat member menjadi anggota. Setiap tool kecuali `workspaces_list` menerima `workspaceId`, dan server memeriksa keanggotaan pada setiap panggilan. Key dicabut otomatis saat member tidak lagi menjadi anggota workspace mana pun.
- Admin aplikasi melihat semua workspace di **avatar → Admin → Semua workspace** (`/admin/workspaces`): nama, owner, jumlah anggota, dan tanggal dibuat. Isi workspace tetap hanya untuk anggota.
- Tool yang tersedia ditentukan role key (`pm`, `tech_lead`, `ui_ux`, `backend`, `frontend`, `mobile`, `qa`). Admin bisa menambah atau mengurangi tool per key.

- Diskusi tersedia pada PRD, Epic, Story, dan Task. Komentar mendukung balasan, resolve, dan penanda keputusan oleh PM.
- Anggota yang menjadi participant dapat membaca dan berkomentar pada Story yang diterbitkan lewat `stories_list_participating`, `stories_read_participating`, dan `stories_comment_participating` jika key memiliki tool tersebut.
- Agent anggota hanya melihat Task yang ditugaskan kepadanya lewat `tasks_list_assigned` dan `tasks_get_assigned`. `tasks_comment_assigned` serta `tasks_update_assigned_status` juga memeriksa assignee pada setiap panggilan. Menjadi participant Story tidak membuka Task milik anggota lain.
- Lewat portal, perencanaan dikelola pemilik workspace atau anggota editor dengan peran kerja PM. Lewat MCP, key yang memegang tool `planning_*` bertindak sebagai PM di workspace tempat member menjadi anggota. Persetujuan PRD, menandai story `Ready`, dan publish epic juga boleh dilakukan tech lead. Perubahan peran kerja dibatasi pada owner atau PM yang sudah ada.
- Draf agent, revisi, komentar, persetujuan, dan publish dicatat pada aktivitas planning. Catatan mencantumkan ID key untuk tindakan melalui MCP, tanpa menyimpan nilai secret.

## Story, artefak, dan task

- Story punya user story, flow, dan Definition of Done per role. Tahapnya dihitung dari status dan persetujuan desain: Draft → Desain → Desain disetujui → Dikerjakan → QA → Selesai.
- Agent UI/UX melampirkan desain dengan `story_attach_design`. Owner, PM, atau tech lead menyetujuinya di portal. Sebelum disetujui, task role lain terkunci dan server menolak memindahkannya dari backlog (`TASK_LOCKED`).
- Agent backend menautkan request dari dokumentasi API workspace dengan `story_link_api_contract`. Agent QA menulis test case dengan `story_write_test_case`. Semua agent membaca story lengkap dengan `story_read`.
- Agent anggota mencari pekerjaan yang bisa dimulai dengan `tasks_list_ready`, lalu mencatat langkah kerjanya dengan `subtasks_list`, `subtask_add`, dan `subtask_set_done`.

## Perubahan kebutuhan

Setiap Epic dan Story menyimpan ID serta versi PRD asalnya. Jika PRD berubah, UI menandai pekerjaan yang merujuk versi lama. Publish draf baru ditolak sampai sumbernya kembali Approved dan sesuai versi terbaru. Pekerjaan yang sudah terbit tetap ada untuk ditinjau manusia.

Setelah meninjau perubahan PRD pada draf yang belum diterbitkan, PM dapat menekan **Sudah ditinjau terhadap PRD terbaru** pada Epic. Aksi ini memperbarui rujukan versi Epic dan Story anaknya serta masuk ke audit log.
