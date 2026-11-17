import type {
  PlanningComment,
  PlanningDocument,
  PlanningEvent,
  PlanningItem,
  PlanningTask,
} from '@/features/projects/models/planning.model'
import type { ProjectMember, Task } from '@/features/projects/models/project.model'
import type { StoryDetails, Subtask } from '@/features/projects/models/story.model'

// Sample project for the "show sample data" mode. It mirrors the approved prototype and the API shape planned in stages 2 to 4.
// Everything lives in the browser; nothing here reaches the server.

const day = 24 * 60 * 60 * 1000
const ago = (days: number) => new Date(Date.now() - days * day).toISOString()
const dateIn = (days: number) => new Date(Date.now() + days * day).toISOString().slice(0, 10)

export const DEMO_PROJECT_ID = 'demo-project'

export const demoMembers: ProjectMember[] = [
  { id: 'demo-maya', email: 'maya@contoh.test', discipline: 'pm' },
  { id: 'demo-arif', email: 'arif@contoh.test', discipline: 'tech_lead' },
  { id: 'demo-rina', email: 'rina@contoh.test', discipline: 'ui_ux' },
  { id: 'demo-dimas', email: 'dimas@contoh.test', discipline: 'backend' },
  { id: 'demo-sari', email: 'sari@contoh.test', discipline: 'frontend' },
  { id: 'demo-budi', email: 'budi@contoh.test', discipline: 'qa' },
]

const brdContent = `# Dokumentasi API tersebar membuat onboarding lambat

Tim backend membagikan kontrak API lewat tangkapan layar dan chat. Developer baru butuh waktu lama untuk tahu endpoint mana yang berlaku.

## Masalah
Kontrak API tidak punya satu tempat yang bisa dibuka semua orang. Saat ada perubahan, frontend dan QA mengetahuinya terlambat.

## Tujuan bisnis
- Satu workspace cloud berisi dokumentasi API yang selalu sama dengan versi terakhir dari aplikasi desktop.
- Anggota tim bisa diundang dan dikeluarkan tanpa bantuan developer.

## Pengguna
- Owner workspace yang mengatur akses.
- Developer frontend, mobile, dan QA yang membaca kontrak.

## Ukuran keberhasilan
- Waktu sampai developer baru bisa memanggil API pertama: dari 2 hari menjadi kurang dari 1 jam.
- Pertanyaan "endpoint ini masih dipakai?" per minggu: dari 12 menjadi di bawah 3.

## Di luar cakupan
- Single sign-on perusahaan.
- Penagihan per anggota.`

const prdContent = `# Undangan anggota workspace

Owner mengundang anggota lewat email. Anggota bergabung dengan peran yang ditentukan owner.

## Ringkasan
Fitur ini menggantikan cara lama yang meminta developer menambahkan akun secara manual. Undangan dikirim lewat email, berlaku 7 hari, dan bisa dibatalkan sebelum diterima.

## Alur pengguna
1. Owner membuka tab Tim lalu memilih Undang anggota.
2. Owner mengisi email dan memilih peran.
3. Penerima membuka link di email, masuk atau mendaftar, lalu bergabung.
4. Owner melihat undangan tertunda dan bisa membatalkannya.

## Kebutuhan
- R1 Owner bisa mengundang dengan email dan peran (wajib).
- R2 Undangan kedaluwarsa setelah 7 hari (wajib).
- R3 Owner bisa membatalkan undangan tertunda (wajib).
- R4 Owner bisa mengeluarkan anggota (sebaiknya).

## Batasan
- Maksimal 20 undangan per jam per workspace.
- Email yang sudah menjadi anggota tidak bisa diundang lagi.`

const rolesPrdContent = `# Peran dan izin anggota

Owner bisa memberi peran editor atau viewer, dan mengubahnya kapan saja.

## Ringkasan
Peran menentukan siapa yang bisa mengubah koleksi dan siapa yang hanya membaca dokumentasi.

## Kebutuhan
- R1 Owner bisa mengubah peran anggota.
- R2 Viewer tidak melihat tombol yang mengubah data.

## Pertanyaan terbuka
- Apakah editor boleh mengundang viewer?`

