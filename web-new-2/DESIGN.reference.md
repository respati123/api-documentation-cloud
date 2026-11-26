# Design specification: Dashboard ruang kerja ringkas

## Overview

Referensi menampilkan dashboard tim yang padat di dalam bingkai aplikasi terang. Alur baca bergerak dari header halaman dan sapaan singkat ke empat kartu ringkasan, lalu ke panel kerja lebar dengan panel pendukung yang lebih sempit. Kartu putih, garis tepi abu-abu tipis, aksi biru yang terukur, aksen status kecil, dan jarak rapat menjaga banyak item tetap terlihat. Dokumen ini mencatat screenshot yang diberikan; latar mockup di sekelilingnya bukan bagian dari produk.

## Sources and evidence

| Source | State / viewport | Method | Limits |
| --- | --- | --- | --- |
| Image #1, `orca-paste-1795498134563-39228614-e215-4777-848e-ad2f3ad58226.png`; Image #2, `orca-paste-1795498187823-357765dd-f76e-4ae5-a5c0-7c42e7ee0c40.png` (keduanya diberikan 2026-11-24) | Screenshot dashboard statis yang sama, 1009 × 633 image px | Inspeksi visual | DOM dan CSS tidak diperiksa; UI tampil dalam bingkai mockup dan ukurannya sudah diskalakan; state responsif, hover, fokus, loading, dan animasi tidak diketahui |

Label bukti: **Measured** berarti diukur dari CSS atau batas elemen yang dapat diakses; **Observed** berarti terlihat langsung; **Estimated** berarti kandidat visual dari screenshot berskala, bukan nilai CSS terverifikasi; **Unknown** berarti gambar tidak memberi bukti.

## Colors

| Semantic token | Value / candidate | Role / element | Evidence / source |
| --- | --- | --- | --- |
| `color.surface.canvas` | ≈ `#F4F5F7` | Area utama di belakang kartu | **Estimated**, Image #1/#2; tampak abu-abu terang yang sejuk |
| `color.surface.card` | ≈ `#FFFFFF` | Kartu ringkasan dan panel kerja | **Observed**, Image #1/#2; kartu tampak putih dibandingkan kanvas |
| `color.text.primary` | ≈ `#25272B` | Judul, nama baris, dan nilai metrik | **Estimated**, Image #1/#2; teks netral gelap |
| `color.text.secondary` | ≈ `#70757D` | Tanggal, deskripsi, dan label | **Estimated**, Image #1/#2; teks netral redup |
| `color.border.subtle` | ≈ `#E3E6EA` | Garis kartu dan pemisah baris | **Estimated**, Image #1/#2; garis tipis dengan penekanan rendah |
| `color.action.primary` | ≈ `#1683F1` | Aksi utama, aksen terpilih, dan progres | **Estimated**, Image #1/#2; biru terang |
| `color.status.*` | Biru, hijau, amber, merah muda, dan violet; nilai tepat tidak diketahui | Jenis file, aktivitas, dan indikator status | Peran warna **Observed**; nilai CSS tepat **Unknown**, Image #1/#2 |
| `color.mockup.backdrop` | Kabur lavender-ke-biru dengan margin gelap | Bingkai presentasi di luar permukaan aplikasi | **Observed**, Image #1/#2; keluarkan dari kanvas produk |

Nilai warna ini adalah perkiraan dari screenshot, bukan token CSS atau hasil ukur kontras. Implementasi sebaiknya memakai token tema yang dibatasi ke area utama dan memilih biru yang cukup gelap untuk teks pada kontrol.

## Typography

| Role | Family / stack / candidate | Size / weight / line height | Evidence / source |
| --- | --- | --- | --- |
| Teks isi dan label | Sans netral yang ringkas; keluarga tepat **Unknown** | Sekitar 10–12 image px untuk label dan deskripsi; bobot normal | **Estimated**, Image #1/#2; screenshot sudah diskalakan |
| Judul halaman | Sans yang sama; keluarga tepat **Unknown** | Sekitar 18–20 image px; semibold atau bold | **Estimated**, Image #1/#2 |
| Nilai metrik | Sans yang sama; keluarga tepat **Unknown** | Sekitar 16–18 image px; bold | **Estimated**, Image #1/#2 |
| Path atau kode | Tidak terlihat | **Unknown** | Image #1/#2 |

Perkiraan image px bukan ukuran CSS px. File font dan font stack hasil render tidak diperiksa.

## Layout and spacing

Aplikasi terlihat di dalam bingkai membulat sekitar 859 × 550 image px pada latar mockup terpisah. Ukuran ini adalah perkiraan visual pada gambar, bukan dimensi CSS. Sidebar mengisi sisi kiri; area utama dimulai sekitar x=190 image px dan membentang sampai sisi kanan bingkai. Sidebar dicatat sebagai bukti referensi, tetapi dikecualikan dari adaptasi yang diminta.

