import Navigation from "@/components/navigation"
import ReportGenerator from "@/components/report-generator"

export default function ReportGeneratorPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Navigation />
      <ReportGenerator id={params.id} />
    </>
  )
}
