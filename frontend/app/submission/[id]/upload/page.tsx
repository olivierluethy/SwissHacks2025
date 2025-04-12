import Navigation from "@/components/navigation"
import FileUpload from "@/components/file-upload"

export default function FileUploadPage({ params }: { params: { id: string } }) {
  return (
    <>
      <Navigation />
      <FileUpload id={params.id} />
    </>
  )
}
