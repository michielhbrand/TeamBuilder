<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ActivityFeed from '@/components/ActivityFeed.vue'
import AppShell from '@/components/AppShell.vue'
import AttentionList from '@/components/AttentionList.vue'
import ChartTooltip from '@/components/ChartTooltip.vue'
import FlowRows from '@/components/FlowRows.vue'
import HireTimeChart from '@/components/HireTimeChart.vue'
import OverviewKpi from '@/components/OverviewKpi.vue'
import OverviewPanel from '@/components/OverviewPanel.vue'
import PageHeader from '@/components/PageHeader.vue'
import QuarterChart from '@/components/QuarterChart.vue'
import RoleDeadlineTable from '@/components/RoleDeadlineTable.vue'
import StageBars from '@/components/StageBars.vue'
import { provideChartTooltip } from '@/lib/chart-tooltip'
import {
  attentionItems,
  finalStageCount,
  hireRate,
  hiresInQuarters,
  median,
  quarterSeries,
  recentQuarters,
  roleFlow,
  slowestStage,
  stageStats,
} from '@/lib/overview'
import { summariseBoards } from '@/lib/pipeline'
import { useApplicantActivityStore } from '@/stores/applicant-activity'
import { useBoardsStore } from '@/stores/boards'
import { useHistoryStore } from '@/stores/history'

type HireView = 'strip' | 'range' | 'curve' | 'trend'

const ATTENTION_LIMIT = 6
const ACTIVITY_LIMIT = 6

const hireViews: { value: HireView; label: string }[] = [
  { value: 'strip', label: 'Every hire' },
  { value: 'range', label: 'Typical range' },
  { value: 'curve', label: 'Speed curve' },
  { value: 'trend', label: 'Trend' },
]

const hireViewHelp: Record<HireView, string> = {
  strip: 'Each dot is one hire. The dark mark is the median.',
  range: 'Bar is the middle half of hires, dot is the median, line runs fastest to slowest.',
  curve: 'The share of hires made within a number of days. Steeper and further left is faster.',
  trend: 'Median days to hire per quarter.',
}

provideChartTooltip()

const store = useBoardsStore()
const history = useHistoryStore()
const activity = useApplicantActivityStore()

const now = new Date()
const department = ref<string>('all')
const range = ref<4 | 12>(4)
const hireView = ref<HireView>('strip')
const focusBoardId = ref<string | null>(null)

const departments = computed(() => store.groups.map((group) => group.department))

const filteredBoards = computed(() =>
  department.value === 'all'
    ? store.orderedBoards
    : store.boards.filter((board) => board.department === department.value),
)

const focusBoard = computed(
  () =>
    filteredBoards.value.find((board) => board.id === focusBoardId.value) ??
    filteredBoards.value[0],
)

const totals = computed(() => summariseBoards(filteredBoards.value))
const finalStage = computed(() =>
  filteredBoards.value.reduce((sum, board) => sum + finalStageCount(board), 0),
)

const attention = computed(() => attentionItems(filteredBoards.value, now))

const latestEvents = computed(() => {
  const ids = new Set(filteredBoards.value.map((board) => board.id))
  return activity.recent.filter((event) => ids.has(event.boardId)).slice(0, ACTIVITY_LIMIT)
})

const currentQuarter = recentQuarters(now, 1)[0] as string
const lastFourQuarters = recentQuarters(now, 4)

const lastFourHired = computed(() =>
  quarterSeries(history.months, department.value, 4, now).reduce(
    (sum, point) => sum + point.hired,
    0,
  ),
)
const rate = computed(() => hireRate(history.months, department.value))
const hireDays = computed(() => {
  const days = hiresInQuarters(history.hires, department.value, lastFourQuarters).map(
    (hire) => hire.daysToHire,
  )
  const value = median(days)
  return value === null ? null : Math.round(value)
})

const series = computed(() => quarterSeries(history.months, department.value, range.value, now))
const rangeHires = computed(() =>
  hiresInQuarters(
    history.hires,
    department.value,
    series.value.map((point) => point.key),
  ),
)
const hireDepartments = computed(() => {
  if (department.value !== 'all') {
    return [department.value]
  }
  const extra = rangeHires.value
    .map((hire) => hire.department)
    .filter((name) => !departments.value.includes(name))
  return [...departments.value, ...new Set(extra)]
})

