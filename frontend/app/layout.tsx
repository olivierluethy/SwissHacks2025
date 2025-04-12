import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"
import { SubmissionProvider } from "@/contexts/SubmissionContext"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "ARCHRE - AI-Powered Reinsurance Analytics",
  description: "Advanced reinsurance analytics platform powered by AI",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SubmissionProvider>
          <div className="app">
            {/* Navigation is now conditionally rendered in each page */}
            <div className="main-content">{children}</div>
          </div>
        </SubmissionProvider>
      </body>
    </html>
  )
}


import './globals.css'