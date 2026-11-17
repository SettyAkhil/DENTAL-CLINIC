import * as THREE from 'three';
import {
  ToothDefinition,
  ToothSurface,
  ADULT_TEETH,
} from '../types/dentalChart.types';

// ==========================================
// ANATOMICAL MATERIALS
// ==========================================

export function createEnamelMaterial(color: string = '#FAF8F3'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.18,
    metalness: 0.01,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    transmission: 0.06,
    ior: 1.62,
    reflectivity: 0.68,
  });
}

export function createGingivaMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E05672'), // Healthy pinkish-coral mucosa
    roughness: 0.32,
    metalness: 0.01,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    reflectivity: 0.55,
  });
}

export function createTongueMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D8526B'),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
  });
}

// ==========================================
// ARCH POSITIONING & NATURAL CURVES
// ==========================================

export interface ArchTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export function calculateArchTransforms(): Map<number, ArchTransform> {
  const map = new Map<number, ArchTransform>();

  // Upper Arch (Maxilla) - 16 teeth: 18 -> 11, then 21 -> 28
  const upperFdiOrder = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
  ];

  // Lower Arch (Mandible) - 16 teeth: 48 -> 41, then 31 -> 38
  const lowerFdiOrder = [
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
  ];

  const computeArch = (fdiList: number[], isUpper: boolean) => {
    const archWidth = isUpper ? 6.3 : 5.9;
    const archDepth = isUpper ? 5.0 : 4.6;
    const baseY = isUpper ? 0.68 : -0.68; // Open bite displaying oral cavity
    const count = fdiList.length;

    fdiList.forEach((fdi, idx) => {
      // Parameter t from -1 (patient right) to +1 (patient left)
      const t = (idx / (count - 1)) * 2 - 1;
      const absT = Math.abs(t);
      const sign = t < 0 ? -1 : 1;

      // Parabolic curve
      const x = sign * Math.pow(absT, 0.88) * (archWidth / 2);
      const z = (1 - Math.pow(absT, 1.34)) * archDepth - (archDepth * 0.36);

      // Spee / Wilson vertical curve
      const y = baseY + (isUpper ? 0.08 : -0.08) * Math.pow(absT, 1.4);

      // Tangent vector
      const dx = (archWidth / 2) * 0.88 * Math.pow(Math.max(absT, 0.05), -0.12);
      const dz = -archDepth * 1.34 * Math.pow(absT, 0.34) * sign;
      const tangent = new THREE.Vector2(dx * sign, dz).normalize();

      const normalAngle = Math.atan2(tangent.x, -tangent.y);
      const torqueX = (isUpper ? 0.05 : -0.05) * (1 - absT * 0.5);
      const rotation = new THREE.Euler(torqueX, normalAngle, 0, 'YXZ');

      // Proportional tooth sizing
      let sx = 1.0;
      let sy = 1.0;
      let sz = 1.0;

      const toothNum = fdi % 10;
      if (toothNum === 1) {
        // Central incisor
        sx = isUpper ? 1.15 : 0.85;
        sy = 1.05;
        sz = 0.9;
      } else if (toothNum === 2) {
        // Lateral incisor
        sx = isUpper ? 0.95 : 0.82;
        sy = 0.98;
        sz = 0.88;
      } else if (toothNum === 3) {
        // Canine
        sx = 1.05;
        sy = 1.15;
        sz = 1.02;
      } else if (toothNum === 4 || toothNum === 5) {
        // Premolars
        sx = 0.98;
        sy = 0.95;
        sz = 0.98;
      } else {
        // Molars
        const molarScale = toothNum === 6 ? 1.25 : toothNum === 7 ? 1.15 : 1.0;
        sx = molarScale;
        sy = 0.92;
        sz = molarScale * 1.08;
      }

      map.set(fdi, {
        position: new THREE.Vector3(x, y, z),
        rotation,
        scale: new THREE.Vector3(sx, sy, sz),
      });
    });
  };

  computeArch(upperFdiOrder, true);
  computeArch(lowerFdiOrder, false);

  return map;
}

// ==========================================
// REALISTIC ANATOMICAL TOOTH MESH CREATION
// ==========================================

// Incisor Crown
function createIncisorGeometry(isUpper: boolean): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.36, 0.44, 0.78, 24, 8);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    if (isUpper) {
      py = -py;
    }

    const edgeFactor = Math.max(0, py + 0.3) / 0.7;
    pz = pz * (1.0 - edgeFactor * 0.52);
    px = px * (1.0 + edgeFactor * 0.14);

    if (pz > 0) {
      pz += 0.035 * (1.0 - Math.abs(px) * 2.0);
    }

    pos.setXYZ(i, px, isUpper ? -py : py, pz);
  }

  geo.computeVertexNormals();
  return geo;
}

