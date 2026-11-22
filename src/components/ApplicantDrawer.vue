<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ApplicantStageBar from '@/components/ApplicantStageBar.vue'
import CareerStrip from '@/components/CareerStrip.vue'
import CareerTimeline from '@/components/CareerTimeline.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FitConsentDialog from '@/components/FitConsentDialog.vue'
import FitRequirements from '@/components/FitRequirements.vue'
import ResyncCvDialog from '@/components/ResyncCvDialog.vue'
import { formatEventTime, formatRelativeTime } from '@/lib/applicant-events'
import { hasCareerContent } from '@/lib/career'
import { requirementTotal } from '@/lib/fit-rank'
import { importApplicantFromPdf } from '@/lib/resume-import'
import {
  formatNoticePeriod,
  formatSalaryCents,
  parseNoticePeriod,
  parseSalaryToCents,
} from '@/lib/compensation'
import { isPdfFile, printPdfBlob } from '@/lib/pdf'
import { daysSinceApplied, initials as getInitials } from '@/lib/pipeline'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore, type EditableCandidateField } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import { useStorageStore } from '@/stores/storage'
import type { CareerEntry, CareerKind } from '@/types/pipeline'

const props = defineProps<{
  modelValue: boolean
  candidateId: string | null
  autoFitCandidateId?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useApplicantsStore()
const boards = useBoardsStore()
const activity = useApplicantActivityStore()
const storage = useStorageStore()
const fit = useFitStore()
const detailsError = computed(() => store.error || activity.error || storage.error)
const eventsError = computed(() => activity.error)
const candidate = computed(() =>
  props.candidateId ? store.candidateById(props.candidateId) : undefined,
)
const board = computed(() =>
  candidate.value ? boards.boardById(candidate.value.boardId) : undefined,
)
const initials = computed(() => (candidate.value ? getInitials(candidate.value.name) : ''))
const appliedLine = computed(() => {
  const current = candidate.value

  if (!current) {
    return ''
  }

  const days = daysSinceApplied(current)
  const applied =
    days === 0 ? 'applied today' : `applied ${days} ${days === 1 ? 'day' : 'days'} ago`

  return current.currentRole ? `${current.currentRole} · ${applied}` : `A${applied.slice(1)}`
})
const events = computed(() => (props.candidateId ? activity.eventsFor(props.candidateId) : []))
const eventsLoading = computed(() =>
  props.candidateId ? activity.eventsLoadingFor(props.candidateId) : false,
)
const notes = computed(() => (props.candidateId ? activity.notesFor(props.candidateId) : []))
const notesLoading = computed(() =>
  props.candidateId ? activity.notesLoadingFor(props.candidateId) : false,
)
const activeTab = ref<'overview' | 'cv' | 'career' | 'fit' | 'events'>('overview')
const fitConsentOpen = ref(false)
const noteDraft = ref('')
const noteSaving = ref(false)
const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const confirmDeleteOpen = ref(false)
const deleting = ref(false)
const resyncOpen = ref(false)
const resyncFile = ref<File | null>(null)
const resyncing = ref(false)
const cvBusy = ref(false)
const cvError = ref('')
const cvLoading = ref(false)
const cvUrl = ref('')
const cvFileInput = ref<HTMLInputElement | null>(null)
const specFileInput = ref<HTMLInputElement | null>(null)
const specBusy = ref(false)
const specError = ref('')
const form = reactive<Record<EditableCandidateField, string>>({
  name: '',
  email: '',
  phone: '',
  currentRole: '',
  remChannel: '',
  salaryBand: '',
})
const fieldErrors = reactive({
  email: '',
  phone: '',
})
const numericForm = reactive({
  noticePeriodMonths: '0',
  salaryExpectationCents: '0.00',
})
const numericErrors = reactive({
  noticePeriodMonths: '',
  salaryExpectationCents: '',
})

const fitAnalysis = computed(() =>
  props.candidateId ? fit.analysisFor(props.candidateId) : undefined,
)
const fitLoading = computed(() => (props.candidateId ? fit.isLoadingFor(props.candidateId) : false))
const fitAnalyzing = computed(() =>
  props.candidateId ? fit.isAnalyzingFor(props.candidateId) : false,
)
const fitError = computed(() => (props.candidateId ? fit.errorFor(props.candidateId) : null))
const fitProgress = computed(() => (props.candidateId ? fit.progressFor(props.candidateId) : ''))
const fitStale = computed(() =>
  props.candidateId && fitAnalysis.value ? fit.isStaleFor(props.candidateId) : false,
)
const fitHasRequirements = computed(() =>
  fitAnalysis.value ? requirementTotal(fitAnalysis.value.result) > 0 : false,
)
const fitAnalyzedAgo = computed(() =>
  fitAnalysis.value ? formatRelativeTime(fitAnalysis.value.updatedAt) : '',
)
const fitRank = computed(() => {
  const current = candidate.value
  const currentBoard = board.value

  if (!current || !currentBoard || current.status !== 'active') {
    return undefined
  }

  const ranks = fit.rankForStage(currentBoard.id, current.stepId)
  const entry = ranks.get(current.id)

  if (!entry) {
    return undefined
  }

  return {
    position: entry.rank,
    total: ranks.size,
    stageName: currentBoard.steps.find((step) => step.id === current.stepId)?.name ?? 'this stage',
  }
})
const fitPrerequisites = computed(() => {
  const current = candidate.value
  const currentBoard = board.value
  const issues: string[] = []

  if (!currentBoard?.jobSpecPath) {
    issues.push('Add a PDF job spec to this board.')
  }

  if (!current?.cvPath) {
    issues.push('Upload a PDF CV for this applicant.')
  }

  if (!current || !hasCareerContent(current.education, current.experience)) {
    issues.push('Add education or work experience.')
  }

  return issues
})
const canAnalyze = computed(() => fitPrerequisites.value.length === 0)
const hasCareer = computed(() =>
  candidate.value ? hasCareerContent(candidate.value.education, candidate.value.experience) : false,
)

const deleteMessage = computed(
  () => `Delete ${candidate.value?.name ?? 'this applicant'}? This cannot be undone.`,
)

const hoverId = ref<string | null>(null)
const experienceTimeline = ref<InstanceType<typeof CareerTimeline> | null>(null)
const educationTimeline = ref<InstanceType<typeof CareerTimeline> | null>(null)
const headRef = ref<HTMLElement | null>(null)
const stickyTop = ref(0)
let headObserver: ResizeObserver | null = null

watch(headRef, (element) => {
  headObserver?.disconnect()
  headObserver = null

  if (element && typeof ResizeObserver !== 'undefined') {
    stickyTop.value = element.offsetHeight
    headObserver = new ResizeObserver(() => {
      stickyTop.value = element.offsetHeight
    })
    headObserver.observe(element)
  }
})

function syncForm(): void {
  const current = candidate.value

  form.name = current?.name ?? ''
  form.email = current?.email ?? ''
  form.phone = current?.phone ?? ''
  form.currentRole = current?.currentRole ?? ''
  form.remChannel = current?.remChannel ?? ''
  form.salaryBand = current?.salaryBand ?? ''
  numericForm.noticePeriodMonths = formatNoticePeriod(current?.noticePeriodMonths ?? 0)
  numericForm.salaryExpectationCents = formatSalaryCents(current?.salaryExpectationCents ?? 0)
  fieldErrors.email = ''
  fieldErrors.phone = ''
  numericErrors.noticePeriodMonths = ''
  numericErrors.salaryExpectationCents = ''
}

function updateField(field: EditableCandidateField, value: unknown): void {
  const current = candidate.value

  if (!current) {
    return
  }

  const next = String(value ?? '')
  form[field] = next

  if (field === 'email') {
    fieldErrors.email = next.trim() && !isValidEmail(next) ? 'Enter a valid email address.' : ''

    if (fieldErrors.email) {
      return
    }
  }

  if (field === 'phone') {
    fieldErrors.phone = next.trim() && !isValidPhone(next) ? 'Use digits only.' : ''

    if (fieldErrors.phone) {
      return
    }
  }

  store.updateCandidateField(current.id, field, next)
}

function updateNoticePeriod(value: unknown): void {
  const current = candidate.value

  if (!current) {
    return
  }

  const next = String(value ?? '')
  numericForm.noticePeriodMonths = next
  const months = parseNoticePeriod(next)

  if (months === null) {
    numericErrors.noticePeriodMonths = 'Enter a number of months, for example 1.5.'
    return
  }

  numericErrors.noticePeriodMonths = ''
  store.updateCandidateNumber(current.id, 'noticePeriodMonths', months)
}

function updateSalaryExpectation(value: unknown): void {
  const current = candidate.value

  if (!current) {
    return
  }

  const next = String(value ?? '')
  numericForm.salaryExpectationCents = next
  const cents = parseSalaryToCents(next)

  if (cents === null) {
    numericErrors.salaryExpectationCents = 'Enter a rand amount, for example 25000.00.'
    return
  }

  numericErrors.salaryExpectationCents = ''
  store.updateCandidateNumber(current.id, 'salaryExpectationCents', cents)
}

function formatNoticePeriodField(): void {
  const current = candidate.value

  if (current && !numericErrors.noticePeriodMonths) {
    numericForm.noticePeriodMonths = formatNoticePeriod(current.noticePeriodMonths)
  }
}

function formatSalaryExpectationField(): void {
  const current = candidate.value

  if (current && !numericErrors.salaryExpectationCents) {
    numericForm.salaryExpectationCents = formatSalaryCents(current.salaryExpectationCents)
  }
}

function updateEntries(kind: CareerKind, entries: CareerEntry[]): void {
  const current = candidate.value

  if (!current) {
    return
  }

  store.updateCandidateEntries(current.id, kind, entries)
  void fit.refreshProfileStale(current.id)
}

function selectBar(kind: CareerKind, id: string): void {
  const timeline = kind === 'experience' ? experienceTimeline.value : educationTimeline.value
  void timeline?.focusEntry(id)
}

function retrySave(): void {
  if (candidate.value) {
    void store.retryCandidateSave(candidate.value.id)
  }
}

async function addNote(): Promise<void> {
  const current = candidate.value
  const body = noteDraft.value.trim()

  if (!current || !body) {
    return
  }

  noteSaving.value = true
  const added = await activity.addNote(current.id, body)
  noteSaving.value = false

  if (added) {
    noteDraft.value = ''
  }
}

function requestFitAnalysis(): void {
  if (!candidate.value || !canAnalyze.value) {
    return
  }

  fitConsentOpen.value = true
}

async function confirmFitAnalysis(): Promise<void> {
  const current = candidate.value

  fitConsentOpen.value = false

  if (!current) {
    return
  }

  await fit.analyze(current.id, { force: true })
}

function openFitAfterUpload(): void {
  if (candidate.value) {
    fit.markStale(candidate.value.id)
  }

  activeTab.value = 'fit'

  if (canAnalyze.value) {
    fitConsentOpen.value = true
  }
}

function maybeAutoFit(): void {
  const current = candidate.value

  if (!current || props.autoFitCandidateId !== current.id) {
    return
  }

  activeTab.value = 'fit'

  if (canAnalyze.value) {
    fitConsentOpen.value = true
  }
}

function requestDeleteApplicant(): void {
  confirmDeleteOpen.value = true
}

async function confirmDeleteApplicant(): Promise<void> {
  const current = candidate.value

  if (!current) {
    return
  }

  deleting.value = true
  const deleted = await store.deleteApplicant(current.id)
  deleting.value = false
  confirmDeleteOpen.value = false

  if (deleted) {
    open.value = false
  }
}

function chooseCv(): void {
  cvError.value = ''
  cvFileInput.value?.click()
}

function chooseJobSpec(): void {
  specError.value = ''
  specFileInput.value?.click()
}

async function onCvSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const current = candidate.value
  input.value = ''

  if (!file || !current) {
    return
  }

  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    cvError.value = 'Choose a PDF file.'
    return
  }

  cvBusy.value = true
  const hadCv = Boolean(current.cvPath)
  const uploaded = await storage.uploadCv(current.id, file)
  cvBusy.value = false

  if (!uploaded) {
    cvError.value = storage.error ?? 'The CV could not be uploaded.'
    return
  }

  resetCvPreview()

  if (hadCv) {
    resyncFile.value = file
    resyncOpen.value = true
    return
  }

  openFitAfterUpload()
}

