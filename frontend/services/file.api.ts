import { api } from "./api"

// Mock data for development
const MOCK_MODE = true // Set to false when connecting to a real API

const mockFiles = [
  {
    id: "1",
    name: "Previous_Contract_2023.pdf",
    type: "previous-contract",
    url: "#",
    size: 1240000,
    date: "2023-05-15",
  },
  {
    id: "2",
    name: "Current_Contract_2024.pdf",
    type: "current-contract",
    url: "#",
    size: 1350000,
    date: "2024-05-10",
  },
  {
    id: "3",
    name: "Claims_Data_2020-2023.xlsx",
    type: "claims-data",
    url: "#",
    size: 450000,
    date: "2024-01-20",
  },
  {
    id: "4",
    name: "Exposure_Analysis_2024.xlsx",
    type: "exposure-data",
    url: "#",
    size: 380000,
    date: "2024-02-15",
  },
]

const mockContractComparison = {
  clauses: [
    {
      id: "clause-1",
      name: "Coverage Territory",
      previousText: "This policy covers properties located in the state of Florida, excluding Monroe County.",
      currentText:
        "This policy covers properties located in the state of Florida, excluding Monroe County and coastal areas within 5 miles of the shoreline.",
      significance: "high",
      changes: [
        {
          type: "modification",
          text: "Added exclusion for coastal areas within 5 miles of the shoreline",
        },
      ],
    },
    {
      id: "clause-2",
      name: "Named Storm Deductible",
      previousText: "5% of Total Insured Value for Named Storms",
      currentText: "7% of Total Insured Value for Named Storms",
      significance: "medium",
      changes: [
        {
          type: "modification",
          text: "Increased deductible from 5% to 7%",
        },
      ],
    },
    {
      id: "clause-3",
      name: "Cyber Exclusion",
      previousText: "This policy does not cover losses directly caused by cyber attacks or data breaches.",
      currentText:
        "This policy does not cover losses directly or indirectly caused by cyber attacks, data breaches, or any electronic system failures.",
      significance: "high",
      changes: [
        {
          type: "addition",
          text: "Added indirect losses to exclusion",
        },
        {
          type: "addition",
          text: "Added electronic system failures to exclusion",
        },
      ],
    },
    {
      id: "clause-4",
      name: "Reporting Requirements",
      previousText: "The insured must report any loss or damage within 90 days of occurrence.",
      currentText: "The insured must report any loss or damage within 60 days of occurrence.",
      significance: "medium",
      changes: [
        {
          type: "modification",
          text: "Reduced reporting period from 90 days to 60 days",
        },
      ],
    },
    {
      id: "clause-5",
      name: "Flood Definition",
      previousText:
        "Flood means the overflow of inland or tidal waters and unusual accumulation of runoff of surface waters from any source.",
      currentText:
        "Flood means the overflow of inland or tidal waters, unusual accumulation of runoff of surface waters from any source, and storm surge.",
      significance: "low",
      changes: [
        {
          type: "addition",
          text: "Added storm surge to flood definition",
        },
      ],
    },
  ],
}

/**
 * File service for handling file operations
 */
