import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Target, Plus, Minus, Maximize2, RotateCcw } from 'lucide-react';
import {
  ToothDefinition,
  CameraViewPreset,
  DentalFindingItem,
  getToothByFDI,
  getConditionColor,
} from '../types/dentalChart.types';
import { buildFullMouthScene } from '../3d/dentalGeometry';
import { MiniArchSelector } from './MiniArchSelector';

interface DentalModelViewerProps {
  selectedFDI: number;
  onSelectTooth: (fdi: number) => void;
  findings: DentalFindingItem[];
}

export const DentalModelViewer: React.FC<DentalModelViewerProps> = ({
  selectedFDI,
  onSelectTooth,
  findings,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const teethMapRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const highlightGroupRef = useRef<THREE.Group | null>(null);
  const selectedOutlineRef = useRef<THREE.Mesh | null>(null);

  // Callout 2D Screen Position
  const [calloutPos, setCalloutPos] = useState<{ x: number; y: number; visible: boolean }>({
    x: 0,
    y: 0,
    visible: false,
  });

  const [activeView, setActiveView] = useState<CameraViewPreset>('front');
  const [hoveredTooth, setHoveredTooth] = useState<ToothDefinition | null>(null);

  // Map of teeth that have clinical findings for colored visual indication
  const toothConditionColors = new Map<number, string>();
  findings.forEach((f) => {
    if (!toothConditionColors.has(f.toothNumber)) {
      toothConditionColors.set(f.toothNumber, getConditionColor(f.condition));
    }
  });

  // Camera presets
  const applyCameraView = useCallback((view: CameraViewPreset) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const camera = cameraRef.current;
    const controls = controlsRef.current;

    setActiveView(view);
    const target = new THREE.Vector3(0, 0, 0);
    controls.target.copy(target);

    switch (view) {
      case 'front':
        camera.position.set(0, 0.0, 8.4);
        controls.target.set(0, 0, 0);
        break;
      case 'right':
        camera.position.set(7.8, 0.1, 1.8);
        controls.target.set(0, 0, 0);
        break;
      case 'left':
        camera.position.set(-7.8, 0.1, 1.8);
        controls.target.set(0, 0, 0);
        break;
      case 'upper':
        // Direct occlusal mirror view of the maxillary arch & palate
        camera.position.set(0, -1.2, 5.8);
        controls.target.set(0, 1.45, 0.1);
        break;
      case 'lower':
        // Direct occlusal mirror view of the mandibular arch & tongue
        camera.position.set(0, 1.2, 5.8);
        controls.target.set(0, -1.45, 0.1);
        break;
    }
    controls.update();
  }, []);

  // Center / Focus on selected tooth or arch
  const handleFocus = useCallback(() => {
    const mesh = teethMapRef.current.get(selectedFDI);
    if (mesh && controlsRef.current && cameraRef.current) {
      const worldPos = new THREE.Vector3();
      mesh.getWorldPosition(worldPos);
      controlsRef.current.target.copy(worldPos);

      // Smooth move closer
      const dir = cameraRef.current.position.clone().sub(worldPos).normalize();
      cameraRef.current.position.copy(worldPos.clone().add(dir.multiplyScalar(4.5)));
      controlsRef.current.update();
    }
  }, [selectedFDI]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const factor = direction === 'in' ? 0.85 : 1.18;
    const target = controlsRef.current.target;
    const offset = cameraRef.current.position.clone().sub(target).multiplyScalar(factor);

    if (offset.length() > 3.0 && offset.length() < 20.0) {
      cameraRef.current.position.copy(target.clone().add(offset));
      controlsRef.current.update();
    }
  }, []);

  const handleReset = useCallback(() => {
    applyCameraView('front');
  }, [applyCameraView]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch((err) => console.error(err));
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
    }
  }, []);

  // Main Three.js Scene Setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = container.clientHeight || 550;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color('#071923'); // Deep dark navy matching reference image

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 9.2);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;
    container.replaceChildren(renderer.domElement);

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    // Main Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    keyLight.position.set(4, 6, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    // Rim / Fill Cool Light
    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.9);
    fillLight.position.set(-6, -2, 5);
    scene.add(fillLight);

    // Top Overhead Light
    const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
    topLight.position.set(0, 8, 0);
    scene.add(topLight);

    // Back Silhouette Light
    const backLight = new THREE.DirectionalLight(0x0ea5e9, 0.6);
    backLight.position.set(0, 2, -6);
    scene.add(backLight);

    // 5. Build Complete Full Mouth 3D Model
    const { rootGroup, teethMap } = buildFullMouthScene();
    teethMapRef.current = teethMap;
    scene.add(rootGroup);

    // Dynamic Highlight Group for selected tooth cyan glow outline
    const highlightGroup = new THREE.Group();
    highlightGroup.name = 'highlight_group';
    scene.add(highlightGroup);
    highlightGroupRef.current = highlightGroup;

    // 6. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 3.0;
    controls.maxDistance = 18.0;
    controls.maxPolarAngle = Math.PI * 0.85;
    controls.minPolarAngle = Math.PI * 0.15;
    controlsRef.current = controls;

    // 7. Raycasting Setup
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const getRaycastTooth = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(teethMap.values());
      const intersects = raycaster.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        return intersects[0].object as THREE.Mesh;
      }
      return null;
    };

    const handlePointerMove = (event: MouseEvent) => {
      const hit = getRaycastTooth(event);
      if (hit && hit.userData?.fdi) {
        container.style.cursor = 'pointer';
        setHoveredTooth(getToothByFDI(hit.userData.fdi) || null);
      } else {
        container.style.cursor = 'default';
        setHoveredTooth(null);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const hit = getRaycastTooth(event);
      if (hit && hit.userData?.fdi) {
        onSelectTooth(hit.userData.fdi);
      }
    };

    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();

      // Project selected tooth position to 2D screen coordinates for callout label
      const selectedMesh = teethMap.get(selectedFDI);
      if (selectedMesh && container) {
        const worldPos = new THREE.Vector3();
        selectedMesh.getWorldPosition(worldPos);

        // Slightly above tooth
        worldPos.y += 0.35;
        const screenPos = worldPos.clone().project(camera);

        const isBehind = screenPos.z > 1;
        if (!isBehind) {
          const hw = container.clientWidth / 2;
          const hh = container.clientHeight / 2;
          const x = screenPos.x * hw + hw;
          const y = -(screenPos.y * hh) + hh;

          setCalloutPos({ x, y, visible: true });
        } else {
          setCalloutPos((prev) => ({ ...prev, visible: false }));
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // 9. Resize Handling
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, [onSelectTooth, selectedFDI]);

  // Update Tooth Materials (Selected highlight + Condition colors)
  useEffect(() => {
    // 1. Update Highlight Outline attached directly to the selected tooth
    if (selectedOutlineRef.current) {
      selectedOutlineRef.current.parent?.remove(selectedOutlineRef.current);
      selectedOutlineRef.current.geometry.dispose();
      selectedOutlineRef.current = null;
    }

    const selectedMesh = teethMapRef.current.get(selectedFDI);
    if (selectedMesh) {
      // Glowing cyan outline wireframe matching reference
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        wireframe: true,
        transparent: true,
        opacity: 0.85,
        depthTest: true,
      });
      const outlineMesh = new THREE.Mesh(selectedMesh.geometry, wireMat);
      outlineMesh.scale.set(1.05, 1.05, 1.05);
      selectedMesh.add(outlineMesh);
      selectedOutlineRef.current = outlineMesh;
    }

    // 2. Update Teeth Enamel Materials
    teethMapRef.current.forEach((mesh, fdi) => {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat) return;

      const isSelected = fdi === selectedFDI;
      const conditionColor = toothConditionColors.get(fdi);

      if (isSelected) {
        // Enamel with radiant cyan subsurface glow
        mat.color.set('#d0f4ff');
        mat.emissive.set('#00b4d8');
        mat.emissiveIntensity = 0.45;
        mat.roughness = 0.12;
        mat.clearcoat = 0.95;
      } else if (conditionColor) {
        // Condition-coded color
        mat.color.set(conditionColor);
        mat.emissive.set(conditionColor);
        mat.emissiveIntensity = 0.25;
        mat.roughness = 0.22;
        mat.clearcoat = 0.5;
      } else {
        // Natural Ivory Enamel
        mat.color.set('#FCFAF7');
        mat.emissive.set('#000000');
        mat.emissiveIntensity = 0.0;
        mat.roughness = 0.16;
        mat.clearcoat = 0.85;
      }
      mat.needsUpdate = true;
    });
  }, [selectedFDI, toothConditionColors]);

  const selectedToothObj = getToothByFDI(selectedFDI);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 min-h-[500px] lg:min-h-[560px] bg-[#071923] rounded-3xl overflow-hidden border border-slate-800 shadow-xl select-none"
    >
      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* 1. Floating Tooth Callout Marker matching reference image */}
      {calloutPos.visible && selectedToothObj && (
        <div
          className="absolute z-20 pointer-events-none transition-transform duration-75 ease-out"
          style={{
            left: `${calloutPos.x - 170}px`,
            top: `${calloutPos.y - 50}px`,
          }}
        >
          <div className="relative flex items-center">
            <div className="relative bg-slate-950/85 backdrop-blur-md border border-cyan-500/60 rounded-xl px-3.5 py-2 shadow-2xl flex flex-col">
              <span className="text-xs font-black text-white tracking-wide">
                Tooth {selectedToothObj.fdi}
              </span>
              <span className="text-[10px] font-medium text-cyan-300/90 whitespace-nowrap">
                {selectedToothObj.name}
              </span>
            </div>
            {/* Pointer line extending to tooth */}
            <div className="w-7 h-[1.5px] bg-gradient-to-r from-cyan-400 to-cyan-300" />
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
          </div>
        </div>
      )}

      {/* Hover Tooltip if hovering another tooth */}
      {hoveredTooth && hoveredTooth.fdi !== selectedFDI && (
        <div className="absolute top-4 left-5 z-20 pointer-events-none bg-slate-900/90 backdrop-blur-sm border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-200">
          Tooth {hoveredTooth.fdi} — {hoveredTooth.name} (Click to inspect)
        </div>
      )}

      {/* 2. Mini Dental Arch Selector (Bottom Left) */}
      <MiniArchSelector
        selectedFDI={selectedFDI}
        onSelectTooth={onSelectTooth}
        toothConditionColors={toothConditionColors}
      />

      {/* 3. Right Vertical Action Controls matching reference image */}
      <div className="absolute top-6 right-5 z-20 flex flex-col bg-slate-950/75 backdrop-blur-md border border-slate-800 rounded-2xl p-1 shadow-2xl gap-1">
        {/* Center / Focus */}
        <button
          type="button"
          onClick={handleFocus}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          title="Center / Focus on Selected Tooth"
        >
          <Target className="w-4 h-4" />
        </button>

        {/* Zoom In */}
        <button
          type="button"
          onClick={() => handleZoom('in')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          title="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => handleZoom('out')}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          title="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* Fullscreen */}
        <button
          type="button"
          onClick={handleFullscreen}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          title="Toggle Fullscreen"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Reset Camera */}
        <button
          type="button"
          onClick={handleReset}
          className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-xl transition cursor-pointer"
          title="Reset Camera Position"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Bottom View Selection Toolbar matching reference image */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 z-20 flex items-center bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-2xl p-1 shadow-2xl gap-1">
        {(['front', 'right', 'left', 'upper', 'lower'] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => applyCameraView(view)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
              activeView === view
                ? 'bg-[#008f8c] text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            {view}
          </button>
        ))}
      </div>
    </div>
  );
};
