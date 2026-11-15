import { ref, watch, type Ref } from 'vue'

export function useElementWidth(target: Ref<HTMLElement | null>, fallback = 640): Ref<number> {
  const width = ref(fallback)

  watch(
    target,
    (element, _previous, onCleanup) => {
      if (!element) {
        return
      }
      if (element.clientWidth > 0) {
        width.value = element.clientWidth
      }
      if (typeof ResizeObserver === 'undefined') {
        return
      }
      const observer = new ResizeObserver((entries) => {
        const next = entries[0]?.contentRect.width ?? element.clientWidth
        if (next > 0) {
          width.value = next
        }
      })
      observer.observe(element)
      onCleanup(() => observer.disconnect())
    },
    { immediate: true, flush: 'post' },
  )

  return width
}
