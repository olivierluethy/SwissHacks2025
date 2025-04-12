import { api } from "./api"
import {
  contractRiskData,
  layerData,
  hurricaneData,
  claimsData,
  exposureData,
  economicData,
  climateRiskData,
  contractChanges,
  keyInsights,
  underwriterResponse,
} from "@/data/dashboardData"

// Flag to toggle between mock and real API
const MOCK_MODE = true // Set to false when connecting to a real API

/**
 * Dashboard service for handling dashboard data operations
 */
export const dashboardService = {
  /**
   * Get dashboard data for a submission
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object>} Dashboard data
   */
  getDashboardData: async (submissionId: string) => {
    try {
      if (MOCK_MODE) {
        // Return mock data
        return Promise.resolve({
          contractRiskData,
          layerData,
          hurricaneData,
          claimsData,
          exposureData,
          economicData,
          climateRiskData,
          contractChanges,
          keyInsights,
          underwriterResponse,
        })
      }

      const response = await api.get(`/dashboard/${submissionId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching dashboard data:", error)
      // Return mock data as fallback
      return {
        contractRiskData,
        layerData,
        hurricaneData,
        claimsData,
        exposureData,
        economicData,
        climateRiskData,
        contractChanges,
        keyInsights,
        underwriterResponse,
      }
    }
  },

  /**
   * Submit underwriter response
   * @param {string} submissionId - The submission ID
   * @param {Object} response - The underwriter response
   * @returns {Promise<Object>} Submission response
   */
  submitUnderwriterResponse: async (submissionId: string, response: any) => {
    try {
      if (MOCK_MODE) {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000))
        return Promise.resolve({ success: true, message: "Response submitted successfully" })
      }

      const apiResponse = await api.post(`/submissions/${submissionId}/response`, response)
      return apiResponse.data
    } catch (error) {
      console.error("Error submitting underwriter response:", error)
      throw error
    }
  },
}

export default dashboardService