| Token / rule | Value / candidate | Applies to | Evidence / source |
| --- | --- | --- | --- |
| `layout.content-columns` | Area kerja lebar sekitar 2/3; area pendukung sekitar 1/3 | Panel dashboard bagian bawah | **Estimated**, Image #1/#2 |
| `layout.summary-columns` | Empat kartu berukuran setara dalam satu baris | Metrik ringkasan | **Observed**, Image #1/#2 |
| `space.panel-gap` | ≈ 10–14 image px | Jarak antar kartu ringkasan dan panel | **Estimated**, Image #1/#2 |
| `space.card-padding` | ≈ 10–14 image px | Bagian dalam kartu | **Estimated**, Image #1/#2 |
| `radius.card` | ≈ 7–10 image px | Kartu ringkasan dan konten | **Estimated**, Image #1/#2; radius CSS tidak diketahui |
| `border.card` | Garis netral tipis dengan penekanan rendah | Batas kartu | **Observed**, Image #1/#2 |

## Components

- **Bilah aplikasi atas:** nama halaman dan aksi kecil di kiri, pencarian di tengah, indikator anggota dan aksi berbagi di kanan. Screenshot hanya memperlihatkan state, bukan perilaku yang sudah diuji.
- **Sapaan dan prompt:** tanggal ringkas, sapaan tebal, dan konteks satu baris berada di samping prompt agent yang lebar. `web-new-2` tidak punya prompt ini, jadi prompt tidak termasuk implementasi.
- **Kartu ringkasan:** empat permukaan setara dengan tile ikon kecil, label singkat, nilai angka yang menonjol, dan teks konteks yang lebih kecil.
- **Antrean kerja:** panel lebar dengan tiga baris ringkas, penanda jenis berwarna, serta aksi sekunder dan utama. Tidak ada padanan proses persetujuan di `web-new-2`.
- **Item terbaru:** panel sempit berisi daftar dengan jenis, metadata tanggal, dan affordance navigasi di ujung baris.
- **Daftar progres:** panel lebar dengan deskripsi tugas pendek, ikon warna di kiri, bar progres biru tipis, dan teks status. `web-new-2` tidak memiliki fitur tugas berjalan yang setara.
- **Tile orang:** panel sempit berisi grid agent bernama dan pill status. Target memiliki anggota workspace, bukan agent; gunakan hanya data anggota yang nyata di alur yang sudah ada.
- **Permukaan bersama:** kartu putih, bergaris tepi samar, dengan bayangan sedikit atau tanpa bayangan. Kontrol tampak ringkas dan umumnya membulat; ukuran CSS tepat **Unknown**.

## Assets and iconography

Ikon outline kecil ditempatkan di kotak berwarna lembut; penanda jenis file dan status memakai warna berbeda. Avatar bundar kecil terlihat di bilah atas dan sidebar. Sumber serta identitasnya **Unknown** dan tidak boleh disalin. Library ikon tertentu tidak dapat dipastikan dari screenshot.

## Responsive behavior

Hanya satu viewport statis yang tersedia. Breakpoint, reflow mobile, penanganan overflow, perilaku sidebar, dan posisi sticky **Unknown**. Layout sempit apa pun merupakan usulan implementasi, bukan observasi sumber.

## Interaction and motion

Screenshot memperlihatkan tombol, field pencarian, bar progres, dan affordance navigasi, tetapi tidak ada interaksi yang dijalankan. Hover, fokus, disabled, loading, animasi, persistensi, dan perilaku keyboard **Unknown**.

## Implementation guidance

**Pemetaan usulan untuk `web-new-2`:** gunakan `Card`, `Button`, `Badge`, `Table`, `Tabs`, `Field`, dan ikon yang sudah tersedia dari shadcn. Batasi kanvas abu-abu sejuk dan token aksi biru ke konten utama agar sidebar mempertahankan tampilannya. Gunakan workspace, member, dan history dalam tabel atau daftar. Isi ringkasan dengan role workspace, jumlah folder/request, tanggal update, daftar request koleksi, serta data member/history yang sudah tersedia. Antrean approval, prompt assistant, progres tugas, dan sistem agent tidak punya padanan perilaku di target; jangan tampilkan sebagai fitur atau data contoh.

## Unknowns and conflicts

- Kedua gambar yang diberikan tampak identik; tidak ada state kedua.
- Tidak ada URL sumber, DOM, CSS, file font, atau tampilan responsif.
- Blur pastel di sekeliling bingkai adalah latar mockup, bukan bukti kanvas produk.
- Nama, item kerja, counter, aksi, dan label agent dalam screenshot adalah contoh sumber, bukan konten target.
- Warna dan jarak merupakan perkiraan dari raster berskala. Implementasi boleh memilih biru lebih gelap untuk menjaga keterbacaan.
