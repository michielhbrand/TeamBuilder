import { createHash } from 'node:crypto'

const DAY = 86_400_000

export function uuid(name) {
  const h = createHash('sha1').update(`teambuilder-seed:${name}`).digest('hex')
  const variant = ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(18, 20)}-${h.slice(20, 32)}`
}

function makeRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const RECRUITERS = [
  { id: uuid('recruiter:priya'), name: 'Priya Nair' },
  { id: uuid('recruiter:daniel'), name: 'Daniel Mokoena' },
  { id: uuid('recruiter:sarah'), name: 'Sarah van Wyk' },
]

const FIRST_NAMES = [
  'Thandiwe',
  'Sipho',
  'Lerato',
  'Naledi',
  'Pieter',
  'Johan',
  'Aisha',
  'Yusuf',
  'Priya',
  'Rohan',
  'Megan',
  'Kyle',
  'Zanele',
  'Bongani',
  'Fatima',
  'Imraan',
  'Anele',
  'Tumelo',
  'Karabo',
  'Refilwe',
  'Chantelle',
  'Werner',
  'Lindiwe',
  'Themba',
  'Ayesha',
  'Kavitha',
  'Dineo',
  'Mpho',
  'Jessica',
  'Ryan',
  'Nomsa',
  'Siyabonga',
  'Hannah',
  'Liam',
  'Palesa',
  'Tshepo',
  'Nadia',
  'Gareth',
  'Busisiwe',
  'Andile',
  'Mariam',
  'Declan',
  'Ntombi',
  'Sizwe',
  'Elmarie',
  'Francois',
  'Zodwa',
  'Vusi',
  'Simone',
  'Ashwin',
]

const LAST_NAMES = [
  'Dlamini',
  'Nkosi',
  'Naidoo',
  'van der Merwe',
  'Botha',
  'Pillay',
  'Khumalo',
  'Mokoena',
  'Jacobs',
  'Adams',
  'Smith',
  'Moodley',
  'Mahlangu',
  'Sithole',
  'Govender',
  'Pretorius',
  'Molefe',
  'Ndlovu',
  'Hendricks',
  'Venter',
  'Radebe',
  'Chetty',
  'Mthembu',
  'du Plessis',
  'Zulu',
  'Maseko',
  'Fourie',
  'Abrahams',
  'Cele',
  'Louw',
  'Mabaso',
  'Singh',
  'Kruger',
  'Tshabalala',
  'Williams',
  'Ngcobo',
  'Coetzee',
  'Msimang',
  'Lombard',
  'Baloyi',
]

const COMPANIES = [
  'Brightwave Technologies',
  'Karoo Digital',
  'Cape Fintech Labs',
  'Ubuntu Systems',
  'Highveld Software',
  'Protea Analytics',
  'Table Bay Solutions',
  'Ndlovu & Partners',
  'Savanna Retail Group',
  'Lionshead Logistics',
  'Orbit Commerce',
  'Kudu Cloud Services',
  'Baobab Insurance',
  'Springbok Media',
  'Drakensberg Health',
  'Firefly Studio',
]

const UNIVERSITIES = [
  'University of Cape Town',
  'University of the Witwatersrand',
  'Stellenbosch University',
  'University of Pretoria',
  'University of Johannesburg',
  'Rhodes University',
  'University of KwaZulu-Natal',
  'North-West University',
]

const NOTES = [
  'Strong first conversation. Clear communicator and well prepared.',
  'Asked thoughtful questions about the team and how we ship work.',
  'Solid fundamentals, but light on the tools named in the job spec.',
  'Reference check came back positive.',
  'Salary expectation is at the top of our band. Worth discussing early.',
  'Available to start after a one month notice period.',
  'Portfolio and past work are a good match for the role.',
  'Struggled a little with the practical exercise, but recovered well.',
  'Very motivated and a good culture fit based on the panel feedback.',
  'Currently interviewing elsewhere, so we should move quickly.',
  'Could grow into a lead role within a year.',
  'Great energy. Panel agreed to progress to the next stage.',
  'Follow up on the gap in employment from last year.',
  'Impressive results in their current role. Quantified achievements well.',
]

const CHANNELS = ['Referral', 'LinkedIn', 'Careers page', 'Recruitment agency', 'Job board']

export const BOARDS = [
  {
    key: 'frontend',
    name: 'Senior Frontend Engineer',
    department: 'Engineering',
    positions: 2,
    openedDaysAgo: 62,
    deadlineDays: 18,
    stages: ['Applied', 'Screening', 'Technical interview', 'Offer'],
    active: [5, 4, 3, 2],
    hired: 1,
    rejected: 6,
    salaryBase: 75000,
    location: 'Johannesburg (hybrid)',
    summary:
      'Join the platform team to build the web interface that thousands of customers use every day.',
    responsibilities: [
      'Build and maintain accessible, well tested user interfaces in Vue 3 and TypeScript.',
      'Work with designers and product managers to turn ideas into shipped features.',
      'Review code, mentor teammates and raise the quality bar for the front end.',
      'Improve performance, reliability and developer experience across the web app.',
    ],
    minimum: [
      '5 or more years of professional experience building web applications',
      'Strong TypeScript and JavaScript skills',
      'Production experience with Vue or React',
      'A degree in Computer Science or Engineering, or equivalent practical experience',
    ],
    recommended: [
      'Experience with a component library such as Vuetify',
      'Knowledge of accessibility standards (WCAG)',
      'Experience mentoring junior developers',
    ],
    skills: ['TypeScript', 'Vue 3', 'Pinia', 'Vite', 'Vitest', 'CSS', 'REST APIs', 'Git'],
    ladder: [
      'Junior Frontend Developer',
      'Frontend Developer',
      'Senior Frontend Developer',
      'Lead Frontend Engineer',
    ],
    bullets: [
      'Built customer-facing web applications used by thousands of people.',
      'Cut page load times through code splitting and smarter caching.',
      'Introduced automated testing that reduced regressions release over release.',
      'Worked closely with designers to turn prototypes into accessible interfaces.',
      'Mentored junior developers and led regular code reviews.',
    ],
    degrees: [
      'BSc Computer Science',
      'BSc Information Systems',
      'BEng Electrical and Electronic Engineering',
      'Diploma in Information Technology',
    ],
  },
  {
    key: 'backend',
    name: 'Backend Platform Engineer',
    department: 'Engineering',
    positions: 1,
    openedDaysAgo: 80,
    deadlineDays: -6,
    stages: ['Applied', 'Phone screen', 'Take-home task', 'Onsite interview', 'Offer'],
    active: [3, 3, 2, 1, 0],
    hired: 0,
    rejected: 5,
    salaryBase: 80000,
    location: 'Cape Town (hybrid)',
    summary: 'Help us scale the services and data platform behind the hiring product.',
    responsibilities: [
      'Design, build and operate APIs and background services on PostgreSQL.',
      'Own the reliability, observability and security of the services you ship.',
      'Improve the delivery pipeline and developer tooling for the whole team.',
      'Contribute to architecture decisions and write clear technical documents.',
    ],
    minimum: [
      '4 or more years of backend development experience',
      'Strong Node.js and TypeScript skills',
      'Experience designing relational schemas in PostgreSQL',
      'Experience operating services in production',
    ],
    recommended: [
      'Experience with AWS or another major cloud provider',
      'Experience with containers and CI/CD pipelines',
      'Exposure to event-driven architectures',
    ],
    skills: ['Node.js', 'TypeScript', 'PostgreSQL', 'REST APIs', 'Docker', 'AWS', 'CI/CD', 'Redis'],
    ladder: [
      'Junior Software Developer',
      'Backend Developer',
      'Senior Backend Engineer',
      'Staff Platform Engineer',
    ],
    bullets: [
      'Designed and shipped REST APIs that handle millions of requests a day.',
      'Migrated a monolith to smaller services with zero downtime.',
      'Tuned slow database queries and cut report times from minutes to seconds.',
      'Set up CI/CD pipelines and infrastructure as code for the whole team.',
      'Led on-call rotations and wrote post-incident reviews that improved reliability.',
    ],
    degrees: [
      'BSc Computer Science',
      'BSc Software Engineering',
      'BEng Computer Engineering',
      'Diploma in Information Technology',
    ],
  },
  {
    key: 'designer',
    name: 'Product Designer',
    department: 'Design',
    positions: 1,
    openedDaysAgo: 40,
    deadlineDays: 9,
    stages: ['Applied', 'Portfolio review', 'Panel interview', 'Offer'],
    active: [4, 3, 1, 1],
    hired: 0,
    rejected: 3,
    salaryBase: 60000,
    location: 'Johannesburg (hybrid)',
    summary:
      'Shape how hiring managers move applicants through the pipeline, from idea to release.',
    responsibilities: [
      'Lead discovery, design and testing for features across the hiring workspace.',
      'Create flows, prototypes and polished UI in Figma, grounded in user research.',
      'Contribute to and extend the shared design system.',
      'Partner with engineers to ship accessible, consistent interfaces.',
    ],
    minimum: [
      '3 or more years of product or UX design experience',
      'A portfolio that shows end-to-end product thinking',
      'Strong skills in Figma and prototyping',
      'Experience running usability tests with real users',
    ],
    recommended: [
      'Experience maintaining a design system',
      'Working knowledge of accessibility standards',
      'Comfort with basic front-end concepts',
    ],
    skills: [
      'Figma',
      'User research',
      'Prototyping',
      'Design systems',
      'Accessibility',
      'Usability testing',
      'Wireframing',
    ],
    ladder: ['Junior UI Designer', 'UX Designer', 'Product Designer', 'Senior Product Designer'],
    bullets: [
      'Redesigned the onboarding flow and lifted activation by a double-digit margin.',
      'Ran moderated usability sessions and turned findings into prioritised fixes.',
      'Built and documented a component library used by four product teams.',
      'Partnered with engineers to ship accessible interfaces on time.',
      'Led design workshops that aligned stakeholders on a shared product direction.',
    ],
    degrees: [
      'BA Graphic Design',
      'BA Information Design',
      'BSc Interaction Design',
      'Diploma in Multimedia Design',
    ],
  },
  {
    key: 'analyst',
    name: 'Data Analyst',
    department: 'Analytics',
    positions: 1,
    openedDaysAgo: 12,
    deadlineDays: 33,
    stages: ['Applied', 'Case study', 'Interview', 'Offer'],
    active: [9, 0, 0, 0],
    hired: 0,
    rejected: 0,
    salaryBase: 55000,
    location: 'Remote (South Africa)',
    summary:
      'Turn hiring data into clear insight that helps managers make faster, better decisions.',
    responsibilities: [
      'Build dashboards and reports that track hiring speed, quality and funnel health.',
      'Write SQL to explore data, answer questions and validate findings.',
      'Present insights to non-technical stakeholders in plain language.',
      'Keep data definitions consistent and documented.',
    ],
    minimum: [
      '2 or more years of experience in an analytics role',
      'Advanced SQL skills',
      'Experience building dashboards in a BI tool',
      'A degree in Statistics, Mathematics, Economics or a related field',
    ],
    recommended: [
      'Experience with Python for analysis',
      'Knowledge of experimentation and A/B testing',
      'Exposure to data modelling',
    ],
    skills: ['SQL', 'Python', 'Power BI', 'Excel', 'Statistics', 'Data modelling', 'Tableau'],
    ladder: ['Junior Data Analyst', 'Data Analyst', 'Senior Data Analyst', 'Analytics Lead'],
    bullets: [
      'Built executive dashboards that replaced a weekly manual reporting process.',
      'Wrote SQL models that became the single source of truth for key metrics.',
      'Presented quarterly insights to leadership and drove two process changes.',
      'Automated data cleaning in Python and saved the team hours every week.',
      'Designed and analysed A/B tests for product and marketing campaigns.',
    ],
    degrees: [
      'BSc Statistics',
      'BCom Economics',
      'BSc Mathematical Statistics',
      'BCom Informatics',
    ],
  },
  {
    key: 'sales',
    name: 'Account Executive',
    department: 'Sales',
    positions: 3,
    openedDaysAgo: 55,
    deadlineDays: 40,
    stages: ['Applied', 'Intro call', 'Role play', 'Offer'],
    active: [4, 4, 2, 1],
    hired: 2,
    rejected: 4,
    salaryBase: 50000,
    location: 'Johannesburg (on-site)',
    summary: 'Win new business by helping growing companies hire better and faster.',
    responsibilities: [
      'Manage the full sales cycle from first conversation to signed contract.',
      'Build and maintain a healthy pipeline of qualified opportunities.',
      'Run discovery calls and tailored demos for hiring leaders.',
      'Forecast accurately and keep the CRM up to date.',
    ],
    minimum: [
      '2 or more years of B2B sales experience',
      'A track record of meeting or exceeding quota',
      'Strong negotiation and presentation skills',
      'Experience using a CRM',
    ],
    recommended: [
      'Experience selling software or services to HR teams',
      'Experience with outbound prospecting',
      'A valid drivers licence and willingness to travel',
    ],
    skills: [
      'B2B sales',
      'Pipeline management',
      'Negotiation',
      'CRM',
      'Forecasting',
      'Presentations',
      'Prospecting',
    ],
    ladder: [
      'Sales Development Representative',
      'Business Development Executive',
      'Account Executive',
      'Senior Account Executive',
    ],
    bullets: [
      'Exceeded annual quota for three years in a row.',
      'Closed several enterprise deals through consultative, multi-stakeholder selling.',
      'Built an outbound prospecting routine that doubled qualified meetings.',
      'Kept a clean CRM and delivered accurate monthly forecasts.',
      'Trained new sales hires on discovery calls and objection handling.',
    ],
    degrees: [
      'BCom Marketing',
      'BCom Business Management',
      'Diploma in Sales Management',
      'BA Communication Science',
    ],
  },
  {
    key: 'ops',
    name: 'Operations Coordinator',
    department: 'Operations',
    positions: 1,
    openedDaysAgo: 90,
    deadlineDays: 25,
    stages: ['Applied', 'Screening', 'Interview', 'Offer'],
    active: [0, 1, 0, 0],
    hired: 1,
    rejected: 5,
    salaryBase: 35000,
    location: 'Durban (on-site)',
    summary: 'Keep the office, suppliers and internal processes running smoothly.',
    responsibilities: [
      'Coordinate suppliers, scheduling and day-to-day office operations.',
      'Track budgets and prepare simple monthly operations reports.',
      'Improve internal processes and document how things work.',
      'Support leadership with logistics for events and travel.',
    ],
    minimum: [
      '2 or more years of experience in an operations or administration role',
      'Strong organisation and time management',
      'Proficiency in Excel',
    ],
    recommended: [
      'Experience managing vendors and contracts',
      'A diploma or degree in Business Administration or Logistics',
    ],
    skills: [
      'Process improvement',
      'Excel',
      'Logistics',
      'Vendor management',
      'Reporting',
      'Scheduling',
    ],
    ladder: [
      'Administrative Assistant',
      'Operations Assistant',
      'Operations Coordinator',
      'Operations Supervisor',
    ],
    bullets: [
      'Coordinated suppliers and renegotiated contracts to reduce monthly costs.',
      'Documented processes that cut onboarding time for new staff.',
      'Produced monthly operations reports for the leadership team.',
      'Planned company events and travel for teams of up to fifty people.',
    ],
    degrees: [
      'BCom Business Administration',
      'Diploma in Logistics',
      'National Diploma in Office Management',
      'BCom Supply Chain Management',
    ],
  },
  {
    key: 'csm',
    name: 'Customer Success Manager',
    department: 'Customer success',
    positions: 2,
    openedDaysAgo: 30,
    deadlineDays: 12,
    stages: ['Applied', 'Intro call', 'Interview', 'Offer'],
    active: [3, 2, 1, 0],
    hired: 0,
    rejected: 2,
    salaryBase: 52000,
    location: 'Cape Town (hybrid)',
    summary: 'Help customers get lasting value from the product and grow with us.',
    responsibilities: [
      'Own onboarding, adoption and renewals for a portfolio of customers.',
      'Run regular business reviews and share clear, honest recommendations.',
      'Bring customer feedback to product and engineering teams.',
      'Spot churn risk early and act on it.',
    ],
    minimum: [
      '3 or more years of customer success or account management experience',
      'Excellent written and verbal communication',
      'Experience managing renewals',
    ],
    recommended: [
      'Experience with SaaS products',
      'Familiarity with customer health scoring',
      'Experience with a support or CRM tool',
    ],
    skills: [
      'Customer onboarding',
      'Account management',
      'Renewals',
      'Churn prevention',
      'Reporting',
      'CRM',
    ],
    ladder: [
      'Customer Support Agent',
      'Customer Success Associate',
      'Customer Success Manager',
      'Senior Customer Success Manager',
    ],
    bullets: [
      'Managed a portfolio of mid-market accounts with strong renewal rates.',
      'Built a customer health score that flagged churn risk early.',
      'Ran quarterly business reviews that led to successful upsells.',
      'Created onboarding playbooks that shortened time to value.',
    ],
    degrees: [
      'BCom Business Management',
      'BA Communication Science',
      'Diploma in Customer Service',
      'BCom Marketing',
    ],
  },
  {
    key: 'content',
    name: 'Content Marketing Lead',
    department: 'Marketing',
    positions: 1,
    openedDaysAgo: 20,
    deadlineDays: 60,
    stages: ['Applied', 'Writing test', 'Interview', 'Offer'],
    active: [3, 2, 1, 0],
    hired: 0,
    rejected: 1,
    salaryBase: 58000,
    location: 'Remote (South Africa)',
    summary: 'Lead the stories, guides and campaigns that help us reach hiring teams.',
    responsibilities: [
      'Plan and run the content calendar across blog, email and social.',
      'Write and edit clear, useful content for hiring managers.',
      'Measure what works and adjust the strategy.',
      'Manage freelancers and agency partners.',
    ],
    minimum: [
      '4 or more years of content marketing experience',
      'An excellent writing and editing portfolio',
      'Experience measuring content performance',
    ],
    recommended: [
      'Experience in B2B or HR technology',
      'Working knowledge of SEO',
      'Experience managing freelancers',
    ],
    skills: [
      'Copywriting',
      'SEO',
      'Content strategy',
      'Email marketing',
      'Google Analytics',
      'Social media',
    ],
    ladder: ['Content Writer', 'Content Marketer', 'Senior Content Marketer', 'Content Lead'],
    bullets: [
      'Grew organic traffic substantially through a consistent editorial plan.',
      'Launched a newsletter that reached thousands of subscribers.',
      'Managed freelance writers and kept a predictable publishing cadence.',
      'Reported on content performance and shifted spend to what worked.',
    ],
    degrees: [
      'BA Journalism',
      'BA English and Media Studies',
      'BCom Marketing',
      'Diploma in Public Relations',
    ],
  },
]

const SALARY_STEP = 500

const DEPARTMENT_BASE_HIRES = {
  Engineering: 2.2,
  Design: 0.8,
  Analytics: 0.7,
  Sales: 2.0,
  Operations: 1.0,
  'Customer success': 1.2,
  Marketing: 0.7,
}

const DEPARTMENT_DAYS_TO_HIRE = {
  Engineering: 58,
  Design: 46,
  Analytics: 41,
  Sales: 32,
  Operations: 28,
  'Customer success': 35,
  Marketing: 39,
}

const HISTORY_MONTHS = 30

function pad(value) {
  return String(value).padStart(2, '0')
}

function monthKey(date) {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`
}

