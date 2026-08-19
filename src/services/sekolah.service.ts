import { db } from './db';
import { getSupabaseClient } from './supabase';
import { syncRow } from './sync.service';
import { ProfilSekolah } from '../types';

export const sekolahService = {
  async getProfil(): Promise<ProfilSekolah> {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { data, error } = await client.from('profil_sekolah').select('*').limit(1).maybeSingle();
        if (!error && data) {
          const profile: ProfilSekolah = {
            id: data.id || 'sch-001',
            namaSekolah: data.nama_sekolah || 'SD NEGERI KITA',
            npsn: data.npsn || '',
            alamat: data.alamat || '',
            akreditasi: data.akreditasi || 'A',
            kepalaSekolah: data.kepala_sekolah || '',
            nipKepalaSekolah: data.nip_kepala_sekolah || '',
            logoUrl: data.logo_url || '',
            tahunPelajaran: data.tahun_pelajaran || '2025/2026',
            jalan: data.jalan || '',
            rtRw: data.rt_rw || '',
            dusun: data.dusun || '',
            desa: data.desa || '',
            kecamatan: data.kecamatan || '',
            kabupaten: data.kabupaten || '',
            provinsi: data.provinsi || '',
            kodePos: data.kode_pos || ''
          };
          db.profilSekolah.update(profile);
          return profile;
        }
      } catch (err) {
        console.warn('[Sekolah Service] Error fetching profile from Supabase:', err);
      }
    }
    return db.profilSekolah.get();
  },

  async getProfile(): Promise<ProfilSekolah> {
    return this.getProfil();
  },

  async updateProfil(profile: ProfilSekolah): Promise<{ success: boolean; error?: string }> {
    db.profilSekolah.update(profile);
    const res = await syncRow('profil_sekolah', profile, true);
    return { success: res.success, error: res.error };
  },

  async updateProfile(profile: ProfilSekolah): Promise<{ success: boolean; error?: string }> {
    return this.updateProfil(profile);
  }
};
