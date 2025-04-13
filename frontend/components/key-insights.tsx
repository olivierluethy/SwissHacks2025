"use client"

import React from "react"
import { CheckCircle, AlertTriangle, MessageCircle } from "lucide-react"
import FeedbackButton from "./feedback-button"

type KeyInsight = {
  title: string
  description: string
  impact: "positive" | "negative" | "neutral"
  confidence: number
}

type KeyInsightsProps = {
  insights: KeyInsight[]
  dashboardId: string
}

export default function KeyInsights({ insights, dashboardId }: KeyInsightsProps) {
  const [feedbackSentMap, setFeedbackSentMap] = React.useState<Record<string, boolean>>({})

  const handleFeedbackSent = (insightIndex: number) => {
    setFeedbackSentMap((prev) => ({
      ...prev,
      [`insight-${insightIndex}`]: true,
    }))
  }

  if (!insights || insights.length === 0) return null

  return (
    <div className="mb-8 bg-gray-50 p-6 rounded-lg border border-gray-200">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        Key Insights
        <div className="ml-2">
          <FeedbackButton contentId="insights" contentType="insight" dashboardId={dashboardId} />
        </div>
      </h2>

      <div className="space-y-4">
        {insights.map((insight, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              insight.impact === "positive"
                ? "bg-green-50 border-green-200"
                : insight.impact === "negative"
                  ? "bg-red-50 border-red-200"
                  : "bg-blue-50 border-blue-200"
            }`}
          >
            <div className="flex items-start">
              <div
                className={`p-2 rounded-full mr-3 ${
                  insight.impact === "positive"
                    ? "bg-green-100 text-green-600"
                    : insight.impact === "negative"
                      ? "bg-red-100 text-red-600"
                      : "bg-blue-100 text-blue-600"
                }`}
              >
                {insight.impact === "positive" ? (
                  <CheckCircle className="w-5 h-5" />
                ) : insight.impact === "negative" ? (
                  <AlertTriangle className="w-5 h-5" />
                ) : (
                  <MessageCircle className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{insight.title}</h3>
                <p className="text-gray-700 mt-1">{insight.description}</p>
                <div className="mt-2 flex items-center">
                  <div className="text-sm text-gray-500">Confidence: {(insight.confidence * 100).toFixed(0)}%</div>
                  <div className="ml-2 w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        insight.impact === "positive"
                          ? "bg-green-500"
                          : insight.impact === "negative"
                            ? "bg-red-500"
                            : "bg-blue-500"
                      }`}
                      style={{ width: `${insight.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <div className="ml-2">
                <FeedbackButton
                  contentId={`${index}`}
                  contentType="insight"
                  dashboardId={dashboardId}
                  onFeedbackSent={() => handleFeedbackSent(index)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
