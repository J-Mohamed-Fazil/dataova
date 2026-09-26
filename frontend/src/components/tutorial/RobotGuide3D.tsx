import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

export interface RobotGuide3DProps {
  expression?: 'happy' | 'wave' | 'explain' | 'celebrate' | 'thinking' | 'wink' | 'wrong' | 'no_account' | 'new_user' | 'teaching';
  isSpeaking?: boolean;
  className?: string;
  onRobotClick?: () => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  celebrateTrigger?: number;
  peekingHorizontal?: boolean;
  peekingSide?: 'left' | 'right';
  showBackground?: boolean;
}

// ── Global WebGL context pool ── one renderer shared per size bucket ─────────
type RendererEntry = {
  renderer: THREE.WebGLRenderer;
  users: number;
};
const rendererPool: Map<string, RendererEntry> = new Map();

function acquireRenderer(key: string): THREE.WebGLRenderer {
  let entry = rendererPool.get(key);
  if (!entry) {
    const r = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    entry = { renderer: r, users: 0 };
    rendererPool.set(key, entry);
  }
  entry.users++;
  return entry.renderer;
}

function releaseRenderer(key: string) {
  const entry = rendererPool.get(key);
  if (!entry) return;
  entry.users--;
  if (entry.users <= 0) {
    entry.renderer.dispose();
    rendererPool.delete(key);
  }
}

// ── Shared low-poly geometry cache ──────────────────────────────────────────
const geoCache = new Map<string, THREE.BufferGeometry>();
function getGeo(key: string, factory: () => THREE.BufferGeometry): THREE.BufferGeometry {
  if (!geoCache.has(key)) geoCache.set(key, factory());
  return geoCache.get(key)!;
}

