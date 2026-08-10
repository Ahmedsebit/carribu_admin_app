import { createTheme, rem } from '@mantine/core';

// Carribu brand theme: road-blue primary with the logo's red as an accent.
// shadows. Kept in its own module so both the app entry point and any
// stand-alone previews can reuse the same look and feel.
const theme = createTheme({
  primaryColor: 'carribu',
  primaryShade: 6,
  defaultRadius: 'md',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  headings: { fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif', fontWeight: '700' },
  colors: {
    // Blue ramp sampled from the Carribu road-mark logo.
    carribu: [
      '#eaf7fb',
      '#d5edf5',
      '#acdbe9',
      '#80c7dc',
      '#5ab6d1',
      '#3da9c9',
      '#217f9f',
      '#196680',
      '#124f65',
      '#0b3849',
    ],
    carribuRed: [
      '#fff0ee',
      '#ffe0dc',
      '#ffc0b8',
      '#f99d91',
      '#ef7c6d',
      '#e86150',
      '#d64535',
      '#b53629',
      '#922b22',
      '#702019',
    ],
    maroon: [
      '#fbeaec',
      '#f4d2d7',
      '#e8a7b0',
      '#da7987',
      '#cf5667',
      '#c44054',
      '#8f2638',
      '#781e2e',
      '#621725',
      '#4b101b',
    ],
  },
  shadows: {
    sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06)',
    md: '0 4px 12px rgba(15, 23, 42, 0.10)',
    lg: '0 10px 25px rgba(15, 23, 42, 0.12)',
  },
  radius: { xs: rem(4), sm: rem(6), md: rem(10), lg: rem(14), xl: rem(20) },
  components: {
    Button: { defaultProps: { radius: 'md', color: 'maroon' } },
    Paper: { defaultProps: { radius: 'md' } },
    Card: { defaultProps: { radius: 'md' } },
    Modal: { defaultProps: { radius: 'md', overlayProps: { backgroundOpacity: 0.55, blur: 2 } } },
    Badge: { defaultProps: { radius: 'sm' } },
  },
});

export default theme;
