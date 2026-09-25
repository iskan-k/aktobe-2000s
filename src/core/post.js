import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';
import { PAL } from './palette.js';

/* ------------------------------------------------------------------ *
 * Render pipeline.
 *
 *   scene -> rtScene (colour + depth)
 *         -> ink    : outlines from the second difference of depth
 *         -> grade  : dusty evening grade, then linear -> sRGB
 *         -> fxaa   : straight to the screen
 *
 * The ink idea (second difference of linear depth, so planar surfaces
 * never ink however oblique they are) is adapted from Sakura Crossing
 * (MIT). Here it is tuned down for a cartoony-realistic read: thinner,
 * browner lines that keep more of the surface colour, and that fade out
 * sooner so the distance goes soft in the dust haze instead of busy.
 * ------------------------------------------------------------------ */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4( position.xy, 0.0, 1.0 );
  }
`;

const INK_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.1 },
    uFar: { value: 900 },
    uInk: { value: new THREE.Color(PAL.ink) },
    uThickness: { value: 1.2 },
    uSens: { value: 0.0048 },
    uConcave: { value: 0.03 },
    uConcaveAmount: { value: 0.32 },
    uFadeStart: { value: 34.0 },
    uFadeEnd: { value: 120.0 },
    uStrength: { value: 0.82 },
    uSkyDepth: { value: 700.0 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    #include <packing>
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uTexel;
    uniform float uNear, uFar;
    uniform vec3 uInk;
    uniform float uThickness, uSens, uConcave, uConcaveAmount;
    uniform float uFadeStart, uFadeEnd, uStrength, uSkyDepth;
    varying vec2 vUv;

    float linearDepth( vec2 uv ) {
      float d = texture2D( tDepth, uv ).x;
      return -perspectiveDepthToViewZ( d, uNear, uFar );
    }

    void main() {
      vec3 col = texture2D( tDiffuse, vUv ).rgb;
      vec2 t = uTexel * uThickness;
      float dc = linearDepth( vUv );
      if ( dc > uSkyDepth ) { gl_FragColor = vec4( col, 1.0 ); return; }

      float dl = linearDepth( vUv - vec2( t.x, 0.0 ) );
      float dr = linearDepth( vUv + vec2( t.x, 0.0 ) );
      float du = linearDepth( vUv + vec2( 0.0, t.y ) );
      float dd = linearDepth( vUv - vec2( 0.0, t.y ) );

      float sx = ( dl + dr - 2.0 * dc ) / dc;
      float sy = ( du + dd - 2.0 * dc ) / dc;
      float convex  = max( 0.0,  sx ) + max( 0.0,  sy );
      float concave = max( 0.0, -sx ) + max( 0.0, -sy );

      float edge = smoothstep( uSens * 0.35, uSens, convex );
      edge = max( edge, smoothstep( uConcave, uConcave * 3.4, concave ) * uConcaveAmount );
      edge *= 1.0 - smoothstep( uFadeStart, uFadeEnd, dc );
      edge *= uStrength;

      // the line keeps some of the surface under it, so it reads as drawn
      // over the colour rather than pasted on
      vec3 line = mix( uInk, col * 0.38, 0.3 );
      gl_FragColor = vec4( mix( col, line, clamp( edge, 0.0, 1.0 ) ), 1.0 );
    }
  `,
};

