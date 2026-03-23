import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import exifr from 'exifr'
import { getUploadsDir, addSubmission, ensureUploadsDir } from '@/lib/store'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get('image') as File | null
    const latRaw = formData.get('lat')
    const lngRaw = formData.get('lng')
    const caption = (formData.get('caption') as string) || ''

    if (!image) {
      return NextResponse.json(
        { error: 'Missing image' },
        { status: 400 }
      )
    }

    const id = `wp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg'
    const filename = `${id}.${safeExt}`

    await ensureUploadsDir()
    const uploadsDir = getUploadsDir()
    const filePath = join(uploadsDir, filename)
    const bytes = await image.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    let latNum: number
    let lngNum: number

    const formLat = typeof latRaw === 'string' ? parseFloat(latRaw) : NaN
    const formLng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : NaN
    if (!Number.isNaN(formLat) && !Number.isNaN(formLng)) {
      latNum = formLat
      lngNum = formLng
    } else {
      try {
        const exif = await exifr.parse(filePath)
        if (exif?.latitude != null && exif?.longitude != null) {
          latNum = exif.latitude
          lngNum = exif.longitude
        } else {
          return NextResponse.json(
            { error: 'No location. Use "Use my location" or add coordinates. Photos from many cameras include GPS in the image.' },
            { status: 400 }
          )
        }
      } catch {
        return NextResponse.json(
          { error: 'No location found in photo. Use "Use my location" or enter coordinates.' },
          { status: 400 }
        )
      }
    }

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