function keepCurrentCv(): void {
  resyncOpen.value = false
  resyncFile.value = null
  openFitAfterUpload()
}

async function confirmResyncCv(): Promise<void> {
  const current = candidate.value
  const file = resyncFile.value

  if (!current || !file) {
    resyncOpen.value = false
    return
  }

  resyncing.value = true
  cvError.value = ''

  try {
    const { draft } = await importApplicantFromPdf(file)
    const saved = await store.resyncCandidateProfile(current.id, {
      education: draft.education,
      experience: draft.experience,
      skills: draft.skills,
    })

    if (!saved) {
      cvError.value = store.error ?? 'The profile could not be re-synced.'
      resyncOpen.value = false
      resyncFile.value = null
      fit.markStale(current.id)
      activeTab.value = 'fit'
      return
    }

    resyncOpen.value = false
    resyncFile.value = null
    resetCvPreview()
    openFitAfterUpload()
  } catch {
    cvError.value = 'The new CV could not be read. The current details were kept.'
    resyncOpen.value = false
    resyncFile.value = null
    fit.markStale(current.id)
    activeTab.value = 'fit'
  } finally {
    resyncing.value = false
  }
}

async function onJobSpecSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const currentBoard = board.value
  input.value = ''

  if (!file || !currentBoard) {
    return
  }

  if (!isPdfFile(file)) {
    specError.value = 'Choose a PDF file.'
    return
  }

  specBusy.value = true
  const uploaded = await storage.uploadJobSpec(currentBoard.id, file)
  specBusy.value = false

  if (!uploaded) {
    specError.value = storage.error ?? 'The job spec could not be uploaded.'
    return
  }

  specError.value = ''
  fit.markBoardStale(currentBoard.id)

  if (canAnalyze.value) {
    fitConsentOpen.value = true
  }
}

