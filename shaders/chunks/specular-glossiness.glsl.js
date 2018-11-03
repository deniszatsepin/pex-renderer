module.exports = /* glsl */`
#ifdef USE_SPECULAR_GLOSSINESS_WORKFLOW
  uniform vec4 uDiffuse;
  uniform vec3 uSpecular;
  uniform float uGlossiness;

  #ifdef USE_DIFFUSE_MAP
    uniform sampler2D uDiffuseMap;
    uniform float uDiffuseMapEncoding;

    vec4 getDiffuse() {
      // assumes sRGB texture
      vec4 texelColor = texture2D(uDiffuseMap, vTexCoord0);
      return vec4(decode(uDiffuse, 3).rgb, uDiffuse.a) * vec4(decode(texelColor, 3).rgb, texelColor.a);
    }
  #else
    vec4 getDiffuse() {
      return vec4(decode(uDiffuse, 3).rgb, uDiffuse.a);
    }
  #endif

  #ifdef USE_SPECULAR_GLOSSINESS_MAP
    uniform sampler2D uSpecularGlossinessMap;

    vec4 getSpecularGlossiness() {
      // assumes specular is sRGB and glossiness is linear
      vec4 specGloss = texture2D(uSpecularGlossinessMap, vTexCoord0);
      //TODO: should i move uSpecular to linear?
      return vec4(uSpecular, uGlossiness) * vec4(decode(vec4(specGloss.rgb, 1.0), 3).rgb, specGloss.a);
    }
  #else
    vec4 getSpecularGlossiness() {
      return vec4(uSpecular, uGlossiness);
    }
  #endif

  // assumes linear color
  float perceivedBrightness(vec3 c) {
    return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b;
  }

  float maxComponent(vec3 c) {
    return max(c.r, max(c.b, c.g));
  }

  float solveMetallic(float diffuse, float specular, float oneMinusSpecularStrength) {
    if (specular < 0.04) {
      return 0.0;
    }

    float a = 0.04;
    float b = diffuse * oneMinusSpecularStrength / (1.0 - a) + specular - 2.0 * a;
    float c = a - specular;
    float D = max(b * b - 4.0 * a * c, 0.0);
    return clamp((-b + sqrt(D)) / (2.0 * a), 0.0, 1.0);
  }

  void getBaseColorAndMetallicRoughnessFromSpecularGlossiness(inout PBRData data) {
    vec4 specularGlossiness = getSpecularGlossiness();

    vec3 specular = specularGlossiness.rgb;
    data.specularColor = specular;

    float glossiness = specularGlossiness.a;
    data.roughness = 1.0 - glossiness;

    vec4 diffuseRGBA = getDiffuse();
    vec3 diffuse = diffuseRGBA.rgb;
    data.opacity = diffuseRGBA.a;
    float epsilon = 1e-6;
    float a = 0.04;

    // ported from https://github.com/KhronosGroup/glTF/blob/master/extensions/Khronos/KHR_materials_pbrSpecularGlossiness/examples/convert-between-workflows/js/three.pbrUtilities.js
    float oneMinusSpecularStrength = 1.0 - maxComponent(specular);
    data.metallic = solveMetallic(perceivedBrightness(diffuse), perceivedBrightness(specular), oneMinusSpecularStrength);

    vec3 baseColorFromDiffuse = diffuse * oneMinusSpecularStrength / (1.0 - a) / max(1.0 - data.metallic, epsilon);
    vec3 baseColorFromSpecular = (specular - a * (1.0 - data.metallic)) * (1.0 / max(data.metallic, epsilon));
    data.baseColor = mix(baseColorFromDiffuse, baseColorFromSpecular, data.metallic * data.metallic);
  }
#endif
`