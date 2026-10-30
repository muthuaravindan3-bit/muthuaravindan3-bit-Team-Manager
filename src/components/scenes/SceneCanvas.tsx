import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Group, Quaternion, Vector3, type Mesh } from 'three';
import { SCENE_MATERIALS as colors, type SceneProps } from './sceneTypes';

function Connection({ a, b }: { a: [number, number, number]; b: [number, number, number] }) {
  const transform = useMemo(() => { const start = new Vector3(...a); const finish = new Vector3(...b); return { position: start.clone().add(finish).multiplyScalar(.5), length: start.distanceTo(finish), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), finish.sub(start).normalize()) }; }, [a, b]);
  return <mesh position={transform.position} quaternion={transform.rotation}><cylinderGeometry args={[.018, .018, transform.length, 6]} /><meshStandardMaterial color={colors.teal} transparent opacity={.4} /></mesh>;
}
function People({ kind, nodes = [] }: SceneProps) {
  const group = useRef<Group>(null);
  const count = kind === 'network' ? 6 : Math.min(nodes.length, 12);
  const points = useMemo(() => Array.from({ length: count }, (_, index) => { const angle = index / Math.max(count, 1) * Math.PI * 2; return [Math.cos(angle) * 2.5, Math.sin(angle) * .7, Math.sin(angle) * 1.3] as [number, number, number]; }), [count]);
  useFrame(({ clock }, delta) => { if (!group.current) return; if (kind === 'network') group.current.rotation.y += Math.min(delta, .05) * .1; group.current.position.y = Math.sin(clock.elapsedTime * .6) * .09; });
  return <group ref={group}>{points.map((point, index) => <group key={nodes[index]?.id ?? index} position={point}>
    <mesh position={[0, .35, 0]}><sphereGeometry args={[.24, 16, 12]} /><meshStandardMaterial color={nodes[index]?.isOnBreak ? colors.amber : colors.teal} roughness={.35} metalness={.2} /></mesh>
    <mesh position={[0, -.15, 0]}><capsuleGeometry args={[.24, .4, 4, 12]} /><meshStandardMaterial color={colors.navy} roughness={.45} metalness={.25} /></mesh>
  </group>)}{kind === 'network' && points.map((point, index) => <Connection key={index} a={point} b={points[(index + 1) % count]} />)}<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.2, 0]}><torusGeometry args={[2.6, .045, 8, 48]} /><meshStandardMaterial color={colors.amber} roughness={.6} /></mesh></group>;
}
function Calendar({ selectedId }: SceneProps) {
  const tiles = useRef<(Mesh | null)[]>([]);
  useFrame((_, delta) => { tiles.current.forEach((tile, index) => { if (tile) tile.position.z += ((selectedId && index === 4 ? .65 : .12) - tile.position.z) * (1 - Math.exp(-Math.min(delta, .05) * 9)); }); });
  return <group rotation={[-.25, -.3, 0]}>
    <mesh position={[0, 0, -.12]}><boxGeometry args={[4.8, 2.7, .22]} /><meshStandardMaterial color={colors.navy} roughness={.5} /></mesh>
    {Array.from({ length: 10 }, (_, index) => <mesh ref={(mesh) => { tiles.current[index] = mesh; }} key={index} position={[(index % 5 - 2) * .85, (index < 5 ? .55 : -.55), .12]}><boxGeometry args={[.65, .65, .16]} /><meshStandardMaterial color={selectedId && index === 4 ? colors.amber : colors.teal} roughness={.4} metalness={.1} /></mesh>)}
  </group>;
}
function Checkmark() {
  const group = useRef<Group>(null);
  const started = useRef<number | null>(null);
  useFrame(({ clock, invalidate }) => {
    started.current ??= clock.elapsedTime;
    const progress = Math.min((clock.elapsedTime - started.current) / 1.2, 1);
    if (group.current) { group.current.scale.setScalar(.7 + .3 * Math.sin(Math.min(progress * 1.4, 1) * Math.PI / 2)); group.current.rotation.y = (1 - progress) * -.8; }
    if (progress < 1) invalidate();
  });
  return <group ref={group}><mesh rotation={[0, 0, Math.PI / 4]} position={[-.45, -.15, 0]}><boxGeometry args={[.3, 1, .3]} /><meshStandardMaterial color={colors.teal} metalness={.2} roughness={.3} /></mesh><mesh rotation={[0, 0, -Math.PI / 4]} position={[.3, .12, 0]}><boxGeometry args={[.3, 1.8, .3]} /><meshStandardMaterial color={colors.teal} metalness={.2} roughness={.3} /></mesh></group>;
}
function Orb({ state = 'idle' }: SceneProps) {
  const orb = useRef<Mesh>(null); const rings = useRef<Group>(null);
  useFrame(({ clock }, delta) => { if (orb.current) orb.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * (state === 'processing' ? 4 : 1)) * (state === 'processing' ? .1 : .025)); if (rings.current) rings.current.rotation.y += Math.min(delta, .05) * (state === 'processing' ? .9 : .15); });
  const color = state === 'processing' ? colors.amber : state === 'response' ? colors.teal : colors.navy;
  return <group><mesh ref={orb}><sphereGeometry args={[.9, 32, 20]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.15} roughness={.22} metalness={.35} /></mesh><group ref={rings}>{[0, 1].map((index) => <mesh key={index} rotation={[Math.PI / 3, index * Math.PI / 2, .3]}><torusGeometry args={[1.3, .035, 8, 48]} /><meshStandardMaterial color={colors.teal} metalness={.3} roughness={.4} /></mesh>)}</group></group>;
}
/** Small geometry-only scene; no textures, network assets, camera controls, or shadow maps. */
export default function SceneCanvas(props: SceneProps) {
  return <Canvas onCreated={({ gl }) => { gl.domElement.dataset.sceneReady = 'true'; }} dpr={matchMedia('(max-width: 639px)').matches ? 1 : [1, 1.5]} camera={{ position: [0, 1, 7.5], fov: 40 }} frameloop={props.kind === 'check' ? 'demand' : 'always'} gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }} fallback={<span>3D preview unavailable</span>}>
    <ambientLight intensity={1.5} /><directionalLight position={[3, 5, 4]} intensity={3} /><directionalLight color={colors.teal} position={[-3, 1, -2]} intensity={2} />
    {props.kind === 'network' || props.kind === 'hub' ? <People {...props} /> : props.kind === 'calendar' ? <Calendar {...props} /> : props.kind === 'check' ? <Checkmark /> : <Orb {...props} />}
  </Canvas>;
}