export function demoDocuments(): PlanningDocument[] {
  return [
    {
      id: 'demo-brd-1',
      kind: 'brd',
      title: 'Dokumentasi API tersebar membuat onboarding lambat',
      status: 'approved',
      currentVersion: 3,
      sourceDocumentId: null,
      sourceOutdated: false,
      approvedAt: ago(3),
      updatedAt: ago(3),
      content: brdContent,
      fileName: null,
      mimeType: null,
      sourceVersion: null,
      createdAt: ago(10),
      versions: [
        { version: 3, fileName: null, createdAt: ago(3) },
        { version: 2, fileName: null, createdAt: ago(5) },
        { version: 1, fileName: null, createdAt: ago(10) },
      ],
    },
    {
      id: 'demo-prd-2',
      kind: 'prd',
      title: 'Undangan anggota workspace',
      status: 'approved',
      currentVersion: 2,
      sourceDocumentId: 'demo-brd-1',
      sourceOutdated: false,
      approvedAt: ago(2),
      updatedAt: ago(2),
      content: prdContent,
      fileName: null,
      mimeType: null,
      sourceVersion: 3,
      createdAt: ago(4),
      versions: [
        { version: 2, fileName: null, createdAt: ago(2) },
        { version: 1, fileName: null, createdAt: ago(4) },
      ],
    },
    {
      id: 'demo-prd-5',
      kind: 'prd',
      title: 'Peran dan izin anggota',
      status: 'review_team',
      currentVersion: 1,
      sourceDocumentId: 'demo-brd-1',
      sourceOutdated: false,
      approvedAt: null,
      updatedAt: ago(0.01),
      content: rolesPrdContent,
      fileName: null,
      mimeType: null,
      sourceVersion: 3,
      createdAt: ago(0.01),
      versions: [{ version: 1, fileName: null, createdAt: ago(0.01) }],
    },
  ]
}

function item(overrides: Partial<PlanningItem> & Pick<PlanningItem, 'id' | 'kind' | 'title' | 'status'>): PlanningItem {
  return {
    parentId: null,
    description: '',
    acceptanceCriteria: '',
    publishedAt: ago(2),
    sourceDocumentId: 'demo-prd-2',
    sourceVersion: 2,
    sourceOutdated: false,
    sourceSection: null,
    participantIds: [],
    createdAt: ago(3),
    ...overrides,
  }
}

export function demoItems(): PlanningItem[] {
  return [
    item({
      id: 'demo-ep-3',
      kind: 'epic',
      title: 'Akses tim workspace',
      status: 'in_progress',
      description: [
        'Tujuan: owner mengatur siapa yang membaca dokumentasi API di workspace, dari undangan sampai mengeluarkan anggota.',
        'Mencakup: R1, R2, R3, R4',
        'Di luar cakupan: R5 (SSO perusahaan), peran kustom',
        'Ukuran sukses: undangan yang diterima dalam 24 jam (40% → 80%), tiket support soal akses per bulan (±30 → ≤ 5)',
        'Kriteria selesai:',
        '- Owner bisa mengundang, membatalkan undangan, mengubah peran, dan mengeluarkan anggota tanpa bantuan developer',
        '- Anggota yang dikeluarkan langsung kehilangan akses, termasuk dari aplikasi desktop',
        'Risiko & dependensi:',
        '- Pengiriman email bergantung pada SMTP produksi',
      ].join('\n'),
      createdAt: ago(3),
    }),
    item({
      id: 'demo-st-12',
      kind: 'story',
      parentId: 'demo-ep-3',
      title: 'Undang anggota lewat email',
      status: 'in_progress',
      description: 'Owner mengundang anggota lewat email dengan peran tertentu.',
      acceptanceCriteria:
        'Undangan baru langsung terlihat di daftar tertunda tanpa reload.\nOwner bisa membatalkan undangan, dan link di email berhenti berlaku.',
      sourceSection: 'R1 Owner bisa mengundang dengan email dan peran (wajib).',
      participantIds: ['demo-rina', 'demo-dimas', 'demo-sari', 'demo-budi'],
      createdAt: ago(2.9),
    }),
    item({
      id: 'demo-st-13',
      kind: 'story',
      parentId: 'demo-ep-3',
      title: 'Terima undangan dan bergabung',
      status: 'done',
      acceptanceCriteria: 'Penerima bergabung dengan peran dari undangan.',
      participantIds: ['demo-rina', 'demo-dimas', 'demo-sari'],
      createdAt: ago(2.8),
    }),
    item({
      id: 'demo-st-14',
      kind: 'story',
      parentId: 'demo-ep-3',
      title: 'Keluarkan anggota dari workspace',
      status: 'refinement',
      acceptanceCriteria: 'Owner melihat konfirmasi dengan nama anggota sebelum mengeluarkannya.',
      participantIds: ['demo-rina', 'demo-dimas', 'demo-sari', 'demo-budi'],
      createdAt: ago(2.7),
    }),
  ]
}

