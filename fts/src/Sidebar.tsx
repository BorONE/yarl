import React, { useCallback, type ReactElement } from 'react';
import { applyNodeChanges } from '@xyflow/react';
import { create, fromBinary, type DescMessage, type Message, type MessageInitShape } from '@bufbuild/protobuf';
import { NodeConfigSchema, type NodeConfig, type Position } from './gen/internal/graph/config_pb';
import { ShellCommandConfigSchema, ShellScriptConfigSchema, type ShellCommandConfig } from './gen/internal/job/register/shell_pb';
import { extractJobType } from './util';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import { anyPack, type Any } from '@bufbuild/protobuf/wkt';

import * as client from './client'
import { Input } from './components/ui/input';
import { Separator } from './components/ui/separator';
import Cookies from 'universal-cookie';
import Artifacts from './Arts';
import type { Node } from './JobNode';
import { buildNode } from './misc';
import { ScriptConfigSchema } from './gen/internal/job/register/script_pb';
import { DaemonConfigSchema, DaemonMonitorConfigSchema } from './gen/internal/job/register/daemon_pb';
import JobEditor from './JobEditor';
import type { GenMessage } from '@bufbuild/protobuf/codegenv2';
import Io from './io';
import { FileConfigSchema } from './gen/internal/job/register/file/file_pb';


type JobInfo = {
    type: string,
    schema: any,
    init: any,
    disabled?: boolean,
}

type Context = {
    onJobChange: (schema: DescMessage, job: Message) => void
}

const buildJobEditor = (job: Message, info: JobInfo, ctx: Context) => {
    return <JobEditor
        job={job}
        onChange={ctx.onJobChange}
        schema={info.schema}
        init={info.init.job}
    />
}

const jobInfos : JobInfo[] = [
    {
        type: 'Script',
        schema: ScriptConfigSchema,
        init: {
            job: create(ScriptConfigSchema, {
                Source: [
                    "#!/bin/bash",
                    "echo 'hello yarl'",
                ],
            }),
            input: [],
            output: [],
        },
    },
    {
        type: 'Daemon',
        schema: DaemonConfigSchema,
        init: {
            job: create(DaemonConfigSchema, {
                Run: "",
                Status: "",
                Shutdown: "",
            }),
            input: ['prepare'],
            output: ['info'],
        },
    },
    {
        type: 'DaemonMonitor',
        schema: DaemonMonitorConfigSchema,
        init: {
            job: create(DaemonMonitorConfigSchema, {}),
            input: ['info'],
            output: [],
        },
    },
    {
        type: 'File',
        schema: FileConfigSchema,
        init: {
            job: create(FileConfigSchema, {}),
            input: [],
            output: ['file'],
        },
    },
]

export function buildDefaultConfig(Position: Position) {
    const info = jobInfos[0]
    return create(NodeConfigSchema, {
        Name: "",
        Job: anyPack(info.schema, info.init.job),
        Inputs: info.init.input,
        Outputs: info.init.output,
        Position,
    })
}

