"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const Navigation = () => {
  const pathname = usePathname()

  // Don't render navigation on the dashboard page
  if (pathname === "/") {
    return null
  }

  return (
    <nav className="fixed top-0 left-0 right-0 flex justify-between items-center px-6 h-15 bg-white shadow-sm z-50">
      <div className="flex items-center">
        <Link href="/" className="text-xl font-bold text-gray-800 mr-3">
          ARCHRE
        </Link>
        <span className="text-sm text-gray-500 hidden md:inline">AI-Powered Reinsurance Analytics</span>
      </div>

      <ul className="flex gap-6">
        <li>
          <Link
            href="/"
            className={`text-sm font-medium py-1.5 border-b-2 ${
              pathname === "/"
                ? "text-blue-500 border-blue-500"
                : "text-gray-600 border-transparent hover:text-gray-800"
            } transition-colors`}
          >
            Dashboard
          </Link>
        </li>
        {/* Add more navigation items as needed */}
      </ul>
    </nav>
  )
}

export default Navigation
