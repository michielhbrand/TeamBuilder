<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import { darkThemeName, lightThemeName, persistTheme } from '@/lib/theme'

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

function toggle(): void {
  const nextTheme = isDark.value ? lightThemeName : darkThemeName
  theme.global.name.value = nextTheme
  persistTheme(nextTheme)
}
</script>

<template>
  <v-btn
    class="theme-toggle"
    :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
    :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
    color="primary"
    height="38"
    rounded="circle"
    size="small"
    variant="outlined"
    width="38"
    @click="toggle"
  />
</template>
