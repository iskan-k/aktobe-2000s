import * as THREE from 'three';
import { PAL } from './palette.js';
import { flat } from './toon.js';
import { cloudTex, cirrusTex } from './textures.js';
import { rngKit } from './util.js';

/* ------------------------------------------------------------------ *
 * Sky: a painted gradient dome with a soft sun glow, a ring of flat
 * fair-weather cumulus and a couple of cirrus bands. The dome and the
 * clouds trail the camera, so they never get closer.
 *
 * SUN_DIR is shared with the key light in main.js, so the glow in the
 * sky and the shadows on the ground agree: about half past five in the
 * evening in June, the sun a little south of west and 35 degrees up.
 * ------------------------------------------------------------------ */

export const SUN_DIR = new THREE.Vector3(-0.8, 0.6, 0.16).normalize();

export function buildSky(scene, radius = 800) {
  const geo = new THREE.SphereGeometry(radius, 40, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(PAL.skyTop) },
      uMid: { value: new THREE.Color(PAL.skyMid) },
      uHaze: { value: new THREE.Color(PAL.skyHaze) },
      uGlow: { value: new THREE.Color(PAL.sunGlow) },
      uSun: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize( position );
        vec4 wp = modelMatrix * vec4( position, 1.0 );
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop, uMid, uHaze, uGlow, uSun;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize( vDir );
        float h = d.y;
        vec3 col = mix( uHaze, uMid, smoothstep( -0.02, 0.22, h ) );
        col = mix( col, uTop, smoothstep( 0.18, 0.85, h ) );
        // below the horizon: the dust layer, never a black hole
        col = mix( col, uHaze * 0.96, smoothstep( 0.0, -0.1, h ) );
        float s = max( dot( d, normalize( uSun ) ), 0.0 );
        col = mix( col, uGlow, pow( s, 8.0 ) * 0.42 + pow( s, 64.0 ) * 0.5 );
        col += uGlow * smoothstep( 0.9994, 0.9998, s ) * 1.4;
        gl_FragColor = vec4( col, 1.0 );
      }
    `,
  });
  const dome = new THREE.Mesh(geo, mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const clouds = new THREE.Group();
  const tex = cloudTex();
  const rng = rngKit(2007);
  const cloudMat = flat({ map: tex, transparent: true, depthWrite: false, fog: false, cache: false });
  for (let i = 0; i < 26; i++) {
    const r = rng.range(radius * 0.62, radius * 0.9);
    const a = rng.range(0, Math.PI * 2);
    const w = rng.range(70, 190);
    const h = w * rng.range(0.34, 0.5);
    const y = rng.range(55, 150);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cloudMat);
    m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    m.lookAt(0, y * 0.6, 0);
    m.renderOrder = -9;
    clouds.add(m);
  }
  const cirMat = flat({ map: cirrusTex(), transparent: true, opacity: 0.32, depthWrite: false, fog: false, cache: false });
  for (let i = 0; i < 3; i++) {
    const a = rng.range(0, Math.PI * 2);
    const r = radius * 0.8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rng.range(400, 700), 70), cirMat);
    m.position.set(Math.cos(a) * r, rng.range(230, 320), Math.sin(a) * r);
    m.lookAt(0, 0, 0);
    m.renderOrder = -9;
    clouds.add(m);
  }
  clouds.frustumCulled = false;
  scene.add(clouds);

  return {
    dome,
    clouds,
    follow(camera) {
      dome.position.copy(camera.position);
      clouds.position.set(camera.position.x, 0, camera.position.z);
    },
  };
}
