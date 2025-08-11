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
import statusIconDoneStopped from './assets/status/2/stopped.svg'
import statusIconDoneSuccess from './assets/status/2/success.svg'

import runIcon from './assets/button/2/run.svg'
import scheduleIcon from './assets/button/2/schedule.svg'
import unscheduleIcon from './assets/button/2/unschedule.svg'
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
import { getBorderColor } from './misc';

export default memo(({ data }) => {
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
        switch (data.state.State.case) {
        case "Idle":
            if (data.state.State.value.IsReady) {
                return genButton(() => client.node.run({Id: data.id}), runIcon, style)
            } else if (!data.state.State.value.IsScheduled) {
                return genButton(() => client.node.schedule({Id: data.id}), scheduleIcon, style)
            } else {
                return genButton(() => client.node.unschedule({Id: data.id}), unscheduleIcon, style)
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
            borderWidth: 0,
            position: "absolute", bottom: 0, left: borderWidth + 20,
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
        const state = data.state.State.value;
        switch (data.state.State.case) {
        case "Idle":
            if (state.IsReady) {
                return {icon: statusIconIdleReady, alt: data.state.case}
            } else if (state.IsScheduled) {
                return {icon: statusIconScheduled, alt: data.state.case}
            } else {
                return {icon: statusIconIdleNotReady, alt: data.state.case}
            }
        case "InProgress":
            if (state.Status == config.NodeState_InProgressState_InProgressStatus.Skipping) {
                return {icon: statusIconSkipping, alt: data.state.case}
            } else {
                return {icon: statusIconInProgress, alt: data.state.case}
            }
        case "Done":
            if (state.IsStopped) {
                return {icon: statusIconDoneStopped, alt: data.state.case}
            } else if (state.Error) {
                if (state.IsSkipped) {
                    return {icon: statusIconDoneErrorSkipped, alt: data.state.case}
                } else {
                    return {icon: statusIconDoneError, alt: data.state.case}
                }
            } else {
                if (state.FromIdle) {
                    return {icon: statusIconSkipped, alt: data.state.case}
                } else {
                    return {icon: statusIconDoneSuccess, alt: data.state.case}
                }
            }
        }
        return {icon: statusIcon, alt: data.state.case}
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
        
        <div className='extra-buttons' style={{position: "absolute", bottom: "0px", height: "20px", width: "100px"}}>
            {genFirstButton()}
        </div>

        <div className='main-button'>
            {genMainButton()}
        </div>

        <Handle type="target" position={Position.Left} style={{position: "absolute", top: "9px", left: '-5px'}}/>
        <Handle type="source" position={Position.Right} style={{position: "absolute", top: "9px", right: '-5px'}}/>
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
