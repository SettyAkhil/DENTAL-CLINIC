import * as THREE from 'three';
import {
  ToothDefinition,
  ToothSurface,
  ADULT_TEETH,
} from '../types/dentalChart.types';

// =========================================================================
// 1. ANATOMICAL PBR MATERIALS (Ivory Enamel, Natural Coral Gingiva, Palate, Tongue)
// =========================================================================

export function createEnamelMaterial(color: string = '#F8F6F0'): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.16,
    metalness: 0.02,
    clearcoat: 0.95,
    clearcoatRoughness: 0.08,
    transmission: 0.0, // Solid opaque porcelain enamel (no wireframe artifacts)
    ior: 1.62,
    reflectivity: 0.75,
    side: THREE.FrontSide,
    flatShading: false,
  });
}

export function createRootMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E0D1B5'),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.30,
    clearcoatRoughness: 0.22,
    side: THREE.FrontSide,
    flatShading: false,
  });
}

/**
 * Natural oral mucosa / coral-pink gingiva matching clinical reference image
 */
export function createGingivaMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D8737B'),
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 0.65,
    clearcoatRoughness: 0.18,
    transmission: 0.0,
    side: THREE.FrontSide,
    flatShading: false,
  });
}

/**
 * Healthy tongue mucosa matching clinical reference image
 */
export function createTongueMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D46972'),
    roughness: 0.40,
    metalness: 0.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    side: THREE.DoubleSide,
    flatShading: false,
  });
}

/**
 * Hard palate oral mucosa matching clinical reference image
 */
export function createPalateMaterial(): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#D8737B'),
    roughness: 0.36,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.20,
    side: THREE.DoubleSide,
    flatShading: false,
  });
}

// =========================================================================
// 2. BROAD PARABOLIC U-ARCH COORDINATES (TIGHT INTERPROXIMAL CONTACTS)
// =========================================================================

export interface ArchTransform {
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
}

export const UPPER_ARCH_SPECS: Record<number, { x: number; z: number; rotY: number; width: number; height: number; thick: number }> = {
  18: { x: -2.92, z: -1.35, rotY: -0.15, width: 0.60, height: 0.72, thick: 0.64 },
  17: { x: -2.68, z: -0.78, rotY: -0.22, width: 0.66, height: 0.76, thick: 0.68 },
  16: { x: -2.36, z: -0.18, rotY: -0.32, width: 0.72, height: 0.80, thick: 0.72 },
  15: { x: -1.98, z: 0.36,  rotY: -0.46, width: 0.52, height: 0.78, thick: 0.56 },
  14: { x: -1.58, z: 0.76,  rotY: -0.62, width: 0.54, height: 0.82, thick: 0.58 },
  13: { x: -1.16, z: 1.08,  rotY: -0.80, width: 0.50, height: 0.94, thick: 0.52 },
  12: { x: -0.70, z: 1.28,  rotY: -0.45, width: 0.46, height: 0.86, thick: 0.40 },
  11: { x: -0.25, z: 1.35,  rotY: -0.12, width: 0.52, height: 0.94, thick: 0.42 },

  21: { x: 0.25,  z: 1.35,  rotY: 0.12,  width: 0.52, height: 0.94, thick: 0.42 },
  22: { x: 0.70,  z: 1.28,  rotY: 0.45,  width: 0.46, height: 0.86, thick: 0.40 },
  23: { x: 1.16,  z: 1.08,  rotY: 0.80,  width: 0.50, height: 0.94, thick: 0.52 },
  24: { x: 1.58,  z: 0.76,  rotY: 0.62,  width: 0.54, height: 0.82, thick: 0.58 },
  25: { x: 1.98,  z: 0.36,  rotY: 0.46,  width: 0.52, height: 0.78, thick: 0.56 },
  26: { x: 2.36,  z: -0.18, rotY: 0.32,  width: 0.72, height: 0.80, thick: 0.72 },
  27: { x: 2.68,  z: -0.78, rotY: 0.22,  width: 0.66, height: 0.76, thick: 0.68 },
  28: { x: 2.92,  z: -1.35, rotY: 0.15,  width: 0.60, height: 0.72, thick: 0.64 },
};

