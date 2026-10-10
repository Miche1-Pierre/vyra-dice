"use client"

import { createContext, useContext } from "react"

import type { ClubBrand } from "@/lib/clubs/brand"

/*
 * How the interface speaks for the club on screen (`brand.json` → `ui`): its tone and the
 * features it offers. The tone also reaches CSS through `data-tone` on the experience root,
 * read by the `sober:` variant.
 */

export type ClubUi = ClubBrand["ui"]

const ClubUiContext = createContext<ClubUi>({ tone: "vivid", compare: true })

export const ClubUiProvider = ClubUiContext.Provider

export function useClubUi(): ClubUi {
  return useContext(ClubUiContext)
}