export default ({ nodes, setNodes } : { nodes: Node[], setNodes: (value: React.SetStateAction<Node[]>) => void }) => {
    const onJobTypeSelected = useCallback(
        (jobType: string) => setNodes(
            (nds) => {
                const info = jobInfos.find(info => info.type == jobType) as JobInfo
                const selectedNode = nds.find((nd) => nd.selected) as Node
                const editedConfig = {
                    ...selectedNode.data.config,
                    Job: anyPack(info.schema, info.init.job),
                    Inputs: info.init.input,
                    Outputs: info.init.output,
                }
                const editedNode = buildNode(editedConfig, selectedNode.data.state, true)
                client.node.edit(editedConfig)
                return applyNodeChanges([{id: selectedNode.id, item: editedNode, type: 'replace'}], nds)
            }
        ),
        [setNodes],
    )

    const onNameChange : React.ChangeEventHandler<HTMLInputElement> = useCallback(
        (evt) => setNodes(
            (nds: Node[]) => (
                nds.map(
                    (nd) => {
                        if (!nd.selected) {
                            return nd
                        }
                        var config : NodeConfig = nd.data.config
                        config.Name = evt.target.value
                        client.node.edit(config)
                        return {...nd, data: { ...nd.data, config } }
                    }
                )
            )
        ),
        [setNodes],
    )

    const patchConfigOfSelected = (configPatch: MessageInitShape<GenMessage<NodeConfig>>) => setNodes(
        (nds: Node[]) => nds.map((nd) => {
            if (!nd.selected) {
                return nd
            }
            const editedConfig = { ...nd.data.config, ...configPatch } as NodeConfig
            client.node.edit(editedConfig)
            return buildNode(editedConfig, nd.data.state, true)
        })
    )

    const onJobChange = useCallback(
        (schema: DescMessage, job: Message) => patchConfigOfSelected({ Job: anyPack(schema, job) }),
        [setNodes],
    )

    const selectedNodes = nodes.filter((nd) => nd.selected)

    if (selectedNodes.length != 1) {
        return <aside>
            <Input
                id="Node.Name"
                disabled
                style={{ fontSize: 20 }}
                className='grid w-full items-center gap-3 -border file:font-medium NodeName'
                value={"Select a node"}
            />
            <Separator/>
        </aside>
    }

    const selectedNode = selectedNodes[0]
    const config: NodeConfig = selectedNode.data.config
    const job = config.Job as Any
    const jobType = extractJobType(job.typeUrl)
    const jobInfo = jobInfos.find(info => info.type == jobType) as JobInfo
    const jobMsg = fromBinary(jobInfo.schema, job.value)
    const jobEditor = buildJobEditor(jobMsg, jobInfo, { onJobChange, })

    return <aside>
        <Input
            id="Node.Name"
            onChange={onNameChange}
            placeholder={`Node ${config.Id}`}
            value={config.Name}
            style={{ fontSize: 20 }}
            className='grid w-full items-center gap-3 -border file:font-medium NodeName'
        />

        <Separator/>

        <Accordion
            type="multiple"
            defaultValue={new Cookies().get('sidebar-accordion')}
            onValueChange={(values) => new Cookies().set('sidebar-accordion', values)}
        >
            <AccordionItem value="io">
                <AccordionTrigger>IO</AccordionTrigger>
                <AccordionContent>
                    <Accordion
                        type="multiple"
                        defaultValue={new Cookies().get('io-accordion')}
                        onValueChange={(values) => new Cookies().set('io-accordion', values)}
                        style={{ paddingLeft: 10, paddingRight: 10 }}
                    >
                        <AccordionItem value="i">
                            <AccordionTrigger>Input</AccordionTrigger>
                            <AccordionContent>
                                <Io
                                    files={selectedNode.data.config.Inputs}
                                    setFiles={fs => patchConfigOfSelected({ Inputs: fs })}
                                    />
                            </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="o">
                            <AccordionTrigger>Output</AccordionTrigger>
                            <AccordionContent>
                                <Io
                                    files={selectedNode.data.config.Outputs}
                                    setFiles={fs => patchConfigOfSelected({ Outputs: fs })}
                                />
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="editor">
                <AccordionTrigger>Editor</AccordionTrigger>
                <AccordionContent>
                    <Select value={jobType} onValueChange={onJobTypeSelected}>
                        <SelectTrigger className="w-full" style={{marginBottom: 10}}>
                            <SelectValue/>
                        </SelectTrigger>
                        <SelectContent>
                            {jobInfos.map(info => <SelectItem key={info.type} value={info.type} disabled={info.disabled}>{info.type}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {jobEditor}
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="arts">
                <AccordionTrigger>Artifacts</AccordionTrigger>
                <AccordionContent>
                    <Artifacts selectedNode={selectedNode} />
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    </aside>
};
