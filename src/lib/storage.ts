import { supabase } from './supabaseClient';

// Safe UUID generator (works on iOS Safari)
function safeUUID() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  // Fallback (RFC4122-ish)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function uploadProblemPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${safeUUID()}.${ext}`;
  const filePath = `problems/${fileName}`;

  const { error } = await supabase.storage
    .from('boulder-photos')
    .upload(filePath, file, {
      upsert: false,
    });

  if (error) {
    throw error;
  }

  const { data } = supabase.storage
    .from('boulder-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
