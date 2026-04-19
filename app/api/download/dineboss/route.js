import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(req) {
  try {
    // Path to the ZIP file in the dist folder
    const zipPath = join(process.cwd(), 'dist', 'DineBoss-Complete.zip');

    // Read the ZIP file
    const fileBuffer = await readFile(zipPath);

    // Return the file with proper headers
    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="DineBoss-Complete.zip"',
        'Content-Length': fileBuffer.length,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to download DineBoss. Please try again.' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
