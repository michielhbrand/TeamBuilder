import { compressPdfForUpload, isPdfFile, PDF_MAX_BYTES } from '@/lib/pdf'
import { supabase } from '@/lib/supabase'
import { CV_BUCKET, JOB_SPEC_BUCKET, fail } from '@/lib/api-shared'

async function preparePdf(file: File, label: string): Promise<File> {
  if (!isPdfFile(file)) {
    throw new Error(`${label} must be a PDF file.`)
  }

  if (file.size > PDF_MAX_BYTES) {
    throw new Error(`${label} must be smaller than 10 MB.`)
  }

  const compressed = await compressPdfForUpload(file)

  if (compressed.size > PDF_MAX_BYTES) {
    throw new Error(`${label} must be smaller than 10 MB after compression.`)
  }

  return compressed
}

export function applicantCvPath(id: string): string {
  return `${id}/cv.pdf`
}

export async function uploadApplicantCv(
  id: string,
  file: File,
): Promise<{ path: string; name: string }> {
  const prepared = await preparePdf(file, 'The CV')
  const path = applicantCvPath(id)
  const { error } = await supabase.storage.from(CV_BUCKET).upload(path, prepared, {
    contentType: 'application/pdf',
    upsert: true,
  })

  fail(error)

  return { path, name: file.name }
}

export async function deleteApplicantCv(path: string): Promise<void> {
  const { error } = await supabase.storage.from(CV_BUCKET).remove([path])
  fail(error)
}

export async function createApplicantCvUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(CV_BUCKET).createSignedUrl(path, expiresIn)
  fail(error)

  if (!data?.signedUrl) {
    throw new Error('The CV link could not be created.')
  }

  return data.signedUrl
}

export async function downloadApplicantCv(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(CV_BUCKET).download(path)
  fail(error)

  if (!data) {
    throw new Error('The CV could not be downloaded.')
  }

  return data
}

export function boardJobSpecPath(id: string): string {
  return `${id}/job-spec.pdf`
}

export async function uploadBoardJobSpec(
  boardId: string,
  file: File,
): Promise<{ path: string; name: string }> {
  const prepared = await preparePdf(file, 'The job spec')
  const path = boardJobSpecPath(boardId)
  const { error } = await supabase.storage.from(JOB_SPEC_BUCKET).upload(path, prepared, {
    contentType: 'application/pdf',
    upsert: true,
  })

  fail(error)

  return { path, name: file.name }
}

export async function updateBoardJobSpec(
  id: string,
  path: string | null,
  name: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('boards')
    .update({ job_spec_path: path, job_spec_name: name })
    .eq('id', id)

  fail(error)
}

export async function deleteBoardJobSpec(path: string): Promise<void> {
  const { error } = await supabase.storage.from(JOB_SPEC_BUCKET).remove([path])
  fail(error)
}

export async function createBoardJobSpecUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(JOB_SPEC_BUCKET)
    .createSignedUrl(path, expiresIn)

  fail(error)

  if (!data?.signedUrl) {
    throw new Error('The job spec link could not be created.')
  }

  return data.signedUrl
}

export async function downloadBoardJobSpec(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(JOB_SPEC_BUCKET).download(path)
  fail(error)

  if (!data) {
    throw new Error('The job spec could not be downloaded.')
  }

  return data
}
