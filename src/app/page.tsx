import Link from "next/link"

export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a1436_0%,#0b0810_55%,#050407_100%)] px-6 py-16">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_90%,rgba(255,47,146,0.18),transparent_45%),radial-gradient(circle_at_15%_75%,rgba(79,124,255,0.16),transparent_40%)]" />
      <div className="relative max-w-2xl text-center">
        <p className="font-mono text-[11px] tracking-[0.35em] text-white/50 uppercase">
          VYRA · visites 3D de clubs
        </p>
        <h1 className="font-heading mt-6 text-4xl leading-[1.05] font-extrabold tracking-tight text-white sm:text-6xl">
          Faites visiter le club avant de vendre la table.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-base text-white/65 sm:text-lg">
          Vos clients explorent la salle en 3D sur leur téléphone, comparent les tables, leur vue et
          leur prix, puis envoient une demande à votre équipe — qui confirme et encaisse comme
          d’habitude.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link
            href="/naho/samedi"
            className="inline-flex h-12 items-center rounded-full bg-white px-7 text-base font-semibold text-black transition hover:bg-white/90"
          >
            Voir la démo — Naho Club
          </Link>
          <p className="text-xs text-white/40">
            Démo de prospection : plan, tables et prix provisoires.
          </p>
        </div>
      </div>
    </main>
  )
}