interface DemoTaskSeed {
  id: string
  title: string
  description: string
  storyId: string
  role: NonNullable<Task['role']>
  assigneeId: string
  status: Task['status']
  priority: Task['priority']
  due: number | null
  dependsOn?: string[]
}

const taskSeeds: DemoTaskSeed[] = [
  {
    id: 'demo-tk-40',
    title: 'Desain dialog undangan dan daftar tertunda',
    description: 'Desktop dan mobile.',
    storyId: 'demo-st-12',
    role: 'ui_ux',
    assigneeId: 'demo-rina',
    status: 'done',
    priority: 'high',
    due: -4,
  },
  {
    id: 'demo-tk-41',
    title: 'Endpoint undangan, batal undangan, dan email',
    description: 'Kirim email berisi link 7 hari dan batalkan link saat undangan dibatalkan.',
    storyId: 'demo-st-12',
    role: 'backend',
    assigneeId: 'demo-dimas',
    status: 'in_progress',
    priority: 'high',
    due: 3,
    dependsOn: ['demo-tk-40'],
  },
  {
    id: 'demo-tk-42',
    title: 'Dialog undangan dan daftar tertunda di tab Tim',
    description: 'Tampilkan pesan server di bawah field email. Ikuti desain TK-40.',
    storyId: 'demo-st-12',
    role: 'frontend',
    assigneeId: 'demo-sari',
    status: 'todo',
    priority: 'high',
    due: 6,
    dependsOn: ['demo-tk-40'],
  },
  {
    id: 'demo-tk-43',
    title: 'Test case alur undangan',
    description: 'TC-1 dan TC-2 untuk alur utama dan gagal.',
    storyId: 'demo-st-12',
    role: 'qa',
    assigneeId: 'demo-budi',
    status: 'done',
    priority: 'medium',
    due: -2,
  },
  {
    id: 'demo-tk-44',
    title: 'Jalankan E2E Playwright di staging',
    description: 'Pakai TC-1 dan TC-2 dari story.',
    storyId: 'demo-st-12',
    role: 'qa',
    assigneeId: 'demo-budi',
    status: 'backlog',
    priority: 'medium',
    due: 8,
    dependsOn: ['demo-tk-41', 'demo-tk-42'],
  },
  {
    id: 'demo-tk-46',
    title: 'Desain konfirmasi keluarkan anggota',
    description: 'Dialog konfirmasi dengan nama anggota dan dampaknya.',
    storyId: 'demo-st-14',
    role: 'ui_ux',
    assigneeId: 'demo-rina',
    status: 'in_progress',
    priority: 'medium',
    due: -1,
  },
  {
    id: 'demo-tk-47',
    title: 'Endpoint keluarkan anggota',
    description: 'Menunggu desain story disetujui.',
    storyId: 'demo-st-14',
    role: 'backend',
    assigneeId: 'demo-dimas',
    status: 'backlog',
    priority: 'medium',
    due: null,
    dependsOn: ['demo-tk-46'],
  },
  {
    id: 'demo-tk-48',
    title: 'Tombol keluarkan di daftar anggota',
    description: 'Menunggu desain story disetujui.',
    storyId: 'demo-st-14',
    role: 'frontend',
    assigneeId: 'demo-sari',
    status: 'backlog',
    priority: 'medium',
    due: null,
    dependsOn: ['demo-tk-46'],
  },
  {
    id: 'demo-tk-49',
    title: 'Test case keluarkan anggota',
    description: 'Menunggu desain story disetujui.',
    storyId: 'demo-st-14',
    role: 'qa',
    assigneeId: 'demo-budi',
    status: 'backlog',
    priority: 'low',
    due: null,
  },
  {
    id: 'demo-tk-35',
    title: 'Endpoint terima undangan',
    description: 'Selesai di story terima undangan.',
    storyId: 'demo-st-13',
    role: 'backend',
    assigneeId: 'demo-dimas',
    status: 'done',
    priority: 'high',
    due: -7,
  },
  {
    id: 'demo-tk-36',
    title: 'Halaman terima undangan',
    description: 'Selesai di story terima undangan.',
    storyId: 'demo-st-13',
    role: 'frontend',
    assigneeId: 'demo-sari',
    status: 'done',
    priority: 'high',
    due: -6,
  },
  {
    id: 'demo-tk-37',
    title: 'Desain halaman terima undangan',
    description: 'Satu layar, desktop dan mobile.',
    storyId: 'demo-st-13',
    role: 'ui_ux',
    assigneeId: 'demo-rina',
    status: 'done',
    priority: 'medium',
    due: -9,
  },
]

