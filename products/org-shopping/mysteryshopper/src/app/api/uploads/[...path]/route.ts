import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { getUploadsDir } from '@/lib/store'

const SAFE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params
  const filename = pathSegments?.join('/')
  if (!filename || filename.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  const ext = filename.split('.').pop()?.toLowerCase()
  if (!ext || !SAFE_EXT.has(ext)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  try {
    const uploadsDir = getUploadsDir()
    const filePath = join(uploadsDir, filename)
    const buf = await readFile(filePath)
    const contentType = ext === 'png' ? 'image/png' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    return new NextResponse(buf, {
      headers: { 'Content-Type': contentType },
    })
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}
