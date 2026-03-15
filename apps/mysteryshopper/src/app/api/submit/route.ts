import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { getStores, addStore, addShelfie, getUploadsDir, ensureUploadsDir } from '@/lib/store'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const image = formData.get('image') as File | null
    const storeIdOrName = (formData.get('storeId') as string) || ''
    const caption = ((formData.get('caption') as string) || '').slice(0, 500)

    if (!image) {
      return NextResponse.json({ error: 'Missing image' }, { status: 400 })
    }
    const storeValue = storeIdOrName.trim()
    if (!storeValue) {
      return NextResponse.json({ error: 'Store required' }, { status: 400 })
    }

    let storeId: string
    let storeName: string
    const isExistingId = storeValue.startsWith('store_')
    if (isExistingId) {
      const stores = await getStores()
      const store = stores.find((s) => s.id === storeValue)
      if (!store) {
        return NextResponse.json({ error: 'Store not found' }, { status: 400 })
      }
      storeId = store.id
      storeName = store.name
    } else {
      const store = await addStore(storeValue)
      storeId = store.id
      storeName = store.name
    }

    const id = `sh_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    const ext = image.name.split('.').pop()?.toLowerCase() || 'jpg'
    const safeExt = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? ext : 'jpg'
    const filename = `${id}.${safeExt}`

    await ensureUploadsDir()
    const uploadsDir = getUploadsDir()
    const filePath = join(uploadsDir, filename)
    const bytes = await image.arrayBuffer()
    await writeFile(filePath, Buffer.from(bytes))

    await addShelfie({
      id,
      storeId,
      storeName,
      filename,
      caption,
    })

    return NextResponse.json({ ok: true, id })
  } catch (err) {
    console.error('[mysteryshopper] submit error:', err)
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 })
  }
}
