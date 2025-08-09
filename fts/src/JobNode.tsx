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
import doneIcon from './assets/button/2/done.svg'
import stopIcon from './assets/button/2/stop.svg'
import resetIcon from './assets/button/2/reset.svg'
import moreIcon from './assets/button/2/more.svg'

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
    const genButton = (onClick: () => void, icon: string, style = {}) => {
        return <button onClick={onClick} style={{...buttonStyle, borderColor: getBorderColor(data.state), ...style}}>
            <img src={icon}/>
        </button>
    }

    const genMainButton = () => {
        const style = {
            right: -borderWidth,
            top: -borderWidth,
        }
        switch (data.state.State.case) {
        case "Idle":
            return data.state.State.value.IsReady
                ? genButton(() => client.node.run({Id: data.id}), runIcon, style)
                : <></>
        case "InProgress":
            return genButton(() => client.node.stop({Id: data.id}), stopIcon, style)
        case "Done":
            return genButton(() => client.node.reset({Id: data.id}), resetIcon, style)
        default:
            return <></>
        }
    }

    const genFirstButton = () => {
        const style = {
            borderWidth: 0,
            position: "absolute", bottom: 0, left: borderWidth,
        }
        switch (data.state.State.case) {
        case "Idle":
            return genButton(() => {client.node.done({Id: data.id})}, doneIcon, style)
        case "InProgress":
            return genButton(() => {client.node.skip({Id: data.id})}, doneIcon, style)
        case "Done":
            return <></>
        default:
            return <></>
        }
    }

    const hasExtraButtons = () => {
        switch (data.state.State.case) {
        case "Idle":
            return true
        case "InProgress":
            return true
        case "Done":
            return false
        default:
            return false
        }
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

        <div
            className='more-buttons'
            style={{
                position: 'absolute',
                left: 0,
                top: 20-borderWidth,
                height: 20,
                width: 20,
                visibility: hasExtraButtons() ? "visible" : "hidden"
            }}
        >
            <img src={moreIcon}/>
        </div>
        
        <div className='extra-buttons' style={{position: "absolute", bottom: "0px", height: "40px", width: "100px"}}>
            <div // hiding more-buttons
                style={{
                    position: 'absolute',
                    left: borderWidth,
                    bottom: 10,
                    height: 10,
                    width: 20-borderWidth,
                    backgroundColor: "white",
                }}
            />
            {genFirstButton()}
        </div>

        <div className='main-button'>
            {genMainButton()}
        </div>

        <Handle type="target" position={Position.Left} style={{position: "absolute", top: "10px"}}/>
        <Handle type="source" position={Position.Right} style={{position: "absolute", top: "10px"}}/>
    </>
});

const borderWidth = 1

export const nodeInitParams : Partial<Node> = {
    style: {
        borderRadius: 10,
        borderWidth: borderWidth,
    }
}

const buttonStyle : React.CSSProperties = {
    position: "absolute",
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: borderWidth,
}
