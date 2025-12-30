import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = await fetch(`${process.env.SENDWO_BASE_URL}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDWO_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: "+9779844588219",               // your number for test
        message: "🚀 Test message from Shree Thaleshwor Samuh system! If you receive this, WhatsApp works!",
        type: "text"
      })
    })

    const data = await response.json()
    return NextResponse.json({ success: response.ok, data })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}