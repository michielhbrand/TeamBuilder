<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useTheme } from 'vuetify'

const STORAGE_KEY = 'orbital-theme'
const theme = useTheme()
const isDark = ref(false)

function toggle(): void {
  const nextTheme = isDark.value ? 'orbitalLight' : 'orbitalDark'
  isDark.value = !isDark.value
  theme.global.name.value = nextTheme
  localStorage.setItem(STORAGE_KEY, nextTheme)
}

onMounted(() => {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'dark') {
    isDark.value = true
  }
  theme.global.name.value = isDark.value ? 'orbitalDark' : 'orbitalLight'
})
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
