import { supabase } from '@/lib/supabaseClient';

export async function uploadProblemPhoto(file: File): Promise<string> {
  const ext = file.name.split('.').pop();
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const filePath = `problems/${fileName}`;

  const { error } = await supabase.storage
    .from('boulder-photos')
    .upload(filePath, file);

  if (error) throw error;

  const { data } = supabase.storage
    .from('boulder-photos')
    .getPublicUrl(filePath);

  return data.publicUrl;
}
