<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FitComparisonContent from '@/components/FitComparisonContent.vue'
import {
  DEFAULT_FIT_SELECTION,
  DEFAULT_FIT_WEIGHTS,
  FIT_WEIGHT_KEYS,
  buildFitComparison,
  fitWeightsTotal,
  isValidFitWeights,
  parseFitWeights,
  rebalanceWeights,
  type FitComparisonEntry,
  type FitComparisonMode,
  type FitComparisonSelection,
} from '@/lib/fit-compare'
import { useMediaQuery } from '@/lib/use-media-query'
import { useBoardsStore } from '@/stores/boards'
import { useFitStore } from '@/stores/fit'
import type { FitWeightKey, FitWeights } from '@/types/fit'
import type { Board } from '@/types/pipeline'

const props = defineProps<{ board: Board }>()

const emit = defineEmits<{
  'open-applicant': [applicantId: string]
}>()

const boards = useBoardsStore()
const fit = useFitStore()
const isPhone = useMediaQuery('(max-width: 720px)')

const expanded = ref(false)
const phoneOpen = ref(false)
const mode = ref<FitComparisonMode>('default')
const selection = ref<FitComparisonSelection>({ ...DEFAULT_FIT_SELECTION })
const weightsOpen = ref(false)
const draftWeights = ref<FitWeights>({ ...DEFAULT_FIT_WEIGHTS })
const weightDragBase = ref<FitWeights | null>(null)
const savingWeights = ref(false)
const weightsError = ref('')

const groupLabels: Record<FitWeightKey, string> = {
  minimum: 'Minimum',
  recommended: 'Recommended',
  skills: 'Skills',
}

const stageNames = computed(() => new Map(props.board.steps.map((step) => [step.id, step.name])))

const entries = computed<FitComparisonEntry[]>(() =>
  props.board.candidates
    .filter((candidate) => candidate.status === 'active')
    .flatMap((candidate) => {
      const summary = fit.summaryFor(candidate.id)

      if (!summary || !fit.isRankableFor(candidate.id)) {
        return []
      }

      return [
        {
          applicantId: candidate.id,
          name: candidate.name,
          stageName: stageNames.value.get(candidate.stepId) ?? '',
          summary,
        },
      ]
    }),
)

const boardWeights = computed(() => parseFitWeights(props.board.fitWeights))
const draftTotal = computed(() => fitWeightsTotal(draftWeights.value))
const draftValid = computed(() => isValidFitWeights(draftWeights.value))
const previewWeights = computed(() =>
  weightsOpen.value && draftValid.value ? draftWeights.value : boardWeights.value,
)

const rows = computed(() =>
  buildFitComparison(entries.value, {
    mode: mode.value,
    weights: previewWeights.value,
    selection: selection.value,
  }),
)

const activeCount = computed(
  () => props.board.candidates.filter((candidate) => candidate.status === 'active').length,
)
const analysedCount = computed(() => entries.value.length)
const excludedCount = computed(() => Math.max(0, activeCount.value - analysedCount.value))
const missingMinimum = computed(() => rows.value.filter((row) => row.tier === 1).length)
const loading = computed(() => fit.isBoardLoading(props.board.id))
const error = computed(() => fit.boardErrorFor(props.board.id))

const summaryText = computed(() => {
  const parts = [`${activeCount.value} active`]

  if (analysedCount.value) {
    parts.push(`${analysedCount.value} analyzed`)
  } else {
    parts.push('no CV analyses yet')
  }

  if (missingMinimum.value) {
    parts.push(
      `${missingMinimum.value} ${missingMinimum.value === 1 ? 'misses' : 'miss'} a minimum`,
    )
  }

  if (excludedCount.value) {
    parts.push(`${excludedCount.value} not analyzed`)
  }

  if (analysedCount.value) {
    parts.push(mode.value === 'default' ? 'default order' : 'custom weights')
  }

  return parts.join(' · ')
})

watch(
  () => props.board.id,
  () => {
    expanded.value = false
    phoneOpen.value = false
    weightsOpen.value = false
    weightDragBase.value = null
    mode.value = 'default'
    selection.value = { ...DEFAULT_FIT_SELECTION }
  },
)

function toggleExpanded(): void {
  if (isPhone.value) {
    phoneOpen.value = true
    return
  }

  expanded.value = !expanded.value
}

function openWeights(): void {
  draftWeights.value = { ...boardWeights.value }
  weightDragBase.value = null
  weightsError.value = ''
  weightsOpen.value = true
  mode.value = 'custom'
}

function resetWeights(): void {
  draftWeights.value = { ...DEFAULT_FIT_WEIGHTS }
  weightDragBase.value = null
  weightsError.value = ''
}

function beginWeightDrag(): void {
  weightDragBase.value = { ...draftWeights.value }
}

function endWeightDrag(): void {
  weightDragBase.value = null
}