// Canine Crown
function createCanineGeometry(isUpper: boolean): THREE.BufferGeometry {
  const geo = new THREE.ConeGeometry(0.38, 0.85, 24, 8);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    if (isUpper) {
      py = -py;
    }

    if (pz > 0) {
      pz *= 1.18;
    }

    pos.setXYZ(i, px, isUpper ? -py : py, pz);
  }

  geo.computeVertexNormals();
  return geo;
}

// Premolar Crown
function createPremolarGeometry(isUpper: boolean): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.38, 0.34, 0.72, 24, 8);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    const isOcclusal = isUpper ? py < -0.16 : py > 0.16;
    if (isOcclusal) {
      const cusp = 0.05 * Math.cos(pz * 7.5);
      const groove = -0.035 * Math.exp(-(pz * pz) * 16);
      py += isUpper ? -(cusp + groove) : (cusp + groove);
    }

    pos.setXYZ(i, px, py, pz);
  }

  geo.computeVertexNormals();
  return geo;
}

// Molar Crown
function createMolarGeometry(isUpper: boolean): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.48, 0.42, 0.70, 28, 10);
  const pos = geo.attributes.position;

  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    const isOcclusal = isUpper ? py < -0.14 : py > 0.14;
    if (isOcclusal) {
      const quadCusps = 0.065 * Math.sin(px * 8) * Math.sin(pz * 8);
      const centralFossa = -0.045 * Math.exp(-(px * px + pz * pz) * 14);
      const deltaY = isUpper ? -(quadCusps + centralFossa) : (quadCusps + centralFossa);
      py += deltaY;
    }

    const midWall = Math.max(0, 0.22 - Math.abs(py));
    px *= (1.0 + midWall * 0.10);
    pz *= (1.0 + midWall * 0.10);

    pos.setXYZ(i, px, py, pz);
  }

  geo.computeVertexNormals();
  return geo;
}

// Build Individual Tooth Mesh for Full Mouth
export function createToothMesh(tooth: ToothDefinition): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  const isUpper = tooth.arch === 'UPPER';

  switch (tooth.toothClass) {
    case 'MOLAR':
      geometry = createMolarGeometry(isUpper);
      break;
    case 'PREMOLAR':
      geometry = createPremolarGeometry(isUpper);
      break;
    case 'CANINE':
      geometry = createCanineGeometry(isUpper);
      break;
    case 'INCISOR':
    default:
      geometry = createIncisorGeometry(isUpper);
      break;
  }

  const material = createEnamelMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = `tooth_${tooth.fdi}`;

  mesh.userData = {
    fdi: tooth.fdi,
    universal: tooth.universal,
    name: tooth.name,
    arch: tooth.arch,
    quadrant: tooth.quadrant,
    toothClass: tooth.toothClass,
    isAnterior: tooth.isAnterior,
  };

  return mesh;
}

// ==========================================
// SCULPTED GINGIVA & ALVEOLAR MUCOSA
// ==========================================

export function createGingivaMesh(isUpper: boolean): THREE.Mesh {
  const segments = 64;
  const radialSegments = 16;
  const archWidth = isUpper ? 6.4 : 6.0;
  const archDepth = isUpper ? 5.1 : 4.7;

  // Position gums above maxillary tooth necks or below mandibular tooth necks
  const baseY = isUpper ? 1.18 : -1.18;

  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 - 1;
    const absT = Math.abs(t);
    const sign = t < 0 ? -1 : 1;

    const x = sign * Math.pow(absT, 0.88) * (archWidth / 2);
    // Slightly behind tooth crowns
    const z = (1 - Math.pow(absT, 1.34)) * archDepth - (archDepth * 0.36) - 0.12;

    // Subtle scalloped gingival margin
    const scalloping = 0.04 * Math.cos(t * Math.PI * 15);
    const y = baseY + (isUpper ? (scalloping + absT * 0.18) : (-scalloping - absT * 0.18));

    points.push(new THREE.Vector3(x, y, z));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  // Slim radius (0.28) sitting neatly at tooth root CEJ
  const geometry = new THREE.TubeGeometry(curve, segments, 0.28, radialSegments, false);

  const mesh = new THREE.Mesh(geometry, createGingivaMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = isUpper ? 'maxillary_gingiva' : 'mandibular_gingiva';
  return mesh;
}

// ==========================================
// ORAL CAVITY (TONGUE & PALATE)
// ==========================================

export function createOralCavityMesh(): THREE.Group {
  const group = new THREE.Group();

  // 1. Organic Tongue in Lower Floor of Mouth
  const tongueGeo = new THREE.SphereGeometry(2.0, 32, 24);
  const pos = tongueGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    if (py > 0) {
      const sulcus = -0.07 * Math.exp(-(px * px) * 4);
      py += sulcus;
    }

    pos.setXYZ(i, px * 1.15, py * 0.44, pz * 1.25);
  }
  tongueGeo.computeVertexNormals();

  const tongue = new THREE.Mesh(tongueGeo, createTongueMaterial());
  tongue.position.set(0, -0.92, -0.85);
  tongue.castShadow = true;
  group.add(tongue);

  // 2. Hard & Soft Palate (Roof of Mouth)
  const palateGeo = new THREE.SphereGeometry(2.6, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.45);
  const palateMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9A2839'),
    roughness: 0.42,
    side: THREE.BackSide,
  });
  const palate = new THREE.Mesh(palateGeo, palateMat);
  palate.position.set(0, 1.65, -0.55);
  palate.scale.set(1.15, 0.45, 1.15);
  group.add(palate);

  return group;
}

