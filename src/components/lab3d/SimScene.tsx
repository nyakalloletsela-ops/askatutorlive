import type { ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Grid, Html } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { SimulationSchemaT } from "@/lib/sim-lab.functions";
import { buildInitialState, stepSim, type SimObjectState } from "./physics";

type Props = {
  schema: SimulationSchemaT | null;
  playing: boolean;
  resetKey: number;
  timeScale: number;
  onCanvasReady?: (gl: THREE.WebGLRenderer) => void;
  onSelectObject?: (i: number) => void;
};

function ObjectMesh({ s, onClick }: { s: SimObjectState; onClick?: () => void }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.position.set(s.position[0], s.position[1], s.position[2]);
  });
  const color = s.color;
  let geom: ReactNode;
  switch (s.type) {
    case "sphere":
    case "particle":
    case "flow":
    case "curve":
      geom = <mesh castShadow><sphereGeometry args={[s.radius, 24, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.25} /></mesh>;
      break;
    case "cell":
      geom = (
        <group>
          <mesh castShadow><sphereGeometry args={[s.radius, 32, 18]} /><meshPhysicalMaterial color={color} transparent opacity={0.55} roughness={0.25} /></mesh>
          <mesh castShadow><sphereGeometry args={[s.radius * 0.38, 18, 12]} /><meshStandardMaterial color="#fef3c7" emissive="#f59e0b" emissiveIntensity={0.18} /></mesh>
        </group>
      );
      break;
    case "atom":
    case "molecule":
    case "nucleus":
      geom = (
        <group>
          <mesh castShadow><sphereGeometry args={[s.radius, 32, 18]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[s.radius * 1.45, 0.018, 8, 64]} /><meshBasicMaterial color="#e0f2fe" /></mesh>
          <mesh rotation={[0.9, 0.25, 0.4]}><torusGeometry args={[s.radius * 1.28, 0.018, 8, 64]} /><meshBasicMaterial color="#bfdbfe" /></mesh>
        </group>
      );
      break;
    case "organ":
      geom = <mesh castShadow><sphereGeometry args={[s.radius, 32, 18]} /><meshPhysicalMaterial color={color} roughness={0.5} clearcoat={0.4} /></mesh>;
      break;
    case "node":
      geom = <mesh castShadow><icosahedronGeometry args={[s.radius, 1]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} /></mesh>;
      break;
    case "axis":
    case "graph":
      geom = (
        <group>
          <mesh receiveShadow><boxGeometry args={s.size} /><meshStandardMaterial color="#0f172a" transparent opacity={0.55} /></mesh>
          <mesh position={[0, 0.06, 0]}><boxGeometry args={[s.size[0], 0.04, 0.04]} /><meshBasicMaterial color={color} /></mesh>
          <mesh position={[0, 0.07, 0]}><boxGeometry args={[0.04, 0.04, s.size[2]]} /><meshBasicMaterial color={color} /></mesh>
        </group>
      );
      break;
    case "dna":
      geom = (
        <group>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={i} position={[Math.sin(i) * 0.45, i * 0.22 - 0.8, Math.cos(i) * 0.45]} castShadow>
              <sphereGeometry args={[0.12, 12, 8]} />
              <meshStandardMaterial color={i % 2 ? "#22d3ee" : color} emissive={color} emissiveIntensity={0.2} />
            </mesh>
          ))}
        </group>
      );
      break;
    case "wall":
      geom = <mesh receiveShadow castShadow><boxGeometry args={s.size} /><meshStandardMaterial color="#475569" /></mesh>;
      break;
    case "plane":
      geom = <mesh receiveShadow><boxGeometry args={s.size} /><meshStandardMaterial color="#1e293b" /></mesh>;
      break;
    case "car":
      geom = (
        <group>
          <mesh castShadow position={[0, 0.4, 0]}><boxGeometry args={s.size} /><meshStandardMaterial color={color} /></mesh>
          {[-0.6, 0.6].map((x) => [-0.4, 0.4].map((z) => (
            <mesh key={`${x}-${z}`} castShadow position={[x, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          )))}
        </group>
      );
      break;
    case "arrow":
      geom = <mesh><coneGeometry args={[s.radius, s.radius * 2, 12]} /><meshStandardMaterial color={color} /></mesh>;
      break;
    default:
      geom = <mesh castShadow><boxGeometry args={s.size} /><meshStandardMaterial color={color} /></mesh>;
  }
  return (
    <group ref={ref} onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {geom}
      {s.label && (
        <Html distanceFactor={12} position={[0, s.radius + 0.6, 0]} center>
          <div className="cursor-pointer rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white hover:bg-violet-600">{s.label}</div>
        </Html>
      )}
    </group>
  );
}

