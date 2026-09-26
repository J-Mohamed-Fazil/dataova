import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DataGalaxy3DProps {
  className?: string;
  particleCount?: number;
  interactive?: boolean;
}

export const DataGalaxy3D: React.FC<DataGalaxy3DProps> = ({
  className = '',
  particleCount = 180,
  interactive = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 180;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.warn('WebGL not supported for DataGalaxy3D:', e);
      return;
    }

    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    container.appendChild(renderer.domElement);

    // Particle nodes
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleVelocities: THREE.Vector3[] = [];

    // Color palette: Cyan, Royal Blue, Violet, Ice White
    const colorChoices = [
      new THREE.Color(0x38bdf8), // Cyan
      new THREE.Color(0x3b82f6), // Blue
      new THREE.Color(0x818cf8), // Indigo
      new THREE.Color(0xc084fc), // Purple
      new THREE.Color(0xffffff), // White
    ];

    for (let i = 0; i < particleCount; i++) {
      const x = (Math.random() - 0.5) * 260;
      const y = (Math.random() - 0.5) * 200;
      const z = (Math.random() - 0.5) * 180;

      particlePositions[i * 3] = x;
      particlePositions[i * 3 + 1] = y;
      particlePositions[i * 3 + 2] = z;

      const chosenColor = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      particleColors[i * 3] = chosenColor.r;
      particleColors[i * 3 + 1] = chosenColor.g;
      particleColors[i * 3 + 2] = chosenColor.b;

      particleVelocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15,
          (Math.random() - 0.5) * 0.15
        )
      );
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Particle texture creation (soft glowing radial sphere)
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(96, 165, 250, 0.8)');
      gradient.addColorStop(0.7, 'rgba(59, 130, 246, 0.2)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const particleMaterial = new THREE.PointsMaterial({
      size: 4.5,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeometry, particleMaterial);
    scene.add(particles);

    // Neural linkage line segments
    const maxConnections = particleCount * 4;
    const linePositions = new Float32Array(maxConnections * 6);
    const lineColors = new Float32Array(maxConnections * 6);

    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(lines);

    // Outer 3D Gyroscopic Rings
    const ringGroup = new THREE.Group();
    const ringGeo1 = new THREE.TorusGeometry(85, 0.4, 16, 100);
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
      wireframe: true,
    });
    const ring1 = new THREE.Mesh(ringGeo1, ringMat1);
    ringGroup.add(ring1);

    const ringGeo2 = new THREE.TorusGeometry(105, 0.3, 16, 100);
    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x6366f1,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    });
    const ring2 = new THREE.Mesh(ringGeo2, ringMat2);
    ring2.rotation.x = Math.PI / 3;
    ringGroup.add(ring2);

    scene.add(ringGroup);

    // Mouse Parallax
    let targetMouseX = 0;
    let targetMouseY = 0;
    let mouseX = 0;
    let mouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      targetMouseX = (e.clientX / window.innerWidth - 0.5) * 35;
      targetMouseY = (e.clientY / window.innerHeight - 0.5) * 25;
    };

    if (interactive) {
      window.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    // Resize Observer
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation Loop
    let animationFrameId: number;
    const connectionDist = 48;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Smooth camera interpolation
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;
      camera.position.x = mouseX;
      camera.position.y = -mouseY;
      camera.lookAt(0, 0, 0);

      // Rotate group & rings
      ringGroup.rotation.y += 0.002;
      ringGroup.rotation.x += 0.001;
      particles.rotation.y += 0.0008;

      // Update particle positions
      const positions = particleGeometry.attributes.position.array as Float32Array;
      let lineIndex = 0;

      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        positions[idx] += particleVelocities[i].x;
        positions[idx + 1] += particleVelocities[i].y;
        positions[idx + 2] += particleVelocities[i].z;

        // Bounce boundaries
        if (Math.abs(positions[idx]) > 140) particleVelocities[i].x *= -1;
        if (Math.abs(positions[idx + 1]) > 110) particleVelocities[i].y *= -1;
        if (Math.abs(positions[idx + 2]) > 100) particleVelocities[i].z *= -1;

        // Connect nearby nodes
        for (let j = i + 1; j < particleCount; j++) {
          const jdx = j * 3;
          const dx = positions[idx] - positions[jdx];
          const dy = positions[idx + 1] - positions[jdx + 1];
          const dz = positions[idx + 2] - positions[jdx + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist && lineIndex < maxConnections) {
            const alpha = 1 - dist / connectionDist;
            const lIdx = lineIndex * 6;

            linePositions[lIdx] = positions[idx];
            linePositions[lIdx + 1] = positions[idx + 1];
            linePositions[lIdx + 2] = positions[idx + 2];
            linePositions[lIdx + 3] = positions[jdx];
            linePositions[lIdx + 4] = positions[jdx + 1];
            linePositions[lIdx + 5] = positions[jdx + 2];

            // Color gradient along line
            lineColors[lIdx] = 0.22 * alpha;
            lineColors[lIdx + 1] = 0.65 * alpha;
            lineColors[lIdx + 2] = 0.95 * alpha;
            lineColors[lIdx + 3] = 0.35 * alpha;
            lineColors[lIdx + 4] = 0.45 * alpha;
            lineColors[lIdx + 5] = 0.95 * alpha;

            lineIndex++;
          }
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;

      // Reset remaining line slots
      for (let i = lineIndex * 6; i < linePositions.length; i++) {
        linePositions[i] = 0;
        lineColors[i] = 0;
      }
      lineGeometry.setDrawRange(0, lineIndex * 2);
      lineGeometry.attributes.position.needsUpdate = true;
      lineGeometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId);
      if (interactive) {
        window.removeEventListener('mousemove', handleMouseMove);
      }
      resizeObserver.disconnect();

      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      ringGeo1.dispose();
      ringMat1.dispose();
      ringGeo2.dispose();
      ringMat2.dispose();
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [particleCount, interactive]);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
    />
  );
};
