export function isTaskForStudentClass(taskKelas?: string | null, studentKelas?: string | null): boolean {
  if (!taskKelas || taskKelas === 'Semua' || taskKelas === 'Semua Kelas' || taskKelas === 'Semua Kelas / Wali' || taskKelas.trim() === '') {
    return true;
  }
  if (!studentKelas) return true;

  const tClean = taskKelas.toLowerCase().trim();
  const sClean = studentKelas.toLowerCase().trim();

  if (tClean === sClean) return true;

  // Extract digits (e.g. "4" from "Kelas 4", "4A", "Kelas 4-A")
  const tNum = tClean.match(/\d+/)?.[0];
  const sNum = sClean.match(/\d+/)?.[0];

  if (tNum && sNum && tNum === sNum) return true;

  // Check Roman numerals mapping
  const romanMap: Record<string, string> = { i: '1', ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };
  const tRoman = tClean.replace(/kelas/g, '').trim();
  const sRoman = sClean.replace(/kelas/g, '').trim();

  const tVal = tNum || romanMap[tRoman];
  const sVal = sNum || romanMap[sRoman];

  if (tVal && sVal && tVal === sVal) return true;

  return tClean.includes(sClean) || sClean.includes(tClean);
}
