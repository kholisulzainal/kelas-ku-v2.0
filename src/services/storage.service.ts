import { getSupabaseClient } from './supabase';

export const BUCKETS = [
  'logos',
  'teachers',
  'students',
  'documents',
  'assignments',
  'buku_digital',
  'avatars'
] as const;

export type BucketName = typeof BUCKETS[number] | string;

export async function uploadFileToSupabaseStorage(
  bucket: BucketName,
  file: File | Blob,
  fileName?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Koneksi Supabase tidak aktif.' };
  }

  try {
    const ext = file instanceof File && file.name.includes('.') ? file.name.split('.').pop() : 'png';
    const cleanFileName = fileName || `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

    const { data, error } = await client.storage
      .from(bucket)
      .upload(cleanFileName, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.warn(`[Supabase Storage] Upload error to bucket '${bucket}':`, error.message);
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(data.path);
    return { success: true, url: publicUrlData.publicUrl };
  } catch (err: any) {
    console.error(`[Supabase Storage] Exception uploading to '${bucket}':`, err);
    return { success: false, error: err?.message || 'Gagal mengunggah berkas.' };
  }
}
