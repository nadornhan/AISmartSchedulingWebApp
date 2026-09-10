'use client';

import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { UserPlant } from '../../lib/gamification';

type ForestScene3DProps = {
  trees: UserPlant[];
  selectedId: string | null;
  placingPlantId: string | null;
  onSelectTree: (plantId: string) => void;
  onPlaceAt: (position: { x: number; z: number }) => void;
  cameraResetKey?: number;
};

type SpeciesPalette = {
  trunk: string;
  foliage: string;
  accent: string;
};

function paletteFor(speciesKey: string, stage: string): SpeciesPalette {
  const map: Record<string, SpeciesPalette> = {
    oak: { trunk: '#6b4423', foliage: '#2f7d4a', accent: '#3f9a5c' },
    maple: { trunk: '#7a4a2a', foliage: '#3f8f4a', accent: '#5aad62' },
    pine: { trunk: '#5c4033', foliage: '#1f6b45', accent: '#2f8a5a' },
    cherry_blossom: { trunk: '#6e4a3a', foliage: '#6f9e5a', accent: '#e879a8' },
    bonsai: { trunk: '#5a4636', foliage: '#4a7c59', accent: '#6aa87a' },
    willow: { trunk: '#6b5535', foliage: '#6f9e4a', accent: '#8fbf5c' },
    lavender: { trunk: '#6a5a40', foliage: '#7a9a58', accent: '#8b6bb5' },
    sunflower: { trunk: '#6b5230', foliage: '#5f9a3f', accent: '#e8b923' },
  };
  const base = map[speciesKey] ?? map.oak;
  if (speciesKey === 'maple') {
    if (stage === 'mature') return { trunk: '#7a4a2a', foliage: '#c45c26', accent: '#e07a3a' };
    if (stage === 'growing') return { trunk: '#7a4a2a', foliage: '#3f8f4a', accent: '#5aad62' };
    return { trunk: '#7a4a2a', foliage: '#5aad62', accent: '#7bc47f' };
  }
  if (speciesKey === 'cherry_blossom' && stage === 'mature') {
    return { trunk: '#6e4a3a', foliage: '#f2a6c1', accent: '#e879a8' };
  }
  if (speciesKey === 'lavender' && stage === 'mature') {
    return { trunk: '#6a5a40', foliage: '#8b6bb5', accent: '#a889d0' };
  }
  if (speciesKey === 'sunflower' && stage === 'mature') {
    return { trunk: '#6b5230', foliage: '#e8b923', accent: '#f0cb4a' };
  }
  return base;
}

function hashString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function stageScale(stage: string) {
  if (stage === 'mature') return 1;
  if (stage === 'growing') return 0.72;
  return 0.42;
}

