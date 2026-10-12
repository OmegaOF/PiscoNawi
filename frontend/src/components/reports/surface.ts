import { usePresentation } from '../../contexts/PresentationContext';

/** Clases de superficie según modo normal / presentación. */
export function useSurface() {
  const { active } = usePresentation();
  return {
    dark: active,
    card: active ? 'bg-pres-card border-pres-border text-pres-text' : 'bg-white border-neutral-border text-text-dark',
    title: active ? 'text-pres-text' : 'text-vino',
    text: active ? 'text-pres-text' : 'text-text-dark',
    muted: active ? 'text-pres-muted' : 'text-text-muted',
    subtle: active ? 'bg-white/5' : 'bg-neutral-bg',
    border: active ? 'border-pres-border' : 'border-neutral-border',
    hover: active ? 'hover:bg-white/5' : 'hover:bg-neutral-bg',
    chip: active ? 'bg-white/10 text-pres-text' : 'bg-vino/10 text-vino',
  };
}
