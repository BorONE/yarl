# YaRL

> Yet another Local Runner

https://github.com/user-attachments/assets/7d87052f-6e47-434f-ac76-b0786f05db83

## How to run

### Prerequisites

- Docker: https://docs.docker.com/engine/install/ubuntu/
- Go: https://go.dev/doc/install

### Script

Run script either locally or remotely:
```bash
./run.py local  # will run on default ports
./run.py remote # will run on free ports and hint what ports to forward
```

### Protobuf (codegen)
- go: https://protobuf.dev/getting-started/gotutorial/
- js/ts: https://www.npmjs.com/package/@connectrpc/protoc-gen-connect-es
- autogen on save: https://marketplace.visualstudio.com/items/?itemName=emeraldwalk.RunOnSave
  (see .vscode/settings.json)
