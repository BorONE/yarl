import React, { memo, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';

import statusIcon from './assets/status/placeholder.svg'
import statusIconIdleNotReady from './assets/status/IdleNotReady.svg'
import statusIconIdleReady from './assets/status/IdleReady.svg'
import statusIconInProgress from './assets/status/InProgress.svg'
import statusIconDoneError from './assets/status/DoneError.svg'
import statusIconDoneStopped from './assets/status/DoneStopped.svg'
import statusIconDoneSuccess from './assets/status/DoneSuccess.svg'
// import runIcon from './assets/button/placeholder.svg'

import runIcon from './assets/button/run.svg'
import stopIcon from './assets/button/stop.svg'
import resetIcon from './assets/button/reset.svg'

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


export default memo(({ data }) => {
    const applyUpdates = (nds: Node[], updates: api.Updates) => {
        return nds.map((nd) => {
            const state = updates.NodeStates.find((state) => state.Id == nd.data.id);
            return state ? { ...nd, data: { ...nd.data, state }} : nd;
        })
    }

    const applyUpdatesEdges = (eds: Edge[], updates: api.Updates) => {
        console.log('applyUpdatesEdges')
        return eds.map((ed) => {
            const state = updates.NodeStates.find((state) => state.Id == BigInt(ed.source));
            console.log(state, ed)
            return state ? { ...ed, animated: state.State.case == "Done" && !state.State.value.Error } : ed;
        })
    }

    const onUpdates = useCallback(
        (updates: api.Updates) => {
            data.hooks.setNodes((nds) => applyUpdates(nds, updates))
            data.hooks.setEdges((eds) => applyUpdatesEdges(eds, updates))
        },
        [data.hooks.setNodes, data.hooks.setEdges],
    );

    const genButton = (onClick: () => void, icon: string, index: number) => {
        return <button
            onClick={onClick}
            style={{ position: 'absolute', bottom: 10, left: 10 + 21 * index, height: 20, width: 20, padding: 0, borderRadius: 4 }}
        >
            <img src={icon} style={{ height: 18, width: 18 }} />
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
            {state.case == "Idle" && state.value.IsReady ? genButton(onClickRun, runIcon, 0) : <></>}
            {state.case == "InProgress" ? genButton(onClickStop, stopIcon, 0) : <></>}
            {state.case == "Done" ? genButton(onClickReset, resetIcon, 0) : <></>}
        </>
    }

    const getJobType = () => {
        return extractJobType(data.config.Job.typeUrl)
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
            // } else if (data.state.value.Error) {
                // how is it optional?
            } else if (state.Error) {
                return {icon: statusIconDoneError, alt: data.state.case}
            } else {
                return {icon: statusIconDoneSuccess, alt: data.state.case}
            }
        }
        return {icon: statusIcon, alt: data.state.case}
    }

    return <div style={{borderRadius: 100}}>
    {/* return <div className='border-radius'> */}
        <Handle
            type="target"
            position={Position.Left}
            onConnect={(params) => console.log('handle onConnect', params)}
        />

        <label style={{
            position: 'absolute',
            left: 10,
            top: 8,
            fontSize: 12,
            whiteSpace: "nowrap",
            width: "53px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "inline-block",
            textAlign: "left",
        }}>
            {data.config.Name}
        </label>
        
        <label style={{ position: 'absolute', left: 10, top: 21, fontSize: 7, color: "#747474", fontStyle: "italic" }}>
            {getJobType()}
        </label>
        
        <img
            src={getStateIcon().icon}
            alt={getStateIcon().alt}
            style={{ position: 'absolute', right: 11, top: 11, height: 12, width: 12 }}
        />
        
        {genButtons()}
        
        <Handle
            type="source"
            position={Position.Right}
        />
    </div>
});