export const fileService = {
  /**
   * Get all files for a submission
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Array>} Array of file objects
   */
  getSubmissionFiles: async (submissionId: string) => {
    try {
      if (MOCK_MODE) {
        // Return mock data
        return Promise.resolve(mockFiles)
      }

      const response = await api.get(`/files/${submissionId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching submission files:", error)
      // Return mock data as fallback
      return mockFiles
    }
  },

  /**
   * Upload files to a submission
   * @param {Array} files - Array of files to upload
   * @param {Object} metadata - Metadata for the files
   * @param {Function} progressCallback - Callback for upload progress
   * @returns {Promise<Object>} Upload response
   */
  uploadFiles: async (files: File[], metadata: any, progressCallback: ((progress: number) => void) | null = null) => {
    try {
      const formData = new FormData()

      // Append each file to form data
      files.forEach((file) => {
        formData.append("files", file)
      })

      // Append metadata as JSON
      formData.append("metadata", JSON.stringify(metadata))

      const response = await api.post(`/files/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressCallback && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            progressCallback(percentCompleted)
          }
        },
      })

      return response.data
    } catch (error) {
      console.error("Error uploading files:", error)
      throw error
    }
  },

  /**
   * Get content and analysis for a file
   * @param {string} submissionId - The submission ID
   * @param {string} fileName - The file name
   * @returns {Promise<Object>} File content and analysis
   */
  getFileContent: async (submissionId: string, fileName: string) => {
    try {
      if (MOCK_MODE) {
        // Return mock data based on file type
        return Promise.resolve({
          text: "Sample file content for " + fileName,
          // Add more mock data as needed
        })
      }

      const response = await api.get(`/files/${submissionId}/${fileName}/content`)
      return response.data
    } catch (error) {
      console.error("Error fetching file content:", error)
      // Return basic mock data as fallback
      return {
        text: "Sample file content for " + fileName,
      }
    }
  },

  /**
   * Download a file
   * @param {string} submissionId - The submission ID
   * @param {string} fileName - The file name
   * @returns  submissionId - The submission ID
   * @param {string} fileName - The file name
   * @returns {Promise<Blob>} File blob
   */
  downloadFile: async (submissionId: string, fileName: string) => {
    try {
      const response = await api.get(`/files/${submissionId}/${fileName}/download`, {
        responseType: "blob",
      })

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", fileName)

      // Append to html page
      document.body.appendChild(link)

      // Start download
      link.click()

      // Clean up and remove the link
      link.parentNode?.removeChild(link)

      return response.data
    } catch (error) {
      console.error("Error downloading file:", error)
      throw error
    }
  },

  /**
   * Delete a file
   * @param {string} submissionId - The submission ID
   * @param {string} fileName - The file name
   * @returns {Promise<Object>} Delete response
   */
  deleteFile: async (submissionId: string, fileName: string) => {
    try {
      const response = await api.delete(`/files/${submissionId}/${fileName}`)
      return response.data
    } catch (error) {
      console.error("Error deleting file:", error)
      throw error
    }
  },

  /**
   * Compare two contract files
   * @param {string} submissionId - The submission ID
   * @param {string} previousFile - Previous contract file name
   * @param {string} currentFile - Current contract file name
   * @returns {Promise<Object>} Comparison results
   */
  compareContracts: async (submissionId: string, previousFile: string, currentFile: string) => {
    try {
      if (MOCK_MODE) {
        // Return mock data
        return Promise.resolve(mockContractComparison)
      }

      const response = await api.post(`/files/${submissionId}/compare-contracts`, {
        previousFile,
        currentFile,
      })
      return response.data
    } catch (error) {
      console.error("Error comparing contracts:", error)
      // Return mock data as fallback
      return mockContractComparison
    }
  },

  /**
   * Analyze claims data file
   * @param {string} submissionId - The submission ID
   * @param {string} fileName - Claims data file name
   * @returns {Promise<Object>} Analysis results
   */
  analyzeClaimsData: async (submissionId: string, fileName: string) => {
    try {
      const response = await api.post(`/files/${submissionId}/analyze-claims`, {
        fileName,
      })
      return response.data
    } catch (error) {
      console.error("Error analyzing claims data:", error)
      throw error
    }
  },

  /**
   * Analyze exposure data file
   * @param {string} submissionId - The submission ID
   * @param {string} fileName - Exposure data file name
   * @returns {Promise<Object>} Analysis results
   */
  analyzeExposureData: async (submissionId: string, fileName: string) => {
    try {
      const response = await api.post(`/files/${submissionId}/analyze-exposure`, {
        fileName,
      })
      return response.data
    } catch (error) {
      console.error("Error analyzing exposure data:", error)
      throw error
    }
  },

  /**
   * Extract insights from multiple files
   * @param {string} submissionId - The submission ID
   * @param {Array<string>} fileNames - Array of file names to analyze
   * @returns {Promise<Object>} Extracted insights
   */
  extractInsights: async (submissionId: string, fileNames: string[]) => {
    try {
      const response = await api.post(`/files/${submissionId}/extract-insights`, {
        fileNames,
      })
      return response.data
    } catch (error) {
      console.error("Error extracting insights:", error)
      throw error
    }
  },
}

export default fileService
