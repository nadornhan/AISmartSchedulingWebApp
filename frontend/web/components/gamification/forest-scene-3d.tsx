'use client';

import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import {
  Component,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
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

type SceneInstance = {
  position: [number, number, number];
  rotation?: [number, number, number];
  scale: [number, number, number];
  color?: string;
};

const GARDEN_HALF_WIDTH = 17;
const GARDEN_HALF_DEPTH = 14;

const PLANT_MODEL_PATHS = {
  oak: {
    seedling: '/models/plants/oak/seedling.glb',
    growing: '/models/plants/oak/growing.glb',
    mature: '/models/plants/oak/mature.glb',
  },
  maple: {
    seedling: '/models/plants/chrono-maple/seedling.glb',
    growing: '/models/plants/chrono-maple/growing.glb',
    mature: '/models/plants/chrono-maple/mature.glb',
  },
  pine: {
    seedling: '/models/plants/pine/seedling.glb',
    growing: '/models/plants/pine/growing.glb',
    mature: '/models/plants/pine/mature.glb',
  },
  cherry_blossom: {
    seedling: '/models/plants/cherry_blossom/seedling.glb',
    growing: '/models/plants/cherry_blossom/growing.glb',
    mature: '/models/plants/cherry_blossom/mature.glb',
  },
  bonsai: {
    seedling: '/models/plants/bonsai/seedling.glb',
    growing: '/models/plants/bonsai/growing.glb',
    mature: '/models/plants/bonsai/mature.glb',
  },
  willow: {
    seedling: '/models/plants/willow/seedling.glb',
    growing: '/models/plants/willow/growing.glb',
    mature: '/models/plants/willow/mature.glb',
  },
  lavender: {
    seedling: '/models/plants/lavender/seedling.glb',
    growing: '/models/plants/lavender/growing.glb',
    mature: '/models/plants/lavender/mature.glb',
  },
  sunflower: {
    seedling: '/models/plants/sunflower/seedling.glb',
    growing: '/models/plants/sunflower/growing.glb',
    mature: '/models/plants/sunflower/mature.glb',
  },
  chrono: {
    seedling: '/models/plants/chrono/seedling.glb',
    growing: '/models/plants/chrono/growing.glb',
    mature: '/models/plants/chrono/mature.glb',
  },
} as const;

type ModelledSpecies = keyof typeof PLANT_MODEL_PATHS;
type ModelledStage = 'seedling' | 'growing' | 'mature';

function plantModelPath(speciesKey: string, stage: string): string | null {
  if (!(speciesKey in PLANT_MODEL_PATHS)) return null;
  const normalizedStage: ModelledStage =
    stage === 'mature' || stage === 'growing' ? stage : 'seedling';
  return PLANT_MODEL_PATHS[speciesKey as ModelledSpecies][normalizedStage];
}

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
    chrono: { trunk: '#10142f', foliage: '#14d9d0', accent: '#d95bd2' },
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

function GlbPlantModel({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const instance = useMemo(() => {
    const clone = scene.clone(true);
    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    return clone;
  }, [scene]);

  return <primitive object={instance} />;
}

class PlantAssetBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function PlantModel({
  speciesKey,
  stage,
  colors,
}: {
  speciesKey: string;
  stage: string;
  colors: SpeciesPalette;
}) {
  const path = plantModelPath(speciesKey, stage);
  if (!path) return <SpeciesMesh colors={colors} speciesKey={speciesKey} stage={stage} />;

  const fallback = <SpeciesMesh colors={colors} speciesKey={speciesKey} stage={stage} />;
  return (
    <PlantAssetBoundary fallback={fallback} key={path}>
      <Suspense fallback={fallback}>
        <GlbPlantModel path={path} />
      </Suspense>
    </PlantAssetBoundary>
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

function InstancedScenery({
  instances,
  shape,
  baseColor,
  castShadow = false,
}: {
  instances: SceneInstance[];
  shape: 'box' | 'foliage' | 'grass' | 'round-flower' | 'star-flower' | 'stem';
  baseColor: string;
  castShadow?: boolean;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const instanceColors = useMemo(() => {
    const values = new Float32Array(instances.length * 3);
    const color = new THREE.Color();
    instances.forEach((instance, index) => {
      color.set(instance.color ?? baseColor).toArray(values, index * 3);
    });
    return values;
  }, [baseColor, instances]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    instances.forEach((instance, index) => {
      dummy.position.set(...instance.position);
      dummy.rotation.set(...(instance.rotation ?? [0, 0, 0]));
      dummy.scale.set(...instance.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances]);

  return (
    <instancedMesh
      args={[undefined, undefined, instances.length]}
      castShadow={castShadow}
      raycast={() => undefined}
      receiveShadow={shape === 'box'}
      ref={meshRef}
    >
      <instancedBufferAttribute attach="instanceColor" args={[instanceColors, 3]} />
      {shape === 'box' ? <boxGeometry args={[1, 1, 1]} /> : null}
      {shape === 'foliage' ? <icosahedronGeometry args={[0.5, 1]} /> : null}
      {shape === 'grass' ? <coneGeometry args={[0.075, 0.7, 3, 1]} /> : null}
      {shape === 'round-flower' ? <sphereGeometry args={[0.11, 7, 6]} /> : null}
      {shape === 'star-flower' ? <octahedronGeometry args={[0.13, 0]} /> : null}
      {shape === 'stem' ? <cylinderGeometry args={[0.025, 0.035, 0.55, 5]} /> : null}
      <meshStandardMaterial color="#ffffff" />
    </instancedMesh>
  );
}

function MeadowScenery() {
  const scenery = useMemo(() => {
    const grass: SceneInstance[] = [];
    const foliage: SceneInstance[] = [];
    const stems: SceneInstance[] = [];
    const roundFlowers: SceneInstance[] = [];
    const starFlowers: SceneInstance[] = [];
    const flowerColors = ['#f6a8ce', '#f6dc66', '#a9d6ff', '#ff9d78', '#c8a5ff', '#fff3d0'];
    const grassColors = ['#397f48', '#4f9852', '#68aa59', '#2f7444'];

    for (let patch = 0; patch < 46; patch += 1) {
      const angle = patch * 2.399963;
      const radius = 4.6 + ((patch * 37) % 100) * 0.115;
      const centerX = Math.cos(angle) * radius;
      const centerZ = Math.sin(angle) * radius * 0.78;
      const blades = 3 + (patch % 4);

      for (let blade = 0; blade < blades; blade += 1) {
        const bladeAngle = (blade / blades) * Math.PI * 2 + angle;
        const height = 0.55 + ((patch + blade * 5) % 8) * 0.075;
        grass.push({
          position: [
            centerX + Math.cos(bladeAngle) * (0.11 + (blade % 2) * 0.08),
            (0.7 * height) / 2,
            centerZ + Math.sin(bladeAngle) * (0.11 + (blade % 2) * 0.08),
          ],
          rotation: [0, bladeAngle, (blade - blades / 2) * 0.055],
          scale: [0.72 + (blade % 3) * 0.16, height, 0.72 + (patch % 3) * 0.12],
          color: grassColors[(patch + blade) % grassColors.length],
        });
      }
    }

    for (let bush = 0; bush < 18; bush += 1) {
      const angle = bush * 2.17 + 0.45;
      const radius = 6.4 + ((bush * 29) % 9);
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius * 0.72;
      const variant = bush % 3;
      const crownHeight = variant === 1 ? 0.66 : 0.38;

      if (variant !== 1) {
        const lobes = variant === 0 ? 3 : 5;
        for (let lobe = 0; lobe < lobes; lobe += 1) {
          const lobeAngle = (lobe / lobes) * Math.PI * 2;
          foliage.push({
            position: [
              x + Math.cos(lobeAngle) * 0.24,
              0.24 + (lobe % 2) * 0.08,
              z + Math.sin(lobeAngle) * 0.2,
            ],
            rotation: [0, lobeAngle, 0],
            scale: [0.78 + variant * 0.12, 0.58 + (lobe % 2) * 0.2, 0.72],
            color: lobe % 2 === 0 ? '#347c4c' : '#4b9558',
          });
        }
      }

      const bloomCount = variant === 2 ? 7 : variant === 1 ? 5 : 4;
      for (let bloom = 0; bloom < bloomCount; bloom += 1) {
        const bloomAngle = (bloom / bloomCount) * Math.PI * 2 + angle;
        const spread = variant === 1 ? 0.38 : 0.32;
        const bloomX = x + Math.cos(bloomAngle) * spread;
        const bloomZ = z + Math.sin(bloomAngle) * spread;
        const bloomY = crownHeight + (variant === 1 ? (bloom % 3) * 0.2 : (bloom % 2) * 0.08);
        const target = variant === 2 ? starFlowers : roundFlowers;

        if (variant === 1) {
          stems.push({
            position: [bloomX, bloomY / 2, bloomZ],
            rotation: [0, 0, Math.sin(bloomAngle) * 0.08],
            scale: [0.85, Math.max(0.7, bloomY / 0.55), 0.85],
            color: '#3e824c',
          });
        }

        target.push({
          position: [bloomX, bloomY, bloomZ],
          rotation: [0, bloomAngle, variant === 2 ? bloomAngle * 0.2 : 0],
          scale: [0.82 + (bloom % 3) * 0.12, 0.82 + (bush % 2) * 0.16, 0.82],
          color: flowerColors[(bush * 2 + bloom) % flowerColors.length],
        });
      }
    }

    return { foliage, grass, roundFlowers, starFlowers, stems };
  }, []);

  return (
    <group>
      <InstancedScenery baseColor="#4f9852" instances={scenery.grass} shape="grass" />
      <InstancedScenery baseColor="#397f48" instances={scenery.foliage} shape="foliage" />
      <InstancedScenery baseColor="#3e824c" instances={scenery.stems} shape="stem" />
      <InstancedScenery
        baseColor="#f6a8ce"
        instances={scenery.roundFlowers}
        shape="round-flower"
      />
      <InstancedScenery
        baseColor="#f6dc66"
        instances={scenery.starFlowers}
        shape="star-flower"
      />
    </group>
  );
}

function GardenFence() {
  const fence = useMemo(() => {
    const posts: SceneInstance[] = [];
    const rails: SceneInstance[] = [];
    const postSpacing = 2.6;

    const addPost = (x: number, z: number, tall = false) => {
      posts.push({
        position: [x, tall ? 0.82 : 0.68, z],
        scale: [tall ? 0.26 : 0.2, tall ? 1.64 : 1.36, tall ? 0.26 : 0.2],
        color: tall ? '#8a5a32' : '#9a6a3d',
      });
    };
    const addRail = (x: number, z: number, width: number, depth: number) => {
      for (const y of [0.42, 0.94]) {
        rails.push({
          position: [x, y, z],
          scale: [width, 0.13, depth],
          color: y > 0.5 ? '#b47c47' : '#a86f3d',
        });
      }
    };

    const horizontalSections = Math.ceil((GARDEN_HALF_WIDTH * 2) / postSpacing);
    const horizontalStep = (GARDEN_HALF_WIDTH * 2) / horizontalSections;
    for (let side = -1; side <= 1; side += 2) {
      const z = side * GARDEN_HALF_DEPTH;
      for (let index = 0; index <= horizontalSections; index += 1) {
        const x = -GARDEN_HALF_WIDTH + index * horizontalStep;
        const isGatePost = side === 1 && Math.abs(x) < horizontalStep * 0.75;
        addPost(x, z, isGatePost);
        if (index === horizontalSections) continue;
        const railX = x + horizontalStep / 2;
        const isGateOpening = side === 1 && Math.abs(railX) < horizontalStep * 0.75;
        if (!isGateOpening) addRail(railX, z, horizontalStep, 0.12);
      }
    }

    const verticalSections = Math.ceil((GARDEN_HALF_DEPTH * 2) / postSpacing);
    const verticalStep = (GARDEN_HALF_DEPTH * 2) / verticalSections;
    for (let side = -1; side <= 1; side += 2) {
      const x = side * GARDEN_HALF_WIDTH;
      for (let index = 1; index < verticalSections; index += 1) {
        addPost(x, -GARDEN_HALF_DEPTH + index * verticalStep);
      }
      for (let index = 0; index < verticalSections; index += 1) {
        addRail(x, -GARDEN_HALF_DEPTH + (index + 0.5) * verticalStep, 0.12, verticalStep);
      }
    }

    return { posts, rails };
  }, []);

  return (
    <group>
      <InstancedScenery baseColor="#9a6a3d" castShadow instances={fence.posts} shape="box" />
      <InstancedScenery baseColor="#b47c47" castShadow instances={fence.rails} shape="box" />
    </group>
  );
}

function Rainbow() {
  const colors = ['#ff6f7d', '#ffb45b', '#f6dc66', '#63c879', '#69bfff', '#9d82e8'];

  return (
    <group position={[-3, 2.2, -31]} rotation={[0, 0.08, 0]}>
      {colors.map((color, index) => (
        <mesh key={color} position={[0, 0, index * -0.015]} renderOrder={-10 + index}>
          <torusGeometry args={[10.2 - index * 0.48, 0.3, 8, 64, Math.PI]} />
          <meshBasicMaterial
            color={color}
            depthWrite={false}
            opacity={0.68}
            toneMapped={false}
            transparent
          />
        </mesh>
      ))}
      {[-10.2, 10.2].flatMap((x) =>
        [-0.45, 0.25, 0.85].map((offset, index) => (
          <mesh key={`${x}-${offset}`} position={[x + offset, 0.05 + (index % 2) * 0.22, 0.2]}>
            <sphereGeometry args={[0.95 - index * 0.08, 9, 8]} />
            <meshBasicMaterial color="#f8fcff" opacity={0.82} transparent />
          </mesh>
        )),
      )}
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
      <PlantModel colors={colors} speciesKey={speciesKey} stage={stage} />
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
        if (
          Math.abs(event.point.x) > GARDEN_HALF_WIDTH - 0.8 ||
          Math.abs(event.point.z) > GARDEN_HALF_DEPTH - 0.8
        ) {
          return;
        }
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
      <Rainbow />
      <Ground placing={Boolean(placingPlantId)} onPlaceAt={onPlaceAt} />
      <MeadowScenery />
      <GardenFence />
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
        minDistance={8}
        maxDistance={55}
        ref={controlsRef}
        target={[0, 0.8, 0]}
      />
    </>
  );
}

export function ForestScene3D(props: ForestScene3DProps) {
  return (
    <div className="relative h-[min(70vh,640px)] w-full overflow-hidden rounded-xl border border-dashboard-border bg-[#87c7f5]">
      <Canvas camera={{ position: [22, 16, 24], fov: 55 }} shadows dpr={[1, 1.75]}>
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

Object.values(PLANT_MODEL_PATHS).forEach((stages) => {
  Object.values(stages).forEach((path) => useGLTF.preload(path));
});
