import { z } from "zod"

import { SLUG } from "@studio/lib/paths"

/** What we know when we start a club: identity, public links and our brief. */
export const briefSchema = z.object({
  slug: z.string().regex(SLUG, { error: "Slug : minuscules, chiffres et tirets" }),
  name: z.string().trim().min(2, { error: "Nom du club requis" }).max(60),
  city: z.string().trim().min(2, { error: "Ville requise" }).max(60),
  address: z.string().trim().max(120).optional(),
  links: z.object({
    website: z.url({ error: "Lien invalide" }).optional(),
    instagram: z
      .string()
      .regex(/^[A-Za-z0-9._]{1,30}$/, { error: "Identifiant Instagram sans @" })
      .optional(),
    other: z.array(z.url()).max(10).default([]),
  }),
  /** Free text: what the club is like, what to show, what to stress. */
  brief: z.string().trim().max(8000).default(""),
  /** The night the demo sells. */
  event: z.object({
    name: z.string().trim().min(2).max(60).default("Samedi soir"),
    slug: z.string().regex(SLUG).default("samedi"),
  }),
  createdAt: z.iso.datetime(),
})
export type Brief = z.infer<typeof briefSchema>

/** `Le Club 809` → `le-club-809` */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
}