function monthStart(date) {
  return `${monthKey(date)}-01`
}

function utcDay(date) {
  return Math.floor(date.getTime() / DAY)
}

export function generateDataset(now = new Date(), seed = 20261122) {
  const random = makeRandom(seed)
  const int = (min, max) => Math.floor(random() * (max - min + 1)) + min
  const between = (min, max) => min + random() * (max - min)
  const pick = (items) => items[Math.floor(random() * items.length)]
  const sample = (items, count) => {
    const copy = [...items]
    const out = []
    while (out.length < count && copy.length) {
      out.push(copy.splice(Math.floor(random() * copy.length), 1)[0])
    }
    return out
  }

  const names = []
  for (const first of FIRST_NAMES) {
    for (const last of sample(LAST_NAMES, 2)) {
      names.push(`${first} ${last}`)
    }
  }
  const namePool = sample(names, names.length)
  let nameCursor = 0
  let phoneCursor = 0

  const monthly = new Map()
  const bump = (date, department, field, amount = 1) => {
    const key = `${monthStart(date)}|${department}`
    const row = monthly.get(key) ?? {
      month: monthStart(date),
      department,
      applicants_in: 0,
      hired: 0,
      rejected: 0,
    }
    row[field] += amount
    monthly.set(key, row)
  }

  const boards = []
  const columns = []
  const applicants = []
  const events = []
  const notes = []
  const hires = []

  for (const def of BOARDS) {
    const boardId = uuid(`board:${def.key}`)
    const createdAt = new Date(now.getTime() - def.openedDaysAgo * DAY)
    const deadline = new Date(now.getTime() + def.deadlineDays * DAY)
    const columnIds = def.stages.map((name, index) => uuid(`column:${def.key}:${index}`))

    boards.push({
      id: boardId,
      name: def.name,
      department: def.department,
      open_positions: def.positions,
      deadline: deadline.toISOString().slice(0, 10),
      created_at: createdAt,
      job_spec_path: `${boardId}/job-spec.pdf`,
      job_spec_name: `${def.name.replaceAll(' ', '_')}_Job_Spec.pdf`,
      def,
    })

    def.stages.forEach((name, index) => {
      columns.push({
        id: columnIds[index],
        board_id: boardId,
        name,
        position: index,
        created_at: createdAt,
      })
    })

    const lastStage = def.stages.length - 1
    const slots = []
    def.active.forEach((count, stage) => {
      for (let i = 0; i < count; i += 1) {
        slots.push({ stage, status: 'active' })
      }
    })
    for (let i = 0; i < def.hired; i += 1) {
      slots.push({ stage: lastStage, status: 'hired' })
    }
    for (let i = 0; i < def.rejected; i += 1) {
      const stage = Math.min(lastStage - 1, Math.floor(random() ** 1.6 * lastStage))
      slots.push({ stage, status: 'rejected' })
    }

    slots.forEach((slot, slotIndex) => {
      const fullName = namePool[nameCursor % namePool.length]
      nameCursor += 1
      const [firstName, ...rest] = fullName.split(' ')
      const lastName = rest.join(' ')
      const id = uuid(`applicant:${def.key}:${slotIndex}`)
      const strength = random()
      const closed = slot.status !== 'active'

      const minDays = slot.stage * 4 + (closed ? 5 : 2)
      const maxDays = Math.max(minDays + 0.5, def.openedDaysAgo - 0.5)
      const appliedDaysAgo = minDays + random() * (maxDays - minDays)
      const appliedAt = new Date(now.getTime() - appliedDaysAgo * DAY)

      const lastMoveAgo =
        slot.stage === 0
          ? appliedDaysAgo
          : Math.min(appliedDaysAgo * 0.6, between(0.3, closed ? 9 : 10))
      const stepEnteredAt = new Date(now.getTime() - lastMoveAgo * DAY)

      const timeline = [{ at: appliedAt, kind: 'created' }]
      for (let stage = 1; stage <= slot.stage; stage += 1) {
        const at = new Date(
          appliedAt.getTime() +
            ((stepEnteredAt.getTime() - appliedAt.getTime()) * stage) / slot.stage,
        )
        timeline.push({ at, kind: 'moved', stage })
      }

      let decidedAt = null
      if (closed) {
        const gapDays = Math.min(between(0.4, 4), Math.max(0.2, lastMoveAgo - 0.1))
        decidedAt = new Date(stepEnteredAt.getTime() + gapDays * DAY)
        timeline.push({ at: decidedAt, kind: slot.status })
      }

      if (random() < 0.12 && lastMoveAgo > 1) {
        const span = (decidedAt ?? now).getTime() - appliedAt.getTime()
        timeline.push({
          at: new Date(appliedAt.getTime() + span * between(0.3, 0.8)),
          kind: 'edited',
        })
        timeline.sort((a, b) => a.at - b.at)
      }

      for (let index = 1; index < timeline.length; index += 1) {
        if (!(timeline[index].at > timeline[index - 1].at)) {
          throw new Error(`Timeline out of order for ${fullName} on ${def.name}`)
        }
      }

      const experience = buildExperience(def, strength, now, { random, int, pick, sample })
      const education = buildEducation(def, experience, { random, int, pick })
      const skillCount = Math.round(3 + strength * (def.skills.length - 3))
      const skills = sample(def.skills, skillCount)

      const salary =
        Math.round((def.salaryBase * (0.8 + strength * 0.5)) / SALARY_STEP) * SALARY_STEP
      const bandLow = Math.floor(salary / 15000) * 15
      const email = `${firstName}.${lastName}`.toLowerCase().replaceAll(' ', '').replaceAll("'", '')
      phoneCursor += 1

      const current = experience.find((entry) => entry.current) ?? experience[0]
      const applicant = {
        id,
        board_id: boardId,
        column_id: columnIds[slot.stage],
        full_name: fullName,
        email: `${email}@example.com`,
        phone: `0710${String(100000 + phoneCursor * 37).slice(-6)}`,
        job_title: current?.title ?? def.ladder[0],
        education,
        experience,
        skills,
        favorite: !closed && slot.stage > 0 && random() < 0.25,
        status: slot.status,
        applied_at: appliedAt,
        step_entered_at: stepEnteredAt,
        updated_at: timeline[timeline.length - 1].at,
        cv_path: `${id}/cv.pdf`,
        cv_name: `${firstName}_${lastName.replaceAll(' ', '_')}_CV.pdf`,
        notice_period_months: pick([0, 1, 1, 1, 2, 3, 0.5]),
        salary_expectation_cents: salary * 100,
        rem_channel: pick(CHANNELS),
        salary_band: `R${bandLow}k - R${bandLow + 15}k`,
        strength,
        boardKey: def.key,
      }
      applicants.push(applicant)

      for (const item of timeline) {
        const actor = pick(RECRUITERS)
        let action
        let message
        if (item.kind === 'created') {
          action = 'created'
          message = `${actor.name} has added ${fullName} as an applicant`
        } else if (item.kind === 'moved') {
          action = 'moved'
          message = `${actor.name} has moved ${fullName} to ${def.stages[item.stage]} step`
        } else if (item.kind === 'edited') {
          action = 'edited'
          message = `${actor.name} has edited ${fullName}'s profile details`
        } else {
          action = item.kind
          message = `${actor.name} has ${item.kind} ${fullName}`
        }
        events.push({
          id: uuid(`event:${id}:${action}:${item.at.getTime()}`),
          board_id: boardId,
          applicant_id: id,
          actor_id: actor.id,
          actor_name: actor.name,
          action,
          message,
          created_at: item.at,
        })
      }

      const noteChance = slot.stage > 0 || closed ? 0.6 : 0.2
      if (random() < noteChance) {
        const count = int(1, slot.stage >= 2 ? 3 : 2)
        const last = (decidedAt ?? now).getTime()
        const bodies = sample(NOTES, count)
        bodies.forEach((body, noteIndex) => {
          const author = pick(RECRUITERS)
          const at = new Date(
            appliedAt.getTime() +
              ((last - appliedAt.getTime()) * (noteIndex + 1)) / (count + 1) -
              between(0, 0.4) * DAY,
          )
          notes.push({
            id: uuid(`note:${id}:${noteIndex}`),
            board_id: boardId,
            applicant_id: id,
            author_id: author.id,
            author_name: author.name,
            body,
            created_at: at > appliedAt ? at : new Date(appliedAt.getTime() + 3_600_000),
          })
        })
      }

      bump(appliedAt, def.department, 'applicants_in')
      if (slot.status === 'hired') {
        bump(decidedAt, def.department, 'hired')
        hires.push({
          applicant_id: id,
          department: def.department,
          hired_on: decidedAt.toISOString().slice(0, 10),
          days_to_hire: Math.max(0, utcDay(decidedAt) - utcDay(createdAt)),
        })
      } else if (slot.status === 'rejected') {
        bump(decidedAt, def.department, 'rejected')
      }
    })
  }

  const history = buildHistory(now, { random, int, pick })
  for (const row of history.monthly) {
    const key = `${row.month}|${row.department}`
    const existing = monthly.get(key)
    if (existing) {
      existing.applicants_in += row.applicants_in
      existing.hired += row.hired
      existing.rejected += row.rejected
    } else {
      monthly.set(key, { ...row })
    }
  }

  verify({ boards, columns, applicants, events, notes })

  return {
    now,
    recruiters: RECRUITERS,
    boards,
    columns,
    applicants,
    events,
    notes,
    hiringMonthly: [...monthly.values()].sort(
      (a, b) => a.month.localeCompare(b.month) || a.department.localeCompare(b.department),
    ),
    hireHistory: [...hires, ...history.hires].sort((a, b) => a.hired_on.localeCompare(b.hired_on)),
  }
}

