import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Cpu, ShieldCheck, Zap, Layers, Sparkles } from 'lucide-react';

export const HoloCore3D: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeTelemetry, setActiveTelemetry] = useState<number>(0);

  const telemetryTags = [
    { label: 'Autonomous Discovery', icon: <Sparkles className="w-3.5 h-3.5 text-cyan-400" />, desc: 'Universal schema profiling across 7+ business domains' },
    { label: 'Deterministic Engine', icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />, desc: 'Zero hallucinated values • 100% mathematical auditability' },
    { label: 'Predictive Horizon', icon: <Zap className="w-3.5 h-3.5 text-blue-400" />, desc: 'Dynamic ARIMA, Prophet & Random Forest forecasting' },
    { label: 'Relational Intelligence', icon: <Layers className="w-3.5 h-3.5 text-purple-400" />, desc: 'Multi-table entity resolution & automated join discovery' },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveTelemetry((prev) => (prev + 1) % telemetryTags.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [telemetryTags.length]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 24;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) {
      console.warn('WebGL error in HoloCore3D:', e);
      return;
    }
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Group for the entire 3D interactive core
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // 1. Central Icosahedron Wireframe
    const icoGeo = new THREE.IcosahedronGeometry(4.8, 1);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      wireframe: true,
      roughness: 0.2,
      metalness: 0.8,
    });
    const icosahedron = new THREE.Mesh(icoGeo, icoMat);
    coreGroup.add(icosahedron);

    // 2. Inner Glowing Octahedron Core
    const octGeo = new THREE.OctahedronGeometry(2.6, 0);
    const octMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.6,
      roughness: 0.1,
      metalness: 0.9,
    });
    const octahedron = new THREE.Mesh(octGeo, octMat);
    coreGroup.add(octahedron);

    // 3. Gyroscopic Ring 1
    const ringGeo1 = new THREE.TorusGeometry(7.2, 0.12, 16, 100);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.1,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    coreGroup.add(ring1);

    // 4. Gyroscopic Ring 2
    const ringGeo2 = new THREE.TorusGeometry(8.5, 0.1, 16, 100);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x818cf8,
      emissive: 0x4f46e5,
      emissiveIntensity: 0.3,
      metalness: 0.9,
      roughness: 0.1,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 3;
    ring2.rotation.y = Math.PI / 4;
    coreGroup.add(ring2);

    // 5. Gyroscopic Ring 3 with Outer Nodes
    const ringGeo3 = new THREE.TorusGeometry(9.8, 0.08, 16, 100);
    const ringMat3 = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.25,
      metalness: 0.9,
      roughness: 0.1,
    });
    const ring3 = new THREE.Mesh(ringGeo3, ringMat3);
    ring3.rotation.x = -Math.PI / 4;
    ring3.rotation.z = Math.PI / 6;
    coreGroup.add(ring3);

    // 6. Orbital Data Node Satellites
    const satelliteGroup = new THREE.Group();
    const satGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.9,
    });

    const satellites: THREE.Mesh[] = [];
    const satCount = 6;
    for (let i = 0; i < satCount; i++) {
      const sat = new THREE.Mesh(satGeo, satMat);
      satelliteGroup.add(sat);
      satellites.push(sat);
    }
    coreGroup.add(satelliteGroup);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const pointLight1 = new THREE.PointLight(0x38bdf8, 3, 50);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x818cf8, 2, 50);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    // Interaction Listeners (Drag to rotate)
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      coreGroup.rotation.y += deltaX * 0.008;
      coreGroup.rotation.x += deltaY * 0.008;

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // Animation loop
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Continuous rotations
      if (!isDraggingRef.current) {
        coreGroup.rotation.y += 0.004;
      }
      icosahedron.rotation.x += 0.006;
      icosahedron.rotation.z += 0.004;
      octahedron.rotation.y -= 0.01;
      octahedron.rotation.x -= 0.008;

      ring1.rotation.z += 0.006;
      ring2.rotation.y += 0.008;
      ring3.rotation.x += 0.007;

      // Orbit satellites around rings
      satellites.forEach((sat, i) => {
        const angle = elapsedTime * 0.8 + (i * Math.PI * 2) / satCount;
        const radius = 8.5;
        sat.position.x = Math.cos(angle) * radius;
        sat.position.y = Math.sin(angle) * Math.cos(angle * 0.5) * 4;
        sat.position.z = Math.sin(angle) * radius;
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

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      cancelAnimationFrame(reqId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      resizeObserver.disconnect();

      icoGeo.dispose();
      icoMat.dispose();
      octGeo.dispose();
      octMat.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      ringGeo3.dispose();
      ringMat3.dispose();
      satGeo.dispose();
      satMat.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto flex flex-col items-center justify-center my-4 select-none">
      {/* 3D Canvas Viewport */}
      <div
        ref={mountRef}
        className="w-full h-72 sm:h-84 md:h-96 relative cursor-grab active:cursor-grabbing flex items-center justify-center"
        title="Click and drag to rotate 3D Data Core"
      >
        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 m-auto w-48 h-48 sm:w-64 sm:h-64 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none -z-10 animate-pulse-gentle" />
      </div>

      {/* Floating 3D Telemetry HUD Pill */}
      <div className="relative z-10 -mt-6 sm:-mt-8 px-4 py-2.5 rounded-2xl glass-3d-elevated border border-cyan-500/30 shadow-2xl flex items-center gap-3 max-w-md transition-all duration-300">
        <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
          {telemetryTags[activeTelemetry].icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
              <span>{telemetryTags[activeTelemetry].label}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            </span>
            <span className="text-[10px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
              CORE 3D
            </span>
          </div>
          <p className="text-[11px] text-slate-300 truncate mt-0.5">
            {telemetryTags[activeTelemetry].desc}
          </p>
        </div>
      </div>
      <span className="text-[10px] text-slate-500 mt-2 font-mono flex items-center gap-1">
        <span>Interactive 3D Quantum Core</span> • <span>Drag to Orbit</span>
      </span>
    </div>
  );
};