async function removeCv(): Promise<void> {
  const current = candidate.value

  if (!current) {
    return
  }

  cvBusy.value = true
  const removed = await storage.removeCv(current.id)
  cvBusy.value = false

  if (removed) {
    fit.markStale(current.id)
    resetCvPreview()
    return
  }

  cvError.value = storage.error ?? 'The CV could not be removed.'
}

async function loadCvPreview(): Promise<void> {
  const path = candidate.value?.cvPath

  if (!path || cvLoading.value || cvUrl.value) {
    return
  }

  cvLoading.value = true
  cvError.value = ''
  cvUrl.value = ''

  const url = await storage.cvSignedUrl(path)
  cvLoading.value = false

  if (candidate.value?.cvPath !== path) {
    return
  }

  if (!url) {
    cvError.value = storage.error ?? 'The CV could not be opened.'
    return
  }

  cvUrl.value = url
}

function resetCvPreview(): void {
  cvLoading.value = false
  cvUrl.value = ''
  cvError.value = ''
}

watch([activeTab, () => candidate.value?.cvPath], ([tab, path], [, previousPath]) => {
  if (path !== previousPath) {
    resetCvPreview()
  }

  if (tab === 'cv' && path) {
    void loadCvPreview()
  }
})

function openCvFullscreen(): void {
  if (cvUrl.value) {
    window.open(cvUrl.value, '_blank', 'noopener,noreferrer')
  }
}