function setWeight(key: FitWeightKey, value: number | number[]): void {
  const next = Array.isArray(value) ? value[0] : value

  if (typeof next !== 'number' || !Number.isFinite(next)) {
    return
  }

  draftWeights.value = rebalanceWeights(weightDragBase.value ?? draftWeights.value, key, next)
  weightsError.value = ''
}

async function saveWeights(): Promise<void> {
  if (!draftValid.value || savingWeights.value) {
    return
  }

  savingWeights.value = true
  weightsError.value = ''
  const saved = await boards.updateBoard(props.board.id, {
    fitWeights: { ...draftWeights.value },
  })
  savingWeights.value = false

  if (saved) {
    weightsOpen.value = false
    return
  }

  weightsError.value = boards.error ?? 'The custom weights could not be saved.'
}

function openApplicant(applicantId: string): void {
  phoneOpen.value = false
  emit('open-applicant', applicantId)
}
</script>

<template>
  <section class="fit-compare-band" aria-labelledby="fit-compare-title">
    <div class="fit-compare-band__head">
      <div>
        <h2 id="fit-compare-title" class="fit-compare-band__title">Candidate Comparison</h2>
        <p class="meta fit-compare-band__summary">{{ summaryText }}</p>
      </div>

      <div class="fit-compare-band__actions">
        <v-btn variant="text" size="small" prepend-icon="mdi-tune-variant" @click="openWeights">
          Weights
        </v-btn>
        <v-btn
          variant="text"
          size="small"
          :append-icon="expanded || phoneOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'"
          :aria-expanded="isPhone ? phoneOpen : expanded"
          aria-controls="fit-compare-body"
          @click="toggleExpanded"
        >
          {{ expanded || phoneOpen ? 'Hide' : 'Show' }}
        </v-btn>
      </div>
    </div>

    <div v-if="expanded && !isPhone" id="fit-compare-body" class="fit-compare-band__body">
      <FitComparisonContent
        :rows="rows"
        :mode="mode"
        :selection="selection"
        :excluded-count="excludedCount"
        :loading="loading"
        :error="error"
        @update:mode="mode = $event"
        @update:selection="selection = $event"
        @open-applicant="openApplicant"
      />
    </div>

    <v-dialog v-model="phoneOpen" fullscreen transition="dialog-bottom-transition">
      <v-card class="fit-compare-phone">
        <v-toolbar density="compact">
          <v-toolbar-title>Candidate Comparison</v-toolbar-title>
          <v-btn variant="text" size="small" prepend-icon="mdi-tune-variant" @click="openWeights">
            Weights
          </v-btn>
          <v-btn
            icon="mdi-close"
            variant="text"
            aria-label="Close comparison"
            @click="phoneOpen = false"
          />
        </v-toolbar>
        <v-card-text id="fit-compare-body" class="fit-compare-phone__body">
          <FitComparisonContent
            :rows="rows"
            :mode="mode"
            :selection="selection"
            :excluded-count="excludedCount"
            :loading="loading"
            :error="error"
            @update:mode="mode = $event"
            @update:selection="selection = $event"
            @open-applicant="openApplicant"
          />
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="weightsOpen" max-width="460">
      <v-card class="fit-compare-weights">
        <v-card-title>Custom weights</v-card-title>
        <v-card-text>
          <p class="meta fit-compare-weights__intro">
            Custom weights order the comparison by weighted fit. The default order compares Minimum,
            then Recommended, then Skills. Stage columns stay minimum-first.
          </p>

          <div class="fit-compare-weights__fields">
            <div v-for="key in FIT_WEIGHT_KEYS" :key="key" class="fit-compare-weights__field">
              <div class="fit-compare-weights__field-head">
                <span class="fit-compare-weights__label">{{ groupLabels[key] }}</span>
                <span class="fit-compare-weights__value">{{ draftWeights[key] }}%</span>
              </div>
              <v-slider
                :model-value="draftWeights[key]"
                :min="0"
                :max="100"
                :step="1"
                color="primary"
                density="compact"
                hide-details
                :aria-label="`${groupLabels[key]} weight`"
                @start="beginWeightDrag"
                @end="endWeightDrag"
                @update:model-value="setWeight(key, $event)"
              />
            </div>
          </div>

          <p
            class="fit-compare-weights__sum"
            :class="{ 'fit-compare-weights__sum--error': !draftValid }"
          >
            Total {{ draftTotal }}%
            <template v-if="!draftValid"> · weights must add up to 100%</template>
          </p>
          <p class="meta fit-compare-weights__hint">Moving one slider rebalances the other two.</p>

          <p v-if="weightsError" class="fit-compare-weights__error">{{ weightsError }}</p>
        </v-card-text>
        <v-card-actions>
          <v-btn variant="text" @click="resetWeights">Reset</v-btn>
          <v-spacer />
          <v-btn variant="text" @click="weightsOpen = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!draftValid || savingWeights"
            :loading="savingWeights"
            @click="saveWeights"
          >
            Save weights
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>
