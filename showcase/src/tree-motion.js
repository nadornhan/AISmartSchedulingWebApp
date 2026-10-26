import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  Group,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  ACESFilmicToneMapping,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import seedlingData from '../assets/models/seedling.glb';
import growingData from '../assets/models/growing.glb';
import matureData from '../assets/models/mature.glb';

/* Existing Chrono models are embedded in the bundle, so file:// needs no fetch. */
const host = document.getElementById('tree-object');
const stage = document.getElementById('stage');
const canvas = host.querySelector('canvas');
const loader = new GLTFLoader();
const models = new Map();
let renderer;
let dirty = true;
let lastTime = 0;
let rotation = 0.45;
let motion = stage.dataset.motion !== 'reduced';
let desiredModel = 'mature';

function arrayBufferFromDataUrl(dataUrl) {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer;
}

function desiredVariant() {
  return stage.dataset.tree === 'forest' || stage.dataset.tree === 'focus'
    ? 'growing'
    : stage.dataset.tree === 'closing'
      ? 'seedling'
      : 'mature';
}

function init() {
  try {
    renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'low-power',
    });
  } catch {
    return; // The matching PNG remains visible if WebGL is unavailable.
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 80);
  camera.position.set(6, 3.7, 8);
  camera.lookAt(0, 1.9, 0);
  scene.add(new AmbientLight(0xffffff, 1.7));
  const key = new DirectionalLight(0xc6fff0, 3);
  key.position.set(4, 8, 5);
  scene.add(key);
  const rim = new DirectionalLight(0xb9a2f6, 2);
  rim.position.set(-4, 3, -3);
  scene.add(rim);
  const focusKey = new Color(0xc6fff0);
  const breakKey = new Color(0xd7c5ff);
  const focusRim = new Color(0xb9a2f6);
  const breakRim = new Color(0xa0aaf6);
  let lightingMix = 0;

  document.addEventListener('showcase:pomophase', (event) => {
    const mix = event.detail.mix;
    if (Math.abs(lightingMix - mix) < 0.001) return;
    lightingMix = mix;
    key.color.lerpColors(focusKey, breakKey, mix);
    rim.color.lerpColors(focusRim, breakRim, mix);
    dirty = true;
  });

  function resize() {
    const width = Math.max(1, host.clientWidth);
    const height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    dirty = true;
  }
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  for (const [variant, data] of [
    ['seedling', seedlingData],
    ['growing', growingData],
    ['mature', matureData],
  ]) {
    loader.parse(
      arrayBufferFromDataUrl(data),
      '',
      (gltf) => {
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
            materials.push({
              material: copy,
              opacity: copy.opacity,
              transparent: copy.transparent,
              depthWrite: copy.depthWrite,
            });
            return copy;
          });
          object.material = Array.isArray(object.material) ? copies : copies[0];
        });
        const opacity = variant === desiredVariant() ? 1 : 0;
        models.set(variant, { group, materials, opacity });
        scene.add(group);
        if (models.has(desiredVariant())) host.classList.add('has-model');
        dirty = true;
      },
      () => {},
    );
  }

  document.addEventListener('showcase:slidechange', () => {
    desiredModel = desiredVariant();
    dirty = true;
  });
  document.addEventListener('showcase:motionchange', (event) => {
    motion = event.detail.enabled;
    dirty = true;
  });
  document.addEventListener('visibilitychange', () => {
    lastTime = 0;
    dirty = true;
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    host.classList.remove('has-model');
    renderer.setAnimationLoop(null);
  });
  desiredModel = desiredVariant();
  renderer.setAnimationLoop((now) => {
    const delta = lastTime ? Math.min((now - lastTime) / 1000, 0.06) : 0;
    lastTime = now;
    if (document.hidden || stage.dataset.tree === 'hidden' || (!motion && !dirty)) return;
    const calm = stage.dataset.tree === 'focus';
    if (motion) rotation += delta * (calm ? 0.065 : 0.22);
    let fading = false;
    for (const [variant, model] of models) {
      const target = variant === desiredModel ? 1 : 0;
      const step = delta * 1.15;
      model.opacity = !motion
        ? target
        : target > model.opacity
          ? Math.min(target, model.opacity + step)
          : Math.max(target, model.opacity - step);
      if (Math.abs(target - model.opacity) > 0.005) fading = true;
      else model.opacity = target;
      model.group.visible = model.opacity > 0.005;
      model.group.rotation.y = rotation;
      model.group.position.y = motion
        ? Math.sin(now / (calm ? 3500 : 1800)) * (calm ? 0.025 : 0.065)
        : 0;
      for (const entry of model.materials) {
        const blending = model.opacity < 0.995;
        const transparent = blending || entry.transparent;
        if (entry.material.transparent !== transparent) {
          entry.material.transparent = transparent;
          entry.material.needsUpdate = true;
        }
        entry.material.opacity = entry.opacity * model.opacity;
        entry.material.depthWrite = blending ? false : entry.depthWrite;
      }
    }
    renderer.render(scene, camera);
    dirty = fading;
  });
}
init();
