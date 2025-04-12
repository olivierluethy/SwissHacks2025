import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"

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
        <div className="min-h-screen bg-gray-50">
          <header className="bg-white border-b border-gray-200 py-4">
            <div className="max-w-7xl mx-auto px-6">
              <h1 className="text-xl font-bold text-gray-800">ARCHRE</h1>
            </div>
          </header>
          <main className="py-6">{children}</main>
        </div>
      </body>
    </html>
  )
}


import './globals.css'