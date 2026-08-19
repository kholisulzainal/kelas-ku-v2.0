/**
 * Normalizes and extracts class level (1-12) from any string.
 * Handles digits ("Kelas 5", "5A", "5-B", "Kls 5")
 * and Roman numerals ("Kelas V", "VI", "IV", "III", "II", "I")
 */
export function extractClassLevel(str?: string | null): number | null {
  if (!str) return null;
  const s = String(str).trim();
  if (!s || s.toLowerCase() === 'semua' || s.toLowerCase() === 'semua kelas' || s.toLowerCase() === 'all' || s.toLowerCase() === 'semua kelas / wali') {
    return null; // Represents universal / all
  }

  // 1. Check for explicit "Kelas" or "Kls" followed by Roman numeral: e.g. "Kelas VI", "Kelas IV", "Kls V"
  const romanRegex = /\b(?:kelas|kls|grade)?\s*\b(XII|XI|X|IX|VIII|VII|VI|IV|V|III|II|I)\b/i;
  const romanMatch = s.match(romanRegex);
  if (romanMatch && romanMatch[1]) {
    const roman = romanMatch[1].toUpperCase();
    const map: Record<string, number> = {
      'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6,
      'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10, 'XI': 11, 'XII': 12
    };
    if (map[roman] !== undefined) return map[roman];
  }

  // 2. Check for digits: e.g. "Kelas 6", "Kls 5", "6A", "5-B", "Kelas 4"
  const digitRegex = /\b(?:kelas|kls|grade)?\s*(\d{1,2})\b/i;
  const digitMatch = s.match(digitRegex);
  if (digitMatch && digitMatch[1]) {
    const num = parseInt(digitMatch[1], 10);
    if (num >= 1 && num <= 12) return num;
  }

  // 3. Fallback: Standalone Roman numeral anywhere
  const standaloneRoman = s.match(/\b(VI|IV|V|III|II|I)\b/i);
  if (standaloneRoman && standaloneRoman[1]) {
    const roman = standaloneRoman[1].toUpperCase();
    const map: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5, 'VI': 6 };
    if (map[roman] !== undefined) return map[roman];
  }

  return null;
}

/**
 * Checks if two class descriptors refer to the exact same class / grade.
 */
export function isSameClassLevel(classA?: string | null, classB?: string | null): boolean {
  if (!classA || !classB) return false;
  const cleanA = classA.trim().toLowerCase();
  const cleanB = classB.trim().toLowerCase();
  if (cleanA === cleanB) return true;

  const lvlA = extractClassLevel(classA);
  const lvlB = extractClassLevel(classB);

  if (lvlA !== null && lvlB !== null) {
    return lvlA === lvlB;
  }

  return cleanA.includes(cleanB) || cleanB.includes(cleanA);
}

/**
 * Strictly verifies whether a task belongs to a specific target class.
 * Inspects task.kelas, mapel.kelas, task.judulTugas, and task.deskripsi.
 */
export function isTaskForTargetClass(
  task: { kelas?: string; judulTugas?: string; deskripsi?: string; mapelId?: string },
  targetClass: string,
  mapels?: { id: string; kelas?: string; namaMapel?: string }[]
): boolean {
  if (!targetClass || targetClass === 'Semua' || targetClass === 'Semua Kelas' || targetClass === 'all') {
    return true;
  }

  const targetLevel = extractClassLevel(targetClass);
  const mapel = mapels?.find(m => m.id === task.mapelId);

  // 1. If task has an explicit kelas field
  if (task.kelas && task.kelas.trim() !== '' && task.kelas.toLowerCase() !== 'semua' && task.kelas.toLowerCase() !== 'semua kelas') {
    const taskLevel = extractClassLevel(task.kelas);
    if (targetLevel !== null && taskLevel !== null) {
      return taskLevel === targetLevel;
    }
    return isSameClassLevel(task.kelas, targetClass);
  }

  // 2. If subject has a specific kelas
  if (mapel?.kelas && mapel.kelas.trim() !== '' && mapel.kelas.toLowerCase() !== 'semua' && mapel.kelas.toLowerCase() !== 'semua kelas') {
    const mapelLevel = extractClassLevel(mapel.kelas);
    if (targetLevel !== null && mapelLevel !== null) {
      return mapelLevel === targetLevel;
    }
    return isSameClassLevel(mapel.kelas, targetClass);
  }

  // 3. Inspect task title and description for specific class indicators (e.g., "Kelas VI", "Kelas 6", "Kelas 4", "Kelas 5")
  const titleLevel = extractClassLevel(task.judulTugas);
  if (titleLevel !== null && targetLevel !== null) {
    return titleLevel === targetLevel;
  }

  const descLevel = extractClassLevel(task.deskripsi);
  if (descLevel !== null && targetLevel !== null) {
    return descLevel === targetLevel;
  }

  // If no specific class is identified anywhere, check if subject belongs to targetClass
  if (mapel?.kelas) {
    return isSameClassLevel(mapel.kelas, targetClass);
  }

  return false;
}

export function isTaskForStudentClass(
  taskKelas?: string | null,
  studentKelas?: string | null,
  taskMeta?: { judulTugas?: string; deskripsi?: string; mapelId?: string },
  mapels?: { id: string; kelas?: string; namaMapel?: string }[]
): boolean {
  if (!studentKelas) return true;
  if (!taskKelas || taskKelas === 'Semua' || taskKelas === 'Semua Kelas' || taskKelas === 'Semua Kelas / Wali' || taskKelas.trim() === '') {
    if (taskMeta) {
      return isTaskForTargetClass({ ...taskMeta, kelas: taskKelas || undefined }, studentKelas, mapels);
    }
    return true;
  }

  return isSameClassLevel(taskKelas, studentKelas);
}