function buildExperience(def, strength, now, { random, int, pick, sample }) {
  const totalMonths = Math.round((1.2 + strength * 9) * 12 + random() * 10)
  const count = totalMonths > 72 ? 3 : totalMonths > 30 ? 2 : 1
  const weights = Array.from({ length: count }, () => 0.5 + random())
  const weightSum = weights.reduce((sum, value) => sum + value, 0)
  const lengths = weights.map((weight) =>
    Math.max(8, Math.round((totalMonths * weight) / weightSum)),
  )

  const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth()
  const toMonth = (index) => `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`
  const companies = []
  while (companies.length < count) {
    const company = pick(COMPANIES)
    if (!companies.includes(company)) {
      companies.push(company)
    }
  }

  const entries = []
  let cursor = nowIndex
  const stillEmployed = random() < 0.8
  for (let position = 0; position < count; position += 1) {
    const isLatest = position === 0
    const end = isLatest ? (stillEmployed ? null : cursor - int(1, 4)) : cursor - int(0, 2)
    const endIndex = end ?? cursor
    const start = endIndex - lengths[position]
    const rung = Math.min(
      def.ladder.length - 1,
      Math.max(0, Math.round(strength * (def.ladder.length - 1)) - position),
    )
    entries.push({
      id: uuid(`entry:${def.key}:${random()}`),
      title: def.ladder[rung],
      organization: companies[position],
      start: toMonth(start),
      end: end === null ? '' : toMonth(end),
      current: end === null,
      description: sample(def.bullets, 2).join(' '),
    })
    cursor = start
  }
  return entries
}