function SpeciesMesh({
  speciesKey,
  stage,
  colors,
}: {
  speciesKey: string;
  stage: string;
  colors: SpeciesPalette;
}) {
  if (stage === 'seedling') {
    return (
      <group>
        <mesh position={[0, 0.28, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.06, 0.55, 6]} />
          <meshStandardMaterial color={colors.trunk} />
        </mesh>
        <mesh position={[-0.12, 0.5, 0]} rotation={[0, 0, 0.6]} castShadow>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color={colors.foliage} />
        </mesh>
        <mesh position={[0.12, 0.48, 0]} rotation={[0, 0, -0.5]} castShadow>
          <sphereGeometry args={[0.09, 8, 8]} />
          <meshStandardMaterial color={colors.accent} />
        </mesh>
      </group>
    );
  }

  if (speciesKey === 'pine') {
    const h = stage === 'mature' ? 1 : 0.75;
    return (
      <group>
        <mesh position={[0, 0.55 * h, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.14, 1.1 * h, 6]} />
          <meshStandardMaterial color={colors.trunk} />
        </mesh>
        <mesh position={[0, 1.2 * h, 0]} castShadow>
          <coneGeometry args={[0.7, 1.1 * h, 7]} />
          <meshStandardMaterial color={colors.foliage} />
        </mesh>
        <mesh position={[0, 1.75 * h, 0]} castShadow>
          <coneGeometry args={[0.5, 0.9 * h, 7]} />
          <meshStandardMaterial color={colors.accent} />
        </mesh>
        {stage === 'mature' ? (
          <mesh position={[0, 2.25, 0]} castShadow>
            <coneGeometry args={[0.32, 0.7, 7]} />
            <meshStandardMaterial color={colors.foliage} />
          </mesh>
        ) : null}
      </group>
    );
  }

  if (speciesKey === 'willow') {
    return (
      <group>
        <mesh position={[0, 0.75, 0]} castShadow>
          <cylinderGeometry args={[0.1, 0.15, 1.5, 6]} />
          <meshStandardMaterial color={colors.trunk} />
        </mesh>
        <mesh position={[0, 1.55, 0]} castShadow>
          <sphereGeometry args={[0.7, 10, 10]} />
          <meshStandardMaterial color={colors.foliage} />
        </mesh>
        {[-0.45, 0, 0.45].map((x) => (
          <mesh key={x} position={[x, 0.85, 0.15]} castShadow>
            <cylinderGeometry args={[0.035, 0.02, 1.1, 5]} />
            <meshStandardMaterial color={colors.accent} />
          </mesh>
        ))}
      </group>
    );
  }

  if (speciesKey === 'sunflower') {
    return (
      <group>
        <mesh position={[0, 0.7, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.08, 1.4, 6]} />
          <meshStandardMaterial color={colors.trunk} />
        </mesh>
        <mesh position={[0, 1.45, 0]} castShadow>
          <sphereGeometry args={[0.35, 10, 10]} />
          <meshStandardMaterial color={colors.foliage} />
        </mesh>
        <mesh position={[0, 1.45, 0.12]} castShadow>
          <sphereGeometry args={[0.16, 8, 8]} />
          <meshStandardMaterial color="#6b4423" />
        </mesh>
      </group>
    );
  }

  if (speciesKey === 'lavender') {
    return (
      <group>
        {[-0.18, 0, 0.18].map((x, index) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.03, 0.04, 0.9, 5]} />
              <meshStandardMaterial color={colors.trunk} />
            </mesh>
            <mesh position={[0, 0.95 + index * 0.05, 0]} castShadow>
              <sphereGeometry args={[0.14, 8, 8]} />
              <meshStandardMaterial color={stage === 'mature' ? colors.accent : colors.foliage} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }

  if (speciesKey === 'bonsai') {
    return (
      <group>
        <mesh position={[0, 0.35, 0]} castShadow>
          <cylinderGeometry args={[0.12, 0.18, 0.7, 6]} />
          <meshStandardMaterial color={colors.trunk} />
        </mesh>
        <mesh position={[0.15, 0.85, 0]} castShadow>
          <sphereGeometry args={[0.42, 10, 10]} />
          <meshStandardMaterial color={colors.foliage} />
        </mesh>
        <mesh position={[-0.2, 0.7, 0.1]} castShadow>
          <sphereGeometry args={[0.28, 10, 10]} />
          <meshStandardMaterial color={colors.accent} />
        </mesh>
      </group>
    );
  }

  // Oak / maple / cherry default broadleaf — canopy color follows species×stage.
  const canopyY = stage === 'growing' ? 1.25 : 1.55;
  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow>
        <cylinderGeometry args={[0.11, 0.17, 1.4, 6]} />
        <meshStandardMaterial color={colors.trunk} />
      </mesh>
      <mesh position={[0, canopyY, 0]} castShadow>
        <sphereGeometry args={[stage === 'growing' ? 0.7 : 0.95, 12, 12]} />
        <meshStandardMaterial color={colors.foliage} />
      </mesh>
      <mesh position={[-0.45, canopyY - 0.15, 0.1]} castShadow>
        <sphereGeometry args={[0.45, 10, 10]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
      <mesh position={[0.45, canopyY - 0.1, -0.05]} castShadow>
        <sphereGeometry args={[0.42, 10, 10]} />
        <meshStandardMaterial color={colors.accent} />
      </mesh>
      {speciesKey === 'cherry_blossom' && stage === 'mature' ? (
        <>
          <mesh position={[0.2, canopyY + 0.35, 0.3]}>
            <sphereGeometry args={[0.08, 6, 6]} />
            <meshStandardMaterial color="#fff5f8" />
          </mesh>
          <mesh position={[-0.25, canopyY + 0.2, -0.2]}>
            <sphereGeometry args={[0.07, 6, 6]} />
            <meshStandardMaterial color="#fff5f8" />
          </mesh>
        </>
      ) : null}
    </group>
  );
}

function SoftCloud({
  position,
  reducedMotion,
  speed = 1,
}: {
  position: [number, number, number];
  reducedMotion: boolean;
  speed?: number;
}) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current || reducedMotion) return;
    ref.current.position.x = position[0] + Math.sin(clock.getElapsedTime() * 0.08 * speed) * 4;
  });
  return (
    <group position={position} ref={ref}>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.4, 10, 10]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.85} />
      </mesh>
      <mesh position={[1.2, 0.15, 0.2]}>
        <sphereGeometry args={[1.1, 10, 10]} />
        <meshStandardMaterial color="#f7fbff" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-1.1, 0.05, -0.15]}>
        <sphereGeometry args={[1.0, 10, 10]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.78} />
      </mesh>
    </group>
  );
}

function MeadowFlowers() {
  const flowers = useMemo(() => {
    const items: Array<{ x: number; z: number; color: string }> = [];
    const colors = ['#f4a6c8', '#f0d35c', '#9ecbff', '#ff9f7a', '#c9a0ff'];
    for (let i = 0; i < 28; i += 1) {
      const angle = (i / 28) * Math.PI * 2;
      const radius = 6 + (i % 5) * 2.4;
      items.push({
        x: Math.cos(angle) * radius + ((i * 13) % 7) * 0.2,
        z: Math.sin(angle) * radius + ((i * 7) % 5) * 0.15,
        color: colors[i % colors.length],
      });
    }
    return items;
  }, []);

  return (
    <group>
      {flowers.map((flower, index) => (
        <mesh key={index} position={[flower.x, 0.08, flower.z]}>
          <sphereGeometry args={[0.08, 6, 6]} />
          <meshStandardMaterial color={flower.color} />
        </mesh>
      ))}
    </group>
  );
}

