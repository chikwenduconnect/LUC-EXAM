const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { error } = await supabase.rpc('exec_sql', { sql: 'ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS programme TEXT;' });
  console.log("RPC Error:", error);
}
run();
