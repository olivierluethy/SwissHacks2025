import axios from "axios"

// Create an axios instance with base configuration
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.startsWith("http")
      ? process.env.NEXT_PUBLIC_API_URL
      : `https://${process.env.NEXT_PUBLIC_API_URL}`
    : "",
  headers: {
    "Content-Type": "application/json",
  },
})

// Add request interceptor to handle CORS by proxying through Next.js API routes
api.interceptors.request.use(
  (config) => {
    // If we're in the browser and the URL is the backend directly,
    // route through our Next.js API proxy to avoid CORS issues
    if (typeof window !== "undefined" && config.url && !config.url.startsWith("/api/proxy")) {
      // Extract the path from the full URL
      const urlObj = new URL(config.url, "http://localhost:8000")
      const path = urlObj.pathname.replace(/^\/api\//, "")

      // Rewrite the URL to use our proxy
      config.url = `/api/proxy/${path}`
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

export default api
