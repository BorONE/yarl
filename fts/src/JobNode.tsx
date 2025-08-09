import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

import statusIconDoneError from './assets/status/2/failed.svg'
import statusIconIdleNotReady from './assets/status/2/idle.svg'
import statusIcon from './assets/status/2/placeholder.svg'
import statusIconIdleReady from './assets/status/2/ready.svg'
import statusIconInProgress from './assets/status/2/running.svg'
import statusIconDoneStopped from './assets/status/2/stopped.svg'
import statusIconDoneSuccess from './assets/status/2/success.svg'

import runIcon from './assets/button/2/run.svg'
import stopIcon from './assets/button/2/stop.svg'
import resetIcon from './assets/button/2/reset.svg'

import * as config from './gen/internal/graph/config_pb';

import * as client from './client'

import {
    type Node,
} from '@xyflow/react';
import { extractJobType } from './util';

function getBorderColor(nodeState: config.NodeState) {
  const stateCase = nodeState.State.case;
  const state = nodeState.State.value;
  switch (stateCase) {
  case "Idle":
      return "#D9D9D9"
  case "InProgress":
      return "#5773E4"
  case "Done":
      if (state.IsStopped) {
          return "#DD5274"
      } else if (state.Error) {
          return "#DD5274"
      } else {
          return "#6DDD52"
      }
  }
  return "#D9D9D9"
}


export default memo(({ data }) => {
    const genButton = (onClick: () => void, icon: string) => {
        return <button onClick={onClick} style={{...buttonStyle, borderColor: getBorderColor(data.state)}}>
            <img src={icon}/>
        </button>
    }

    const genButtons = () => {
        const st : config.NodeState = data.state;
        const state = st.State;
        return <>
            {state.case == "Idle" && state.value.IsReady ? genButton(() => client.node.run({Id: data.id}), runIcon) : <></>}
            {state.case == "InProgress" ? genButton(() => client.node.stop({Id: data.id}), stopIcon) : <></>}
            {state.case == "Done" ? genButton(() => client.node.reset({Id: data.id}), resetIcon) : <></>}
        </>
    }

    const getStateIcon = () => {
        const stateCase = data.state.State.case;
        const state = data.state.State.value;
        switch (stateCase) {
        case "Idle":
            if (state.IsReady) {
                return {icon: statusIconIdleReady, alt: data.state.case}
            } else {
                return {icon: statusIconIdleNotReady, alt: data.state.case}
            }
        case "InProgress":
            return {icon: statusIconInProgress, alt: data.state.case}
        case "Done":
            if (state.IsStopped) {
                return {icon: statusIconDoneStopped, alt: data.state.case}
            } else if (state.Error) {
                return {icon: statusIconDoneError, alt: data.state.case}
            } else {
                return {icon: statusIconDoneSuccess, alt: data.state.case}
            }
        }
        return {icon: statusIcon, alt: data.state.case}
    }

    return <>
        <label style={{
            position: 'absolute',
            left: 20,
            top: 0,
            fontSize: 9,
            whiteSpace: "nowrap",
            width: "60px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-block",
            textAlign: "left",
            color: "#080808"
        }}>
            {data.config.Name}
        </label>
    
        <label style={{
            position: 'absolute',
            left: 20,
            top: 8,
            fontSize: 6,
            color: "#747474",
        }}>
            {extractJobType(data.config.Job.typeUrl)} #{data.id}
        </label>

        <img
            src={getStateIcon().icon}
            alt={getStateIcon().alt}
            style={{
                position: 'absolute',
                left: 0,
                top: -borderWidth,
                height: 20,
                width: 20,
                animation: data.state.State.case == "Idle" ? "rotation 2s linear 0s infinite" : "",
            }}
            className='status'
        />
        
        {genButtons()}

        <Handle type="target" position={Position.Left}/>
        <Handle type="source" position={Position.Right}/>
    </>
});

const borderWidth = 1

export const nodeInitParams : Partial<Node> = {
    width: 100,
    height: 20,
    style: {
        borderRadius: 10,
        borderWidth: borderWidth,
    }
}

const buttonStyle : React.CSSProperties = {
    position: "absolute",
    right: -borderWidth,
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: borderWidth,
}