async function printCv(): Promise<void> {
  const path = candidate.value?.cvPath

  if (!path) {
    return
  }

  cvError.value = ''
  const blob = await storage.cvBlob(path)

  if (!blob) {
    cvError.value = storage.error ?? 'The CV could not be printed.'
    return
  }

  printPdfBlob(blob)
}

function setPageScrollLocked(locked: boolean): void {
  const root = document.documentElement
  const body = document.body

  root.classList.toggle('applicant-drawer-open', locked)
  body.classList.toggle('applicant-drawer-open', locked)

  if (locked) {
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
  } else {
    root.style.removeProperty('overflow')
    body.style.removeProperty('overflow')
    root.style.removeProperty('overscroll-behavior')
    body.style.removeProperty('overscroll-behavior')
  }
}

watch([() => props.modelValue, () => props.candidateId], ([value, candidateId]) => {
  if (value && candidateId) {
    syncForm()
    resetCvPreview()
    cvError.value = ''
    noteDraft.value = ''
    fitConsentOpen.value = false
    resyncOpen.value = false
    resyncFile.value = null
    resyncing.value = false
    activeTab.value = 'overview'
    hoverId.value = null
    store.beginCandidateEdit(candidateId)
    void activity.loadEvents(candidateId)
    void activity.loadNotes(candidateId)
    void fit.load(candidateId)
    maybeAutoFit()
  }
})

watch(
  () => props.modelValue,
  (value) => {
    setPageScrollLocked(value)

    if (!value) {
      resetCvPreview()
      fitConsentOpen.value = false
      resyncOpen.value = false
      resyncFile.value = null
      resyncing.value = false

      if (props.candidateId) {
        void store.flushCandidate(props.candidateId)
      }
    }
  },
)

onBeforeUnmount(() => {
  setPageScrollLocked(false)
  headObserver?.disconnect()
})
</script>

