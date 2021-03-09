precision highp float;
uniform vec2 u_resolution;
uniform float u_time;

#define MINUTES 60000.0
#define SECONDS 1000.0
#define PI 3.141592
#define TAU PI*2.0

// generates pseudo-random noise from an x/y value
// Not really random--calling with the same input
// returns the same output
float random(vec2 seed) {
  return fract(sin(dot(seed, vec2(12.9898,78.233))) * 43758.5453123);
}

float period(float p) {
  return mod(u_time, p) / p * -2.0 + 1.0;
}

float fill(float v, float t) {
  return 1.0 - step(t, v);
}

float stroke(float v, float t, float w) {
  return 1.0 - step(w * .5, abs(v - t));
}

vec2 rotate(vec2 coords, float theta) {
  mat2 m = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
  return m * coords;
}

float add(float a, float b) {
  return clamp(a + b, 0.0, 1.0);
}

float subtract(float a, float b) {
  return clamp(a - b, 0.0, 1.0);
}

float intersect(float a, float b) {
  return step(2.0, a + b);
}

float difference(float a, float b) {
  return mix(a, 1.0 - a, b);
}

float line(float v, float f) {
  return abs(v - f);
}

float circle(vec2 coords) {
  return length(coords);
}

float rayburst(vec2 coords, float rays, float rotation) {
  float a = atan(coords.y, coords.x) + PI + rotation;
  float v = TAU / rays;
  float facet = fract(a / v);
  return step(.5, facet);
}

float rayburst(vec2 coords, float rays) {
  return rayburst(coords, rays, 0.0);
}

float polygon(vec2 st, float sides) {
  float a = atan(st.y, st.x) + PI;
  float r = length(st);
  float v = TAU / sides;
  return cos(floor(.5+a/v)*v-a)*r;
}

void main() {
  vec2 screenspace = (gl_FragCoord.xy / u_resolution.xy);
  vec2 uv = screenspace * 2.0 - 1.0;
  float aspect = u_resolution.x / u_resolution.y;
  uv.y /= aspect;
  float minute = period(1.0 * MINUTES);
  float scanning = period(8.0 * SECONDS);
  
  vec3 glitchIntervals = vec3(-.1, 0.1, 1.5);
  vec3 glitchMagnitudes = vec3(.05, .01, .01);
  
  for (int i = 0; i < 3; i++) {
    float interval = glitchIntervals[i];
    float magnitude = glitchMagnitudes[i];
    float scanline = line(scanning * 1.5 + interval * .5, uv.y);
    uv.x -= (1.0 - smoothstep(0.0, random(vec2(uv.y)) * .02, scanline)) * magnitude;
  }
  
  float pixel = 1.0 / u_resolution.x;
  vec3 rgbDistortion = vec3(-pixel * 3.0, 0, pixel * 3.0);
  vec3 rgb = vec3(0);
  
  for (int d = 0; d < 3; d++) {
    float color = 0.0;
    
    vec2 st = uv + vec2(rgbDistortion[d], 0.0);

    float centerCircle = circle(rotate(st + .2, PI * period(5.0 * SECONDS)));

    float inward = stroke(fract(centerCircle * 16.0 + u_time * .0004 + .5), .5, .05);
    color = add(color, inward);

    float spin = period(45.0 * SECONDS);
    float sides = 6.0;

    for (float i = 1.0; i <= 8.0; i += 1.0) {
      float poly = polygon(rotate(st + .2, -spin * TAU * i / sides), sides);
      color = subtract(color, stroke(poly, .1 * i, .02));
    }

    vec2 grid = rotate(st * 32.0, minute * PI);
    vec2 insideGrid = fract(grid);

    color = add(color, fill(circle(insideGrid - .5), .1) * .5);
    color = add(color, random(gl_FragCoord.xy / 1173.32 + period(123.0)) * .1);

    float outward = stroke(fract(centerCircle * 3.0 - u_time * .0002), .5, .1);

    float rays = 6.0;
    float rayspin = period(15.0 * SECONDS) / rays * TAU;
    float segments = intersect(outward, rayburst(st + .2, rays, rayspin));
    color = add(color, segments);
    
    rgb[d] = color;
    
  }
  
  gl_FragColor = vec4(rgb, 1.0);
}
