# TODO Comeup with name

## Prerequsites

- [install protobuf compiler](https://protobuf.dev/getting-started/gotutorial/)
- You can install Run On Save and automatically generate code
```
    "emeraldwalk.runonsave": {
      "commands": [
        {
          // match .proto-files
          "match": ".*\\.proto",
          // `. ~/.zshrc` -- add path to compiler to PATH
          "cmd": ". ~/.zshrc; protoc -I${fileDirname} --go_out=${fileDirname} ${file}",
        }
      ]
    },
```
- You can protect generated code from editing
```
    "files.readonlyInclude": {
      "**/*.pb.go": true
    }
```
