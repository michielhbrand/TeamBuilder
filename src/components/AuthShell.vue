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
      <BrandMark context="Recruitment platform" />
      <div class="topbar-actions">
        <ThemeToggle />
      </div>
    </header>

    <main class="auth-layout">
      <section class="auth-intro" aria-labelledby="auth-title">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1 id="auth-title" class="display-title">{{ title }}</h1>
        <p class="lede">{{ subtitle }}</p>

        <div class="intro-readout" aria-label="About TeamBuilder">
          <slot name="intro-cells">
            <div class="readout-cell">
              <v-icon icon="mdi-view-column-outline" size="20" />
              <strong>One board per role</strong>
              <span>Every stage in one place</span>
            </div>
            <div class="readout-cell">
              <v-icon icon="mdi-account-group-outline" size="20" />
              <strong>Shared with your team</strong>
              <span>Moves and notes update for everyone</span>
            </div>
            <div class="readout-cell">
              <v-icon icon="mdi-shield-lock-outline" size="20" />
              <strong>Invitation only</strong>
              <span>Accounts are issued by your admin</span>
            </div>
          </slot>
        </div>
      </section>

      <section class="auth-panel">
        <slot />
      </section>
    </main>
  </div>
</template>
