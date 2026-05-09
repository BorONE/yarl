import { useEffect, useState } from "react"
import * as client from "./client"
import type { Node } from "./JobNode";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { Label } from "./components/ui/label";

export default ({ selectedNode } : { selectedNode: Node }) => {
    useEffect(() => {
        update();
    }, [selectedNode, selectedNode.data.state]);

    const initLaunches : string[] = []
    const [launches, setLaunches] = useState(initLaunches)

    const initSelectedLaunch : string = ""
    const [selectedLaunch, setSelectedLaunch] = useState(initSelectedLaunch)
    
    const id = selectedNode.data.id

    const update = async () => {
        const msg = await client.node.getLaunches({ Id: id })
        setLaunches(msg.Launches)
        setSelectedLaunch(msg.SelectedLaunch)
    }
    
    const choose = (launch: string) => async () => {
        await client.node.chooseLaunch({ Id: id, Launch: launch })
        update()
    }

    switch (selectedNode.data.state.State.case) {
    case "Idle":
        return <em>
            Skip to choose launch
        </em>
    case "InProgress":
        return <em>
            Runnning node...
        </em>
    case "Done":
        break;
    }

    return <>
        <RadioGroup value={selectedLaunch}>
        {
            launches.map(
                launch => (
                    <div key={launch} className="flex items-center gap-3">
                        <RadioGroupItem id={launch} value={launch} onClick={choose(launch)} />
                        <Label htmlFor={launch}>{launch}</Label>
                    </div>
                )
            )
        }
        </RadioGroup>
    </>
}