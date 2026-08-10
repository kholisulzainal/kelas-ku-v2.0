import { jsPDF } from 'jspdf';
import * as fs from 'fs';
import * as path from 'path';

// Types for the report
interface ProfilSekolah {
  namaSekolah: string;
  npsn: string;
  alamat: string;
  akreditasi: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
}

interface StudentRecord {
  no: number;
  nama: string;
  nisn: string;
  kelas: string;
  hadir: number;
  sakit: number;
  izin: number;
  alfa: number;
  total: number;
  persentase: number;
}

// 1. Data Mock Standar untuk Simulasi Laporan Kehadiran
const sekolah: ProfilSekolah = {
  namaSekolah: 'SD Negeri Harapan Bangsa IA',
  npsn: '20401234',
  alamat: 'Jl. Pemuda No. 45, Kecamatan Sukamaju, Kota Bandung, Jawa Barat',
  akreditasi: 'A',
  kepalaSekolah: 'Dr. H. Mulyadi, M.Pd.',
  nipKepalaSekolah: '197408122001121003'
};

const students: Omit<StudentRecord, 'hadir' | 'sakit' | 'izin' | 'alfa' | 'total' | 'persentase'>[] = [
  { no: 1, nama: 'Ahmad Fauzi', nisn: '0123456781', kelas: 'Kelas IV' },
  { no: 2, nama: 'Bambang Triyono', nisn: '0123456782', kelas: 'Kelas IV' },
  { no: 3, nama: 'Cynthia Amanda', nisn: '0123456783', kelas: 'Kelas IV' },
  { no: 4, nama: 'Dedi Kurniawan', nisn: '0123456784', kelas: 'Kelas IV' },
  { no: 5, nama: 'Elissa Putri', nisn: '0123456785', kelas: 'Kelas IV' },
  { no: 6, nama: 'Fajar Nugraha', nisn: '0123456786', kelas: 'Kelas IV' },
  { no: 7, nama: 'Gita Lestari', nisn: '0123456787', kelas: 'Kelas IV' },
  { no: 8, nama: 'Hendra Wijaya', nisn: '0123456788', kelas: 'Kelas IV' },
  { no: 9, nama: 'Indah Permata', nisn: '0123456789', kelas: 'Kelas IV' },
  { no: 10, nama: 'Joko Susilo', nisn: '0123456790', kelas: 'Kelas IV' },
  { no: 11, nama: 'Kartika Sari', nisn: '0123456791', kelas: 'Kelas IV' },
  { no: 12, nama: 'Luthfi Hakim', nisn: '0123456792', kelas: 'Kelas IV' },
  { no: 13, nama: 'Mega Utami', nisn: '0123456793', kelas: 'Kelas IV' },
  { no: 14, nama: 'Novan Saputra', nisn: '0123456794', kelas: 'Kelas IV' },
  { no: 15, nama: 'Olivia Setiawan', nisn: '0123456795', kelas: 'Kelas IV' }
];

// Generate random but realistic monthly attendance data
const attendanceRecords: StudentRecord[] = students.map(s => {
  const hadir = Math.floor(Math.random() * 4) + 18; // 18 to 21 days
  const sakit = Math.random() > 0.6 ? Math.floor(Math.random() * 2) : 0;
  const izin = Math.random() > 0.7 ? Math.floor(Math.random() * 2) : 0;
  const alfa = Math.random() > 0.85 ? 1 : 0;
  const total = hadir + sakit + izin + alfa;
  const persentase = total > 0 ? Math.round(((hadir + sakit + izin) / total) * 100) : 100;
  
  return {
    ...s,
    hadir,
    sakit,
    izin,
    alfa,
    total,
    persentase
  };
});