export const RobotGuide3D: React.FC<RobotGuide3DProps> = ({
  expression = 'happy',
  isSpeaking = false,
  className = '',
  onRobotClick,
  size = 'md',
  celebrateTrigger,
  peekingHorizontal = false,
  peekingSide = 'left',
  showBackground = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const spinProgressRef = useRef<number>(0);
  const isSpinningRef = useRef<boolean>(false);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const expressionRef = useRef(expression);
  const isSpeakingRef = useRef(isSpeaking);
  // canvas draw throttle
  const frameCountRef = useRef(0);
  // face canvas state – local mutable vars (no closures needed)
  const blinkTimerRef = useRef(0);
  const isBlinkingRef = useRef(false);
  const talkTimerRef = useRef(0);
  const scanlineOffsetRef = useRef(0);
  const hudPulseRef = useRef(0);

  useEffect(() => {
    expressionRef.current = expression;
    if (expression === 'celebrate') {
      isSpinningRef.current = false;
      spinProgressRef.current = 0;
    }
  }, [expression]);

  useEffect(() => {
    if (celebrateTrigger !== undefined && celebrateTrigger > 0) {
      expressionRef.current = 'celebrate';
    }
  }, [celebrateTrigger]);

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!mountRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    mouseRef.current.targetX = (((e.clientX - rect.left) / rect.width) * 2 - 1) * 0.5;
    mouseRef.current.targetY = -(((e.clientY - rect.top) / rect.height) * 2 - 1) * 0.35;
  }, []);

  const handlePointerLeave = useCallback(() => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  }, []);

  const triggerSpin = useCallback(() => {
    if (!isSpinningRef.current) {
      isSpinningRef.current = true;
      spinProgressRef.current = 0;
    }
    onRobotClick?.();
  }, [onRobotClick]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const W = container.clientWidth || 200;
    const H = container.clientHeight || 200;

    // ── Dedicated per-instance renderer ───────────────────────────────
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: size !== 'xs', // skip antialias for tiny xs instances
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // cap at 1.5x – big savings
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, size === 'xs' ? 0.1 : 0.18, size === 'xs' ? 6.4 : 7.0);

    // ── LOW-POLY shared geometry (cached) ─────────────────────────────
    // Reduced segment counts drastically: 48→20 for spheres, etc.
    const headGeo    = getGeo('head',    () => new THREE.SphereGeometry(1.2,  20, 16));
    const torsoGeo   = getGeo('torso',   () => new THREE.SphereGeometry(1.25, 20, 16));
    const visorGeo   = getGeo('visor',   () => new THREE.SphereGeometry(1.12, 20, 16));
    const earGeo     = getGeo('ear',     () => new THREE.CylinderGeometry(0.18, 0.15, 0.22, 10));
    const earDotGeo  = getGeo('earDot',  () => new THREE.CircleGeometry(0.08, 10));
    const armGeo     = getGeo('arm',     () => new THREE.CylinderGeometry(0.18, 0.14, 0.9, 10));
    const handGeo    = getGeo('hand',    () => new THREE.SphereGeometry(0.19, 10, 10));
    const beltGeo    = getGeo('belt',    () => new THREE.TorusGeometry(1.3, 0.04, 8, 40));
    const thrGeo     = getGeo('thr',     () => new THREE.CylinderGeometry(0.35, 0.25, 0.15, 14));
    const thrGlowGeo = getGeo('thrGlow', () => new THREE.TorusGeometry(0.28, 0.07, 8, 20));
    const antStemGeo = getGeo('antStem', () => new THREE.CylinderGeometry(0.04, 0.05, 0.58, 8));
    const antTipGeo  = getGeo('antTip',  () => new THREE.SphereGeometry(0.11, 10, 10));
    const antRingGeo = getGeo('antRing', () => new THREE.TorusGeometry(0.18, 0.025, 6, 18));
    const facePlaneGeo = getGeo('face',  () => new THREE.PlaneGeometry(1.85, 1.45));
    const orbitGeo   = getGeo('orbit',   () => new THREE.TorusGeometry(2.0, 0.022, 6, 64));
    const orbit2Geo  = getGeo('orbit2',  () => new THREE.TorusGeometry(1.8, 0.016, 6, 52));
    const dotGeo     = getGeo('dot',     () => new THREE.SphereGeometry(0.09, 8, 8));
    const palmGeo    = getGeo('palm',    () => new THREE.CircleGeometry(0.12, 14));
    const chestGlowGeo  = getGeo('chg',  () => new THREE.BoxGeometry(0.7, 0.06, 0.06));
    const chestGlow2Geo = getGeo('chg2', () => new THREE.BoxGeometry(0.4, 0.04, 0.05));

    // ── Materials (NOT shared – expressions need per-instance face texture) ──
    // Use MeshStandardMaterial instead of MeshPhysicalMaterial for main body
    // – Physical adds clearcoat shader which is expensive; Standard is ~2× faster
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x0d1b3e, roughness: 0.18, metalness: 0.75,
    });
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0x1a3460, roughness: 0.25, metalness: 0.6,
    });
    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0x9ac4e0, metalness: 0.92, roughness: 0.1,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x010608, roughness: 0.05, metalness: 0.45,
    });
    const cyanMat    = new THREE.MeshBasicMaterial({ color: 0x22d3ee });
    const accentGlow = new THREE.MeshBasicMaterial({ color: 0x818cf8 });

    // Face canvas – 256×256 is enough; 512 wastes GPU memory & upload time
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = 256; faceCanvas.height = 256;
    const faceCtx = faceCanvas.getContext('2d')!;
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.minFilter = THREE.LinearFilter;
    faceTex.generateMipmaps = false; // no mipmap generation = faster uploads
    const faceMat = new THREE.MeshBasicMaterial({
      map: faceTex, transparent: true, blending: THREE.AdditiveBlending,
    });

    // Orbit ring materials (opacity animated in loop)
    const orbitMat  = new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0 });
    const orbit2Mat = new THREE.MeshBasicMaterial({ color: 0x818cf8, transparent: true, opacity: 0 });

    // Particle system (celebrate)
    const PARTICLE_COUNT = 16;
    const particleGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(PARTICLE_COUNT * 3);
    const pLife = new Float32Array(PARTICLE_COUNT);
    const pSpeed = new Float32Array(PARTICLE_COUNT);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pPos[i * 3]     = (Math.random() - 0.5) * 2.4;
      pPos[i * 3 + 1] = -2.5 + Math.random() * 0.5;
      pPos[i * 3 + 2] = (Math.random() - 0.5) * 1.2;
      pLife[i]  = Math.random();
      pSpeed[i] = 0.014 + Math.random() * 0.016;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x22d3ee, size: 0.09, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);

    // ── Scene graph ────────────────────────────────────────────────────
    const robotRoot = new THREE.Group();
    scene.add(robotRoot);

    // Torso
    const torsoGroup = new THREE.Group();
    robotRoot.add(torsoGroup);
    const torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    torsoMesh.scale.set(1.05, 1.22, 0.98); torsoMesh.position.y = -0.7;
    torsoGroup.add(torsoMesh);
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.6, 0.08), accentMat);
    chestPlate.position.set(0, -0.55, 1.0);
    torsoGroup.add(chestPlate);

    const chestGlow = new THREE.Mesh(chestGlowGeo, cyanMat);
    chestGlow.position.set(0, -0.42, 1.06);
    torsoGroup.add(chestGlow);

    const chestGlow2 = new THREE.Mesh(chestGlow2Geo, accentGlow);
    chestGlow2.position.set(0, -0.56, 1.07);
    torsoGroup.add(chestGlow2);
    const beltMesh = new THREE.Mesh(beltGeo, chromeMat);
    beltMesh.rotation.x = Math.PI / 2; beltMesh.position.y = -0.65;
    torsoGroup.add(beltMesh);
    const thrMesh = new THREE.Mesh(thrGeo, chromeMat);
    thrMesh.position.y = -2.1;
    torsoGroup.add(thrMesh);
    const thrGlow = new THREE.Mesh(thrGlowGeo, cyanMat);
    thrGlow.rotation.x = Math.PI / 2; thrGlow.position.y = -2.18;
    torsoGroup.add(thrGlow);

    // Head
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 0.85, 0);
    robotRoot.add(headGroup);
    const headMesh = new THREE.Mesh(headGeo, bodyMat);
    headMesh.scale.set(1.28, 1.05, 1.02);
    headGroup.add(headMesh);
    // Ears
    [[-1.35, -Math.PI / 2], [1.35, Math.PI / 2]].forEach(([xPos, rotY]) => {
      const em = new THREE.Mesh(earGeo, accentMat);
      em.position.set(xPos as number, 0.1, 0); em.rotation.z = Math.PI / 2;
      headGroup.add(em);
      const ed = new THREE.Mesh(earDotGeo, cyanMat);
      ed.position.set((xPos as number) * (Math.abs(xPos as number) + 0.11) / Math.abs(xPos as number), 0.1, 0);
      ed.rotation.y = rotY as number;
      headGroup.add(ed);
    });
    // Visor
    const visorMesh = new THREE.Mesh(visorGeo, visorMat);
    visorMesh.scale.set(1.16, 0.95, 0.92); visorMesh.position.set(0, 0, 0.16);
    headGroup.add(visorMesh);
    // Face plane
    const faceMesh = new THREE.Mesh(facePlaneGeo, faceMat);
    faceMesh.position.set(0, 0, 1.24);
    headGroup.add(faceMesh);

    // Antenna 1
    const antGroup = new THREE.Group();
    antGroup.position.set(0.28, 1.2, 0);
    headGroup.add(antGroup);
    const antStem = new THREE.Mesh(antStemGeo, chromeMat);
    antStem.position.y = 0.29; antGroup.add(antStem);
    const antTip = new THREE.Mesh(antTipGeo, cyanMat);
    antTip.position.y = 0.62; antGroup.add(antTip);
    const antRing = new THREE.Mesh(antRingGeo, cyanMat);
    antRing.position.y = 0.62; antGroup.add(antRing);

    // Antenna 2 (shorter)
    const ant2Group = new THREE.Group();
    ant2Group.position.set(-0.38, 1.18, 0);
    headGroup.add(ant2Group);
    const ant2Stem = new THREE.Mesh(getGeo('antStem2', () => new THREE.CylinderGeometry(0.03, 0.04, 0.38, 8)), chromeMat);
    ant2Stem.position.y = 0.19; ant2Group.add(ant2Stem);
    const ant2Tip = new THREE.Mesh(getGeo('antTip2', () => new THREE.SphereGeometry(0.07, 8, 8)), accentGlow);
    ant2Tip.position.y = 0.4; ant2Group.add(ant2Tip);

    // Arms
    const leftArmGroup = new THREE.Group();
    leftArmGroup.position.set(-1.45, -0.6, 0);
    robotRoot.add(leftArmGroup);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.rotation.z = 0.28; leftArm.position.y = -0.35;
    leftArmGroup.add(leftArm);
    const leftHand = new THREE.Mesh(handGeo, accentMat);
    leftHand.position.set(-0.15, -0.85, 0);
    leftArmGroup.add(leftHand);

    const rightArmGroup = new THREE.Group();
    rightArmGroup.position.set(1.45, -0.5, 0);
    robotRoot.add(rightArmGroup);
    const rightArm = new THREE.Mesh(armGeo, bodyMat);
    rightArm.rotation.z = -0.85; rightArm.position.set(0.35, 0.15, 0.2);
    rightArmGroup.add(rightArm);
    const rightHand = new THREE.Mesh(handGeo, accentMat);
    rightHand.position.set(0.72, 0.45, 0.35);
    rightArmGroup.add(rightHand);
    const palmGlow = new THREE.Mesh(palmGeo, cyanMat);
    palmGlow.position.set(0.72, 0.45, 0.49);
    rightArmGroup.add(palmGlow);

    // Orbit rings
    const orbitRingMesh = new THREE.Mesh(orbitGeo, orbitMat);
    orbitRingMesh.rotation.x = Math.PI / 2.4;
    const orbitRing2Mesh = new THREE.Mesh(orbit2Geo, orbit2Mat);
    orbitRing2Mesh.rotation.x = Math.PI / 1.8; orbitRing2Mesh.rotation.y = Math.PI / 3;
    const orbitDot = new THREE.Mesh(dotGeo, cyanMat); orbitDot.visible = false;
    const orbitDot2 = new THREE.Mesh(dotGeo, accentGlow); orbitDot2.visible = false;
    robotRoot.add(orbitRingMesh, orbitRing2Mesh, orbitDot, orbitDot2, particles);

    // ── Lighting (minimal set – fewer lights = faster) ─────────────────
    const ambient = new THREE.AmbientLight(0x0d2a5e, 2.0);
    const key = new THREE.DirectionalLight(0xffffff, 2.5);
    key.position.set(5, 7, 6);
    const cyan = new THREE.DirectionalLight(0x22d3ee, 2.2);
    cyan.position.set(-6, -2, 3);
    const fill = new THREE.DirectionalLight(0x6366f1, 1.2);
    fill.position.set(3, -3, -4);
    const thrLight = new THREE.PointLight(0x06b6d4, 3.5, 5);
    thrLight.position.set(0, -2.4, 0);
    scene.add(ambient, key, cyan, fill, thrLight);

    // ── Face canvas drawing ────────────────────────────────────────────
    const S = 256; // canvas size alias

    const drawFace = (t: number) => {
      const ctx = faceCtx;
      ctx.clearRect(0, 0, S, S);

      // Background
      const bg = ctx.createRadialGradient(S/2, S/2, 5, S/2, S/2, 145);
      bg.addColorStop(0, 'rgba(4,12,35,0.97)');
      bg.addColorStop(1, 'rgba(1,4,12,1)');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, S, S);

      // Scan lines (every 2 frames only)
      if (frameCountRef.current % 2 === 0) {
        scanlineOffsetRef.current = (scanlineOffsetRef.current + 0.8) % 10;
        ctx.strokeStyle = 'rgba(34,211,238,0.04)'; ctx.lineWidth = 1;
        for (let y = scanlineOffsetRef.current; y < S; y += 10) {
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(S, y); ctx.stroke();
        }
      }

      // HUD corner brackets
      hudPulseRef.current = (hudPulseRef.current + 0.018) % (Math.PI * 2);
      const hA = 0.2 + Math.sin(hudPulseRef.current) * 0.12;
      ctx.strokeStyle = `rgba(34,211,238,${hA})`; ctx.lineWidth = 2.5;
      const bs = 16;
      [[10,10],[S-10,10],[10,S-10],[S-10,S-10]].forEach(([bx,by],i) => {
        const dx = i%2===0?1:-1, dy = i<2?1:-1;
        ctx.beginPath();
        ctx.moveTo(bx, by+dy*bs); ctx.lineTo(bx,by); ctx.lineTo(bx+dx*bs,by);
        ctx.stroke();
      });

      // Blink
      blinkTimerRef.current += 0.016;
      if (blinkTimerRef.current > 3.8) {
        isBlinkingRef.current = true;
        if (blinkTimerRef.current > 3.96) { isBlinkingRef.current = false; blinkTimerRef.current = 0; }
      }

      talkTimerRef.current += 0.08;
      const mOpen = isSpeakingRef.current ? Math.abs(Math.sin(talkTimerRef.current * 8)) * 15 + 8 : 10;
      const expr = expressionRef.current;

      // Theme
      let col = '#22d3ee', glow = '#06b6d4', cheek = 'rgba(34,211,238,0.28)';
      if (expr==='wrong')     { col='#fb7185'; glow='#f43f5e'; cheek='rgba(244,63,94,0.28)'; }
      else if (expr==='no_account') { col='#fbbf24'; glow='#f59e0b'; cheek='rgba(245,158,11,0.26)'; }
      else if (expr==='new_user')   { col='#34d399'; glow='#10b981'; cheek='rgba(52,211,153,0.3)'; }
      else if (expr==='celebrate')  { col='#a78bfa'; glow='#7c3aed'; cheek='rgba(167,139,250,0.32)'; }
      else if (expr==='explain'||expr==='teaching') { col='#38bdf8'; glow='#0284c7'; cheek='rgba(56,189,248,0.24)'; }
      else if (expr==='thinking')   { col='#818cf8'; glow='#6366f1'; cheek='rgba(129,140,248,0.24)'; }

      const hw = S/2; // half-width shorthand

      // ── Eyes ──────────────────────────────────────────────────────
      const eyeR = S * 0.115;
      const eyeLX = hw - S*0.3, eyeRX = hw + S*0.3, eyeY = S*0.42;

      const drawArcEye = (cx: number, cy: number, r: number) => {
        ctx.shadowColor = glow; ctx.shadowBlur = 18;
        ctx.strokeStyle = col; ctx.lineWidth = 10; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI*1.1, Math.PI*1.9); ctx.stroke();
      };

      const drawCircleEye = (cx: number, cy: number, r: number) => {
        const g2 = ctx.createRadialGradient(cx-r*.3, cy-r*.3, r*.05, cx, cy, r);
        g2.addColorStop(0,'#fff'); g2.addColorStop(0.2,col); g2.addColorStop(1,glow);
        ctx.shadowColor = glow; ctx.shadowBlur = 28;
        ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='rgba(255,255,255,0.88)';
        ctx.beginPath(); ctx.arc(cx-r*.3,cy-r*.3,r*.22,0,Math.PI*2); ctx.fill();
      };

      if (isBlinkingRef.current && expr!=='wrong' && expr!=='no_account') {
        ctx.shadowColor=glow; ctx.shadowBlur=14; ctx.strokeStyle=col; ctx.lineWidth=9;
        ctx.beginPath();
        ctx.moveTo(eyeLX-eyeR,eyeY); ctx.lineTo(eyeLX+eyeR,eyeY);
        ctx.moveTo(eyeRX-eyeR,eyeY); ctx.lineTo(eyeRX+eyeR,eyeY);
        ctx.stroke();
      } else if (expr==='happy'||expr==='wave') {
        drawArcEye(eyeLX, eyeY, eyeR);
        drawArcEye(eyeRX, eyeY, eyeR);
      } else if (expr==='celebrate') {
        // sparkle cross eyes – no emoji
        const drawStar = (cx: number, cy: number) => {
          ctx.shadowColor=glow; ctx.shadowBlur=32; ctx.strokeStyle=col; ctx.lineWidth=9;
          for (let i=0;i<4;i++) {
            const a = (i/4)*Math.PI + t*2.1;
            ctx.beginPath();
            ctx.moveTo(cx-Math.cos(a)*eyeR, cy-Math.sin(a)*eyeR);
            ctx.lineTo(cx+Math.cos(a)*eyeR, cy+Math.sin(a)*eyeR);
            ctx.stroke();
          }
          ctx.fillStyle='#fff'; ctx.shadowBlur=0;
          ctx.beginPath(); ctx.arc(cx,cy,eyeR*.28,0,Math.PI*2); ctx.fill();
        };
        drawStar(eyeLX,eyeY); drawStar(eyeRX,eyeY);
      } else if (expr==='wrong') {
        ctx.strokeStyle='#fb7185'; ctx.lineWidth=12; ctx.shadowColor='#f43f5e'; ctx.shadowBlur=18;
        [eyeLX,eyeRX].forEach(cx => {
          ctx.beginPath();
          ctx.moveTo(cx-eyeR,eyeY-eyeR); ctx.lineTo(cx+eyeR,eyeY+eyeR);
          ctx.moveTo(cx-eyeR,eyeY+eyeR); ctx.lineTo(cx+eyeR,eyeY-eyeR);
          ctx.stroke();
        });
      } else if (expr==='no_account') {
        drawCircleEye(eyeLX, eyeY, eyeR);
        drawCircleEye(eyeRX, eyeY, eyeR*.7);
      } else if (expr==='new_user') {
        drawArcEye(eyeLX, eyeY, eyeR*1.05);
        drawArcEye(eyeRX, eyeY, eyeR*1.05);
      } else if (expr==='thinking') {
        drawCircleEye(eyeLX, eyeY, eyeR*.9);
        drawCircleEye(eyeRX, eyeY, eyeR*.9);
        ctx.shadowBlur=10;
        [0,1,2].forEach(i => {
          const p = Math.sin(t*4+i*1.2)*.3+.7;
          ctx.globalAlpha=p; ctx.fillStyle=col;
          ctx.beginPath(); ctx.arc(eyeRX+eyeR+12+i*16, eyeY-eyeR*1.5, 6,0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
      } else if (expr==='explain') {
        drawCircleEye(eyeLX, eyeY, eyeR);
        drawArcEye(eyeRX, eyeY, eyeR*.9);
      } else if (expr==='teaching') {
        drawCircleEye(eyeLX, eyeY, eyeR*1.05);
        drawCircleEye(eyeRX, eyeY, eyeR*1.05);
        ctx.strokeStyle=col; ctx.lineWidth=6; ctx.shadowBlur=18;
        ctx.beginPath();
        ctx.moveTo(hw,eyeY-eyeR*1.8); ctx.lineTo(hw,eyeY-eyeR*1.1);
        ctx.moveTo(hw-10,eyeY-eyeR*1.6); ctx.lineTo(hw,eyeY-eyeR*1.8); ctx.lineTo(hw+10,eyeY-eyeR*1.6);
        ctx.stroke();
      } else if (expr==='wink') {
        drawArcEye(eyeLX, eyeY, eyeR);
        ctx.shadowColor=glow; ctx.shadowBlur=14; ctx.strokeStyle=col; ctx.lineWidth=9;
        ctx.beginPath(); ctx.moveTo(eyeRX-eyeR,eyeY); ctx.lineTo(eyeRX+eyeR,eyeY); ctx.stroke();
      } else {
        drawCircleEye(eyeLX, eyeY, eyeR*.9);
        drawCircleEye(eyeRX, eyeY, eyeR*.9);
      }

      // Cheeks
      ctx.shadowBlur = 0;
      [[eyeLX-eyeR, S*0.58],[eyeRX+eyeR, S*0.58]].forEach(([cx,cy]) => {
        const cg = ctx.createRadialGradient(cx,cy,1,cx,cy,20);
        cg.addColorStop(0,cheek); cg.addColorStop(1,'transparent');
        ctx.fillStyle=cg; ctx.beginPath(); ctx.arc(cx,cy,20,0,Math.PI*2); ctx.fill();
      });

      // Mouth
      ctx.shadowColor=glow; ctx.shadowBlur=18;
      const mY = S*0.62, mW = (expr==='new_user'||expr==='teaching') ? S*0.2 : S*0.17;
      if (expr==='wrong') {
        ctx.strokeStyle='#fb7185'; ctx.lineWidth=9;
        ctx.beginPath(); ctx.arc(hw, S*0.68, 22, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
      } else if (expr==='no_account') {
        const og = ctx.createRadialGradient(hw,mY,1,hw,mY,14);
        og.addColorStop(0,'#fff'); og.addColorStop(1,col);
        ctx.fillStyle=og; ctx.beginPath(); ctx.arc(hw,mY,14,0,Math.PI*2); ctx.fill();
      } else if (expr==='celebrate') {
        const mg = ctx.createLinearGradient(hw-mW,mY,hw+mW,mY+mOpen);
        mg.addColorStop(0,'#a78bfa'); mg.addColorStop(0.5,'#e879f9'); mg.addColorStop(1,'#06b6d4');
        ctx.fillStyle=mg;
        ctx.beginPath();
        ctx.moveTo(hw-mW,mY);
        ctx.quadraticCurveTo(hw,mY+mOpen*2.2,hw+mW,mY);
        ctx.quadraticCurveTo(hw,mY-4,hw-mW,mY);
        ctx.fill();
      } else {
        const mg = ctx.createLinearGradient(hw-mW,mY,hw+mW,mY+mOpen);
        mg.addColorStop(0,'#fff'); mg.addColorStop(1,col);
        ctx.fillStyle=mg;
        ctx.beginPath();
        ctx.moveTo(hw-mW,mY);
        ctx.quadraticCurveTo(hw,mY+mOpen*1.6,hw+mW,mY);
        ctx.quadraticCurveTo(hw,mY-5,hw-mW,mY);
        ctx.fill();
      }

      // Speaking waveform (only when speaking, max 7 bars)
      if (isSpeakingRef.current) {
        const bCount=7, bW=8, bSpacing=13, startX=hw-(bCount*bSpacing/2);
        for (let i=0;i<bCount;i++) {
          const bh = 8 + Math.abs(Math.sin(t*11+i))*16;
          const rx2=startX+i*bSpacing-bW/2, ry2=S*0.8-bh, rr=2;
          const bg2 = ctx.createLinearGradient(0,ry2,0,S*0.8);
          bg2.addColorStop(0,col); bg2.addColorStop(1,'transparent');
          ctx.fillStyle=bg2; ctx.shadowColor=glow; ctx.shadowBlur=8;
          ctx.beginPath();
          ctx.moveTo(rx2+rr,ry2); ctx.lineTo(rx2+bW-rr,ry2);
          ctx.arcTo(rx2+bW,ry2,rx2+bW,ry2+rr,rr);
          ctx.lineTo(rx2+bW,ry2+bh-rr);
          ctx.arcTo(rx2+bW,ry2+bh,rx2+bW-rr,ry2+bh,rr);
          ctx.lineTo(rx2+rr,ry2+bh);
          ctx.arcTo(rx2,ry2+bh,rx2,ry2+bh-rr,rr);
          ctx.lineTo(rx2,ry2+rr);
          ctx.arcTo(rx2,ry2,rx2+rr,ry2,rr);
          ctx.closePath(); ctx.fill();
        }
        ctx.shadowBlur=0;
      }

      faceTex.needsUpdate = true;
    };

    // ── Animation loop (face canvas drawn every 2 frames) ─────────────
    const clock = new THREE.Clock();

    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      frameCountRef.current++;
      const t = clock.getElapsedTime();
      const expr = expressionRef.current;

      // Lerp mouse
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      const bob = Math.sin(t * 2.2) * 0.13;

      // ── Orbit rings (fade in/out) ──────────────────────────────────
      const isExplain = expr==='explain'||expr==='teaching'||expr==='thinking';
      const isCelebrate = expr==='celebrate';
      orbitMat.opacity  += ((isExplain?0.5:0) - orbitMat.opacity) * 0.06;
      orbit2Mat.opacity += ((isExplain?0.32:0) - orbit2Mat.opacity) * 0.06;
      orbitDot.visible  = isExplain && orbitMat.opacity > 0.08;
      orbitDot2.visible = isExplain && orbitMat.opacity > 0.08;
      if (isExplain) {
        orbitRingMesh.rotation.z = t * 0.52;
        orbitRing2Mesh.rotation.z = -t * 0.36;
        orbitDot.position.set(Math.cos(t*.52)*2, Math.sin(t*.52)*.8, Math.sin(t*.52)*1.0);
        orbitDot2.position.set(Math.cos(-t*.36+Math.PI)*1.8, Math.sin(-t*.36+Math.PI)*.7, Math.sin(-t*.36)*.9);
      }

      // ── Particles ─────────────────────────────────────────────────
      particleMat.opacity += ((isCelebrate?0.82:0) - particleMat.opacity) * 0.06;
      if (isCelebrate && particleMat.opacity > 0.04) {
        const pos = particleGeo.attributes.position.array as Float32Array;
        for (let i=0;i<PARTICLE_COUNT;i++) {
          pLife[i] += pSpeed[i];
          if (pLife[i]>1) {
            pLife[i]=0;
            pos[i*3]=(Math.random()-.5)*2.8;
            pos[i*3+1]=-2.5;
            pos[i*3+2]=(Math.random()-.5)*1.5;
          }
          pos[i*3+1] += pSpeed[i]*.8;
        }
        particleGeo.attributes.position.needsUpdate = true;
      }

      // ── Antenna ring pulse ─────────────────────────────────────────
      const ringS = 1 + Math.sin(t*5)*.18;
      antRing.scale.setScalar(ringS);
      (antRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(t*5)*.28;

      // ── Thruster pulse ─────────────────────────────────────────────
      thrLight.intensity = 2.8 + Math.sin(t*5)*.8;

      // ── Expression-driven transforms ───────────────────────────────
      if (expr === 'celebrate') {
        rightArmGroup.rotation.z = 1.3 + Math.sin(t*3)*.18;
        leftArmGroup.rotation.z  = -1.3 - Math.sin(t*3)*.18;
        headGroup.rotation.z = Math.sin(t*2.2)*.09;
        headGroup.rotation.x = -0.04;
        headGroup.rotation.y = mouseRef.current.x*.15;
        robotRoot.rotation.y = mouseRef.current.x*.38;
        robotRoot.rotation.x = -mouseRef.current.y*.28;
        robotRoot.position.y = bob + Math.sin(t*2.4)*.08;
      } else if (expr === 'teaching') {
        rightArmGroup.rotation.z = 1.1 + Math.sin(t*2)*.06;
        rightArmGroup.rotation.x = -0.5;
        leftArmGroup.rotation.z  = Math.sin(t*2.5)*.07;
        leftArmGroup.rotation.x  = 0;
        headGroup.rotation.z = Math.sin(t*1.8)*.05;
        headGroup.rotation.x = -0.08;
        headGroup.rotation.y = mouseRef.current.x*.2;
        robotRoot.rotation.y = mouseRef.current.x*.36;
        robotRoot.rotation.x = -mouseRef.current.y*.26;
        robotRoot.position.y = bob;
      } else if (isSpinningRef.current) {
        spinProgressRef.current += 0.12;
        robotRoot.rotation.y += 0.2;
        robotRoot.position.y = bob + Math.abs(Math.sin(spinProgressRef.current))*.4;
        rightArmGroup.rotation.z = 1.2 + Math.sin(t*12)*.3;
        leftArmGroup.rotation.z  = -1.2 - Math.sin(t*12)*.3;
        headGroup.rotation.z = Math.sin(t*10)*.16;
        if (spinProgressRef.current >= Math.PI*2) {
          isSpinningRef.current = false; spinProgressRef.current = 0;
          robotRoot.rotation.y = peekingHorizontal ? (peekingSide==='left'?.35:-.35) : 0;
        }
      } else {
        const baseY = peekingHorizontal ? (peekingSide==='left'?.35:-.35) : 0;
        robotRoot.rotation.y = baseY + mouseRef.current.x*.42;
        robotRoot.rotation.x = -mouseRef.current.y*.32;
        robotRoot.position.y = bob;

        // Head
        if (expr==='wrong') {
          headGroup.rotation.y = Math.sin(t*15)*.2;
          headGroup.rotation.z = Math.sin(t*7)*.04;
          headGroup.rotation.x = 0.12;
        } else if (expr==='no_account') {
          headGroup.rotation.y = Math.sin(t*2)*.1;
          headGroup.rotation.z = 0.24 + Math.sin(t*2.5)*.04;
          headGroup.rotation.x = -0.05;
        } else if (expr==='new_user') {
          headGroup.rotation.z = Math.sin(t*4)*.1;
          headGroup.rotation.x = Math.sin(t*3)*.05;
          headGroup.rotation.y = mouseRef.current.x*.18;
        } else if (expr==='explain') {
          headGroup.rotation.z = Math.sin(t*1.8)*.04;
          headGroup.rotation.x = -0.06;
          headGroup.rotation.y = mouseRef.current.x*.16;
        } else {
          headGroup.rotation.z = Math.sin(t*1.4)*.03 + mouseRef.current.x*.09;
          headGroup.rotation.x = Math.sin(t*1.9)*.025 - mouseRef.current.y*.13;
          headGroup.rotation.y = 0;
        }

        // Arms
        if (expr==='wrong') {
          rightArmGroup.rotation.z = -0.5+Math.sin(t*8)*.07;
          leftArmGroup.rotation.z  = 0.5-Math.sin(t*8)*.07;
        } else if (expr==='no_account') {
          leftArmGroup.rotation.z  = 1.0+Math.sin(t*3)*.07;
          rightArmGroup.rotation.z = -0.14;
        } else if (expr==='new_user') {
          rightArmGroup.rotation.z = 0.72+Math.sin(t*8)*.28;
          leftArmGroup.rotation.z  = -0.72-Math.sin(t*8)*.28;
        } else if (expr==='explain') {
          rightArmGroup.rotation.z = 0.58+Math.sin(t*2)*.09;
          leftArmGroup.rotation.z  = Math.sin(t*1.8)*.06;
        } else {
          const ws = (expr==='wave'||isSpeakingRef.current) ? 7.2 : 3.8;
          rightArmGroup.rotation.z = Math.sin(t*ws)*.2;
          leftArmGroup.rotation.z  = Math.sin(t*2)*.05;
        }
      }

      // Draw face canvas every 2nd frame to halve texture-upload cost
      if (frameCountRef.current % 2 === 0) {
        drawFace(t);
      }

      renderer.render(scene, camera);
    };

    animate();

    const ro = new ResizeObserver(() => {
      const w2 = container.clientWidth; const h2 = container.clientHeight;
      if (!w2 || !h2) return;
      camera.aspect = w2/h2; camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
      // Dispose only instance-owned resources
      [bodyMat, accentMat, chromeMat, visorMat, cyanMat, accentGlow,
       faceMat, orbitMat, orbit2Mat, particleMat].forEach(m => m.dispose());
      faceTex.dispose();
      particleGeo.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size]);

  const sizeClass = { xs:'w-14 h-14', sm:'w-28 h-28', md:'w-44 h-44', lg:'w-60 h-60' }[size];

  return (
    <div
      ref={mountRef}
      onClick={triggerSpin}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={`relative cursor-pointer select-none ${sizeClass} ${className}`}
      style={{ willChange: 'transform' }}
      aria-label="Nova 3D AI Guide Robot"
    >
      {showBackground && (
        <div className="absolute inset-0 m-auto w-3/4 h-3/4 rounded-full bg-cyan-500/12 blur-2xl pointer-events-none -z-10" />
      )}
    </div>
  );
};
