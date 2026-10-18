export const dynamic = 'force-dynamic';

export async function GET() {
  const revision =
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.WEB_REVISION ??
    'local-working-tree';

  return Response.json(
    { revision, service: 'stockpilot-web' as const },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    },
  );
}
