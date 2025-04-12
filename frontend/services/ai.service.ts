import { api } from "./api"

// Flag to toggle between mock and real API
const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "mock"

// Mock data for AI dashboard
const mockDashboardData = {
  title: "Florida Property Catastrophe Analysis",
  markdown: `
# Florida Property Catastrophe Analysis

This analysis provides a comprehensive overview of the Florida Property Catastrophe submission. The data has been processed using advanced AI algorithms to extract key insights and patterns.

## Overview

The submission contains contract documents, claims data, and exposure information for properties in Florida. The analysis focuses on risk assessment, historical performance, and future projections.

## Key Findings

- **Hurricane Risk**: Category 4-5 hurricane probability has increased by 15% in the last decade
- **Exposure Concentration**: 65% of insured properties are located in high-risk coastal areas
- **Claims Trend**: Average claim size has increased by 23% year-over-year
  `,
  keyInsights: [
    {
      title: "Hurricane Exposure",
      description: "Category 5 hurricane exclusions reduce overall exposure by 18%",
      impact: "positive",
      confidence: 0.87,
    },
    {
      title: "Construction Costs",
      description: "Rising construction costs (7.1% YoY) may impact claim severity",
      impact: "negative",
      confidence: 0.92,
    },
    {
      title: "Regulatory Changes",
      description: "Recent Florida insurance reforms provide more stable regulatory environment",
      impact: "positive",
      confidence: 0.78,
    },
    {
      title: "Claims Frequency",
      description: "Historical data shows 12% lower claims frequency compared to industry average",
      impact: "positive",
      confidence: 0.85,
    },
  ],
  tabs: [
    {
      id: "risk-analysis",
      title: "Risk Analysis",
      content: {
        type: "json",
        data: {
          chartType: "bar",
          title: "Risk Exposure by Category",
          description: "Comparison of risk exposure across different categories",
          xAxisLabel: "Risk Category",
          yAxisLabel: "Exposure ($ Millions)",
          data: [
            { category: "Hurricane", value: 45.2 },
            { category: "Flood", value: 28.7 },
            { category: "Fire", value: 12.3 },
            { category: "Wind", value: 18.9 },
            { category: "Other", value: 5.6 },
          ],
        },
      },
    },
    {
      id: "historical-performance",
      title: "Historical Performance",
      content: {
        type: "json",
        data: {
          chartType: "line",
          title: "Claims History (2018-2023)",
          description: "Historical claims data over the past 5 years",
          xAxisLabel: "Year",
          yAxisLabel: "Claims ($ Millions)",
          data: [
            { year: "2018", value: 12.4 },
            { year: "2019", value: 15.2 },
            { year: "2020", value: 22.8 },
            { year: "2021", value: 18.5 },
            { year: "2022", value: 20.1 },
            { year: "2023", value: 24.7 },
          ],
        },
      },
    },
    {
      id: "geographic-distribution",
      title: "Geographic Distribution",
      content: {
        type: "json",
        data: {
          chartType: "pie",
          title: "Exposure by County",
          description: "Distribution of insured properties across Florida counties",
          data: [
            { name: "Miami-Dade", value: 35 },
            { name: "Broward", value: 22 },
            { name: "Palm Beach", value: 18 },
            { name: "Orange", value: 12 },
            { name: "Hillsborough", value: 8 },
            { name: "Other", value: 5 },
          ],
        },
      },
    },
    {
      id: "contract-analysis",
      title: "Contract Analysis",
      content: {
        type: "html",
        data: `
          <div class="contract-analysis">
            <h3 class="text-xl font-bold mb-4">Key Contract Changes</h3>
            <div class="overflow-x-auto">
              <table class="min-w-full bg-white border border-gray-200">
                <thead>
                  <tr>
                    <th class="py-2 px-4 border-b">Clause</th>
                    <th class="py-2 px-4 border-b">Previous</th>
                    <th class="py-2 px-4 border-b">Current</th>
                    <th class="py-2 px-4 border-b">Impact</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="py-2 px-4 border-b">Hurricane Exclusion</td>
                    <td class="py-2 px-4 border-b">Category 4-5</td>
                    <td class="py-2 px-4 border-b">Category 3-5</td>
                    <td class="py-2 px-4 border-b text-green-600">-15% Risk</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-4 border-b">Deductible</td>
                    <td class="py-2 px-4 border-b">2% TIV</td>
                    <td class="py-2 px-4 border-b">3% TIV</td>
                    <td class="py-2 px-4 border-b text-green-600">-8% Risk</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-4 border-b">Reporting Period</td>
                    <td class="py-2 px-4 border-b">90 days</td>
                    <td class="py-2 px-4 border-b">60 days</td>
                    <td class="py-2 px-4 border-b text-green-600">-3% Risk</td>
                  </tr>
                  <tr>
                    <td class="py-2 px-4 border-b">Cyber Coverage</td>
                    <td class="py-2 px-4 border-b">Limited</td>
                    <td class="py-2 px-4 border-b">Excluded</td>
                    <td class="py-2 px-4 border-b text-green-600">-5% Risk</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 class="font-semibold mb-2">Analysis Summary</h4>
              <p>The contract changes represent a significant reduction in risk exposure, particularly through the expanded hurricane exclusions and increased deductibles. Overall risk reduction is estimated at 31%.</p>
            </div>
          </div>
        `,
      },
    },
  ],
}

