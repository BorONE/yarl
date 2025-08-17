import {
  Position,
  type Node,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { nodeInitParams } from './JobNode';
import * as config from './gen/internal/graph/config_pb'

export function isReady(state: config.NodeState) {
  return (state.State.case == "Done" && (state.State.value.Error == "" && !state.State.value.IsStopped || state.State.value.IsSkipped))
      || (state.State.case == "InProgress" && state.State.value.Status == config.NodeState_InProgressState_InProgressStatus.Skipping)
}

export function buildNode(config: config.NodeConfig, state: config.NodeState, selected?: boolean) {
  var node : Node = {
    id: `${config.Id}`,
    type: 'JobNode',
    position: config.Position ? { x: config.Position.X, y: config.Position.Y } : { x: 0, y: 0 },
    data: {
      id: config.Id,
      config,
      state,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    selected,
    ...nodeInitParams,
  }
  node.style = {
    ...node.style,
    borderColor: getBorderColor(state),
  }
  return node
}

export function getBorderColor(nodeState: config.NodeState) {
  const state = nodeState.State
  switch (state.case) {
  case "Idle":
    return "#D9D9D9"
  case "InProgress":
    const inProgress = state.value
    if (inProgress.Status == config.NodeState_InProgressState_InProgressStatus.Skipping) {
      return "#6DDD52"
    } else {
      return "#5773E4"
    }
  case "Done":
    const done = state.value
    if (done.IsStopped) {
      return "#DD5274"
    } else if (done.IsSkipped) {
      return "#6DDD52"
    } else if (done.Error) {
      return "#DD5274"
    } else {
      return "#6DDD52"
    }
  }
  return "#D9D9D9"
}
