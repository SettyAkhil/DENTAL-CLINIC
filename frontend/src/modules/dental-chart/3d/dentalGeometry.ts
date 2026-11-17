import * as THREE from 'three';
import {
  ToothDefinition,
  ToothSurface,
  ADULT_TEETH,
} from '../types/dentalChart.types';

// =========================================================================
// 1. ANATOMICAL MATERIALS (PBR ENAMEL, GINGIVA, DENTIN, TONGUE)
// =========================================================================

export function createEnamelMaterial(color: string = '#FAF8F4'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.14,
    metalness: 0.01,
    clearcoat: 0.92,
    clearcoatRoughness: 0.08,
    transmission: 0.06,
    ior: 1.63, // Biological tooth enamel refractive index
    reflectivity: 0.72,
    flatShading: false,
  });
}

export function createRootMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E3D4BC'), // Warm cementum / root dentin
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.25,
    flatShading: false,
  });
}

export function createGingivaMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E25674'), // Healthy pink mucosal tissue
    roughness: 0.28,
    metalness: 0.0,
    clearcoat: 0.70,
    clearcoatRoughness: 0.14,
    transmission: 0.05,
    thickness: 0.9,
    flatShading: false,
  });
}

export function createTongueMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D24864'),
    roughness: 0.35,
    metalness: 0.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    flatShading: false,
  });
}

// =========================================================================
// 2. PROCEDURAL LOFTING ENGINE FOR ORGANIC DENTAL ANATOMY
// =========================================================================

export interface ProfileSlice {
  y: number;
  points: THREE.Vector2[]; // Closed 2D ring in (x, z)
}

/**
 * Builds a smooth, indexed BufferGeometry by lofting closed cross-sectional slices along Y.
 * Calculates analytical vertex normals to prevent polygon faceting.
 */
