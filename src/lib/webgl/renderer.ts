import { m4, type Mat4, type Vec3 } from "./mat4";
import type { Mesh } from "./geometry";

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
out vec3 vNormal;
out vec3 vWorld;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uProj * uView * w;
}`;

const FRAG = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorld;
uniform vec3 uColor;
uniform vec3 uLight;
uniform vec3 uCamera;
out vec4 fragColor;
void main() {
  vec3 N = normalize(vNormal);
  vec3 L = normalize(uLight - vWorld);
  vec3 V = normalize(uCamera - vWorld);
  vec3 H = normalize(L + V);
  float diff = max(dot(N, L), 0.0);
  float spec = pow(max(dot(N, H), 0.0), 32.0);
  vec3 col = uColor * (0.18 + 0.82 * diff) + vec3(1.0) * spec * 0.35;
  fragColor = vec4(col, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error("Shader compile error: " + log);
  }
  return sh;
}

export type MeshHandle = {
  vao: WebGLVertexArrayObject;
  count: number;
  dispose: () => void;
};

export type DrawCall = {
  mesh: MeshHandle;
  model: Mat4;
  color: Vec3;
};

export class Renderer {
  gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private uProj: WebGLUniformLocation;
  private uView: WebGLUniformLocation;
  private uModel: WebGLUniformLocation;
  private uColor: WebGLUniformLocation;
  private uLight: WebGLUniformLocation;
  private uCamera: WebGLUniformLocation;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const v = compile(gl, gl.VERTEX_SHADER, VERT);
    const f = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error("Program link error: " + gl.getProgramInfoLog(p));
    }
    this.program = p;
    this.uProj = gl.getUniformLocation(p, "uProj")!;
    this.uView = gl.getUniformLocation(p, "uView")!;
    this.uModel = gl.getUniformLocation(p, "uModel")!;
    this.uColor = gl.getUniformLocation(p, "uColor")!;
    this.uLight = gl.getUniformLocation(p, "uLight")!;
    this.uCamera = gl.getUniformLocation(p, "uCamera")!;

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  upload(mesh: Mesh): MeshHandle {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    const ebo = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return {
      vao,
      count: mesh.indices.length,
      dispose: () => {
        gl.deleteBuffer(vbo);
        gl.deleteBuffer(ebo);
        gl.deleteVertexArray(vao);
      },
    };
  }

  render(width: number, height: number, camera: Vec3, target: Vec3, calls: DrawCall[]) {
    const gl = this.gl;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0.04, 0.05, 0.10, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.program);
    const proj = m4.perspective(Math.PI / 4, width / height, 0.1, 100);
    const view = m4.lookAt(camera, target, [0, 1, 0]);
    gl.uniformMatrix4fv(this.uProj, false, proj);
    gl.uniformMatrix4fv(this.uView, false, view);
    gl.uniform3f(this.uLight, 5, 8, 5);
    gl.uniform3f(this.uCamera, camera[0], camera[1], camera[2]);
    for (const c of calls) {
      gl.uniformMatrix4fv(this.uModel, false, c.model);
      gl.uniform3f(this.uColor, c.color[0], c.color[1], c.color[2]);
      gl.bindVertexArray(c.mesh.vao);
      gl.drawElements(gl.TRIANGLES, c.mesh.count, gl.UNSIGNED_INT, 0);
    }
    gl.bindVertexArray(null);
  }
}
