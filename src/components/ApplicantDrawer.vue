<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import FitConsentDialog from '@/components/FitConsentDialog.vue'
import { formatEventTime } from '@/lib/applicant-events'
import { printPdfBlob } from '@/lib/pdf'
import { initials as getInitials } from '@/lib/pipeline'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useApplicantsStore, type EditableCandidateField } from '@/stores/applicants'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import { useStorageStore } from '@/stores/storage'

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
const events = computed(() => (props.candidateId ? activity.eventsFor(props.candidateId) : []))
const eventsLoading = computed(() =>
  props.candidateId ? activity.eventsLoadingFor(props.candidateId) : false,
)
const notes = computed(() => (props.candidateId ? activity.notesFor(props.candidateId) : []))
const notesLoading = computed(() =>
  props.candidateId ? activity.notesLoadingFor(props.candidateId) : false,
)
const activeTab = ref<'details' | 'events' | 'fit'>('details')
const fitConsentOpen = ref(false)
const noteDraft = ref('')
const noteSaving = ref(false)
const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})
const confirmDeleteOpen = ref(false)
const deleting = ref(false)
const cvBusy = ref(false)
const cvError = ref('')
const cvPreviewOpen = ref(false)
const cvLoading = ref(false)
const cvUrl = ref('')
const cvFileInput = ref<HTMLInputElement | null>(null)
const form = reactive<Record<EditableCandidateField, string>>({
  name: '',
  email: '',
  phone: '',
  currentRole: '',
  education: '',
  experience: '',
})
const fieldErrors = reactive({
  email: '',
  phone: '',
})

const fitAnalysis = computed(() =>
  props.candidateId ? fit.analysisFor(props.candidateId) : undefined,
)
const fitLoading = computed(() => (props.candidateId ? fit.isLoadingFor(props.candidateId) : false))
const fitAnalyzing = computed(() =>
  props.candidateId ? fit.isAnalyzingFor(props.candidateId) : false,
)
const fitError = computed(() => (props.candidateId ? fit.errorFor(props.candidateId) : null))
const saveFailed = computed(() =>
  props.candidateId ? store.hasUnsavedChanges(props.candidateId) : false,
)
const fitProgress = computed(() => (props.candidateId ? fit.progressFor(props.candidateId) : ''))
const fitStale = computed(() =>
  props.candidateId && fitAnalysis.value ? fit.isStaleFor(props.candidateId) : false,
)
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

  if (!current?.education.trim() && !current?.experience.trim()) {
    issues.push('Add education or work experience.')
  }

  return issues
})
const canAnalyze = computed(() => fitPrerequisites.value.length === 0)

const deleteMessage = computed(
  () => `Delete ${candidate.value?.name ?? 'this applicant'}? This cannot be undone.`,
)

const textSections = [
  { key: 'education' as const, title: 'Education', fieldLabel: 'Education details' },
  {
    key: 'experience' as const,
    title: 'Work experience',
    fieldLabel: 'Work experience details',
  },
]

function syncForm(): void {
  const current = candidate.value

  form.name = current?.name ?? ''
  form.email = current?.email ?? ''
  form.phone = current?.phone ?? ''
  form.currentRole = current?.currentRole ?? ''
  form.education = current?.education ?? ''
  form.experience = current?.experience ?? ''
  fieldErrors.email = ''
  fieldErrors.phone = ''
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

  if (field === 'education' || field === 'experience') {
    void fit.refreshProfileStale(current.id)
  }
}

function retrySave(): void {
  if (candidate.value) {
    void store.flushCandidate(candidate.value.id)
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
  const uploaded = await storage.uploadCv(current.id, file)
  cvBusy.value = false

  if (!uploaded) {
    cvError.value = storage.error ?? 'The CV could not be uploaded.'
    return
  }

  openFitAfterUpload()
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
    closeCvPreview()
    return
  }

  cvError.value = storage.error ?? 'The CV could not be removed.'
}

async function openCvPreview(): Promise<void> {
  const path = candidate.value?.cvPath

  if (!path) {
    return
  }

  cvPreviewOpen.value = true
  cvLoading.value = true
  cvError.value = ''
  cvUrl.value = ''

  const url = await storage.cvSignedUrl(path)
  cvLoading.value = false

  if (!url) {
    cvError.value = storage.error ?? 'The CV could not be opened.'
    return
  }

  cvUrl.value = url
}

