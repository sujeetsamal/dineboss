import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Path to the built installer
    const installerPath = path.join(process.cwd(), 'dist', 'DineBoss.exe');

    // Check if file exists
    if (!fs.existsSync(installerPath)) {
      return NextResponse.json(
        { error: 'Installer not found. Please build first with: npm run dist' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(installerPath);

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': 'attachment; filename="DineBoss-Setup.exe"',
        'Content-Length': fileBuffer.length,
        'Cache-Control': 'public, max-age=86400', // Cache for 1 day
      },
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download installer' },
      { status: 500 }
    );
  }
}
