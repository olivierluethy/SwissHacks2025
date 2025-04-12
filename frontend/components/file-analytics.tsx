"use client"

import { useState, useEffect } from "react"
import { useSubmission } from "@/contexts/SubmissionContext"
import { fileService } from "@/services/file.api"
import { FileText, File, Table, Search, Eye, ExternalLink, AlertTriangle, Info } from "lucide-react"

type FileItem = {
  id: string
  name: string
  type: string
  url: string
  date?: string
  size?: number
}

type FileContentState = {
  file: FileItem
  content?: string
  loading?: boolean
  error?: string
}

const FileAnalytics = ({ id }: { id: string }) => {
  const { getSubmissionById } = useSubmission()
  const [files, setFiles] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null)
  const [fileContent, setFileContent] = useState<FileContentState | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredFiles, setFilteredFiles] = useState<FileItem[]>([])
  const [fileType, setFileType] = useState("all")
  const [showInsights, setShowInsights] = useState(true)

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        setLoading(true)
        const response = await fileService.getSubmissionFiles(id)
        setFiles(response)
        setFilteredFiles(response)
      } catch (error) {
        console.error("Error fetching files:", error)
        setError("Failed to fetch submission files")
      } finally {
        setLoading(false)
      }
    }

    fetchFiles()
  }, [id])

  useEffect(() => {
    // Filter files based on search query and file type
    let filtered = files

    if (searchQuery) {
      filtered = filtered.filter((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }

    if (fileType !== "all") {
      filtered = filtered.filter((file) => {
        if (fileType === "contracts") {
          return (
            file.type === "previous-contract" ||
            file.type === "current-contract" ||
            file.name.toLowerCase().includes("contract")
          )
        } else if (fileType === "claims") {
          return file.type === "claims-data" || file.name.toLowerCase().includes("claim")
        } else if (fileType === "exposure") {
          return file.type === "exposure-data" || file.name.toLowerCase().includes("exposure")
        } else if (fileType === "economic") {
          return file.type === "economic-data" || file.name.toLowerCase().includes("economic")
        } else if (fileType === "news") {
          return file.type === "news-report" || file.name.toLowerCase().includes("news")
        } else if (fileType === "regulatory") {
          return file.type === "regulatory-update" || file.name.toLowerCase().includes("regulatory")
        }
        return true
      })
    }

    setFilteredFiles(filtered)
  }, [files, searchQuery, fileType])

  const handleFileSelect = async (file: FileItem) => {
    try {
      setSelectedFile(file)

      // If already have content for this file, don't fetch again
      if (fileContent && fileContent.file && fileContent.file.name === file.name) {
        return
      }

      setFileContent({ loading: true, file })

      const response = await fileService.getFileContent(id, file.name)

      setFileContent({
        file,
        content: response.text,
        loading: false,
      })
    } catch (error) {
      console.error("Error fetching file content:", error)
      setFileContent({
        file,
        error: "Failed to load file content",
        loading: false,
      })
    }
  }

  const getFileIcon = (file: FileItem) => {
    switch (getFileType(file)) {
      case "contract":
        return <FileText className="w-4 h-4 text-blue-500 mr-3" />
      case "claims":
        return <AlertTriangle className="w-4 h-4 text-blue-500 mr-3" />
      case "exposure":
        return <Eye className="w-4 h-4 text-blue-500 mr-3" />
      case "economic":
        return <Table className="w-4 h-4 text-blue-500 mr-3" />
      case "news":
        return <ExternalLink className="w-4 h-4 text-blue-500 mr-3" />
      case "regulatory":
        return <Info className="w-4 h-4 text-blue-500 mr-3" />
      default:
        return <File className="w-4 h-4 text-blue-500 mr-3" />
    }
  }

  const getFileTypeLabel = (type: string) => {
    switch (type) {
      case "contract":
        return "Contract"
      case "claims":
        return "Claims Data"
      case "exposure":
        return "Exposure Data"
      case "economic":
        return "Economic Report"
      case "news":
        return "News Report"
      case "regulatory":
        return "Regulatory Update"
      default:
        return "File"
    }
  }

  const getFileType = (file: FileItem) => {
    const fileNameLower = file.name.toLowerCase()
    if (file.type === "previous-contract" || file.type === "current-contract" || fileNameLower.includes("contract")) {
      return "contract"
    } else if (file.type === "claims-data" || fileNameLower.includes("claim")) {
      return "claims"
    } else if (file.type === "exposure-data" || fileNameLower.includes("exposure")) {
      return "exposure"
    } else if (file.type === "economic-data" || fileNameLower.includes("economic")) {
      return "economic"
    } else if (file.type === "news-report" || fileNameLower.includes("news")) {
      return "news"
    } else if (file.type === "regulatory-update" || fileNameLower.includes("regulatory")) {
      return "regulatory"
    }
    return "file"
  }

  const renderFilePreview = () => {
    if (!selectedFile) {
      return <div className="flex items-center justify-center h-full text-base text-gray-500">No file selected</div>
    }

    if (fileContent?.loading) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <div className="w-6 h-6 border-3 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-3"></div>
          <p className="text-gray-600">Loading file content...</p>
        </div>
      )
    }

    if (fileContent?.error) {
      return (
        <div className="flex flex-col items-center justify-center h-full">
          <AlertTriangle className="w-6 h-6 text-red-500 mb-3" />
          <p className="text-gray-600">{fileContent.error}</p>
        </div>
      )
    }

    return (
      <div className="flex-1 flex flex-col">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 pb-3 border-b border-gray-200">{selectedFile.name}</h3>
        <pre className="flex-1 bg-gray-50 rounded-md p-4 text-sm font-mono whitespace-pre-wrap overflow-y-auto text-gray-800">
          {fileContent?.content}
        </pre>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">File Analytics</h2>
        <p className="text-sm text-gray-500">Analyze and extract insights from submission files</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-6 min-h-[500px]">
        <div className="bg-white rounded-lg shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search files..."
                className="w-full py-2 pl-8 pr-2 border border-gray-300 rounded-md text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="w-full">
              <select
                value={fileType}
                onChange={(e) => setFileType(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md text-sm text-gray-600 bg-white"
              >
                <option value="all">All Files</option>
                <option value="contracts">Contracts</option>
                <option value="claims">Claims Data</option>
                <option value="exposure">Exposure Data</option>
                <option value="economic">Economic Reports</option>
                <option value="news">News Reports</option>
                <option value="regulatory">Regulatory Updates</option>
              </select>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <div className="w-6 h-6 border-3 border-gray-100 border-t-blue-500 rounded-full animate-spin mb-3"></div>
                <p className="text-gray-600">Loading files...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <AlertTriangle className="w-6 h-6 text-red-500 mb-3" />
                <p className="text-gray-600">{error}</p>
                <button
                  className="mt-3 py-1.5 px-3 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </button>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-6 text-center">
                <p className="text-gray-600">No files found</p>
                {searchQuery && (
                  <button
                    className="mt-3 py-1.5 px-3 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
                    onClick={() => setSearchQuery("")}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              filteredFiles.map((file, index) => (
                <div
                  key={index}
                  className={`flex items-center p-3 rounded-md cursor-pointer transition-colors ${
                    selectedFile && selectedFile.name === file.name
                      ? "bg-blue-50 border-l-3 border-blue-500"
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => handleFileSelect(file)}
                >
                  {getFileIcon(file)}
                  <div className="flex flex-col">
                    <span className="text-sm text-gray-800">{file.name}</span>
                    <span className="text-xs text-gray-500">{getFileTypeLabel(getFileType(file))}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 flex flex-col">{renderFilePreview()}</div>
      </div>
    </div>
  )
}

export default FileAnalytics
