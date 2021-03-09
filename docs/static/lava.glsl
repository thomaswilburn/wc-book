precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color;
const vec3 top = vec3(.8, .7, .7);
const vec3 bottom = vec3(.9, .7, .7);
const vec3 plastic = vec3(.8, .2, .1);

float rand(float seed) {
  return fract(sin(dot(vec2(12.87042, 48.382097), vec2(seed, seed + 40238.842))) * 479283.48293);
}

void main() {
  vec2 coord = gl_FragCoord.xy / u_resolution;
  float aspect = u_resolution.x / u_resolution.y;
  coord.x *= aspect;
  float t = u_time * .0003;
  float d = 0.0;
  for (float i = 0.0; i < 16.0; i++) {
    vec2 center = vec2(
      cos(rand(i - rand(i)) + i - t * (rand(i) - .5)) * .5 + .5 * aspect,
      sin(rand(i + rand(i)) + i + t * rand(i)) * .5 + .5
    );
    float size = i * 0.02;
    d += smoothstep(.9, .3, distance(center, coord) / size);
  }
  float lava = step(d, .2);
  float uColorSet = step(0.01, u_color.r + u_color.g + u_color.b);
  vec3 pigment = mix(plastic, u_color, uColorSet);
  vec3 foreground = mix(pigment * (.8 + smoothstep(.1, .9, d) * .2), vec3(1.0), .3 - coord.y * .3);
  vec3 background = mix(pigment * .4 + .5, pigment * .2 + .8, coord.y);
  vec3 color = mix(foreground, background, lava);
  gl_FragColor = vec4(color, 1.0);
}