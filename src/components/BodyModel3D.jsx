import React, { useEffect, useRef, useState } from 'react';
import T from '../utils/tokens';
import { BodyMap } from './Shared';

const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';

// Site positions tuned to match the body geometry below
const SITE_3D_POSITIONS = {
  'abd-left':       { x: -0.15, y: 0.45, z: 0.28, label: 'Left Abdomen' },
  'abd-right':      { x:  0.15, y: 0.45, z: 0.28, label: 'Right Abdomen' },
  'abd-upper-left': { x: -0.10, y: 0.65, z: 0.30, label: 'Upper Left Abdomen' },
  'abd-upper-right':{ x:  0.10, y: 0.65, z: 0.30, label: 'Upper Right Abdomen' },
  'thigh-left':     { x: -0.18, y: -0.30, z: 0.14, label: 'Left Thigh' },
  'thigh-right':    { x:  0.18, y: -0.30, z: 0.14, label: 'Right Thigh' },
  'delt-left':      { x: -0.46, y: 1.15, z: 0.0, label: 'Left Delt' },
  'delt-right':     { x:  0.46, y: 1.15, z: 0.0, label: 'Right Delt' },
  'glute-left':     { x: -0.18, y: 0.12, z: -0.22, label: 'Left Glute' },
  'glute-right':    { x:  0.18, y: 0.12, z: -0.22, label: 'Right Glute' },
  'lat-left':       { x: -0.34, y: 0.85, z: -0.10, label: 'Left Lat' },
  'lat-right':      { x:  0.34, y: 0.85, z: -0.10, label: 'Right Lat' },
  'calf-left':      { x: -0.18, y: -0.88, z: 0.08, label: 'Left Calf' },
  'calf-right':     { x:  0.18, y: -0.88, z: 0.08, label: 'Right Calf' },
};