const GRADE_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uShadowTint: { value: new THREE.Color(0xb4bccb) },
    uLightTint: { value: new THREE.Color(0xfff4e2) },
    uSaturation: { value: 1.04 },
    uLift: { value: 0.026 },
    uVignette: { value: 0.18 },
    uWarmth: { value: 0.045 },
    uExposure: { value: 1.0 },
    uTime: { value: 0 },
    uGrain: { value: 0.018 },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowTint, uLightTint;
    uniform float uSaturation, uLift, uVignette, uWarmth, uExposure, uTime, uGrain;
    varying vec2 vUv;

    vec3 linearToSRGB( vec3 c ) {
      return mix( c * 12.92, 1.055 * pow( max( c, vec3( 0.0031308 ) ), vec3( 1.0 / 2.4 ) ) - 0.055,
                  step( 0.0031308, c ) );
    }
    float hash12( vec2 p ) {
      vec3 p3 = fract( vec3( p.xyx ) * 0.1031 );
      p3 += dot( p3, p3.yzx + 33.33 );
      return fract( ( p3.x + p3.y ) * p3.z );
    }

    void main() {
      vec3 c = texture2D( tDiffuse, vUv ).rgb * uExposure;
      float l = dot( c, vec3( 0.2126, 0.7152, 0.0722 ) );

      // split tone: cool steppe-sky darks, warm evening lights
      float k = smoothstep( 0.02, 0.6, l );
      c *= mix( uShadowTint, uLightTint, k );
      c += vec3( uWarmth, uWarmth * 0.55, 0.0 ) * l * 0.4;
      c += uLift * ( 1.0 - k ) * vec3( 0.95, 0.97, 1.0 );

      // soft shoulder so a white wall in full sun keeps a little colour
      c = c / ( 1.0 + max( c - 0.82, 0.0 ) * 0.9 );

      c = mix( vec3( l ), c, uSaturation );

      float r = length( vUv - 0.5 ) * 1.42;
      c *= 1.0 - uVignette * pow( clamp( r, 0.0, 1.0 ), 2.4 );

      vec3 outc = linearToSRGB( max( c, vec3( 0.0 ) ) );
      // a whisper of film grain: without it big flat areas band
      outc += ( hash12( gl_FragCoord.xy + fract( uTime ) * 91.7 ) - 0.5 ) * uGrain;
      gl_FragColor = vec4( outc, 1.0 );
    }
  `,
};

const FXAA_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTexel: { value: new THREE.Vector2() },
  },
  vertexShader: VERT,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uTexel;
    varying vec2 vUv;
    float luma( vec3 c ) { return dot( c, vec3( 0.299, 0.587, 0.114 ) ); }
    void main() {
      vec3 cM = texture2D( tDiffuse, vUv ).rgb;
      vec3 cNW = texture2D( tDiffuse, vUv + vec2( -uTexel.x, -uTexel.y ) ).rgb;
      vec3 cNE = texture2D( tDiffuse, vUv + vec2(  uTexel.x, -uTexel.y ) ).rgb;
      vec3 cSW = texture2D( tDiffuse, vUv + vec2( -uTexel.x,  uTexel.y ) ).rgb;
      vec3 cSE = texture2D( tDiffuse, vUv + vec2(  uTexel.x,  uTexel.y ) ).rgb;
      float lM = luma( cM ), lNW = luma( cNW ), lNE = luma( cNE ), lSW = luma( cSW ), lSE = luma( cSE );
      float lMin = min( lM, min( min( lNW, lNE ), min( lSW, lSE ) ) );
      float lMax = max( lM, max( max( lNW, lNE ), max( lSW, lSE ) ) );
      vec2 dir = vec2( -( ( lNW + lNE ) - ( lSW + lSE ) ), ( ( lNW + lSW ) - ( lNE + lSE ) ) );
      float reduce = max( ( lNW + lNE + lSW + lSE ) * 0.25 * 0.18, 1.0 / 128.0 );
      float rcp = 1.0 / ( min( abs( dir.x ), abs( dir.y ) ) + reduce );
      dir = clamp( dir * rcp, vec2( -8.0 ), vec2( 8.0 ) ) * uTexel;
      vec3 rgbA = 0.5 * ( texture2D( tDiffuse, vUv + dir * ( 1.0 / 3.0 - 0.5 ) ).rgb +
                          texture2D( tDiffuse, vUv + dir * ( 2.0 / 3.0 - 0.5 ) ).rgb );
      vec3 rgbB = rgbA * 0.5 + 0.25 * ( texture2D( tDiffuse, vUv - dir * 0.5 ).rgb +
                                        texture2D( tDiffuse, vUv + dir * 0.5 ).rgb );
      float lB = luma( rgbB );
      gl_FragColor = vec4( ( lB < lMin || lB > lMax ) ? rgbA : rgbB, 1.0 );
    }
  `,
};

function makeQuad(def) {
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.clone(def.uniforms),
    vertexShader: def.vertexShader,
    fragmentShader: def.fragmentShader,
    depthTest: false,
    depthWrite: false,
  });
  return { quad: new FullScreenQuad(mat), mat };
}

