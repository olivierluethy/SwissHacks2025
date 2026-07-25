"use client"

import { useMemo } from "react"
import DOMPurify from "dompurify"

/**
 * SEC-005: model-generated HTML used to go straight into dangerouslySetInnerHTML.
 *
 * The tabs schema deliberately allows an HTML content type, and retrieved
 * third-party corpus text feeds the same prompt (SEC-004), so that markup is
 * attacker-influenceable. Everything is sanitised to a small allowlist before
 * it reaches the DOM.
 */
const ALLOWED_TAGS = [
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption",
  "p", "br", "hr", "span", "div",
  "ul", "ol", "li",
  "strong", "b", "em", "i", "u", "code", "pre",
  "h1", "h2", "h3", "h4", "h5", "h6",
]

const ALLOWED_ATTR = ["colspan", "rowspan", "align", "scope"]

export function sanitizeHtml(dirty: string): string {
  if (typeof window === "undefined") {
    // Server render: emit nothing rather than unsanitised markup. The client
    // pass fills it in immediately after hydration.
    return ""
  }
  return DOMPurify.sanitize(dirty ?? "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input"],
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
    ALLOW_DATA_ATTR: false,
  })
}

export default function SafeHtml({ html, className }: { html: string; className?: string }) {
  const clean = useMemo(() => sanitizeHtml(html), [html])
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}
