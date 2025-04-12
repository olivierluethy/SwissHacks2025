import Navigation from "@/components/navigation"
import FileAnalytics from "@/components/file-analytics"

export default function FileAnalyticsPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Navigation />
      <FileAnalytics id={params.id} />
    </>
  )
}
