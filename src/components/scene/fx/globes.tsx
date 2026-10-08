"use client"

import { useFrame } from "@react-three/fiber"
import { useMemo } from "react"
import * as THREE from "three"

import { createSphereGlowMaterial } from "@/components/scene/fx/materials"
import type { LightShow } from "@/lib/clubs/ambiance"

export interface Globe {
  center: THREE.Vector3
  radius: number
  phase: number
}

/**
 * Recover each globe (centre, radius, phase) from the merged `fx_spheres` meshes: every globe's
 * vertices share one phase in `aData.x`. Positions are dequantised by the node's world matrix.
 */
export function extractGlobes(meshes: THREE.Mesh[]): Globe[] {
  const groups = new Map<number, { sum: THREE.Vector3; n: number; pts: THREE.Vector3[] }>()
  const v = new THREE.Vector3()
  for (const mesh of meshes) {
    const pos = mesh.geometry.getAttribute("position")
    const data = mesh.geometry.getAttribute("aData") ?? mesh.geometry.getAttribute("uv1")
    if (!pos || !data) continue
    mesh.updateWorldMatrix(true, false)
    for (let i = 0; i < pos.count; i++) {
      const key = Math.round(data.getX(i) * 4096)
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld)
      let g = groups.get(key)
      if (!g) {
        g = { sum: new THREE.Vector3(), n: 0, pts: [] }
        groups.set(key, g)
      }
      g.sum.add(v)
      g.n++
      if (g.pts.length < 24) g.pts.push(v.clone())
    }
  }
  return [...groups.entries()].map(([key, g]) => {
    const center = g.sum.divideScalar(g.n)
    const radius = Math.max(...g.pts.map((p) => p.distanceTo(center)))
    return { center, radius, phase: key / 4096 }
  })
}

/** Instanced, camera-facing halos that follow the light show colour of each globe. */
export function GlobeGlow({
  globes,
  show,
  intensity = 1,
}: {
  globes: Globe[]
  show: LightShow
  intensity?: number
}) {
  const { geometry, material } = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = quad.index
    g.setAttribute("position", quad.getAttribute("position"))
    g.setAttribute("uv", quad.getAttribute("uv"))
    g.setAttribute(
      "aCenter",
      new THREE.InstancedBufferAttribute(
        new Float32Array(globes.flatMap((b) => b.center.toArray())),
        3,
      ),
    )
    g.setAttribute(
      "aRadius",
      new THREE.InstancedBufferAttribute(new Float32Array(globes.map((b) => b.radius)), 1),
    )
    g.setAttribute(
      "aPhase",
      new THREE.InstancedBufferAttribute(new Float32Array(globes.map((b) => b.phase)), 1),
    )
    g.instanceCount = globes.length
    const m = createSphereGlowMaterial(show)
    m.uniforms.uIntensity.value *= intensity
    return { geometry: g, material: m }
  }, [globes, show, intensity])

  useFrame((state) => {
    material.uniforms.uTime.value = state.clock.elapsedTime
  })

  if (!globes.length) return null
  return <mesh geometry={geometry} material={material} frustumCulled={false} renderOrder={12} />
}
