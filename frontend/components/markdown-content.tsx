"use client"

import { useRef, useCallback, useState, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import { ThumbsUp, ThumbsDown, MessageCircle, X } from "lucide-react"
import FeedbackButton from "./feedback-button"

type TextSelectionPosition = {
  top: number
  left: number
}

type MarkdownContentProps = {
  content: string
  dashboardId: string
  onReportUpdated?: (updatedContent: any) => void
}

export default function MarkdownContent({ content, dashboardId, onReportUpdated }: MarkdownContentProps) {
  const markdownRef = useRef<HTMLDivElement>(null)
  const selectionFeedbackRef = useRef<HTMLDivElement>(null)

  // Text selection feedback
  const [selectedText, setSelectedText] = useState<string>("")
  const [selectionPosition, setSelectionPosition] = useState<TextSelectionPosition | null>(null)
  const [selectionFeedbackOpen, setSelectionFeedbackOpen] = useState(false)
  const [feedbackText, setFeedbackText] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Heading feedback tracking
  const [headingFeedbackSent, setHeadingFeedbackSent] = useState<Record<string, boolean>>({})

  // Handle text selection
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (selection && selection.toString().trim().length > 0 && markdownRef.current) {
      const range = selection.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const markdownRect = markdownRef.current.getBoundingClientRect()

      // Calculate position relative to the markdown container
      setSelectionPosition({
        top: rect.bottom - markdownRect.top + window.scrollY,
        left: rect.left - markdownRect.left + rect.width / 2,
      })
      setSelectedText(selection.toString().trim())
    } else if (!selectionFeedbackOpen) {
      // Only clear if feedback form is not open
      setSelectionPosition(null)
      setSelectedText("")
    }
  }, [selectionFeedbackOpen])

  // Close feedback form when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (selectionFeedbackRef.current && !selectionFeedbackRef.current.contains(event.target as Node)) {
        setSelectionFeedbackOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  useEffect(() => {
    // Add mouseup event listener to detect text selection
    const markdownElement = markdownRef.current

    const handleMouseUp = () => {
      // Small delay to ensure selection is complete
      setTimeout(handleTextSelection, 50)
    }

    if (markdownElement) {
      markdownElement.addEventListener("mouseup", handleMouseUp)
    }

    return () => {
      if (markdownElement) {
        markdownElement.removeEventListener("mouseup", handleMouseUp)
      }
    }
  }, [handleTextSelection])

  const handleSelectionFeedback = (isPositive: boolean) => {
    setSelectionFeedbackOpen(true)
    setFeedbackText("")
  }

  const submitSelectionFeedback = async (isPositive: boolean) => {
    try {
      setIsSubmitting(true)

      // Simulate AI processing time
      await new Promise((resolve) => setTimeout(resolve, 1500))

      console.log("Selection feedback submitted:", {
        selectedText,
        feedbackText,
        isPositive,
        dashboardId,
      })

      // Close the feedback form
      setSelectionFeedbackOpen(false)
      setSelectionPosition(null)
      setSelectedText("")
      setFeedbackText("")

      // Show a success message
      alert("Thank you for your feedback on the selected text!")
    } catch (error) {
      console.error("Error submitting selection feedback:", error)
      alert("Failed to submit feedback. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleHeadingFeedbackSent = (headingId: string) => {
    setHeadingFeedbackSent((prev) => ({
      ...prev,
      [headingId]: true,
    }))
  }

  return (
    <div
      className="prose max-w-none mb-8 relative"
      ref={markdownRef}
      style={{ position: "relative", overflow: "visible" }}
    >
      {/* Text selection feedback popup */}
      {selectionPosition && (
        <div
          className="absolute z-20 flex space-x-1 bg-white rounded-full shadow-md border border-gray-200 p-1"
          style={{
            top: `${selectionPosition.top}px`,
            left: `${selectionPosition.left}px`,
            transform: "translateX(-50%)",
            pointerEvents: "auto", // Ensure the popup is clickable
          }}
        >
          <button
            onClick={() => handleSelectionFeedback(true)}
            className="p-1 rounded-full hover:bg-gray-100"
            title="This text is helpful"
          >
            <ThumbsUp className="w-4 h-4 text-green-600" />
          </button>
          <button
            onClick={() => handleSelectionFeedback(false)}
            className="p-1 rounded-full hover:bg-gray-100"
            title="This text needs improvement"
          >
            <ThumbsDown className="w-4 h-4 text-red-600" />
          </button>
          <button
            onClick={() => handleSelectionFeedback(true)}
            className="p-1 rounded-full hover:bg-gray-100"
            title="Comment on this text"
          >
            <MessageCircle className="w-4 h-4 text-blue-600" />
          </button>
        </div>
      )}

      {/* Selection feedback form */}
      {selectionFeedbackOpen && (
        <div
          ref={selectionFeedbackRef}
          className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 bg-white shadow-lg rounded-lg p-4 w-96 border border-gray-200"
        >
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Feedback on Selected Text</h4>
            <button
              onClick={() => setSelectionFeedbackOpen(false)}
              className="text-gray-500 hover:text-gray-700"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mb-3 p-2 bg-gray-50 rounded border border-gray-200 text-sm">
            <p className="font-medium text-xs text-gray-500 mb-1">Selected text:</p>
            <p className="italic">"{selectedText}"</p>
          </div>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Your feedback on this text..."
            className="w-full p-2 border border-gray-300 rounded-md text-sm mb-3"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex justify-between">
            {isSubmitting ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                <span className="text-sm text-gray-600">Processing...</span>
              </div>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={() => submitSelectionFeedback(true)}
                  className="flex items-center px-3 py-1 bg-green-600 text-white rounded-md text-sm"
                >
                  <ThumbsUp className="w-3 h-3 mr-1" />
                  <span>Helpful</span>
                </button>
                <button
                  onClick={() => submitSelectionFeedback(false)}
                  className="flex items-center px-3 py-1 bg-red-600 text-white rounded-md text-sm"
                >
                  <ThumbsDown className="w-3 h-3 mr-1" />
                  <span>Needs Improvement</span>
                </button>
              </div>
            )}
            <button
              onClick={() => setSelectionFeedbackOpen(false)}
              className="px-3 py-1 border border-gray-300 text-gray-700 rounded-md text-sm"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="prose-headings:relative prose-p:relative prose-li:relative prose-blockquote:relative">
        <ReactMarkdown
          components={{
            h1: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <h1 {...props} id={headingId} className="group">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </h1>
              )
            },
            h2: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <h2 {...props} id={headingId} className="group">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </h2>
              )
            },
            h3: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <h3 {...props} id={headingId} className="group">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </h3>
              )
            },
            h4: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <h4 {...props} id={headingId} className="group">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </h4>
              )
            },
            h5: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <h5 {...props} id={headingId} className="group">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </h5>
              )
            },
            strong: ({ node, ...props }) => {
              const headingId = `heading-${props.children?.toString().toLowerCase().replace(/\s+/g, "-")}`
              return (
                <strong {...props} id={headingId} className="group block relative">
                  {props.children}
                  <div className="absolute top-1 right-0 hidden group-hover:flex space-x-1">
                    {!headingFeedbackSent[headingId] ? (
                      <FeedbackButton
                        contentId={headingId}
                        contentType="heading"
                        dashboardId={dashboardId}
                        onFeedbackSent={() => handleHeadingFeedbackSent(headingId)}
                        onReportUpdated={onReportUpdated}
                        position="top"
                      />
                    ) : (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Feedback sent</span>
                    )}
                  </div>
                </strong>
              )
            }
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  )
}
