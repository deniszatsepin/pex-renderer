#ifdef GL_ES
precision highp float;
#endif
#pragma glslify: encode = require(./encode)
#pragma glslify: decode = require(./decode)
#pragma glslify: fxaa = require(glsl-fxaa)
#pragma glslify: fog = require(./fog)

uniform vec2 uScreenSize;

uniform sampler2D uOverlay;
uniform sampler2D depthMap;
uniform vec2 depthMapSize;
uniform mat4 uViewMatrix;

uniform int uOverlayEncoding;

uniform float uExposure;
uniform int uOutputEncoding;

uniform float uFogStart;
uniform float uNear;
uniform float uFar;
uniform float uFov;
uniform vec3 uSunPosition;

uniform bool uFXAA;
uniform bool uFog;

varying vec2 vTexCoord0;

vec3 getFarViewDir(vec2 tc) {
  float hfar = 2.0 * tan(uFov/2.0) * uFar;
  float wfar = hfar * uScreenSize.x / uScreenSize.y;
  vec3 dir = (vec3(wfar * (tc.x - 0.5), hfar * (tc.y - 0.5), -uFar));
  return dir;
}

vec3 reconstructPositionFromDepth(vec2 texCoord, float z) {
  vec3 ray = getFarViewDir(texCoord);
  vec3 pos = ray;
  return pos * z / uFar;
}

float readDepth(sampler2D depthMap, vec2 coord) {
  float z_b = texture2D(depthMap, coord).r;
  float z_n = 2.0 * z_b - 1.0;
  float z_e = 2.0 * uNear * uFar / (uFar + uNear - z_n * (uFar - uNear));
  return z_e;
}

void main() {
  vec4 color = vec4(0.0);
  if (uFXAA) {
    color = fxaa(uOverlay, vTexCoord0 * uScreenSize, uScreenSize);
  } else {
    color = texture2D(uOverlay, vTexCoord0);
  }
  color = decode(color, uOverlayEncoding);

  if (uFog) {
    float z = readDepth(depthMap, vTexCoord0);
    vec3 pos = reconstructPositionFromDepth(vTexCoord0, z);
    float rayLength = length(pos);
    vec3 rayDir = pos / rayLength;
    vec3 sunDir = normalize(vec3(uViewMatrix * vec4(normalize(uSunPosition), 0.0)));
    color = fog(color.rgb, rayLength - uFogStart, rayDir, sunDir);
  }

  color.rgb *= uExposure;
  color.rgb = color.rgb / (1.0 + color.rgb);
  gl_FragColor = encode(color, uOutputEncoding);
}