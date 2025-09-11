import Button from "react-bootstrap/esm/Button"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"

function pop<T>(arr: T[], i: number) : T[] {
    return [...arr.slice(undefined, i), ...arr.slice(i + 1, undefined)]
}

function replace<T>(arr: T[], i: number, value: T) : T[] {
    return [...arr.slice(undefined, i), value, ...arr.slice(i + 1, undefined)]
}

export default ({ files, setFiles } : { files: string[], setFiles: (files: string[]) => void }) => {
    return <>
        {
            files.map(
                (file, i) => <div style={{ display: "flex" }}>
                    <Input
                        value={file}
                        onChange={change => { setFiles(replace(files, i, change.target.value)) }}
                        />
                    <Button
                        className="border"
                        onClick={ _ => setFiles(pop(files, i)) }
                        style={{paddingLeft: 10, paddingRight: 10}}
                    > Remove </Button>
                </div>
            )
        }
        <Button
            className="w-full border"
            style={{padding: 5}}
            onClick={() => setFiles([...files, ""])}
        > Add </Button>
    </>
}