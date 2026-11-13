const SENSITIVE_LINE_RE =
  /\b(?:date of birth|dob|age|gender|sex|nationality|citizenship|marital status|address|residential|id number|identity number|passport|visa|religion|race|ethnicity|disability|photo)\b/i

const URL_RE = /https?:\/\/\S+|www\.\S+|linkedin\.com\/\S+/gi
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
const PHONE_RE = /(?:\+?\d[\d\s().-]{6,}\d)/g

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function redactText(
  text: string,
  applicant: { full_name: string; email: string; phone: string },
): string {
  let output = text
    .replace(EMAIL_RE, ' ')
    .replace(URL_RE, ' ')
    .replace(PHONE_RE, (match) => {
      const digits = match.replace(/\D/g, '')

      if (digits.length < 8 || digits.length > 15) {
        return match
      }

      if (/^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/.test(match.trim())) {
        return match
      }

      return ' '
    })
  const fullName = applicant.full_name.trim()

  if (fullName) {
    output = output.replace(new RegExp(escapeRegExp(fullName), 'gi'), ' ')

    for (const part of fullName.split(/\s+/).filter((token) => token.length >= 2)) {
      output = output.replace(new RegExp(`\\b${escapeRegExp(part)}\\b`, 'gi'), ' ')
    }
  }

  if (applicant.email.trim()) {
    output = output.replace(new RegExp(escapeRegExp(applicant.email.trim()), 'gi'), ' ')
  }

  const phoneDigits = applicant.phone.replace(/\D/g, '')

  if (phoneDigits.length >= 8) {
    output = output.replace(new RegExp(escapeRegExp(phoneDigits), 'g'), ' ')
  }

  return output
    .split('\n')
    .filter((line) => !SENSITIVE_LINE_RE.test(line))
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 6000)
}

export function prepareCandidateText(
  education: string,
  experience: string,
  applicant: { full_name: string; email: string; phone: string },
): string {
  const sections = [
    education.trim() ? `Education:\n${education.trim()}` : '',
    experience.trim() ? `Work experience:\n${experience.trim()}` : '',
  ].filter(Boolean)

  return redactText(sections.join('\n\n'), applicant)
}

export function prepareJobSpecText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 20_000)
}