export function demoTasks(): Task[] {
  return taskSeeds.map((seed, index) => ({
    id: seed.id,
    projectId: DEMO_PROJECT_ID,
    title: seed.title,
    description: seed.description,
    status: seed.status,
    priority: seed.priority,
    assigneeId: seed.assigneeId,
    assigneeEmail: demoMembers.find((member) => member.id === seed.assigneeId)?.email ?? null,
    dueDate: seed.due === null ? null : dateIn(seed.due),
    position: String(index + 1),
    createdAt: ago(2),
    updatedAt: ago(1),
    storyId: seed.storyId,
    role: seed.role,
    locked: false,
    dependsOn: seed.dependsOn ?? [],
    subtaskDone: 0,
    subtaskTotal: 0,
  }))
}

export function demoPlanningTasks(tasks: Task[]): PlanningTask[] {
  return tasks.map((task) => ({
    id: task.id,
    storyId: task.storyId ?? '',
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    publishedAt: ago(2),
  }))
}

export function demoSubtasks(): Record<string, Subtask[]> {
  const sub = (id: string, title: string, done: boolean, email: string): Subtask => ({ id, title, done, assigneeEmail: email })
  return {
    'demo-tk-41': [
      sub('demo-sub-1', 'Validasi email dan tolak anggota yang sudah ada', true, 'dimas@contoh.test'),
      sub('demo-sub-2', 'Simpan token undangan sebagai hash dengan masa berlaku 7 hari', true, 'dimas@contoh.test'),
      sub('demo-sub-3', 'Rate limit 20 undangan per jam per workspace', false, 'dimas@contoh.test'),
      sub('demo-sub-4', 'Test route untuk undangan kedaluwarsa dan batal', false, 'dimas@contoh.test'),
    ],
    'demo-tk-42': [
      sub('demo-sub-5', 'Dialog undangan dengan pilihan peran', false, 'sari@contoh.test'),
      sub('demo-sub-6', 'Daftar undangan tertunda dengan sisa waktu', false, 'sari@contoh.test'),
      sub('demo-sub-7', 'Pesan error dari server di bawah field email', false, 'sari@contoh.test'),
    ],
    'demo-tk-40': [
      sub('demo-sub-8', 'Layar desktop', true, 'rina@contoh.test'),
      sub('demo-sub-9', 'Layar mobile', true, 'rina@contoh.test'),
    ],
    'demo-tk-46': [
      sub('demo-sub-10', 'Dialog konfirmasi', true, 'rina@contoh.test'),
      sub('demo-sub-11', 'Status setelah dikeluarkan', false, 'rina@contoh.test'),
    ],
  }
}

