import React from "react";
import * as THREE from "three";
import { useEffect, useRef } from "react";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { createNoise2D } from "simplex-noise";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export default function App(): JSX.Element {
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 200, 800);

    const camera = new THREE.PerspectiveCamera(
      65,
      el.clientWidth / el.clientHeight,
      0.1,
      2000
    );
    camera.position.set(0, 150, 300);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.0);
    sun.position.set(200, 300, 100);
    scene.add(sun);
    scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c3f, 0.8));

    const TERRAIN_SIZE: number = 1000;
    const MAX_HEIGHT: number   = 80;

    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, 100, 100);
    terrainGeo.rotateX(-Math.PI / 2);

    const terrain = new THREE.Mesh(
      terrainGeo,
      new THREE.MeshLambertMaterial({ vertexColors: true })
    );
    scene.add(terrain);

    const terrainNoise = createNoise2D();
    const densityNoise = createNoise2D();

    const positions = terrainGeo.attributes.position as THREE.BufferAttribute;

    for (let i = 0; i < positions.count; i++) {
      const x  = positions.getX(i);
      const z  = positions.getZ(i);
      const nx = x / TERRAIN_SIZE;
      const nz = z / TERRAIN_SIZE;
      positions.setY(i, (
        terrainNoise(nx * 2,  nz * 2)  * 0.60 +
        terrainNoise(nx * 5,  nz * 5)  * 0.25 +
        terrainNoise(nx * 12, nz * 12) * 0.15
      ) * MAX_HEIGHT);
    }

    positions.needsUpdate = true;
    terrainGeo.computeVertexNormals();

    const colors = new Float32Array(positions.count * 3);
    const col    = new THREE.Color();

    for (let i = 0; i < positions.count; i++) {
      const t = positions.getY(i) / MAX_HEIGHT;
      if      (t < 0.0) col.setHSL(0.32, 0.40, 0.15);
      else if (t < 0.3) col.setHSL(0.33, 0.55, 0.20);
      else if (t < 0.6) col.setHSL(0.30, 0.45, 0.28);
      else if (t < 0.8) col.setHSL(0.27, 0.35, 0.35);
      else               col.setHSL(0.24, 0.20, 0.50);
      colors[i * 3]     = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    terrainGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

    const getTerrainHeight = (x: number, z: number): number => {
      const nx = x / TERRAIN_SIZE;
      const nz = z / TERRAIN_SIZE;
      return (
        terrainNoise(nx * 2,  nz * 2)  * 0.60 +
        terrainNoise(nx * 5,  nz * 5)  * 0.25 +
        terrainNoise(nx * 12, nz * 12) * 0.15
      ) * MAX_HEIGHT;
    };

    const TREE_COUNT: number = 10000;

    const trunkMesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.5, 0.8, 4, 8),
      new THREE.MeshLambertMaterial({ color: 0x3b2508 }),
      TREE_COUNT
    );

    const c1 = new THREE.ConeGeometry(6,   7, 8);
    const c2 = new THREE.ConeGeometry(4.5, 6, 8);
    const c3 = new THREE.ConeGeometry(3,   5, 8);
    c1.translate(0, 6,  0);
    c2.translate(0, 10, 0);
    c3.translate(0, 14, 0);

    const canopyMesh = new THREE.InstancedMesh(
      mergeGeometries([c1, c2, c3]),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      TREE_COUNT
    );

    scene.add(trunkMesh);
    scene.add(canopyMesh);

    const matrix     = new THREE.Matrix4();
    const position   = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const rotation   = new THREE.Euler();
    const scale      = new THREE.Vector3();
    const color      = new THREE.Color();

    let placed: number = 0;

    for (let i = 0; i < TREE_COUNT; i++) {
      const x = (Math.random() - 0.5) * TERRAIN_SIZE;
      const z = (Math.random() - 0.5) * TERRAIN_SIZE;

      const dn = densityNoise(x / TERRAIN_SIZE * 3, z / TERRAIN_SIZE * 3);
      if (dn < 0.1) continue;

      const y = getTerrainHeight(x, z);

      position.set(x, y, z);
      rotation.set(0, Math.random() * Math.PI * 2, 0);
      quaternion.setFromEuler(rotation);

      const sw = 0.4 + Math.random() * 0.8;
      const sh = 0.6 + Math.random() * 1.2;
      scale.set(sw, sh, sw);

      matrix.compose(position, quaternion, scale);
      trunkMesh.setMatrixAt(placed, matrix);
      canopyMesh.setMatrixAt(placed, matrix);

      const isDark: boolean = Math.random() > 0.4;
      color.setHSL(
        0.28 + Math.random() * 0.10,
        isDark ? 0.60 : 0.45,
        isDark ? 0.12 + Math.random() * 0.08 : 0.22 + Math.random() * 0.10
      );
      canopyMesh.setColorAt(placed, color);

      placed++;
      if (placed >= TREE_COUNT) break;
    }

    trunkMesh.instanceMatrix.needsUpdate  = true;
    canopyMesh.instanceMatrix.needsUpdate = true;
    if (canopyMesh.instanceColor) canopyMesh.instanceColor.needsUpdate = true;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(el.clientWidth, el.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    el.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.minDistance   = 10;
    controls.maxDistance   = 800;

    const handleResize = (): void => {
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    let frameId: number;
    const animate = (): void => {
      frameId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={canvasRef} style={{ width: "100vw", height: "100vh" }} />;
}