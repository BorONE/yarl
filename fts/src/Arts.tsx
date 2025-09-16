import { useRef, useState } from "react"
import * as client from "./client"
import { Textarea } from "@/components/ui/textarea"
import { Label } from './components/ui/label';
import type { NodeState } from "./gen/internal/graph/config_pb";
import type { Node } from "./JobNode";


function AreArtsEqual(a: {[key: string]: string}, b: {[key: string]: string}) {
    return Object.keys(a).length == Object.keys(b).length && Object.keys(a)
        .map(key => key in b && a[key] == b[key])
        .reduce((r, x) => r && x, true)
}

function timeout(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const renderStream = (key: string, value: string) => {
    return <div className="grid w-full gap-3" style={{padding: 5}}>
        <Label htmlFor={key}>{key}</Label>
        <Textarea id={key} readOnly={true} value={value} style={{fontFamily: "monospace"}} wrap="off" />
    </div>
}

const getToday = () => {
    var [m, d, y] = new Date().toLocaleDateString().split('/')
    m = m.length == 1 ? '0' + m : m;
    d = d.length == 1 ? '0' + d : d;
    return `${y}-${m}-${d}`
}

const renderTime = (key: string, value: string) => {
    const datetime = value.split('.')[0]
    const [date, time] = datetime.split(' ')
    const valueToDisplay = date == getToday() ? time : datetime
    return <div style={{color: "#747474"}}>
        {key}: {valueToDisplay}
    </div>
}

export default ({ selectedNode } : { selectedNode: Node }) => {
    const initArts : {[key: string]: string} = {}
    const [arts, setArts] = useState(initArts)

    const [_forceUpdate, setForceUpdate] = useState({})
    const alreadyUpdatingRef = useRef(false)
    const delayForceUpdate = async (value: { delayMs: number; }) => {
        if (alreadyUpdatingRef.current) {
            return
        }
        alreadyUpdatingRef.current = true
        await timeout(value.delayMs)
        setForceUpdate({})
        alreadyUpdatingRef.current = false
    }

    const update = async () => {
        const msg = await client.node.collectArts({Id: selectedNode.data.id})
        if (!AreArtsEqual(arts, msg.Arts)) {
            setArts(msg.Arts)
        }

        const state : NodeState = selectedNode.data.state
        if (state.State.case == 'InProgress') {
            delayForceUpdate({ delayMs: 1000 })
        }
    }

    update()

    const content = [
        "started_at" in arts ? renderTime("started", arts.started_at) : undefined,
        "finished_at" in arts ? renderTime("finished", arts.finished_at) : undefined,
        "stdout" in arts ? renderStream("stdout", arts.stdout) : undefined,
        "stderr" in arts ? renderStream("stderr", arts.stderr) : undefined,
    ].filter((el) => typeof el != "undefined")

    return <>{content.map((item, i) => <div key={i}>{item}</div>)}</>
}