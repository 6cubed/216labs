import { NextResponse } from 'next/server'
import { getSubmissions } from '@/lib/store'

export async function GET() {
  try {
    const list = await getSubmissions()
    return NextResponse.json(list)
  } catch (err) {
    console.error('[worldphoto] submissions error:', err)
    return NextResponse.json([], { status: 200 })
  }
}