function buildEducation(def, experience, { random, int, pick }) {
  const earliest = experience[experience.length - 1]
  const [startYear] = earliest.start.split('-').map(Number)
  const endYear = startYear - int(0, 1)
  const length = pick([3, 3, 4])
  const entries = [
    {
      id: uuid(`education:${def.key}:${random()}`),
      title: pick(def.degrees),
      organization: pick(UNIVERSITIES),
      start: `${endYear - length}-02`,
      end: `${endYear}-11`,
      current: false,
      description: '',
    },
  ]
  if (random() < 0.3) {
    entries.push({
      id: uuid(`education:${def.key}:${random()}`),
      title: pick(['Certificate in Project Management', 'Certificate in Data Fundamentals']),
      organization: pick(UNIVERSITIES),
      start: `${endYear + 1}-03`,
      end: `${endYear + 1}-09`,
      current: false,
      description: '',
    })
  }
  return entries.sort((a, b) => b.start.localeCompare(a.start))
}

function buildHistory(now, { random, int }) {
  const monthly = []
  const hires = []
  const currentMonthIndex = now.getUTCFullYear() * 12 + now.getUTCMonth()

  for (let back = HISTORY_MONTHS; back >= 1; back -= 1) {
    const index = currentMonthIndex - back
    const year = Math.floor(index / 12)
    const month = index % 12
    const progress = 1 - back / HISTORY_MONTHS
    const scale = (0.55 + 0.45 * progress) * (back <= 3 ? 0.6 : 1)
    const trend = 1.25 - 0.3 * progress
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

    for (const [department, base] of Object.entries(DEPARTMENT_BASE_HIRES)) {
      const hired = Math.max(0, Math.round(base * scale + (random() - 0.5) * 1.6))
      const applicantsIn = hired * int(9, 16) + int(0, 6)
      const rejected = Math.min(applicantsIn, Math.round(applicantsIn * (0.35 + random() * 0.2)))
      monthly.push({
        month: `${year}-${pad(month + 1)}-01`,
        department,
        applicants_in: applicantsIn,
        hired,
        rejected,
      })

      for (let hire = 0; hire < hired; hire += 1) {
        const day = int(1, daysInMonth)
        const hiredOn = new Date(Date.UTC(year, month, day))
        const tail = random() < 0.12 ? 1.8 : 1
        const days = Math.round(
          DEPARTMENT_DAYS_TO_HIRE[department] * trend * tail * (0.55 + 0.9 * random() ** 1.3),
        )
        hires.push({
          applicant_id: uuid(`history:${year}-${month}:${department}:${hire}`),
          department,
          hired_on: hiredOn.toISOString().slice(0, 10),
          days_to_hire: Math.max(5, Math.min(180, days)),
        })
      }
    }
  }
  return { monthly, hires }
}

