import { NextRequest, NextResponse } from 'next/server'
import { getStores, addStore } from '@/lib/store'

export async function GET() {
  try {
    const stores = await getStores()
    return NextResponse.json({ stores })
  } catch (err) {
    console.error('[mysteryshopper] stores list error:', err)
    return NextResponse.json({ error: 'Failed to load stores' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Store name required' }, { status: 400 })
    }
    const store = await addStore(name)
    return NextResponse.json({ store })
  } catch (err) {
    console.error('[mysteryshopper] add store error:', err)
    return NextResponse.json({ error: 'Failed to add store' }, { status: 500 })
  }
}
