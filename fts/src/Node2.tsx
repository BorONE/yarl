import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

import statusIconDoneError from './assets/status/2/failed.svg'
// import statusIconIdleNotReady from './assets/status/2/idle.pdf'
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
import * as api from './gen/internal/api/api_pb';

import {
    type Node,
    type Edge,
    applyNodeChanges,
} from '@xyflow/react';
import { create } from '@bufbuild/protobuf';
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
    const onUpdates = data.hooks.onUpdates

    const genButton = (onClick: () => void, icon: string) => {
        return <button onClick={onClick} style={{...buttonStyle, borderColor: getBorderColor(data.state)}}>
            <img src={icon}/>
        </button>
    }

    const genButtons = () => {
        const onClickRun = async () => {
            await client.node.run({Id: data.id})
            const inProgressState : config.NodeState_InProgressState = {Status: config.NodeState_InProgressState_InProgressStatus.Running}
            const update = create(config.NodeStateSchema, { Id: data.id, State: { case: "InProgress", value: inProgressState } })
            onUpdates(create(api.UpdatesSchema, {NodeStates: [update]}))
            
            client.node.waitDone({Id: data.id}).then(onUpdates)
        }

        const onClickStop = async () => {
            await client.node.stop({Id: data.id})
        }

        const onClickReset = async () => {
            client.node.reset({Id: data.id}).then(onUpdates)
        }
        
        const st : config.NodeState = data.state;
        const state = st.State;
        return <>
            {state.case == "Idle" && state.value.IsReady ? genButton(onClickRun, runIcon) : <></>}
            {state.case == "InProgress" ? genButton(onClickStop, stopIcon) : <></>}
            {state.case == "Done" ? genButton(onClickReset, resetIcon) : <></>}
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
        <Handle
            type="target"
            position={Position.Left}
            onConnect={(params) => console.log('handle onConnect', params)}
        />

        <label style={{
            position: 'absolute',
            left: 20,
            top: 0,
            fontSize: 9,
            whiteSpace: "nowrap",
            width: "53px",
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
            // fontStyle: "italic",
        }}>
            shell
            {/* {extractJobType(data.config.Job.typeUrl)} */}
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
            }}
            className='status'
        />
        
        {genButtons()}
        
        <Handle
            type="source"
            position={Position.Right}
        />
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

// export const nodeInitParams : Partial<Node> = {
//     width: 120,
//     height: 20,
//     style: {
//         borderRadius: 10 + 2 * borderWidth,
//         borderWidth: borderWidth,
//     }
// }


// const buttonStyle : React.CSSProperties = {
//     position: "absolute",
//     right: 0 - borderWidth,
//     height: 20 + 2 * borderWidth,
//     width: 20 + 2 * borderWidth,
//     borderRadius: 11 + borderWidth,
//     borderWidth: borderWidth,
// }
