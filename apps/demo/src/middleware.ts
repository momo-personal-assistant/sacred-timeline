import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * API Authentication Middleware
 *
 * Protects API routes with a shared API key.
 * Set API_SECRET_KEY environment variable to enable authentication.
 *
 * Usage:
 * - Add x-api-key header to API requests
 * - Or pass ?api_key=xxx query parameter (for browser testing)
 */
export function middleware(request: NextRequest) {
  // Skip auth for non-API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip auth for health check endpoint
  if (request.nextUrl.pathname === '/api/health') {
    return NextResponse.next();
  }

  // Skip auth for system status (used by UI)
  if (request.nextUrl.pathname === '/api/system-status') {
    return NextResponse.next();
  }

  const validKey = process.env.API_SECRET_KEY;

  // If no API key is configured, allow all requests (development mode)
  if (!validKey) {
    return NextResponse.next();
  }

  // Check x-api-key header
  const headerKey = request.headers.get('x-api-key');

  // Check query parameter (for browser testing)
  const queryKey = request.nextUrl.searchParams.get('api_key');

  const providedKey = headerKey || queryKey;

  if (providedKey !== validKey) {
    return NextResponse.json(
      {
        error: 'Unauthorized',
        message: 'Invalid or missing API key. Provide x-api-key header or api_key query parameter.',
      },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
