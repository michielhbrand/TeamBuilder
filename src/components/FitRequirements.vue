<script setup lang="ts">
import { computed, ref } from 'vue'
import FitStatusGlyph from '@/components/FitStatusGlyph.vue'
import { fitSummary, type FitRequirementCounts } from '@/lib/fit-rank'
import { requirementStatusText, verdictTitle } from '@/lib/fit-view'
import type { FitAnalysisResult, FitRequirementAssessment } from '@/types/fit'

const props = defineProps<{
  result: FitAnalysisResult
  rank?: { position: number; total: number; stageName: string }
}>()

const gapsOnly = ref(false)
const collapsed = ref<Record<string, boolean>>({})
const summary = computed(() => fitSummary(props.result))
const title = computed(() => verdictTitle(summary.value))
const groups = computed(() =>
  [
    {
      key: 'minimum',
      short: 'Minimum',
      title: 'Minimum requirements',
      items: props.result.requirements.minimum,
      counts: summary.value.minimum,
      critical: true,
    },
    {
      key: 'recommended',
      short: 'Recommended',
      title: 'Recommended requirements',
      items: props.result.requirements.recommended,
      counts: summary.value.recommended,
      critical: false,
    },
    {
      key: 'skills',
      short: 'Skills',
      title: 'Skills and tools',
      items: props.result.requirements.skills,
      counts: summary.value.skills,
      critical: false,
    },
  ].filter((group) => group.items.length),
)

function isFull(item: FitRequirementAssessment): boolean {
  return item.assessed && item.status === 'full'
}

function visibleItems(items: FitRequirementAssessment[]): FitRequirementAssessment[] {
  return gapsOnly.value ? items.filter((item) => !isFull(item)) : items
}

function meterLabel(short: string, counts: FitRequirementCounts): string {
  const parts = [`${counts.full} of ${counts.total} met`]

  if (counts.partial) {
    parts.push(`${counts.partial} partial`)
  }

  if (counts.none) {
    parts.push(`${counts.none} not shown`)
  }

  return `${short}: ${parts.join(', ')}`
}

function toggleGroup(key: string): void {
  collapsed.value = { ...collapsed.value, [key]: !collapsed.value[key] }
}
</script>

<template>
  <div class="fit-requirements">
    <section class="fit-verdict" aria-label="CV fit summary">
      <div>
        <h3 v-if="title" class="fit-verdict__title">{{ title }}</h3>
        <p v-if="rank" class="fit-verdict__sub">
          Ranked #{{ rank.position }} of {{ rank.total }} analyzed in {{ rank.stageName }} · minimum
          first, then recommended, then skills
        </p>
      </div>

      <ul class="fit-meters">
        <li v-for="group in groups" :key="group.key" class="fit-meter">
          <span class="fit-meter__name">{{ group.short }}</span>
          <div class="fit-bar" role="img" :aria-label="meterLabel(group.short, group.counts)">
            <span
              v-if="group.counts.full"
              class="fit-bar__met"
              :style="{ flexGrow: group.counts.full }"
            />
            <span
              v-if="group.counts.partial"
              class="fit-bar__partial"
              :style="{ flexGrow: group.counts.partial }"
            />
            <span
              v-if="group.counts.none"
              class="fit-bar__gap"
              :style="{ flexGrow: group.counts.none }"
            />
          </div>
          <span class="fit-meter__text">
            <b>{{ group.counts.full }}</b> of {{ group.counts.total }} met
            <template v-if="group.counts.partial"> · {{ group.counts.partial }} partial</template>
            <template v-if="group.counts.none"> · {{ group.counts.none }} not shown</template>
          </span>
        </li>
      </ul>

      <ul class="fit-legend" aria-label="Legend">
        <li><FitStatusGlyph status="full" /> Met</li>
        <li><FitStatusGlyph status="partial" /> Partly met</li>
        <li><FitStatusGlyph status="none" /> Not shown in CV</li>
      </ul>
    </section>

    <div class="fit-toolbar">
      <button
        type="button"
        role="switch"
        class="fit-switch"
        :aria-checked="gapsOnly"
        @click="gapsOnly = !gapsOnly"
      >
        <span class="fit-switch__track" aria-hidden="true" />
        Gaps only
      </button>
    </div>

    <section v-for="group in groups" :key="group.key" class="fit-group">
      <button
        type="button"
        class="fit-group__head"
        :data-group="group.key"
        :aria-expanded="!collapsed[group.key]"
        @click="toggleGroup(group.key)"
      >
        <span class="fit-group__title">
          <v-icon
            icon="mdi-chevron-down"
            size="18"
            class="fit-group__chevron"
            :class="{ 'fit-group__chevron--closed': collapsed[group.key] }"
            aria-hidden="true"
          />
          <span class="eyebrow">{{ group.title }}</span>
        </span>
        <span class="fit-group__count"
          ><b>{{ group.counts.full }}</b> / {{ group.counts.total }} met</span
        >
      </button>

      <template v-if="!collapsed[group.key]">
        <p v-if="!visibleItems(group.items).length" class="fit-absent">
          Everything here is fully met.
        </p>

        <ul v-else-if="group.key === 'skills'" class="fit-chips">
          <li
            v-for="item in visibleItems(group.items)"
            :key="item.id"
            class="fit-chip"
            :class="{ 'fit-chip--gap': item.status === 'none' }"
            :title="item.evidence || requirementStatusText(item)"
          >
            <FitStatusGlyph :status="item.status" />
            <span>{{ item.label }}</span>
            <span class="sr-only">{{ requirementStatusText(item) }}</span>
          </li>
        </ul>

        <ul v-else class="fit-rows">
          <li
            v-for="item in visibleItems(group.items)"
            :key="item.id"
            class="fit-row"
            :class="`fit-row--${item.status}`"
          >
            <FitStatusGlyph
              :status="item.status"
              :critical="group.critical && item.assessed && item.status === 'none'"
            />
            <div>
              <p class="fit-row__label">
                <span class="sr-only">{{ requirementStatusText(item) }}: </span>{{ item.label }}
              </p>
              <p v-if="!item.assessed" class="fit-absent">
                Not assessed. Re-run the analysis to check it.
              </p>
              <p
                v-else-if="item.status === 'none'"
                class="fit-absent"
                :class="{ 'fit-absent--critical': group.critical }"
              >
                Not found in the CV
              </p>
              <p v-else-if="item.evidence" class="fit-evidence">
                <span v-if="item.status === 'partial'" class="fit-evidence__lead"
                  >Partly met ·
                </span>
                {{ item.evidence }}
              </p>
            </div>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
