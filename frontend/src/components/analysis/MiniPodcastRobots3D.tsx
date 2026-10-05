import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

interface MiniPodcastRobots3DProps {
  isLunaSpeaking: boolean;
  isNovaSpeaking: boolean;
  isPlaying: boolean;
  volume: number;
  isMuted: boolean;
  onRobotClick?: (who: 'luna' | 'nova') => void;
  className?: string;
}

export const MiniPodcastRobots3D: React.FC<MiniPodcastRobots3DProps> = ({
  isLunaSpeaking,
  isNovaSpeaking,
  isPlaying,
  volume,
  isMuted,
  onRobotClick,
  className = '',
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // Fun reaction spins on click
  const lunaSpinRef = useRef({ active: false, progress: 0 });
  const novaSpinRef = useRef({ active: false, progress: 0 });

  // State refs for animation loop
  const isLunaSpeakingRef = useRef(isLunaSpeaking);
  const isNovaSpeakingRef = useRef(isNovaSpeaking);
  const isPlayingRef = useRef(isPlaying);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);

  useEffect(() => { isLunaSpeakingRef.current = isLunaSpeaking; }, [isLunaSpeaking]);
  useEffect(() => { isNovaSpeakingRef.current = isNovaSpeaking; }, [isNovaSpeaking]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.targetX = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 0.35;
    mouseRef.current.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1) * 0.25;
  }, []);

  const handlePointerLeave = useCallback(() => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  }, []);

  const handlePointerClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;

    if (clickX < 0.48) {
      if (!lunaSpinRef.current.active) {
        lunaSpinRef.current.active = true;
        lunaSpinRef.current.progress = 0;
      }
      onRobotClick?.('luna');
    } else if (clickX > 0.52) {
      if (!novaSpinRef.current.active) {
        novaSpinRef.current.active = true;
        novaSpinRef.current.progress = 0;
      }
      onRobotClick?.('nova');
    }
  }, [onRobotClick]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || 700;
    const H = container.clientHeight || 280;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.30;
    container.appendChild(renderer.domElement);

    // ── Scene & Camera ───────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
    camera.position.set(0, 0.35, 4.6);
    camera.lookAt(0, 0.10, 0);

    // ── Rich Studio Materials (Luminous & Warm) ──────────────────
    // Luna: Smooth glossy pearl white + pastel lilac + gold
    const lunaBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.18,
      metalness: 0.20,
    });
    const lunaAccentMat = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      roughness: 0.22,
      metalness: 0.35,
    });
    const lunaGoldMat = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      roughness: 0.12,
      metalness: 0.90,
      emissive: 0xfacc15,
      emissiveIntensity: 0.50,
    });
    const lunaVisorMat = new THREE.MeshStandardMaterial({
      color: 0x070414,
      roughness: 0.05,
      metalness: 0.60,
    });

    // Nova: Deep sapphire obsidian + cobalt + cyan
    const novaBodyMat = new THREE.MeshStandardMaterial({
      color: 0x0b1736,
      roughness: 0.18,
      metalness: 0.70,
    });
    const novaAccentMat = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      roughness: 0.22,
      metalness: 0.55,
    });
    const novaVisorMat = new THREE.MeshStandardMaterial({
      color: 0x020718,
      roughness: 0.05,
      metalness: 0.60,
    });

    // Studio Set Materials (Vibrant & Warm instead of flat black!)
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.08,
      metalness: 0.95,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.25,
      metalness: 0.85,
    });

    // Studio Back Wall: Warm Slate-Navy Acoustic Material
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x16223d,
      roughness: 0.75,
      metalness: 0.25,
    });
    const slatMat = new THREE.MeshStandardMaterial({
      color: 0x1f3054,
      roughness: 0.60,
      metalness: 0.35,
    });

    // Studio Floor: Clean Reflective Dark Indigo Stage
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f1a30,
      roughness: 0.30,
      metalness: 0.60,
    });

    // Broadcast Desk Top: Luminous Smoked Blue Glass
    const deskTopMat = new THREE.MeshStandardMaterial({
      color: 0x14254b,
      roughness: 0.12,
      metalness: 0.75,
    });

    // Chairs (Rich Royal Purple and Deep Cobalt Blue)
    const chairLunaMat = new THREE.MeshStandardMaterial({
      color: 0x3b156b,
      roughness: 0.45,
      metalness: 0.30,
    });
    const chairNovaMat = new THREE.MeshStandardMaterial({
      color: 0x162c5b,
      roughness: 0.45,
      metalness: 0.30,
    });

    // Headsets
    const headsetBandMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.25,
      metalness: 0.85,
    });
    const headsetCushionMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.60,
      metalness: 0.15,
    });

    // Glowing Colors
    const cyanGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const fuchsiaGlowMat = new THREE.MeshBasicMaterial({ color: 0xd946ef });
    const amberGlowMat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });

    // ── High-Res Face Canvas Textures (100% Transparent) ─────────
    const S = 256;

    // Luna Face Texture
    const lunaCanvas = document.createElement('canvas');
    lunaCanvas.width = S; lunaCanvas.height = S;
    const lunaCtx = lunaCanvas.getContext('2d')!;
    const lunaFaceTex = new THREE.CanvasTexture(lunaCanvas);
    lunaFaceTex.minFilter = THREE.LinearFilter;
    lunaFaceTex.generateMipmaps = false;
    const lunaFaceMat = new THREE.MeshBasicMaterial({
      map: lunaFaceTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Nova Face Texture
    const novaCanvas = document.createElement('canvas');
    novaCanvas.width = S; novaCanvas.height = S;
    const novaCtx = novaCanvas.getContext('2d')!;
    const novaFaceTex = new THREE.CanvasTexture(novaCanvas);
    novaFaceTex.minFilter = THREE.LinearFilter;
    novaFaceTex.generateMipmaps = false;
    const novaFaceMat = new THREE.MeshBasicMaterial({
      map: novaFaceTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // ── 1. VIBRANT MODERN PODCAST STUDIO BACKGROUND ──────────────
    const studioSet = new THREE.Group();
    scene.add(studioSet);

    // Studio Back Wall (Warm slate navy with soft specular bounce)
    const wallGeo = new THREE.PlaneGeometry(16, 8);
    const wallMesh = new THREE.Mesh(wallGeo, wallMat);
    wallMesh.position.set(0, 0.9, -2.1);
    wallMesh.receiveShadow = true;
    studioSet.add(wallMesh);

    // Modern Studio Acoustic Sound Slat Panels
    const slatGeo = new THREE.BoxGeometry(0.08, 2.8, 0.04);
    for (let x = -3.4; x <= 3.4; x += 0.26) {
      if (Math.abs(x) > 0.9) {
        const slat = new THREE.Mesh(slatGeo, slatMat);
        slat.position.set(x, 0.9, -2.05);
        slat.receiveShadow = true;
        studioSet.add(slat);
      }
    }

    // Studio Floor Stage
    const floorGeo = new THREE.CylinderGeometry(4.2, 4.2, 0.12, 48);
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.set(0, -1.0, 0.2);
    floorMesh.receiveShadow = true;
    studioSet.add(floorMesh);

    // Floor Glowing Cyan Stage Ring
    const floorRingGeo = new THREE.TorusGeometry(4.22, 0.025, 8, 48);
    const floorRing = new THREE.Mesh(floorRingGeo, cyanGlowMat);
    floorRing.rotation.x = Math.PI / 2;
    floorRing.position.set(0, -0.94, 0.2);
    studioSet.add(floorRing);

    // Studio Cove Ambient Backlight Strips (Lush violet and vibrant cyan)
    const coveLeft = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.06), fuchsiaGlowMat);
    coveLeft.position.set(-2.2, -0.25, -2.02);
    const coveRight = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.06), cyanGlowMat);
    coveRight.position.set(2.2, -0.25, -2.02);
    studioSet.add(coveLeft, coveRight);

    // 3D Illuminated "● ON AIR" Studio Lightbox
    const onAirGroup = new THREE.Group();
    onAirGroup.position.set(0, 1.55, -2.02);
    studioSet.add(onAirGroup);

    const onAirFrame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.38, 0.08), darkMetalMat);
    const onAirGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.30), new THREE.MeshStandardMaterial({ color: 0x081024, roughness: 0.1, metalness: 0.7 }));
    onAirGlass.position.z = 0.045;

    const onAirCanvas = document.createElement('canvas');
    onAirCanvas.width = 256; onAirCanvas.height = 64;
    const onAirCtx = onAirCanvas.getContext('2d')!;
    onAirCtx.fillStyle = '#081024';
    onAirCtx.fillRect(0, 0, 256, 64);
    onAirCtx.font = 'bold 26px "JetBrains Mono", monospace, sans-serif';
    onAirCtx.fillStyle = '#f43f5e';
    onAirCtx.shadowColor = '#f43f5e';
    onAirCtx.shadowBlur = 12;
    onAirCtx.fillText('● ON AIR', 50, 42);
    const onAirTex = new THREE.CanvasTexture(onAirCanvas);
    const onAirTextPlane = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.28), new THREE.MeshBasicMaterial({ map: onAirTex, transparent: true, blending: THREE.AdditiveBlending }));
    onAirTextPlane.position.z = 0.052;
    onAirGroup.add(onAirFrame, onAirGlass, onAirTextPlane);

    // ── 2. STUDIO CHAIRS (Clearly visible framing both robots) ───
    // Luna's Chair
    const lunaChairGroup = new THREE.Group();
    lunaChairGroup.position.set(-1.15, 0.08, -0.24);
    lunaChairGroup.rotation.y = 0.16;
    studioSet.add(lunaChairGroup);

    const chairBackGeo = new THREE.BoxGeometry(1.10, 1.35, 0.10);
    const chairBack1 = new THREE.Mesh(chairBackGeo, chairLunaMat);
    chairBack1.position.set(0, 0.20, 0);
    chairBack1.castShadow = true;

    const headrest1 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.26, 0.12), lunaAccentMat);
    headrest1.position.set(0, 0.88, 0.02);

    const wingGeo = new THREE.BoxGeometry(0.10, 1.10, 0.25);
    const wingL1 = new THREE.Mesh(wingGeo, lunaAccentMat);
    wingL1.position.set(-0.52, 0.18, 0.08);
    const wingR1 = new THREE.Mesh(wingGeo, lunaAccentMat);
    wingR1.position.set(0.52, 0.18, 0.08);

    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.8, 12);
    const chairPost1 = new THREE.Mesh(postGeo, chromeMat);
    chairPost1.position.set(0, -0.65, 0);
    lunaChairGroup.add(chairBack1, headrest1, wingL1, wingR1, chairPost1);

    // Nova's Chair
    const novaChairGroup = new THREE.Group();
    novaChairGroup.position.set(1.15, 0.08, -0.24);
    novaChairGroup.rotation.y = -0.16;
    studioSet.add(novaChairGroup);

    const chairBack2 = new THREE.Mesh(chairBackGeo, chairNovaMat);
    chairBack2.position.set(0, 0.20, 0);
    chairBack2.castShadow = true;

    const headrest2 = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.26, 0.12), novaAccentMat);
    headrest2.position.set(0, 0.88, 0.02);

    const wingL2 = new THREE.Mesh(wingGeo, novaAccentMat);
    wingL2.position.set(-0.52, 0.18, 0.08);
    const wingR2 = new THREE.Mesh(wingGeo, novaAccentMat);
    wingR2.position.set(0.52, 0.18, 0.08);

    const chairPost2 = new THREE.Mesh(postGeo, chromeMat);
    chairPost2.position.set(0, -0.65, 0);
    novaChairGroup.add(chairBack2, headrest2, wingL2, wingR2, chairPost2);

    // ── 3. VISIBLE BROADCAST DESK IN FRONT OF ROBOTS ─────────────
    const deskGeo = new THREE.CylinderGeometry(3.2, 3.2, 0.12, 48, 1, false, Math.PI * 0.22, Math.PI * 0.56);
    const deskMesh = new THREE.Mesh(deskGeo, deskTopMat);
    deskMesh.position.set(0, -0.22, 0.35);
    deskMesh.receiveShadow = true;
    studioSet.add(deskMesh);

    // Dual-Tone Glowing Neon Edge Rim
    const rimL = new THREE.Mesh(new THREE.TorusGeometry(3.21, 0.028, 6, 24, Math.PI * 0.28), fuchsiaGlowMat);
    rimL.rotation.x = Math.PI / 2;
    rimL.rotation.z = Math.PI * 0.22;
    rimL.position.set(0, -0.16, 0.35);

    const rimR = new THREE.Mesh(new THREE.TorusGeometry(3.21, 0.028, 6, 24, Math.PI * 0.28), cyanGlowMat);
    rimR.rotation.x = Math.PI / 2;
    rimR.rotation.z = Math.PI * 0.50;
    rimR.position.set(0, -0.16, 0.35);
    studioSet.add(rimL, rimR);

    // Chrome Desk Pedestal Legs
    const pedGeo = new THREE.CylinderGeometry(0.08, 0.10, 0.9, 14);
    const pedL = new THREE.Mesh(pedGeo, chromeMat);
    pedL.position.set(-1.15, -0.65, 0.55);
    pedL.castShadow = true;
    const pedR = new THREE.Mesh(pedGeo, chromeMat);
    pedR.position.set(1.15, -0.65, 0.55);
    pedR.castShadow = true;
    studioSet.add(pedL, pedR);

    // ── 4. BROADCAST MICROPHONES & CENTER HOLOGRAM ON DESK ───────
    // Luna's Mic
    const mic1Group = new THREE.Group();
    mic1Group.position.set(-0.58, -0.16, 0.85);
    mic1Group.rotation.y = 0.38;
    studioSet.add(mic1Group);

    const micBaseGeo = new THREE.CylinderGeometry(0.12, 0.14, 0.03, 14);
    const micBase1 = new THREE.Mesh(micBaseGeo, chromeMat);
    const micStemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.24, 8);
    const micStem1 = new THREE.Mesh(micStemGeo, darkMetalMat);
    micStem1.position.y = 0.12;
    const micHead1 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), darkMetalMat);
    micHead1.scale.set(1.0, 1.25, 1.0);
    micHead1.position.y = 0.26;
    const micRing1 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), fuchsiaGlowMat);
    micRing1.rotation.x = Math.PI / 2;
    micRing1.position.y = 0.20;
    const mic1Light = new THREE.PointLight(0xc084fc, 0.4, 1.8);
    mic1Light.position.set(0, 0.26, 0.08);
    mic1Group.add(micBase1, micStem1, micHead1, micRing1, mic1Light);

    // Nova's Mic
    const mic2Group = new THREE.Group();
    mic2Group.position.set(0.58, -0.16, 0.85);
    mic2Group.rotation.y = -0.38;
    studioSet.add(mic2Group);

    const micBase2 = new THREE.Mesh(micBaseGeo, chromeMat);
    const micStem2 = new THREE.Mesh(micStemGeo, darkMetalMat);
    micStem2.position.y = 0.12;
    const micHead2 = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 12), darkMetalMat);
    micHead2.scale.set(1.0, 1.25, 1.0);
    micHead2.position.y = 0.26;
    const micRing2 = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 16), cyanGlowMat);
    micRing2.rotation.x = Math.PI / 2;
    micRing2.position.y = 0.20;
    const mic2Light = new THREE.PointLight(0x22d3ee, 0.4, 1.8);
    mic2Light.position.set(0, 0.26, 0.08);
    mic2Group.add(micBase2, micStem2, micHead2, micRing2, mic2Light);

    // Center Holographic Data Orb on Desk
    const holoGroup = new THREE.Group();
    holoGroup.position.set(0, -0.16, 0.75);
    studioSet.add(holoGroup);

    const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.04, 20), chromeMat);
    holoGroup.add(holoBase);

    const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 6, 24), cyanGlowMat);
    holoRing.rotation.x = Math.PI / 2.2;
    holoGroup.add(holoRing);

    const holoSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x22d3ee, wireframe: true, transparent: true, opacity: 0.6 }));
    holoSphere.position.y = 0.26;
    holoGroup.add(holoSphere);

    const barGeo = new THREE.BoxGeometry(0.038, 0.26, 0.038);
    const bar1 = new THREE.Mesh(barGeo, cyanGlowMat);
    bar1.position.set(-0.07, 0.15, 0);
    const bar2 = new THREE.Mesh(barGeo, fuchsiaGlowMat);
    bar2.position.set(0, 0.20, 0);
    const bar3 = new THREE.Mesh(barGeo, amberGlowMat);
    bar3.position.set(0.07, 0.16, 0);
    holoGroup.add(bar1, bar2, bar3);

    const holoLight = new THREE.PointLight(0x22d3ee, 1.2, 2.0);
    holoLight.position.set(0, 0.26, 0);
    holoGroup.add(holoLight);

    // ── 5. MINI ROBOT 1: LUNA (WITH VERTICAL OVER-HEAD HEADSET) ──
    const lunaRoot = new THREE.Group();
    lunaRoot.position.set(-1.15, 0.0, 0.0);
    lunaRoot.rotation.y = 0.18;
    lunaRoot.scale.setScalar(0.72);
    scene.add(lunaRoot);

    // Torso
    const lunaTorso = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 16), lunaBodyMat);
    lunaTorso.scale.set(1.02, 1.15, 0.96);
    lunaTorso.position.y = -0.42;
    lunaTorso.castShadow = true;
    lunaRoot.add(lunaTorso);

    // Glowing Crescent Moon Chest Core
    const lunaCore = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 14), lunaGoldMat);
    lunaCore.position.set(0, -0.30, 0.72);
    lunaRoot.add(lunaCore);

    // Arms
    const miniArmGeo = new THREE.CylinderGeometry(0.10, 0.08, 0.52, 8);
    const miniHandGeo = new THREE.SphereGeometry(0.11, 8, 8);

    const lunaLArmGroup = new THREE.Group();
    lunaLArmGroup.position.set(-0.72, -0.32, 0.10);
    lunaLArmGroup.rotation.z = 0.28;
    const lunaLArm = new THREE.Mesh(miniArmGeo, lunaBodyMat);
    lunaLArm.position.y = -0.22;
    const lunaLHand = new THREE.Mesh(miniHandGeo, lunaAccentMat);
    lunaLHand.position.y = -0.48;
    lunaLArmGroup.add(lunaLArm, lunaLHand);
    lunaRoot.add(lunaLArmGroup);

    const lunaRArmGroup = new THREE.Group();
    lunaRArmGroup.position.set(0.72, -0.30, 0.14);
    lunaRArmGroup.rotation.z = -0.65;
    lunaRArmGroup.rotation.x = -0.25;
    const lunaRArm = new THREE.Mesh(miniArmGeo, lunaBodyMat);
    lunaRArm.position.y = -0.22;
    const lunaRHand = new THREE.Mesh(miniHandGeo, lunaAccentMat);
    lunaRHand.position.y = -0.48;
    lunaRArmGroup.add(lunaRArm, lunaRHand);
    lunaRoot.add(lunaRArmGroup);

    // Luna Head & Helmet
    const lunaHeadGroup = new THREE.Group();
    lunaHeadGroup.position.set(0, 0.58, 0);
    lunaRoot.add(lunaHeadGroup);

    const lunaHead = new THREE.Mesh(new THREE.SphereGeometry(0.82, 22, 18), lunaBodyMat);
    lunaHead.scale.set(1.22, 1.04, 1.0);
    lunaHead.castShadow = true;
    lunaHeadGroup.add(lunaHead);

    // ── LUNA'S OVER-EAR HEADSET ──
    const headsetGroupLuna = new THREE.Group();
    lunaHeadGroup.add(headsetGroupLuna);

    // Vertical Headband arching UP over the crown of the head
    const lunaHpBand = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.045, 8, 32, Math.PI),
      headsetBandMat
    );
    lunaHpBand.position.set(0, 0.05, 0);
    headsetGroupLuna.add(lunaHpBand);

    // Top Cushion Pad
    const lunaHpPad = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.035, 6, 18, Math.PI * 0.45),
      headsetCushionMat
    );
    lunaHpPad.position.set(0, 0.05, 0);
    lunaHpPad.rotation.z = Math.PI * 0.275;
    headsetGroupLuna.add(lunaHpPad);

    // Left Ear Cup
    const earcupGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 16);
    const lunaEarL = new THREE.Mesh(earcupGeo, headsetBandMat);
    lunaEarL.position.set(-1.02, 0.05, 0);
    lunaEarL.rotation.z = Math.PI / 2;
    const lunaCushionL = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), headsetCushionMat);
    lunaCushionL.position.set(-0.96, 0.05, 0);
    lunaCushionL.rotation.y = Math.PI / 2;
    const lunaRingL = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), fuchsiaGlowMat);
    lunaRingL.position.set(-1.08, 0.05, 0);
    lunaRingL.rotation.y = Math.PI / 2;
    headsetGroupLuna.add(lunaEarL, lunaCushionL, lunaRingL);

    // Right Ear Cup
    const lunaEarR = new THREE.Mesh(earcupGeo, headsetBandMat);
    lunaEarR.position.set(1.02, 0.05, 0);
    lunaEarR.rotation.z = Math.PI / 2;
    const lunaCushionR = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), headsetCushionMat);
    lunaCushionR.position.set(0.96, 0.05, 0);
    lunaCushionR.rotation.y = Math.PI / 2;
    const lunaRingR = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), fuchsiaGlowMat);
    lunaRingR.position.set(1.08, 0.05, 0);
    lunaRingR.rotation.y = Math.PI / 2;
    headsetGroupLuna.add(lunaEarR, lunaCushionR, lunaRingR);

    // Headset Mini Swivel Mic Boom
    const boomGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.35, 8);
    const lunaBoom = new THREE.Mesh(boomGeo, chromeMat);
    lunaBoom.position.set(-0.85, -0.08, 0.20);
    lunaBoom.rotation.z = -Math.PI / 4;
    lunaBoom.rotation.x = Math.PI / 3;
    const lunaBoomTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), darkMetalMat);
    lunaBoomTip.position.set(-0.72, -0.20, 0.32);
    headsetGroupLuna.add(lunaBoom, lunaBoomTip);

    // 3D Crescent Moon Crown
    const lunaAntGroup = new THREE.Group();
    lunaAntGroup.position.set(0, 0.90, 0);
    lunaHeadGroup.add(lunaAntGroup);

    const crescentMesh = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.040, 8, 20, Math.PI * 1.35), lunaGoldMat);
    crescentMesh.position.set(-0.03, 0.28, 0);
    crescentMesh.rotation.z = -Math.PI * 0.45;
    const moonGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), fuchsiaGlowMat);
    moonGem.position.set(0.08, 0.46, 0);
    lunaAntGroup.add(crescentMesh, moonGem);

    // Visor Glass
    const lunaVisor = new THREE.Mesh(new THREE.SphereGeometry(0.74, 18, 14), lunaVisorMat);
    lunaVisor.scale.set(1.12, 0.92, 0.90);
    lunaVisor.position.set(0, 0, 0.14);
    lunaHeadGroup.add(lunaVisor);

    // Luna Face Plane (100% Transparent Additive overlay)
    const lunaFacePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), lunaFaceMat);
    lunaFacePlane.position.set(0, 0, 0.86);
    lunaHeadGroup.add(lunaFacePlane);

    // ── 6. MINI ROBOT 2: NOVA (WITH VERTICAL OVER-HEAD HEADSET) ──
    const novaRoot = new THREE.Group();
    novaRoot.position.set(1.15, 0.0, 0.0);
    novaRoot.rotation.y = -0.18;
    novaRoot.scale.setScalar(0.72);
    scene.add(novaRoot);

    // Torso
    const novaTorso = new THREE.Mesh(new THREE.SphereGeometry(0.78, 20, 16), novaBodyMat);
    novaTorso.scale.set(1.02, 1.15, 0.96);
    novaTorso.position.y = -0.42;
    novaTorso.castShadow = true;
    novaRoot.add(novaTorso);

    // Cyan Chest Reactor
    const novaCore = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.04), cyanGlowMat);
    novaCore.position.set(0, -0.30, 0.74);
    novaRoot.add(novaCore);

    // Arms
    const novaLArmGroup = new THREE.Group();
    novaLArmGroup.position.set(-0.72, -0.30, 0.14);
    novaLArmGroup.rotation.z = 0.65;
    novaLArmGroup.rotation.x = -0.25;
    const novaLArm = new THREE.Mesh(miniArmGeo, novaBodyMat);
    novaLArm.position.y = -0.22;
    const novaLHand = new THREE.Mesh(miniHandGeo, chromeMat);
    novaLHand.position.y = -0.48;
    novaLArmGroup.add(novaLArm, novaLHand);
    novaRoot.add(novaLArmGroup);

    const novaRArmGroup = new THREE.Group();
    novaRArmGroup.position.set(0.72, -0.32, 0.10);
    novaRArmGroup.rotation.z = -0.28;
    const novaRArm = new THREE.Mesh(miniArmGeo, novaBodyMat);
    novaRArm.position.y = -0.22;
    const novaRHand = new THREE.Mesh(miniHandGeo, novaAccentMat);
    novaRHand.position.y = -0.48;
    novaRArmGroup.add(novaRArm, novaRHand);
    novaRoot.add(novaRArmGroup);

    // Nova Head & Helmet
    const novaHeadGroup = new THREE.Group();
    novaHeadGroup.position.set(0, 0.58, 0);
    novaRoot.add(novaHeadGroup);

    const novaHead = new THREE.Mesh(new THREE.SphereGeometry(0.82, 22, 18), novaBodyMat);
    novaHead.scale.set(1.22, 1.04, 1.0);
    novaHead.castShadow = true;
    novaHeadGroup.add(novaHead);

    // ── NOVA'S OVER-EAR HEADSET ──
    const headsetGroupNova = new THREE.Group();
    novaHeadGroup.add(headsetGroupNova);

    // Vertical Headband arching UP over the crown of the head
    const novaHpBand = new THREE.Mesh(
      new THREE.TorusGeometry(1.02, 0.045, 8, 32, Math.PI),
      headsetBandMat
    );
    novaHpBand.position.set(0, 0.05, 0);
    headsetGroupNova.add(novaHpBand);

    // Top Cushion Pad
    const novaHpPad = new THREE.Mesh(
      new THREE.TorusGeometry(0.98, 0.035, 6, 18, Math.PI * 0.45),
      headsetCushionMat
    );
    novaHpPad.position.set(0, 0.05, 0);
    novaHpPad.rotation.z = Math.PI * 0.275;
    headsetGroupNova.add(novaHpPad);

    // Left Ear Cup
    const novaEarL = new THREE.Mesh(earcupGeo, headsetBandMat);
    novaEarL.position.set(-1.02, 0.05, 0);
    novaEarL.rotation.z = Math.PI / 2;
    const novaCushionL = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), headsetCushionMat);
    novaCushionL.position.set(-0.96, 0.05, 0);
    novaCushionL.rotation.y = Math.PI / 2;
    const novaRingL = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), cyanGlowMat);
    novaRingL.position.set(-1.08, 0.05, 0);
    novaRingL.rotation.y = Math.PI / 2;
    headsetGroupNova.add(novaEarL, novaCushionL, novaRingL);

    // Right Ear Cup
    const novaEarR = new THREE.Mesh(earcupGeo, headsetBandMat);
    novaEarR.position.set(1.02, 0.05, 0);
    novaEarR.rotation.z = Math.PI / 2;
    const novaCushionR = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.035, 6, 16), headsetCushionMat);
    novaCushionR.position.set(0.96, 0.05, 0);
    novaCushionR.rotation.y = Math.PI / 2;
    const novaRingR = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.015, 6, 16), cyanGlowMat);
    novaRingR.position.set(1.08, 0.05, 0);
    novaRingR.rotation.y = Math.PI / 2;
    headsetGroupNova.add(novaEarR, novaCushionR, novaRingR);

    // Headset Mini Swivel Mic Boom
    const novaBoom = new THREE.Mesh(boomGeo, chromeMat);
    novaBoom.position.set(0.85, -0.08, 0.20);
    novaBoom.rotation.z = Math.PI / 4;
    novaBoom.rotation.x = Math.PI / 3;
    const novaBoomTip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), darkMetalMat);
    novaBoomTip.position.set(0.72, -0.20, 0.32);
    headsetGroupNova.add(novaBoom, novaBoomTip);

    // Minimalist Antenna with Glowing Cyan Orb
    const novaAntGroup = new THREE.Group();
    novaAntGroup.position.set(0, 0.90, 0);
    novaHeadGroup.add(novaAntGroup);

    const novaAntStem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.32, 6), chromeMat);
    novaAntStem.position.y = 0.16;
    const novaAntOrb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), cyanGlowMat);
    novaAntOrb.position.y = 0.34;
    novaAntGroup.add(novaAntStem, novaAntOrb);

    // Visor Glass
    const novaVisor = new THREE.Mesh(new THREE.SphereGeometry(0.74, 18, 14), novaVisorMat);
    novaVisor.scale.set(1.12, 0.92, 0.90);
    novaVisor.position.set(0, 0, 0.14);
    novaHeadGroup.add(novaVisor);

    // Nova Face Plane (100% Transparent Additive overlay)
    const novaFacePlane = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.95), novaFaceMat);
    novaFacePlane.position.set(0, 0, 0.86);
    novaHeadGroup.add(novaFacePlane);

    // ── 7. WARM & COOL STUDIO MULTI-POINT LIGHTING RIG ───────────
    // Increased ambient to banish pitch-black shadows
    const ambientLight = new THREE.AmbientLight(0x24355a, 3.2);
    scene.add(ambientLight);

    // Soft Overhead Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 2.6);
    keyLight.position.set(0, 4.5, 3.8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Background Wall Warm Studio Light (Illuminates the back wall with a gentle studio gradient!)
    const wallStudioLight = new THREE.PointLight(0xffedd5, 2.2, 8);
    wallStudioLight.position.set(0, 1.4, -0.8);
    scene.add(wallStudioLight);

    // Luna's Violet Rim Spotlight
    const lunaRim = new THREE.PointLight(0xd946ef, 3.0, 6);
    lunaRim.position.set(-2.4, 1.6, -0.6);
    scene.add(lunaRim);

    // Nova's Cyan Rim Spotlight
    const novaRim = new THREE.PointLight(0x06b6d4, 3.0, 6);
    novaRim.position.set(2.4, 1.6, -0.6);
    scene.add(novaRim);

    // ── 8. EXPRESSIVE FACE DRAWING (100% TRANSPARENT CANVAS) ─────
    let blinkTimer = 0;
    let isBlinking = false;
    let wavePhase = 0;
    let frameCount = 0;

    const drawFaces = () => {
      // 1. LUNA
      const lCtx = lunaCtx;
      lCtx.clearRect(0, 0, S, S);

      const isLuna = isLunaSpeakingRef.current;
      const lEyeCol = '#38bdf8';
      const lGlow = '#c084fc';
      const hw = S / 2;

      const eyeR = 26;
      const eyeLY = 112;
      const eyeLX = 76, eyeRX = 180;

      if (!isBlinking) {
        lCtx.save();
        lCtx.shadowColor = lGlow;
        lCtx.shadowBlur = 20;

        [eyeLX, eyeRX].forEach((cx, idx) => {
          const g = lCtx.createRadialGradient(cx - 5, eyeLY - 5, 2, cx, eyeLY, eyeR);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.3, lEyeCol);
          g.addColorStop(1, lGlow);
          lCtx.fillStyle = g;
          lCtx.beginPath();
          lCtx.arc(cx, eyeLY, eyeR, 0, Math.PI * 2);
          lCtx.fill();

          lCtx.save();
          lCtx.globalCompositeOperation = 'destination-out';
          lCtx.beginPath();
          lCtx.arc(cx + (idx === 0 ? 8 : -8), eyeLY - 6, eyeR * 0.72, 0, Math.PI * 2);
          lCtx.fill();
          lCtx.restore();

          lCtx.fillStyle = '#ffffff';
          lCtx.beginPath();
          lCtx.arc(cx - (idx === 0 ? 5 : 8), eyeLY - 6, 4.5, 0, Math.PI * 2);
          lCtx.fill();
        });
        lCtx.restore();
      } else {
        lCtx.strokeStyle = lEyeCol;
        lCtx.lineWidth = 7;
        lCtx.lineCap = 'round';
        lCtx.beginPath();
        lCtx.arc(eyeLX, eyeLY + 4, 18, 0.15 * Math.PI, 0.85 * Math.PI);
        lCtx.arc(eyeRX, eyeLY + 4, 18, 0.15 * Math.PI, 0.85 * Math.PI);
        lCtx.stroke();
      }

      // Soft Pink Blush Cheeks
      lCtx.fillStyle = 'rgba(244, 114, 182, 0.55)';
      lCtx.beginPath();
      lCtx.arc(52, 146, 14, 0, Math.PI * 2);
      lCtx.arc(204, 146, 14, 0, Math.PI * 2);
      lCtx.fill();

      // Luna Mouth
      if (isLuna) {
        lCtx.strokeStyle = lGlow;
        lCtx.lineWidth = 5.5;
        lCtx.lineCap = 'round';
        lCtx.beginPath();
        const mY = 168;
        for (let x = 96; x <= 160; x += 10) {
          const barH = Math.sin((x * 0.14) + wavePhase) * 14;
          lCtx.moveTo(x, mY - barH);
          lCtx.lineTo(x, mY + barH);
        }
        lCtx.stroke();
      } else {
        lCtx.strokeStyle = lGlow;
        lCtx.lineWidth = 5;
        lCtx.lineCap = 'round';
        lCtx.beginPath();
        lCtx.arc(hw, 156, 18, 0.18 * Math.PI, 0.82 * Math.PI);
        lCtx.stroke();
      }
      lunaFaceTex.needsUpdate = true;

      // 2. NOVA
      const nCtx = novaCtx;
      nCtx.clearRect(0, 0, S, S);

      const isNova = isNovaSpeakingRef.current;
      const nEyeCol = '#22d3ee';
      const nGlow = '#0284c7';

      if (!isBlinking) {
        nCtx.save();
        nCtx.shadowColor = nGlow;
        nCtx.shadowBlur = 24;

        [eyeLX, eyeRX].forEach(cx => {
          const g = nCtx.createRadialGradient(cx - 5, eyeLY - 5, 2, cx, eyeLY, eyeR);
          g.addColorStop(0, '#ffffff');
          g.addColorStop(0.25, nEyeCol);
          g.addColorStop(1, nGlow);
          nCtx.fillStyle = g;
          nCtx.beginPath();
          nCtx.arc(cx, eyeLY, eyeR, 0, Math.PI * 2);
          nCtx.fill();

          nCtx.fillStyle = 'rgba(255, 255, 255, 0.92)';
          nCtx.beginPath();
          nCtx.arc(cx - 6, eyeLY - 6, 5.5, 0, Math.PI * 2);
          nCtx.fill();
        });
        nCtx.restore();
      } else {
        nCtx.strokeStyle = nEyeCol;
        nCtx.lineWidth = 7;
        nCtx.lineCap = 'round';
        nCtx.beginPath();
        nCtx.moveTo(eyeLX - 18, eyeLY);
        nCtx.lineTo(eyeLX + 18, eyeLY);
        nCtx.moveTo(eyeRX - 18, eyeLY);
        nCtx.lineTo(eyeRX + 18, eyeLY);
        nCtx.stroke();
      }

      // Nova Mouth
      if (isNova) {
        nCtx.strokeStyle = '#f59e0b';
        nCtx.lineWidth = 5.5;
        nCtx.lineCap = 'round';
        nCtx.beginPath();
        const mY = 168;
        for (let x = 96; x <= 160; x += 10) {
          const barH = Math.abs(Math.sin((x * 0.16) + wavePhase * 1.3)) * 16;
          nCtx.moveTo(x, mY - barH);
          nCtx.lineTo(x, mY + barH);
        }
        nCtx.stroke();
      } else {
        nCtx.strokeStyle = nEyeCol;
        nCtx.lineWidth = 4.5;
        nCtx.lineCap = 'round';
        nCtx.beginPath();
        nCtx.moveTo(108, 164);
        nCtx.lineTo(148, 164);
        nCtx.stroke();
      }
      novaFaceTex.needsUpdate = true;
    };

    // ── 9. ANIMATION LOOP ────────────────────────────────────────
    let clock = new THREE.Clock();

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const t = clock.getElapsedTime();
      frameCount++;

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      camera.position.x = mouseRef.current.x * 0.18;
      camera.position.y = 0.35 + mouseRef.current.y * 0.12;
      camera.lookAt(0, 0.10, 0);

      blinkTimer += delta;
      if (blinkTimer > 3.8) {
        isBlinking = true;
        if (blinkTimer > 3.98) {
          isBlinking = false;
          blinkTimer = 0;
        }
      }

      wavePhase += delta * 12;

      if (frameCount % 2 === 0) {
        drawFaces();
      }

      const isLuna = isLunaSpeakingRef.current;
      const isNova = isNovaSpeakingRef.current;
      const isAnyPlaying = isPlayingRef.current && !isMutedRef.current;

      // Luna Animation
      lunaRoot.position.y = Math.sin(t * 2.2) * 0.025;
      const lunaListen = isNova ? 0.10 : 0;
      lunaHeadGroup.rotation.y = 0.10 + mouseRef.current.x * 0.25 + (isLuna ? Math.sin(t * 4.2) * 0.06 : lunaListen);
      lunaHeadGroup.rotation.x = mouseRef.current.y * 0.18 + (isLuna ? Math.sin(t * 3.2) * 0.04 : 0.02);
      crescentMesh.rotation.y = Math.sin(t * 2) * 0.20;

      if (isLuna) {
        lunaRArmGroup.rotation.z = -0.65 + Math.sin(t * 5.2) * 0.14;
        micRing1.scale.setScalar(1.0 + Math.sin(t * 10) * 0.18);
        mic1Light.intensity = 2.4 + Math.sin(t * 8) * 0.8;
      } else {
        lunaRArmGroup.rotation.z = -0.65 + Math.sin(t * 1.8) * 0.02;
        micRing1.scale.setScalar(1.0);
        mic1Light.intensity = 0.4;
      }

      if (lunaSpinRef.current.active) {
        lunaSpinRef.current.progress += delta * 7;
        lunaRoot.rotation.y = 0.18 + lunaSpinRef.current.progress;
        if (lunaSpinRef.current.progress >= Math.PI * 2) {
          lunaSpinRef.current.active = false;
          lunaRoot.rotation.y = 0.18;
        }
      }

      // Nova Animation
      novaRoot.position.y = Math.cos(t * 2.0) * 0.025;
      const novaListen = isLuna ? -0.12 : 0;
      novaHeadGroup.rotation.y = -0.10 + mouseRef.current.x * 0.25 + (isNova ? Math.sin(t * 4.2) * 0.06 : novaListen);
      novaHeadGroup.rotation.x = mouseRef.current.y * 0.18 + (isNova ? Math.sin(t * 3.2) * 0.04 : 0.02);

      if (isNova) {
        novaLArmGroup.rotation.z = 0.65 + Math.sin(t * 5.2) * 0.14;
        micRing2.scale.setScalar(1.0 + Math.sin(t * 10) * 0.18);
        mic2Light.intensity = 2.4 + Math.sin(t * 8) * 0.8;
      } else {
        novaLArmGroup.rotation.z = 0.65 + Math.cos(t * 1.8) * 0.02;
        micRing2.scale.setScalar(1.0);
        mic2Light.intensity = 0.4;
      }

      if (novaSpinRef.current.active) {
        novaSpinRef.current.progress += delta * 7;
        novaRoot.rotation.y = -0.18 + novaSpinRef.current.progress;
        if (novaSpinRef.current.progress >= Math.PI * 2) {
          novaSpinRef.current.active = false;
          novaRoot.rotation.y = -0.18;
        }
      }

      // Hologram Animation
      holoRing.rotation.z += delta * 1.2;
      holoSphere.rotation.y += delta * 1.0;
      const beatVol = isAnyPlaying ? Math.max(0.35, volumeRef.current) : 0.20;
      bar1.scale.y = 0.4 + Math.abs(Math.sin(t * 6.5)) * 0.80 * beatVol;
      bar2.scale.y = 0.5 + Math.abs(Math.cos(t * 7.2)) * 0.95 * beatVol;
      bar3.scale.y = 0.4 + Math.abs(Math.sin(t * 5.8)) * 0.85 * beatVol;
      holoLight.intensity = isAnyPlaying ? 1.6 + Math.sin(t * 10) * 0.5 : 0.9;

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth || 700;
      const newH = container.clientHeight || 280;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animRef.current) cancelAnimationFrame(animRef.current);
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={handlePointerClick}
      className={`relative w-full h-[240px] sm:h-[270px] md:h-[290px] cursor-pointer overflow-hidden ${className}`}
      title="Interactive 3D Studio: Move cursor to guide robot gaze • Click Luna or Nova for spin reactions!"
    />
  );
};
