import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getUploadsDir } from '@/lib/store'

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  if (!filename || filename.includes('..')) {
    return new NextResponse('Bad request', { status: 400 })
  }
  try {
    const dir = getUploadsDir()
    const path = join(dir, filename)
    const buf = await readFile(path)
    const ext = filename.split('.').pop()?.toLowerCase() || 'jpg'
    const contentType = MIME[ext] || 'image/jpeg'
    return new NextResponse(buf, {
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return new NextResponse('Not found', { status: 404 })
  }
}
