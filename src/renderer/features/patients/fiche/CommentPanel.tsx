import { motion } from 'framer-motion'
import { useEffect, useId, useRef, useState } from 'react'
import { formatDateTimeFr } from '@shared/domain/dates'
import { Icon } from '../../../components/ui/Icon'
import { Spinner } from '../../../components/ui/Spinner'
import { staggerItem } from '../../../lib/motion'

/** Saved 800 ms after the last keystroke (SPEC §5.4). */
export const COMMENT_AUTOSAVE_MS = 800

interface CommentPanelProps {
  patientId: string
  sexe: 'F' | 'M' | null
  initialComment: string
  initialUpdatedAt: string | null
  initialTags: string[]
}

/** « Commentaire inter-séances » and important history tags (right column). */
export function CommentPanel({ patientId, sexe, initialComment, initialUpdatedAt, initialTags }: CommentPanelProps) {
  const [text, setText] = useState(initialComment)
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt)
  const [saving, setSaving] = useState(false)
  const [tags, setTags] = useState(initialTags)
  const [newTag, setNewTag] = useState('')
  const pending = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const tagInputId = useId()

  const flush = () => {
    window.clearTimeout(timer.current)
    const value = pending.current
    if (value === null) return
    pending.current = null
    setSaving(true)
    void window.api.patients.setComment(patientId, value).then((r) => {
      setSaving(false)
      if (r) setUpdatedAt(r.updatedAt)
    })
  }

  // Nothing typed is lost when leaving the record.
  useEffect(() => () => flush(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const onChange = (value: string) => {
    setText(value)
    pending.current = value
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(flush, COMMENT_AUTOSAVE_MS)
  }

  const saveTags = (next: string[]) => {
    setTags(next)
    void window.api.patients.setAntecedents(patientId, next).then(setTags)
  }

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag) return
    setNewTag('')
    if (!tags.includes(tag)) saveTags([...tags, tag])
  }

  return (
    <motion.aside
      variants={staggerItem}
      aria-labelledby="h-com"
      className="flex min-w-0 flex-[1_1_250px] flex-col gap-3 rounded-card-lg border border-[rgba(15,76,69,0.1)] bg-[linear-gradient(180deg,#F4FEFB_0%,#E3FAF5_100%)] p-[18px] shadow-[inset_0_1px_0_#FFFFFF,0_18px_40px_-22px_rgba(15,76,69,0.45)]"
    >
      <div className="flex items-center gap-2.5">
        <div
          aria-hidden="true"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-control bg-[linear-gradient(145deg,#5EEAD4,#0EA5C6)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_8px_16px_-8px_rgba(14,165,198,0.9)]"
        >
          <Icon name="comment" size={18} />
        </div>
        <div>
          <h2 id="h-com" className="text-[16px] font-extrabold text-aqua-ink">
            Commentaire inter-séances
          </h2>
          <p className="mt-px text-[12px] text-[#2F6B63]">
            Suit {sexe === 'M' ? 'le patient' : sexe === 'F' ? 'la patiente' : 'la personne'} d’une séance à l’autre
          </p>
        </div>
      </div>
      <label htmlFor="commentaire" className="sr-only">
        Commentaire inter-séances
      </label>
      <textarea
        id="commentaire"
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={flush}
        className="field min-h-[340px] grow resize-y rounded-[14px] border-[rgba(15,76,69,0.16)] bg-white/75 px-3.5 py-3 text-[14px] leading-relaxed focus:!border-cyan-500 focus:!shadow-[0_0_0_4px_rgba(14,165,198,0.18)]"
      />
      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#2F6B63]">Antécédents importants</span>
        <ul className="flex flex-wrap gap-1.5" aria-label="Antécédents importants">
          {tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-1 rounded-pill bg-white/80 py-0.5 pl-2.5 pr-0.5 text-[12px] font-bold text-aqua-ink shadow-[inset_0_0_0_1px_rgba(15,76,69,0.14)]"
            >
              {tag}
              <button
                type="button"
                aria-label={`Retirer ${tag}`}
                onClick={() => saveTags(tags.filter((t) => t !== tag))}
                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-aqua-50"
              >
                <Icon name="close" size={12} strokeWidth={2.6} />
              </button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <label htmlFor={tagInputId} className="sr-only">
            Ajouter un antécédent
          </label>
          <input
            id={tagInputId}
            value={newTag}
            onChange={(e) => setNewTag(e.target.value.slice(0, 60))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
            placeholder="Ajouter un antécédent…"
            className="field min-h-[44px] min-w-0 grow rounded-[11px] border-[rgba(15,76,69,0.16)] bg-white/75 text-[13px]"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={!newTag.trim()}
            aria-label="Ajouter l’antécédent"
            className="btn btn-secondary btn-ink h-11 w-11 px-0"
          >
            <Icon name="plus" size={16} strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-[#2F6B63]" aria-live="polite">
        {saving && <Spinner />}
        {saving
          ? 'Enregistrement…'
          : updatedAt
            ? `Modifié le ${formatDateTimeFr(new Date(updatedAt))} · enregistré automatiquement`
            : 'Enregistré automatiquement'}
      </p>
    </motion.aside>
  )
}
