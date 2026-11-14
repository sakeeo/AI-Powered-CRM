/**
 * Profil data demo per jenis usaha untuk "Load Demo Workspace" (lihat demo-workspace.ts).
 * Hanya berisi data/teks domain; logika pembuatan data sama untuk semua profil.
 * Nama perusahaan, orang, dan harga adalah contoh fiktif/perkiraan untuk keperluan demo.
 */

import { DEMO_BUSINESS_INFO, type DemoBusiness } from "@/modules/organizations/demo-businesses";

/** [nama, kategori, harga IDR, sku] */
type ProductRow = [string, string, number, string];

export type DemoProfile = {
  /** Nama organisasi demo. */
  orgName: string;
  companies: { name: string; industry: string }[];
  categories: string[];
  products: ProductRow[];
  /** Indeks produk yang dibuat nonaktif (contoh produk tidak dijual lagi). */
  inactiveProducts: number[];
  /** Rentang harga produk "utama" yang menjadi item pokok deal. */
  unitPriceRange: [number, number];
  productDescription: (name: string, category: string) => string;
  needs: string[];
  /** Kunci = kategori kalah (LOST_CATEGORIES). */
  lostReasons: Record<string, string>;
  jobs: string[];
  /** Tepat 6 tim. */
  teams: string[];
  b2bPipeline: { name: string; stages: { name: string; probability: number }[] };
  dealTitle: { b2b: string; b2c: string };
  /** Akhiran jumlah pada judul deal, mis. " jamaah" → "×3 jamaah". */
  qtySuffix: string;
  dealQty: (b2b: boolean, price: number, int: (a: number, b: number) => number) => number;
  dealNote: string;
  companyNote: string;
  leadNote: string;
  /** Rentang budget lead dalam juta rupiah. */
  leadBudgetJuta: [number, number];
  unqualifiedReasons: string[];
  quotationTerms: string;
  quotationNote: string;
  /** Minimal 2 entri: entri ke-0 & ke-1 dipakai juga di notifikasi contoh. */
  activities: [string, string][];
  activityBody: string;
  feedback: [string, string, string][];
  segments: string[];
  dealWonNotification: string;
};

