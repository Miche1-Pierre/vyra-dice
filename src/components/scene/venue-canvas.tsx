"use client"

import { PerformanceMonitor } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Component, Suspense, useState, type ReactNode } from "react"

import { ClubEnvironment } from "@/components/scene/club-environment"
import { Effects, type Quality } from "@/components/scene/effects"
import { Backdrop } from "@/components/scene/fx/backdrop"
import { Beams } from "@/components/scene/fx/beams"
import { FloorGloss } from "@/components/scene/fx/floor-gloss"
import { Smoke } from "@/components/scene/fx/smoke"
import { FrozenClock, readFrozenTime } from "@/components/scene/frozen-clock"
import { CameraRig } from "@/components/scene/camera-rig"
import {
  Markers,
  type TableMarkerData,
  type TicketMarkerData,
  type ZoneMarkerData,
} from "@/components/scene/markers"
import { TableHotspots } from "@/components/scene/table-hotspots"
import { VenueModel } from "@/components/scene/venue-model"
import { ZoneOverlays } from "@/components/scene/zone-overlays"
import type { ClubAmbiance } from "@/lib/clubs/ambiance"
import type { AssetManifest } from "@/lib/clubs/assets"
import type { ClubBrand } from "@/lib/clubs/brand"
import { useExperience } from "@/lib/store"
import { venueCenter } from "@/lib/venue/camera"
import type { VenueLayout } from "@/lib/venue/layout"

class SceneErrorBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error("[scene]", error)
    this.props.onError()
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/** Instant of the light show held when the visitor asked for less motion (as in captures). */
const STILL_AT = 12
/** Neon of the intro when the club gives no night colour. */
const NEON = "#ff2a3a"

export interface VenueCanvasProps {
  club: string
  assets: AssetManifest
  ambiance: ClubAmbiance
  /** Tier hues of the club (floor overlays, table halos). */
  tiers: ClubBrand["tiers"]
  layout: VenueLayout
  zoneMarkers: ZoneMarkerData[]
  tableMarkers: TableMarkerData[]
  ticketMarkers?: TicketMarkerData[]
  quality: Quality
  /** Less motion: no fly-through, cuts instead of camera moves, a still light show. */
  reducedMotion?: boolean
  onIntroSkipped?: (atMs: number) => void
}

export default function VenueCanvas({
  club,
  assets,
  ambiance,
  tiers,
  layout,
  zoneMarkers,
  tableMarkers,
  ticketMarkers = [],
  quality,
  reducedMotion = false,
  onIntroSkipped,
}: VenueCanvasProps) {
  const setFallback2d = useExperience((s) => s.setFallback2d)
  // reproducible captures: same instant and same resolution on every load
  const [frozenAt] = useState(readFrozenTime)
  // less motion: the light show, LED rain and beams hold one lit instant
  const stillAt = frozenAt ?? (reducedMotion ? STILL_AT : null)
  const [dpr, setDpr] = useState(quality === "high" ? 1.75 : 1.25)
  const [effects, setEffects] = useState(true)
  // the neon intro draws the club in the dark: no beams nor reflections until it is built
  const neon = ambiance.intro === "neon" && !reducedMotion
  const opening = useExperience((s) => neon && s.view === "intro")
  // night mode, when the club offers it: dark room in one colour, smoke over the floor
  const night = useExperience((s) => (ambiance.night && s.night ? ambiance.night.color : null))

  return (
    <SceneErrorBoundary onError={setFallback2d}>
      <Canvas
        flat
        dpr={dpr}
        gl={{ antialias: false, powerPreference: "high-performance", stencil: false }}
        camera={{ fov: 42, near: 0.1, far: 400, position: [60, 60, 90] }}
        onCreated={({ gl }) => gl.setClearColor("#060408")}
        className="touch-none"
      >
        <color attach="background" args={["#060408"]} />
        <fogExp2 attach="fog" args={["#09050d", 0.0055]} />
        {stillAt !== null ? <FrozenClock at={stillAt} /> : null}
        {frozenAt !== null ? null : (
          <PerformanceMonitor
            bounds={() => (quality === "high" ? [45, 60] : [28, 50])}
            onDecline={() => {
              setDpr((d) => Math.max(0.85, d - 0.25))
              if (dpr <= 1) setEffects(false)
            }}
            onIncline={() => setDpr((d) => Math.min(quality === "high" ? 2 : 1.5, d + 0.25))}
          />
        )}
        <Suspense fallback={null}>
          <ClubEnvironment
            environment={ambiance.environment}
            intensity={quality === "high" ? 1 : 0.85}
          />
          <VenueModel
            club={club}
            assets={assets}
            ambiance={ambiance}
            quality={quality}
            composited={effects || night !== null}
            neon={neon ? (ambiance.night?.color ?? NEON) : undefined}
          />
          {/* hidden, not unmounted, under the neon intro: their shaders compile with the club's */}
          {quality === "high" && effects ? (
            <group visible={!opening}>
              <FloorGloss layout={layout} />
            </group>
          ) : null}
          <Backdrop center={venueCenter(layout)} />
          <group visible={!opening}>
            <Beams
              layout={layout}
              palettes={ambiance.beams.palettes}
              intensity={quality === "high" ? 1 : 0.8}
            />
          </group>
          {ambiance.night ? (
            <Smoke layout={layout} on={night !== null} count={quality === "high" ? 34 : 20} />
          ) : null}
          <ZoneOverlays layout={layout} tiers={tiers} />
          <TableHotspots layout={layout} tiers={tiers} />
          <Markers
            layout={layout}
            zones={zoneMarkers}
            tables={tableMarkers}
            tickets={ticketMarkers}
          />
        </Suspense>
        <CameraRig
          layout={layout}
          introStyle={neon ? "neon" : "flight"}
          reducedMotion={reducedMotion}
          onIntroSkipped={onIntroSkipped}
        />
        {effects || night ? <Effects quality={quality} night={night} lite={!effects} /> : null}
      </Canvas>
    </SceneErrorBoundary>
  )
}
