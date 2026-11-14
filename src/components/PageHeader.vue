<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>

<template>
  <header class="page-header">
    <div v-if="$slots.breadcrumb" class="page-header__breadcrumb">
      <slot name="breadcrumb" />
    </div>

    <div class="page-header__row">
      <div class="page-header__main">
        <div class="page-header__title-row">
          <h1 class="page-title">{{ title }}</h1>
          <slot name="title-adornment" />
        </div>
        <div v-if="$slots.meta" class="page-header__meta">
          <slot name="meta" />
        </div>
      </div>

      <div v-if="$slots.actions" class="page-header__actions">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
