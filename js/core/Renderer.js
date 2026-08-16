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
    this.scene.background = new THREE.Color(0x1c1912);
    this.scene.fog = new THREE.FogExp2(0x26221a, 0.009);

    // Primary Ambient Light -- bright warm daytime floor so interior levels are
    // clearly readable from the very first frame (LightManager only retunes this
    // once the day/night cycle actually starts transitioning).
    this.ambientLight = new THREE.AmbientLight(0xd2cbb0, 0.95);
    this.scene.add(this.ambientLight);

    // Directional Sky / Sun / Moon Light (used only by the Level 3 highway;
    // indoors it stays off so it can't throw odd overhead shadows).
    this.sunLight = new THREE.DirectionalLight(0xe8f0f4, 0.85);
    this.sunLight.position.set(30, 60, -20);
    this.sunLight.castShadow = false;
    this.sunLight.visible = false;
    this.scene.add(this.sunLight);

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

    // Retro low-res render target: the 3D scene renders at a fraction of screen
    // resolution and the post pass upscales with NearestFilter. Roughly a 4x fragment
    // reduction at the default 0.5 scale -- and the chunky pixels ARE the 1980s look.
    this.renderScale = Math.max(0.2, Math.min(1.0, CONFIG.PERF.RENDER_SCALE_DEFAULT));

    // Setup Post-Processing Render Target & Fullscreen Quad
    this.renderTarget = new THREE.WebGLRenderTarget(
      Math.max(2, Math.floor(this.width * this.renderScale)),
      Math.max(2, Math.floor(this.height * this.renderScale)),
      {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBAFormat
      }
    );

    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postScene = new THREE.Scene();

    this.postMaterial = new THREE.ShaderMaterial({
      vertexShader: RetroShader.vertexShader,
      fragmentShader: RetroShader.fragmentShader,
      uniforms: THREE.UniformsUtils.clone(RetroShader.uniforms)
    });
    this.postMaterial.uniforms.tDiffuse.value = this.renderTarget.texture;
    this.postMaterial.uniforms.resolution.value = new THREE.Vector2(this.width, this.height);
    this.postMaterial.uniforms.rtResolution.value = new THREE.Vector2(
      this.renderTarget.width,
      this.renderTarget.height
    );

    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial);
    this.postScene.add(postQuad);

    window.addEventListener('resize', () => this.onResize());
  }

  // Live-adjustable render-target scale (0.2..1.0). The post pass reads the RT with
  // NearestFilter, so upscale stays crisp at any scale.
  setRenderScale(scale) {
    const clamped = Math.max(0.2, Math.min(1.0, scale));
    if (Math.abs(clamped - this.renderScale) < 0.001) return;
    this.renderScale = clamped;
    this.renderTarget.setSize(
      Math.max(2, Math.floor(this.width * this.renderScale)),
      Math.max(2, Math.floor(this.height * this.renderScale))
    );
    this.postMaterial.uniforms.rtResolution.value.set(this.renderTarget.width, this.renderTarget.height);
  }

  onResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(this.width, this.height);
    this.renderTarget.setSize(
      Math.max(2, Math.floor(this.width * this.renderScale)),
      Math.max(2, Math.floor(this.height * this.renderScale))
    );
    this.postMaterial.uniforms.resolution.value.set(this.width, this.height);
    this.postMaterial.uniforms.rtResolution.value.set(this.renderTarget.width, this.renderTarget.height);
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