const flows = computed(() => filteredBoards.value.map(roleFlow))
const stats = computed(() => (focusBoard.value ? stageStats(focusBoard.value, now) : []))
const slowest = computed(() => slowestStage(stats.value))
const countRows = computed(() =>
  stats.value.map((stat) => ({ name: stat.name, value: stat.count })),
)
const dayRows = computed(() =>
  stats.value.map((stat) => ({
    name: stat.name,
    value: stat.medianDays === null ? null : Math.round(stat.medianDays),
    unit: 'days',
  })),
)

function plural(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`
}

function toggleDepartment(name: string): void {
  department.value = department.value === name ? 'all' : name
}

function onPick(event: Event): void {
  focusBoardId.value = (event.target as HTMLSelectElement).value
}

watch(departments, (names) => {
  if (department.value !== 'all' && !names.includes(department.value)) {
    department.value = 'all'
  }
})

onMounted(() => {
  void history.initialize()
  void activity.loadRecent()
})
</script>

<template>
  <AppShell>
    <v-alert v-if="store.error" class="orbital-alert mb-6" type="error" density="compact">
      {{ store.error }}
    </v-alert>
    <v-alert v-if="history.error" class="orbital-alert mb-6" type="error" density="compact">
      {{ history.error }}
    </v-alert>

    <PageHeader class="ov-header" title="Overview">
      <template #meta>
        <span>
          {{ department === 'all' ? 'All departments' : department }} &middot;
          {{ plural(filteredBoards.length, 'live role') }}, plus history from closed roles
        </span>
      </template>
    </PageHeader>

    <div v-if="!store.boards.length" class="board-empty">
      <h2>No role boards yet.</h2>
      <p>Create your first role board to start tracking applicants and hiring progress.</p>
      <v-btn color="primary" prepend-icon="mdi-plus" to="/boards">Open boards</v-btn>
    </div>

    <div v-else class="ov-page">
      <div class="ov-chips" role="group" aria-label="Department">
        <button
          class="ov-chip"
          type="button"
          :aria-pressed="department === 'all'"
          @click="department = 'all'"
        >
          All departments
        </button>
        <button
          v-for="name in departments"
          :key="name"
          class="ov-chip"
          type="button"
          :aria-pressed="department === name"
          @click="toggleDepartment(name)"
        >
          {{ name }}
        </button>
      </div>

      <div class="ov-kpis">
        <OverviewKpi
          label="Open positions"
          :value="totals.openPositions"
          :meta="`across ${plural(filteredBoards.length, 'role')}`"
          source="live"
        />
        <OverviewKpi
          label="Active applicants"
          :value="totals.active"
          :meta="`in ${plural(filteredBoards.length, 'live role')}`"
          source="live"
        />
        <OverviewKpi
          label="At final stage"
          :value="finalStage"
          meta="waiting on a decision"
          source="live"
        />
        <OverviewKpi
          label="Hired last 4 quarters"
          :value="lastFourHired"
          :meta="`${rate.hired} since records began`"
          source="history"
        />
        <OverviewKpi
          label="Time to a hire"
          :value="hireDays ?? '–'"
          :unit="hireDays === null ? undefined : hireDays === 1 ? 'day' : 'days'"
          meta="median, board opened → hire"
          source="history"
        />
        <OverviewKpi
          label="Hire rate"
          :value="rate.percent === null ? '–' : `${rate.percent}%`"
          :meta="`${rate.hired} hired · ${rate.rejected} rejected`"
          source="history"
        >
          <div
            v-if="rate.hired + rate.rejected > 0"
            class="ov-split"
            role="img"
            :aria-label="`${rate.hired} hired, ${rate.rejected} rejected`"
          >
            <i class="ov-split__hired" :style="{ flex: rate.hired }" />
            <i class="ov-split__rejected" :style="{ flex: rate.rejected }" />
          </div>
        </OverviewKpi>
      </div>

      <div class="ov-grid-2">
        <OverviewPanel
          title="Needs your attention"
          :subtitle="`${plural(attention.length, 'item')}, most urgent first`"
          source="live"
        >
          <AttentionList :items="attention.slice(0, ATTENTION_LIMIT)" :total="attention.length" />
        </OverviewPanel>
        <OverviewPanel title="Latest activity" subtitle="From the audit trail" source="live">
          <p v-if="activity.recentError" class="ov-empty">{{ activity.recentError }}</p>
          <ActivityFeed v-else :events="latestEvents" :boards="filteredBoards" />
        </OverviewPanel>
      </div>

      <OverviewPanel
        title="Roles by deadline"
        subtitle="The line shows how applicants are spread across each board's own stages"
        source="live"
      >
        <RoleDeadlineTable
          :boards="filteredBoards"
          :selected-id="focusBoard?.id ?? null"
          @select="focusBoardId = $event"
        />
      </OverviewPanel>

      <div class="ov-band">
        <h2 class="ov-band__title">Hiring over time</h2>
        <p class="ov-band__text">
          Kept after roles are deleted. Shows
          {{
            range === 4 ? 'the last 4 quarters' : 'every quarter on record, up to the latest 12'
          }}.
        </p>
        <div class="ov-chips" role="group" aria-label="Range">
          <button class="ov-chip" type="button" :aria-pressed="range === 4" @click="range = 4">
            Last 4 quarters
          </button>
          <button class="ov-chip" type="button" :aria-pressed="range === 12" @click="range = 12">
            All on record
          </button>
        </div>
      </div>

      <p v-if="!history.months.length && !history.loading" class="ov-empty">
        History fills in as applicants are hired and rejected.
      </p>
      <template v-else>
        <div class="ov-grid-2 ov-grid-2--even">
          <OverviewPanel
            title="Hired and rejected, per quarter"
            subtitle="Green is hired. Grey is rejected."
            source="history"
          >
            <QuarterChart :points="series" kind="decisions" />
          </OverviewPanel>
          <OverviewPanel
            title="Applicants in, per quarter"
            subtitle="Everyone who applied to any role"
            source="history"
          >
            <QuarterChart :points="series" kind="applicants" />
          </OverviewPanel>
        </div>

        <OverviewPanel
          title="How long hires take"
          :subtitle="`Days from the board opening to the hire. ${hireViewHelp[hireView]}`"
          source="history"
        >
          <div class="ov-chips ov-chips--spaced" role="group" aria-label="Hire time view">
            <button
              v-for="option in hireViews"
              :key="option.value"
              class="ov-chip"
              type="button"
              :aria-pressed="hireView === option.value"
              @click="hireView = option.value"
            >
              {{ option.label }}
            </button>
          </div>
          <HireTimeChart
            :hires="rangeHires"
            :departments="hireDepartments"
            :view="hireView"
            :quarters="series.map((point) => point.key)"
            :partial-key="currentQuarter"
          />
        </OverviewPanel>
      </template>

      <div class="ov-band">
        <h2 class="ov-band__title">One board in focus</h2>
        <p class="ov-band__text">
          Stage-level numbers only make sense inside one board, because every board has its own
          stages.
        </p>
        <label v-if="focusBoard" class="board-sort">
          <span class="meta">Board</span>
          <select class="board-search board-sort__select" :value="focusBoard.id" @change="onPick">
            <option v-for="board in filteredBoards" :key="board.id" :value="board.id">
              {{ board.name }}
            </option>
          </select>
        </label>
      </div>

      <template v-if="focusBoard">
        <OverviewPanel
          title="Applicants in vs decisions made, per role"
          subtitle="Select a role to put it in focus"
          source="live"
        >
          <div class="ov-legend">
            <span class="ov-legend__item">
              <i class="ov-legend__swatch ov-legend__swatch--in" />Applicants in
            </span>
            <span class="ov-legend__item">
              <i class="ov-legend__swatch ov-legend__swatch--hired" />Hired
            </span>
            <span class="ov-legend__item">
              <i class="ov-legend__swatch ov-legend__swatch--rejected" />Rejected
            </span>
            <span class="ov-legend__item">
              <i class="ov-legend__swatch ov-legend__swatch--active" />Still active
            </span>
          </div>
          <FlowRows :rows="flows" :selected-id="focusBoard.id" @select="focusBoardId = $event" />
        </OverviewPanel>

        <div class="ov-grid-2 ov-grid-2--even">
          <OverviewPanel
            title="Where active applicants are"
            :subtitle="`${focusBoard.name} · ${plural(focusBoard.steps.length, 'stage')}`"
            source="live"
          >
            <StageBars :rows="countRows" />
          </OverviewPanel>
          <OverviewPanel
            title="Time in the current stage"
            :subtitle="`Median days, ${focusBoard.name}`"
            source="live"
          >
            <StageBars :rows="dayRows" />
            <p v-if="slowest" class="meta ov-note">
              Slowest stage on this board: <b>{{ slowest.name }}</b
              >, median {{ plural(Math.round(slowest.medianDays as number), 'day') }}.
            </p>
          </OverviewPanel>
        </div>
      </template>
    </div>

    <ChartTooltip />
  </AppShell>
</template>
