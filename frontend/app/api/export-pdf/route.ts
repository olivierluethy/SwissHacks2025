import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()

    // BUG-022: honour API_URL like the proxy route does; this was hardcoded to
    // port 8000, so PDF export broke whenever the backend ran anywhere else.
    const apiUrl = process.env.API_URL || "http://localhost:8000"
    const response = await fetch(`${apiUrl}/generate-pdf`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.API_TOKEN
          ? { Authorization: `Bearer ${process.env.API_TOKEN}` }
          : {}),
      },
      body: JSON.stringify(json),
    })

    if (!response.ok) {
      throw new Error(`PDF generation failed: ${response.statusText}`)
    }

    // Get the PDF as a blob
    const pdfBlob = await response.blob()

    // Return the PDF with appropriate headers
    return new NextResponse(pdfBlob, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(json.title.replace(/\s+/g, "_"))}_export.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    return NextResponse.json({ error: "Failed to generate PDF" }, { status: 500 })
  }
}
