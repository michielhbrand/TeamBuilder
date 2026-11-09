<script setup lang="ts">
import ThemeToggle from '@/components/ThemeToggle.vue'
import BrandMark from '@/components/BrandMark.vue'

defineProps<{
  eyebrow: string
  title: string
  subtitle: string
}>()
</script>

<template>
  <div class="orbital-page">
    <div class="orbital-orbit orbital-orbit--a" aria-hidden="true" />
    <div class="orbital-orbit orbital-orbit--b" aria-hidden="true" />

    <header class="page-topbar">
      <BrandMark />
      <div class="topbar-actions">
        <ThemeToggle />
      </div>
    </header>

    <main class="auth-layout">
      <section class="auth-intro" aria-labelledby="auth-title">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1 id="auth-title" class="display-title">{{ title }}</h1>
        <p class="lede">{{ subtitle }}</p>

        <div class="intro-readout" aria-label="Authentication details">
          <div class="readout-cell">
            <span class="mono-label">Auth</span>
            <strong>Supabase</strong>
            <span>Publishable client</span>
          </div>
          <div class="readout-cell">
            <span class="mono-label">Session</span>
            <strong>In-memory</strong>
            <span>Pinia, auto-refreshed</span>
          </div>
          <div class="readout-cell">
            <span class="mono-label">Access</span>
            <strong>Invite only</strong>
            <span>Administrator issued</span>
          </div>
        </div>
      </section>

      <section class="auth-panel">
        <slot />
      </section>
    </main>

    <footer class="page-footer">
      <span>TeamBuilder</span>
      <span>Hiring & Recruitment</span>
      <span>Orbital System</span>
    </footer>
  </div>
</template>