export function buildLoftedGeometry(
  slices: ProfileSlice[],
  capTop: boolean = true,
  capBottom: boolean = true
): THREE.BufferGeometry {
  const numSlices = slices.length;
  if (numSlices < 2) return new THREE.BufferGeometry();

  const numPointsPerSlice = slices[0].points.length;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  // 1. Generate Vertex Grid
  for (let s = 0; s < numSlices; s++) {
    const slice = slices[s];
    const vCoord = s / (numSlices - 1);

    for (let p = 0; p < numPointsPerSlice; p++) {
      const pt = slice.points[p];
      const uCoord = p / numPointsPerSlice;

      vertices.push(pt.x, slice.y, pt.y); // pt.y maps to 3D Z
      uvs.push(uCoord, vCoord);
    }
  }

  // 2. Generate Side Quads (as two triangles)
  for (let s = 0; s < numSlices - 1; s++) {
    const row1 = s * numPointsPerSlice;
    const row2 = (s + 1) * numPointsPerSlice;

    for (let p = 0; p < numPointsPerSlice; p++) {
      const nextP = (p + 1) % numPointsPerSlice;

      const i0 = row1 + p;
      const i1 = row1 + nextP;
      const i2 = row2 + p;
      const i3 = row2 + nextP;

      indices.push(i0, i1, i2);
      indices.push(i1, i3, i2);
    }
  }

  // 3. Cap Bottom (Apex or Base)
  if (capBottom) {
    const bottomY = slices[0].y;
    let cx = 0;
    let cz = 0;
    for (let p = 0; p < numPointsPerSlice; p++) {
      cx += slices[0].points[p].x;
      cz += slices[0].points[p].y;
    }
    cx /= numPointsPerSlice;
    cz /= numPointsPerSlice;

    const bottomCenterIndex = vertices.length / 3;
    vertices.push(cx, bottomY, cz);
    uvs.push(0.5, 0.0);

    for (let p = 0; p < numPointsPerSlice; p++) {
      const nextP = (p + 1) % numPointsPerSlice;
      indices.push(bottomCenterIndex, nextP, p);
    }
  }

  // 4. Cap Top (Occlusal table or Incisal Edge)
  if (capTop) {
    const topSlice = slices[numSlices - 1];
    const topY = topSlice.y;
    let cx = 0;
    let cz = 0;
    for (let p = 0; p < numPointsPerSlice; p++) {
      cx += topSlice.points[p].x;
      cz += topSlice.points[p].y;
    }
    cx /= numPointsPerSlice;
    cz /= numPointsPerSlice;

    const topCenterIndex = vertices.length / 3;
    vertices.push(cx, topY, cz);
    uvs.push(0.5, 1.0);

    const topRowStart = (numSlices - 1) * numPointsPerSlice;
    for (let p = 0; p < numPointsPerSlice; p++) {
      const nextP = (p + 1) % numPointsPerSlice;
      indices.push(topCenterIndex, topRowStart + p, topRowStart + nextP);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return geometry;
}

// Generate closed 2D profile points with N radial segments
function generateRing(
  segments: number,
  radiusX: number,
  radiusZ: number,
  sculptFn?: (angle: number, x: number, z: number) => { x: number; z: number }
): THREE.Vector2[] {
  const points: THREE.Vector2[] = [];
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    let x = Math.sin(angle) * radiusX;
    let z = Math.cos(angle) * radiusZ;

    if (sculptFn) {
      const sculpted = sculptFn(angle, x, z);
      x = sculpted.x;
      z = sculpted.z;
    }

    points.push(new THREE.Vector2(x, z));
  }
  return points;
}

// =========================================================================
// 3. ANATOMICAL TOOTH MORPHOLOGY GENERATORS (MAXILLARY & MANDIBULAR)
// =========================================================================

/**
 * INCISOR CROWN & ROOT (Maxillary vs Mandibular)
 * - Shovel-shaped crown, convex labial surface, lingual fossa with cingulum.
 * - Single tapered conical root with slight distal tilt.
 */
export function createAnatomicalIncisor(isUpper: boolean, isCentral: boolean, includeRoot: boolean = false): THREE.BufferGeometry {
  const segments = 32;
  const slices: ProfileSlice[] = [];

  const crownWidth = isUpper ? (isCentral ? 0.44 : 0.38) : (isCentral ? 0.28 : 0.30);
  const crownThick = isUpper ? 0.34 : 0.28;
  const crownHeight = isUpper ? 0.85 : 0.80;
  const rootLength = isUpper ? 1.15 : 1.20;

  // Root Apex to CEJ (Only if includeRoot is true)
  if (includeRoot) {
    const rootSteps = 5;
    for (let i = 0; i <= rootSteps; i++) {
      const t = i / rootSteps;
      const y = -rootLength * (1 - t);
      const radFactor = Math.pow(t, 0.72);
      const distalCurve = (1 - t) * 0.08;

      const ring = generateRing(segments, crownWidth * 0.55 * radFactor, crownThick * 0.65 * radFactor, (_, x, z) => ({
        x: x + distalCurve,
        z,
      }));
      slices.push({ y, points: ring });
    }
  }

  // Cervical Constriction (CEJ)
  const cejRing = generateRing(segments, crownWidth * 0.72, crownThick * 0.75);
  slices.push({ y: 0.0, points: cejRing });

  // Height of Contour (Equatorial Enamel Bulge)
  const hocRing = generateRing(segments, crownWidth * 0.95, crownThick * 0.95, (_, x, z) => {
    let newZ = z;
    if (z < 0) newZ *= 1.15; // Cingulum
    if (z > 0) newZ += 0.03 * (1 - Math.abs(x) * 2); // Labial developmental curvature
    return { x, z: newZ };
  });
  slices.push({ y: crownHeight * 0.35, points: hocRing });

  // Mid-Crown with Lingual Fossa
  const midRing = generateRing(segments, crownWidth * 1.02, crownThick * 0.72, (_, x, z) => {
    let newZ = z;
    if (z < 0) newZ += 0.04;
    return { x, z: newZ };
  });
  slices.push({ y: crownHeight * 0.70, points: midRing });

  // Incisal Edge
  const incisalRing = generateRing(segments, crownWidth * 1.05, crownThick * 0.22, (_, x, z) => {
    let newX = x;
    if (x < 0) newX *= 0.96;
    return { x: newX, z };
  });
  slices.push({ y: crownHeight, points: incisalRing });

  const geo = buildLoftedGeometry(slices, true, true);

  if (isUpper) {
    geo.rotateZ(Math.PI);
  }

  return geo;
}

/**
 * CANINE CROWN & ROOT (Maxillary vs Mandibular)
 * - Diamond-oval cross section, prominent labial vertical ridge, sharp cusp tip.
 * - Massive stout root with canine eminence.
 */
export function createAnatomicalCanine(isUpper: boolean, includeRoot: boolean = false): THREE.BufferGeometry {
  const segments = 32;
  const slices: ProfileSlice[] = [];

  const crownWidth = 0.42;
  const crownThick = 0.46;
  const crownHeight = isUpper ? 0.92 : 0.96;
  const rootLength = isUpper ? 1.45 : 1.35;

  // Root Apex to CEJ (Only if includeRoot is true)
  if (includeRoot) {
    const rootSteps = 6;
    for (let i = 0; i <= rootSteps; i++) {
      const t = i / rootSteps;
      const y = -rootLength * (1 - t);
      const rad = Math.pow(t, 0.68);
      const ring = generateRing(segments, crownWidth * 0.6 * rad, crownThick * 0.75 * rad);
      slices.push({ y, points: ring });
    }
  }

  // CEJ Constriction
  const cejRing = generateRing(segments, crownWidth * 0.78, crownThick * 0.82);
  slices.push({ y: 0.0, points: cejRing });

  // Height of Contour & Cingulum
  const hocRing = generateRing(segments, crownWidth * 1.0, crownThick * 1.0, (_, x, z) => {
    let newZ = z;
    if (z > 0) newZ += 0.06 * Math.exp(-(x * x) * 18);
    if (z < 0) newZ -= 0.04;
    return { x, z: newZ };
  });
  slices.push({ y: crownHeight * 0.4, points: hocRing });

  // Sloping Cusp Ridges
  const cuspShoulderRing = generateRing(segments, crownWidth * 0.85, crownThick * 0.65, (_, x, z) => {
    let newZ = z;
    if (z > 0) newZ += 0.05 * Math.exp(-(x * x) * 20);
    return { x, z: newZ };
  });
  slices.push({ y: crownHeight * 0.75, points: cuspShoulderRing });

  // Cusp Tip Apex
  const tipRing = generateRing(segments, crownWidth * 0.22, crownThick * 0.25);
  slices.push({ y: crownHeight, points: tipRing });

  const geo = buildLoftedGeometry(slices, true, true);
  if (isUpper) {
    geo.rotateZ(Math.PI);
  }
  return geo;
}

/**
 * PREMOLAR CROWN & ROOTS
 * - Bicuspid table (buccal & lingual cusps) with central developmental groove.
 */
export function createAnatomicalPremolar(isUpper: boolean, isFirst: boolean, includeRoot: boolean = false): THREE.BufferGeometry {
  const segments = 36;
  const slices: ProfileSlice[] = [];

  const crownWidth = 0.44;
  const crownThick = 0.48;
  const crownHeight = 0.78;
  const rootLength = 1.20;

  // Root Structure (Only if includeRoot is true)
  if (includeRoot) {
    const rootSteps = 5;
    for (let i = 0; i <= rootSteps; i++) {
      const t = i / rootSteps;
      const y = -rootLength * (1 - t);
      const rad = Math.pow(t, 0.7);
      const ring = generateRing(segments, crownWidth * 0.55 * rad, crownThick * 0.70 * rad);
      slices.push({ y, points: ring });
    }
  }

  // Cervical Constriction
  const cejRing = generateRing(segments, crownWidth * 0.76, crownThick * 0.82);
  slices.push({ y: 0.0, points: cejRing });

  // Crown Bell Convexity
  const hocRing = generateRing(segments, crownWidth * 1.02, crownThick * 1.04);
  slices.push({ y: crownHeight * 0.45, points: hocRing });

  // Sub-Occlusal Rim
  const rimRing = generateRing(segments, crownWidth * 0.92, crownThick * 0.94);
  slices.push({ y: crownHeight * 0.80, points: rimRing });

  // Occlusal Table with Bicuspid Cusps
  const occRing = generateRing(segments, crownWidth * 0.72, crownThick * 0.75, (_, x, z) => {
    let newZ = z;
    if (z > 0) newZ += 0.03;
    if (z < 0) newZ -= (isUpper ? 0.025 : 0.015);
    return { x, z: newZ };
  });
  slices.push({ y: crownHeight, points: occRing });

  const geo = buildLoftedGeometry(slices, true, true);

  // Occlusal Fissure & Cusp Sculpting
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const py = pos.getY(i);
    const pz = pos.getZ(i);
    if (py > crownHeight * 0.75) {
      const groove = -0.05 * Math.exp(-(pz * pz) * 22);
      const cusps = 0.04 * Math.cos(pz * 7.5);
      pos.setY(i, py + groove + cusps);
    }
  }
  geo.computeVertexNormals();

  if (isUpper) {
    geo.rotateZ(Math.PI);
  }
  return geo;
}