function LowPolyTree({
  plant,
  selected,
  reducedMotion,
  onSelect,
}: {
  plant: UserPlant;
  selected: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const shakeUntil = useRef(0);
  const stage = String(plant.growth_stage || 'seedling').toLowerCase();
  const speciesKey = plant.species.image_key;
  const colors = paletteFor(speciesKey, stage);
  const seed = hashString(plant.id);
  const scale = stageScale(stage) * (0.92 + (seed % 18) / 100);
  const position: [number, number, number] = plant.position
    ? [plant.position.x, plant.position.y || 0, plant.position.z]
    : [((seed % 17) - 8) * 1.6, 0, ((Math.floor(seed / 17) % 17) - 8) * 1.6];
  const rotationY = plant.position?.rotation_y ?? (seed % 628) / 100;
  const rotationX = plant.position?.rotation_x ?? 0;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    let sway = 0;
    if (!reducedMotion) {
      sway = Math.sin(t * 1.15 + seed * 0.01) * (stage === 'seedling' ? 0.02 : 0.035);
    }
    let shake = 0;
    if (performance.now() < shakeUntil.current) {
      shake = Math.sin(performance.now() * 0.05) * 0.08;
    }
    group.current.rotation.x = rotationX + sway * 0.15;
    group.current.rotation.z = sway + shake;
    group.current.rotation.y = rotationY + sway * 0.2;
  });

  return (
    <group
      position={position}
      ref={group}
      scale={scale}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation();
        shakeUntil.current = performance.now() + 280;
        onSelect();
      }}
    >
      <SpeciesMesh colors={colors} speciesKey={speciesKey} stage={stage} />
      {selected ? (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.55, 0.8, 24]} />
          <meshBasicMaterial color="#2eb67d" transparent opacity={0.8} />
        </mesh>
      ) : null}
    </group>
  );
}

function Ground({
  placing,
  onPlaceAt,
}: {
  placing: boolean;
  onPlaceAt: (position: { x: number; z: number }) => void;
}) {
  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
      onClick={(event: ThreeEvent<MouseEvent>) => {
        if (!placing) return;
        event.stopPropagation();
        onPlaceAt({ x: event.point.x, z: event.point.z });
      }}
    >
      <planeGeometry args={[90, 90]} />
      <meshStandardMaterial color="#6fbf6a" />
    </mesh>
  );
}

function SceneContent({
  trees,
  selectedId,
  placingPlantId,
  onSelectTree,
  onPlaceAt,
  cameraResetKey = 0,
}: ForestScene3DProps) {
  const controlsRef = useRef<any>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!controlsRef.current) return;
    controlsRef.current.reset?.();
    controlsRef.current.target?.set(0, 0.8, 0);
    controlsRef.current.update?.();
  }, [cameraResetKey]);

  const placedTrees = useMemo(
    () => trees.filter((tree) => tree.is_placed_in_forest || tree.position),
    [trees],
  );

  return (
    <>
      <color attach="background" args={['#87c7f5']} />
      <fog attach="fog" args={['#cfe9ff', 38, 78]} />
      <ambientLight intensity={0.75} />
      <directionalLight
        castShadow
        intensity={1.35}
        position={[14, 20, 10]}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
      />
      <hemisphereLight args={['#b8e0ff', '#6fbf6a', 0.55]} />
      <SoftCloud position={[-10, 11, -8]} reducedMotion={reducedMotion} speed={1.1} />
      <SoftCloud position={[8, 12.5, -14]} reducedMotion={reducedMotion} speed={0.8} />
      <SoftCloud position={[2, 10.5, 6]} reducedMotion={reducedMotion} speed={1.3} />
      <Ground placing={Boolean(placingPlantId)} onPlaceAt={onPlaceAt} />
      <MeadowFlowers />
      {placedTrees.map((tree) => (
        <LowPolyTree
          key={tree.id}
          onSelect={() => onSelectTree(tree.id)}
          plant={tree}
          reducedMotion={reducedMotion}
          selected={selectedId === tree.id}
        />
      ))}
      <OrbitControls
        enableDamping={!reducedMotion}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={6}
        maxDistance={42}
        ref={controlsRef}
        target={[0, 0.8, 0]}
      />
    </>
  );
}

export function ForestScene3D(props: ForestScene3DProps) {
  return (
    <div className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-xl border border-dashboard-border bg-[#87c7f5]">
      <Canvas camera={{ position: [10, 9, 12], fov: 45 }} shadows dpr={[1, 1.75]}>
        <SceneContent {...props} />
      </Canvas>
      {props.placingPlantId ? (
        <p className="pointer-events-none absolute bottom-4 left-4 rounded-lg bg-black/40 px-3 py-2 text-xs text-white">
          Click the ground to plant or move your tree
        </p>
      ) : null}
    </div>
  );
}