// Major nerves relevant to injection sites — paths defined as arrays of [x, y, z] points
const NERVE_PATHS = {
  // Lateral femoral cutaneous — runs down outer thigh (avoid for thigh injections)
  'lat-fem-cut-L': { label: 'Lat. Femoral Cutaneous', side: 'front', points: [[-0.28, 0.18, 0.10], [-0.28, 0.02, 0.14], [-0.26, -0.18, 0.16], [-0.25, -0.42, 0.14]], color: 0xf0d060 },
  'lat-fem-cut-R': { label: 'Lat. Femoral Cutaneous', side: 'front', points: [[0.28, 0.18, 0.10], [0.28, 0.02, 0.14], [0.26, -0.18, 0.16], [0.25, -0.42, 0.14]], color: 0xf0d060 },
  // Femoral nerve — medial thigh (avoid for thigh injections)
  'femoral-L': { label: 'Femoral N.', side: 'front', points: [[-0.12, 0.20, 0.14], [-0.12, 0.04, 0.18], [-0.10, -0.16, 0.18], [-0.10, -0.40, 0.16]], color: 0xf0d060 },
  'femoral-R': { label: 'Femoral N.', side: 'front', points: [[0.12, 0.20, 0.14], [0.12, 0.04, 0.18], [0.10, -0.16, 0.18], [0.10, -0.40, 0.16]], color: 0xf0d060 },
  // Sciatic nerve — posterior thigh/glute (avoid for glute injections)
  'sciatic-L': { label: 'Sciatic N.', side: 'back', points: [[-0.14, 0.16, -0.22], [-0.15, 0.02, -0.20], [-0.16, -0.18, -0.16], [-0.16, -0.44, -0.12], [-0.16, -0.60, -0.08]], color: 0xf07040 },
  'sciatic-R': { label: 'Sciatic N.', side: 'back', points: [[0.14, 0.16, -0.22], [0.15, 0.02, -0.20], [0.16, -0.18, -0.16], [0.16, -0.44, -0.12], [0.16, -0.60, -0.08]], color: 0xf07040 },
  // Axillary nerve — wraps around deltoid (avoid for delt injections)
  'axillary-L': { label: 'Axillary N.', side: 'front', points: [[-0.36, 1.24, -0.04], [-0.44, 1.16, 0.02], [-0.48, 1.06, 0.00], [-0.44, 0.96, -0.06]], color: 0xf0d060 },
  'axillary-R': { label: 'Axillary N.', side: 'front', points: [[0.36, 1.24, -0.04], [0.44, 1.16, 0.02], [0.48, 1.06, 0.00], [0.44, 0.96, -0.06]], color: 0xf0d060 },
  // Radial nerve — lateral arm (nearby delt/lat sites)
  'radial-L': { label: 'Radial N.', side: 'back', points: [[-0.42, 1.10, -0.06], [-0.46, 0.92, -0.04], [-0.48, 0.74, -0.02], [-0.50, 0.56, 0.00]], color: 0xf0d060 },
  'radial-R': { label: 'Radial N.', side: 'back', points: [[0.42, 1.10, -0.06], [0.46, 0.92, -0.04], [0.48, 0.74, -0.02], [0.50, 0.56, 0.00]], color: 0xf0d060 },
  // Superior gluteal nerve — upper glute (avoid for glute injections)
  'sup-glut-L': { label: 'Sup. Gluteal N.', side: 'back', points: [[-0.06, 0.22, -0.20], [-0.18, 0.24, -0.24], [-0.30, 0.22, -0.20]], color: 0xf07040 },
  'sup-glut-R': { label: 'Sup. Gluteal N.', side: 'back', points: [[0.06, 0.22, -0.20], [0.18, 0.24, -0.24], [0.30, 0.22, -0.20]], color: 0xf07040 },
  // Sural nerve — posterior calf (avoid for calf injections)
  'sural-L': { label: 'Sural N.', side: 'back', points: [[-0.18, -0.54, -0.08], [-0.19, -0.72, -0.06], [-0.20, -0.90, -0.04], [-0.20, -1.02, -0.02]], color: 0xf0d060 },
  'sural-R': { label: 'Sural N.', side: 'back', points: [[0.18, -0.54, -0.08], [0.19, -0.72, -0.06], [0.20, -0.90, -0.04], [0.20, -1.02, -0.02]], color: 0xf0d060 },

  // ──── ABDOMINAL NERVES (smaller, subcutaneous injection-relevant) ────
  // Intercostal nerves T7-T12 — run laterally across abdomen (avoid hitting during subQ)
  'intercostal-T8-L': { label: 'T8 Intercostal', side: 'front', points: [[-0.34, 0.82, 0.18], [-0.26, 0.78, 0.26], [-0.16, 0.76, 0.28], [-0.06, 0.74, 0.28]], color: 0xe8c850 },
  'intercostal-T8-R': { label: 'T8 Intercostal', side: 'front', points: [[0.34, 0.82, 0.18], [0.26, 0.78, 0.26], [0.16, 0.76, 0.28], [0.06, 0.74, 0.28]], color: 0xe8c850 },
  'intercostal-T10-L': { label: 'T10 Intercostal', side: 'front', points: [[-0.30, 0.66, 0.22], [-0.22, 0.62, 0.28], [-0.14, 0.58, 0.30], [-0.04, 0.56, 0.30]], color: 0xe8c850 },
  'intercostal-T10-R': { label: 'T10 Intercostal', side: 'front', points: [[0.30, 0.66, 0.22], [0.22, 0.62, 0.28], [0.14, 0.58, 0.30], [0.04, 0.56, 0.30]], color: 0xe8c850 },
  'intercostal-T12-L': { label: 'Subcostal (T12)', side: 'front', points: [[-0.28, 0.52, 0.20], [-0.20, 0.48, 0.26], [-0.12, 0.44, 0.28], [-0.04, 0.42, 0.28]], color: 0xe8c850 },
  'intercostal-T12-R': { label: 'Subcostal (T12)', side: 'front', points: [[0.28, 0.52, 0.20], [0.20, 0.48, 0.26], [0.12, 0.44, 0.28], [0.04, 0.42, 0.28]], color: 0xe8c850 },
  // Iliohypogastric nerve — lower abdomen, runs above inguinal ligament
  'iliohypo-L': { label: 'Iliohypogastric N.', side: 'front', points: [[-0.26, 0.34, 0.16], [-0.20, 0.32, 0.24], [-0.14, 0.30, 0.26], [-0.06, 0.28, 0.26]], color: 0xf09040 },
  'iliohypo-R': { label: 'Iliohypogastric N.', side: 'front', points: [[0.26, 0.34, 0.16], [0.20, 0.32, 0.24], [0.14, 0.30, 0.26], [0.06, 0.28, 0.26]], color: 0xf09040 },
  // Ilioinguinal nerve — lower abdomen near groin crease
  'ilioinguinal-L': { label: 'Ilioinguinal N.', side: 'front', points: [[-0.24, 0.26, 0.14], [-0.18, 0.22, 0.22], [-0.12, 0.20, 0.24], [-0.06, 0.18, 0.24]], color: 0xf09040 },
  'ilioinguinal-R': { label: 'Ilioinguinal N.', side: 'front', points: [[0.24, 0.26, 0.14], [0.18, 0.22, 0.22], [0.12, 0.20, 0.24], [0.06, 0.18, 0.24]], color: 0xf09040 },
  // Thoracodorsal nerve — posterior, lateral trunk near lat injection sites
  'thoracodorsal-L': { label: 'Thoracodorsal N.', side: 'back', points: [[-0.28, 1.04, -0.14], [-0.32, 0.90, -0.16], [-0.34, 0.76, -0.14], [-0.32, 0.62, -0.12]], color: 0xf0d060 },
  'thoracodorsal-R': { label: 'Thoracodorsal N.', side: 'back', points: [[0.28, 1.04, -0.14], [0.32, 0.90, -0.16], [0.34, 0.76, -0.14], [0.32, 0.62, -0.12]], color: 0xf0d060 },
};