export function demoStories(): Record<string, StoryDetails> {
  return {
    'demo-st-12': {
      storyId: 'demo-st-12',
      stage: 'in_progress',
      userStory: {
        role: 'owner workspace',
        action: 'mengundang anggota lewat email dengan peran tertentu',
        benefit: 'mereka bisa membaca dokumentasi API tanpa bantuan developer',
      },
      flow: `## Alur utama
1. Owner membuka tab Tim dan menekan Undang anggota.
2. Dialog meminta email dan peran (Editor atau Viewer).
3. Setelah dikirim, undangan muncul di daftar Undangan tertunda dengan sisa waktu berlaku.
4. Penerima mendapat email berisi link yang berlaku 7 hari.

## Alur gagal
- Email sudah menjadi anggota: tampilkan pesan dari server di bawah field email.
- Lebih dari 20 undangan per jam: tombol kirim dinonaktifkan dan pesan server ditampilkan.`,
      definitionOfDone: [
        { id: 'demo-dod-1', text: 'Desain dialog undangan dan daftar tertunda disetujui PM', role: 'ui_ux', done: true },
        { id: 'demo-dod-2', text: 'Kontrak POST /workspaces/{id}/invites ada di dokumentasi API', role: 'backend', done: true },
        { id: 'demo-dod-3', text: 'Test case ditulis untuk alur utama dan alur gagal', role: 'qa', done: true },
        { id: 'demo-dod-4', text: 'Endpoint undangan dan batal undangan berjalan di staging', role: 'backend', done: false },
        { id: 'demo-dod-5', text: 'Dialog dan daftar tertunda tampil sesuai desain', role: 'frontend', done: false },
        { id: 'demo-dod-6', text: 'Semua test case lulus di E2E Playwright', role: 'qa', done: false },
      ],
      designs: [
        {
          id: 'demo-design-1',
          title: 'Dialog undang anggota',
          url: 'https://example.com/design/undang-anggota',
          note: '2 layar · Desktop dan mobile',
          createdBy: 'rina@contoh.test',
          viaKey: 'claude-code · rina',
        },
        {
          id: 'demo-design-2',
          title: 'Daftar undangan tertunda',
          url: 'https://example.com/design/undangan-tertunda',
          note: '1 layar',
          createdBy: 'rina@contoh.test',
          viaKey: 'claude-code · rina',
        },
      ],
      designApprovedBy: 'maya@contoh.test',
      designApprovedAt: ago(1),
      contracts: [
        { id: 'demo-contract-1', method: 'POST', path: '/workspaces/{id}/invites', requestName: 'Undang anggota', missing: false },
        { id: 'demo-contract-2', method: 'GET', path: '/workspaces/{id}/invites', requestName: 'Daftar undangan', missing: false },
        {
          id: 'demo-contract-3',
          method: 'DELETE',
          path: '/workspaces/{id}/invites/{inviteId}',
          requestName: 'Batalkan undangan',
          missing: false,
        },
      ],
      testCases: [
        {
          id: 'demo-tc-1',
          code: 'TC-1',
          title: 'Owner mengundang email baru',
          precondition: 'Login sebagai owner workspace "Payments API".',
          steps: ['Buka tab Tim.', 'Tekan "Undang anggota".', 'Isi email baru@example.com, pilih peran Viewer.', 'Tekan "Kirim undangan".'],
          expected: [
            'Dialog tertutup.',
            'Daftar "Undangan tertunda" menampilkan baru@example.com dengan peran Viewer.',
            'Sisa waktu berlaku tertulis 7 hari.',
          ],
          createdBy: 'budi@contoh.test',
          viaKey: 'codex · budi',
        },
        {
          id: 'demo-tc-2',
          code: 'TC-2',
          title: 'Email yang sudah menjadi anggota',
          precondition: 'sari@example.com sudah menjadi anggota.',
          steps: ['Undang sari@example.com sebagai Editor.'],
          expected: ['Undangan tidak dibuat.', 'Pesan dari server tampil di bawah field email.'],
          createdBy: 'budi@contoh.test',
          viaKey: 'codex · budi',
        },
      ],
    },
    'demo-st-13': {
      storyId: 'demo-st-13',
      stage: 'done',
      userStory: {
        role: 'anggota yang diundang',
        action: 'membuka link undangan dan bergabung',
        benefit: 'saya langsung bisa membaca dokumentasi API tim',
      },
      flow: '## Alur utama\n1. Penerima membuka link di email.\n2. Penerima masuk atau mendaftar.\n3. Workspace muncul di daftar workspace.',
      definitionOfDone: [
        { id: 'demo-dod-7', text: 'Desain halaman terima undangan disetujui', role: 'ui_ux', done: true },
        { id: 'demo-dod-8', text: 'Endpoint terima undangan berjalan', role: 'backend', done: true },
        { id: 'demo-dod-9', text: 'Halaman terima undangan sesuai desain', role: 'frontend', done: true },
      ],
      designs: [
        {
          id: 'demo-design-3',
          title: 'Halaman terima undangan',
          url: 'https://example.com/design/terima-undangan',
          note: '1 layar',
          createdBy: 'rina@contoh.test',
          viaKey: null,
        },
      ],
      designApprovedBy: 'arif@contoh.test',
      designApprovedAt: ago(6),
      contracts: [{ id: 'demo-contract-4', method: 'POST', path: '/invites/accept', requestName: 'Terima undangan', missing: false }],
      testCases: [],
    },
    'demo-st-14': {
      storyId: 'demo-st-14',
      stage: 'design',
      userStory: {
        role: 'owner workspace',
        action: 'mengeluarkan anggota yang sudah tidak terlibat',
        benefit: 'hanya orang yang tepat yang bisa membaca dokumentasi API',
      },
      flow: '## Alur utama\n1. Owner menekan Keluarkan di baris anggota.\n2. Dialog konfirmasi menyebut nama anggota dan dampaknya.\n3. Setelah dikonfirmasi, anggota hilang dari daftar.',
      definitionOfDone: [
        { id: 'demo-dod-10', text: 'Desain dialog konfirmasi disetujui', role: 'ui_ux', done: false },
        { id: 'demo-dod-11', text: 'Endpoint keluarkan anggota mencabut akses', role: 'backend', done: false },
        { id: 'demo-dod-12', text: 'Tombol keluarkan tampil hanya untuk owner', role: 'frontend', done: false },
        { id: 'demo-dod-13', text: 'Test case untuk owner dan non-owner', role: 'qa', done: false },
      ],
      designs: [
        {
          id: 'demo-design-4',
          title: 'Konfirmasi keluarkan anggota',
          url: 'https://example.com/design/keluarkan-anggota',
          note: '1 layar · menunggu persetujuan',
          createdBy: 'rina@contoh.test',
          viaKey: 'claude-code · rina',
        },
      ],
      designApprovedBy: null,
      designApprovedAt: null,
      contracts: [
        {
          id: 'demo-contract-5',
          method: 'DELETE',
          path: '/workspaces/{id}/members/{userId}',
          requestName: 'Keluarkan anggota',
          missing: true,
        },
      ],
      testCases: [],
    },
  }
}