function ConnectionLine({ from, to, label, color = "#67e8f9" }: { from?: SimObjectState; to?: SimObjectState; label?: string; color?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (!ref.current || !from || !to) return;
    const start = new THREE.Vector3(from.position[0], from.position[1], from.position[2]);
    const end = new THREE.Vector3(to.position[0], to.position[1], to.position[2]);
    const dir = end.clone().sub(start);
    const len = Math.max(dir.length(), 0.001);
    ref.current.position.copy(start.add(end).multiplyScalar(0.5));
    ref.current.scale.set(1, len, 1);
    ref.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  });
  if (!from || !to) return null;
  const mid: [number, number, number] = [
    (from.position[0] + to.position[0]) / 2,
    (from.position[1] + to.position[1]) / 2 + 0.25,
    (from.position[2] + to.position[2]) / 2,
  ];
  return (
    <>
      <mesh ref={ref}>
        <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.75} />
      </mesh>
      {label && (
        <Html distanceFactor={14} position={mid} center>
          <div className="rounded bg-black/70 px-1.5 py-0.5 text-[9px] text-cyan-100">{label}</div>
        </Html>
      )}
    </>
  );
}

function SimRunner({ schema, playing, resetKey, timeScale, onSelectObject }: { schema: SimulationSchemaT; playing: boolean; resetKey: number; timeScale: number; onSelectObject?: (i: number) => void }) {
  const state = useMemo<SimObjectState[]>(() => (schema ? buildInitialState(schema) : []), [schema, resetKey]);
  useFrame((_, dt) => {
    if (!schema || !playing) return;
    stepSim(state, schema.rules, Math.min(dt, 0.05) * timeScale);
  });
  return (
    <>
      {(schema.connections ?? []).map((c, i) => (
        <ConnectionLine
          key={`${c.from}-${c.to}-${i}`}
          from={state[c.from]}
          to={state[c.to]}
          label={c.label}
          color={c.type === "bond" ? "#fef08a" : c.type === "force" ? "#fb7185" : "#67e8f9"}
        />
      ))}
      {state.map((s) => <ObjectMesh key={s.index} s={s} onClick={() => onSelectObject?.(s.index)} />)}
    </>
  );
}

function CanvasReadyBridge({ onReady }: { onReady?: (gl: THREE.WebGLRenderer) => void }) {
  const { gl } = useThree();
  useEffect(() => { onReady?.(gl); }, [gl, onReady]);
  return null;
}

export function SimScene({ schema, playing, resetKey, timeScale, onCanvasReady, onSelectObject }: Props) {
  return (
    <Canvas
      shadows
      gl={{ preserveDrawingBuffer: true, antialias: true }}
      camera={{ position: [10, 8, 12], fov: 50 }}
      style={{ background: "#0b1020" }}
    >
      <CanvasReadyBridge onReady={onCanvasReady} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 15, 10]} intensity={0.8} castShadow />
      <Grid args={[40, 40]} cellColor="#1e293b" sectionColor="#334155" fadeDistance={40} infiniteGrid />
      <OrbitControls makeDefault enableDamping />
      {schema && <SimRunner schema={schema} playing={playing} resetKey={resetKey} timeScale={timeScale} onSelectObject={onSelectObject} />}
    </Canvas>
  );
}
