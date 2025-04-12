import Navigation from "@/components/navigation"
import SubmissionDetail from "@/components/submission-detail"

export default function SubmissionDetailPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Navigation />
      <SubmissionDetail id={params.id} />
    </>
  )
}
