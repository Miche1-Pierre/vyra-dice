"use client"

import { ArrowRight, FileImage, ImagePlus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useRef, useState, type FormEvent } from "react"

import { cn } from "@/lib/utils"

const field =
  "text-callout text-label placeholder:text-label-3 h-12 w-full rounded-2xl bg-white/[0.06] px-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] outline-none transition-shadow focus:shadow-[inset_0_0_0_1.5px_color-mix(in_srgb,var(--brand)_70%,transparent)]"

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="eyebrow text-label-3">{label}</span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="text-caption text-label-3 mt-1.5 block">{hint}</span> : null}
    </label>
  )
}

export function NewClubForm() {
  const router = useRouter()
  const inputId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generate, setGenerate] = useState(true)

  const add = (list: FileList | null) => {
    if (!list) return
    setFiles((prev) => [
      ...prev,
      ...Array.from(list).filter((f) => /\.(png|jpe?g|webp|gif|pdf)$/i.test(f.name)),
    ])
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const form = new FormData(event.currentTarget)
    form.delete("sources")
    for (const f of files) form.append("sources", f)
    const res = await fetch("/api/clubs", { method: "POST", body: form })
    const data = (await res.json()) as { slug?: string; error?: string }
    if (!res.ok || !data.slug) {
      setError(data.error ?? "Création impossible")
      setBusy(false)
      return
    }
    if (generate) {
      await fetch(`/api/clubs/${data.slug}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "auto" }),
      })
    }
    router.push(`/clubs/${data.slug}`)
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Nom du club">
          <input
            name="name"
            required
            minLength={2}
            maxLength={60}
            placeholder="809 Social Club"
            className={field}
          />
        </Field>
        <Field label="Ville">
          <input
            name="city"
            required
            minLength={2}
            maxLength={60}
            placeholder="Toulon"
            className={field}
          />
        </Field>
        <Field label="Adresse" hint="Facultatif, sinon l'agent n'en invente pas.">
          <input name="address" maxLength={120} placeholder="12 quai…" className={field} />
        </Field>
        <Field label="Soirée de la démo">
          <input name="eventName" maxLength={60} placeholder="Samedi soir" className={field} />
        </Field>
        <Field label="Site web">
          <input name="website" type="url" placeholder="https://" className={field} />
        </Field>
        <Field label="Instagram">
          <input name="instagram" maxLength={31} placeholder="809socialclub" className={field} />
        </Field>
      </div>

      <Field
        label="Brief"
        hint="Ce qui fait le lieu, ce que la démo doit montrer, ce qu'on sait de l'offre."
      >
        <textarea
          name="brief"
          rows={6}
          maxLength={8000}
          placeholder="Club en sous-sol, ambiance tamisée rouge, bar central en marbre, une loge VIP surélevée face au DJ…"
          className={cn(field, "h-auto resize-y py-3 leading-relaxed")}
        />
      </Field>

      <div>
        <span className="eyebrow text-label-3">Photos et plans</span>
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            add(e.dataTransfer.files)
          }}
          className={cn(
            "mt-2 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border border-dashed px-6 py-10 text-center transition-colors",
            drag
              ? "border-brand/70 bg-brand/[0.06]"
              : "border-white/15 bg-white/[0.03] hover:bg-white/[0.05]",
          )}
        >
          <ImagePlus className="text-label-2 size-6" />
          <span className="text-callout text-label">
            Déposer des photos, un croquis ou un plan d&apos;architecte
          </span>
          <span className="text-caption text-label-3">
            PNG, JPG, WebP, PDF · 25 Mo max · gardés sur cette machine
          </span>
          <input
            id={inputId}
            ref={input}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp,.gif,.pdf"
            className="sr-only"
            onChange={(e) => add(e.currentTarget.files)}
          />
        </label>
        {files.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="text-footnote text-label-2 flex items-center gap-2 rounded-full bg-white/[0.07] py-1 pr-1.5 pl-3"
              >
                <FileImage className="size-3.5" /> {f.name}
                <button
                  type="button"
                  aria-label={`Retirer ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))}
                  className="hover:bg-fill grid size-6 place-items-center rounded-full"
                >
                  <X className="size-3" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? <p className="text-footnote text-[#ff6961]">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <label className="text-footnote text-label-2 mr-auto flex items-center gap-2">
          <input
            type="checkbox"
            checked={generate}
            onChange={(e) => setGenerate(e.target.checked)}
            className="accent-[var(--brand)]"
          />
          Lancer la génération complète (de la recherche à l&apos;aperçu)
        </label>
        <button
          type="submit"
          disabled={busy}
          className="brand-pill text-callout inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? "Création…" : "Créer le club"} <ArrowRight className="size-4" />
        </button>
      </div>
    </form>
  )
}
