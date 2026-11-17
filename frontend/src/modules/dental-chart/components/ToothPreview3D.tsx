import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ToothDefinition, ToothSurface } from '../types/dentalChart.types';
import { buildIsolatedToothModel } from '../3d/dentalGeometry';

interface ToothPreview3DProps {
  tooth: ToothDefinition;
  selectedSurface: ToothSurface;
  onSelectSurface: (surface: ToothSurface) => void;
}

export const ToothPreview3D: React.FC<ToothPreview3DProps> = ({
  tooth,
  selectedSurface,
  onSelectSurface,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const surfaceMeshesRef = useRef<Map<ToothSurface, THREE.Mesh>>(new Map());

  const updateHighlights = useCallback((surfaceToHighlight: ToothSurface) => {
    surfaceMeshesRef.current.forEach((mesh, surface) => {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mat) return;

      const isCurrent = surface === surfaceToHighlight;
      if (isCurrent) {
        // Glowing Vibrant Blue/Teal Surface matching reference image
        mat.color.set('#00b4d8');
        mat.emissive.set('#0096c7');
        mat.emissiveIntensity = 0.82;
        mat.roughness = 0.10;
        mat.clearcoat = 0.95;
        mat.clearcoatRoughness = 0.08;
      } else {
        // Natural Ivory Enamel or Root Dentin
        if (surface === 'Root') {
          mat.color.set('#E6D7BD');
          mat.emissive.set('#000000');
          mat.emissiveIntensity = 0.0;
        } else {
          mat.color.set('#FAF8F3');
          mat.emissive.set('#000000');
          mat.emissiveIntensity = 0.0;
        }
        mat.roughness = 0.16;
        mat.clearcoat = 0.8;
      }
      mat.needsUpdate = true;
    });
  }, []);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 180;
    const height = container.clientHeight || 180;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 50);
    camera.position.set(0, 1.35, 3.2);

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.replaceChildren(renderer.domElement);

    // 4. Lighting Rig
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(3, 5, 4);
    scene.add(dirLight1);

    const topLight = new THREE.DirectionalLight(0xffffff, 1.1);
    topLight.position.set(0, 5, 1);
    scene.add(topLight);

    const dirLight2 = new THREE.DirectionalLight(0xa5f3fc, 0.65);
    dirLight2.position.set(-3, -2, -2);
    scene.add(dirLight2);

    // 5. Build Isolated Tooth Geometry
    const { group, surfaceMeshes } = buildIsolatedToothModel(tooth);
    surfaceMeshesRef.current = surfaceMeshes;
    scene.add(group);

    // Apply immediate highlight to current selected surface
    updateHighlights(selectedSurface);

    // 6. Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 5.5;
    controls.target.set(0, 0.12, 0);
    controls.update();

    // 7. Raycasting for direct 3D surface clicking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handlePointerDown = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(surfaceMeshes.values());
      const intersects = raycaster.intersectObjects(meshes, true);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit.userData?.surface) {
          onSelectSurface(hit.userData.surface as ToothSurface);
        }
      }
    };

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);

    // 8. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      controls.update();
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

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      cancelAnimationFrame(animationFrameId);
      controls.dispose();
      renderer.dispose();
      container.replaceChildren();
    };
  }, [tooth, onSelectSurface, selectedSurface, updateHighlights]);

  // Update Surface Highlights when selectedSurface prop changes
  useEffect(() => {
    updateHighlights(selectedSurface);
  }, [selectedSurface, updateHighlights]);

  return (
    <div className="relative w-full h-[180px] bg-gradient-to-b from-slate-50 to-slate-100/90 rounded-2xl border border-slate-200/90 shadow-inner flex items-center justify-center overflow-hidden group">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="absolute top-2 left-2.5 pointer-events-none">
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded shadow-2xs">
          3D Surface
        </span>
      </div>
      <div className="absolute bottom-2 right-2.5 pointer-events-none">
        <span className="text-[9px] font-semibold text-slate-400">
          Rotate / Click Surface
        </span>
      </div>
    </div>
  );
};
