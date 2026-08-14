/**
 * 1980s Retro GLSL Post-Processing Shaders
 * Implements Bayer Ordered Dithering, Color Quantization, CRT Curvature, Scanlines, and VHS Artifacts.
 */

export const RetroShader = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    time: { value: 0.0 },
    ditherScale: { value: 1.0 },
    colorDepth: { value: 12.0 },
    scanlineIntensity: { value: 0.28 },
    curvature: { value: 0.08 },
    vhsJitter: { value: 0.0 },
    grainAmount: { value: 0.06 }
  },

  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,

  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float ditherScale;
    uniform float colorDepth;
    uniform float scanlineIntensity;
    uniform float curvature;
    uniform float vhsJitter;
    uniform float grainAmount;
    varying vec2 vUv;

    // 4x4 Bayer Matrix for ordered dithering
    float bayer4x4(vec2 uv) {
      vec2 pos = mod(floor(uv), 4.0);
      int index = int(pos.x) + int(pos.y) * 4;
      if (index == 0) return 0.0 / 16.0;
      if (index == 1) return 8.0 / 16.0;
      if (index == 2) return 2.0 / 16.0;
      if (index == 3) return 10.0 / 16.0;
      if (index == 4) return 12.0 / 16.0;
      if (index == 5) return 4.0 / 16.0;
      if (index == 6) return 14.0 / 16.0;
      if (index == 7) return 6.0 / 16.0;
      if (index == 8) return 3.0 / 16.0;
      if (index == 9) return 11.0 / 16.0;
      if (index == 10) return 1.0 / 16.0;
      if (index == 11) return 9.0 / 16.0;
      if (index == 12) return 15.0 / 16.0;
      if (index == 13) return 7.0 / 16.0;
      if (index == 14) return 13.0 / 16.0;
      return 5.0 / 16.0;
    }

    // CRT Barrel Curvature
    vec2 curveUV(vec2 uv) {
      uv = (uv - 0.5) * 2.0;
      uv *= 1.0 + pow(length(uv) * curvature, 2.0);
      return (uv * 0.5) + 0.5;
    }

    // Pseudo-random film grain
    float rand(vec2 co) {
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 curvedUv = curveUV(vUv);

      // Black borders outside curved CRT screen
      if (curvedUv.x < 0.0 || curvedUv.x > 1.0 || curvedUv.y < 0.0 || curvedUv.y > 1.0) {
        gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
      }

      // VHS horizontal jitter on random scanlines
      vec2 uv = curvedUv;
      if (vhsJitter > 0.01) {
        float lineNoise = sin(uv.y * 120.0 + time * 30.0);
        if (lineNoise > 0.94) {
          uv.x += (rand(vec2(time, uv.y)) - 0.5) * 0.015 * vhsJitter;
        }
      }

      // Chromatic Aberration
      float split = 0.0022;
      float r = texture2D(tDiffuse, uv + vec2(split, 0.0)).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - vec2(split, 0.0)).b;
      vec3 color = vec3(r, g, b);

      // Bayer Dithering
      vec2 screenPos = gl_FragCoord.xy / ditherScale;
      float dither = bayer4x4(screenPos) - 0.5;
      color += dither * (1.0 / colorDepth);

      // Color Quantization (1980s Retro limited palette)
      color = floor(color * colorDepth + 0.5) / colorDepth;

      // Scanline Effect
      float scanline = sin(uv.y * resolution.y * 0.9) * 0.5 + 0.5;
      color -= scanline * scanlineIntensity;

      // Film Grain
      float grain = (rand(uv + time) - 0.5) * grainAmount;
      color += grain;

      // Slight 1980s warm yellow/amber tint in darker tones
      color.r += 0.02;
      color.g += 0.018;

      gl_FragColor = vec4(color, 1.0);
    }
  `
};
