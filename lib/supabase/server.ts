import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    getValidUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder',
    {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, sameSite: 'none', secure: true })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing user sessions.
          }
        },
      },
    }
  );
}

// Elevated privileges client for server-side trusted operations (e.g., scoring)
export function createAdminClient() {
  const { createClient } = require('@supabase/supabase-js');
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase Service Role Key');
  }
  
  return createClient(
    getValidUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