export const LOWER_ARCH_SPECS: Record<number, { x: number; z: number; rotY: number; width: number; height: number; thick: number }> = {
  48: { x: -2.75, z: -1.30, rotY: -0.15, width: 0.58, height: 0.70, thick: 0.62 },
  47: { x: -2.52, z: -0.74, rotY: -0.22, width: 0.64, height: 0.74, thick: 0.66 },
  46: { x: -2.22, z: -0.16, rotY: -0.32, width: 0.70, height: 0.78, thick: 0.70 },
  45: { x: -1.86, z: 0.36,  rotY: -0.46, width: 0.50, height: 0.76, thick: 0.54 },
  44: { x: -1.48, z: 0.74,  rotY: -0.62, width: 0.50, height: 0.78, thick: 0.54 },
  43: { x: -1.08, z: 1.04,  rotY: -0.78, width: 0.46, height: 0.90, thick: 0.48 },
  42: { x: -0.64, z: 1.22,  rotY: -0.42, width: 0.40, height: 0.82, thick: 0.36 },
  41: { x: -0.21, z: 1.28,  rotY: -0.10, width: 0.38, height: 0.84, thick: 0.36 },

  31: { x: 0.21,  z: 1.28,  rotY: 0.10,  width: 0.38, height: 0.84, thick: 0.36 },
  32: { x: 0.64,  z: 1.22,  rotY: 0.42,  width: 0.40, height: 0.82, thick: 0.36 },
  33: { x: 1.08,  z: 1.04,  rotY: 0.78,  width: 0.46, height: 0.90, thick: 0.48 },
  34: { x: 1.48,  z: 0.74,  rotY: 0.62,  width: 0.50, height: 0.78, thick: 0.54 },
  35: { x: 1.86,  z: 0.36,  rotY: 0.46,  width: 0.50, height: 0.76, thick: 0.54 },
  36: { x: 2.22,  z: -0.16, rotY: 0.32,  width: 0.70, height: 0.78, thick: 0.70 },
  37: { x: 2.52,  z: -0.74, rotY: 0.22,  width: 0.64, height: 0.74, thick: 0.66 },
  38: { x: 2.75,  z: -1.30, rotY: 0.15,  width: 0.58, height: 0.70, thick: 0.62 },
};

export function calculateArchTransforms(): Map<number, ArchTransform> {
  const map = new Map<number, ArchTransform>();

  Object.entries(UPPER_ARCH_SPECS).forEach(([fdiStr, s]) => {
    const fdi = parseInt(fdiStr, 10);
    map.set(fdi, {
      position: new THREE.Vector3(s.x, 0.0, s.z),
      rotation: new THREE.Euler(0.04, s.rotY, 0, 'YXZ'),
      scale: new THREE.Vector3(1, 1, 1),
    });
  });

  Object.entries(LOWER_ARCH_SPECS).forEach(([fdiStr, s]) => {
    const fdi = parseInt(fdiStr, 10);
    map.set(fdi, {
      position: new THREE.Vector3(s.x, 0.0, s.z),
      rotation: new THREE.Euler(-0.04, s.rotY, 0, 'YXZ'),
      scale: new THREE.Vector3(1, 1, 1),
    });
  });

  return map;
}

// =========================================================================
// 3. ANATOMICAL PROCEDURAL TOOTH CROWN GENERATORS
// =========================================================================

