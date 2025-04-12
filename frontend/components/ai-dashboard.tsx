"use client"

import React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { aiService } from "@/services/ai.service"
import { Tabs, TabsList, Tab, TabsContent } from "@/components/ui/tabs"
import { AlertTriangle, ArrowLeft, MessageSquare } from "lucide-react"
import ReactMarkdown from "react-markdown"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

type DashboardProps = {
  dashboardId: string
}

type KeyInsight = {
  title: string
  description: string
  impact: "positive" | "negative" | "neutral"
  confidence: number
}

type TabContent = {
  type: "json" | "html"
  data: any
}

type DashboardTab = {
  id: string
  title: string
  content: TabContent
}

type Dashboard = {
  title: string
  markdown: string
  keyInsights: KeyInsight[]
  tabs: DashboardTab[]
}

export default function AIDashboard({ dashboardId }: DashboardProps) {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("")

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true)
        const data = await aiService.getDashboard(dashboardId)
        setDashboard(data)

        // Set active tab to first tab
        if (data.tabs && data.tabs.length > 0) {
          setActiveTab(data.tabs[0].id)
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err)
        setError("Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [dashboardId])

  const goBack = () => {
    router.push("/")
  }

  const renderChart = (chartData: any) => {
    const { chartType, title, data, xAxisLabel, yAxisLabel } = chartData
    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]

    switch (chartType) {
      case "bar":
        return (
          <div className="h-96 w-full">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={data[0]?.category ? "category" : data[0]?.year ? "year" : "name"}
                  label={{ value: xAxisLabel, position: "insideBottom", offset: -5 }}
                />
                <YAxis label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )

      case "line":
        return (
          <div className="h-96 w-full">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey={data[0]?.year ? "year" : "name"}
                  label={{ value: xAxisLabel, position: "insideBottom", offset: -5 }}
                />
                <YAxis label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )

      case "pie":
        return (
          <div className="h-96 w-full">
            <h3 className="text-lg font-semibold mb-4">{title}</h3>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={150}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {data.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )

      default:
        return <div>Unsupported chart type: {chartType}</div>
    }
  }

  const renderTabContent = (tab: DashboardTab) => {
    if (tab.content.type === "json") {
      return renderChart(tab.content.data)
    } else if (tab.content.type === "html") {
      return <div dangerouslySetInnerHTML={{ __html: tab.content.data }} />
    }

    return <div>Unsupported content type: {tab.content.type}</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Dashboard</h2>
        <p className="text-gray-600">{error || "Failed to load dashboard data"}</p>
        <button className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md" onClick={goBack}>
          Back to Submissions
        </button>
      </div>
    )
  }

  // Create an array of all tab IDs including the AI chat tab
  const allTabs = [...dashboard.tabs.map((tab) => tab.id), "ai-chat"]

  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200">
        <button className="flex items-center text-sm text-gray-600 hover:text-blue-600 mb-4" onClick={goBack}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          <span>Back to Submissions</span>
        </button>
        <h1 className="text-2xl font-bold text-gray-800">{dashboard.title}</h1>
      </div>

      <div className="p-6">
        {/* Markdown Content */}
        <div className="prose max-w-none mb-8">
          <ReactMarkdown>{dashboard.markdown}</ReactMarkdown>
        </div>

        {/* Key Insights */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Key Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {dashboard.keyInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.impact === "positive"
                    ? "border-green-500 bg-green-50"
                    : insight.impact === "negative"
                      ? "border-red-500 bg-red-50"
                      : "border-blue-500 bg-blue-50"
                }`}
              >
                <h3 className="font-semibold mb-2">{insight.title}</h3>
                <p className="text-sm">{insight.description}</p>
                <div className="mt-2 flex justify-between items-center text-xs text-gray-500">
                  <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                  <span
                    className={`font-medium ${
                      insight.impact === "positive"
                        ? "text-green-600"
                        : insight.impact === "negative"
                          ? "text-red-600"
                          : "text-blue-600"
                    }`}
                  >
                    {insight.impact.charAt(0).toUpperCase() + insight.impact.slice(1)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              {dashboard.tabs.map((tab) => (
                <Tab key={tab.id} value={tab.id}>
                  {tab.title}
                </Tab>
              ))}
              <Tab value="ai-chat" className="flex items-center">
                <MessageSquare className="w-4 h-4 mr-1" />
                <span>Ask AI</span>
              </Tab>
            </TabsList>

            {dashboard.tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id}>
                {renderTabContent(tab)}
              </TabsContent>
            ))}

            <TabsContent value="ai-chat">
              <AIChatPanel dashboardId={dashboardId} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}

// AI Chat Panel Component
function AIChatPanel({ dashboardId }: { dashboardId: string }) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setLoading(true)
        const history = await aiService.getChatHistory(dashboardId)
        setMessages(history)
      } catch (err) {
        console.error("Error fetching chat history:", err)
        setError("Failed to load chat history")
      } finally {
        setLoading(false)
      }
    }

    fetchChatHistory()
  }, [dashboardId])

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim()) return

    const userMessage = {
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setNewMessage("")

    try {
      setLoading(true)
      const response = await aiService.sendMessage(dashboardId, newMessage)
      setMessages((prev) => [...prev, response])
    } catch (err) {
      console.error("Error sending message:", err)
      setError("Failed to send message")
    } finally {
      setLoading(false)
    }
  }

  const renderMessage = (message: any) => {
    return (
      <div className={`mb-4 ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
        <div
          className={`max-w-3xl rounded-lg p-4 ${
            message.role === "user" ? "bg-blue-100 text-blue-900" : "bg-gray-100 text-gray-900"
          }`}
        >
          <div className="whitespace-pre-wrap">{message.content}</div>

          {message.chart && (
            <div className="mt-4 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {message.chart.chartType === "bar" ? (
                  <BarChart data={message.chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={
                        message.chart.data[0]?.category ? "category" : message.chart.data[0]?.year ? "year" : "name"
                      }
                      label={{ value: message.chart.xAxisLabel, position: "insideBottom", offset: -5 }}
                    />
                    <YAxis label={{ value: message.chart.yAxisLabel, angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                ) : message.chart.chartType === "line" ? (
                  <LineChart data={message.chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={message.chart.data[0]?.year ? "year" : "name"}
                      label={{ value: message.chart.xAxisLabel, position: "insideBottom", offset: -5 }}
                    />
                    <YAxis label={{ value: message.chart.yAxisLabel, angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
                  </LineChart>
                ) : (
                  <div>Unsupported chart type</div>
                )}
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500">
            {message.timestamp && new Date(message.timestamp).toLocaleString()}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Ask AI About This Submission</h2>
        <p className="text-sm text-gray-500">
          Ask questions about the submission data, contract terms, or risk analysis
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-2 text-gray-600">Loading chat history...</span>
          </div>
        ) : error && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full">
            <AlertTriangle className="w-8 h-8 text-red-500 mb-2" />
            <p className="text-gray-600">{error}</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MessageSquare className="w-12 h-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-800 mb-2">No Messages Yet</h3>
            <p className="text-gray-600 max-w-md">Ask questions about this submission to get insights from the AI</p>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <div key={index}>{renderMessage(message)}</div>
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask a question..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-blue-400"
            disabled={loading || !newMessage.trim()}
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </form>
      </div>
    </div>
  )
}
