import type React from "react"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "ReInsight - AI-Powered Reinsurance Analytics",
  description: "Advanced reinsurance analytics platform powered by AI"
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
                <img src="/logo.png" alt="logo" />
                <nav className="hidden md:flex space-x-6">
                  <a href="/" className="text-gray-800 hover:text-blue-600 transition-colors font-medium">
                    Dashboard
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
