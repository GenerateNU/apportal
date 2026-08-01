import { useMutation } from '@tanstack/react-query'
import {
  createAnswerUploadUrl,
  useCreateAnswerFileUrl,
} from '@/generated/answers/answers'
import type { RequestOptions } from '@/lib/api/orval-mutator'

// Requests a signed Supabase Storage upload URL for a PDF answer to a
// `url`-type question. The caller must then PUT the file's bytes to the
// returned upload_url directly (see uploadFileToSignedUrl) — this only
// authorizes the upload, it doesn't perform it.
export function useRequestUploadUrl() {
  return useMutation({
    mutationFn: (vars: {
      applicationId: string
      questionId: string
      filename: string
      opts?: RequestOptions
    }) =>
      createAnswerUploadUrl(
        vars.applicationId,
        vars.questionId,
        { filename: vars.filename },
        vars.opts
      ),
  })
}

// Fetches a short-lived signed URL to view/download an already-uploaded PDF
// answer. Enabled only when the question actually has a file on it, so
// components can pass `enabled: !!filePath` straight through.
export function useAnswerFileUrl(
  applicationId: string,
  questionId: string,
  enabled: boolean
) {
  return useCreateAnswerFileUrl(applicationId, questionId, {
    query: { enabled },
  })
}

// PUTs a file's raw bytes to a signed Storage upload URL. This goes directly
// to Supabase's Storage host (not the app's own API), so it bypasses the
// generated client/customInstance entirely — a plain fetch is simplest and
// correct here.
export async function uploadFileToSignedUrl(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) {
    throw new Error(`Upload failed with status ${res.status}`)
  }
}
