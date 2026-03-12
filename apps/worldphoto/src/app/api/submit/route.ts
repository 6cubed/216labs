import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getUploadsDir, addSubmission, ensureUploadsDir } from '@/lib/store'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get('image') as File | null
    const lat = formData.get('lat')
    const lng = formData.get('lng')
    const caption = (formData.get('caption') as string) || ''

    if (!image || typeof lat !== 'string' || typeof lng !== 'string') {
      return NextResponse.json(
        { error: 'Missing image, lat, or lng' },
        { status: 400 }
      )
    }

    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      return NextResponse.json(
        { error: 'Invalid lat or lng' },
        { status: 400 }
      )
    }

    const id = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg'
    const filename = `${id}.${safeExt}`

    await ensureUploadsDir()
    const uploadsDir = getUploadsDir()
    const path = join(uploadsDir, filename)
    const bytes = await image.arrayBuffer()
    await writeFile(path, Buffer.from(bytes))

    await addSubmission({
      id,
      lat: latNum,
      lng: lngNum,
      caption: caption.slice(0, 500),
      filename,
    })

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[worldphoto] submit error:', err)
    return NextResponse.json(
      { error: 'Submission failed' },
      { status: 500 }
    )
  }
}
