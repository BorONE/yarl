import React, { memo, type CSSProperties } from 'react';
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
import statusIconDoneStoppedSkipped from './assets/status/2/skipped stopped.svg'
import statusIconDoneSuccess from './assets/status/2/success.svg'

import runIcon from './assets/button/3/run.svg'
import stopIcon from './assets/button/3/stop.svg'
import scheduleIcon from './assets/button/3/schedule.svg'
import unscheduleIcon from './assets/button/3/unschedule.svg'
import skipIcon from './assets/button/3/skip.svg'
import unskipIcon from './assets/button/3/unskip.svg'
import doneIcon from './assets/button/3/done.svg'
import resetIcon from './assets/button/3/reset.svg'

import * as config from './gen/internal/graph/config_pb';

import * as client from './client'

import {
    type Node as BaseNode,
} from '@xyflow/react';
import { extractJobTypeSafe } from './util';
import { getBorderColor } from './misc';

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
  

const buttonOffset = 0

const borderWidth = 1
const borderRadius = 4

export const nodeInitParams : Partial<Node> = {
    style: {
        borderRadius: borderRadius,
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
    left: -10,
    right: 0,
    height: 20 - buttonOffset * 2,
    width: 20 - buttonOffset * 2,
    borderRadius: borderRadius,
    borderWidth: borderWidth,
    backgroundColor: 'transparent',
}

export const ioOffset = 10

type Btn = {
    onClick: () => void,
    icon: string,
    tooltip: string,
}

export default memo(({ data } : { data: NodeData }) => {
    const genButton = (btn: Btn, pos: number, style = {}, className: string | undefined = undefined) => {
        style = { ...buttonStyle, borderColor: 'transparent', ...style }
        const position : CSSProperties = { position: 'absolute', left: pos * 20 + 9, top: -1 }
        return <div key={pos.toString()} style={position}>
            <Tooltip>
                <TooltipTrigger onClick={btn.onClick} style={style} className={className}>
                    <img src={btn.icon}/>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{btn.tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </div>
    }

    const genButtonsData = () => {
        const state : config.NodeState = data.state
        switch (state.State.case) {
        case "Idle":
            const idle = state.State.value
            if (idle.IsReady) {
                return [
                    {
                        onClick: () => client.node.run({Id: data.id}),
                        icon: runIcon,
                        tooltip: "Run"
                    },
                    {
                        onClick: () => client.node.done({Id: data.id}),
                        icon: skipIcon,
                        tooltip: "Skip"
                    },
                ]
            }
            switch (state.State.value.Plan) {
            case config.NodeState_IdleState_IdlePlan.None:
                return [
                    {
                        onClick: () => client.node.schedule({Id: data.id}),
                        icon: scheduleIcon,
                        tooltip: "Schedule"
                    },
                    {
                        onClick: () => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.Skipped}),
                        icon: skipIcon,
                        tooltip: "Skip"
                    },
                ]
            case config.NodeState_IdleState_IdlePlan.Scheduled:
                return [
                    {
                        onClick: () => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.None}),
                        icon: unscheduleIcon,
                        tooltip: "Unschedule"
                    },
                    {
                        onClick: () => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.Skipped}),
                        icon: skipIcon,
                        tooltip: "Skip"
                    },
                ]
            case config.NodeState_IdleState_IdlePlan.Skipped:
                return [
                    undefined,
                    {
                        onClick: () => client.node.plan({Id: data.id, Plan: config.NodeState_IdleState_IdlePlan.None}),
                        icon: unskipIcon,
                        tooltip: "Unskip"
                    },
                ]
            }
        case "InProgress":
            return [
                {
                    onClick: () => client.node.stop({Id: data.id}),
                    icon: stopIcon,
                    tooltip: "Stop"
                },
                {
                    onClick: () => client.node.skip({Id: data.id}),
                    icon: doneIcon,
                    tooltip: "Skip"
                },
            ]
        case "Done":
            return [
                {
                    onClick: () => client.node.reset({Id: data.id}),
                    icon: resetIcon,
                    tooltip: "Reset"
                },
                undefined,
            ]
        default:
            return []
        }
    }

    const buttons = genButtonsData()
        .map((btn, i) => btn ? genButton(btn, i) : undefined);

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
            if (state.State.value.FromIdle) {
                return {icon: statusIconSkipped}
            } else if (state.State.value.IsStopped) {
                return {icon: state.State.value.IsSkipped ? statusIconDoneStoppedSkipped : statusIconDoneStopped }
            } else if (state.State.value.Error) {
                return {icon: state.State.value.IsSkipped ? statusIconDoneErrorSkipped : statusIconDoneError }
            } else {
                return {icon: statusIconDoneSuccess}
            }
        }
        return {icon: statusIcon}
    }

    const getAnimation = () => {
        switch (data.state.State.case) {
        case "InProgress":
            return "breathe 1s ease-in-out 0s infinite"
        default:
            return ""
        }
    }

    const name = {
        value: data.config.Name == "" ? `Node` : data.config.Name,
        color: data.config.Name == "" ? "#747474" : undefined,
    }

    const handleOffset = -4
    const handleSize = undefined

    return <div className='job-node-div'>
        <label className='job-node-name' style={{ color: name.color }}>
            {name.value}
        </label>
    
        <label className='job-node-type'>
            {extractJobTypeSafe(data.config.Job?.typeUrl)} #{data.id}
        </label>

        <img src={getStateIcon().icon} className='job-node-status' style={{ animation: getAnimation() }} />

        <div className='job-node-buttons' style={{position: "absolute", top: -20, left: 0}}>
            {buttons}
        </div>

        <Handle type="target" position={Position.Left} style={{position: "absolute", top: 9, left: handleOffset, backgroundColor: data.state.State.case != "Idle" || data.state.State.value.IsReady ? "#6DDD52" : "#D9D9D9", width: handleSize, height: handleSize }}/>
        <Handle type="source" position={Position.Right} style={{position: "absolute", top: 9, right: handleOffset, backgroundColor: getBorderColor(data.state), width: handleSize, height: handleSize }}/>
        
        {
            data.config.Inputs.map((file, i) => <div key={i}>
                <div style={{
                    fontSize: 8,
                    position: "absolute",
                    top: 9 + 20 + ioOffset * i - 6,
                    left: 5,
                    color: "#888",
                    width: 50 - (5),
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                    textAlign: "left",
                }}>
                    {file}
                </div>
                <Handle
                    type="target"
                    position={Position.Left}
                    style={{
                        position: "absolute",
                        top: 9 + 20 + ioOffset * i,
                        left: handleOffset,
                        backgroundColor: "#D9D9D9",
                        width: handleSize,
                        height: handleSize,
                    }}
                    id={(i + 1).toString()}
                    />
            </div>)
        }

        {
            data.config.Outputs.map((file, i) => <div key={i}>
                <div style={{
                    fontSize: 8,
                    position: "absolute",
                    top: 9 + 20 + ioOffset * i - 6,
                    right: 5,
                    color: "#888",
                    width: 50 - (5),
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                    textAlign: "right",
                }}>
                    {file}
                </div>
                <Handle
                    type="source"
                    position={Position.Right}
                    style={{
                        position: "absolute",
                        top: 9 + 20 + ioOffset * i,
                        right: handleOffset,
                        backgroundColor: "#D9D9D9",
                        width: handleSize,
                        height: handleSize,
                    }}
                    id={(i + 1).toString()}
                    />
            </div>)
        }
    </div>
});
