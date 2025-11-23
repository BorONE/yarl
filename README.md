# YaRL

> Yet another Local Runner

## How to run

You can run full app in docker or run locally each component separetly.

```shell
docker compose build
docker compose up
```

---

#### Backend
Install [go](https://go.dev/doc/install), then you can install dependencies, build and run via:
```shell
cd backend
go run cmd/server/main.go
```

#### Frontend
Install [nvm](https://github.com/nvm-sh/nvm), then install dependencies and run:
```shell
cd frontend
npm install # dependencies
npm run preview
```

#### Envoy
Install [envoy](https://www.envoyproxy.io/docs/envoy/latest/start/install) and just run:
```shell
envoy -c envoy.yaml
```

### Protobuf (codegen)
- go: https://protobuf.dev/getting-started/gotutorial/
- js/ts: https://www.npmjs.com/package/@connectrpc/protoc-gen-connect-es
- autogen on save: https://marketplace.visualstudio.com/items/?itemName=emeraldwalk.RunOnSave
  (see .vscode/settings.json)
