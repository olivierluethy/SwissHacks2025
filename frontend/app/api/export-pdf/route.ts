import { type NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()

    // Forward the request to the backend service
    const response = await fetch("http://localhost:8000/generate-pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
