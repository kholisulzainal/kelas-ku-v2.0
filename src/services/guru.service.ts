import { db } from './db';
import { getSupabaseClient } from './supabase';
import { syncRow, deleteRow } from './sync.service';
import { Guru } from '../types';

export const guruService = {
  async getAll(): Promise<Guru[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('guru').select('*');
        if (!error && data) {
          const teachers: Guru[] = data.map(g => ({
            id: g.id,
            nip: g.nip,
            namaGuru: g.nama_guru,
            gelar: g.gelar || '',
            mataPelajaranUtama: g.mata_pelajaran_utama || '',
            fotoUrl: g.foto_url || '',
            statusKepegawaian: g.status_kepegawaian || 'PNS',
            password: g.password || 'guru123',
            isWaliKelas: Boolean(g.is_wali_kelas),
            kelasWali: g.kelas_wali || '',
            googleEmail: g.google_email || ''
          }));
          db.guru.save(teachers);
          return teachers;
        }
      } catch (err) {
        console.warn('[Guru Service] Error fetching teachers from Supabase:', err);
      }
    }
    return db.guru.getAll();
  },

  async upsert(guru: Guru): Promise<{ success: boolean; error?: string }> {
    db.guru.upsert(guru);
    const res = await syncRow('guru', guru, true);
    return { success: res.success, error: res.error };
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    db.guru.delete(id);
    const res = await deleteRow('guru', id);
    return { success: res.success, error: res.error };
  }
};