function verify({ boards, columns, applicants, events, notes }) {
  const boardIds = new Set(boards.map((board) => board.id))
  const columnIds = new Set(columns.map((column) => column.id))
  const emails = new Set()
  const phones = new Set()
  const names = new Set()

  for (const board of boards) {
    const key = `${board.department}|${board.name.toLowerCase()}`
    if (names.has(key)) {
      throw new Error(`Duplicate board ${board.name}`)
    }
    names.add(key)
  }

  for (const applicant of applicants) {
    if (!boardIds.has(applicant.board_id) || !columnIds.has(applicant.column_id)) {
      throw new Error(`Applicant ${applicant.full_name} points at a missing board or stage`)
    }
    const emailKey = `${applicant.board_id}|${applicant.email}`
    const phoneKey = `${applicant.board_id}|${applicant.phone}`
    if (emails.has(emailKey) || phones.has(phoneKey)) {
      throw new Error(`Duplicate contact details for ${applicant.full_name}`)
    }
    emails.add(emailKey)
    phones.add(phoneKey)
    if (!/^\d+$/.test(applicant.phone)) {
      throw new Error(`Phone number for ${applicant.full_name} must be digits only`)
    }
    if (applicant.step_entered_at < applicant.applied_at) {
      throw new Error(`${applicant.full_name} entered a stage before applying`)
    }
  }

  const applicantIds = new Set(applicants.map((applicant) => applicant.id))
  for (const item of [...events, ...notes]) {
    if (!applicantIds.has(item.applicant_id)) {
      throw new Error('An event or note points at a missing applicant')
    }
  }
}
