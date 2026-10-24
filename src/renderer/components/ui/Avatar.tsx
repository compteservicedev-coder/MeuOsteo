import { initials } from '@shared/domain/text'
import { cn } from '../../lib/cn'

interface AvatarProps {
  prenom: string
  nom: string
  size?: 'sm' | 'md'
  className?: string
}

/** Initials in a soft blue circle (lists, relatives). Decorative: the name is always next to it. */
export function Avatar({ prenom, nom, size = 'md', className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#E8F0FF,#CCDBFF)] font-bold text-royal-700 shadow-[inset_0_1px_0_#FFFFFF,0_3px_8px_-3px_rgba(23,51,143,0.35)]',
        size === 'sm' ? 'h-[34px] w-[34px] text-[12px]' : 'h-9 w-9 text-[13px]',
        className,
      )}
    >
      {initials(prenom, nom)}
    </span>
  )
}
