"use client"

import { CameraControls, CameraControlsImpl } from "@react-three/drei"
import { useFrame, useThree } from "@react-three/fiber"
import { useEffect, useMemo, useRef } from "react"
import * as THREE from "three"

import { useExperience } from "@/lib/store"
import { overviewPose, seatPose, tablePose, zonePose, type CameraPose } from "@/lib/venue/camera"
import { toThree, type VenueLayout } from "@/lib/venue/layout"

const { ACTION } = CameraControlsImpl
const INTRO_SECONDS = 8.5

function easeInOut(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

/**
 * Owns the camera: scripted intro fly-through, then smooth transitions between the overview,
 * a zone, a table and the first-person "seat" view. User input is free in every state.
 */
export function CameraRig({
  layout,
  onIntroSkipped,
}: {
  layout: VenueLayout
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

  // free-orbit defaults (overview / zone / table)
  const configureOrbit = (c: CameraControlsImpl) => {
    c.minDistance = 1.5
    c.maxDistance = 110
    c.minPolarAngle = 0.12
    c.maxPolarAngle = Math.PI * 0.47
    c.azimuthRotateSpeed = 0.9
    c.polarRotateSpeed = 0.9
    c.dollySpeed = 0.8
    c.truckSpeed = 1.6
    c.smoothTime = 0.65
    c.draggingSmoothTime = 0.12
    c.dollyToCursor = true
    c.mouseButtons.wheel = ACTION.DOLLY
    c.mouseButtons.right = ACTION.TRUCK
    c.touches.two = ACTION.TOUCH_DOLLY_TRUCK
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
      if (size.width < 1024) oy = -dist * halfV * 0.55
      else ox = dist * halfV * aspect * 0.3
    }
    void c.setFocalOffset(ox, oy, 0, true)
  }

  const apply = (pose: CameraPose, transition: boolean, lookDistance?: number) => {
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
    void c.setLookAt(px, py, pz, tx, ty, tz, transition)
    updateFocalOffset()
  }

  const panel = useExperience((s) => s.panel)
  useEffect(() => {
    updateFocalOffset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, size.width, size.height])

  // initial placement (before the scene is ready): start of the intro path
  useEffect(() => {
    const c = controls.current
    if (!c) return
    configureOrbit(c)
    const p = introPath.pos.getPoint(0)
    const t = introPath.tgt.getPoint(0)
    void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false)
    fovTarget.current = 42
    camera.fov = 42
    camera.updateProjectionMatrix()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // start the intro once everything is on the GPU
  useEffect(() => {
    if (sceneReady && view === "intro" && !intro.current.playing) {
      intro.current = { playing: true, start: performance.now() }
      if (controls.current) controls.current.enabled = false
    }
  }, [sceneReady, view])

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
    c.enabled = true
    if (view === "seat" && selectedTableId) {
      configureSeat(c)
      apply(seatPose(layout, selectedTableId, aspect), true, 0.05)
    } else {
      configureOrbit(c)
      if (view === "table" && selectedTableId)
        apply(tablePose(layout, selectedTableId, aspect), true)
      else if (view === "zone" && focusedZoneId)
        apply(zonePose(layout, focusedZoneId, aspect), true)
      else apply(overviewPose(layout, aspect), true)
    }
    // aspect handled separately below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, focusedZoneId, selectedTableId, resetNonce, layout])

  // re-frame the overview when the viewport changes shape (rotation, resize)
  useEffect(() => {
    if (view === "overview") apply(overviewPose(layout, aspect), true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect < 0.8, aspect < 1.3])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    if (intro.current.playing) {
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