export function demoEvents(): PlanningEvent[] {
  return [
    {
      id: 'demo-ev-1',
      actorId: 'demo-maya',
      apiKeyId: 'demo-key-maya',
      apiKeyName: 'claude-code laptop',
      targetKind: 'document',
      targetId: 'demo-prd-5',
      action: 'created',
      createdAt: ago(0.01),
    },
    {
      id: 'demo-ev-2',
      actorId: 'demo-maya',
      apiKeyId: 'demo-key-maya',
      apiKeyName: 'claude-code laptop',
      targetKind: 'document',
      targetId: 'demo-prd-2',
      action: 'created',
      createdAt: ago(4),
    },
    {
      id: 'demo-ev-3',
      actorId: 'demo-arif',
      apiKeyId: null,
      apiKeyName: null,
      targetKind: 'document',
      targetId: 'demo-prd-2',
      action: 'status:approved',
      createdAt: ago(2),
    },
    {
      id: 'demo-ev-4',
      actorId: 'demo-maya',
      apiKeyId: 'demo-key-maya',
      apiKeyName: 'claude-code laptop',
      targetKind: 'story',
      targetId: 'demo-st-12',
      action: 'draft_created',
      createdAt: ago(2.9),
    },
    {
      id: 'demo-ev-5',
      actorId: 'demo-maya',
      apiKeyId: null,
      apiKeyName: null,
      targetKind: 'story',
      targetId: 'demo-st-12',
      action: 'design_approved',
      createdAt: ago(1),
    },
    {
      id: 'demo-ev-6',
      actorId: 'demo-budi',
      apiKeyId: 'demo-key-budi',
      apiKeyName: 'codex qa',
      targetKind: 'story',
      targetId: 'demo-st-12',
      action: 'test_case_added',
      createdAt: ago(0.04),
    },
    {
      id: 'demo-ev-7',
      actorId: 'demo-dimas',
      apiKeyId: 'demo-key-dimas',
      apiKeyName: 'claude-code desktop',
      targetKind: 'story',
      targetId: 'demo-st-14',
      action: 'draft_created',
      createdAt: ago(1),
    },
  ]
}