// Mock chat history
const mockChatHistory = [
  {
    role: "user",
    content: "What are the main risk factors for this submission?",
  },
  {
    role: "assistant",
    content:
      "Based on the analysis of the submission data, the main risk factors are:\n\n1. **Hurricane Exposure**: Despite the Category 5 hurricane exclusions, there remains significant exposure to Category 1-4 hurricanes, particularly in coastal areas.\n\n2. **Geographic Concentration**: 65% of insured properties are located in high-risk coastal areas, primarily in Miami-Dade and Broward counties.\n\n3. **Construction Costs**: Rising construction costs (7.1% YoY) may impact claim severity for property damage.\n\n4. **Climate Change**: Long-term projections indicate increasing frequency and severity of extreme weather events in Florida.",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    role: "user",
    content: "Can you show me the historical loss ratio for this portfolio?",
  },
  {
    role: "assistant",
    content: "Here's the historical loss ratio for the portfolio over the past 5 years:",
    timestamp: new Date(Date.now() - 3500000).toISOString(),
    chart: {
      chartType: "line",
      title: "Historical Loss Ratio (2018-2023)",
      xAxisLabel: "Year",
      yAxisLabel: "Loss Ratio (%)",
      data: [
        { year: "2018", value: 62.4 },
        { year: "2019", value: 58.7 },
        { year: "2020", value: 75.2 },
        { year: "2021", value: 68.9 },
        { year: "2022", value: 64.3 },
        { year: "2023", value: 67.1 },
      ],
    },
  },
]

// Mock submission data
const mockSubmissions = [
  {
    id: "florida-2024",
    name: "Florida Property Catastrophe",
    status: "pending",
    lastUpdated: "2024-04-10T14:30:00Z",
    progress: 0,
  },
  {
    id: "california-2024",
    name: "California Earthquake Program",
    status: "processing",
    lastUpdated: "2024-04-09T10:15:00Z",
    progress: 65,
  },
  {
    id: "texas-2024",
    name: "Texas Windstorm Portfolio",
    status: "completed",
    lastUpdated: "2024-04-05T16:45:00Z",
    progress: 100,
    dashboardId: "texas-dashboard",
  },
  {
    id: "gulf-2024",
    name: "Gulf Coast Hurricane Program",
    status: "completed",
    lastUpdated: "2024-04-01T09:20:00Z",
    progress: 100,
    dashboardId: "gulf-dashboard",
  },
]

/**
 * AI service for handling AI-related operations
 */
