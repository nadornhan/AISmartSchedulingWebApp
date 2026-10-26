import {
  AmbientLight, Box3, DirectionalLight, Group, PerspectiveCamera, Scene,
  SRGBColorSpace, ACESFilmicToneMapping, Vector3, WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import seedlingData from '../assets/models/seedling.glb';
import growingData from '../assets/models/growing.glb';
import matureData from '../assets/models/mature.glb';

const host = document.querySelector('[data-growth-tree]');
const preview = document.getElementById('forest-growth-scene');
const models = new Map();
let state = {
  progress: Number(preview.dataset.growthProgress || 0),
  scale: Number(preview.dataset.growthScale || 0.28),
  elapsed: Number(preview.dataset.growthElapsed || 0),
};
let renderer;
try {
  renderer = new WebGLRenderer({ canvas: host.querySelector('canvas'), alpha: true, antialias: true });
} catch {
  // The same application tree stages remain available as PNG fallbacks.
}

if (renderer) {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(6, 3.7, 8);
  camera.lookAt(0, 1.9, 0);
  camera.zoom = 1.3;
  scene.add(new AmbientLight(0xffffff, 1.7));
  const key = new DirectionalLight(0xc6fff0, 3);
  key.position.set(4, 8, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xb9a2f6, 2);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const clamp = (n) => Math.min(1, Math.max(0, n));
  function render() {
    const growing = clamp((state.progress - 0.22) / 0.16);
    const mature = clamp((state.progress - 0.62) / 0.16);
    const weights = { seedling: 1 - growing, growing: growing * (1 - mature), mature };
    for (const [variant, model] of models) {
      const weight = weights[variant];
      model.group.visible = weight > 0.001;
      model.group.scale.setScalar(state.scale);
      model.group.rotation.y = 0.4 + state.elapsed * 0.00012;
      for (const entry of model.materials) {
        const blending = weight < 0.999;
        const transparent = blending || entry.transparent;
        if (entry.material.transparent !== transparent) {
          entry.material.transparent = transparent;
          entry.material.needsUpdate = true;
        }
        entry.material.opacity = entry.opacity * weight;
        entry.material.depthWrite = blending ? false : entry.depthWrite;
      }
    }
    renderer.render(scene, camera);
  }
  function resize() {
    const width = Math.max(1, host.clientWidth), height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  const loader = new GLTFLoader();
  for (const [variant, data] of [['seedling', seedlingData], ['growing', growingData], ['mature', matureData]]) {
    const bytes = Uint8Array.from(atob(data.slice(data.indexOf(',') + 1)), (character) => character.charCodeAt(0));
    loader.parse(bytes.buffer, '', (gltf) => {
      const content = gltf.scene;
      const bounds = new Box3().setFromObject(content);
      const center = bounds.getCenter(new Vector3());
      const scale = 4 / Math.max(0.001, bounds.getSize(new Vector3()).y);
      content.scale.setScalar(scale);
      content.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
      const group = new Group();
      group.add(content);
      const materials = [];
      content.traverse((object) => {
        if (!object.isMesh) return;
        const source = Array.isArray(object.material) ? object.material : [object.material];
        const copies = source.map((material) => {
          const copy = material.clone();
          materials.push({ material: copy, opacity: copy.opacity, transparent: copy.transparent, depthWrite: copy.depthWrite });
          return copy;
        });
        object.material = Array.isArray(object.material) ? copies : copies[0];
      });
      models.set(variant, { group, materials });
      scene.add(group);
      if (models.size === 3) host.classList.add('has-model');
      render();
    }, () => {});
  }
  document.addEventListener('showcase:forestgrowth', (event) => {
    const next = event.detail;
    if (next.progress === state.progress && next.elapsed === state.elapsed) return;
    state = next;
    render();
  });
  host.querySelector('canvas').addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    host.classList.remove('has-model');
  });
}
