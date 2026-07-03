/** Wind Win palette — single dark theme tuned for outdoor glanceability. */
export const colors = {
  background: '#0B1220',
  card: '#151E30',
  cardBorder: '#24304A',
  text: '#E8EEF9',
  textDim: '#8FA0BC',
  accent: '#4DA3FF',
  green: '#3DDC84',
  red: '#FF5A5F',
  yellow: '#FFC857',
  strava: '#FC4C02',
  north: '#FF5A5F',
};

export const badgeStyles = {
  strong: { label: 'Strong tailwind', emoji: '🟢', color: colors.green },
  tail: { label: 'Tailwind', emoji: '🟢', color: colors.green },
  neutral: { label: 'Neutral / crosswind', emoji: '⚪', color: colors.textDim },
  head: { label: 'Headwind', emoji: '🔴', color: colors.red },
} as const;
