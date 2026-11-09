import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import { createVuetify, type ThemeDefinition } from 'vuetify'
import { readStoredTheme } from '@/lib/theme'

const orbitalLight: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#F5F7FA',
    surface: '#FFFFFF',
    'surface-bright': '#FFFFFF',
    'surface-light': '#EEF2F7',
    'surface-variant': '#EEF2F7',
    primary: '#1D4ED8',
    secondary: '#0E8F7E',
    error: '#B42318',
    info: '#1D4ED8',
    success: '#0E8F7E',
    warning: '#B45309',
    'on-background': '#0A1B2E',
    'on-surface': '#0A1B2E',
    'on-primary': '#FFFFFF',
    'on-secondary': '#FFFFFF',
    'on-error': '#FFFFFF',
    'on-info': '#FFFFFF',
    'on-success': '#FFFFFF',
    'on-warning': '#FFFFFF',
    outline: '#D9E1EA',
  },
}

const orbitalDark: ThemeDefinition = {
  dark: true,
  colors: {
    background: '#07111F',
    surface: '#0B1728',
    'surface-bright': '#101F34',
    'surface-light': '#101F34',
    'surface-variant': '#101F34',
    primary: '#60A5FA',
    secondary: '#2DD4BF',
    error: '#FDA4AF',
    info: '#93C5FD',
    success: '#2DD4BF',
    warning: '#FBBF24',
    'on-background': '#EAF1FA',
    'on-surface': '#EAF1FA',
    'on-primary': '#06111F',
    'on-secondary': '#04110F',
    'on-error': '#2A0A0F',
    'on-info': '#06111F',
    'on-success': '#04110F',
    'on-warning': '#1A0E06',
    outline: '#1E3148',
  },
}

export default createVuetify({
  theme: {
    defaultTheme: readStoredTheme(),
    themes: {
      orbitalLight,
      orbitalDark,
    },
  },
  defaults: {
    VBtn: {
      class: 'orbital-btn',
      elevation: 0,
      height: 48,
      rounded: 'lg',
    },
    VTextField: {
      class: 'orbital-field',
      color: 'primary',
      density: 'comfortable',
      rounded: 'lg',
      variant: 'outlined',
    },
    VTextarea: {
      class: 'orbital-field',
      color: 'primary',
      density: 'comfortable',
      rounded: 'lg',
      variant: 'outlined',
    },
    VAlert: {
      class: 'orbital-alert',
      rounded: 'lg',
      variant: 'tonal',
    },
  },
})