/**
 * MOLAR CROWN & MULTI-ROOT ANATOMY
 * - Maxillary: Rhomboidal crown, 4 cusps (MB, DB, ML largest, DL), oblique ridge, 3 roots.
 * - Mandibular: Rectangular crown, 4-5 cusps, cruciform fissure groove, 2 broad roots.
 */
export function createAnatomicalMolar(isUpper: boolean, molarIndex: 1 | 2 | 3, includeRoot: boolean = false): THREE.BufferGeometry {
  const segments = 40;
  const slices: ProfileSlice[] = [];

  const sizeFactor = molarIndex === 1 ? 1.0 : molarIndex === 2 ? 0.92 : 0.84;
  const crownWidth = 0.62 * sizeFactor;
  const crownThick = 0.66 * sizeFactor;
  const crownHeight = 0.75 * sizeFactor;
  const rootLength = 1.30 * sizeFactor;

  // Root Trunk (Only if includeRoot is true)
  if (includeRoot) {
    const rootSteps = 5;
    for (let i = 0; i <= rootSteps; i++) {
      const t = i / rootSteps;
      const y = -rootLength * (1 - t);
      const rad = Math.pow(t, 0.65);
      const ring = generateRing(segments, crownWidth * 0.65 * rad, crownThick * 0.72 * rad);
      slices.push({ y, points: ring });
    }
  }

  // CEJ Cervical Constriction
  const cejRing = generateRing(segments, crownWidth * 0.80, crownThick * 0.84);
  slices.push({ y: 0.0, points: cejRing });

  // Height of Contour
  const hocRing = generateRing(segments, crownWidth * 1.05, crownThick * 1.06, (_, x, z) => {
    let nx = x;
    let nz = z;
    if (isUpper) {
      nx += z * 0.12;
    }
    return { x: nx, z: nz };
  });
  slices.push({ y: crownHeight * 0.40, points: hocRing });

  // Sub-Occlusal Rim
  const rimRing = generateRing(segments, crownWidth * 0.96, crownThick * 0.96, (_, x, z) => {
    let nx = x;
    if (isUpper) nx += z * 0.10;
    return { x: nx, z };
  });
  slices.push({ y: crownHeight * 0.75, points: rimRing });

  // Occlusal Table Perimeter
  const occRing = generateRing(segments, crownWidth * 0.84, crownThick * 0.84, (_, x, z) => {
    let nx = x;
    if (isUpper) nx += z * 0.08;
    return { x: nx, z };
  });
  slices.push({ y: crownHeight, points: occRing });

  const geo = buildLoftedGeometry(slices, true, true);

  // Sculpt Anatomical Cusps & Central Fossa using Gaussian RBF
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const py = pos.getY(i);
    const pz = pos.getZ(i);

    if (py > crownHeight * 0.65) {
      const mbCusp = 0.07 * Math.exp(-((px - 0.16) ** 2 + (pz - 0.16) ** 2) * 24);
      const dbCusp = 0.06 * Math.exp(-((px + 0.16) ** 2 + (pz - 0.16) ** 2) * 24);
      const mlCusp = 0.08 * Math.exp(-((px - 0.16) ** 2 + (pz + 0.16) ** 2) * 20);
      const dlCusp = 0.05 * Math.exp(-((px + 0.16) ** 2 + (pz + 0.16) ** 2) * 24);

      const centralPit = -0.06 * Math.exp(-(px * px + pz * pz) * 18);
      const fissureCruciform = -0.02 * (Math.exp(-(px * px) * 25) + Math.exp(-(pz * pz) * 25));

      pos.setY(i, py + mbCusp + dbCusp + mlCusp + dlCusp + centralPit + fissureCruciform);
    }
  }
  geo.computeVertexNormals();

  if (isUpper) {
    geo.rotateZ(Math.PI);
  }
  return geo;
}