const DEALER: DemoProfile = {
  orgName: "RAHMAT ALAM MOTOR",
  companies: [
    { name: "CV Maju Jaya Ekspedisi", industry: "Logistik & Ekspedisi" },
    { name: "PT Cepat Antar Nusantara", industry: "Kurir" },
    { name: "Koperasi Ojek Online Arek Suroboyo", industry: "Transportasi Online" },
    { name: "PT Sinar Terang Distribusi", industry: "Distribusi FMCG" },
    { name: "UD Berkah Motor Rental", industry: "Rental Kendaraan" },
    { name: "CV Surya Rental Sidoarjo", industry: "Rental Kendaraan" },
    { name: "Universitas Dian Nusantara", industry: "Pendidikan" },
    { name: "PT Garuda Pangan Sejahtera", industry: "Makanan & Minuman" },
    { name: "Toko Sumber Rejeki", industry: "Ritel" },
    { name: "PT Mitra Boga Lestari", industry: "Restoran" },
    { name: "CV Karya Mandiri Teknik", industry: "Jasa Teknik" },
    { name: "Puskesmas Kenjeran", industry: "Kesehatan" },
    { name: "PT Nusa Agro Mandiri", industry: "Agribisnis" },
    { name: "Koperasi Karyawan Bumi Persada", industry: "Koperasi" },
    { name: "CV Delta Pratama Laundry", industry: "Laundry" },
    { name: "PT Rajawali Kurir Express", industry: "Kurir" },
    { name: "Apotek Sehat Sentosa", industry: "Farmasi" },
    { name: "PT Samudra Frozen Food", industry: "Makanan & Minuman" },
    { name: "SMK Negeri 5 Surabaya", industry: "Pendidikan" },
    { name: "CV Bintang Timur Konstruksi", industry: "Konstruksi" },
    { name: "Bengkel Mandiri Jaya", industry: "Otomotif" },
    { name: "PT Tirta Segar Depot", industry: "Air Minum" },
    { name: "Komunitas Vario Club Surabaya", industry: "Komunitas" },
    { name: "PT Lintas Gresik Logistik", industry: "Logistik & Ekspedisi" },
  ],
  categories: [
    "Honda Matic",
    "Honda Sport & Bebek",
    "Yamaha Matic",
    "Yamaha Sport",
    "Mobil Keluarga",
    "Mobil Komersial",
    "Sparepart Mesin",
    "Sparepart Kaki-kaki",
    "Oli & Cairan",
    "Aksesoris & Perlengkapan",
    "Servis & Perawatan",
    "Paket Fleet",
  ],
  products: [
    ["Honda Vario 125 CBS", "Honda Matic", 23_900_000, "HND-VAR125"],
    ["Honda Vario 160 ABS", "Honda Matic", 30_800_000, "HND-VAR160"],
    ["Honda BeAT Street", "Honda Matic", 19_100_000, "HND-BEAT"],
    ["Honda Scoopy Prestige", "Honda Matic", 24_200_000, "HND-SCOOPY"],
    ["Honda PCX 160 CBS", "Honda Matic", 32_900_000, "HND-PCX160"],
    ["Honda ADV 160 ABS", "Honda Matic", 38_500_000, "HND-ADV160"],
    ["Honda Genio CBS", "Honda Matic", 19_800_000, "HND-GENIO"],
    ["Honda Revo X", "Honda Sport & Bebek", 16_600_000, "HND-REVO"],
    ["Honda Supra GTR 150", "Honda Sport & Bebek", 27_400_000, "HND-GTR150"],
    ["Honda CB150R Streetfire", "Honda Sport & Bebek", 30_600_000, "HND-CB150R"],
    ["Honda CRF150L", "Honda Sport & Bebek", 36_300_000, "HND-CRF150L"],
    ["Yamaha NMAX 155 Connected", "Yamaha Matic", 32_500_000, "YMH-NMAX"],
    ["Yamaha Aerox 155 Connected", "Yamaha Matic", 29_700_000, "YMH-AEROX"],
    ["Yamaha Fazzio Hybrid", "Yamaha Matic", 23_900_000, "YMH-FAZZIO"],
    ["Yamaha Lexi 125", "Yamaha Matic", 22_400_000, "YMH-LEXI"],
    ["Yamaha Grand Filano Hybrid", "Yamaha Matic", 28_900_000, "YMH-FILANO"],
    ["Yamaha Gear 125", "Yamaha Matic", 19_500_000, "YMH-GEAR"],
    ["Yamaha XSR 155", "Yamaha Sport", 37_800_000, "YMH-XSR155"],
    ["Yamaha MT-15", "Yamaha Sport", 38_900_000, "YMH-MT15"],
    ["Oli Mesin MPX2 0.8L", "Oli & Cairan", 58_000, "OLI-MPX2"],
    ["Oli Yamalube Matic 0.8L", "Oli & Cairan", 54_000, "OLI-YML"],
    ["Kampas Rem Depan Set", "Sparepart Kaki-kaki", 95_000, "SPR-KRD"],
    ["Ban Luar IRC 90/90-14", "Sparepart Kaki-kaki", 285_000, "SPR-BAN"],
    ["Aki GS Astra MF", "Sparepart Mesin", 210_000, "SPR-AKI"],
    ["Busi NGK Iridium", "Sparepart Mesin", 85_000, "SPR-BUSI"],
    ["Helm KYT Full Face", "Aksesoris & Perlengkapan", 650_000, "ACC-HELM"],
    ["Jaket Riding Touring", "Aksesoris & Perlengkapan", 480_000, "ACC-JKT"],
    ["Servis Berkala 10.000 km", "Servis & Perawatan", 175_000, "SVC-10K"],
    ["Tune Up Lengkap", "Servis & Perawatan", 250_000, "SVC-TUNE"],
    ["Paket Fleet 10 Unit BeAT", "Paket Fleet", 185_000_000, "FLT-BEAT10"],
    ["Toyota Avanza 1.3 E MT", "Mobil Keluarga", 247_000_000, "MBL-AVZ13"],
    ["Toyota Raize 1.0 G CVT", "Mobil Keluarga", 260_000_000, "MBL-RAIZE"],
    ["Honda Brio Satya E CVT", "Mobil Keluarga", 189_000_000, "MBL-BRIO"],
    ["Mitsubishi Xpander Ultimate CVT", "Mobil Keluarga", 335_000_000, "MBL-XPDR"],
    ["Daihatsu Gran Max Pick Up 1.5", "Mobil Komersial", 205_000_000, "MBL-GMXPU"],
    ["Suzuki Carry Pick Up 1.5", "Mobil Komersial", 172_000_000, "MBL-CARRY"],
  ],
  inactiveProducts: [7, 16],
  unitPriceRange: [15_000_000, 400_000_000],
  productDescription: (name, cat) =>
    cat.startsWith("Servis")
      ? "Layanan bengkel resmi RAHMAT ALAM MOTOR."
      : `${name} — tersedia di showroom RAHMAT ALAM MOTOR.`,
  needs: [
    "Motor matic untuk harian ke kantor",
    "Motor operasional kurir antar paket",
    "Armada rental motor tambahan",
    "Motor untuk driver ojek online",
    "Mobil keluarga 7 penumpang",
    "Mobil pick up untuk operasional usaha",
    "Kredit kendaraan DP ringan",
    "Tukar tambah kendaraan lama",
    "Pengadaan kendaraan operasional cabang",
    "Servis berkala dan sparepart",
  ],
  lostReasons: {
    Harga: "Pelanggan menemukan harga on-the-road lebih murah di dealer lain.",
    Kompetitor: "Memilih merek lain karena promo cashback lebih besar.",
    "Kebutuhan berubah": "Rencana pembelian dibatalkan, kebutuhan berubah.",
    "Timing / anggaran": "Anggaran belum cair sampai kuartal berikutnya.",
    "Tidak responsif": "Pelanggan tidak merespons setelah 4 kali follow-up.",
    "Fitur / kualitas": "Stok warna/varian yang diminta tidak tersedia.",
    Lainnya: "Pindah domisili sehingga membatalkan pembelian.",
  },
  jobs: [
    "Manajer Operasional",
    "Staf Pengadaan",
    "Pemilik Usaha",
    "Kepala Cabang",
    "Koordinator Armada",
    "Karyawan",
    "Mahasiswa",
    "Wiraswasta",
    "Driver",
    "Bendahara",
  ],
  teams: [
    "Showroom Motor Surabaya",
    "Showroom Mobil Sidoarjo",
    "Fleet & B2B",
    "Sparepart & Aksesoris",
    "Servis Berkala",
    "Digital Leads",
  ],
  b2bPipeline: {
    name: "Fleet & B2B",
    stages: [
      { name: "Inquiry", probability: 10 },
      { name: "Survey & Penawaran", probability: 30 },
      { name: "Negosiasi Harga", probability: 60 },
      { name: "Persetujuan Kontrak", probability: 85 },
    ],
  },
  dealTitle: { b2b: "Fleet", b2c: "Pembelian" },
  qtySuffix: "",
  // Mobil (harga > Rp100 jt) dibeli dalam jumlah lebih kecil daripada motor.
  dealQty: (b2b, price, int) =>
    b2b ? (price > 100_000_000 ? int(2, 6) : int(5, 20)) : price > 100_000_000 ? 1 : int(1, 2),
  dealNote: "Pelanggan minta test drive/test ride dan simulasi cicilan sebelum keputusan.",
  companyNote: "Pelanggan korporat potensial untuk pembelian unit berulang.",
  leadNote: "Datang dari promo akhir tahun, minta brosur dan simulasi kredit.",
  leadBudgetJuta: [8, 300],
  unqualifiedReasons: [
    "Budget tidak sesuai",
    "Tidak ada kebutuhan",
    "Sudah membeli di tempat lain",
  ],
  quotationTerms:
    "Harga belum termasuk biaya STNK/BPKB. Pembayaran maksimal 7 hari setelah penawaran disetujui. Unit tersedia sesuai stok.",
  quotationNote: "Harga berlaku selama stok tersedia.",
  activities: [
    ["call", "Telepon follow-up penawaran"],
    ["meeting", "Test drive di showroom"],
    ["email", "Kirim brosur & simulasi kredit"],
    ["task", "Siapkan dokumen leasing"],
    ["note", "Catatan hasil kunjungan pelanggan"],
    ["call", "Konfirmasi ketersediaan stok warna"],
    ["meeting", "Presentasi paket fleet ke manajemen"],
    ["task", "Update harga on-the-road"],
  ],
  activityBody: "Pelanggan tertarik, menunggu keputusan pasangan. Jadwalkan ulang pekan depan.",
  feedback: [
    [
      "feedback",
      "Pelayanan sales ramah dan informatif",
      "Terima kasih, proses pembelian cepat dan jelas.",
    ],
    [
      "complaint",
      "Kendaraan baru terlambat dikirim",
      "Unit dijanjikan 3 hari tetapi baru tiba 8 hari.",
    ],
    [
      "complaint",
      "Antrean servis terlalu lama",
      "Menunggu lebih dari 2 jam padahal sudah booking.",
    ],
    [
      "feedback",
      "Usul tambah slot servis akhir pekan",
      "Banyak pelanggan hanya bisa servis di hari Sabtu/Minggu.",
    ],
    [
      "complaint",
      "STNK belum selesai melebihi estimasi",
      "Sudah 3 minggu belum ada kabar dari bagian administrasi.",
    ],
    ["feedback", "Harga sparepart kompetitif", "Perbandingan dengan toko lain cukup bersaing."],
  ],
  segments: [
    "VIP",
    "Pelanggan Loyal",
    "Fleet / B2B",
    "Ojol & Kurir",
    "Pelanggan Baru",
    "Berisiko Churn",
    "Komunitas Otomotif",
    "Keluarga Muda",
  ],
  dealWonNotification: "Pembelian unit disetujui pelanggan.",
};

