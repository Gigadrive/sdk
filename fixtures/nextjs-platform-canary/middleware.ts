import { type NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.rewrite(new URL('/middleware-target', request.url));
  response.headers.set('x-canary-middleware', 'rewritten');
  return response;
}

export const config = {
  matcher: '/middleware-source',
};
