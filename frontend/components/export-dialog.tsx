"use client"
import { X, FileText } from "lucide-react"

type ExportDialogProps = {
  isOpen: boolean
  onClose: () => void
  onExport: (format: "pdf" | "text") => void
  title: string
}

export default function ExportDialog({ isOpen, onClose, onExport, title }: ExportDialogProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold">Export Dashboard</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-gray-600 mb-4">Choose a format to export the dashboard data:</p>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => onExport("pdf")}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-10 h-10 text-red-500 mb-2" />
            <span className="font-medium">PDF Document</span>
            <span className="text-xs text-gray-500">Formatted document</span>
          </button>

          <button
            onClick={() => onExport("text")}
            className="flex flex-col items-center justify-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <FileText className="w-10 h-10 text-blue-500 mb-2" />
            <span className="font-medium">Text File</span>
            <span className="text-xs text-gray-500">Plain text format</span>
          </button>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:text-gray-800">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