// =========================================================================
// 4. FACTORY DISPATCHER FOR ALL 32 INDIVIDUAL TEETH
// =========================================================================

export function createAnatomicalToothMesh(tooth: ToothDefinition): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  const isUpper = tooth.arch === 'UPPER';
  const toothPosInQuad = tooth.fdi % 10;

  switch (tooth.toothClass) {
    case 'INCISOR':
      geometry = createAnatomicalIncisor(isUpper, toothPosInQuad === 1);
      break;
    case 'CANINE':
      geometry = createAnatomicalCanine(isUpper);
      break;
    case 'PREMOLAR':
      geometry = createAnatomicalPremolar(isUpper, toothPosInQuad === 4);
      break;
    case 'MOLAR':
      const molarIdx = (toothPosInQuad - 5) as 1 | 2 | 3;
      geometry = createAnatomicalMolar(isUpper, molarIdx >= 1 && molarIdx <= 3 ? molarIdx : 1);
      break;
    default:
      geometry = createAnatomicalIncisor(isUpper, true);
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

// =========================================================================
// 5. ARCH POSITIONING & NATURAL CLASS I OCCLUSION
// =========================================================================

export interface ArchTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export function calculateArchTransforms(): Map<number, ArchTransform> {
  const map = new Map<number, ArchTransform>();

  const upperFdiOrder = [
    18, 17, 16, 15, 14, 13, 12, 11,
    21, 22, 23, 24, 25, 26, 27, 28,
  ];

  const lowerFdiOrder = [
    48, 47, 46, 45, 44, 43, 42, 41,
    31, 32, 33, 34, 35, 36, 37, 38,
  ];

  const computeArch = (fdiList: number[], isUpper: boolean) => {
    // Class I Occlusion
    const archWidth = isUpper ? 6.35 : 5.95;
    const archDepth = isUpper ? 5.15 : 4.75;
    const baseY = isUpper ? 0.70 : -0.70;
    const count = fdiList.length;

    fdiList.forEach((fdi, idx) => {
      const t = (idx / (count - 1)) * 2 - 1;
      const absT = Math.abs(t);
      const sign = t < 0 ? -1 : 1;

      const x = sign * Math.pow(absT, 0.88) * (archWidth / 2);
      const z = (1 - Math.pow(absT, 1.34)) * archDepth - (archDepth * 0.36);
      const y = baseY + (isUpper ? 0.08 : -0.08) * Math.pow(absT, 1.4);

      const dx = (archWidth / 2) * 0.88 * Math.pow(Math.max(absT, 0.05), -0.12);
      const dz = -archDepth * 1.34 * Math.pow(absT, 0.34) * sign;
      const tangent = new THREE.Vector2(dx * sign, dz).normalize();

      const normalAngle = Math.atan2(tangent.x, -tangent.y);
      const torqueX = (isUpper ? 0.05 : -0.05) * (1 - absT * 0.5);
      const rotation = new THREE.Euler(torqueX, normalAngle, 0, 'YXZ');

      map.set(fdi, {
        position: new THREE.Vector3(x, y, z),
        rotation,
        scale: new THREE.Vector3(1, 1, 1),
      });
    });
  };

  computeArch(upperFdiOrder, true);
  computeArch(lowerFdiOrder, false);

  return map;
}

// =========================================================================
// 6. SCULPTED GINGIVAL ALVEOLAR MANIFOLD (ENCLOSING ROOTS)
// =========================================================================

/**
 * Creates an anatomical alveolar gingival process enclosing the tooth bases,
 * featuring natural rounded vestibular ridges and scalloped interdental contours.
 */
export function createAnatomicalGingiva(isUpper: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = isUpper ? 'maxillary_gingiva_group' : 'mandibular_gingiva_group';

  const segments = 64;
  const archWidth = isUpper ? 6.35 : 5.95;
  const archDepth = isUpper ? 5.15 : 4.75;

  // 1. Alveolar Mucosal Ridge (Solid rounded vestibular process)
  const baseY = isUpper ? 1.05 : -1.05;
  const ridgePoints: THREE.Vector3[] = [];

  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 - 1;
    const absT = Math.abs(t);
    const sign = t < 0 ? -1 : 1;

    const x = sign * Math.pow(absT, 0.88) * (archWidth / 2);
    // Positioned along the arch curve
    const z = (1 - Math.pow(absT, 1.34)) * archDepth - (archDepth * 0.36) - 0.12;

    // Subtle scalloped undulation along cervical margins
    const scallop = 0.04 * Math.cos(t * Math.PI * 16);
    const y = baseY + (isUpper ? (scallop + absT * 0.15) : (-scallop - absT * 0.15));

    ridgePoints.push(new THREE.Vector3(x, y, z));
  }

  const ridgeCurve = new THREE.CatmullRomCurve3(ridgePoints);
  // Radius 0.44 forms a fleshy, full alveolar process enclosing all tooth bases
  const ridgeGeo = new THREE.TubeGeometry(ridgeCurve, segments, 0.44, 20, false);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, createGingivaMaterial());
  ridgeMesh.castShadow = true;
  ridgeMesh.receiveShadow = true;
  group.add(ridgeMesh);

  // 2. Secondary Scalloped Gingival Collar at the Teeth Necks
  const collarY = isUpper ? 0.72 : -0.72;
  const collarPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * 2 - 1;
    const absT = Math.abs(t);
    const sign = t < 0 ? -1 : 1;

    const x = sign * Math.pow(absT, 0.88) * (archWidth / 2);
    const z = (1 - Math.pow(absT, 1.34)) * archDepth - (archDepth * 0.36) - 0.05;
    const scallop = 0.05 * Math.cos(t * Math.PI * 16);
    const y = collarY + (isUpper ? (-scallop + absT * 0.10) : (scallop - absT * 0.10));

    collarPoints.push(new THREE.Vector3(x, y, z));
  }

  const collarCurve = new THREE.CatmullRomCurve3(collarPoints);
  const collarGeo = new THREE.TubeGeometry(collarCurve, segments, 0.22, 16, false);
  const collarMesh = new THREE.Mesh(collarGeo, createGingivaMaterial());
  collarMesh.castShadow = true;
  group.add(collarMesh);

  return group;
}