export const aiService = {
  /**
   * Get all submissions
   * @returns {Promise<Array>} Array of submissions
   */
  getSubmissions: async () => {
    try {
      if (API_MODE === "mock") {
        // Return mock data
        return Promise.resolve(mockSubmissions)
      }

      const response = await api.get("/submissions")
      return response.data
    } catch (error) {
      console.error("Error fetching submissions:", error)
      // Return mock data as fallback
      return mockSubmissions
    }
  },

  /**
   * Process a submission
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object>} Processing response
   */
  processSubmission: async (submissionId: string) => {
    try {
      if (API_MODE === "mock") {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Update mock submission status
        const updatedSubmissions = mockSubmissions.map((sub) => {
          if (sub.id === submissionId) {
            return {
              ...sub,
              status: "processing",
              progress: 5,
              lastUpdated: new Date().toISOString(),
            }
          }
          return sub
        })

        // Return success response
        return Promise.resolve({
          success: true,
          message: "Submission processing started",
          submissionId,
        })
      }

      const response = await api.post(`/submissions/${submissionId}/process`)
      return response.data
    } catch (error) {
      console.error("Error processing submission:", error)
      throw error
    }
  },

  /**
   * Get submission processing status
   * @param {string} submissionId - The submission ID
   * @returns {Promise<Object>} Status response
   */
  getProcessingStatus: async (submissionId: string) => {
    try {
      if (API_MODE === "mock") {
        // Find submission in mock data
        const submission = mockSubmissions.find((sub) => sub.id === submissionId)

        if (!submission) {
          throw new Error("Submission not found")
        }

        // If submission is processing, increment progress
        if (submission.status === "processing" && submission.progress < 100) {
          submission.progress += 5

          // Complete processing when progress reaches 100
          if (submission.progress >= 100) {
            submission.status = "completed"
            submission.dashboardId = `${submissionId}-dashboard`
          }
        }

        return Promise.resolve({
          status: submission.status,
          progress: submission.progress,
          lastUpdated: submission.lastUpdated,
          dashboardId: submission.dashboardId,
        })
      }

      const response = await api.get(`/submissions/${submissionId}/status`)
      return response.data
    } catch (error) {
      console.error("Error fetching processing status:", error)
      throw error
    }
  },

  /**
   * Get AI-generated dashboard
   * @param {string} dashboardId - The dashboard ID
   * @returns {Promise<Object>} Dashboard data
   */
  getDashboard: async (dashboardId: string) => {
    try {
      if (API_MODE === "mock") {
        // Return mock dashboard data
        return Promise.resolve(mockDashboardData)
      }

      const response = await api.get(`/dashboards/${dashboardId}`)
      return response.data
    } catch (error) {
      console.error("Error fetching dashboard:", error)
      // Return mock data as fallback
      return mockDashboardData
    }
  },

  /**
   * Get chat history
   * @param {string} dashboardId - The dashboard ID
   * @returns {Promise<Array>} Chat history
   */
  getChatHistory: async (dashboardId: string) => {
    try {
      if (API_MODE === "mock") {
        // Return mock chat history
        return Promise.resolve(mockChatHistory)
      }

      const response = await api.get(`/dashboards/${dashboardId}/chat`)
      return response.data
    } catch (error) {
      console.error("Error fetching chat history:", error)
      // Return mock data as fallback
      return mockChatHistory
    }
  },

  /**
   * Send message to AI
   * @param {string} dashboardId - The dashboard ID
   * @param {string} message - The message to send
   * @returns {Promise<Object>} AI response
   */
  sendMessage: async (dashboardId: string, message: string) => {
    try {
      if (API_MODE === "mock") {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Generate mock response
        const response = {
          role: "assistant",
          content: `I've analyzed the data for this submission. Your question was about "${message}". Based on the available information, this submission shows a balanced risk profile with some areas of concern in coastal regions. The contract changes have reduced overall exposure by approximately 31%, primarily through expanded exclusions and higher deductibles.`,
          timestamp: new Date().toISOString(),
        }

        // Add chart to response for certain keywords
        if (
          message.toLowerCase().includes("chart") ||
          message.toLowerCase().includes("graph") ||
          message.toLowerCase().includes("visual") ||
          message.toLowerCase().includes("show") ||
          message.toLowerCase().includes("display")
        ) {
          Object.assign(response, {
            chart: {
              chartType: "bar",
              title: "Risk Distribution by Category",
              xAxisLabel: "Category",
              yAxisLabel: "Risk Score",
              data: [
                { category: "Hurricane", value: 78 },
                { category: "Flood", value: 65 },
                { category: "Fire", value: 42 },
                { category: "Wind", value: 56 },
                { category: "Other", value: 23 },
              ],
            },
          })
        }

        return Promise.resolve(response)
      }

      const response = await api.post(`/dashboards/${dashboardId}/chat`, { message })
      return response.data
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  },
}

export default aiService
