# TODO Comeup with name

## Prerequsites

- [install protobuf compiler](https://protobuf.dev/getting-started/gotutorial/)
- You can install Run On Save and automatically generate code (see .vscode/settings.json)
- To run the app you need to run:
  - frontend
    ```
    (cd fts; npm run dev)
    ```
  - backend
    ```
    go run cmd/server/main.go
    ```
  - proxy
    ```
    envoy -c envoy
    ```
