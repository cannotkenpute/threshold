/**
 * 1980s 3D Renderer & Post-Processing Pipeline
 */

import { CONFIG } from '../config.js';
import { RetroShader } from './Shaders.js';

export class RetroRenderer {
  constructor(containerElement) {
    this.container = containerElement;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    // Three.js Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0906);
    this.scene.fog = new THREE.FogExp2(0x0c0a07, 0.042);

    // Low-Level Suspense Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(0x38301c, 0.15);
    this.scene.add(this.ambientLight);
    window.gameRenderer = this;

    this.camera = new THREE.PerspectiveCamera(
      CONFIG.FOV,
      this.width / this.height,
      CONFIG.NEAR_PLANE,
      CONFIG.FAR_PLANE
    );
    this.scene.add(this.camera);

    // Low-Poly / Retro WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: false, // Low-poly 80s aesthetic: no MSAA
      precision: 'mediump'
    });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // Hard 80s shadows
    this.container.appendChild(this.renderer.domElement);

    // Setup Post-Processing Render Target & Fullscreen Quad
    this.renderTarget = new THREE.WebGLRenderTarget(this.width, this.height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat
    });

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();
    
    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: RetroShader.vertexShader,
      fragmentShader: RetroShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(RetroShader.uniforms)
    });
    this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.postMaterial.uniforms.resolution.value = new THREE.Vector2(this.width, this.height);

    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(postQuad);

    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderTarget.setSize(this.width, this.height);
    this.postMaterial.uniforms.resolution.value.set(this.width, this.height);
  }

  setVHSGlitch(intensity) {
    this.postMaterial.uniforms.vhsJitter.value = intensity;
  }

  render(clockTime) {
    this.postMaterial.uniforms.time.value = clockTime;

    // 1. Render 3D Scene into Render Target
    this.renderer.setRenderTarget(this.renderTarget);
    this.renderer.render(this.scene, this.camera);

    // 2. Render Post-Processing Pass to Screen
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.postScene, this.postCamera);
  }
}