// ==========================================
// BUILD COMPLETE FULL MOUTH 3D SCENE
// ==========================================

export function buildFullMouthScene(): {
  rootGroup: THREE.Group;
  teethMap: Map<number, THREE.Mesh>;
  upperGingiva: THREE.Mesh;
  lowerGingiva: THREE.Mesh;
} {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'mouth_root';

  const teethMap = new Map<number, THREE.Mesh>();
  const transforms = calculateArchTransforms();

  // 1. Add Sculpted Gingiva
  const upperGingiva = createGingivaMesh(true);
  const lowerGingiva = createGingivaMesh(false);
  rootGroup.add(upperGingiva);
  rootGroup.add(lowerGingiva);

  // 2. Add Oral Cavity (Palate & Tongue)
  const oralCavity = createOralCavityMesh();
  rootGroup.add(oralCavity);

  // 3. Add all 32 Teeth
  ADULT_TEETH.forEach((tooth) => {
    const transform = transforms.get(tooth.fdi);
    if (!transform) return;

    const toothMesh = createToothMesh(tooth);
    toothMesh.position.copy(transform.position);
    toothMesh.rotation.copy(transform.rotation);
    toothMesh.scale.copy(transform.scale);

    teethMap.set(tooth.fdi, toothMesh);
    rootGroup.add(toothMesh);
  });

  return { rootGroup, teethMap, upperGingiva, lowerGingiva };
}

// ==========================================
// ISOLATED TOOTH INSPECTION MODEL (HD)
// ==========================================

