<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { initials as getInitials } from '@/lib/pipeline'
import { isValidEmail, isValidPhone } from '@/lib/validation'
import { useBoardsStore, type EditableCandidateField } from '@/stores/boards'

const props = defineProps<{
  modelValue: boolean
  candidateId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useBoardsStore()
const candidate = computed(() =>
  props.candidateId ? store.candidateById(props.candidateId) : undefined,
)
const initials = computed(() => (candidate.value ? getInitials(candidate.value.name) : ''))
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
  const uploaded = await store.uploadCv(current.id, file)
  cvBusy.value = false

  if (!uploaded) {
    cvError.value = store.error ?? 'The CV could not be uploaded.'
  }
}

async function removeCv(): Promise<void> {
  const current = candidate.value

  if (!current) {
    return
  }

  cvBusy.value = true
  const removed = await store.removeCv(current.id)
  cvBusy.value = false

  if (removed) {
    closeCvPreview()
    return
  }

  cvError.value = store.error ?? 'The CV could not be removed.'
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

  const url = await store.cvSignedUrl(path)
  cvLoading.value = false

  if (!url) {
    cvError.value = store.error ?? 'The CV could not be opened.'
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
  const blob = await store.cvBlob(path)

  if (!blob) {
    cvError.value = store.error ?? 'The CV could not be printed.'
    return
  }

  const url = URL.createObjectURL(blob)
  const frame = document.createElement('iframe')
  frame.style.cssText = 'position: fixed; right: 0; bottom: 0; width: 0; height: 0; border: 0;'
  frame.src = url
  frame.onload = () => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    window.setTimeout(() => {
      frame.remove()
      URL.revokeObjectURL(url)
    }, 60_000)
  }
  document.body.appendChild(frame)
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

watch([() => props.modelValue, () => props.candidateId], ([value]) => {
  if (value) {
    syncForm()
    closeCvPreview()
    cvError.value = ''
  }
})

watch(
  () => props.modelValue,
  (value) => {
    setPageScrollLocked(value)

    if (!value) {
      closeCvPreview()

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

        <div v-else class="applicant-drawer__body">
          <v-alert v-if="store.error" class="orbital-alert" type="error" density="compact">
            {{ store.error }}
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
              <p class="applicant-cv-hint">Upload one PDF CV for this applicant.</p>
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
</template>
