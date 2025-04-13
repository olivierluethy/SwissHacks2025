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
          <header className="bg-white border-b border-gray-200 py-4 shadow-sm">
            <div className="max-w-7xl mx-auto px-6">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-800">ARCHRE</h1>
                <nav className="hidden md:flex space-x-6">
                  <a href="/" className="text-gray-800 hover:text-blue-600 transition-colors font-medium">
                    Dashboard
                  </a>
                  <a href="/" className="text-gray-500 hover:text-blue-600 transition-colors">
                    Submissions
                  </a>
                  <a href="/" className="text-gray-500 hover:text-blue-600 transition-colors">
                    Reports
                  </a>
                  <a href="/" className="text-gray-500 hover:text-blue-600 transition-colors">
                    Settings
                  </a>
                </nav>
              </div>
            </div>
          </header>
          <main className="py-8">{children}</main>
        </div>
      </body>
    </html>
  )
}


import './globals.css'