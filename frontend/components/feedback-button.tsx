"use client"

import { useState, useRef, useEffect } from "react"
import { ThumbsUp, ThumbsDown, X } from "lucide-react"
import { aiService } from "@/services/ai.service"

type FeedbackButtonProps = {
  contentId: string
  contentType: "heading" | "insight" | "chart" | "text" | "tab"
  dashboardId: string
  onFeedbackSent?: () => void
  onReportUpdated?: (updatedContent: any) => void
  className?: string
  position?: "right" | "top" // Position of the feedback form
}

export default function FeedbackButton({
  contentId,
  contentType,
  dashboardId,
  onFeedbackSent,
  onReportUpdated,
  className = "",
  position = "right",
}: FeedbackButtonProps) {
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)
  const [aiResponseReceived, setAiResponseReceived] = useState(false)
  const feedbackRef = useRef<HTMLDivElement>(null)
  // Add state to track the current sentiment
  const [currentSentiment, setCurrentSentiment] = useState<boolean | null>(null)

  // Close feedback form when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (feedbackRef.current && !feedbackRef.current.contains(event.target as Node)) {
        setFeedbackOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  const handleFeedback = (isPositive: boolean) => {
    setFeedbackOpen(true)
    setFeedbackText("")
    // Store the sentiment value when the user clicks thumbs up/down
    setCurrentSentiment(isPositive)
  }

  const submitFeedback = async () => {
    try {
      setIsSubmitting(true)

      // Submit feedback
      await aiService.submitFeedback({
        dashboardId,
        contentId,
        contentType,
        feedbackText,
        isPositive: currentSentiment!,
      })

      // Mark this content as having received feedback
      setFeedbackSent(true)
      setFeedbackOpen(false)

      // Notify parent component
      if (onFeedbackSent) {
        onFeedbackSent()
      }

      // Get AI response to feedback and update the report
      setAiResponseReceived(false)
      const aiResponse = await aiService.getAIResponseToFeedback({
        dashboardId,
        contentId,
        contentType,
        feedbackText,
        isPositive: currentSentiment!,
      })

      // Update the report with AI response
      if (aiResponse && onReportUpdated) {
        onReportUpdated(aiResponse)
      }

      setAiResponseReceived(true)
    } catch (error) {
      console.error("Error submitting feedback:", error)
      alert("Failed to submit feedback. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (feedbackSent) {
    return (
      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
        {aiResponseReceived ? "Report updated" : "Updating report..."}
      </span>
    )
  }

  if (isSubmitting && !feedbackOpen) {
    return (
      <div className="flex items-center space-x-1">
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs text-gray-600">Processing...</span>
      </div>
    )
  }

  const getPlaceholder = () => {
    switch (contentType) {
      case "heading":
        return "What would make this section more useful?"
      case "insight":
        return "What would make this insight more useful?"
      case "chart":
        return "What would make this chart more useful?"
      case "tab":
        return "What would make this content more useful?"
      default:
        return "What would make this content more useful?"
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="flex space-x-1">
        <button
          onClick={() => handleFeedback(true)}
          className="p-1 rounded-full bg-white shadow-sm hover:bg-gray-100"
          title={`This ${contentType} is helpful`}
          disabled={isSubmitting}
        >
          <ThumbsUp className="w-4 h-4 text-green-600" />
        </button>
        <button
          onClick={() => handleFeedback(false)}
          className="p-1 rounded-full bg-white shadow-sm hover:bg-gray-100"
          title={`This ${contentType} needs improvement`}
          disabled={isSubmitting}
        >
          <ThumbsDown className="w-4 h-4 text-red-600" />
        </button>
      </div>

      {feedbackOpen && (
        <div
          ref={feedbackRef}
          className={`absolute z-20 bg-white shadow-lg rounded-lg p-4 w-64 border border-gray-200 ${position === "right" ? "top-0 right-8" : "top-6 right-0"
            }`}
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">
              {contentType === "heading" ? "Feedback on Section" : `Feedback on ${contentType}`}
            </h4>
            <button
              onClick={() => setFeedbackOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder={getPlaceholder()}
            className="w-full p-2 border border-gray-300 rounded-md text-sm mb-2"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm text-gray-600">Processing...</span>
              </div>
            ) : (
              <button onClick={submitFeedback} className="px-3 py-1 bg-blue-600 text-white rounded-md text-sm">
                Submit
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
