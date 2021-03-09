// coordinates in GL space for two triangles that take up the whole viewport
const POLYS = [
  -1, 1,
  1, 1,
  1, -1,
  -1, 1,
  1, -1,
  -1, -1
];

// this component uses our base element class
class ShaderBox extends CustomElement {
  constructor() {
    super();

    // visibility and animation
    this.observer = new IntersectionObserver(this.onIntersection);
    this.observer.observe(this);
    this.visible = false;
    this.raf = null;

    // AbortController for in-flight fetch requests
    this.requesting = null;

    // set up the WebGL context
    this.initGL();
    this.shadowElements.canvas.addEventListener("webglcontextlost", this.recover);

    // monitor for changes to shader-uniform children
    this.mutationObserver = new MutationObserver(this.onMutation);
    this.mutationObserver.observe(this, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }

  initGL() {
    var gl = this.gl = this.shadowElements.canvas.getContext("webgl");
    var vertex = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertex, `
    attribute vec2 coord;
    void main() {
      gl_Position = vec4(coord, 0.0, 1.0);
    }
    `);
    gl.compileShader(vertex);
    gl.vertex = vertex;
    this.buffer = gl.createBuffer();
    this.program = null;
  }

  static get boundMethods() {
    return [
      "onIntersection",
      "onMutation",
      "tick",
      "recover"
    ];
  }

  static get observedAttributes() {
    return [ "src" ]
  }

  static get mirroredProps() {
    return [ "src" ]
  }

  async attributeChangedCallback(attr, was, value) {
    switch (attr) {
      case "src":
        if (was == value) return;
        // cancel any outgoing requests
        if (this.requesting) {
          this.requesting.abort();
        }
        var options = {};
        // if we can, create a new cancellation token
        if ("AbortController" in window) {
          this.requesting = new AbortController();
          options.signal = this.requesting.signal;
        }
        // get the new shader
        try {
          var response = await fetch(value, options);
          this.requesting = null;
          if (response.status >= 400) throw `Request for ${value} failed`;
          var source = await response.text();
          this.setShader(source);
        } catch (err) {
          // abort signals are handled as if the fetch() threw
          if (err.name == "AbortError") {
            console.log(`Cancelled shader load for ${value}`);
          } else {
            throw err;
          }
        }
      break;
    }
  }

  recover() {
    var uniforms = this.gl.uniforms;
    this.initGL();
    Object.assign(this.gl.uniforms, uniforms);
    if (this.shaderCache) {
      this.setShader(this.shaderCache);
    }
  }

  setShader(shader) {
    // cancel requests if this was called directly
    if (this.requesting) {
      this.requesting.abort();
    }

    // compile and link our fragment shader
    var gl = this.gl;
    gl.program = null;
    var fragment = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragment, shader);
    gl.compileShader(fragment);
    this.shaderCache = shader;

    var error = gl.getShaderInfoLog(fragment);
    if (error) {
      console.log(error);
      return;
    }

    var program = gl.createProgram();
    gl.attachShader(program, fragment);
    gl.attachShader(program, gl.vertex);
    gl.linkProgram(program);
    gl.useProgram(program);
    
    // get attributes and uniforms
    gl.program = program;
    gl.attributes = {
      coord: 0
    };
    for (var a in gl.attributes) gl.attributes[a] = gl.getAttribLocation(program, a);
    gl.uniforms = {
      u_time: 0,
      u_resolution: 0
    };
    for (var u in gl.uniforms) gl.uniforms[u] = gl.getUniformLocation(program, u);

    this.onMutation();

    this.tick();
  }

  // call GL methods to set the values of uniforms (shader globals)
  setUniform(name, ...values) {
    var gl = this.gl;
    if (!gl.uniforms[name]) {
      gl.uniforms[name] = gl.getUniformLocation(gl.program, name);
    }
    var method = `uniform${values.length}f`;
    gl[method](gl.uniforms[name], ...values);
  }

  // process shader-uniform children and add them to our mapping
  onMutation() {
    var uniforms = Array.from(this.children).filter(t => t.tagName == "SHADER-UNIFORM");
    for (var uniform of uniforms) {
      var name = uniform.getAttribute("name");
      var values = uniform.getAttribute("values").split(/, */).map(Number);
      this.setUniform(name, ...values);
    }
  }

  onIntersection([e]) {
    this.visible = e.isIntersecting;
    if (this.visible) this.tick();
    // seems to prevent cyan flash on some GPUs
    this.shadowElements.canvas.style.opacity = this.visible ? 1 : 0;
  }

  // render loop with visibility/readiness guards
  tick(t) {
    if (!this.visible) return;
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.gl.program) this.render(t);
    this.raf = requestAnimationFrame(this.tick);
  }

  render(t) {
    var { buffer, gl } = this;
    // require setShader() to be called
    if (!gl.program) return;
    var canvas = gl.canvas;
    // set up our two triangles
    gl.enableVertexAttribArray(gl.uniforms.coords);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(POLYS), gl.STATIC_DRAW);
    gl.vertexAttribPointer(gl.uniforms.coords, 2, gl.FLOAT, false, 0, 0);
    // add a time uniform, with some offset to starting at 0
    gl.uniform1f(gl.uniforms.u_time, t + 12581372.5324);
    // adjust to the current canvas size and set resolution uniform
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(gl.uniforms.u_resolution, canvas.width, canvas.height);
    // clear canvas and render
    gl.clearColor(0, 1, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, POLYS.length / 2);
  }

  static get shadowTemplate() {
    return `
      <style>
      :host {
        width: 300px;
        height: 150px;
        display: block;
        position: relative;
      }

      canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      </style>
      <canvas data-as="canvas"></canvas>
    `
  }
}

ShaderBox.define("shader-box");