function buildAnatomicalCrown(
  isUpper: boolean,
  height: number,
  sliceFunc: (lambda: number) => { rx: number; rz: number; xOffset?: number; zOffset?: number },
  occlusalFunc?: (x: number, z: number) => number
): THREE.BufferGeometry {
  const numSlices = 14;
  const numPoints = 36;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  for (let s = 0; s <= numSlices; s++) {
    const lambda = s / numSlices;
    const { rx, rz, xOffset = 0, zOffset = 0 } = sliceFunc(lambda);

    const baseY = isUpper ? -lambda * height : lambda * height;

    for (let p = 0; p < numPoints; p++) {
      const angle = (p / numPoints) * Math.PI * 2;
      const x = Math.sin(angle) * rx + xOffset;
      const z = Math.cos(angle) * rz + zOffset;

      let y = baseY;
      if (s === numSlices && occlusalFunc) {
        const delta = occlusalFunc(x, z);
        y += isUpper ? -delta : delta;
      }

      vertices.push(x, y, z);
      uvs.push(p / numPoints, lambda);
    }
  }

  for (let s = 0; s < numSlices; s++) {
    const r1 = s * numPoints;
    const r2 = (s + 1) * numPoints;
    for (let p = 0; p < numPoints; p++) {
      const nextP = (p + 1) % numPoints;
      if (!isUpper) {
        indices.push(r1 + p, r1 + nextP, r2 + p);
        indices.push(r1 + nextP, r2 + nextP, r2 + p);
      } else {
        indices.push(r1 + p, r2 + p, r1 + nextP);
        indices.push(r1 + nextP, r2 + p, r2 + nextP);
      }
    }
  }

  const baseCenterIdx = vertices.length / 3;
  vertices.push(0, 0, 0);
  uvs.push(0.5, 0.0);
  for (let p = 0; p < numPoints; p++) {
    const nextP = (p + 1) % numPoints;
    if (!isUpper) {
      indices.push(baseCenterIdx, nextP, p);
    } else {
      indices.push(baseCenterIdx, p, nextP);
    }
  }

  const capCenterIdx = vertices.length / 3;
  let capY = isUpper ? -height : height;
  if (occlusalFunc) {
    const centerDelta = occlusalFunc(0, 0);
    capY += isUpper ? -centerDelta : centerDelta;
  }
  vertices.push(0, capY, 0);
  uvs.push(0.5, 1.0);

  const topRingStart = numSlices * numPoints;
  for (let p = 0; p < numPoints; p++) {
    const nextP = (p + 1) % numPoints;
    if (!isUpper) {
      indices.push(capCenterIdx, topRingStart + p, topRingStart + nextP);
    } else {
      indices.push(capCenterIdx, topRingStart + nextP, topRingStart + p);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
}

function createIncisorCrown(isUpper: boolean, isCentral: boolean): THREE.BufferGeometry {
  const width = isUpper ? (isCentral ? 0.54 : 0.46) : 0.40;
  const thick = isUpper ? 0.40 : 0.36;
  const height = isUpper ? (isCentral ? 0.94 : 0.86) : 0.84;

  return buildAnatomicalCrown(
    isUpper,
    height,
    (lambda) => {
      const rx = (width / 2) * (0.78 + 0.32 * Math.sin(lambda * Math.PI * 0.5));
      const rz = (thick / 2) * (1.0 - 0.78 * Math.pow(lambda, 1.4));
      const zOffset = (thick * 0.12) * Math.sin(lambda * Math.PI);
      return { rx, rz, zOffset };
    },
    (x) => 0.03 * (1.0 - Math.abs(x / (width / 2)))
  );
}

function createCanineCrown(isUpper: boolean): THREE.BufferGeometry {
  const width = isUpper ? 0.50 : 0.46;
  const thick = isUpper ? 0.52 : 0.48;
  const height = isUpper ? 0.96 : 0.92;

  return buildAnatomicalCrown(
    isUpper,
    height,
    (lambda) => {
      const rx = (width / 2) * (0.82 + 0.28 * Math.sin(lambda * Math.PI * 0.6) - 0.65 * Math.pow(lambda, 2));
      const rz = (thick / 2) * (0.90 + 0.20 * Math.sin(lambda * Math.PI * 0.5) - 0.65 * Math.pow(lambda, 2));
      const zOffset = (thick * 0.10) * Math.sin(lambda * Math.PI * 0.7);
      return { rx, rz, zOffset };
    },
    () => 0.08
  );
}

function createPremolarCrown(isUpper: boolean): THREE.BufferGeometry {
  const width = 0.54;
  const thick = 0.56;
  const height = 0.78;

  return buildAnatomicalCrown(
    isUpper,
    height,
    (lambda) => {
      const rx = (width / 2) * (0.80 + 0.28 * Math.sin(lambda * Math.PI * 0.65) - 0.12 * Math.pow(lambda, 2));
      const rz = (thick / 2) * (0.82 + 0.26 * Math.sin(lambda * Math.PI * 0.65) - 0.10 * Math.pow(lambda, 2));
      return { rx, rz };
    },
    (x, z) => {
      const buccalCusp = 0.065 * Math.exp(-((z - 0.14) ** 2 + x ** 2) * 26);
      const lingualCusp = 0.050 * Math.exp(-((z + 0.14) ** 2 + x ** 2) * 26);
      const centralGroove = -0.040 * Math.exp(-(z ** 2) * 45);
      return buccalCusp + lingualCusp + centralGroove;
    }
  );
}

function createMolarCrown(isUpper: boolean, sizeFactor: number = 1.0): THREE.BufferGeometry {
  const width = 0.72 * sizeFactor;
  const thick = 0.72 * sizeFactor;
  const height = 0.80 * sizeFactor;

  return buildAnatomicalCrown(
    isUpper,
    height,
    (lambda) => {
      const rx = (width / 2) * (0.84 + 0.26 * Math.sin(lambda * Math.PI * 0.6) - 0.14 * Math.pow(lambda, 2));
      const rz = (thick / 2) * (0.84 + 0.26 * Math.sin(lambda * Math.PI * 0.6) - 0.12 * Math.pow(lambda, 2));
      return { rx, rz };
    },
    (x, z) => {
      const mb = 0.075 * Math.exp(-((x - 0.16) ** 2 + (z - 0.16) ** 2) * 28);
      const db = 0.065 * Math.exp(-((x + 0.16) ** 2 + (z - 0.16) ** 2) * 28);
      const ml = 0.085 * Math.exp(-((x - 0.16) ** 2 + (z + 0.16) ** 2) * 24);
      const dl = 0.055 * Math.exp(-((x + 0.16) ** 2 + (z + 0.16) ** 2) * 28);
      const centralPit = -0.055 * Math.exp(-(x ** 2 + z ** 2) * 24);
      return mb + db + ml + dl + centralPit;
    }
  );
}

export function createAnatomicalToothMesh(tooth: ToothDefinition): THREE.Mesh {
  let geometry: THREE.BufferGeometry;
  const isUpper = tooth.arch === 'UPPER';
  const posInQuad = tooth.fdi % 10;

  switch (tooth.toothClass) {
    case 'INCISOR':
      geometry = createIncisorCrown(isUpper, posInQuad === 1);
      break;
    case 'CANINE':
      geometry = createCanineCrown(isUpper);
      break;
    case 'PREMOLAR':
      geometry = createPremolarCrown(isUpper);
      break;
    case 'MOLAR':
      const sz = posInQuad === 6 ? 1.0 : posInQuad === 7 ? 0.92 : 0.84;
      geometry = createMolarCrown(isUpper, sz);
      break;
    default:
      geometry = createIncisorCrown(isUpper, true);
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
// 4. REALISTIC SCALLOPED GINGIVA (GUMS SURROUNDING TEETH NATURALLY)
// =========================================================================

export function createScallopedGingiva(isUpper: boolean): THREE.Mesh {
  const segments = 100;
  const radialSlices = 10;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  const archSpecs = isUpper ? UPPER_ARCH_SPECS : LOWER_ARCH_SPECS;
  const fdiList = isUpper
    ? [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
    : [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

  const archCurvePoints = fdiList.map((fdi) => {
    const s = archSpecs[fdi];
    return new THREE.Vector3(s.x, 0, s.z);
  });
  const archCurve = new THREE.CatmullRomCurve3(archCurvePoints);

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = archCurve.getPoint(t);
    const tangent = archCurve.getTangent(t).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    const papillaAngle = t * Math.PI * 15;
    const papillaWave = 0.08 * Math.sin(papillaAngle);

    for (let r = 0; r <= radialSlices; r++) {
      const rRatio = r / radialSlices;
      const theta = (rRatio - 0.5) * Math.PI;

      const normalOffset = Math.sin(theta) * 0.44;

      let y: number;
      if (isUpper) {
        const baseAlveolar = 0.55 * Math.abs(Math.sin(theta));
        const cervicalCollar = -0.12 - papillaWave * (1.0 - Math.abs(Math.sin(theta)));
        y = cervicalCollar + baseAlveolar;
      } else {
        const baseAlveolar = -0.55 * Math.abs(Math.sin(theta));
        const cervicalCollar = 0.12 + papillaWave * (1.0 - Math.abs(Math.sin(theta)));
        y = cervicalCollar + baseAlveolar;
      }

      const x = pt.x + normal.x * normalOffset;
      const z = pt.z + normal.z * normalOffset;

      vertices.push(x, y, z);
      uvs.push(t, rRatio);
    }
  }

  const ringStride = radialSlices + 1;
  for (let i = 0; i < segments; i++) {
    const r1 = i * ringStride;
    const r2 = (i + 1) * ringStride;
    for (let r = 0; r < radialSlices; r++) {
      if (isUpper) {
        indices.push(r1 + r, r2 + r, r1 + r + 1);
        indices.push(r1 + r + 1, r2 + r, r2 + r + 1);
      } else {
        indices.push(r1 + r, r1 + r + 1, r2 + r);
        indices.push(r1 + r + 1, r2 + r + 1, r2 + r);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, createGingivaMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = isUpper ? 'maxillary_scalloped_gingiva' : 'mandibular_scalloped_gingiva';
  return mesh;
}

// =========================================================================
// 5. NATURAL UPPER PALATE & LOWER TONGUE
// =========================================================================

/**
 * Upper Hard Palate: Vaulted ceiling continuously following the parabolic lingual dental arch
 * with natural anterior palatal rugae.
 */
export function createUpperPalateMesh(): THREE.Mesh {
  const zSlices = 36;
  const xSlices = 28;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  const zStart = -1.35;

  for (let j = 0; j <= zSlices; j++) {
    const v = j / zSlices; // 0 = posterior, 1 = anterior
    // Natural parabolic arch depth (curved anteriorly along the incisors)
    const baseZ = zStart + v * (1.35 - zStart);
    // Half width of lingual border
    const w = 2.35 * Math.sqrt(Math.max(0.01, 1.0 - (v * 0.95) ** 2.2));

    for (let i = 0; i <= xSlices; i++) {
      const u = (i / xSlices) * 2 - 1; // -1 to +1
      const x = u * w;
      // Parabolic anterior curvature following incisors
      const z = baseZ - 0.22 * (x ** 2) * v;

      // Vaulted dome rising smoothly to +0.65 in the center
      const dome = 0.62 * (1.0 - u * u) * Math.sin(v * Math.PI * 0.88 + 0.12);

      // Anterior palatal rugae ridges between v = 0.40 and 0.85
      let rugae = 0;
      if (v > 0.40 && v < 0.88) {
        rugae = 0.035 * Math.sin(v * Math.PI * 7.5) * (1.0 - u * u);
      }

      const y = 0.05 + dome + rugae;

      vertices.push(x, y, z);
      uvs.push((u + 1) * 0.5, v);
    }
  }

  const rowSize = xSlices + 1;
  for (let j = 0; j < zSlices; j++) {
    const r1 = j * rowSize;
    const r2 = (j + 1) * rowSize;
    for (let i = 0; i < xSlices; i++) {
      indices.push(r1 + i, r2 + i, r1 + i + 1);
      indices.push(r1 + i + 1, r2 + i, r2 + i + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, createPalateMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'upper_hard_palate';
  return mesh;
}

/**
 * Lower Tongue: Relaxed anatomical tongue resting inside the mandibular arch.
 * Features dorsal mound and median longitudinal groove.
 */
export function createLowerTongueMesh(): THREE.Mesh {
  const zSlices = 36;
  const xSlices = 28;
  const vertices: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  const zStart = -1.30;

  for (let j = 0; j <= zSlices; j++) {
    const v = j / zSlices;
    const baseZ = zStart + v * (1.20 - zStart);
    const w = 1.95 * Math.sin(v * Math.PI * 0.72 + 0.22);

    for (let i = 0; i <= xSlices; i++) {
      const u = (i / xSlices) * 2 - 1;
      const x = u * w;
      const z = baseZ - 0.20 * (x ** 2) * v;

      // Dorsal curvature
      const mound = 0.42 * (1.0 - u * u) * Math.sin(v * Math.PI * 0.90);

      // Median sulcus along midline x = 0
      const medianSulcus = -0.055 * Math.exp(-(x ** 2) * 16) * Math.sin(v * Math.PI);

      const y = -0.10 + mound + medianSulcus;

      vertices.push(x, y, z);
      uvs.push((u + 1) * 0.5, v);
    }
  }

  const rowSize = xSlices + 1;
  for (let j = 0; j < zSlices; j++) {
    const r1 = j * rowSize;
    const r2 = (j + 1) * rowSize;
    for (let i = 0; i < xSlices; i++) {
      indices.push(r1 + i, r1 + i + 1, r2 + i);
      indices.push(r1 + i + 1, r2 + i + 1, r2 + i);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, createTongueMaterial());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'lower_tongue';
  return mesh;
}

// =========================================================================
// 6. ASSEMBLE COMPLETE FULL MOUTH 3D SCENE
// =========================================================================

export function buildFullMouthScene(): {
  rootGroup: THREE.Group;
  teethMap: Map<number, THREE.Mesh>;
  upperArchGroup: THREE.Group;
  lowerArchGroup: THREE.Group;
} {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'mouth_root';

  const teethMap = new Map<number, THREE.Mesh>();
  const transforms = calculateArchTransforms();

  // 1. Upper Arch Group (Maxilla) - Positioned at +Y and tilted back ~26°
  const upperArchGroup = new THREE.Group();
  upperArchGroup.name = 'upper_arch_group';
  upperArchGroup.position.set(0, 1.45, -0.10);
  upperArchGroup.rotation.x = -0.45;

  const upperGingiva = createScallopedGingiva(true);
  upperArchGroup.add(upperGingiva);

  const upperPalate = createUpperPalateMesh();
  upperArchGroup.add(upperPalate);

  // 2. Lower Arch Group (Mandible) - Positioned at -Y and tilted back ~22°
  const lowerArchGroup = new THREE.Group();
  lowerArchGroup.name = 'lower_arch_group';
  lowerArchGroup.position.set(0, -1.45, -0.10);
  lowerArchGroup.rotation.x = 0.38;

  const lowerGingiva = createScallopedGingiva(false);
  lowerArchGroup.add(lowerGingiva);

  const lowerTongue = createLowerTongueMesh();
  lowerArchGroup.add(lowerTongue);

  // 3. Mount all 32 Teeth
  ADULT_TEETH.forEach((tooth) => {
    const transform = transforms.get(tooth.fdi);
    if (!transform) return;

    const toothMesh = createAnatomicalToothMesh(tooth);
    toothMesh.position.copy(transform.position);
    toothMesh.rotation.copy(transform.rotation);
    toothMesh.scale.copy(transform.scale);

    teethMap.set(tooth.fdi, toothMesh);

    if (tooth.arch === 'UPPER') {
      upperArchGroup.add(toothMesh);
    } else {
      lowerArchGroup.add(toothMesh);
    }
  });

  rootGroup.add(upperArchGroup);
  rootGroup.add(lowerArchGroup);

  return { rootGroup, teethMap, upperArchGroup, lowerArchGroup };
}

// =========================================================================
// 7. ISOLATED TOOTH INSPECTION MODEL (HD SURFACE SEGMENTATION & MULTI-ROOTS)
// =========================================================================

/**
 * Builds realistic isolated tooth matching the right inspection card in the reference design.
 * Clear occlusal table with cusps, bulbous crown, and 3 anatomical roots.
 */
export function buildIsolatedToothModel(
  tooth: ToothDefinition
): {
  group: THREE.Group;
  surfaceMeshes: Map<ToothSurface, THREE.Mesh>;
} {
  const group = new THREE.Group();
  group.name = `isolated_tooth_${tooth.fdi}`;

  const surfaceMeshes = new Map<ToothSurface, THREE.Mesh>();

  const baseEnamel = createEnamelMaterial('#F6F3EB');
  const rootDentin = createRootMaterial();

  const isAnterior = tooth.isAnterior;
  const primarySurface: ToothSurface = isAnterior ? 'Incisal' : 'Occlusal';
  const facialSurface: ToothSurface = isAnterior ? 'Labial' : 'Buccal';

  // Helper to construct a quadrant surface mesh for the middle crown walls (y = -0.15 to y = 0.45)
  const createCrownSurface = (startAngle: number, arcAngle: number, surfaceName: ToothSurface) => {
    const rings = 8;
    const segments = 16;
    const vertices: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];

    const crownBottom = -0.15;
    const crownTop = 0.48;
    const width = 0.88;
    const depth = 0.90;

    for (let r = 0; r <= rings; r++) {
      const lambda = r / rings;
      const y = crownBottom + lambda * (crownTop - crownBottom);

      // Bulbous anatomical crown profile
      const bulge = 1.0 + 0.32 * Math.sin(lambda * Math.PI * 0.75);
      const rx = (width / 2) * bulge;
      const rz = (depth / 2) * bulge;

      for (let s = 0; s <= segments; s++) {
        const angle = startAngle + (s / segments) * arcAngle;
        const x = Math.sin(angle) * rx;
        const z = Math.cos(angle) * rz;

        vertices.push(x, y, z);
        uvs.push(s / segments, lambda);
      }
    }

    const rowSize = segments + 1;
    for (let r = 0; r < rings; r++) {
      const r1 = r * rowSize;
      const r2 = (r + 1) * rowSize;
      for (let s = 0; s < segments; s++) {
        indices.push(r1 + s, r1 + s + 1, r2 + s);
        indices.push(r1 + s + 1, r2 + s + 1, r2 + s);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mesh = new THREE.Mesh(geo, baseEnamel.clone());
    mesh.userData = { surface: surfaceName };
    mesh.name = `surface_${surfaceName}`;
    surfaceMeshes.set(surfaceName, mesh);
    group.add(mesh);
  };

  // 1. OCCLUSAL / INCISAL SURFACE MESH (Spanning from y = 0.48 up to y = 0.88 with 4 cusps)
  const occRings = 16;
  const occSegs = 36;
  const occVerts: number[] = [];
  const occIndices: number[] = [];
  const occUvs: number[] = [];

  const occWidth = 0.88;
  const occDepth = 0.90;
  const occBaseY = 0.72;

  for (let r = 0; r <= occRings; r++) {
    const rRatio = r / occRings;
    for (let s = 0; s <= occSegs; s++) {
      const angle = (s / occSegs) * Math.PI * 2;
      const x = Math.sin(angle) * (occWidth / 2) * rRatio;
      const z = Math.cos(angle) * (occDepth / 2) * rRatio;

      let sculpt = 0;
      if (!isAnterior) {
        // 4 cusps: MB, DB, ML, DL + central pit
        const mb = 0.12 * Math.exp(-((x - 0.22) ** 2 + (z - 0.22) ** 2) * 18);
        const db = 0.09 * Math.exp(-((x + 0.22) ** 2 + (z - 0.22) ** 2) * 18);
        const ml = 0.13 * Math.exp(-((x - 0.22) ** 2 + (z + 0.22) ** 2) * 16);
        const dl = 0.08 * Math.exp(-((x + 0.22) ** 2 + (z + 0.22) ** 2) * 18);
        const centralPit = -0.06 * Math.exp(-(x ** 2 + z ** 2) * 16);
        sculpt = mb + db + ml + dl + centralPit;
      } else {
        sculpt = 0.04 * (1.0 - Math.abs(x / (occWidth / 2)));
      }

      // At rRatio = 1, smoothly slope down to meet the crown side walls at y = 0.48
      const bevelY = occBaseY - 0.24 * (rRatio ** 3);

      occVerts.push(x, bevelY + sculpt, z);
      occUvs.push(s / occSegs, rRatio);
    }
  }

  const occRow = occSegs + 1;
  for (let r = 0; r < occRings; r++) {
    const r1 = r * occRow;
    const r2 = (r + 1) * occRow;
    for (let s = 0; s < occSegs; s++) {
      occIndices.push(r1 + s, r2 + s, r1 + s + 1);
      occIndices.push(r1 + s + 1, r2 + s, r2 + s + 1);
    }
  }

  const occGeo = new THREE.BufferGeometry();
  occGeo.setAttribute('position', new THREE.Float32BufferAttribute(occVerts, 3));
  occGeo.setAttribute('uv', new THREE.Float32BufferAttribute(occUvs, 2));
  occGeo.setIndex(occIndices);
  occGeo.computeVertexNormals();

  const occMat = baseEnamel.clone();
  occMat.side = THREE.DoubleSide;
  const occMesh = new THREE.Mesh(occGeo, occMat);
  occMesh.userData = { surface: primarySurface };
  occMesh.name = `surface_${primarySurface}`;
  surfaceMeshes.set(primarySurface, occMesh);
  group.add(occMesh);

  // 2. BUCCAL / LABIAL SURFACE
  createCrownSurface(-Math.PI * 0.25, Math.PI * 0.50, facialSurface);

  // 3. LINGUAL SURFACE
  createCrownSurface(Math.PI * 0.75, Math.PI * 0.50, 'Lingual');

  // 4. MESIAL SURFACE
  createCrownSurface(Math.PI * 0.25, Math.PI * 0.50, 'Mesial');

  // 5. DISTAL SURFACE
  createCrownSurface(-Math.PI * 0.75, Math.PI * 0.50, 'Distal');

  // 6. ANATOMICAL MULTI-ROOTS (Curved, realistic roots with smooth apices)
  const rootGroup = new THREE.Group();
  rootGroup.name = 'roots';

  const rootDentinMat = rootDentin.clone();
  rootDentinMat.side = THREE.DoubleSide;

  const createSmoothRoot = (startX: number, startZ: number, endX: number, endZ: number, length: number, radius: number) => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(startX, -0.15, startZ),
      new THREE.Vector3((startX + endX) * 0.5, -0.15 - length * 0.5, (startZ + endZ) * 0.5),
      new THREE.Vector3(endX, -0.15 - length, endZ),
    ]);
    const geo = new THREE.TubeGeometry(curve, 20, radius, 14, false);
    const mesh = new THREE.Mesh(geo, rootDentinMat);
    mesh.userData = { surface: 'Root' };
    mesh.name = 'surface_Root';
    return mesh;
  };

  if (tooth.toothClass === 'MOLAR') {
    // 3 distinct roots: Mesiobuccal, Distobuccal, and Palatal/Lingual
    const mbRoot = createSmoothRoot(-0.25, 0.20, -0.36, 0.26, 1.25, 0.16);
    const dbRoot = createSmoothRoot(0.25, 0.20, 0.36, 0.26, 1.20, 0.15);
    const palRoot = createSmoothRoot(0.0, -0.22, 0.0, -0.38, 1.35, 0.18);
    rootGroup.add(mbRoot, dbRoot, palRoot);
  } else if (tooth.toothClass === 'PREMOLAR') {
    const bRoot = createSmoothRoot(-0.16, 0.0, -0.24, 0.0, 1.20, 0.16);
    const lRoot = createSmoothRoot(0.16, 0.0, 0.24, 0.0, 1.20, 0.15);
    rootGroup.add(bRoot, lRoot);
  } else {
    // Single tapered anterior root
    const singleRoot = createSmoothRoot(0.0, 0.0, 0.0, -0.10, 1.40, 0.22);
    rootGroup.add(singleRoot);
  }

  // Root interaction proxy
  const rootProxyGeo = new THREE.CylinderGeometry(0.65, 0.20, 1.35, 16);
  const rootProxy = new THREE.Mesh(rootProxyGeo, rootDentinMat);
  rootProxy.position.set(0, -0.80, 0);
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
