import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

const LETTERS = [...'MeuOsteo']

/** Dark backdrop with moving halos, used by the opening screen and the lock screen. */
export function SplashBackdrop({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        // overflow-clip, not hidden: focusing a field must not scroll the halos out of place.
        'on-dark relative flex min-h-full items-center justify-center overflow-clip px-4 py-10 text-white',
        'bg-[radial-gradient(1200px_700px_at_50%_120%,#1F4FD8_0%,#132A6B_45%,#0A1433_100%)]',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="splash-blob1 absolute -left-[120px] -top-[100px] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(34,195,214,0.45)_0%,rgba(34,195,214,0)_68%)]"
      />
      <div
        aria-hidden="true"
        className="splash-blob2 absolute -right-[140px] top-20 h-[560px] w-[560px] rounded-full bg-[radial-gradient(circle,rgba(59,108,246,0.55)_0%,rgba(59,108,246,0)_68%)]"
      />
      <div
        aria-hidden="true"
        className="splash-blob3 absolute -bottom-[220px] left-[30%] h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(94,234,212,0.3)_0%,rgba(94,234,212,0)_68%)]"
      />
      {children}
    </div>
  )
}

/** Logo that spins in, with two rings, then « MeuOsteo » letter by letter. */
export function SplashBrand({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div className={cn('relative', compact ? 'h-20 w-20' : 'h-28 w-28')}>
        <span
          aria-hidden="true"
          className="splash-ring absolute inset-0 rounded-[34px] border-2 border-[rgba(94,234,212,0.7)]"
        />
        <span
          aria-hidden="true"
          className="splash-ring2 absolute inset-0 rounded-[34px] border-2 border-[rgba(59,108,246,0.7)]"
        />
        <div
          aria-hidden="true"
          className={cn(
            'splash-logo absolute inset-0 flex items-center justify-center rounded-[34px] font-black',
            'bg-[linear-gradient(145deg,#5EEAD4_0%,#22C3D6_35%,#3B6CF6_75%,#1F4FD8_100%)]',
            'shadow-[inset_0_2px_0_rgba(255,255,255,0.5),inset_0_-8px_20px_rgba(10,20,51,0.25),0_30px_60px_-20px_rgba(34,195,214,0.9)]',
            compact ? 'text-[40px]' : 'text-[56px]',
          )}
        >
          M
        </div>
      </div>
      <h1
        className={cn(
          'font-black tracking-[-0.02em] [perspective:400px]',
          compact ? 'text-[34px]' : 'text-[46px]',
        )}
        aria-label="MeuOsteo"
      >
        {LETTERS.map((letter, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn('splash-letter', i >= 3 && 'text-aqua-300')}
            style={{ animationDelay: `${0.55 + i * 0.05}s` }}
          >
            {letter}
          </span>
        ))}
      </h1>
    </>
  )
}
