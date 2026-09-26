import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CohortProfile } from '../../types';
import { RotateCw, ZoomIn, ZoomOut, Play, Pause, Sparkles, Layers } from 'lucide-react';

interface ClusterGalaxy3DProps {
  cohorts: CohortProfile[];
  selectedCohort: CohortProfile | null;
  onSelectCohort: (cohort: CohortProfile) => void;
}

export const ClusterGalaxy3D: React.FC<ClusterGalaxy3DProps> = ({
  cohorts,
  selectedCohort,
  onSelectCohort,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [hoveredCohortName, setHoveredCohortName] = useState<string | null>(null);

  const autoRotateRef = useRef<boolean>(true);
  autoRotateRef.current = autoRotate;

  const cohortColors = [
    { hex: 0x38bdf8, css: '#38bdf8', name: 'Cyan' },     // Cohort 0
    { hex: 0x10b981, css: '#10b981', name: 'Emerald' },  // Cohort 1
    { hex: 0xc084fc, css: '#c084fc', name: 'Purple' },   // Cohort 2
    { hex: 0xf59e0b, css: '#f59e0b', name: 'Amber' },    // Cohort 3
    { hex: 0xf43f5e, css: '#f43f5e', name: 'Rose' },     // Cohort 4
    { hex: 0x6366f1, css: '#6366f1', name: 'Indigo' },   // Cohort 5
  ];

  // Camera reset handler ref
  const resetCameraRef = useRef<() => void>(() => {});
  const zoomInRef = useRef<() => void>(() => {});
  const zoomOutRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = mountRef.current;
    if (!container || cohorts.length === 0) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 30, 95);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.warn('WebGL error in ClusterGalaxy3D:', e);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Main Cluster World Group
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // 3D Grid floor for spatial grounding
    const gridHelper = new THREE.GridHelper(120, 24, 0x1e3a8a, 0x0f172a);
    gridHelper.position.y = -22;
    worldGroup.add(gridHelper);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 40, 30);
    scene.add(dirLight);

    // Centroid mesh references for hover and selection
    const centroidMeshes: Array<{ mesh: THREE.Mesh; cohort: CohortProfile }> = [];
    const disposables: Array<{ dispose: () => void }> = [];

    // Arrange cohorts symmetrically in 3D space
    const numCohorts = cohorts.length;
    const clusterRadius = 38;

    cohorts.forEach((cohort, idx) => {
      const color = cohortColors[idx % cohortColors.length];
      const angle = (idx / numCohorts) * Math.PI * 2;
      const elevation = ((idx % 2 === 0 ? 1 : -1) * 12) + (Math.sin(angle) * 6);

      const centroidX = Math.cos(angle) * clusterRadius;
      const centroidY = elevation;
      const centroidZ = Math.sin(angle) * clusterRadius;

      // 1. Centroid Beacon Mesh (Glowing Octahedron)
      const beaconGeo = new THREE.OctahedronGeometry(3.2, 0);
      const beaconMat = new THREE.MeshStandardMaterial({
        color: color.hex,
        emissive: color.hex,
        emissiveIntensity: 0.7,
        roughness: 0.2,
        metalness: 0.8,
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.set(centroidX, centroidY, centroidZ);
      worldGroup.add(beaconMesh);
      centroidMeshes.push({ mesh: beaconMesh, cohort });
      disposables.push(beaconGeo, beaconMat);

      // Centroid Halo Ring
      const haloGeo = new THREE.TorusGeometry(4.8, 0.12, 16, 50);
      const haloMat = new THREE.MeshBasicMaterial({
        color: color.hex,
        transparent: true,
        opacity: 0.5,
      });
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.set(centroidX, centroidY, centroidZ);
      haloMesh.rotation.x = Math.PI / 2;
      worldGroup.add(haloMesh);
      disposables.push(haloGeo, haloMat);

      // 2. Data Point Cloud around Centroid
      const pointsPerCohort = Math.max(30, Math.min(120, Math.round((cohort.record_percentage / 100) * 200)));
      const pointsGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(pointsPerCohort * 3);

      for (let p = 0; p < pointsPerCohort; p++) {
        // Gaussian-like cluster distribution
        const spread = 12;
        const u = Math.random();
        const v = Math.random();
        const rad = spread * Math.sqrt(-2 * Math.log(u || 0.01));
        const theta = 2 * Math.PI * v;

        positions[p * 3] = centroidX + rad * Math.cos(theta) * 0.7;
        positions[p * 3 + 1] = centroidY + (Math.random() - 0.5) * spread;
        positions[p * 3 + 2] = centroidZ + rad * Math.sin(theta) * 0.7;
      }

      pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // Point material with glowing texture
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const grad = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.4, color.css);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 16);
      }
      const pTexture = new THREE.CanvasTexture(canvas);
      disposables.push(pTexture);

      const pointsMat = new THREE.PointsMaterial({
        size: 3.2,
        map: pTexture,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pointsCloud = new THREE.Points(pointsGeo, pointsMat);
      worldGroup.add(pointsCloud);
      disposables.push(pointsGeo, pointsMat);

      // Vector connecting line to origin
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -22, 0),
        new THREE.Vector3(centroidX, centroidY, centroidZ),
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: color.hex,
        transparent: true,
        opacity: 0.18,
      });
      const line = new THREE.Line(lineGeo, lineMat);
      worldGroup.add(line);
      disposables.push(lineGeo, lineMat);
    });

    // Mouse Controls (Orbit Drag & Zoom)
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let cameraDistance = 95;
    let targetCameraDistance = 95;
    let spherical = { phi: Math.PI / 3, theta: 0 };

    const updateCameraPos = () => {
      camera.position.x = cameraDistance * Math.sin(spherical.phi) * Math.sin(spherical.theta);
      camera.position.y = cameraDistance * Math.cos(spherical.phi);
      camera.position.z = cameraDistance * Math.sin(spherical.phi) * Math.cos(spherical.theta);
      camera.lookAt(0, 0, 0);
    };
    updateCameraPos();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;

      spherical.theta -= dx * 0.008;
      spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi - dy * 0.008));
      updateCameraPos();

      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetCameraDistance = Math.max(35, Math.min(160, targetCameraDistance + e.deltaY * 0.08));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // Buttons API
    resetCameraRef.current = () => {
      spherical = { phi: Math.PI / 3, theta: 0 };
      targetCameraDistance = 95;
      updateCameraPos();
    };
    zoomInRef.current = () => {
      targetCameraDistance = Math.max(35, targetCameraDistance - 15);
    };
    zoomOutRef.current = () => {
      targetCameraDistance = Math.min(160, targetCameraDistance + 15);
    };

    // Animation Loop
    let animId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Smooth camera zoom
      if (Math.abs(cameraDistance - targetCameraDistance) > 0.1) {
        cameraDistance += (targetCameraDistance - cameraDistance) * 0.1;
        updateCameraPos();
      }

      // Auto-rotation
      if (autoRotateRef.current && !isDragging) {
        spherical.theta += 0.003;
        updateCameraPos();
      }

      // Pulse beacon meshes
      centroidMeshes.forEach(({ mesh, cohort }, i) => {
        mesh.rotation.y += 0.015;
        mesh.rotation.x += 0.01;
        const isSelected = selectedCohort?.name === cohort.name;
        const baseScale = isSelected ? 1.35 : 1.0;
        mesh.scale.setScalar(baseScale + Math.sin(clock.getElapsedTime() * 3 + i) * 0.08);
      });

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      resizeObs.disconnect();

      disposables.forEach((d) => d.dispose());
      gridHelper.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [cohorts, selectedCohort]);

  return (
    <div className="relative w-full rounded-2xl glass-3d-elevated border border-slate-700/80 overflow-hidden shadow-2xl select-none">
      {/* 3D Viewport Header */}
      <div className="p-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-950/40 backdrop-blur-md relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
              <span>3D Spatial Cluster Galaxy</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full badge-neon-blue uppercase font-mono">
                WebGL 3D
              </span>
            </h4>
            <p className="text-[11px] text-slate-400">
              Interactive 3D multi-dimensional coordinate projection with real-time orbit controls
            </p>
          </div>
        </div>

        {/* 3D Control Bar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-2 rounded-xl text-xs font-medium border flex items-center gap-1.5 transition ${
              autoRotate
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white'
            }`}
            title={autoRotate ? 'Pause 3D Orbit' : 'Resume 3D Orbit'}
          >
            {autoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="text-[11px] hidden sm:inline">Orbit</span>
          </button>

          <button
            onClick={() => zoomInRef.current()}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => zoomOutRef.current()}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => resetCameraRef.current()}
            className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition flex items-center gap-1"
            title="Reset 3D View"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* 3D Canvas Container */}
      <div
        ref={mountRef}
        className="w-full h-80 sm:h-96 md:h-[440px] relative cursor-grab active:cursor-grabbing"
      >
        {/* Ambient Spatial Center Glow */}
        <div className="absolute inset-0 m-auto w-72 h-72 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      </div>

      {/* Interactive Cohort Selector Strip Overlay */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 text-xs relative z-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400 font-mono text-[11px] mr-1">Select Cohort:</span>
          {cohorts.map((cohort, idx) => {
            const color = cohortColors[idx % cohortColors.length];
            const isSelected = selectedCohort?.name === cohort.name;
            return (
              <button
                key={cohort.name}
                onClick={() => onSelectCohort(cohort)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all duration-200 border ${
                  isSelected
                    ? 'scale-105 shadow-md'
                    : 'opacity-70 hover:opacity-100 hover:scale-102 bg-slate-900/80 border-slate-800'
                }`}
                style={{
                  backgroundColor: isSelected ? `${color.css}22` : undefined,
                  borderColor: isSelected ? color.css : undefined,
                  color: isSelected ? '#ffffff' : color.css,
                  boxShadow: isSelected ? `0 0 15px ${color.css}44` : undefined,
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color.css }}
                />
                <span className="truncate max-w-[140px]">{cohort.name}</span>
                <span className="font-mono text-[10px] text-slate-300">
                  {cohort.record_percentage}%
                </span>
              </button>
            );
          })}
        </div>

        <span className="text-[10px] text-slate-500 font-mono hidden md:inline">
          Drag to Rotate • Scroll to Zoom
        </span>
      </div>
    </div>
  );
};
