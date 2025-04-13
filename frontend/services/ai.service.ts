import { api } from "./api"

// Flag to toggle between mock and real API
const API_MODE = process.env.NEXT_PUBLIC_API_MODE || "real"
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "/api"

// Mock dashboard data
const mockDashboardData = {
  title: "AI Data Analysis Overview",
  markdown:
    "### Number Table\n\n| Number Type  | Value     | Min Range | Max Range |\n|--------------|-----------|-----------|-----------|\n| Integer      | 123       | 1         | 999       |\n| Integer      | 123       | 1         | 999       |\n| Float        | 45.678    | 0.001     | 999.999   |\n| Binary Value | -101      | -1023     | 1024      |\n| Binary Value | -101      | -1023     | 1024      |\n| Hex Value    | abcd1234  | 0x1       | 0x123456  |\n| Hex Value    | abcd1234  | 0x1       | 0x123456  |\n\n### Table 3: Fitness Tracker Data\n\n| Activity     | Calories Burned | Time Spent (min) | Notes            |\n|--------------|-----------------|------------------|------------------|\n| Running      | 587             | 30               | Moderate pace    |\n| Cycling      | 654             | 25               | Enjoying myself  |\n| Swimming     | 489             | 15               | Lap 5 complete   |\n| Yoga         | 321             | 10               | Peaceful session |\n| CrossFit     | 1234            | 45               | Full body workout|",
  keyInsights: [
    {
      title: "Duplicate Entries Detected",
      description:
        "The number table contains duplicate rows for several number types. This repetition may affect data integrity and could indicate redundant data entries.",
      impact: "negative",
      confidence: 0.9,
    },
    {
      title: "Consistent Value Ranges",
      description:
        "Each number type entry falls within its specified minimum and maximum ranges, which suggests that the data collection process maintains consistency and reliability.",
      impact: "positive",
      confidence: 0.95,
    },
    {
      title: "Diverse Fitness Tracker Data",
      description:
        "The fitness tracker data shows a variety of physical activities with distinct calories burned and time spent. This diversity helps in understanding performance differences across activities.",
      impact: "positive",
      confidence: 0.8,
    },
  ],
  tabs: [
    {
      id: "number-table-analysis",
      title: "Number Table Analysis",
      content: {
        type: "json",
        data: {
          chartType: "bar",
          title: "Number Types Distribution",
          description: "Visual representation of selected numeric values from the number table.",
          xAxisLabel: "Number Type",
          yAxisLabel: "Value",
          data: [
            {
              label: "Integer",
              value: 123,
            },
            {
              label: "Float",
              value: 45.678,
            },
            {
              label: "Binary Value",
              value: -101,
            },
            {
              label: "Hex Value",
              value: 2882343476,
            },
          ],
        },
      },
    },
    {
      id: "fitness-tracker-analysis",
      title: "Fitness Tracker Analysis",
      content: {
        type: "html",
        data: "<table border='1' cellspacing='0' cellpadding='5'><tr><th>Activity</th><th>Calories Burned</th><th>Time Spent (min)</th><th>Notes</th></tr><tr><td>Running</td><td>587</td><td>30</td><td>Moderate pace</td></tr><tr><td>Cycling</td><td>654</td><td>25</td><td>Enjoying myself</td></tr><tr><td>Swimming</td><td>489</td><td>15</td><td>Lap 5 complete</td></tr><tr><td>Yoga</td><td>321</td><td>10</td><td>Peaceful session</td></tr><tr><td>CrossFit</td><td>1234</td><td>45</td><td>Full body workout</td></tr></table>",
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
      // Return mock chat history
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

  /**
   * Submit feedback on dashboard content
   * @param {Object} feedback - Feedback data
   * @returns {Promise<Object>} Feedback response
   */
  submitFeedback: async (feedback: {
    dashboardId: string
    contentId: string
    contentType: string
    feedbackText: string
    isPositive: boolean
    selectedText?: string
  }) => {
    try {
      if (API_MODE === "mock") {
        // Simulate API delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        // Return success response
        return Promise.resolve({
          success: true,
          message: "Feedback submitted successfully",
        })
      }

      const response = await api.post(`/dashboards/${feedback.dashboardId}/feedback`, feedback)
      return response.data
    } catch (error) {
      console.error("Error submitting feedback:", error)
      throw error
    }
  },
  /**
   * Get AI response to feedback that will modify the report
   * @param {Object} feedback - Feedback data
   * @returns {Promise<Object>} Updated content
   */
  getAIResponseToFeedback: async (feedback: {
    dashboardId: string
    contentId: string
    contentType: string
    feedbackText: string
    isPositive: boolean
  }) => {
    try {
      if (API_MODE === "mock") {
        // Simulate AI delay
        await new Promise((resolve) => setTimeout(resolve, 2000))

        // Generate mock updated content based on feedback type
        let updatedContent = {}

        // Different responses based on content type
        if (feedback.contentType === "heading") {
          // Update markdown content for heading feedback
          const updatedMarkdown = feedback.isPositive
            ? mockDashboardData.markdown.replace("### Number Table", "### Enhanced Number Table Analysis")
            : mockDashboardData.markdown.replace(
              "### Number Table",
              "### Revised Number Table (Updated based on your feedback)",
            )

          updatedContent = {
            markdown: updatedMarkdown,
          }
        } else if (feedback.contentType === "insight") {
          // Update insights for insight feedback
          const updatedInsights = [...mockDashboardData.keyInsights]

          // Add a new insight based on feedback
          updatedInsights.push({
            title: "AI-Generated Insight Based on Your Feedback",
            description: feedback.isPositive
              ? "Based on your positive feedback, we've identified additional patterns in the data that support this insight."
              : "We've revised our analysis based on your feedback and identified potential areas for improvement.",
            impact: feedback.isPositive ? "positive" : "neutral",
            confidence: 0.85,
          })

          updatedContent = {
            keyInsights: updatedInsights,
          }
        } else if (feedback.contentType === "chart") {
          // For chart feedback, we'll update the tab content
          updatedContent = {
            tabs: mockDashboardData.tabs.map((tab) => {
              if (tab.id === "number-table-analysis" && tab.content.type === "json") {
                return {
                  ...tab,
                  title: "Updated Number Table Analysis",
                  content: {
                    ...tab.content,
                    data: {
                      ...tab.content.data,
                      title: "Revised Number Types Distribution (Based on Feedback)",
                      description: "This visualization has been updated based on your feedback.",
                    },
                  },
                }
              }
              return tab
            }),
          }
        } else {
          // General feedback updates the title and adds a note
          updatedContent = {
            title: "AI Data Analysis Overview (Updated)",
            markdown:
              mockDashboardData.markdown +
              "\n\n### AI Response to Your Feedback\nThank you for your feedback. We've updated this report to better address your needs and provide more relevant insights.",
          }
        }

        return Promise.resolve(updatedContent)
      }

      const response = await api.post(`/dashboards/${feedback.dashboardId}/ai-response`, feedback)
      return response.data
    } catch (error) {
      console.error("Error getting AI response to feedback:", error)
      throw error
    }
  },
}

export default aiService
