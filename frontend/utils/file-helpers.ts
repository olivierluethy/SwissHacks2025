/**
 * Extracts files from a zip archive
 * @param {File} zipFile - The zip file to extract
 * @returns {Promise<File[]>} Array of extracted files
 */
export async function extractFilesFromZip(zipFile: File): Promise<File[]> {
  try {
    // We need to use JSZip library to extract files
    const JSZip = (await import("jszip")).default

    // Read the zip file
    const zip = await JSZip.loadAsync(zipFile)
    const extractedFiles: File[] = []

    // Process each file in the zip
    const promises = Object.keys(zip.files).map(async (filename) => {
      const zipEntry = zip.files[filename]

      // Skip directories
      if (zipEntry.dir) return

      // Get file content as blob
      const content = await zipEntry.async("blob")

      // Create a new File object
      const file = new File([content], filename, {
        type: content.type || getFileTypeFromExtension(filename),
      })

      extractedFiles.push(file)
    })

    await Promise.all(promises)
    return extractedFiles
  } catch (error) {
    console.error("Error extracting files from zip:", error)
    throw new Error("Failed to extract files from zip archive")
  }
}

/**
 * Gets MIME type from file extension
 * @param {string} filename - The filename with extension
 * @returns {string} MIME type
 */
function getFileTypeFromExtension(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() || ""

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    txt: "text/plain",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  }

  return mimeTypes[extension] || "application/octet-stream"
}

/**
 * Validates files based on allowed types and max size
 * @param {File[]} files - Array of files to validate
 * @param {string[]} allowedTypes - Array of allowed MIME types or extensions
 * @param {number} maxSizeMB - Maximum file size in MB
 * @returns {Object} Validation result with valid files and errors
 */
export function validateFiles(
  files: File[],
  allowedTypes: string[] = [],
  maxSizeMB = 50,
): { validFiles: File[]; errors: string[] } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024
  const validFiles: File[] = []
  const errors: string[] = []

  files.forEach((file) => {
    // Check file size
    if (file.size > maxSizeBytes) {
      errors.push(`${file.name} exceeds the maximum file size of ${maxSizeMB}MB`)
      return
    }

    // Check file type if allowedTypes is provided
    if (allowedTypes.length > 0) {
      const fileExtension = file.name.split(".").pop()?.toLowerCase() || ""
      const isValidType = allowedTypes.includes(file.type) || allowedTypes.includes(`.${fileExtension}`)

      if (!isValidType) {
        errors.push(`${file.name} has an unsupported file type`)
        return
      }
    }

    validFiles.push(file)
  })

  return { validFiles, errors }
}

/**
 * Formats file size in a human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
