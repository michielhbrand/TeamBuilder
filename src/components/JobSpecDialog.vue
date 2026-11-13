<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { isPdfFile, printPdfBlob } from '@/lib/pdf'
import { useStorageStore } from '@/stores/storage'
import { useFitStore } from '@/stores/fit'
import type { Board } from '@/types/pipeline'

const props = defineProps<{
  modelValue: boolean
  board?: Board | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const store = useStorageStore()
const fit = useFitStore()
const busy = ref(false)
const error = ref('')
const previewLoading = ref(false)
const previewUrl = ref('')
const confirmRemoveOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const open = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const hasSpec = computed(() => Boolean(props.board?.jobSpecPath))
const specName = computed(() => props.board?.jobSpecName || 'Job spec.pdf')

watch([() => props.modelValue, () => props.board?.jobSpecPath], ([value, path]) => {
  if (!value) {
    previewUrl.value = ''
    previewLoading.value = false
    error.value = ''
    return
  }

  error.value = ''

  if (path) {
    void loadPreview(path)
  } else {
    previewUrl.value = ''
    previewLoading.value = false
  }
})

async function loadPreview(path: string): Promise<void> {
  previewLoading.value = true
  previewUrl.value = ''

  const url = await store.jobSpecSignedUrl(path)
  previewLoading.value = false

  if (!url) {
    error.value = store.error ?? 'The job spec could not be opened.'
    return
  }

  previewUrl.value = url
}

function chooseFile(): void {
  error.value = ''
  fileInput.value?.click()
}

async function onFileSelected(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  const board = props.board
  input.value = ''

  if (!file || !board) {
    return
  }

  if (!isPdfFile(file)) {
    error.value = 'Choose a PDF file.'
    return
  }

  busy.value = true
  const uploaded = await store.uploadJobSpec(board.id, file)
  busy.value = false

  if (!uploaded) {
    error.value = store.error ?? 'The job spec could not be uploaded.'
    return
  }

  fit.markBoardStale(board.id)
}

function requestRemove(): void {
  confirmRemoveOpen.value = true
}

async function removeSpec(): Promise<void> {
  const board = props.board

  if (!board) {
    return
  }

  busy.value = true
  const removed = await store.removeJobSpec(board.id)
  busy.value = false
  confirmRemoveOpen.value = false

  if (!removed) {
    error.value = store.error ?? 'The job spec could not be removed.'
    return
  }

  fit.markBoardStale(board.id)
}

function openFullscreen(): void {
  if (previewUrl.value) {
    window.open(previewUrl.value, '_blank', 'noopener,noreferrer')
  }
}

async function printSpec(): Promise<void> {
  const path = props.board?.jobSpecPath

  if (!path) {
    return
  }

  error.value = ''
  const blob = await store.jobSpecBlob(path)

  if (!blob) {
    error.value = store.error ?? 'The job spec could not be printed.'
    return
  }

  printPdfBlob(blob)
}
</script>

<template>
  <v-dialog v-model="open" :max-width="hasSpec ? 1100 : 560" scrollable>
    <v-card class="orbital-dialog">
      <div class="orbital-dialog__head">
        <div>
          <p class="eyebrow">Job spec</p>
          <h2 class="panel-title">{{ hasSpec ? specName : 'Upload the job spec' }}</h2>
        </div>
        <v-btn icon="mdi-close" variant="text" aria-label="Close job spec" @click="open = false" />
      </div>

      <div class="orbital-dialog__body">
        <v-alert v-if="error || store.error" class="orbital-alert" type="error" density="compact">
          {{ error || store.error }}
        </v-alert>

        <template v-if="hasSpec">
          <div class="applicant-cv-toolbar">
            <span class="applicant-cv-toolbar__name">{{ specName }}</span>
            <div class="applicant-cv-toolbar__actions">
              <v-btn
                icon="mdi-open-in-new"
                variant="text"
                aria-label="Open job spec in a new tab"
                title="Open in a new tab"
                @click="openFullscreen"
              />
              <v-btn
                icon="mdi-printer-outline"
                variant="text"
                aria-label="Print job spec"
                title="Print job spec"
                @click="printSpec"
              />
              <v-btn
                color="error"
                variant="text"
                prepend-icon="mdi-delete-outline"
                :disabled="busy"
                :loading="busy"
                @click="requestRemove"
              >
                Remove
              </v-btn>
            </div>
          </div>

          <div v-if="previewLoading" class="applicant-cv-status">Loading preview...</div>
          <iframe
            v-else-if="previewUrl"
            :src="previewUrl"
            class="applicant-cv-frame"
            title="Job spec preview"
          />
        </template>

        <div v-else class="job-spec-empty">
          <v-icon icon="mdi-file-pdf-box" size="48" />
          <p class="job-spec-empty__title">No job spec attached yet.</p>
          <p class="applicant-cv-hint">
            Upload the role's job spec as a PDF. It is compressed in your browser before upload to
            reduce storage.
          </p>
          <v-btn
            color="primary"
            prepend-icon="mdi-upload"
            :disabled="busy"
            :loading="busy"
            @click="chooseFile"
          >
            Upload job spec
          </v-btn>
          <input
            ref="fileInput"
            class="applicant-cv-input"
            type="file"
            accept="application/pdf,.pdf"
            @change="onFileSelected"
          />
        </div>
      </div>
    </v-card>
  </v-dialog>

  <ConfirmDialog
    v-model="confirmRemoveOpen"
    eyebrow="Remove job spec"
    title="Remove this job spec?"
    :message="`Remove ${specName} from this board? This cannot be undone.`"
    confirm-label="Remove job spec"
    :loading="busy"
    @confirm="removeSpec"
  />
</template>
