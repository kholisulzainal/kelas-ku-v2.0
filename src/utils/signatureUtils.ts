import QRCode from 'qrcode';
import { ProfilSekolah, Guru } from '../types';

/**
 * Generate a clean high-resolution Base64 PNG QR Code data URL
 * Uses standard 4-module quiet zone margin and high resolution for 100% scanner compatibility
 */
export async function generateQrCodeDataUrl(text: string): Promise<string> {
  try {
    const cleanText = (text || 'DOKUMEN DIGITAL TERVERIFIKASI').trim();
    return await QRCode.toDataURL(cleanText, {
      width: 600,
      margin: 4, // ISO/IEC standard 4-module quiet zone for Android camera & Google Lens detection
      color: {
        dark: '#000000',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'M'
    });
  } catch (err) {
    console.error('Error generating QR code data URL:', err);
    return '';
  }
}

/**
 * Standard QR Code Payload for Kepala Sekolah
 * Clean plain-text payload fully compliant with Android & iOS QR scanners
 */
export function getKepalaSekolahQrPayload(sekolah: ProfilSekolah): string {
  const nama = sekolah.kepalaSekolah || 'Kepala Sekolah';
  const nip = sekolah.nipKepalaSekolah || '-';
  const namaSekolah = sekolah.namaSekolah ? `Lembaga: ${sekolah.namaSekolah}` : 'Lembaga: Satuan Pendidikan';
  const npsn = sekolah.npsn ? `\nNPSN: ${sekolah.npsn}` : '';

  if (sekolah.ttdKepalaSekolahCustomQr && sekolah.ttdKepalaSekolahCustomQr.trim()) {
    return sekolah.ttdKepalaSekolahCustomQr.trim();
  }

  return `VERIFIKASI TANDA TANGAN DIGITAL\n${namaSekolah}${npsn}\n\nJabatan: Kepala Sekolah\nNama: ${nama}\nNIP: ${nip}\nStatus: Dokumen Sah & Terverifikasi Elektronik`;
}

/**
 * Cleanly format teacher name with title/degree, strictly preventing duplicate titles (gelar ganda).
 * If the name already contains degree abbreviations or the given gelar is already inside the name,
 * it returns the clean name without repeating the degree.
 */
export function formatNamaDenganGelar(rawNama?: string, rawGelar?: string): string {
  if (!rawNama || !rawNama.trim()) return '';
  let nama = rawNama.trim();

  // Normalize duplicate spaces and stray comma spacing e.g. "Name , S.Pd" -> "Name, S.Pd"
  nama = nama.replace(/\s+,\s*/g, ', ').replace(/\s{2,}/g, ' ');

  if (
    !rawGelar ||
    !rawGelar.trim() ||
    rawGelar.trim() === '-' ||
    rawGelar.trim().toLowerCase() === 'none' ||
    rawGelar.trim().toLowerCase() === 'null'
  ) {
    return nama;
  }

  const cleanGelar = rawGelar.trim().replace(/^,\s*/, '');

  // Normalization helper: remove punctuation and whitespace to compare core letters
  const strip = (str: string) => str.toLowerCase().replace(/[\.\,\s\(\)\-\_\/]/g, '');

  const namaStripped = strip(nama);
  const gelarStripped = strip(cleanGelar);

  if (!gelarStripped) return nama;

  // 1. Direct inclusion check (e.g. if name already contains the full or partial gelar stripped string)
  if (namaStripped.includes(gelarStripped)) {
    return nama;
  }

  // 2. Extract acronym or main part before parentheses or explanations e.g. "S.Pd. (Sarjana Pendidikan)" -> "S.Pd."
  const mainGelarPart = cleanGelar.split(/[\(\[\/]/)[0].trim();
  const mainGelarStripped = strip(mainGelarPart);

  if (mainGelarStripped && namaStripped.includes(mainGelarStripped)) {
    return nama;
  }

  // 3. Check if the name already has a comma-separated title suffix (e.g. "Name, S.P.d." or "Name, S.Pd")
  const parts = nama.split(',');
  if (parts.length > 1) {
    const afterFirstComma = parts.slice(1).join(', ').trim();
    const afterFirstCommaStripped = strip(afterFirstComma);

    if (afterFirstCommaStripped.length >= 2) {
      // Check if after-comma part matches or overlaps with the gelar
      if (
        gelarStripped.includes(afterFirstCommaStripped) ||
        afterFirstCommaStripped.includes(gelarStripped) ||
        (mainGelarStripped && (
          mainGelarStripped.includes(afterFirstCommaStripped) ||
          afterFirstCommaStripped.includes(mainGelarStripped)
        ))
      ) {
        return nama;
      }

      // Check common Indonesian academic degrees
      const commonGelarList = [
        'spd', 'spdi', 'spdsd', 'sag', 'skom', 'ssi', 'st', 'se', 'sh', 'ssos', 'skep', 'spsi', 'ssn', 'ss', 'sp', 'skm',
        'mpd', 'mpdi', 'mm', 'msi', 'mkom', 'mt', 'mh', 'mag', 'mak', 'med',
        'gr', 'drs', 'dra', 'prof', 'dr', 'phd'
      ];

      const isAfterCommaGelar = commonGelarList.some(
        cg => afterFirstCommaStripped === cg || afterFirstCommaStripped.startsWith(cg) || afterFirstCommaStripped.endsWith(cg)
      );
      const isGelarParamGelar = commonGelarList.some(
        cg => mainGelarStripped === cg || mainGelarStripped.startsWith(cg) || mainGelarStripped.endsWith(cg)
      );

      // If the name already has an academic title after the comma, avoid appending another duplicate
      if (isAfterCommaGelar || (isAfterCommaGelar && isGelarParamGelar)) {
        return nama;
      }
    }
  }

  // 4. Also check if the name ends with common gelar without comma (e.g. "Budi S.Pd.")
  const words = nama.split(' ');
  const lastWordStripped = strip(words[words.length - 1]);
  if (
    lastWordStripped &&
    mainGelarStripped &&
    (lastWordStripped === mainGelarStripped || mainGelarStripped.includes(lastWordStripped) || lastWordStripped.includes(mainGelarStripped))
  ) {
    return nama;
  }

  // If cleanGelar itself is descriptive only like "(Sarjana Pendidikan)" and nama has "S.Pd."
  if (cleanGelar.toLowerCase().includes('sarjana pendidikan') && (namaStripped.includes('spd') || namaStripped.includes('spdsd'))) {
    return nama;
  }

  return `${nama}, ${cleanGelar}`;
}

/**
 * Standard QR Code Payload for Guru / Wali Kelas
 * Clean plain-text payload fully compliant with Android & iOS QR scanners
 */
export function getGuruQrPayload(
  guru: { namaGuru?: string; nama?: string; gelar?: string; nip?: string } | null | undefined,
  sekolah?: ProfilSekolah
): string {
  const rawNama = guru?.namaGuru || guru?.nama || 'Guru Pengampu / Wali Kelas';
  const fullNameWithDegree = formatNamaDenganGelar(rawNama, guru?.gelar);
  const nip = guru?.nip || '-';
  const namaSekolah = sekolah?.namaSekolah ? `Lembaga: ${sekolah.namaSekolah}` : 'Lembaga: Satuan Pendidikan';

  return `VERIFIKASI TANDA TANGAN DIGITAL\n${namaSekolah}\n\nJabatan: Guru Pengampu / Wali Kelas\nNama: ${fullNameWithDegree}\nNIP: ${nip}\nStatus: Dokumen Sah & Terverifikasi Elektronik`;
}

export interface PdfSignatureOptions {
  doc: any; // jsPDF instance
  pageHeight: number;
  currentClass?: string;
  isPortrait: boolean;
  sekolah: ProfilSekolah;
  waliKelas?: {
    nama: string;
    nip: string;
    gelar?: string;
    id?: string;
    ttdOpsi?: 'manual_image' | 'qr_code' | 'none';
    ttdGambar?: string;
  };
  includeSignature?: boolean;
  startY?: number;
  location?: string;
  dateStr?: string;
}

/**
 * Core function to render official Indonesian school signature blocks on jsPDF documents.
 * Priority rule:
 * - If manual signature image is uploaded for Kepala Sekolah or Guru, renders the clean signature image.
 * - If empty/blank, automatically generates high-resolution scannable QR Code.
 */
export async function renderPdfSignatures(options: PdfSignatureOptions): Promise<void> {
  const {
    doc,
    pageHeight,
    isPortrait,
    sekolah,
    waliKelas,
    includeSignature = true,
    startY,
    location,
    dateStr
  } = options;

  if (!includeSignature) return;

  const finalY = startY !== undefined ? startY : (doc.lastAutoTable?.finalY || 150);
  const requiredSpace = 62;

  let signatureY = finalY + 12;
  if (signatureY + requiredSpace > pageHeight - 15) {
    doc.addPage();
    signatureY = 20;
  }

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const signLeftX = isPortrait ? 25 : 40;
  const signRightX = isPortrait ? 130 : 200;

  const loc = location || (sekolah.kabupaten || sekolah.kecamatan || sekolah.desa || 'Tempat');
  const printDate = dateStr || new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const showVerificationTag = sekolah.ttdTampilkanVerifikasiDigital !== false;

  // 1. SIGNATURE BLOCK KEPALA SEKOLAH (LEFT SIDE)
  doc.text('Mengetahui,', signLeftX, signatureY);
  doc.text('Kepala Sekolah', signLeftX, signatureY + 4.5);

  const ttdBoxY = signatureY + 6;
  const ttdBoxHeight = 22;

  const ksHasImage = Boolean(sekolah.ttdKepalaSekolahGambar && sekolah.ttdKepalaSekolahGambar.trim());
  const ksOpsi = sekolah.ttdKepalaSekolahOpsi;

  if (ksOpsi === 'manual_image' && ksHasImage) {
    try {
      doc.addImage(sekolah.ttdKepalaSekolahGambar, 'PNG', signLeftX, ttdBoxY, 34, 18);
    } catch (e) {
      console.warn('Error rendering Kepala Sekolah Image in PDF:', e);
    }
  } else {
    // Default / fallback: Auto QR Code
    try {
      const qrPayload = getKepalaSekolahQrPayload(sekolah);
      const qrDataUrl = await generateQrCodeDataUrl(qrPayload);
      if (qrDataUrl) {
        // High-contrast, sharp QR code with quiet zone (20x20 mm)
        doc.addImage(qrDataUrl, 'PNG', signLeftX, ttdBoxY, 20, 20);
        if (showVerificationTag) {
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          doc.text('[ Terverifikasi Digital ]', signLeftX + 10, ttdBoxY + 22.5, { align: 'center' });
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);
        }
      }
    } catch (e) {
      console.warn('Error rendering Kepala Sekolah QR in PDF:', e);
    }
  }

  const ksNameY = ttdBoxY + ttdBoxHeight + 5;
  doc.setFont('helvetica', 'bold');
  const ksNama = sekolah.kepalaSekolah || '__________________________';
  doc.text(`( ${ksNama} )`, signLeftX, ksNameY);

  doc.setFont('helvetica', 'normal');
  const ksNip = sekolah.nipKepalaSekolah ? `NIP. ${sekolah.nipKepalaSekolah}` : 'NIP. __________________________';
  doc.text(ksNip, signLeftX, ksNameY + 4.5);

  // 2. SIGNATURE BLOCK GURU / WALI KELAS (RIGHT SIDE)
  doc.text(`${loc}, ${printDate}`, signRightX, signatureY);
  doc.text('Wali Kelas / Guru Pengampu', signRightX, signatureY + 4.5);

  // Per-Teacher Signature check: if teacher has specific uploaded image, use it; otherwise auto QR
  const guruHasImage = Boolean(waliKelas?.ttdGambar && waliKelas.ttdGambar.trim());
  const guruOpsi = waliKelas?.ttdOpsi;

  if ((guruOpsi === 'manual_image' || !guruOpsi) && guruHasImage) {
    try {
      doc.addImage(waliKelas!.ttdGambar, 'PNG', signRightX, ttdBoxY, 34, 18);
    } catch (e) {
      console.warn('Error rendering Guru signature image in PDF:', e);
    }
  } else {
    // Default / fallback: Auto QR Code per specific teacher (Nama + Gelar + NIP)
    try {
      const qrPayload = getGuruQrPayload(waliKelas, sekolah);
      const qrDataUrl = await generateQrCodeDataUrl(qrPayload);
      if (qrDataUrl) {
        doc.addImage(qrDataUrl, 'PNG', signRightX, ttdBoxY, 20, 20);
        if (showVerificationTag) {
          doc.setFontSize(6.5);
          doc.setTextColor(71, 85, 105);
          doc.text('[ Terverifikasi Digital ]', signRightX + 10, ttdBoxY + 22.5, { align: 'center' });
          doc.setTextColor(0, 0, 0);
          doc.setFontSize(9);
        }
      }
    } catch (e) {
      console.warn('Error rendering Guru QR in PDF:', e);
    }
  }

  const guruNama = waliKelas?.nama || '__________________________';
  const guruNip = waliKelas?.nip ? `NIP. ${waliKelas.nip}` : 'NIP. __________________________';

  doc.setFont('helvetica', 'bold');
  doc.text(`( ${guruNama} )`, signRightX, ksNameY);

  doc.setFont('helvetica', 'normal');
  doc.text(guruNip, signRightX, ksNameY + 4.5);
}
