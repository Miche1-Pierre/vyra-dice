"use client"

import { CameraControls, CameraControlsImpl } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { useExperience } from "@/lib/store"
import {
  LOOK_LIMITS,
  lookBounds,
  overviewPose,
  seatPose,
  standingPose,
  tablePose,
  zonePose,
  type CameraPose,
  type LookKind,
} from "@/lib/venue/camera"
import { toThree, type VenueLayout } from "@/lib/venue/layout"

const { ACTION } = CameraControlsImpl
const INTRO_SECONDS = 8.5
/** Tilt range of the orbit views, from the zenith: never under the floor, never straight down. */
const ORBIT_POLAR: [number, number] = [0.12, Math.PI * 0.47]

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Owns the camera: scripted intro fly-through, then smooth transitions between the overview,
 * a zone, a table and the first-person "seat" view. The overview is free: the buyer turns all
 * the way round, zooms in and pans across the club. From a zone or a table they look around
 * within limits (turn, tilt, a little zoom), without panning.
 */
export function CameraRig({
  layout,
  introStyle = "flight",
  reducedMotion = false,
  onIntroSkipped,
}: {
  layout: VenueLayout
  /** `neon`: no fly-through, the camera holds the overview while the club draws itself. */
  introStyle?: "flight" | "neon"
  /** Cut between viewpoints and skip the fly-through. */
  reducedMotion?: boolean
  onIntroSkipped?: (atMs: number) => void
}) {
  const controls = useRef<CameraControlsImpl>(null)
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const aspect = size.width / Math.max(1, size.height)
  const fovTarget = useRef(45)
  const intro = useRef({ playing: false, start: 0 })

  const view = useExperience((s) => s.view)
  const sceneReady = useExperience((s) => s.sceneReady)
  const focusedZoneId = useExperience((s) => s.focusedZoneId)
  const selectedTableId = useExperience((s) => s.selectedTableId)
  const focusedTicketId = useExperience((s) => s.focusedTicketId)
  const resetNonce = useExperience((s) => s.resetNonce)
  const finishIntro = useExperience((s) => s.finishIntro)

  const portrait = aspect < 0.8
  const introPath = useMemo(() => {
    // fly the authored keyframes, then land exactly on the overview framed for this screen
    const keys = layout.cameras.intro.slice(0, -1)
    const end = overviewPose(layout, portrait ? 0.5 : 1.6)
    const pos = [
      ...keys.map((k) => new THREE.Vector3(...toThree(k.position))),
      new THREE.Vector3(...end.position),
    ]
    const tgt = [
      ...keys.map((k) => new THREE.Vector3(...toThree(k.target))),
      new THREE.Vector3(...end.target),
    ]
    return {
      pos: new THREE.CatmullRomCurve3(pos, false, "centripetal"),
      tgt: new THREE.CatmullRomCurve3(tgt, false, "centripetal"),
    }
  }, [layout, portrait])

  const bounds = useMemo(() => {
    const b = layout.building
    const min = toThree([b.minX - 4, b.maxY + 4, -1])
    const max = toThree([b.maxX + 4, b.minY - 4, layout.heights.ceiling + 6])
    return new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max))
  }, [layout])

  // orbit around the viewpoint's target (overview / zone / table); limits are set per pose.
  // `pan` (the overview, see LOOK_LIMITS): two fingers or the right button move across the club
  // and the wheel zooms where the pointer is
  const configureOrbit = (c: CameraControlsImpl, pan = false) => {
    c.minDistance = 1.5
    c.maxDistance = 110
    c.minPolarAngle = ORBIT_POLAR[0]
    c.maxPolarAngle = ORBIT_POLAR[1]
    c.azimuthRotateSpeed = 0.9
    c.polarRotateSpeed = 0.9
    c.dollySpeed = 0.8
    c.smoothTime = 0.65
    c.draggingSmoothTime = 0.12
    // a zone or a table: zoom towards the subject, never pan away from it
    c.dollyToCursor = pan
    c.mouseButtons.wheel = ACTION.DOLLY
    c.mouseButtons.right = pan ? ACTION.TRUCK : ACTION.NONE
    c.mouseButtons.middle = pan ? ACTION.TRUCK : ACTION.NONE
    c.touches.two = pan ? ACTION.TOUCH_DOLLY_TRUCK : ACTION.TOUCH_DOLLY
    c.touches.three = pan ? ACTION.TOUCH_TRUCK : ACTION.NONE
    // the point looked at stays in the building
    c.setBoundary(bounds)
  }

  // first person: orbit around a point 5 cm in front of the eye = looking around
  const configureSeat = (c: CameraControlsImpl) => {
    c.minDistance = 0
    c.maxDistance = 0.06
    c.minPolarAngle = Math.PI * 0.28
    c.maxPolarAngle = Math.PI * 0.68
    c.azimuthRotateSpeed = -0.32
    c.polarRotateSpeed = -0.32
    c.smoothTime = 0.9
    c.dollyToCursor = false
    c.mouseButtons.wheel = ACTION.NONE
    c.mouseButtons.right = ACTION.NONE
    c.touches.two = ACTION.NONE
    c.setBoundary(undefined)
  }

  const currentPose = useRef<CameraPose | null>(null)

  /**
   * Keep the subject visible next to the UI: above the bottom sheet on phones,
   * left of the floating panel on desktop. Offsets are in camera space (metres).
   */
  const updateFocalOffset = () => {
    const c = controls.current
    const pose = currentPose.current
    if (!c || !pose) return
    const { panel, view: v } = useExperience.getState()
    const dist = Math.hypot(
      pose.position[0] - pose.target[0],
      pose.position[1] - pose.target[1],
      pose.position[2] - pose.target[2],
    )
    const halfV = Math.tan((pose.fov * Math.PI) / 360)
    let ox = 0
    let oy = 0
    if (v !== "seat" && panel !== null) {
      const sideCard = size.width >= 1024 || (size.height < 500 && size.width > size.height)
      if (sideCard) {
        // card on the right (400 px + margin, 340 px on phones held sideways): centre the
        // subject in what is left of the screen
        const cardPx = size.width >= 1024 ? 416 : 348
        ox = dist * halfV * aspect * (cardPx / size.width)
      } else {
        // the bottom sheet covers ~64 % of the screen: centre the subject in the strip above it;
        // camera-controls measures the focal offset in screen space (y down), positive lifts it
        oy = dist * halfV * 0.64
      }
    }
    void c.setFocalOffset(ox, oy, 0, true)
  }

  const apply = (pose: CameraPose, transition: boolean, kind: LookKind, lookDistance?: number) => {
    const c = controls.current
    if (!c) return
    const [px, py, pz] = pose.position
    let [tx, ty, tz] = pose.target
    if (lookDistance !== undefined) {
      const dir = new THREE.Vector3(tx - px, ty - py, tz - pz)
        .normalize()
        .multiplyScalar(lookDistance)
      ;[tx, ty, tz] = [px + dir.x, py + dir.y, pz + dir.z]
    }
    fovTarget.current = pose.fov
    currentPose.current = pose
    void c.setLookAt(px, py, pz, tx, ty, tz, transition && !reducedMotion)
    // look around this viewpoint only (bounds apply to the buyer's gestures, not to this move)
    const look = lookBounds(
      { position: [px, py, pz], target: [tx, ty, tz] },
      LOOK_LIMITS[kind],
      ORBIT_POLAR,
    )
    // the same direction, counted from where the camera faces now: moves never spin the long way
    const shift = 2 * Math.PI * Math.round((c.azimuthAngle - look.azimuth) / (2 * Math.PI))
    c.minAzimuthAngle = look.minAzimuth + shift
    c.maxAzimuthAngle = look.maxAzimuth + shift
    void c.rotateAzimuthTo(look.azimuth + shift, transition && !reducedMotion)
    if (look.minPolar !== null && look.maxPolar !== null) {
      c.minPolarAngle = look.minPolar
      c.maxPolarAngle = look.maxPolar
    }
    if (look.minDistance !== null && look.maxDistance !== null) {
      c.minDistance = look.minDistance
      c.maxDistance = look.maxDistance
    }
    if (reducedMotion) {
      camera.fov = pose.fov
      camera.updateProjectionMatrix()
    }
    updateFocalOffset()
  }

  const panel = useExperience((s) => s.panel)
  useEffect(() => {
    updateFocalOffset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, size.width, size.height])

  // initial placement (before the scene is ready): start of the intro path, or the overview
  // the neon intro draws the club in
  useEffect(() => {
    const c = controls.current
    if (!c) return
    configureOrbit(c)
    if (introStyle === "neon") {
      const pose = overviewPose(layout, aspect)
      void c.setLookAt(...pose.position, ...pose.target, false)
      fovTarget.current = pose.fov
      camera.fov = pose.fov
    } else {
      const p = introPath.pos.getPoint(0)
      const t = introPath.tgt.getPoint(0)
      void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false)
      fovTarget.current = 42
      camera.fov = 42
    }
    camera.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // start the intro once everything is on the GPU (or go straight to the overview)
  useEffect(() => {
    if (sceneReady && view === "intro" && reducedMotion) {
      finishIntro()
      return
    }
    if (sceneReady && view === "intro" && !intro.current.playing) {
      intro.current = { playing: true, start: performance.now() }
      const c = controls.current
      if (c) c.enabled = false
      if (c && introStyle === "neon") {
        // framed for the screen as it is now (the canvas had no size yet at mount)
        const pose = overviewPose(layout, aspect)
        void c.setLookAt(...pose.position, ...pose.target, false)
        fovTarget.current = pose.fov
        camera.fov = pose.fov
        camera.updateProjectionMatrix()
      }
    }
    // the neon intro ends it (NeonIntro); the camera stays on the overview meanwhile
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneReady, view, reducedMotion, finishIntro])

  // any user gesture during the intro skips it (listeners armed only once it plays)
  useEffect(() => {
    if (view !== "intro" || !sceneReady) return
    const skip = () => {
      if (!intro.current.playing) return
      onIntroSkipped?.(Math.round(performance.now() - intro.current.start))
      intro.current.playing = false
      finishIntro()
    }
    window.addEventListener("pointerdown", skip, { once: true })
    window.addEventListener("wheel", skip, { once: true })
    window.addEventListener("keydown", skip, { once: true })
    return () => {
      window.removeEventListener("pointerdown", skip)
      window.removeEventListener("wheel", skip)
      window.removeEventListener("keydown", skip)
    }
  }, [view, sceneReady, finishIntro, onIntroSkipped])

  // react to state changes
  useEffect(() => {
    const c = controls.current
    if (!c || view === "intro") return
    intro.current.playing = false
    c.enabled = true
    if (view === "seat" && selectedTableId) {
      configureSeat(c)
      apply(seatPose(layout, selectedTableId, aspect), true, "seat", 0.05)
    } else if (view === "ticket" && focusedTicketId) {
      // standing among the crowd: look around from the middle of the area
      configureSeat(c)
      apply(standingPose(layout, focusedTicketId, aspect), true, "seat", 0.05)
    } else {
      const [pose, kind]: [CameraPose, LookKind] =
        view === "table" && selectedTableId
          ? [tablePose(layout, selectedTableId, aspect), "table"]
          : view === "zone" && focusedZoneId
            ? [zonePose(layout, focusedZoneId, aspect), "zone"]
            : [overviewPose(layout, aspect), "overview"]
      configureOrbit(c, LOOK_LIMITS[kind].pan)
      apply(pose, true, kind)
    }
    // aspect handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, focusedZoneId, focusedTicketId, selectedTableId, resetNonce, layout])

  // re-frame the overview when the viewport changes shape (rotation, resize)
  useEffect(() => {
    if (view === "overview") apply(overviewPose(layout, aspect), true, "overview")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect < 0.8, aspect < 1.3, aspect >= 1.95])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    if (intro.current.playing && introStyle === "flight") {
      const k = Math.min(1, (performance.now() - intro.current.start) / (INTRO_SECONDS * 1000))
      const e = easeInOut(k)
      const p = introPath.pos.getPoint(e)
      const t = introPath.tgt.getPoint(e)
      void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false)
      fovTarget.current = THREE.MathUtils.lerp(42, overviewPose(layout, aspect).fov, e)
      if (k >= 1) {
        intro.current.playing = false
        finishIntro()
      }
    }
    if (Math.abs(camera.fov - fovTarget.current) > 0.01) {
      camera.fov = THREE.MathUtils.damp(camera.fov, fovTarget.current, 4, delta)
      camera.updateProjectionMatrix()
    }
  })

  return <CameraControls ref={controls} makeDefault />
}