function getSiteColor(siteId, siteAnalysis) {
  const data = siteAnalysis?.[siteId];
  if (!data) return 0x2a3040;
  const { status, avgQuality } = data;
  if (status === 'rest') return 0xdc5050;
  if (status === 'overused') return 0xffb432;
  if (status === 'fresh') return 0x00d2b4;
  if (avgQuality >= 4.5) return 0x5cb870;
  if (avgQuality >= 3.5) return 0xc9a84c;
  if (avgQuality >= 2.5) return 0xffb432;
  return 0xdc5050;
}

function getSiteOpacity(siteId, siteAnalysis, suggestedSite) {
  if (suggestedSite === siteId) return 1.0;
  const data = siteAnalysis?.[siteId];
  if (!data) return 0.35;
  if (data.status === 'overused' || data.status === 'rest') return 0.85;
  return 0.6;
}

function loadThree() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('no window')); return; }
    if (window.THREE) { resolve(window.THREE); return; }
    const existing = document.querySelector('script[data-three-r128]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.THREE));
      existing.addEventListener('error', () => reject(new Error('script error')));
      return;
    }
    const s = document.createElement('script');
    s.src = THREE_CDN;
    s.async = true;
    s.setAttribute('data-three-r128', 'true');
    s.onload = () => resolve(window.THREE);
    s.onerror = () => reject(new Error('script error'));
    document.head.appendChild(s);
  });
}

