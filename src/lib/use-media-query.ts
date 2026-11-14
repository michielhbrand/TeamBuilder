import { onScopeDispose, ref, type Ref } from 'vue'

export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false)

  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return matches
  }

  const media = window.matchMedia(query)
  const onChange = (event: { matches: boolean }): void => {
    matches.value = event.matches
  }

  matches.value = media.matches
  media.addEventListener('change', onChange)
  onScopeDispose(() => media.removeEventListener('change', onChange))

  return matches
}