export class Pipeline {
  constructor(renderer, scene, camera, { pixelBudget = 4.2e6 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;
    this.pixelBudget = pixelBudget;
    this.size = new THREE.Vector2(1, 1);
    this.forceScale = 0;
    this.quality = 1;

    const opts = {
      type: THREE.HalfFloatType,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
      colorSpace: THREE.NoColorSpace,
    };
    this.rtScene = new THREE.WebGLRenderTarget(2, 2, opts);
    this.rtScene.depthTexture = new THREE.DepthTexture(2, 2);
    this.rtScene.depthTexture.format = THREE.DepthFormat;
    this.rtScene.depthTexture.type = THREE.UnsignedIntType;
    this.rtScene.depthTexture.minFilter = THREE.NearestFilter;
    this.rtScene.depthTexture.magFilter = THREE.NearestFilter;
    this.rtA = new THREE.WebGLRenderTarget(2, 2, { ...opts, depthBuffer: false });
    this.rtB = new THREE.WebGLRenderTarget(2, 2, { ...opts, type: THREE.UnsignedByteType, depthBuffer: false });

    this.ink = makeQuad(INK_SHADER);
    this.grade = makeQuad(GRADE_SHADER);
    this.fxaa = makeQuad(FXAA_SHADER);
    this.ink.mat.uniforms.tDepth.value = this.rtScene.depthTexture;
    this.enabled = { ink: true, grade: true, fxaa: true };
    this.sceneInfo = { calls: 0, triangles: 0 };
  }

  setSize(w, h) {
    const dpr = window.devicePixelRatio || 1;
    let scale = this.forceScale || (dpr < 1.5 ? 1.35 : Math.min(dpr, 2));
    scale *= this.quality;
    if (w * h * scale * scale > this.pixelBudget) {
      scale = Math.max(0.75, Math.sqrt(this.pixelBudget / (w * h)));
    }
    this.scale = scale;
    const rw = Math.max(2, Math.floor(w * scale));
    const rh = Math.max(2, Math.floor(h * scale));
    this.size.set(rw, rh);
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(w, h, true);
    this.rtScene.setSize(rw, rh);
    this.rtA.setSize(rw, rh);
    this.rtB.setSize(rw, rh);
    const texel = new THREE.Vector2(1 / rw, 1 / rh);
    this.ink.mat.uniforms.uTexel.value.copy(texel);
    this.fxaa.mat.uniforms.uTexel.value.copy(texel);
    this.ink.mat.uniforms.uNear.value = this.camera.near;
    this.ink.mat.uniforms.uFar.value = this.camera.far;
    this.ink.mat.uniforms.uThickness.value = 0.9 + 0.45 * scale;
  }

  render(time = 0) {
    const r = this.renderer;
    r.setRenderTarget(this.rtScene);
    r.clear();
    r.render(this.scene, this.camera);
    this.sceneInfo = { calls: r.info.render.calls, triangles: r.info.render.triangles };
    let src = this.rtScene.texture;
    if (this.enabled.ink) {
      this.ink.mat.uniforms.tDiffuse.value = src;
      r.setRenderTarget(this.rtA);
      this.ink.quad.render(r);
      src = this.rtA.texture;
    }
    const g = this.grade.mat.uniforms;
    g.tDiffuse.value = src;
    g.uTime.value = time;
    if (!this.enabled.grade) {
      g.uShadowTint.value.set(1, 1, 1);
      g.uLightTint.value.set(1, 1, 1);
    }
    r.setRenderTarget(this.enabled.fxaa ? this.rtB : null);
    this.grade.quad.render(r);
    if (!this.enabled.grade) {
      g.uShadowTint.value.copy(GRADE_SHADER.uniforms.uShadowTint.value);
      g.uLightTint.value.copy(GRADE_SHADER.uniforms.uLightTint.value);
    }
    if (this.enabled.fxaa) {
      this.fxaa.mat.uniforms.tDiffuse.value = this.rtB.texture;
      r.setRenderTarget(null);
      this.fxaa.quad.render(r);
    }
    r.setRenderTarget(null);
  }
}
