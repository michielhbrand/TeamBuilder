<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { PDF_MAX_BYTES, isPdfFile } from '@/lib/pdf'
import { defaultApplicantStep } from '@/lib/pipeline'
import {
  importApplicantFromPdf,
  mergeApplicantDraft,
  type ApplicantDraft,
  type ApplicantDraftField,
} from '@/lib/resume-import'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { useBoardsStore } from '@/stores/boards'
import type { Board, Candidate } from '@/types/pipeline'

const props = defineProps<{
  modelValue: boolean
  board?: Board | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  created: [candidate: Candidate]
}>()

const store = useBoardsStore()
const submitting = ref(false)
const localError = ref('')
const stepId = ref('')
const cvFile = ref<File | null>(null)
const cvName = ref('')
const importing = ref(false)
const importStatus = ref('')
const importProgress = ref(0)
const importError = ref('')
const autoFilled = reactive(new Set<ApplicantDraftField>())
const editedFields = reactive(new Set<ApplicantDraftField>())
const form = reactive<Record<ApplicantDraftField, string>>({
  name: '',
  email: '',
  phone: '',
  currentRole: '',
  education: '',
  experience: '',
})

let importController: AbortController | null = null
let importRun = 0

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const steps = computed(() => props.board?.steps ?? [])

function syncForm(): void {
  form.name = ''
  form.email = ''
  form.phone = ''
  form.currentRole = ''
  form.education = ''
  form.experience = ''
  stepId.value = (props.board ? defaultApplicantStep(props.board)?.id : undefined) ?? ''
  localError.value = ''
  autoFilled.clear()
  editedFields.clear()
  resetImport(true)
}

function cancelImport(clearFile = false): void {
  importRun += 1
  importController?.abort()
  importController = null
  importing.value = false
  importStatus.value = ''
  importProgress.value = 0

  if (clearFile) {
    cvFile.value = null
    cvName.value = ''
  }
}

function resetImport(clearFile = false): void {
  cancelImport(clearFile)
  importError.value = ''
}

function applyDraft(draft: ApplicantDraft): void {
  mergeApplicantDraft(form, draft, editedFields, autoFilled)
}

function setField(field: ApplicantDraftField, value: unknown): void {
  form[field] = String(value ?? '')
  editedFields.add(field)
  autoFilled.delete(field)
}

function chooseCv(): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/pdf,.pdf'
  input.addEventListener(
    'change',
    () => {
      const file = input.files?.[0]

      if (file) {
        void handleCv(file)
      }
    },
    { once: true },
  )
  input.click()
}

function validateFile(file: File): boolean {
  if (!isPdfFile(file)) {
    importError.value = 'Choose a PDF file.'
    return false
  }

  if (file.size > PDF_MAX_BYTES) {
    importError.value = 'The CV must be smaller than 10 MB.'
    return false
  }

  return true
}

async function handleCv(file: File): Promise<void> {
  if (!validateFile(file)) {
    return
  }

  cancelImport()
  importError.value = ''
  cvFile.value = file
  cvName.value = file.name
  importing.value = true
  importStatus.value = 'Reading the PDF…'
  importProgress.value = 0

  const run = importRun + 1
  importRun = run
  const controller = new AbortController()
  importController = controller

  try {
    await importApplicantFromPdf(file, {
      signal: controller.signal,
      onDraft: (draft) => {
        if (run === importRun) {
          applyDraft(draft)
        }
      },
      onProgress: (progress) => {
        if (run !== importRun) {
          return
        }

        importStatus.value = progress.message
        importProgress.value =
          progress.total && progress.current
            ? Math.round((progress.current / progress.total) * 100)
            : 0
      },
    })

    if (run !== importRun) {
      return
    }

    importing.value = false
    importProgress.value = 100
    importStatus.value = autoFilled.size
      ? 'Details filled from the CV. Review and edit anything.'
      : 'No details could be read from this PDF. Enter them manually.'
  } catch (error) {
    if (run !== importRun) {
      return
    }

    importing.value = false
    importStatus.value = ''

    if (error instanceof Error && error.name === 'AbortError') {
      return
    }

    importError.value = 'The CV could not be read. You can still enter details manually.'
  } finally {
    if (run === importRun) {
      importController = null
    }
  }
}

async function onCvDropped(event: DragEvent): Promise<void> {
  const file = event.dataTransfer?.files?.[0]

  if (file) {
    await handleCv(file)
  }
}

function removeCv(): void {
  resetImport(true)
  importStatus.value = ''
}

async function submit(): Promise<void> {
  localError.value = ''
  cancelImport()

  if (!props.board) {
    return
  }

  if (!form.name.trim()) {
    localError.value = 'Enter the applicant name.'
    return
  }

  const emailValue = form.email.trim()

  if (emailValue && !isValidEmail(emailValue)) {
    localError.value = 'Enter a valid email address.'
    return
  }

  const phoneValue = form.phone.trim()

  if (phoneValue && !isValidPhone(phoneValue)) {
    localError.value = 'Enter a phone number using digits only.'
    return
  }

  submitting.value = true

  try {
    const created = await store.createApplicant(
      props.board.id,
      {
        name: form.name,
        email: emailValue,
        phone: phoneValue,
        currentRole: form.currentRole,
        education: form.education,
        experience: form.experience,
        stepId: stepId.value,
      },
      cvFile.value,
    )

    if (created) {
      emit('created', created)
      open.value = false
    }
  } finally {
    submitting.value = false
  }
}

