export function boulderColorToStyle(color?: string | null): React.CSSProperties {
  if (!color) return {};

  const c = color.toLowerCase();

  // light-mode tints
  const map: Record<string, string> = {
  black:  '#767B7A', // rgba(15,23,42,0.04)
  white:  '#F9F9F9', // rgba(255,255,255,1)

  gray:   '#B9C4C2', // rgba(148,163,184,0.12)
  grey:   '#B9C4C2',

  yellow: '#FEDC63', // rgba(253,224,71,0.18)
  orange: '#FFB144', // rgba(251,146,60,0.18)
  red:    '#DE172A', // rgba(248,113,113,0.18)
  pink:   '#E74EE4', // rgba(244,114,182,0.18)
  purple: '#8865C9', // rgba(192,132,252,0.18)
  blue:   '#1F5FC1', // rgba(96,165,250,0.18)
  green:  '#49C263', // rgba(74,222,128,0.18)

  brown:  '#885337', // rgba(180,140,100,0.16)
};

  return { backgroundColor: map[c] ?? 'rgba(148,163,184,0.10)' };
}
