import * as XLSX from 'xlsx';

/**
 * Utility to export data to genuine Excel (.xlsx) format
 */
export function exportToExcel<T extends Record<string, any>>(
  data: T[],
  headers: { key: keyof T; label: string }[],
  fileName: string,
  sheetName = 'Data'
) {
  if (!data || data.length === 0) {
    alert('Tidak ada data untuk diekspor.');
    return;
  }

  // Format data into objects where key is the column label
  const formattedData = data.map(item => {
    const rowObj: Record<string, any> = {};
    headers.forEach(h => {
      const val = item[h.key];
      rowObj[h.label] = val !== undefined && val !== null ? val : '';
    });
    return rowObj;
  });

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Auto-fit column widths
  const colWidths = headers.map(h => {
    const maxLen = Math.max(
      String(h.label || '').length,
      ...formattedData.map(row => String(row[h.label] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 4, 12), 60) };
  });
  worksheet['!cols'] = colWidths;

  // Create workbook and append sheet
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Trigger download as .xlsx
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileName}_${dateStr}.xlsx`);
}

/**
 * Alias exportToCSV to exportToExcel for full backward compatibility
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  headers: { key: keyof T; label: string }[],
  fileName: string
) {
  exportToExcel(data, headers, fileName);
}