watch([() => props.modelValue, () => props.board?.id], ([value]) => {
  if (value) {
    syncForm()
  }
})

watch(
  () => props.modelValue,
  (value) => {
    if (!value) {
      resetImport(true)
    }
  },
)

onBeforeUnmount(() => resetImport(true))
</script>

<template>
  <v-dialog v-model="open" max-width="680">
    <v-card class="orbital-dialog">
      <form @submit.prevent="submit">
        <div class="orbital-dialog__head">
          <div>
            <p class="eyebrow">Applicant</p>
            <h2 class="panel-title">Add an applicant</h2>
          </div>
          <v-btn icon="mdi-close" variant="text" aria-label="Close" @click="open = false" />
        </div>

        <div class="orbital-dialog__body">
          <v-alert
            v-if="localError || store.error"
            class="orbital-alert"
            type="error"
            density="compact"
          >
            {{ localError || store.error }}
          </v-alert>

          <section
            class="applicant-import"
            @dragenter.prevent
            @dragover.prevent
            @drop.prevent="onCvDropped"
          >
            <div class="applicant-import__head">
              <div class="applicant-import__copy">
                <p class="eyebrow">Quick fill</p>
                <p class="applicant-import__hint">
                  Upload a PDF CV to fill the fields below. Everything stays editable.
                </p>
              </div>
              <v-btn
                class="orbital-btn"
                variant="outlined"
                prepend-icon="mdi-file-upload-outline"
                :disabled="submitting"
                @click="chooseCv"
              >
                {{ cvFile ? 'Choose another' : 'Upload CV' }}
              </v-btn>
            </div>

            <div v-if="cvFile" class="applicant-import__file">
              <v-icon icon="mdi-file-pdf-box" />
              <span>{{ cvName }}</span>
              <v-btn icon="mdi-close" variant="text" aria-label="Remove CV" @click="removeCv" />
            </div>

            <div v-if="importing" class="applicant-import__progress">
              <div class="applicant-import__status" role="status" aria-live="polite">
                <span>{{ importStatus }}</span>
                <v-btn variant="text" size="small" @click="cancelImport()">Cancel</v-btn>
              </div>
              <v-progress-linear :model-value="importProgress" color="primary" height="3" rounded />
            </div>

            <p
              v-else-if="importStatus"
              class="applicant-import__status-text"
              role="status"
              aria-live="polite"
            >
              {{ importStatus }}
            </p>

            <v-alert v-if="importError" class="orbital-alert" type="warning" density="compact">
              {{ importError }}
            </v-alert>
          </section>

          <div class="orbital-dialog__grid">
            <v-text-field
              class="orbital-field"
              :class="{ 'orbital-field--autofilled': autoFilled.has('name') }"
              label="Full name"
              variant="outlined"
              :model-value="form.name"
              autofocus
              @update:model-value="setField('name', $event)"
            />
            <v-text-field
              class="orbital-field"
              :class="{ 'orbital-field--autofilled': autoFilled.has('email') }"
              label="Email"
              type="email"
              variant="outlined"
              :model-value="form.email"
              @update:model-value="setField('email', $event)"
            />
            <v-text-field
              class="orbital-field"
              :class="{ 'orbital-field--autofilled': autoFilled.has('phone') }"
              label="Phone number"
              type="tel"
              variant="outlined"
              :model-value="form.phone"
              @update:model-value="setField('phone', $event)"
            />
            <v-text-field
              class="orbital-field"
              :class="{ 'orbital-field--autofilled': autoFilled.has('currentRole') }"
              label="Current role"
              variant="outlined"
              :model-value="form.currentRole"
              @update:model-value="setField('currentRole', $event)"
            />
          </div>

          <v-select
            v-model="stepId"
            class="orbital-field"
            label="Starting column"
            :items="steps"
            item-title="name"
            item-value="id"
            variant="outlined"
          />

          <v-textarea
            class="orbital-field"
            :class="{ 'orbital-field--autofilled': autoFilled.has('education') }"
            label="Education"
            variant="outlined"
            rows="3"
            auto-grow
            :model-value="form.education"
            @update:model-value="setField('education', $event)"
          />

          <v-textarea
            class="orbital-field"
            :class="{ 'orbital-field--autofilled': autoFilled.has('experience') }"
            label="Work experience"
            variant="outlined"
            rows="3"
            auto-grow
            :model-value="form.experience"
            @update:model-value="setField('experience', $event)"
          />
        </div>

        <div class="orbital-dialog__actions">
          <v-btn variant="text" @click="open = false">Cancel</v-btn>
          <v-btn color="primary" type="submit" :loading="submitting">Add applicant</v-btn>
        </div>
      </form>
    </v-card>
  </v-dialog>
</template>