// =========================================================================
// 7. ORAL CAVITY (TONGUE & PALATE)
// =========================================================================

export function createOralCavityMesh(): THREE.Group {
  const group = new THREE.Group();

  // 1. Organic Tongue in Lower Floor of Mouth with Median Sulcus
  const tongueGeo = new THREE.SphereGeometry(2.1, 36, 28);
  const pos = tongueGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let px = pos.getX(i);
    let py = pos.getY(i);
    let pz = pos.getZ(i);

    if (py > 0) {
      const sulcus = -0.075 * Math.exp(-(px * px) * 5);
      py += sulcus;
    }

    pos.setXYZ(i, px * 1.15, py * 0.44, pz * 1.25);
  }
  tongueGeo.computeVertexNormals();

  const tongue = new THREE.Mesh(tongueGeo, createTongueMaterial());
  tongue.position.set(0, -0.92, -0.85);
  tongue.castShadow = true;
  group.add(tongue);

  // 2. Hard Palate (Roof of Mouth)
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

// =========================================================================
// 8. COMPLETE FULL MOUTH 3D SCENE ASSEMBLY
// =========================================================================

export function buildFullMouthScene(): {
  rootGroup: THREE.Group;
  teethMap: Map<number, THREE.Mesh>;
  upperGingiva: THREE.Group;
  lowerGingiva: THREE.Group;
} {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'mouth_root';

  const teethMap = new Map<number, THREE.Mesh>();
  const transforms = calculateArchTransforms();

  // 1. Add Sculpted Alveolar Gingival Enclosures
  const upperGingiva = createAnatomicalGingiva(true);
  const lowerGingiva = createAnatomicalGingiva(false);
  rootGroup.add(upperGingiva);
  rootGroup.add(lowerGingiva);

  // 2. Add Oral Cavity (Palate & Tongue)
  const oralCavity = createOralCavityMesh();
  rootGroup.add(oralCavity);

  // 3. Add all 32 Segmented Anatomical Teeth
  ADULT_TEETH.forEach((tooth) => {
    const transform = transforms.get(tooth.fdi);
    if (!transform) return;

    const toothMesh = createAnatomicalToothMesh(tooth);
    toothMesh.position.copy(transform.position);
    toothMesh.rotation.copy(transform.rotation);
    toothMesh.scale.copy(transform.scale);

    teethMap.set(tooth.fdi, toothMesh);
    rootGroup.add(toothMesh);
  });

  return { rootGroup, teethMap, upperGingiva, lowerGingiva };
}

