import { apiUrl } from "@/lib/api";

export function getVerificationSubmissionDocumentUrl(submissionId: string, index: number): string {
  return apiUrl(`/api/verification-submissions/${encodeURIComponent(submissionId)}/documents/${index}`);
}