function closeCvPreview(): void {
  cvPreviewOpen.value = false
  cvLoading.value = false
  cvUrl.value = ''
  cvError.value = ''
}

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
    closeCvPreview()
    cvError.value = ''
    noteDraft.value = ''
    fitConsentOpen.value = false
    activeTab.value = 'details'
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
      closeCvPreview()
      fitConsentOpen.value = false

      if (props.candidateId) {
        void store.flushCandidate(props.candidateId)
      }
    }
  },
)

onBeforeUnmount(() => setPageScrollLocked(false))
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
        <header class="applicant-drawer__head">
          <span class="candidate-avatar applicant-drawer__avatar" aria-hidden="true">
            {{ initials }}
          </span>

          <div class="applicant-drawer__identity">
            <p class="eyebrow">Applicant profile</p>
            <h2>{{ candidate.name }}</h2>
            <p class="mono-label">{{ candidate.currentRole || candidate.email }}</p>
          </div>

          <div class="applicant-drawer__actions">
            <v-btn
              :icon="candidate.favorite ? 'mdi-star' : 'mdi-star-outline'"
              :color="candidate.favorite ? 'primary' : undefined"
              :aria-label="candidate.favorite ? 'Remove from favourites' : 'Add to favourites'"
              :aria-pressed="candidate.favorite"
              variant="text"
              @click="store.toggleFavorite(candidate.id)"
            />
            <v-btn
              icon="mdi-close"
              variant="text"
              aria-label="Close applicant profile"
              @click="open = false"
            />
          </div>
        </header>

        <v-tabs v-if="!cvPreviewOpen" v-model="activeTab" class="applicant-tabs" grow>
          <v-tab value="details">Details</v-tab>
          <v-tab value="fit">Analize</v-tab>
          <v-tab value="events">Events</v-tab>
        </v-tabs>

        <div v-if="cvPreviewOpen" class="applicant-cv-preview">
          <div class="applicant-cv-toolbar">
            <v-btn variant="text" prepend-icon="mdi-arrow-left" @click="closeCvPreview">Back</v-btn>
            <span class="applicant-cv-toolbar__name">{{ candidate.cvName || 'CV.pdf' }}</span>
            <div class="applicant-cv-toolbar__actions">
              <v-btn
                icon="mdi-open-in-new"
                variant="text"
                aria-label="Open CV in a new tab"
                title="Open in a new tab"
                @click="openCvFullscreen"
              />
              <v-btn
                icon="mdi-printer-outline"
                variant="text"
                aria-label="Print CV"
                title="Print CV"
                @click="printCv"
              />
            </div>
          </div>

          <v-alert v-if="cvError" class="orbital-alert" type="error" density="compact">
            {{ cvError }}
          </v-alert>

          <div v-if="cvLoading" class="applicant-cv-status">Loading preview...</div>
          <iframe v-else-if="cvUrl" :src="cvUrl" class="applicant-cv-frame" title="CV preview" />
        </div>

        <div v-else-if="activeTab === 'details'" class="applicant-drawer__body">
          <v-alert v-if="detailsError" class="orbital-alert" type="error" density="compact">
            {{ detailsError }}
          </v-alert>

          <v-alert
            v-if="saveFailed && !detailsError"
            class="orbital-alert"
            type="warning"
            density="compact"
          >
            <div class="d-flex align-center justify-space-between ga-4">
              <span>Changes not saved. Your edits stay here until they can be saved.</span>
              <v-btn size="small" variant="text" @click="retrySave">Retry</v-btn>
            </div>
          </v-alert>

          <section class="applicant-section">
            <p class="eyebrow">Basic information</p>

            <div class="applicant-fields">
              <v-text-field
                class="applicant-field--wide"
                label="Full name"
                :model-value="form.name"
                hide-details
                @update:model-value="updateField('name', $event)"
              />
              <v-text-field
                label="Email"
                type="email"
                :model-value="form.email"
                :error-messages="fieldErrors.email"
                hide-details="auto"
                @update:model-value="updateField('email', $event)"
              />
              <v-text-field
                label="Phone number"
                type="tel"
                :model-value="form.phone"
                :error-messages="fieldErrors.phone"
                hide-details="auto"
                @update:model-value="updateField('phone', $event)"
              />
              <v-text-field
                class="applicant-field--wide"
                label="Current role"
                :model-value="form.currentRole"
                hide-details
                @update:model-value="updateField('currentRole', $event)"
              />
            </div>
          </section>

          <section v-for="section in textSections" :key="section.key" class="applicant-section">
            <p class="eyebrow">{{ section.title }}</p>
            <v-textarea
              class="applicant-notes-field"
              :label="section.fieldLabel"
              :model-value="form[section.key]"
              auto-grow
              hide-details
              rows="4"
              @update:model-value="updateField(section.key, $event)"
            />
          </section>

          <section class="applicant-section">
            <p class="eyebrow">CV</p>

            <div v-if="candidate.cvPath" class="applicant-cv-card">
              <v-icon class="applicant-cv-card__icon" icon="mdi-file-pdf-box" size="36" />
              <div class="applicant-cv-card__copy">
                <p class="candidate-name">{{ candidate.cvName || 'CV.pdf' }}</p>
                <p class="candidate-source">PDF document</p>
              </div>
              <div class="applicant-cv-card__actions">
                <v-btn variant="outlined" prepend-icon="mdi-eye-outline" @click="openCvPreview">
                  Preview
                </v-btn>
                <v-btn
                  color="error"
                  variant="text"
                  prepend-icon="mdi-delete-outline"
                  :disabled="cvBusy"
                  :loading="cvBusy"
                  @click="removeCv"
                >
                  Remove
                </v-btn>
              </div>
            </div>

            <template v-else>
              <p class="applicant-cv-hint">
                Upload one PDF CV for this applicant. PDFs are compressed in your browser before
                upload.
              </p>
              <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-upload"
                :disabled="cvBusy"
                :loading="cvBusy"
                @click="chooseCv"
              >
                Upload CV
              </v-btn>
            </template>

            <input
              ref="cvFileInput"
              class="applicant-cv-input"
              type="file"
              accept="application/pdf,.pdf"
              @change="onCvSelected"
            />

            <v-alert v-if="cvError" class="orbital-alert" type="error" density="compact">
              {{ cvError }}
            </v-alert>
          </section>

          <section class="applicant-section">
            <p class="eyebrow">Notes</p>

            <v-textarea
              v-model="noteDraft"
              class="applicant-notes-field"
              label="Add a note"
              auto-grow
              hide-details
              rows="3"
            />
            <div class="applicant-note-compose">
              <v-btn
                color="primary"
                variant="outlined"
                prepend-icon="mdi-note-plus-outline"
                :disabled="!noteDraft.trim()"
                :loading="noteSaving"
                @click="addNote"
              >
                Add note
              </v-btn>
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
                  <time :datetime="note.createdAt">{{ formatEventTime(note.createdAt) }}</time>
                </p>
              </li>
            </ul>
          </section>

          <p class="applicant-drawer__note">Changes save automatically to the shared workspace.</p>

          <v-btn
            variant="text"
            color="error"
            prepend-icon="mdi-delete-outline"
            @click="requestDeleteApplicant"
          >
            Delete applicant
          </v-btn>
        </div>

        <div v-else-if="activeTab === 'events'" class="applicant-events">
          <v-alert v-if="eventsError" class="orbital-alert" type="error" density="compact">
            {{ eventsError }}
          </v-alert>

          <div v-if="eventsLoading" class="applicant-events__status">Loading events...</div>
          <p v-else-if="!events.length" class="applicant-events__empty">
            No events recorded for this applicant yet.
          </p>
          <ol v-else class="applicant-event-list">
            <li v-for="event in events" :key="event.id" class="applicant-event">
              <span class="applicant-event__dot" aria-hidden="true" />
              <div class="applicant-event__copy">
                <p class="applicant-event__message">{{ event.message }}</p>
                <time class="applicant-event__time" :datetime="event.createdAt">
                  {{ formatEventTime(event.createdAt) }}
                </time>
              </div>
            </li>
          </ol>
        </div>

        <div v-else class="applicant-fit">
          <v-alert v-if="fitError" class="orbital-alert" type="error" density="compact">
            {{ fitError }}
          </v-alert>

          <v-alert v-if="fitStale" class="orbital-alert" type="warning" density="compact">
            This profile, CV, or job spec has changed since the last analysis. Use the refresh
            button to update it.
          </v-alert>

          <div v-if="fitAnalyzing" class="applicant-fit__status" role="status" aria-live="polite">
            <v-progress-circular indeterminate color="primary" size="22" />
            <span>{{ fitProgress || 'Analyzing the CV against the job spec…' }}</span>
          </div>

          <template v-else-if="fitAnalysis">
            <div class="fit-toolbar">
              <v-btn
                icon="mdi-refresh"
                size="small"
                variant="text"
                aria-label="Re-analyze CV"
                title="Re-analyze CV"
                :disabled="!canAnalyze"
                @click="requestFitAnalysis"
              />
            </div>

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
            <ul v-if="fitPrerequisites.length" class="fit-empty__checks">
              <li v-for="item in fitPrerequisites" :key="item">{{ item }}</li>
            </ul>
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
</template>
