import { MataPelajaran } from '../types';

/**
 * Extracts grade level number (1-12) from string like "Kelas 5", "bin5", "MAT-K6", "Kelas 6-A"
 */
export function extractGradeNumber(str: string | null | undefined): number | null {
  if (!str || !str.trim()) return null;
  const clean = str.trim().toLowerCase();

  // 1. Check explicit "kelas X" or "kls X"
  const matchK = clean.match(/(?:kelas|kls|class|fase\s+[a-f]\s+kelas|k|kl)\s*([0-9]{1,2}|[ivxlcdm]+)\b/);
  if (matchK) {
    const num = parseInt(matchK[1], 10);
    if (!isNaN(num) && num >= 1 && num <= 12) return num;
    const romanMap: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12 };
    if (romanMap[matchK[1]]) return romanMap[matchK[1]];
  }

  // 2. Check suffix/infix digits like "bin5", "bin-5", "bin_5", "mat6", "ipas4"
  // Match code prefix + digit e.g. bin5, mat6, ipas5, pkn4, pai6, pjok5
  const matchCode = clean.match(/(?:bin|mat|mtk|ipas|ipa|ips|pkn|ppkn|pai|pjok|big|seni|mp|mapel|sd|smp|sma)?[\s_.-]*0?([1-9]|1[0-2])(?![0-9])/);
  if (matchCode && matchCode[1]) {
    const n = parseInt(matchCode[1], 10);
    if (n >= 1 && n <= 12) return n;
  }

  // 3. Fallback: match any standalone digit 1-12
  const matchAny = clean.match(/\b0?([1-9]|1[0-2])\b/);
  if (matchAny) {
    const n = parseInt(matchAny[1], 10);
    if (n >= 1 && n <= 12) return n;
  }

  return null;
}

/**
 * Generates standard code for subject based on class and name
 * e.g. Bahasa Indonesia + Kelas 5 => "bin5"
 *      Bahasa Indonesia + Kelas 6 => "bin6"
 *      Matematika + Kelas 5 => "mat5"
 */
export function generateStandardMapelCode(namaMapel: string, kelasStr?: string): string {
  const gradeNum = extractGradeNumber(kelasStr) || extractGradeNumber(namaMapel) || 4;
  const nameLower = (namaMapel || '').toLowerCase().trim();
  
  let prefix = 'mapel';
  if (nameLower.includes('bahasa indonesia') || nameLower.includes('b.indo') || nameLower.includes('bindo') || nameLower.includes('bin')) {
    prefix = 'bin';
  } else if (nameLower.includes('matematika') || nameLower.includes('mtk') || nameLower.includes('math') || nameLower.includes('mat')) {
    prefix = 'mat';
  } else if (nameLower.includes('ipas') || nameLower.includes('ipa') || nameLower.includes('ips')) {
    prefix = 'ipas';
  } else if (nameLower.includes('pancasila') || nameLower.includes('pkn') || nameLower.includes('ppkn')) {
    prefix = 'pkn';
  } else if (nameLower.includes('inggris') || nameLower.includes('bing') || nameLower.includes('english')) {
    prefix = 'big';
  } else if (nameLower.includes('agama') || nameLower.includes('pai') || nameLower.includes('islam')) {
    prefix = 'pai';
  } else if (nameLower.includes('pjok') || nameLower.includes('jasmani') || nameLower.includes('olahraga')) {
    prefix = 'pjok';
  } else if (nameLower.includes('seni') || nameLower.includes('sbdp') || nameLower.includes('budaya')) {
    prefix = 'seni';
  } else {
    const cleanWord = nameLower.replace(/[^a-z0-9]/g, '');
    if (cleanWord.length >= 3) {
      prefix = cleanWord.slice(0, 3);
    }
  }

  return `${prefix}${gradeNum}`;
}

/**
 * Strict filter to check if a DB MataPelajaran belongs to the target class
 */
export function isMapelMatchingClassStrict(mapel: MataPelajaran, targetKelas: string): boolean {
  if (!targetKelas || targetKelas === 'Semua' || targetKelas === 'Semua Kelas') return true;

  const targetGradeNum = extractGradeNumber(targetKelas);
  
  const mapelKelasGrade = extractGradeNumber(mapel.kelas);
  const mapelKodeGrade = extractGradeNumber(mapel.kodeMapel);
  const mapelNamaGrade = extractGradeNumber(mapel.namaMapel);

  if (targetGradeNum !== null) {
    // If mapel has explicit grade in kelas attribute and it doesn't match targetGradeNum -> REJECT!
    if (mapelKelasGrade !== null && mapelKelasGrade !== targetGradeNum) {
      return false;
    }
    // If mapel has explicit grade in kodeMapel attribute (e.g. bin5 for target Kelas 6) -> REJECT!
    if (mapelKodeGrade !== null && mapelKodeGrade !== targetGradeNum) {
      return false;
    }
    // If mapel has explicit grade in namaMapel attribute -> REJECT!
    if (mapelNamaGrade !== null && mapelNamaGrade !== targetGradeNum) {
      return false;
    }

    // If any attribute explicitly matches targetGradeNum -> ACCEPT!
    if (mapelKelasGrade === targetGradeNum || mapelKodeGrade === targetGradeNum || mapelNamaGrade === targetGradeNum) {
      return true;
    }
  }

  // If mapel has no class or class is 'semua'
  if (!mapel.kelas || !mapel.kelas.trim() || ['semua', 'semua kelas'].includes(mapel.kelas.toLowerCase().trim())) {
    // But check if kodeMapel or namaMapel specifies a different grade
    if (targetGradeNum !== null) {
      if (mapelKodeGrade !== null && mapelKodeGrade !== targetGradeNum) return false;
      if (mapelNamaGrade !== null && mapelNamaGrade !== targetGradeNum) return false;
    }
    return true;
  }

  const cleanMKelas = mapel.kelas.toLowerCase().trim();
  const cleanTKelas = targetKelas.toLowerCase().trim();

  return cleanMKelas === cleanTKelas || cleanMKelas.includes(cleanTKelas) || cleanTKelas.includes(cleanMKelas);
}
