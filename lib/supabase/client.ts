import { createBrowserClient } from '@supabase/ssr';

function getValidUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  
  // If the user pasted a secret instead of a URL, let's try to extract the project ref from the anon key
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (anonKey) {
    try {
      const payloadB64 = anonKey.split('.')[1];
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
        if (payload.ref) {
          return `https://${payload.ref}.supabase.co`;
        }
      }
    } catch (e) {
      // Ignore extraction errors
    }
  }
  
  return 'https://placeholder.supabase.co';
}

export function createClient() {
  return createBrowserClient(
    getValidUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      }
    }
  );
}