function Spinner() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: '100%' }}>
      <svg width='36' height='36' viewBox='0 0 36 36' style={{ animation: 'bm3d-spin 1.4s linear infinite' }}>
        <circle cx='18' cy='18' r='15' fill='none' stroke={T.gold} strokeWidth='1.5' strokeDasharray='60 30' opacity='0.8' />
      </svg>
      <div style={{ fontSize: 11, color: T.t3, fontFamily: T.fm, letterSpacing: 1 }}>Loading 3D view...</div>
      <style>{'@keyframes bm3d-spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}

export default function BodyModel3D({ siteHistory, siteAnalysis, suggestedSite, selectedSite, onSiteSelect, width, height = 340 }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const sceneStateRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const [labelSiteId, setLabelSiteId] = useState(null);
  const [labelPos, setLabelPos] = useState({ x: 0, y: 0 });
  const [view, setView] = useState('front');
  const [showNerves, setShowNerves] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const labelTimerRef = useRef(null);

  const fallbackSuggested = React.useMemo(() => (
    suggestedSite ? { id: suggestedSite, label: SITE_3D_POSITIONS[suggestedSite]?.label || suggestedSite } : null
  ), [suggestedSite]);

  useEffect(() => {
    let cancelled = false;
    loadThree().then((THREE) => {
      if (cancelled || !canvasRef.current) return;
      initScene(THREE);
      setStatus('ready');
    }).catch(() => {
      if (!cancelled) setStatus('error');
    });
    return () => { cancelled = true; };
  }, []);

  const initScene = (THREE) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const w = container.clientWidth || width || 360;
    const h = height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(0, 0.3, 5.8);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h, false);
    renderer.setClearColor(0x000000, 0);

    // Soft even studio lighting
    scene.add(new THREE.AmbientLight(0xc0c4cc, 1.4));
    const key = new THREE.DirectionalLight(0xffffff, 0.7); key.position.set(2, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xd8e0ea, 0.45); fill.position.set(-3, 2, 3); scene.add(fill);
    const rim = new THREE.DirectionalLight(0xe0d8c8, 0.35); rim.position.set(0, 2, -4); scene.add(rim);
    const under = new THREE.DirectionalLight(0xc8c4c0, 0.2); under.position.set(0, -3, 2); scene.add(under);

    const bodyGroup = new THREE.Group();
    scene.add(bodyGroup);

    // Smooth matte mannequin material
    const S = 24; // sphere segments for smooth organic look
    const C = 16; // cylinder segments
    const mkMat = (hex) => new THREE.MeshStandardMaterial({ color: hex, metalness: 0.02, roughness: 0.72 });

    // Color palette - warm neutral mannequin
    const skin = 0xc8ad92;
    const skinL = 0xd4b89e;
    const skinD = 0xb09880;

    const parts = [];
    const add = (geo, mat, pos, rot, scl) => {
      const m = new THREE.Mesh(geo, mat);
      if (pos) m.position.set(pos[0], pos[1], pos[2]);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      if (scl) m.scale.set(scl[0], scl[1], scl[2]);
      bodyGroup.add(m);
      parts.push(m);
    };

    // ──── HEAD ────
    add(new THREE.SphereGeometry(0.26, S, S), mkMat(skinL), [0, 1.72, 0], null, [0.92, 1.05, 0.88]);
    // Jaw
    add(new THREE.SphereGeometry(0.15, S, S), mkMat(skinL), [0, 1.56, 0.04], null, [0.78, 0.55, 0.68]);

    // ──── NECK ────
    add(new THREE.CylinderGeometry(0.09, 0.11, 0.16, C), mkMat(skin), [0, 1.44, 0]);

    // ──── TORSO - built from overlapping ellipsoids for smooth organic shape ────
    // Upper chest / shoulders
    add(new THREE.SphereGeometry(0.38, S, S), mkMat(skin), [0, 1.12, 0], null, [1.05, 0.55, 0.58]);
    // Mid chest
    add(new THREE.SphereGeometry(0.34, S, S), mkMat(skin), [0, 0.92, 0], null, [1.0, 0.5, 0.56]);
    // Core / abdomen
    add(new THREE.SphereGeometry(0.30, S, S), mkMat(skin), [0, 0.68, 0], null, [0.96, 0.52, 0.54]);
    // Lower abdomen
    add(new THREE.SphereGeometry(0.28, S, S), mkMat(skin), [0, 0.48, 0], null, [0.94, 0.42, 0.52]);
    // Pelvis - wide and flat, wraps around to hips
    add(new THREE.SphereGeometry(0.30, S, S), mkMat(skin), [0, 0.28, 0], null, [1.0, 0.4, 0.52]);

    // ──── SHOULDERS ────
    add(new THREE.SphereGeometry(0.13, S, S), mkMat(skin), [-0.40, 1.18, 0], null, [1.0, 0.9, 0.85]);
    add(new THREE.SphereGeometry(0.13, S, S), mkMat(skin), [ 0.40, 1.18, 0], null, [1.0, 0.9, 0.85]);

    // ──── LEFT ARM ────
    // Upper arm - tapered cylinder with sphere caps
    add(new THREE.SphereGeometry(0.10, S, S), mkMat(skinD), [-0.44, 1.12, 0]); // shoulder joint
    add(new THREE.CylinderGeometry(0.09, 0.08, 0.48, C), mkMat(skin), [-0.46, 0.84, 0], [0, 0, 0.12]);
    add(new THREE.SphereGeometry(0.08, S, S), mkMat(skinD), [-0.48, 0.58, 0]); // elbow
    add(new THREE.CylinderGeometry(0.075, 0.06, 0.44, C), mkMat(skin), [-0.50, 0.33, 0], [0, 0, 0.08]);
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinD), [-0.52, 0.08, 0]); // wrist
    // Hand
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinL), [-0.53, -0.02, 0], null, [0.65, 0.9, 0.45]);

    // ──── RIGHT ARM (mirror) ────
    add(new THREE.SphereGeometry(0.10, S, S), mkMat(skinD), [0.44, 1.12, 0]);
    add(new THREE.CylinderGeometry(0.09, 0.08, 0.48, C), mkMat(skin), [0.46, 0.84, 0], [0, 0, -0.12]);
    add(new THREE.SphereGeometry(0.08, S, S), mkMat(skinD), [0.48, 0.58, 0]);
    add(new THREE.CylinderGeometry(0.075, 0.06, 0.44, C), mkMat(skin), [0.50, 0.33, 0], [0, 0, -0.08]);
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinD), [0.52, 0.08, 0]);
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinL), [0.53, -0.02, 0], null, [0.65, 0.9, 0.45]);

    // ──── LEFT LEG ────
    add(new THREE.SphereGeometry(0.10, S, S), mkMat(skinD), [-0.18, 0.08, 0]); // hip joint
    // Upper thigh - thick tapered
    add(new THREE.CylinderGeometry(0.13, 0.10, 0.52, C), mkMat(skin), [-0.18, -0.22, 0]);
    add(new THREE.SphereGeometry(0.09, S, S), mkMat(skinD), [-0.18, -0.50, 0]); // knee
    // Shin
    add(new THREE.CylinderGeometry(0.085, 0.065, 0.52, C), mkMat(skin), [-0.18, -0.78, 0]);
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinD), [-0.18, -1.06, 0]); // ankle
    // Foot
    add(new THREE.SphereGeometry(0.07, S, S), mkMat(skin), [-0.18, -1.14, 0.04], null, [0.75, 0.45, 1.3]);

    // ──── RIGHT LEG (mirror) ────
    add(new THREE.SphereGeometry(0.10, S, S), mkMat(skinD), [0.18, 0.08, 0]);
    add(new THREE.CylinderGeometry(0.13, 0.10, 0.52, C), mkMat(skin), [0.18, -0.22, 0]);
    add(new THREE.SphereGeometry(0.09, S, S), mkMat(skinD), [0.18, -0.50, 0]);
    add(new THREE.CylinderGeometry(0.085, 0.065, 0.52, C), mkMat(skin), [0.18, -0.78, 0]);
    add(new THREE.SphereGeometry(0.06, S, S), mkMat(skinD), [0.18, -1.06, 0]);
    add(new THREE.SphereGeometry(0.07, S, S), mkMat(skin), [0.18, -1.14, 0.04], null, [0.75, 0.45, 1.3]);

    // ──── INJECTION SITE SPHERES ────
    const siteMeshes = [];
    Object.entries(SITE_3D_POSITIONS).forEach(([siteId, pos]) => {
      const color = getSiteColor(siteId, siteAnalysis);
      const mat = new THREE.MeshStandardMaterial({
        color, metalness: 0.3, roughness: 0.4, transparent: true,
        opacity: getSiteOpacity(siteId, siteAnalysis, suggestedSite),
        emissive: color, emissiveIntensity: 0.3,
      });
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.065, 12, 10), mat);
      m.position.set(pos.x, pos.y, pos.z);
      m.userData.siteId = siteId;
      bodyGroup.add(m);
      siteMeshes.push(m);
    });

    // ──── NERVE PATHS ────
    const nerveGroup = new THREE.Group();
    nerveGroup.visible = false;
    bodyGroup.add(nerveGroup);

    const nerveLabelMeshes = [];
    Object.entries(NERVE_PATHS).forEach(([nerveId, nerve]) => {
      // Create curve from points
      const curvePoints = nerve.points.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const curve = new THREE.CatmullRomCurve3(curvePoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.012, 6, false);
      const tubeMat = new THREE.MeshStandardMaterial({
        color: nerve.color, metalness: 0.1, roughness: 0.5,
        transparent: true, opacity: 0.85, emissive: nerve.color, emissiveIntensity: 0.4,
      });
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      nerveGroup.add(tubeMesh);

      // Small sphere at each vertex for visibility
      nerve.points.forEach(p => {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 8, 6),
          new THREE.MeshStandardMaterial({
            color: nerve.color, emissive: nerve.color, emissiveIntensity: 0.5,
            transparent: true, opacity: 0.9,
          })
        );
        dot.position.set(p[0], p[1], p[2]);
        nerveGroup.add(dot);
      });

      // Label anchor at midpoint
      const mid = nerve.points[Math.floor(nerve.points.length / 2)];
      nerveLabelMeshes.push({ id: nerveId, label: nerve.label, side: nerve.side, pos: mid, color: nerve.color });
    });

    // Suggested site glow
    const glowMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xc9a84c, transparent: true, opacity: 0.2 })
    );
    glowMesh.visible = false;
    bodyGroup.add(glowMesh);

    // Selection ring
    const ringMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.075, 0.095, 20),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, side: THREE.DoubleSide })
    );
    ringMesh.visible = false;
    scene.add(ringMesh);

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const DEFAULT_CAM_Z = 5.8;
    const MIN_CAM_Z = 2.4;
    const MAX_CAM_Z = 8.0;

    const state = {
      THREE, scene, camera, renderer, bodyGroup, parts, siteMeshes, glowMesh, ringMesh,
      nerveGroup, nerveLabelMeshes,
      raycaster, mouse,
      rotationY: 0, animating: false, animStart: 0, animFrom: 0, animTo: 0,
      camZ: DEFAULT_CAM_Z, targetCamZ: DEFAULT_CAM_Z, defaultCamZ: DEFAULT_CAM_Z, minCamZ: MIN_CAM_Z, maxCamZ: MAX_CAM_Z,
      camY: 0.3, targetCamY: 0.3, defaultCamY: 0.3, viewBase: 0,
      animationId: null, width: w, height: h,
    };
    state.onZoomChange = (zoomed) => setIsZoomed(zoomed);
    sceneStateRef.current = state;

    // ──── Render loop (no drag rotation, just front/back animation + glow) ────
    const render = () => {
      state.animationId = requestAnimationFrame(render);
      const now = Date.now();

      if (state.animating) {
        const t = Math.min(1, (now - state.animStart) / 500);
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        state.rotationY = state.animFrom + (state.animTo - state.animFrom) * eased;
        if (t >= 1) state.animating = false;
      }
      bodyGroup.rotation.y = state.rotationY;

      // Smooth zoom interpolation
      if (Math.abs(state.camZ - state.targetCamZ) > 0.01) {
        state.camZ += (state.targetCamZ - state.camZ) * 0.12;
        camera.position.z = state.camZ;
        if (state.onZoomChange) state.onZoomChange(state.camZ < state.defaultCamZ - 0.3);
      }
      if (Math.abs(state.camY - state.targetCamY) > 0.005) {
        state.camY += (state.targetCamY - state.camY) * 0.12;
        camera.position.y = state.camY;
      }

      if (glowMesh.visible) {
        const tt = now * 0.002;
        glowMesh.material.opacity = 0.1 + Math.sin(tt) * 0.15;
        glowMesh.scale.setScalar(1 + Math.sin(tt) * 0.1);
      }

      if (ringMesh.visible) {
        ringMesh.lookAt(camera.position);
      }

      renderer.render(scene, camera);
    };
    render();

    // ──── Interaction: tap to select + drag to rotate (limited) ────
    const canvasEl = canvas;
    const MAX_DRAG_ANGLE = Math.PI / 4; // 45 degrees each way from base view
    let dragStartX = 0;
    let dragStartRotation = 0;
    let isDragging = false;
    let didDrag = false;

    const onPointerDown = (e) => {
      // Only single-finger / left-click drag
      if (e.touches && e.touches.length > 1) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      dragStartX = clientX;
      dragStartRotation = state.rotationY;
      isDragging = true;
      didDrag = false;
    };
    const onPointerMove = (e) => {
      if (!isDragging) return;
      if (e.touches && e.touches.length > 1) { isDragging = false; return; }
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const dx = clientX - dragStartX;
      if (Math.abs(dx) > 4) didDrag = true;
      if (!didDrag) return;
      const baseAngle = state.viewBase || 0; // 0 for front, PI for back
      const rawAngle = dragStartRotation + dx * 0.006;
      // Clamp to ±45° from current base view
      state.rotationY = Math.max(baseAngle - MAX_DRAG_ANGLE, Math.min(baseAngle + MAX_DRAG_ANGLE, rawAngle));
      state.animating = false; // cancel any ongoing front/back animation
    };
    const onPointerUp = (e) => {
      isDragging = false;
      if (!didDrag) {
        // It was a tap, not a drag — do site selection
        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const rect = canvasEl.getBoundingClientRect();
        mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(siteMeshes);
        if (hits.length > 0) {
          const siteId = hits[0].object.userData.siteId;
          showLabel(siteId);
          if (onSiteSelect) onSiteSelect(siteId);
        }
      }
    };
    // ──── Mouse: drag to rotate + click to select ────
    canvasEl.addEventListener('mousedown', onPointerDown);
    canvasEl.addEventListener('mousemove', onPointerMove);
    canvasEl.addEventListener('mouseup', onPointerUp);

    // ──── Scroll wheel zoom ────
    const onWheel = (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.008;
      state.targetCamZ = Math.max(state.minCamZ, Math.min(state.maxCamZ, state.targetCamZ + delta));
      const zoomPct = 1 - (state.targetCamZ - state.minCamZ) / (state.maxCamZ - state.minCamZ);
      state.targetCamY = state.defaultCamY + zoomPct * 0.15;
    };
    canvasEl.addEventListener('wheel', onWheel, { passive: false });

    // ──── Unified touch: 1-finger drag + 2-finger pinch zoom + tap to select ────
    let lastPinchDist = 0;
    const onUnifiedTouchStart = (e) => {
      if (e.touches.length === 2) {
        isDragging = false; // cancel drag if second finger added
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      } else if (e.touches.length === 1) {
        onPointerDown(e);
      }
    };
    const onUnifiedTouchMove = (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (lastPinchDist > 0) {
          const delta = (lastPinchDist - dist) * 0.02;
          state.targetCamZ = Math.max(state.minCamZ, Math.min(state.maxCamZ, state.targetCamZ + delta));
          const zoomPct = 1 - (state.targetCamZ - state.minCamZ) / (state.maxCamZ - state.minCamZ);
          state.targetCamY = state.defaultCamY + zoomPct * 0.15;
        }
        lastPinchDist = dist;
      } else if (e.touches.length === 1 && isDragging) {
        onPointerMove(e);
      }
    };
    const onUnifiedTouchEnd = (e) => {
      lastPinchDist = 0;
      if (e.changedTouches && e.touches.length === 0) {
        onPointerUp(e);
      }
    };
    canvasEl.addEventListener('touchstart', onUnifiedTouchStart, { passive: true });
    canvasEl.addEventListener('touchmove', onUnifiedTouchMove, { passive: false });
    canvasEl.addEventListener('touchend', onUnifiedTouchEnd);

    state.cleanupInput = () => {
      canvasEl.removeEventListener('mousedown', onPointerDown);
      canvasEl.removeEventListener('mousemove', onPointerMove);
      canvasEl.removeEventListener('mouseup', onPointerUp);
      canvasEl.removeEventListener('wheel', onWheel);
      canvasEl.removeEventListener('touchstart', onUnifiedTouchStart);
      canvasEl.removeEventListener('touchmove', onUnifiedTouchMove);
      canvasEl.removeEventListener('touchend', onUnifiedTouchEnd);
    };

    // Resize
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth || w;
      state.width = nw;
      camera.aspect = nw / h;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, h, false);
    });
    ro.observe(container);
    state.resizeObserver = ro;

    updateSuggested(state, suggestedSite);
    updateSelected(state, selectedSite);
  };

  const showLabel = (siteId) => {
    setLabelSiteId(siteId);
    if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
    labelTimerRef.current = setTimeout(() => setLabelSiteId(null), 2500);
  };

  // Label screen position
  useEffect(() => {
    if (!labelSiteId) return;
    let id;
    const tick = () => {
      const s = sceneStateRef.current;
      if (s && s.THREE) {
        const pos = SITE_3D_POSITIONS[labelSiteId];
        if (pos) {
          const v = new s.THREE.Vector3(pos.x, pos.y, pos.z);
          s.bodyGroup.localToWorld(v);
          v.project(s.camera);
          setLabelPos({ x: ((v.x + 1) / 2) * s.width, y: ((-v.y + 1) / 2) * s.height });
        }
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [labelSiteId]);

  // Update site colors
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    s.siteMeshes.forEach(m => {
      const siteId = m.userData.siteId;
      const color = getSiteColor(siteId, siteAnalysis);
      m.material.color.setHex(color);
      m.material.emissive.setHex(color);
      m.material.opacity = getSiteOpacity(siteId, siteAnalysis, suggestedSite);
      m.material.needsUpdate = true;
    });
  }, [siteAnalysis, suggestedSite]);

  useEffect(() => {
    const s = sceneStateRef.current;
    if (s) updateSuggested(s, suggestedSite);
  }, [suggestedSite]);

  useEffect(() => {
    const s = sceneStateRef.current;
    if (s) updateSelected(s, selectedSite);
  }, [selectedSite]);

  // Nerve overlay toggle
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s || !s.nerveGroup) return;
    s.nerveGroup.visible = showNerves;
  }, [showNerves]);

  // View toggle
  useEffect(() => {
    const s = sceneStateRef.current;
    if (!s) return;
    const target = view === 'back' ? Math.PI : 0;
    s.viewBase = target;
    s.animating = true;
    s.animStart = Date.now();
    s.animFrom = s.rotationY;
    s.animTo = target;
  }, [view]);

  // Cleanup
  useEffect(() => {
    return () => {
      const s = sceneStateRef.current;
      if (!s) return;
      if (s.animationId) cancelAnimationFrame(s.animationId);
      if (s.cleanupInput) s.cleanupInput();
      if (s.resizeObserver) s.resizeObserver.disconnect();
      s.scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
      s.renderer.dispose();
      if (labelTimerRef.current) clearTimeout(labelTimerRef.current);
      sceneStateRef.current = null;
    };
  }, []);

  if (status === 'error') {
    return (
      <BodyMap
        siteHistory={siteHistory}
        onTapSite={(id) => onSiteSelect && onSiteSelect(id)}
        suggestedSite={fallbackSuggested}
        siteAnalysis={siteAnalysis}
      />
    );
  }

  const analysisForLabel = labelSiteId && siteAnalysis ? siteAnalysis[labelSiteId] : null;
  const labelInfo = labelSiteId ? SITE_3D_POSITIONS[labelSiteId] : null;

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Front / Back / Nerves toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
        {['front', 'back'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            background: view === v ? T.goldS : 'transparent',
            border: '1px solid ' + (view === v ? T.goldM : T.border),
            color: view === v ? T.gold : T.t3,
            fontFamily: T.fm, fontSize: 10, letterSpacing: 1,
            textTransform: 'uppercase', padding: '4px 14px',
            borderRadius: 999, cursor: 'pointer',
          }}>{v}</button>
        ))}
        <div style={{ width: 1, height: 16, background: T.border, margin: '0 2px' }} />
        <button onClick={() => setShowNerves(!showNerves)} style={{
          background: showNerves ? 'rgba(240,208,96,0.12)' : 'transparent',
          border: '1px solid ' + (showNerves ? 'rgba(240,208,96,0.4)' : T.border),
          color: showNerves ? '#f0d060' : T.t3,
          fontFamily: T.fm, fontSize: 10, letterSpacing: 1,
          textTransform: 'uppercase', padding: '4px 14px',
          borderRadius: 999, cursor: 'pointer',
        }}>Nerves</button>
        {isZoomed && (
          <>
            <div style={{ width: 1, height: 16, background: T.border, margin: '0 2px' }} />
            <button onClick={() => {
              const s = sceneStateRef.current;
              if (s) { s.targetCamZ = s.defaultCamZ; s.targetCamY = s.defaultCamY; setIsZoomed(false); }
            }} style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid ' + T.border,
              color: T.t3, fontFamily: T.fm, fontSize: 10, letterSpacing: 1,
              textTransform: 'uppercase', padding: '4px 10px',
              borderRadius: 999, cursor: 'pointer',
            }}>Reset</button>
          </>
        )}
      </div>

      <div ref={containerRef} style={{
        position: 'relative', width: '100%', maxWidth: 420, height,
        background: 'radial-gradient(ellipse at 50% 55%, rgba(201,168,76,0.04) 0%, transparent 65%)',
        borderRadius: 12, overflow: 'hidden',
      }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

        {status === 'loading' && (
          <div style={{ position: 'absolute', inset: 0 }}><Spinner /></div>
        )}

        {labelSiteId && labelInfo && (
          <div style={{
            position: 'absolute', left: labelPos.x, top: labelPos.y,
            transform: 'translate(-50%, -120%)', background: 'rgba(8,9,11,0.92)',
            border: '1px solid ' + T.border, borderRadius: 8, padding: '8px 12px',
            fontFamily: T.fm, fontSize: 11, pointerEvents: 'none',
            whiteSpace: 'nowrap', zIndex: 10,
          }}>
            <div style={{ color: T.t1, fontSize: 12, fontWeight: 600 }}>{labelInfo.label}</div>
            {analysisForLabel && (
              <>
                <div style={{
                  display: 'inline-block', marginTop: 3, padding: '1px 6px',
                  borderRadius: 4, fontSize: 9, textTransform: 'uppercase', letterSpacing: 1,
                  color: '#' + getSiteColor(labelSiteId, siteAnalysis).toString(16).padStart(6, '0'),
                  border: '1px solid ' + T.border,
                }}>{analysisForLabel.status || 'ok'}</div>
                <div style={{ color: T.t3, fontSize: 10, marginTop: 3 }}>
                  {(analysisForLabel.count14 ?? analysisForLabel.recentCount ?? 0)} uses in 14 days
                </div>
                <div style={{ color: T.t3, fontSize: 10 }}>
                  Avg quality: {analysisForLabel.avgQuality ? analysisForLabel.avgQuality.toFixed(1) : '-'}/5
                </div>
              </>
            )}
            <div style={{ color: T.gold, fontSize: 10, fontStyle: 'italic', marginTop: 3 }}>Tap to log injection</div>
          </div>
        )}

        {/* Nerve labels */}
        {showNerves && <NerveLabels sceneStateRef={sceneStateRef} view={view} />}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {[
          { c: '#00d2b4', l: 'Fresh' },
          { c: '#5cb870', l: 'Good' },
          { c: '#c9a84c', l: 'Monitor' },
          { c: '#ffb432', l: 'Overused' },
          { c: '#dc5050', l: 'Rest' },
        ].map((it, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: it.c, display: 'inline-block' }} />
            <span style={{ fontSize: 9, color: T.t3, fontFamily: T.fm }}>{it.l}</span>
          </div>
        ))}
      </div>
      {!isZoomed && (
        <div style={{ fontSize: 9, color: T.t3, fontFamily: T.fm, marginTop: 4, opacity: 0.5, textAlign: 'center' }}>
          Scroll or pinch to zoom
        </div>
      )}
    </div>
  );
}

