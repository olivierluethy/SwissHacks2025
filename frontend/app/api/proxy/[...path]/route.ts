import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return await proxyRequest(req, params.path, "GET")
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return await proxyRequest(req, params.path, "POST")
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return await proxyRequest(req, params.path, "PUT")
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return await proxyRequest(req, params.path, "DELETE")
}

async function proxyRequest(req: NextRequest, pathSegments: string[], method: string) {
  try {
    const apiUrl = process.env.API_URL || "http://localhost:8000"
    const path = pathSegments.join("/")
    const url = `${apiUrl}/${path}`

    // Get request body if it exists
    let body = null
    if (method !== "GET" && method !== "HEAD") {
      body = await req.text()
    }

    // Forward the request to the backend
    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": req.headers.get("Content-Type") || "application/json",
        // Forward authorization header if present
        ...(req.headers.get("Authorization") ? { Authorization: req.headers.get("Authorization") as string } : {}),
      },
      body,
    })

    // Get response data
    const data = await response.blob()

    // Return the response with the same status and headers
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
      },
    })
  } catch (error) {
    console.error(`Error proxying ${method} request:`, error)
    return NextResponse.json({ error: "Failed to proxy request to backend" }, { status: 500 })
  }
}