const TRAVEL: DemoProfile = {
  orgName: "AMANAH TOUR & TRAVEL",
  companies: [
    { name: "Yayasan Masjid Al-Falah Rungkut", industry: "Rumah Ibadah" },
    { name: "Majelis Taklim Nurul Iman", industry: "Komunitas Pengajian" },
    { name: "Ikatan Alumni Jamaah Sidoarjo", industry: "Komunitas" },
    { name: "PT Sinar Terang Distribusi", industry: "Distribusi FMCG" },
    { name: "Koperasi Karyawan Bumi Persada", industry: "Koperasi" },
    { name: "Koperasi Syariah Amanah Umat", industry: "Koperasi Syariah" },
    { name: "BMT Berkah Ummat", industry: "Keuangan Syariah" },
    { name: "Universitas Dian Nusantara", industry: "Pendidikan" },
    { name: "SMA Islam Al-Hikmah", industry: "Pendidikan" },
    { name: "Yayasan Pendidikan Al-Ikhlas", industry: "Pendidikan" },
    { name: "PT Garuda Pangan Sejahtera", industry: "Makanan & Minuman" },
    { name: "PT Nusa Agro Mandiri", industry: "Agribisnis" },
    { name: "Klinik Pratama Sehat Sentosa", industry: "Kesehatan" },
    { name: "Apotek Sehat Sentosa", industry: "Farmasi" },
    { name: "PT Mitra Boga Lestari", industry: "Restoran" },
    { name: "CV Karya Mandiri Teknik", industry: "Jasa Teknik" },
    { name: "PT Samudra Frozen Food", industry: "Makanan & Minuman" },
    { name: "Paguyuban Pedagang Pasar Wonokromo", industry: "Komunitas Pedagang" },
    { name: "Kantor Notaris & PPAT Sejahtera", industry: "Jasa Hukum" },
    { name: "PT Lintas Gresik Logistik", industry: "Logistik & Ekspedisi" },
    { name: "Toko Sumber Rejeki", industry: "Ritel" },
    { name: "Persatuan Guru Ngaji Kenjeran", industry: "Komunitas" },
    { name: "CV Bintang Timur Konstruksi", industry: "Konstruksi" },
    { name: "Yayasan Yatim Cahaya Hati", industry: "Sosial" },
  ],
  categories: [
    "Umroh Reguler",
    "Umroh Plus",
    "Haji Khusus",
    "Badal & Layanan Ibadah",
    "Perlengkapan Ibadah",
    "Dokumen & Visa",
    "Tambahan Akomodasi",
    "Manasik & Pembinaan",
    "Paket Grup / Korporat",
  ],
  products: [
    ["Umroh Reguler 9 Hari (Hotel Bintang 3)", "Umroh Reguler", 29_500_000, "UMR-REG9"],
    ["Umroh Reguler 12 Hari (Hotel Bintang 4)", "Umroh Reguler", 33_900_000, "UMR-REG12"],
    ["Umroh Ramadhan 12 Hari", "Umroh Reguler", 39_900_000, "UMR-RMD12"],
    ["Umroh Akhir Tahun 9 Hari", "Umroh Reguler", 33_500_000, "UMR-AKH9"],
    ["Umroh VIP 9 Hari (Hotel Bintang 5)", "Umroh Reguler", 44_900_000, "UMR-VIP9"],
    ["Umroh Plus Turki 12 Hari", "Umroh Plus", 42_500_000, "UMR-TRK12"],
    ["Umroh Plus Dubai 11 Hari", "Umroh Plus", 39_800_000, "UMR-DXB11"],
    ["Umroh Plus Mesir 13 Hari", "Umroh Plus", 45_900_000, "UMR-EGY13"],
    ["Haji Khusus (ONH Plus)", "Haji Khusus", 245_000_000, "HJK-ONHPLUS"],
    ["Haji Furoda", "Haji Khusus", 385_000_000, "HJK-FURODA"],
    ["Badal Umroh", "Badal & Layanan Ibadah", 3_500_000, "BDL-UMR"],
    ["Badal Haji", "Badal & Layanan Ibadah", 15_000_000, "BDL-HJI"],
    [
      "Paket Perlengkapan Umroh (koper, ihram, mukena)",
      "Perlengkapan Ibadah",
      1_750_000,
      "PRL-PAKET",
    ],
    ["Kain Ihram Premium", "Perlengkapan Ibadah", 350_000, "PRL-IHRAM"],
    ["Mukena Travel", "Perlengkapan Ibadah", 275_000, "PRL-MUKENA"],
    ["Buku Doa & Panduan Manasik", "Perlengkapan Ibadah", 85_000, "PRL-BUKU"],
    ["Pengurusan Paspor", "Dokumen & Visa", 650_000, "DOK-PASPOR"],
    ["Visa Umroh", "Dokumen & Visa", 2_250_000, "DOK-VISA"],
    ["Koordinasi Vaksin Meningitis", "Dokumen & Visa", 450_000, "DOK-VAKSIN"],
    ["Upgrade Kamar Double", "Tambahan Akomodasi", 4_500_000, "AKM-DOUBLE"],
    ["Upgrade Hotel Bintang 5", "Tambahan Akomodasi", 6_500_000, "AKM-BTG5"],
    ["Tambahan 2 Hari di Madinah", "Tambahan Akomodasi", 2_750_000, "AKM-MDN2"],
    ["Manasik Umroh Privat", "Manasik & Pembinaan", 750_000, "MNS-PRIVAT"],
    ["Pembinaan Pra-Haji", "Manasik & Pembinaan", 1_500_000, "MNS-HAJI"],
    ["Paket Grup Umroh 45 Jamaah", "Paket Grup / Korporat", 1_282_500_000, "GRP-UMR45"],
  ],
  inactiveProducts: [7],
  // Item pokok deal = paket umroh; paket haji tetap tersedia di katalog & quotation.
  unitPriceRange: [25_000_000, 50_000_000],
  productDescription: (name, cat) =>
    cat.startsWith("Umroh") || cat.startsWith("Haji")
      ? `${name} — termasuk tiket pesawat, hotel, visa, dan pembimbing ibadah. Diselenggarakan AMANAH TOUR & TRAVEL.`
      : `${name} — layanan pendukung jamaah AMANAH TOUR & TRAVEL.`,
  needs: [
    "Umroh keluarga 4 orang akhir tahun",
    "Umroh bersama orang tua lansia",
    "Daftar haji khusus untuk 2 orang",
    "Umroh Ramadhan",
    "Umroh plus Turki",
    "Program umroh reward karyawan",
    "Umroh rombongan majelis taklim",
    "Badal umroh untuk orang tua",
    "Tabungan atau cicilan umroh",
    "Konsultasi dokumen paspor & visa",
  ],
  lostReasons: {
    Harga: "Memilih travel lain dengan harga paket lebih murah.",
    Kompetitor: "Bergabung dengan rombongan travel lain dari lingkungan pengajian.",
    "Kebutuhan berubah": "Keberangkatan ditunda karena kondisi kesehatan orang tua.",
    "Timing / anggaran": "Dana belum cukup, berencana menabung hingga tahun depan.",
    "Tidak responsif": "Calon jamaah tidak merespons setelah 4 kali follow-up.",
    "Fitur / kualitas": "Jadwal keberangkatan dan hotel yang diinginkan sudah penuh.",
    Lainnya: "Paspor belum selesai sebelum batas pendaftaran.",
  },
  jobs: [
    "Ketua Majelis Taklim",
    "Takmir Masjid",
    "Manajer HRD",
    "Pemilik Usaha",
    "Guru",
    "Pensiunan",
    "Ibu Rumah Tangga",
    "Wiraswasta",
    "Pegawai Negeri",
    "Bendahara",
  ],
  teams: [
    "Kantor Pusat Surabaya",
    "Cabang Sidoarjo",
    "Grup & Korporat",
    "Haji Khusus",
    "Layanan Jamaah & Dokumen",
    "Digital Leads",
  ],
  b2bPipeline: {
    name: "Grup & Korporat",
    stages: [
      { name: "Inquiry", probability: 10 },
      { name: "Presentasi Program", probability: 30 },
      { name: "Negosiasi & Kuota Kursi", probability: 60 },
      { name: "Kontrak & DP", probability: 85 },
    ],
  },
  dealTitle: { b2b: "Rombongan", b2c: "Pendaftaran" },
  qtySuffix: " jamaah",
  dealQty: (b2b, _price, int) => (b2b ? int(10, 45) : int(1, 4)),
  dealNote: "Calon jamaah minta jadwal manasik dan rincian hotel sebelum membayar DP.",
  companyNote: "Lembaga potensial untuk program umroh rombongan rutin.",
  leadNote:
    "Datang dari kajian rutin, minta brosur jadwal keberangkatan dan simulasi tabungan umroh.",
  leadBudgetJuta: [25, 120],
  unqualifiedReasons: [
    "Dana belum siap",
    "Hanya mencari informasi",
    "Sudah mendaftar di travel lain",
  ],
  quotationTerms:
    "Harga dapat berubah mengikuti kurs dan tarif maskapai. DP Rp5.000.000 per jamaah untuk mengunci kursi; pelunasan paling lambat 30 hari sebelum keberangkatan. Kuota kursi terbatas.",
  quotationNote: "Harga berlaku selama kuota kursi tersedia.",
  activities: [
    ["call", "Telepon follow-up pendaftaran"],
    ["meeting", "Manasik umroh di kantor"],
    ["email", "Kirim brosur & jadwal keberangkatan"],
    ["task", "Lengkapi dokumen paspor & vaksin"],
    ["note", "Catatan hasil kunjungan calon jamaah"],
    ["call", "Konfirmasi kuota kursi keberangkatan"],
    ["meeting", "Presentasi program umroh ke pengurus masjid"],
    ["task", "Update harga paket mengikuti kurs"],
  ],
  activityBody: "Calon jamaah tertarik, menunggu keputusan keluarga. Jadwalkan ulang pekan depan.",
  feedback: [
    [
      "feedback",
      "Pembimbing ibadah sabar dan informatif",
      "Bimbingan ibadah jelas, jamaah lansia sangat terbantu.",
    ],
    [
      "complaint",
      "Jadwal penerbangan berubah mendadak",
      "Informasi perubahan jadwal baru diterima dua hari sebelum berangkat.",
    ],
    [
      "complaint",
      "Jarak hotel tidak sesuai brosur",
      "Hotel lebih jauh dari masjid dibandingkan yang dijanjikan.",
    ],
    [
      "feedback",
      "Usul manasik akhir pekan",
      "Banyak calon jamaah hanya bisa ikut manasik di hari Sabtu/Minggu.",
    ],
    [
      "complaint",
      "Paspor terlambat dikembalikan",
      "Sudah 3 minggu belum ada kabar dari bagian dokumen.",
    ],
    ["feedback", "Perlengkapan umroh lengkap dan rapi", "Koper dan kain ihram berkualitas baik."],
  ],
  segments: [
    "VIP",
    "Alumni Jamaah",
    "Grup & Korporat",
    "Majelis Taklim",
    "Calon Jamaah Baru",
    "Berisiko Churn",
    "Jamaah Lansia",
    "Tabungan Umroh",
  ],
  dealWonNotification: "Pendaftaran jamaah disetujui dan DP diterima.",
};

export const DEMO_PROFILES: Record<DemoBusiness, DemoProfile> = { dealer: DEALER, travel: TRAVEL };
export { DEMO_BUSINESS_INFO };