export function buildIsolatedToothModel(
  tooth: ToothDefinition
): {
  group: THREE.Group;
  surfaceMeshes: Map<ToothSurface, THREE.Mesh>;
} {
  const group = new THREE.Group();
  group.name = `isolated_tooth_${tooth.fdi}`;

  const surfaceMeshes = new Map<ToothSurface, THREE.Mesh>();

  const baseEnamel = createEnamelMaterial('#FBF9F5');
  const rootDentin = createEnamelMaterial('#E6D7BD');

  // 1. OCCLUSAL / INCISAL SURFACE (Glowing Blue Crown Table in reference)
  const occGeo = new THREE.CylinderGeometry(0.96, 0.90, 0.38, 32, 6);
  const occPos = occGeo.attributes.position;
  for (let i = 0; i < occPos.count; i++) {
    const px = occPos.getX(i);
    let py = occPos.getY(i);
    const pz = occPos.getZ(i);

    if (py > 0.05) {
      // 4 rounded anatomical cusps
      const cuspHeight = 0.08 * Math.sin(px * 6) * Math.sin(pz * 6);
      const centralPit = -0.05 * Math.exp(-(px * px + pz * pz) * 5);
      py += cuspHeight + centralPit;
      occPos.setY(i, py);
    }
  }
  occGeo.computeVertexNormals();

  const occMesh = new THREE.Mesh(occGeo, baseEnamel.clone());
  occMesh.position.set(0, 0.88, 0);
  const primarySurfaceName: ToothSurface = tooth.isAnterior ? 'Incisal' : 'Occlusal';
  occMesh.userData = { surface: primarySurfaceName };
  occMesh.name = `surface_${primarySurfaceName}`;
  surfaceMeshes.set(primarySurfaceName, occMesh);
  group.add(occMesh);

  // 2. BUCCAL / FACIAL SURFACE
  const bucGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 24, 4, false, -Math.PI * 0.32, Math.PI * 0.64);
  const bucMesh = new THREE.Mesh(bucGeo, baseEnamel.clone());
  bucMesh.position.set(0, 0.28, 0);
  bucMesh.rotation.y = Math.PI / 2;
  const facialSurfaceName: ToothSurface = tooth.isAnterior ? 'Labial' : 'Buccal';
  bucMesh.userData = { surface: facialSurfaceName };
  bucMesh.name = `surface_${facialSurfaceName}`;
  surfaceMeshes.set(facialSurfaceName, bucMesh);
  group.add(bucMesh);

  // 3. LINGUAL SURFACE (Tongue side)
  const linGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 24, 4, false, -Math.PI * 0.32, Math.PI * 0.64);
  const linMesh = new THREE.Mesh(linGeo, baseEnamel.clone());
  linMesh.position.set(0, 0.28, 0);
  linMesh.rotation.y = -Math.PI / 2;
  linMesh.userData = { surface: 'Lingual' };
  linMesh.name = 'surface_Lingual';
  surfaceMeshes.set('Lingual', linMesh);
  group.add(linMesh);

  // 4. MESIAL SURFACE
  const mesGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 24, 4, false, -Math.PI * 0.28, Math.PI * 0.56);
  const mesMesh = new THREE.Mesh(mesGeo, baseEnamel.clone());
  mesMesh.position.set(0, 0.28, 0);
  mesMesh.userData = { surface: 'Mesial' };
  mesMesh.name = 'surface_Mesial';
  surfaceMeshes.set('Mesial', mesMesh);
  group.add(mesMesh);

  // 5. DISTAL SURFACE
  const disGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 24, 4, false, -Math.PI * 0.28, Math.PI * 0.56);
  const disMesh = new THREE.Mesh(disGeo, baseEnamel.clone());
  disMesh.position.set(0, 0.28, 0);
  disMesh.rotation.y = Math.PI;
  disMesh.userData = { surface: 'Distal' };
  disMesh.name = 'surface_Distal';
  surfaceMeshes.set('Distal', disMesh);
  group.add(disMesh);

  // 6. ANATOMICAL TAPERED ROOTS
  const rootGroup = new THREE.Group();
  rootGroup.name = 'roots';

  const rootRadius = tooth.isAnterior ? 0.38 : 0.25;
  const rootLength = 1.45;

  const createSingleRoot = (offsetX: number, offsetZ: number, rotZ: number = 0, rotX: number = 0) => {
    const rGeo = new THREE.ConeGeometry(rootRadius, rootLength, 20);
    const rMesh = new THREE.Mesh(rGeo, rootDentin.clone());
    rMesh.position.set(offsetX, -0.92, offsetZ);
    rMesh.rotation.x = Math.PI + rotX;
    rMesh.rotation.z = rotZ;
    return rMesh;
  };

  if (tooth.toothClass === 'MOLAR') {
    // 4 diverging roots for molar matching reference image
    const r1 = createSingleRoot(0.40, 0.30, 0.12, 0.08);
    const r2 = createSingleRoot(-0.40, 0.30, -0.12, 0.08);
    const r3 = createSingleRoot(0.40, -0.30, 0.12, -0.08);
    const r4 = createSingleRoot(-0.40, -0.30, -0.12, -0.08);
    rootGroup.add(r1, r2, r3, r4);
  } else if (tooth.toothClass === 'PREMOLAR') {
    const r1 = createSingleRoot(0.26, 0, 0.08, 0);
    const r2 = createSingleRoot(-0.26, 0, -0.08, 0);
    rootGroup.add(r1, r2);
  } else {
    const r1 = createSingleRoot(0, 0, 0, 0);
    rootGroup.add(r1);
  }

  // Clickable proxy for Root surface
  const rootProxyGeo = new THREE.CylinderGeometry(0.85, 0.32, rootLength, 16);
  const rootProxy = new THREE.Mesh(rootProxyGeo, rootDentin.clone());
  rootProxy.position.set(0, -0.9, 0);
  rootProxy.visible = false;
  rootProxy.userData = { surface: 'Root' };
  rootProxy.name = 'surface_Root';
  surfaceMeshes.set('Root', rootProxy);
  group.add(rootProxy);

  rootGroup.children.forEach((c) => {
    (c as THREE.Mesh).userData = { surface: 'Root' };
  });
  group.add(rootGroup);

  return { group, surfaceMeshes };
}
