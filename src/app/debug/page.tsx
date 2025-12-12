// app/debug/page.tsx
import { supabase } from '@/lib/supabaseClient';

export default async function DebugPage() {
  const { data, error } = await supabase.from('sessions').select('*');

  return (
    <main className="p-4">
      <h1 className="text-xl font-bold mb-4">Debug Supabase</h1>
      {error && <p className="text-red-500">Error: {error.message}</p>}
      <pre className="text-sm bg-gray-600 p-2 rounded">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}

