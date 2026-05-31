import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const VignetteGrainShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    vignette: { value: 1.15 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time; uniform float vignette; varying vec2 vUv;
    float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.9, 0.15, dot(d, d) * vignette * 2.0);
      c.rgb *= mix(0.7, 1.0, v);
      float g = (rand(vUv + fract(time)) - 0.5) * 0.055;
      c.rgb += g;
      gl_FragColor = c;
    }`,
};

export class PostFX {
  constructor(renderer, scene, camera) {
    this._w = renderer.domElement.width  || innerWidth;
    this._h = renderer.domElement.height || innerHeight;

    this.composer = new EffectComposer(renderer);

    // 1. Render
    this.composer.addPass(new RenderPass(scene, camera));

    // 2. SSAO at half resolution — AO is low-frequency; half-res is invisible and halves cost
    this.ssao = new SSAOPass(scene, camera, Math.max(1, this._w >> 1), Math.max(1, this._h >> 1));
    this.ssao.kernelRadius = 12;
    this.ssao.minDistance  = 0.002;
    this.ssao.maxDistance  = 0.12;
    this.ssao.output = SSAOPass.OUTPUT.Default;
    this.composer.addPass(this.ssao);

    // 3. Bloom — retuned for PBR: only bright emissives bloom, surfaces stay clean
    this.bloom = new UnrealBloomPass(
      new THREE.Vector2(this._w, this._h),
      0.55,  // strength
      0.50,  // radius
      0.85   // threshold
    );
    this.composer.addPass(this.bloom);

    // 4. SMAA anti-aliasing
    this.smaa = new SMAAPass(this._w, this._h);
    this.composer.addPass(this.smaa);

    // 5. Vignette + grain
    this.vg = new ShaderPass(VignetteGrainShader);
    this.composer.addPass(this.vg);
  }

  render(elapsed) {
    this.vg.uniforms.time.value = elapsed;
    this.composer.render();
  }

  resize(w, h) {
    this._w = w;
    this._h = h;
    this.composer.setSize(w, h);
    this.ssao.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.bloom.setSize(w, h);
    this.smaa.setSize(w, h);
  }
}
