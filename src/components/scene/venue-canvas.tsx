"use client"

import { PerformanceMonitor } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { Component, Suspense, useState, type ReactNode } from "react"

import { ClubEnvironment } from "@/components/scene/club-environment"
import { Effects, type Quality } from "@/components/scene/effects"
import { Backdrop } from "@/components/scene/fx/backdrop"
import { Beams } from "@/components/scene/fx/beams"
import { CameraRig } from "@/components/scene/camera-rig"
import { Markers, type TableMarkerData, type ZoneMarkerData } from "@/components/scene/markers"
import { TableHotspots } from "@/components/scene/table-hotspots"
import { VenueModel } from "@/components/scene/venue-model"
import { ZoneOverlays } from "@/components/scene/zone-overlays"
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

export interface VenueCanvasProps {
  club: string
  layout: VenueLayout
  zoneMarkers: ZoneMarkerData[]
  tableMarkers: TableMarkerData[]
  quality: Quality
  onIntroSkipped?: (atMs: number) => void
}

export default function VenueCanvas({
  club,
  layout,
  zoneMarkers,
  tableMarkers,
  quality,
  onIntroSkipped,
}: VenueCanvasProps) {
  const setFallback2d = useExperience((s) => s.setFallback2d)
  const [dpr, setDpr] = useState(quality === "high" ? 1.75 : 1.25)
  const [effects, setEffects] = useState(true)

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
        <PerformanceMonitor
          bounds={() => (quality === "high" ? [45, 60] : [28, 50])}
          onDecline={() => {
            setDpr((d) => Math.max(0.85, d - 0.25))
            if (dpr <= 1) setEffects(false)
          }}
          onIncline={() => setDpr((d) => Math.min(quality === "high" ? 2 : 1.5, d + 0.25))}
        />
        <Suspense fallback={null}>
          <ClubEnvironment intensity={quality === "high" ? 1 : 0.85} />
          <VenueModel club={club} quality={quality} />
          <Backdrop center={venueCenter(layout)} />
          <Beams layout={layout} intensity={quality === "high" ? 1 : 0.8} />
          <ZoneOverlays layout={layout} />
          <TableHotspots layout={layout} />
          <Markers layout={layout} zones={zoneMarkers} tables={tableMarkers} />
        </Suspense>
        <CameraRig layout={layout} onIntroSkipped={onIntroSkipped} />
        {effects ? <Effects quality={quality} /> : null}
      </Canvas>
    </SceneErrorBoundary>
  )
}