function generateMonthlyAttendancePDF() {
  console.log('Menyiapkan pembuatan Laporan Kehadiran Bulanan otomatis...');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const leftMargin = 15;
  const rightMargin = 195; // 210 - 15
  const centerX = pageWidth / 2;

  // 1. Gambar Logo Sekolah / Crest Vector (Standard KOP Sekolah)
  const logoX = 18;
  const logoY = 12;
  
  doc.setDrawColor(79, 70, 229); // Indigo Accent
  doc.setLineWidth(0.8);
  doc.circle(logoX + 8, logoY + 8, 9); // Outer circle
  doc.setLineWidth(0.2);
  doc.circle(logoX + 8, logoY + 8, 7.5); // Inner circle
  
  doc.setFillColor(79, 70, 229);
  doc.triangle(logoX + 8, logoY + 4, logoX + 5, logoY + 9, logoX + 11, logoY + 9, 'F');
  doc.triangle(logoX + 8, logoY + 12, logoX + 5, logoY + 7, logoX + 11, logoY + 7, 'F');

  // 2. Teks Header KOP Sekolah (Nama, NPSN, Akreditasi, Alamat)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59); // slate-800
  doc.text(sekolah.namaSekolah.toUpperCase(), centerX + 8, 14, { align: 'center' });
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105); // slate-600
  doc.text(`STATUS AKREDITASI: ${sekolah.akreditasi} | NPSN: ${sekolah.npsn}`, centerX + 8, 19, { align: 'center' });
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(sekolah.alamat, centerX + 8, 23, { align: 'center' });

  // 3. Informasi Laporan Kehadiran Bulanan
  const currentMonth = 'Juli';
  const currentYear = '2026';
  const reportTitle = 'REKAPITULASI PRESENSI SISWA';
  const subTitle = `Tahun Pelajaran: 2026/2027 | Periode: ${currentMonth} ${currentYear} | Kelas: Kelas IV`;
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`${reportTitle} | ${subTitle}`, centerX + 8, 28, { align: 'center' });

  // 4. Double Line Divider KOP Sekolah
  doc.setDrawColor(51, 65, 85); // slate-700
  doc.setLineWidth(0.6);
  doc.line(leftMargin, 31, rightMargin, 31);
  doc.setLineWidth(0.2);
  doc.line(leftMargin, 32, rightMargin, 32);

  // 5. Membuat Tabel A4 Yang Disesuaikan Sempurna (Total Lebar 180mm)
  // Kolom: No (10), Nama (50), NISN (20), Kelas (18), H (10), S (10), I (10), A (10), Total (20), % (22)
  const columns = [
    { label: 'No', width: 10, align: 'center' },
    { label: 'Nama Siswa', width: 50, align: 'left' },
    { label: 'NISN', width: 20, align: 'center' },
    { label: 'Kelas', width: 18, align: 'center' },
    { label: 'H', width: 10, align: 'center' },
    { label: 'S', width: 10, align: 'center' },
    { label: 'I', width: 10, align: 'center' },
    { label: 'A', width: 10, align: 'center' },
    { label: 'Total Hari', width: 20, align: 'center' },
    { label: 'Kehadiran (%)', width: 22, align: 'center' }
  ];

  const startY = 38;
  const headerHeight = 10;
  const rowHeight = 8;

  // Draw Header Background
  doc.setFillColor(79, 70, 229); // Royal Indigo
  doc.rect(leftMargin, startY, 180, headerHeight, 'F');

  // Draw Header Labels
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);

  let currentX = leftMargin;
  columns.forEach(col => {
    let textX = currentX;
    if (col.align === 'center') {
      textX += col.width / 2;
    } else {
      textX += 3; // padding left
    }
    const alignOpt = col.align as 'center' | 'left' | 'right';
    doc.text(col.label, textX, startY + 6.5, { align: alignOpt });
    currentX += col.width;
  });

  // Draw Data Rows
  let currentY = startY + headerHeight;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(51, 65, 85);

  attendanceRecords.forEach((record, index) => {
    // Alternating background color
    if (index % 2 === 1) {
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(leftMargin, currentY, 180, rowHeight, 'F');
    }

    // Border line at the bottom of the row
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.1);
    doc.line(leftMargin, currentY + rowHeight, rightMargin, currentY + rowHeight);

    let x = leftMargin;
    
    // Draw columns
    const drawCol = (val: string | number, colIndex: number, isBold = false, isColored = false, color: [number, number, number] = [0,0,0]) => {
      const col = columns[colIndex];
      let textX = x;
      if (col.align === 'center') {
        textX += col.width / 2;
      } else {
        textX += 3;
      }
      
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      if (isColored) {
        doc.setTextColor(color[0], color[1], color[2]);
      } else {
        doc.setTextColor(51, 65, 85);
      }

      doc.text(String(val), textX, currentY + 5, { align: col.align as 'center' | 'left' | 'right' });
      x += col.width;
    };

    // Determine percentage text and color
    const pct = record.persentase;
    let pctColor: [number, number, number] = [51, 65, 85];
    let isColored = false;
    if (pct < 85) {
      pctColor = [220, 38, 38]; // Red for low attendance
      isColored = true;
    } else if (pct >= 95) {
      pctColor = [5, 150, 105]; // Green for high attendance
      isColored = true;
    }

    drawCol(record.no, 0);
    drawCol(record.nama, 1, true);
    drawCol(record.nisn, 2);
    drawCol(record.kelas, 3);
    drawCol(record.hadir, 4);
    drawCol(record.sakit, 5);
    drawCol(record.izin, 6);
    drawCol(record.alfa, 7);
    drawCol(record.total, 8);
    drawCol(`${pct}%`, 9, true, isColored, pctColor);

    currentY += rowHeight;
  });

  // Draw Vertical and Outer border Grid Lines for maximum neatness
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.setLineWidth(0.2);
  // Outer border box
  doc.rect(leftMargin, startY, 180, headerHeight + (attendanceRecords.length * rowHeight));
  
  // Vertical splitters
  let splitX = leftMargin;
  columns.slice(0, -1).forEach(col => {
    splitX += col.width;
    doc.line(splitX, startY, splitX, currentY);
  });

  // 6. Keterangan status di bawah tabel
  currentY += 8;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('Keterangan: H = Hadir, S = Sakit, I = Izin, A = Alfa (Tanpa Keterangan)', leftMargin, currentY);

  // 7. Tanda Tangan Sekolah & Kepala Sekolah
  currentY += 15;
  const signatureY = currentY;
  const signLeftX = 35;
  const signRightX = 135;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);

  // Left Sign: Kepala Sekolah
  doc.text('Mengetahui,', signLeftX, signatureY);
  doc.text('Kepala Sekolah', signLeftX, signatureY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`( ${sekolah.kepalaSekolah} )`, signLeftX, signatureY + 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. ${sekolah.nipKepalaSekolah}`, signLeftX, signatureY + 30.5);

  // Right Sign: Wali Kelas IV
  doc.text('Lubuklinggau, 21 Juli 2026', signRightX, signatureY);
  doc.text('Wali Kelas IV', signRightX, signatureY + 4.5);
  doc.setFont('helvetica', 'bold');
  doc.text(`( Kholisul Zainal Asfan Sholikh, S.Pd. )`, signRightX, signatureY + 26);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIP. 198503142011012009`, signRightX, signatureY + 30.5);

  // Save File to root directory
  const outputPath = path.join(process.cwd(), 'Laporan_Kehadiran_Bulanan.pdf');
  const pdfOutput = doc.output('arraybuffer');
  fs.writeFileSync(outputPath, Buffer.from(pdfOutput));

  console.log(`Laporan Kehadiran Bulanan berhasil dibuat!`);
  console.log(`Lokasi file: ${outputPath}`);
}

generateMonthlyAttendancePDF();