function NerveLabels({ sceneStateRef, view }) {
  const [positions, setPositions] = useState([]);

  useEffect(() => {
    let id;
    const tick = () => {
      const s = sceneStateRef.current;
      if (s && s.THREE && s.nerveLabelMeshes) {
        const newPos = [];
        // Deduplicate labels that share the same name on each side
        const seen = new Set();
        s.nerveLabelMeshes.forEach(n => {
          // Show nerves relevant to current view
          const isFront = view === 'front';
          const nerveIsFront = n.side === 'front';
          if (isFront !== nerveIsFront) return;

          // Deduplicate by label per side
          const key = n.label + n.side;
          if (seen.has(key)) return;
          seen.add(key);

          const v = new s.THREE.Vector3(n.pos[0], n.pos[1], n.pos[2]);
          s.bodyGroup.localToWorld(v);
          v.project(s.camera);
          const sx = ((v.x + 1) / 2) * s.width;
          const sy = ((-v.y + 1) / 2) * s.height;
          // Only show if in front of camera
          if (v.z < 1) {
            newPos.push({ label: n.label, x: sx, y: sy, color: n.color });
          }
        });
        setPositions(newPos);
      }
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [view]);

  return (
    <>
      {positions.map((p, i) => (
        <div key={i} style={{
          position: 'absolute', left: p.x, top: p.y,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(8,9,11,0.85)',
          border: '1px solid rgba(' + ((p.color >> 16) & 255) + ',' + ((p.color >> 8) & 255) + ',' + (p.color & 255) + ',0.4)',
          borderRadius: 4, padding: '2px 6px',
          fontFamily: T.fm, fontSize: 8, letterSpacing: 0.5,
          color: '#' + p.color.toString(16).padStart(6, '0'),
          pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 5,
        }}>{p.label}</div>
      ))}
    </>
  );
}

function updateSuggested(state, suggestedSite) {
  if (!state || !state.glowMesh) return;
  if (suggestedSite && SITE_3D_POSITIONS[suggestedSite]) {
    const p = SITE_3D_POSITIONS[suggestedSite];
    state.glowMesh.position.set(p.x, p.y, p.z);
    state.glowMesh.visible = true;
  } else {
    state.glowMesh.visible = false;
  }
}

function updateSelected(state, selectedSite) {
  if (!state || !state.siteMeshes) return;
  state.siteMeshes.forEach(m => {
    if (m.userData.siteId === selectedSite) {
      m.scale.setScalar(1.3);
      state.ringMesh.visible = true;
      const p = SITE_3D_POSITIONS[selectedSite];
      if (p) {
        const v = new state.THREE.Vector3(p.x, p.y, p.z);
        state.bodyGroup.localToWorld(v);
        state.ringMesh.position.copy(v);
      }
    } else {
      m.scale.setScalar(1);
    }
  });
  if (!selectedSite) state.ringMesh.visible = false;
}