// =========================================================================
// 9. ISOLATED TOOTH INSPECTION MODEL (HD SURFACE SEGMENTATION)
// =========================================================================

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
  const rootDentin = createRootMaterial();

  const isAnterior = tooth.isAnterior;
  const primarySurface: ToothSurface = isAnterior ? 'Incisal' : 'Occlusal';
  const facialSurface: ToothSurface = isAnterior ? 'Labial' : 'Buccal';

  // 1. OCCLUSAL / INCISAL TABLE
  const occGeo = new THREE.CylinderGeometry(0.96, 0.90, 0.38, 36, 6);
  const occPos = occGeo.attributes.position;
  for (let i = 0; i < occPos.count; i++) {
    const px = occPos.getX(i);
    let py = occPos.getY(i);
    const pz = occPos.getZ(i);

    if (py > 0.05) {
      if (!isAnterior) {
        // 4 distinct cusps with central pit matching visual reference
        const mb = 0.08 * Math.exp(-((px - 0.35) ** 2 + (pz - 0.35) ** 2) * 8);
        const db = 0.07 * Math.exp(-((px + 0.35) ** 2 + (pz - 0.35) ** 2) * 8);
        const ml = 0.09 * Math.exp(-((px - 0.35) ** 2 + (pz + 0.35) ** 2) * 7);
        const dl = 0.06 * Math.exp(-((px + 0.35) ** 2 + (pz + 0.35) ** 2) * 8);
        const centralPit = -0.06 * Math.exp(-(px * px + pz * pz) * 6);
        py += mb + db + ml + dl + centralPit;
      } else {
        py += 0.04 * (1 - Math.abs(px) * 0.8);
      }
      occPos.setY(i, py);
    }
  }
  occGeo.computeVertexNormals();

  const occMesh = new THREE.Mesh(occGeo, baseEnamel.clone());
  occMesh.position.set(0, 0.88, 0);
  occMesh.userData = { surface: primarySurface };
  occMesh.name = `surface_${primarySurface}`;
  surfaceMeshes.set(primarySurface, occMesh);
  group.add(occMesh);

  // 2. BUCCAL / LABIAL SURFACE
  const bucGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 28, 4, false, -Math.PI * 0.32, Math.PI * 0.64);
  const bucMesh = new THREE.Mesh(bucGeo, baseEnamel.clone());
  bucMesh.position.set(0, 0.28, 0);
  bucMesh.rotation.y = Math.PI / 2;
  bucMesh.userData = { surface: facialSurface };
  bucMesh.name = `surface_${facialSurface}`;
  surfaceMeshes.set(facialSurface, bucMesh);
  group.add(bucMesh);

  // 3. LINGUAL SURFACE
  const linGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 28, 4, false, -Math.PI * 0.32, Math.PI * 0.64);
  const linMesh = new THREE.Mesh(linGeo, baseEnamel.clone());
  linMesh.position.set(0, 0.28, 0);
  linMesh.rotation.y = -Math.PI / 2;
  linMesh.userData = { surface: 'Lingual' };
  linMesh.name = 'surface_Lingual';
  surfaceMeshes.set('Lingual', linMesh);
  group.add(linMesh);

  // 4. MESIAL SURFACE
  const mesGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 28, 4, false, -Math.PI * 0.28, Math.PI * 0.56);
  const mesMesh = new THREE.Mesh(mesGeo, baseEnamel.clone());
  mesMesh.position.set(0, 0.28, 0);
  mesMesh.userData = { surface: 'Mesial' };
  mesMesh.name = 'surface_Mesial';
  surfaceMeshes.set('Mesial', mesMesh);
  group.add(mesMesh);

  // 5. DISTAL SURFACE
  const disGeo = new THREE.CylinderGeometry(0.90, 0.84, 0.95, 28, 4, false, -Math.PI * 0.28, Math.PI * 0.56);
  const disMesh = new THREE.Mesh(disGeo, baseEnamel.clone());
  disMesh.position.set(0, 0.28, 0);
  disMesh.rotation.y = Math.PI;
  disMesh.userData = { surface: 'Distal' };
  disMesh.name = 'surface_Distal';
  surfaceMeshes.set('Distal', disMesh);
  group.add(disMesh);

  // 6. ANATOMICAL MULTI-ROOTS
  const rootGroup = new THREE.Group();
  rootGroup.name = 'roots';

  const rootRadius = isAnterior ? 0.38 : 0.25;
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
