import { db } from './db';
import { getSupabaseClient, syncRowToSupabase, deleteRowFromSupabase } from './supabase';
import { Siswa } from '../types';

export const siswaService = {
  async getAll(): Promise<Siswa[]> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('siswa').select('*');
        if (!error && data) {
          const students: Siswa[] = data.map(s => ({
            id: s.id,
            nisn: s.nisn,
            nis: s.nis || '',
            namaSiswa: s.nama_siswa,
            jenisKelamin: s.jenis_kelamin || 'L',
            kelas: s.kelas || 'Kelas 4-A',
            alamat: s.alamat || '',
            fotoUrl: s.foto_url || '',
            namaAyah: s.nama_ayah || '',
            namaIbu: s.nama_ibu || '',
            noTeleponOrtu: s.no_telepon_ortu || '',
            password: s.password || 'siswa123'
          }));
          db.siswa.save(students);
          return students;
        }
      } catch (err) {
        console.warn('[Siswa Service] Error fetching students from Supabase:', err);
      }
    }
    return db.siswa.getAll();
  },

  async upsert(siswa: Siswa): Promise<{ success: boolean; error?: string }> {
    db.siswa.upsert(siswa);
    const res = await syncRowToSupabase('siswa', siswa, true);
    return { success: res.success, error: res.error };
  },

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    db.siswa.delete(id);
    const res = await deleteRowFromSupabase('siswa', id);
    return { success: res.success, error: res.error };
  }
};
