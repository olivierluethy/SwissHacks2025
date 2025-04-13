"use client";

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { aiService } from "@/services/ai.service"
import { Tabs, TabsList, Tab, TabsContent } from "@/components/ui/tabs"
import { AlertTriangle, ArrowLeft, MessageSquare, Download, X } from "lucide-react"
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
} from "recharts";

// Import custom components
import ExportDialog from "./export-dialog"
import KeyInsights from "./key-insights"
import MarkdownContent from "./markdown-content"
import FeedbackButton from "./feedback-button"

type DashboardProps = {
  dashboardId: string;
};

type KeyInsight = {
  title: string;
  description: string;
  impact: "positive" | "negative" | "neutral";
  confidence: number;
};

type TabContent = {
  type: "json" | "html";
  data: any;
};

type DashboardTab = {
  id: string;
  title: string;
  content: TabContent;
};

type Dashboard = {
  title: string;
  markdown: string;
  keyInsights: KeyInsight[];
  tabs: DashboardTab[];
};

export default function AIDashboard({ dashboardId }: DashboardProps) {
  const router = useRouter()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string>("")
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState<Record<string, boolean>>({})
  const [reportUpdated, setReportUpdated] = useState(false)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);
        const data = await aiService.getDashboard(dashboardId);
        setDashboard(data);

        // Set active tab to first tab
        if (data.tabs && data.tabs.length > 0) {
          setActiveTab(data.tabs[0].id);
        }
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        setError("Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [dashboardId]);

  const goBack = () => {
    router.push("/");
  };



  // Handle report updates from AI feedback
  const handleReportUpdate = (updatedContent: any) => {
    if (!dashboard || !updatedContent) return

    // Update the dashboard with the new content
    setDashboard({
      ...dashboard,
      ...updatedContent,
    })

    // Show a notification that the report was updated
    setReportUpdated(true)

    // Hide the notification after 5 seconds
    setTimeout(() => {
      setReportUpdated(false)
    }, 5000)
  }
  // Export functionality
  const exportData = async (format: "pdf" | "text") => {
    try {
      if (!dashboard) return

      // Create content for export
      let content = `# ${dashboard.title}\n\n`

      // Add key insights
      if (dashboard.keyInsights && dashboard.keyInsights.length > 0) {
        content += "## Key Insights\n\n"
        dashboard.keyInsights.forEach((insight, index) => {
          content += `### ${insight.title}\n`
          content += `${insight.description}\n`
          content += `Impact: ${insight.impact}, Confidence: ${(insight.confidence * 100).toFixed(0)}%\n\n`
        })
      }

      // Add markdown content
      content += "## Analysis\n\n"
      content += dashboard.markdown

      if (format === "text") {
        // Create a blob for text download
        const blob = new Blob([content], { type: "text/plain" })
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${dashboard.title.replace(/\s+/g, "_")}_export.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else {
        // For PDF, we'll use the API route to generate the PDF
        const response = await fetch("/api/export-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: dashboard.title,
            content: content,
          }),
        })

        if (response.ok) {
          const blob = await response.blob()
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url
          a.download = `${dashboard.title.replace(/\s+/g, "_")}_export.pdf`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } else {
          throw new Error("Failed to generate PDF")
        }
      }

      setExportModalOpen(false)
    } catch (err) {
      console.error("Error exporting data:", err)
      alert("Failed to export data. Please try again.")
    }
  }

  const renderChart = (chartData: any, tabId: string) => {
    const { chartType, title, data, xAxisLabel, yAxisLabel } = chartData
    const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"]
    const contentId = `chart-${tabId}`

    return (
      <div className="h-96 w-full relative">
        <div className="absolute top-2 right-2 z-10">
          <FeedbackButton
            contentId={contentId}
            contentType="chart"
            dashboardId={dashboardId}
            onFeedbackSent={() => setFeedbackSent((prev) => ({ ...prev, [`chart-${contentId}`]: true }))}
            onReportUpdated={handleReportUpdate}
          />
        </div>

        <h3 className="text-lg font-semibold mb-4">{title}</h3>

        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={Object.keys(data[0]).find(key => key !== "value")}
                label={{ value: xAxisLabel, position: "insideBottom", offset: -5 }}
              />
              <YAxis label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={Object.keys(data[0]).find(key => key !== "value")}
                label={{ value: xAxisLabel, position: "insideBottom", offset: -5 }}
              />
              <YAxis label={{ value: yAxisLabel, angle: -90, position: "insideLeft" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          ) : chartType === "pie" ? (
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
                nameKey={Object.keys(data[0]).find(key => key !== "value")}
              >
                {data.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : (
            <div>Unsupported chart type: {chartType}</div>
          )}
        </ResponsiveContainer>
      </div>
    )
  }

  const renderTabContent = (tab: DashboardTab) => {
    if (tab.content.type === "json") {
      return renderChart(tab.content.data, tab.id)
    } else if (tab.content.type === "html") {
      return (
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <FeedbackButton
              contentId={tab.id}
              contentType="tab"
              dashboardId={dashboardId}
              onFeedbackSent={() => setFeedbackSent((prev) => ({ ...prev, [`tab-${tab.id}`]: true }))}
              onReportUpdated={handleReportUpdate}
            />
          </div>
          <div dangerouslySetInnerHTML={{ __html: tab.content.data }} />
        </div>
      )
    }

    return <div>Unsupported content type: {tab.content.type}</div>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="ml-2 text-gray-600">Loading dashboard...</span>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          Error Loading Dashboard
        </h2>
        <p className="text-gray-600">
          {error || "Failed to load dashboard data"}
        </p>
        <button
          className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-md"
          onClick={goBack}
        >
          Back to Submissions
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">

      {reportUpdated && (
        <div className="bg-green-100 text-green-800 p-4 rounded-t-lg flex justify-between items-center">
          <span>
            <strong>Report Updated:</strong> The report has been updated based on your feedback.
          </span>
          <button onClick={() => setReportUpdated(false)} className="text-green-800 hover:text-green-900">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <button className="flex items-center text-sm text-gray-600 hover:text-blue-600" onClick={goBack}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            <span>Back to Submissions</span>
          </button>
          <button
            className="flex items-center text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
            onClick={() => setExportModalOpen(true)}
          >
            <Download className="w-4 h-4 mr-1" />
            <span>Export Data</span>
          </button>
        </div>
        <h1 className="text-2xl font-bold text-gray-800">{dashboard.title}</h1>
      </div>

      <div className="p-6">
        {/* Markdown Content with Feedback Option */}
        <MarkdownContent content={dashboard.markdown} dashboardId={dashboardId} onReportUpdated={handleReportUpdate} />

        {/* Key Insights Section */}
        {dashboard.keyInsights && dashboard.keyInsights.length > 0 && (
          <KeyInsights
            insights={dashboard.keyInsights}
            dashboardId={dashboardId}
            onReportUpdated={handleReportUpdate}
          />
        )}
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

      {/* Export Dialog */}
      <ExportDialog
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        onExport={exportData}
        title={dashboard.title}
      />
    </div>
  );
}

// AI Chat Panel Component
function AIChatPanel({ dashboardId }: { dashboardId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchChatHistory = async () => {
      try {
        setLoading(true);
        const history = await aiService.getChatHistory(dashboardId);
        setMessages(history);
      } catch (err) {
        console.error("Error fetching chat history:", err);
        setError("Failed to load chat history");
      } finally {
        setLoading(false);
      }
    };

    fetchChatHistory();
  }, [dashboardId]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) return;

    const userMessage = {
      role: "user",
      content: newMessage,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setNewMessage("");

    try {
      setLoading(true);
      const response = await aiService.sendMessage(dashboardId, newMessage);
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = (message: any) => {
    return (
      <div
        className={`mb-4 ${message.role === "user" ? "ml-auto" : "mr-auto"}`}
      >
        <div
          className={`max-w-3xl rounded-lg p-4 ${message.role === "user"
            ? "bg-blue-100 text-blue-900"
            : "bg-gray-100 text-gray-900"
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
                        message.chart.data[0]?.category
                          ? "category"
                          : message.chart.data[0]?.year
                            ? "year"
                            : "name"
                      }
                      label={{
                        value: message.chart.xAxisLabel,
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      label={{
                        value: message.chart.yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                ) : message.chart.chartType === "line" ? (
                  <LineChart data={message.chart.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey={message.chart.data[0]?.year ? "year" : "name"}
                      label={{
                        value: message.chart.xAxisLabel,
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      label={{
                        value: message.chart.yAxisLabel,
                        angle: -90,
                        position: "insideLeft",
                      }}
                    />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#8884d8"
                      activeDot={{ r: 8 }}
                    />
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
    );
  };

  return (
    <div className="flex flex-col h-[600px] border border-gray-200 rounded-lg">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold">Ask AI About This Submission</h2>
        <p className="text-sm text-gray-500">Ask questions about the submission data, contract terms, or risk</p>
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
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              No Messages Yet
            </h3>
            <p className="text-gray-600 max-w-md">
              Ask questions about this submission to get insights from the AI
            </p>
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
  );
}
