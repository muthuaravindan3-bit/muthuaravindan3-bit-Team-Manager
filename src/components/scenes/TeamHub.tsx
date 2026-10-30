import { useStaffNodes } from '../../hooks/useStaffNodes';
import { ScenePanel } from './ScenePanel';
export function TeamHub() {
  const { nodes, unavailable } = useStaffNodes();
  return <div className="team-hub"><ScenePanel kind="hub" nodes={nodes} title="Team hub" description={unavailable ? 'The directory is unavailable. Open Team to try again.' : 'Up to 12 people from the workspace directory. No staff relationship links are stored.'} /><ul className="scene-legend" aria-label="Staff shown in team hub">{nodes.map((node) => <li key={node.id}><span className={node.isOnBreak ? 'scene-dot-break' : 'scene-dot'} aria-hidden="true" />{node.label}<span>{node.isOnBreak ? 'On break' : 'No active break recorded'}</span></li>)}</ul></div>;
}
