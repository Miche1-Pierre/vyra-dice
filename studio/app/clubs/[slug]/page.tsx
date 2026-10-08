import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { Workspace } from "@studio/components/workspace"
import { clubDetail } from "@studio/lib/detail"
import { listClubSlugs } from "@studio/lib/state"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: slug }
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!listClubSlugs().includes(slug)) notFound()
  return <Workspace initial={clubDetail(slug)} />
}