<template>
  <Teleport to="body">
    <v-navigation-drawer
      v-model="open"
      class="applicant-drawer"
      location="right"
      temporary
      width="50vw"
      aria-label="Applicant profile"
    >
      <div v-if="candidate" class="applicant-drawer__inner">
        <header ref="headRef" class="applicant-drawer__head">
          <div class="applicant-drawer__top">
            <span class="candidate-avatar applicant-drawer__avatar" aria-hidden="true">
              {{ initials }}
            </span>

            <div class="applicant-drawer__identity">
              <h2>{{ candidate.name }}</h2>
              <p class="applicant-drawer__meta">{{ appliedLine }}</p>
            </div>

            <div class="applicant-drawer__actions">
              <v-btn
                :icon="candidate.favorite ? 'mdi-star' : 'mdi-star-outline'"
                :color="candidate.favorite ? 'primary' : undefined"
                :aria-label="candidate.favorite ? 'Remove from favorites' : 'Add to favorites'"
                :aria-pressed="candidate.favorite"
                variant="text"
                :height="40"
                :width="40"
                @click="store.toggleFavorite(candidate.id)"
              />
              <v-menu location="bottom end" :offset="4">
                <template #activator="{ props: menuProps }">
                  <v-btn
                    v-bind="menuProps"
                    class="applicant-drawer__more"
                    icon="mdi-dots-horizontal"
                    variant="text"
                    :height="40"
                    :width="40"
                    aria-label="More actions for this applicant"
                  />
                </template>
                <v-list class="app-menu candidate-menu" density="compact">
                  <v-list-item
                    class="candidate-menu__reject"
                    prepend-icon="mdi-delete-outline"
                    title="Delete applicant"
                    @click="requestDeleteApplicant"
                  />
                </v-list>
              </v-menu>
              <v-btn
                icon="mdi-close"
                variant="text"
                :height="40"
                :width="40"
                aria-label="Close applicant profile"
                @click="open = false"
              />
            </div>
          </div>

          <ApplicantStageBar :candidate-id="candidate.id" @retry="retrySave" />
        </header>

        <input
          ref="cvFileInput"
          class="applicant-cv-input"
          type="file"
          accept="application/pdf,.pdf"
          @change="onCvSelected"
        />
        <input
          ref="specFileInput"
          class="applicant-cv-input"
          type="file"
          accept="application/pdf,.pdf"
          @change="onJobSpecSelected"
        />

        <v-tabs v-model="activeTab" aria-label="Applicant sections" class="applicant-tabs">
          <v-tab value="overview">Overview</v-tab>
          <v-tab value="cv">CV</v-tab>
          <v-tab value="career">Career</v-tab>
          <v-tab value="fit">CV fit</v-tab>
          <v-tab value="events">Activity</v-tab>
        </v-tabs>

        <div v-if="activeTab === 'overview'" class="applicant-drawer__body">
          <v-alert v-if="detailsError" class="orbital-alert" type="error" density="compact">
            {{ detailsError }}
          </v-alert>

          <div class="applicant-fields">
            <v-text-field
              label="Full name"
              :model-value="form.name"
              hide-details
              @update:model-value="updateField('name', $event)"
            />
            <v-text-field
              label="Current role"
              :model-value="form.currentRole"
              hide-details
              @update:model-value="updateField('currentRole', $event)"
            />
            <v-text-field
              label="Email (optional)"
              type="email"
              :model-value="form.email"
              :error-messages="fieldErrors.email"
              hide-details="auto"
              @update:model-value="updateField('email', $event)"
            />
            <v-text-field
              label="Phone (optional)"
              type="tel"
              :model-value="form.phone"
              :error-messages="fieldErrors.phone"
              hide-details="auto"
              @update:model-value="updateField('phone', $event)"
            />
            <v-text-field
              label="Notice period (months)"
              type="number"
              min="0"
              step="0.1"
              :model-value="numericForm.noticePeriodMonths"
              :error-messages="numericErrors.noticePeriodMonths"
              hide-details="auto"
              @update:model-value="updateNoticePeriod"
              @blur="formatNoticePeriodField"
            />
            <v-text-field
              label="Salary expectation (R)"
              type="number"
              min="0"
              step="0.01"
              :model-value="numericForm.salaryExpectationCents"
              :error-messages="numericErrors.salaryExpectationCents"
              hide-details="auto"
              @update:model-value="updateSalaryExpectation"
              @blur="formatSalaryExpectationField"
            />
            <v-text-field
              label="REM channel"
              :model-value="form.remChannel"
              hide-details
              @update:model-value="updateField('remChannel', $event)"
            />
            <v-text-field
              label="Salary band"
              :model-value="form.salaryBand"
              hide-details
              @update:model-value="updateField('salaryBand', $event)"
            />
          </div>

          <section v-if="candidate.skills.length" class="applicant-section">
            <p class="eyebrow">Skills</p>
            <ul class="skill-chips">
              <li v-for="skill in candidate.skills" :key="skill">{{ skill }}</li>
            </ul>
          </section>

          <section class="applicant-section">
            <p class="eyebrow">
              Notes<span v-if="notes.length" class="applicant-count">{{ notes.length }}</span>
            </p>

            <div class="applicant-composer">
              <textarea
                v-model="noteDraft"
                class="applicant-composer__input"
                aria-label="Note"
                placeholder="Write a note for the team..."
                rows="2"
              />
              <div class="applicant-composer__foot">
                <span class="applicant-composer__hint">Visible to everyone in the workspace</span>
                <v-btn
                  color="primary"
                  variant="flat"
                  :height="40"
                  :disabled="!noteDraft.trim()"
                  :loading="noteSaving"
                  @click="addNote"
                >
                  Add note
                </v-btn>
              </div>
            </div>

            <div v-if="notesLoading" class="applicant-note-status">Loading notes...</div>
            <p v-else-if="!notes.length" class="applicant-note-status">
              No notes for this applicant yet.
            </p>
            <ul v-else class="applicant-note-list">
              <li v-for="note in notes" :key="note.id" class="applicant-note">
                <p class="applicant-note__body">{{ note.body }}</p>
                <p class="applicant-note__meta">
                  {{ note.authorName }}
                  <span aria-hidden="true">·</span>
                  <time :datetime="note.createdAt" :title="formatEventTime(note.createdAt)">
                    {{ formatRelativeTime(note.createdAt) }}
                  </time>
                </p>
              </li>
            </ul>
          </section>
        </div>

        <div v-else-if="activeTab === 'cv'" class="applicant-cv-preview">
          <template v-if="candidate.cvPath">
            <div class="applicant-cv-toolbar">
              <v-icon class="applicant-cv-card__icon" icon="mdi-file-pdf-box" size="28" />
              <span class="applicant-cv-toolbar__name">{{ candidate.cvName || 'CV.pdf' }}</span>
              <div class="applicant-cv-toolbar__actions">
                <v-btn
                  icon="mdi-open-in-new"
                  variant="text"
                  :height="40"
                  :width="40"
                  aria-label="Open CV in a new tab"
                  title="Open in a new tab"
                  :disabled="!cvUrl"
                  @click="openCvFullscreen"
                />
                <v-btn
                  icon="mdi-printer-outline"
                  variant="text"
                  :height="40"
                  :width="40"
                  aria-label="Print CV"
                  title="Print CV"
                  @click="printCv"
                />
                <v-menu location="bottom end" :offset="4">
                  <template #activator="{ props: menuProps }">
                    <v-btn
                      v-bind="menuProps"
                      icon="mdi-dots-horizontal"
                      variant="text"
                      :height="40"
                      :width="40"
                      aria-label="More CV actions"
                      :loading="cvBusy"
                    />
                  </template>
                  <v-list class="app-menu candidate-menu" density="compact">
                    <v-list-item
                      class="candidate-menu__reject"
                      prepend-icon="mdi-delete-outline"
                      title="Remove CV"
                      :disabled="cvBusy"
                      @click="removeCv"
                    />
                  </v-list>
                </v-menu>
              </div>
            </div>

            <v-alert v-if="cvError" class="orbital-alert" type="error" density="compact">
              {{ cvError }}
            </v-alert>

            <div v-if="cvLoading" class="applicant-cv-status">Loading preview...</div>
            <iframe v-else-if="cvUrl" :src="cvUrl" class="applicant-cv-frame" title="CV preview" />
          </template>

          <div v-else class="fit-empty">
            <v-icon icon="mdi-file-upload-outline" size="40" />
            <p class="fit-empty__title">No CV yet</p>
            <p class="fit-empty__hint">
              Upload one PDF CV for this applicant. PDFs are compressed in your browser before
              upload.
            </p>
            <v-alert v-if="cvError" class="orbital-alert" type="error" density="compact">
              {{ cvError }}
            </v-alert>
            <v-btn
              variant="outlined"
              prepend-icon="mdi-upload"
              :disabled="cvBusy"
              :loading="cvBusy"
              @click="chooseCv"
            >
              Upload CV
            </v-btn>
          </div>
        </div>

        <div v-else-if="activeTab === 'career'" class="applicant-career">
          <v-alert v-if="detailsError" class="orbital-alert" type="error" density="compact">
            {{ detailsError }}
          </v-alert>

          <div class="applicant-career__sticky" :style="{ top: `${stickyTop}px` }">
            <CareerStrip
              :experience="candidate.experience"
              :education="candidate.education"
              :highlight-id="hoverId"
              @hover="hoverId = $event"
              @select="selectBar"
            />
          </div>

          <div class="applicant-career__body">
            <section class="applicant-section">
              <p class="eyebrow">Work experience</p>
              <CareerTimeline
                ref="experienceTimeline"
                kind="experience"
                :entries="candidate.experience"
                :highlight-id="hoverId"
                @hover="hoverId = $event"
                @update:entries="updateEntries('experience', $event)"
              />
            </section>

            <section class="applicant-section">
              <p class="eyebrow">Education</p>
              <CareerTimeline
                ref="educationTimeline"
                kind="education"
                :entries="candidate.education"
                :highlight-id="hoverId"
                @hover="hoverId = $event"
                @update:entries="updateEntries('education', $event)"
              />
            </section>
          </div>
        </div>

        <div v-else-if="activeTab === 'events'" class="applicant-events">
          <v-alert v-if="eventsError" class="orbital-alert" type="error" density="compact">
            {{ eventsError }}
          </v-alert>

          <div v-if="eventsLoading" class="applicant-events__status">Loading activity...</div>
          <p v-else-if="!events.length" class="applicant-events__empty">
            No activity recorded for this applicant yet.
          </p>
          <ol v-else class="applicant-event-list">
            <li v-for="event in events" :key="event.id" class="applicant-event">
              <span class="applicant-event__dot" aria-hidden="true" />
              <div class="applicant-event__copy">
                <p class="applicant-event__message">{{ event.message }}</p>
                <p class="applicant-event__meta">
                  {{ event.actorName }}
                  <span aria-hidden="true">·</span>
                  <time :datetime="event.createdAt" :title="formatEventTime(event.createdAt)">
                    {{ formatRelativeTime(event.createdAt) }}
                  </time>
                </p>
              </div>
            </li>
          </ol>
        </div>

        <div v-else class="applicant-fit">
          <v-alert v-if="fitError" class="orbital-alert" type="error" density="compact">
            {{ fitError }}
          </v-alert>

          <v-alert v-if="fitStale" class="orbital-alert" type="warning" density="compact">
            <div class="applicant-fit__stale">
              <span>This profile, CV, or job spec has changed since the last analysis.</span>
              <v-btn
                variant="outlined"
                prepend-icon="mdi-refresh"
                :height="36"
                :disabled="!canAnalyze || fitAnalyzing"
                @click="requestFitAnalysis"
              >
                Re-run
              </v-btn>
            </div>
          </v-alert>

          <section v-if="fitPrerequisites.length" class="applicant-section fit-prereqs">
            <p class="eyebrow">Before analyzing</p>
            <ul class="fit-empty__checks">
              <li v-for="item in fitPrerequisites" :key="item">{{ item }}</li>
            </ul>

            <v-alert v-if="cvError" class="orbital-alert" type="error" density="compact">
              {{ cvError }}
            </v-alert>
            <v-alert v-if="specError" class="orbital-alert" type="error" density="compact">
              {{ specError }}
            </v-alert>

            <div class="fit-prereqs__actions">
              <v-btn
                v-if="!candidate.cvPath"
                color="primary"
                variant="outlined"
                prepend-icon="mdi-upload"
                :disabled="cvBusy"
                :loading="cvBusy"
                @click="chooseCv"
              >
                Upload CV
              </v-btn>
              <v-btn
                v-if="!board?.jobSpecPath"
                color="primary"
                variant="outlined"
                prepend-icon="mdi-file-upload-outline"
                :disabled="specBusy"
                :loading="specBusy"
                @click="chooseJobSpec"
              >
                Upload job spec
              </v-btn>
              <v-btn
                v-if="!hasCareer"
                variant="text"
                append-icon="mdi-arrow-right"
                @click="activeTab = 'career'"
              >
                Add career details
              </v-btn>
            </div>
          </section>

          <div v-if="fitAnalyzing" class="applicant-fit__status" role="status" aria-live="polite">
            <v-progress-circular indeterminate color="primary" size="22" />
            <span>{{ fitProgress || 'Analyzing the CV against the job spec…' }}</span>
          </div>

          <template v-else-if="fitAnalysis">
            <div class="fit-head">
              <p class="meta" :title="formatEventTime(fitAnalysis.updatedAt)">
                Analyzed {{ fitAnalyzedAgo }}
              </p>
              <v-btn
                v-if="!fitStale"
                variant="outlined"
                prepend-icon="mdi-refresh"
                :height="36"
                :disabled="!canAnalyze"
                @click="requestFitAnalysis"
              >
                Re-run analysis
              </v-btn>
            </div>

            <v-alert
              v-if="!fitAnalysis.result.complete"
              class="orbital-alert"
              type="warning"
              density="compact"
            >
              This analysis did not check every requirement. Re-run it for a complete ranking.
            </v-alert>

            <FitRequirements
              v-if="fitHasRequirements"
              :result="fitAnalysis.result"
              :rank="fitRank"
            />

            <p v-else class="fit-note">
              <b>
                {{
                  fitAnalysis.result.schemaVersion < 3
                    ? 'This analysis used the earlier format.'
                    : 'No requirement sections found in this job spec.'
                }}
              </b>
              <span>
                {{
                  fitAnalysis.result.schemaVersion < 3
                    ? 'Re-run it to check each requirement.'
                    : 'There is no minimum, recommended, or skills list to check item by item, so the summary below compares the CV with the whole job spec. Add clear headings to the spec and re-run for a requirement-by-requirement view.'
                }}
              </span>
            </p>

            <section class="fit-summary" :class="{ 'fit-summary--after': fitHasRequirements }">
              <h3 class="fit-summary__title">
                {{
                  fitHasRequirements
                    ? 'Similarities and gaps'
                    : 'How the CV compares with the job spec'
                }}
              </h3>
              <div class="fit-columns">
                <section class="applicant-section">
                  <p class="eyebrow">Similarities</p>
                  <ul
                    v-if="fitAnalysis.result.similarities.length"
                    class="fit-list fit-list--positive"
                  >
                    <li v-for="item in fitAnalysis.result.similarities" :key="item">{{ item }}</li>
                  </ul>
                  <p v-else class="fit-empty__hint">No similarities returned.</p>
                </section>

                <section class="applicant-section">
                  <p class="eyebrow">Gaps</p>
                  <ul v-if="fitAnalysis.result.gaps.length" class="fit-list fit-list--gap">
                    <li v-for="item in fitAnalysis.result.gaps" :key="item">{{ item }}</li>
                  </ul>
                  <p v-else class="fit-empty__hint">No gaps returned.</p>
                </section>
              </div>
            </section>

            <p class="applicant-drawer__note">
              AI analysis only. Review the CV and job spec before making decisions.
            </p>
          </template>

          <div v-else-if="fitLoading" class="applicant-fit__status">Loading the last analysis…</div>

          <div v-else class="fit-empty">
            <v-icon icon="mdi-file-compare" size="40" />
            <p class="fit-empty__title">No analysis yet</p>
            <p class="fit-empty__hint">
              Analyze this CV against the role's job spec to list similarities and gaps.
            </p>
            <v-btn
              color="primary"
              prepend-icon="mdi-file-compare"
              :disabled="!canAnalyze"
              @click="requestFitAnalysis"
            >
              Analyze CV
            </v-btn>
          </div>
        </div>
      </div>
    </v-navigation-drawer>
  </Teleport>

  <ConfirmDialog
    v-model="confirmDeleteOpen"
    eyebrow="Delete applicant"
    title="Delete this applicant?"
    :message="deleteMessage"
    confirm-label="Delete applicant"
    :loading="deleting"
    @confirm="confirmDeleteApplicant"
  />

  <FitConsentDialog
    v-model="fitConsentOpen"
    :candidate-name="candidate?.name ?? 'this applicant'"
    :board-name="board?.name ?? 'this role'"
    :busy="fitAnalyzing"
    @confirm="confirmFitAnalysis"
    @cancel="fitConsentOpen = false"
  />

  <ResyncCvDialog
    v-model="resyncOpen"
    :candidate-name="candidate?.name ?? 'this applicant'"
    :busy="resyncing"
    @confirm="confirmResyncCv"
    @keep="keepCurrentCv"
  />
</template>
