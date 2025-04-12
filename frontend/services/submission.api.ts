import { api } from "./api"
import { v4 as uuidv4 } from "uuid"

// Flag to toggle between mock and real API based on environment variable
const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "mock"

// Mock processing delay (in milliseconds)
const MOCK_PROCESSING_DELAY = 10000

/**
 * Submission service for handling submission operations
 */
export const submissionService = {
  /**
   * Create a new submission
   * @param {Object} submissionData - Basic submission data
   * @returns {Promise<Object>} Created submission
   */
  createSubmission: async (submissionData: any) => {
    try {
      if (API_MODE === "mock") {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Create mock submission with processing status
        const mockSubmission = {
          id: uuidv4(),
          ...submissionData,
          status: "pending",
          createdAt: new Date().toISOString(),
          files: [],
        }

        // Store in localStorage for persistence in mock mode
        const existingSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
        localStorage.setItem("mockSubmissions", JSON.stringify([...existingSubmissions, mockSubmission]))

        return mockSubmission
      }

      // Real API call
      const response = await api.post("/submissions", submissionData)
      return response.data
    } catch (error) {
      console.error("Error creating submission:", error)
      throw error
    }
  },

  /**
   * Upload files to a submission
   * @param {string} submissionId - The submission ID
   * @param {File[]} files - Array of files to upload
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Upload response
   */
  uploadFiles: async (submissionId: string, files: File[], onProgress?: (progress: number) => void) => {
    try {
      if (API_MODE === "mock") {
        // Simulate file upload with progress
        let progress = 0
        const interval = setInterval(() => {
          progress += 5
          if (progress > 100) {
            clearInterval(interval)
            progress = 100
          }
          onProgress?.(progress)
        }, 300)

        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 6000))
        clearInterval(interval)

        // Update mock submission with files
        const existingSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
        const updatedSubmissions = existingSubmissions.map((sub: any) => {
          if (sub.id === submissionId) {
            return {
              ...sub,
              files: [
                ...sub.files,
                ...files.map((file) => ({
                  id: uuidv4(),
                  name: file.name,
                  size: file.size,
                  type: file.type,
                  uploadedAt: new Date().toISOString(),
                })),
              ],
            }
          }
          return sub
        })

        localStorage.setItem("mockSubmissions", JSON.stringify(updatedSubmissions))

        // Start mock processing after upload
        setTimeout(() => {
          const processedSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
          const finalSubmissions = processedSubmissions.map((sub: any) => {
            if (sub.id === submissionId) {
              return {
                ...sub,
                status: "complete",
                processedAt: new Date().toISOString(),
              }
            }
            return sub
          })

          localStorage.setItem("mockSubmissions", JSON.stringify(finalSubmissions))
        }, MOCK_PROCESSING_DELAY)

        return { success: true, message: "Files uploaded successfully" }
      }

      // Real API call with FormData for file upload
      const formData = new FormData()

      // Append each file to form data
      files.forEach((file) => {
        formData.append("files", file)
      })

      const response = await api.post(`/submissions/${submissionId}/files`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            onProgress(percentCompleted)
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
   * Get all submissions
   * @returns {Promise<Array>} Array of submissions
   */
  getSubmissions: async () => {
    try {
      if (API_MODE === "mock") {
        // Get submissions from localStorage in mock mode
        const mockSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
        return mockSubmissions
      }

      // Real API call
      const response = await api.get("/submissions")
      return response.data
    } catch (error) {
      console.error("Error fetching submissions:", error)
      throw error
    }
  },

  /**
   * Get a submission by ID
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object>} Submission data
   */
  getSubmissionById: async (submissionId: string) => {
    try {
      if (API_MODE === "mock") {
        // Get submission from localStorage in mock mode
        const mockSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
        const submission = mockSubmissions.find((sub: any) => sub.id === submissionId)

        if (!submission) {
          throw new Error("Submission not found")
        }

        return submission
      }

      // Real API call
      const response = await api.get(`/submissions/${submissionId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching submission:", error)
      throw error
    }
  },

  /**
   * Check submission processing status
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object>} Status data
   */
  checkProcessingStatus: async (submissionId: string) => {
    try {
      if (API_MODE === "mock") {
        // Get submission from localStorage in mock mode
        const mockSubmissions = JSON.parse(localStorage.getItem("mockSubmissions") || "[]")
        const submission = mockSubmissions.find((sub: any) => sub.id === submissionId)

        if (!submission) {
          throw new Error("Submission not found")
        }

        return {
          status: submission.status,
          progress: submission.status === "complete" ? 100 : 60,
          message: submission.status === "complete" ? "Processing complete" : "Analyzing submission data...",
        }
      }

      // Real API call
      const response = await api.get(`/submissions/${submissionId}/status`)
      return response.data
    } catch (error) {
      console.error("Error checking processing status:", error)
      throw error
    }
  },
}

export default submissionService
