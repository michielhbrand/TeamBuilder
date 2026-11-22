export const PROMPT_VERSION = '2026-11-22.3'

export const SYSTEM_PROMPT = `Compare candidate with job spec.
Return JSON only. No markdown.

Use provided education and experience only. No invention.
No personal data.

Return:
- "similarities": job requirements candidate supports
- "gaps": job requirements candidate lacks

Return 2-4 items per array. One sentence each. Under 15 words.
No generic praise. No duplicates.

Return:
{
  "similarities": ["Requirement: evidence"],
  "gaps": ["Requirement: missing"]
}`

export function buildUserPrompt(input: {
  boardName: string
  department: string
  jobSpecText: string
  candidateText: string
}): string {
  return JSON.stringify(
    {
      role: {
        board: input.boardName,
        department: input.department,
      },
      jobSpec: input.jobSpecText,
      candidate: input.candidateText,
    },
    null,
    2,
  )
}
