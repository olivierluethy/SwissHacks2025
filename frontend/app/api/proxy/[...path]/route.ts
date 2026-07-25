import { type NextRequest, NextResponse } from "next/server"

// BUG-020: Next 15 requires params to be awaited.
type RouteContext = { params: Promise<{ path: string[] }> }

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path, "GET")
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path, "POST")
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path, "PUT")
}

export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxyRequest(req, (await ctx.params).path, "DELETE")
}

/**
 * Server-side proxy to the backend.
 *
 * SEC-002: the API token lives here and is injected server-side, so it is never
 * shipped to the browser. Do not move it to a NEXT_PUBLIC_* variable.
 */
async function proxyRequest(req: NextRequest, pathSegments: string[], method: string) {
  const apiUrl = process.env.API_URL || "http://localhost:8000"
  const path = pathSegments.map(encodeURIComponent).join("/")
  const url = `${apiUrl}/${path}${req.nextUrl.search}`

  let body: string | null = null
  if (method !== "GET" && method !== "HEAD") {
    body = await req.text()
  }

  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("Content-Type") || "application/json",
  }
  if (process.env.API_TOKEN) {
    headers["Authorization"] = `Bearer ${process.env.API_TOKEN}`
  }
  const accept = req.headers.get("Accept")
  if (accept) headers["Accept"] = accept

  try {
    const response = await fetch(url, { method, headers, body })

    const contentType = response.headers.get("Content-Type") || "application/json"

    // IMP-003: pass Server-Sent Events straight through instead of buffering the
    // whole response, which would defeat the point of streaming.
    if (contentType.includes("text/event-stream") && response.body) {
      return new NextResponse(response.body, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
        },
      })
    }

    const data = await response.blob()
    return new NextResponse(data, {
      status: response.status,
      headers: { "Content-Type": contentType },
    })
  } catch (error) {
    console.error(`Error proxying ${method} ${url}:`, error)
    return NextResponse.json(
      { error: "Failed to proxy request to backend", detail: String(error) },
      { status: 502 },
    )
  }
}
