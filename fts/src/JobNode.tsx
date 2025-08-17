import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

import statusIconDoneError from './assets/status/2/failed.svg'
import statusIconDoneErrorSkipped from './assets/status/2/skipped failed.svg'
import statusIconIdleNotReady from './assets/status/2/idle.svg'
import statusIcon from './assets/status/2/placeholder.svg'
import statusIconIdleReady from './assets/status/2/ready.svg'
import statusIconScheduled from './assets/status/2/scheduled.svg'
import statusIconInProgress from './assets/status/2/running.svg'
import statusIconSkipping from './assets/status/2/skipping.svg'
import statusIconSkipped from './assets/status/2/skipped.svg'
import statusIconToSkip from './assets/status/2/to_skip.svg'
import statusIconDoneStopped from './assets/status/2/stopped.svg'
import statusIconDoneSuccess from './assets/status/2/success.svg'

import runIcon from './assets/button/2/run.svg'
import scheduleIcon from './assets/button/2/schedule.svg'
import unscheduleIcon from './assets/button/2/unschedule.svg'
import skipIcon from './assets/button/2/skip.svg'
import unskipIcon from './assets/button/2/unskip.svg'
import doneIcon from './assets/button/2/done.svg'
import stopIcon from './assets/button/2/stop.svg'
import resetIcon from './assets/button/2/reset.svg'
import moreIcon from './assets/button/2/more.svg'

import * as config from './gen/internal/graph/config_pb';

import * as client from './client'

import {
    type Node as BaseNode,
} from '@xyflow/react';
import { extractJobType } from './util';
import { getBorderColor } from './misc';

export default memo(({ data } : { data: NodeData }) => {
    const genButton = (onClick: () => void, icon: string, style = {}, className: string | undefined = undefined) => {
        return <button onClick={onClick} style={{...buttonStyle, borderColor: getBorderColor(data.state), ...style}} className={className}>
            <img src={icon}/>
        </button>
    }

    const genMainButton = () => {
        const style = {
            right: -borderWidth,
            top: -borderWidth,
        }
        const state : config.NodeState = data.state
        switch (state.State.case) {
        case "Idle":
            if (state.State.value.IsReady) {
                return genButton(() => client.node.run({Id: data.id}), runIcon, style)
            } else if (state.State.value.Plan != config.NodeState_IdleState_IdlePlan.Scheduled) {
                return genButton(() => client.node.schedule({Id: data.id}), scheduleIcon, style)
            } else {
                return genButton(() => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.None}), unscheduleIcon, style)
            }
        case "InProgress":
            return genButton(() => client.node.stop({Id: data.id}), stopIcon, style)
        case "Done":
            return genButton(() => client.node.reset({Id: data.id}), resetIcon, style, 'reset-button')
        default:
            return <></>
        }
    }

    const genFirstButton = () => {
        const style = {
            position: "absolute", top: 20 - borderWidth, left: 20 - borderWidth,
        }
        const state : config.NodeState = data.state
        switch (state.State.case) {
        case "Idle":
            const idle = state.State.value
            if (idle.IsReady) {
                return genButton(() => client.node.done({Id: data.id}), skipIcon, style)
            }
            if (idle.Plan != config.NodeState_IdleState_IdlePlan.Skipped) {
                return genButton(() => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.Skipped}), skipIcon, style)
            } else {
                return genButton(() => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.None}), unskipIcon, style)
            }
        case "InProgress":
            return genButton(() => {client.node.skip({Id: data.id})}, doneIcon, style)
        case "Done":
            return undefined
        default:
            return undefined
        }
    }

    const hasExtraButtons = () => {
        return [genFirstButton()].filter((el) => typeof el != "undefined").length > 0
    }

    const getStateIcon = () => {
        const state : config.NodeState = data.state;
        switch (state.State.case) {
        case "Idle":
            if (state.State.value.IsReady) {
                return {icon: statusIconIdleReady}
            }
            switch (state.State.value.Plan) {
            case config.NodeState_IdleState_IdlePlan.Scheduled:
                return {icon: statusIconScheduled}
            case config.NodeState_IdleState_IdlePlan.Skipped:
                return {icon: statusIconToSkip}
            case config.NodeState_IdleState_IdlePlan.None:
                return {icon: statusIconIdleNotReady}
            }
        case "InProgress":
            if (state.State.value.Status == config.NodeState_InProgressState_InProgressStatus.Skipping) {
                return {icon: statusIconSkipping}
            } else {
                return {icon: statusIconInProgress}
            }
        case "Done":
            if (state.State.value.IsStopped) {
                return {icon: statusIconDoneStopped}
            } else if (state.State.value.Error) {
                if (state.State.value.IsSkipped) {
                    return {icon: statusIconDoneErrorSkipped}
                } else {
                    return {icon: statusIconDoneError}
                }
            } else {
                if (state.State.value.FromIdle) {
                    return {icon: statusIconSkipped}
                } else {
                    return {icon: statusIconDoneSuccess}
                }
            }
        }
        return {icon: statusIcon}
    }

    const getAnimation = () => {
        switch (data.state.State.case) {
            case "Idle":
                return "rotation 2s linear 0s infinite"
        case "InProgress":
            return "breathe 1s ease-in-out 0s infinite"
        default:
            return ""
        }
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
            color: data.config.Name == "" ? "#747474" : "#080808"
        }}>
            {data.config.Name == "" ? "Node" : data.config.Name}
        </label>
    
        <label style={{
            position: 'absolute',
            left: 20,
            top: 8,
            fontSize: 6,
            color: "#747474",
        }}>
            {data.config.Job ? extractJobType(data.config.Job.typeUrl) : "Unknown job type"} #{data.id}
        </label>

        <img
            src={getStateIcon().icon}
            style={{
                position: 'absolute',
                left: 0,
                top: -borderWidth,
                height: 20,
                width: 20,
                animation: getAnimation(),
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
        
        <div className='extra-buttons' style={{position: "absolute", top: 0, left: 0}}>
            {genFirstButton()}
        </div>

        <div className='main-button'>
            {genMainButton()}
        </div>

        <Handle type="target" position={Position.Left} style={{position: "absolute", top: "9px", left: '-1px'}}/>
        <Handle type="source" position={Position.Right} style={{position: "absolute", top: "9px", right: '-1px'}}/>
    </>
});

const borderWidth = 1

export const nodeInitParams : Partial<Node> = {
    style: {
        borderRadius: 10,
        borderWidth: borderWidth,
    }
}

export type NodeData = {
    id: bigint,
    config: config.NodeConfig,
    state: config.NodeState,
}

export type Node = BaseNode<NodeData>

const buttonStyle : React.CSSProperties = {
    position: "absolute",
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: borderWidth,
}
