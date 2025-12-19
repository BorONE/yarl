# YaRL

> Yet another Local Runner

https://github.com/user-attachments/assets/7d87052f-6e47-434f-ac76-b0786f05db83

## How to run

YaRL consists of two main components: a web interface (frontend) and a runner (backend). We recommend running the frontend on your local machine. The backend can be run on your local machine or a remote machine. 

### Frontend

First of all, make sure you have installed [Docker](https://docs.docker.com/engine/install/). Then use command below. This will start the web interface on port [8000](http://localhost:8000) (can be configured in compose.yml). The web interface will try to connect to port 9000 on your machine (can be configured in envoy.yaml).
```shell 
docker compose up --build --detach
```

### Backend

Just run binary
```shell
./yarl
```

---

If you want to specify port use `--port`, by default port is 9000
```shell
./yarl --port 9001
```

If you need to compile runner yourself, install [go](https://go.dev/doc/install), then run 
```shell
cd backend
go build -o yarl cmd/server/main.go
```

If you use remote machine, copy runner and connect to the remote and forward ports via ssh
```shell
scp yarl $remote:~/yarl
ssh -L 0.0.0.0:9000:localhost:9000 $remote
```

Once you connected to the remote, use `nohup` or `tmux` to keep YaRL running even after you disconnect
```shell
if [ "$TERM" = "screen" ] && [ -n "$TMUX" ]; then
  ~/yarl # we are inside tmux, so just run
else
  nohup ~/yarl & # use nohup to run in bg
fi
```

To reconnect just use command below again
```shell
ssh -L 0.0.0.0:9000:localhost:9000 $remote
```

### Protobuf (codegen)
- go: https://protobuf.dev/getting-started/gotutorial/
- js/ts: https://www.npmjs.com/package/@connectrpc/protoc-gen-connect-es
- autogen on save: https://marketplace.visualstudio.com/items/?itemName=emeraldwalk.RunOnSave
  (see .vscode/settings.json)
