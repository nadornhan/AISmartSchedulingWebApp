'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';
import { Box3, Vector3 } from 'three';

function Tree({ onReady }: { onReady: () => void }) {
  const { scene } = useGLTF('/models/plants/chrono/mature.glb');
  const model = useMemo(() => {
    const copy = scene.clone(true);
    const box = new Box3().setFromObject(copy);
    const center = box.getCenter(new Vector3());
    const scale = 4 / box.getSize(new Vector3()).y;
    copy.scale.setScalar(scale);
    copy.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
    return copy;
  }, [scene]);
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <primitive object={model} />;
}

export default function TreeScene({
  onReady,
  onUnavailable,
}: {
  onReady: () => void;
  onUnavailable: () => void;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  return (
    <Canvas
      frameloop="always"
      dpr={[1, 1.5]}
      camera={{ position: [6, 3.7, 8], fov: 35 }}
      gl={{ alpha: true, antialias: true }}
      fallback={null}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', onUnavailable, { once: true });
      }}
      aria-label="Interactive 3D Chrono tree. Drag to rotate."
      style={{ position: 'absolute', inset: 0 }}
    >
      <ambientLight intensity={1.7} />
      <directionalLight position={[4, 8, 5]} intensity={3} color="#c6fff0" />
      <directionalLight position={[-4, 3, -3]} intensity={2} color="#b9a2f6" />
      <Suspense fallback={null}>
        <Tree onReady={onReady} />
      </Suspense>
      <mesh position={[0, -0.16, 0]}>
        <cylinderGeometry args={[1.7, 1.55, 0.22, 64]} />
        <meshStandardMaterial color="#11372f" roughness={0.65} metalness={0.4} />
      </mesh>
      <OrbitControls
        target={[0, 1.9, 0]}
        autoRotate={!reduceMotion}
        autoRotateSpeed={0.35}
        enableZoom={false}
        enablePan={false}
        enableDamping={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 2.1}
      />
    </Canvas>
  );
}