export function demoComments(): Record<string, PlanningComment[]> {
  return {
    'document:demo-brd-1': [
      {
        id: 'demo-c-1',
        parentId: null,
        body: 'Undangan berlaku 7 hari.',
        isDecision: true,
        resolvedAt: null,
        createdBy: 'demo-arif',
        authorEmail: 'arif@contoh.test',
        createdAt: ago(5),
      },
      {
        id: 'demo-c-2',
        parentId: null,
        body: 'Hanya owner yang boleh mengundang di versi pertama.',
        isDecision: true,
        resolvedAt: null,
        createdBy: 'demo-maya',
        authorEmail: 'maya@contoh.test',
        createdAt: ago(5),
      },
    ],
    'document:demo-prd-5': [
      {
        id: 'demo-c-3',
        parentId: null,
        body: 'Batas 20 undangan per jam sudah cukup. Rate limit di server sudah ada.',
        isDecision: false,
        resolvedAt: null,
        createdBy: 'demo-arif',
        authorEmail: 'arif@contoh.test',
        createdAt: ago(0.004),
      },
    ],
    'task:demo-tk-41': [
      {
        id: 'demo-c-4',
        parentId: null,
        body: 'Kontrak POST /workspaces/{id}/invites sudah diperbarui: menambah respons 409 untuk email yang sudah menjadi anggota.',
        isDecision: false,
        resolvedAt: null,
        createdBy: 'demo-dimas',
        authorEmail: 'dimas@contoh.test',
        createdAt: ago(0.03),
      },
      {
        id: 'demo-c-5',
        parentId: null,
        body: 'Pesan error memakai teks dari server, frontend tidak membuat teks sendiri.',
        isDecision: true,
        resolvedAt: null,
        createdBy: 'demo-sari',
        authorEmail: 'sari@contoh.test',
        createdAt: ago(0.08),
      },
    ],
  }
}

// What the server would answer when a locked task is moved. Real errors come from the server's own locale files.
export const DEMO_LOCKED_MESSAGE = {
  id: 'Task ini masih terkunci sampai desain story disetujui.',
  en: 'This task stays locked until the story design is approved.',
}
