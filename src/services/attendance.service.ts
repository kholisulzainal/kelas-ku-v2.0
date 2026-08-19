import { db } from './db';
import { getSupabaseClient } from './supabase';
import { syncRow } from './sync.service';
import { Absensi } from '../types';

export const attendanceService = {
  async getAll(): Promise<Absensi[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('absensi').select('*');
        if (!error && data) {
          const items: Absensi[] = data.map(a => ({
            id: a.id,
            siswaId: a.siswa_id,
            tanggal: a.tanggal,
            status: a.status,
            keterangan: a.keterangan || '',
            dicatatOlehId: a.dicatat_oleh_id || ''
          }));
          db.absensi.save(items);
          return items;
        }
      } catch (err) {
        console.warn('[Attendance Service] Error fetching attendance from Supabase:', err);
      }
    }
    return db.absensi.getAll();
  },

  async bulkUpsert(items: Absensi[]): Promise<{ success: boolean }> {
    db.absensi.bulkUpsert(items);
    for (const item of items) {
      await syncRow('absensi', item, true);
    }
    return { success: true };
  }
};
