import { supabase } from './client.js';

export async function uploadAvatar(userId, file) {
  if (!supabase || !userId || !file) return { data: null, error: new Error('Avatar upload is unavailable.') };
  const extension = file.name.split('.').pop();
  const path = `${userId}/avatar.${extension}`;
  const upload = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
  if (upload.error) return upload;
  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  return { data: { path, publicUrl: data.publicUrl }, error: null };
}
