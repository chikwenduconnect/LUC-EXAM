import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getValidUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    return url;
  }
  
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
    } catch (e) {}
  }
  return 'https://placeholder.supabase.co';
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = getValidUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase is not configured or using placeholder URL, pass through immediately
  // to avoid hanging network timeouts on requests
  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('placeholder.supabase.co') ||
    supabaseAnonKey === 'placeholder'
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookieOptions: {
        sameSite: 'none',
        secure: true,
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set({ name, value, ...options, sameSite: 'none', secure: true })
          );
        },
      },
    }
  );

  // Refresh session if expired
  try {
    await supabase.auth.getUser();
  } catch {
    // Ignore auth session refresh errors in middleware
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
