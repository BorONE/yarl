import { create, type DescMessage, type Message } from "@bufbuild/protobuf"
import { FieldDescriptorProto_Type } from "@bufbuild/protobuf/wkt"
import { Input } from "./components/ui/input"
import { Label } from "./components/ui/label"
import { useRef } from "react"
import { Textarea } from "./components/ui/textarea"

export default ({
    job,
    schema,
    init,
    onChange,
}: {
    job: Message
    schema: DescMessage,
    init: Message,
    onChange: (schema: DescMessage, job: Message) => void,
}) => {
    const refs = schema.fields.map(field => ({
        name: field.name,
        ref: useRef(null),
        field: field
    }))

    const onFieldChange = () => {
        var job = create(schema, {})
        refs.forEach(ref => {
            const field = ref.field
            switch (field.proto.type) {
            case FieldDescriptorProto_Type.STRING:
                switch (field.fieldKind) {
                case "scalar":
                    job[ref.name] = ref.ref.current.value
                    break
                case "list":
                    job[ref.name] = ref.ref.current.value.split('\n')
                    break
                }
            }
            
            
        })
        onChange(schema, job)
    }

    return <>{
        schema.fields.map(field => {
            const id = `${schema.name}.${field.name}`
            const props : any = {
                id: id,
                ref: refs.find(ref => ref.name == field.name)?.ref,
                onChange: onFieldChange,
                placeholder: init[field.name],
                defaultValue: job[field.name],
                style: { fontFamily: "monospace" },
                className: "no-shadow",
            }

            var input

            switch (field.proto.type) {
            case FieldDescriptorProto_Type.STRING:
                switch (field.fieldKind) {
                case "scalar":
                    input = <Input {...props}/>
                    break
                case "list":
                    props.rows = props.defaultValue.length
                    props.defaultValue = props.defaultValue.join('\n')
                    input = <Textarea {...props}/>
                    break
                }
            }
            
            return <div key={id} className="grid w-full items-center gap-3" style={{ marginBottom: 10 }}>
                <Label htmlFor={id}>{field.name}</Label>
                {input}
            </div>
        })
    }</>
}
