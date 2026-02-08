import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useEdges,
  type Edge as BaseEdgeType,
  type EdgeProps,
} from '@xyflow/react';
import * as config from './gen/internal/graph/config_pb';
import { useApp } from './App';

export type EdgeData = {
  config: config.EdgeConfig,
}

export type Edge = BaseEdgeType<EdgeData>

function getType(edge: config.EdgeConfig) {
  switch (edge.Type) {
  case config.EdgeType.Copy:
    return 'cp'
  case config.EdgeType.SymLink:
    return 'ln'
  }
}

export default function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edge = useEdges().find(edge => edge.id == id) as Edge | undefined
  const onEdgeClick = async () => {
    if (edge && edge.data) {
      // in case of enum values == keys basically, but values keep type 
      const types = Object.values(config.EdgeType).filter(x => typeof x == 'number')
      const currType = edge.data?.config?.Type || 0
      const nextType = (currType + 1) % types.length as config.EdgeType
      const { updateEdgeType } = useApp()
      updateEdgeType(edge.id, nextType)
    }
  };

  const type = edge?.data?.config?.Type || config.EdgeType.Copy
  const getStrokeDasharray = () => {
    switch (type) {
    case config.EdgeType.Copy:
      return undefined
    case config.EdgeType.SymLink:
      return '4,1'
    }
  }

  return (
    <>
      <BaseEdge className='base-edge' path={edgePath} markerEnd={markerEnd} style={{ ...style, strokeDasharray: getStrokeDasharray() }} />
      <EdgeLabelRenderer>
        <div
          className="button-edge__label nodrag nopan"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <button className="button-edge__button" onClick={onEdgeClick}>
            {edge?.data?.config ? getType(edge.data.config as config.EdgeConfig) : '?'}
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
