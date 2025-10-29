// /*
//  *
//  * Copyright 2015 gRPC authors.
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *     http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  *
//  */

// // Package main implements a client for Greeter service.
// package main

// import (
// 	"context"
// 	"flag"
// 	"log"
// 	"pipegraph/internal/api"
// 	"pipegraph/internal/graph"
// 	_ "pipegraph/internal/job/register"
// 	"time"

// 	"google.golang.org/grpc"
// 	"google.golang.org/grpc/credentials/insecure"
// 	"google.golang.org/protobuf/encoding/prototext"
// )

// var (
// 	cmd  = flag.String("cmd", "", "")
// 	id   = flag.Uint64("id", 0, "")
// 	id2  = flag.Uint64("id2", 0, "")
// 	path = flag.String("path", "", "")

// 	nodeConfigText = flag.String("node-config", "", "")
// )

// func main() {
// 	flag.Parse()

// 	nodeConfig := graph.NodeConfig{}
// 	err := prototext.Unmarshal([]byte(*nodeConfigText), &nodeConfig)
// 	if err != nil {
// 		log.Fatalf("failed to parse node config: text=%v err=%v", *nodeConfigText, err)
// 	}

// 	// Set up a connection to the server.
// 	conn, err := grpc.NewClient(":9000", grpc.WithTransportCredentials(insecure.NewCredentials()))
// 	if err != nil {
// 		log.Fatalf("did not connect: %v", err)
// 	}
// 	defer conn.Close()

// 	graphClient := api.NewGraphClient(conn)
// 	nodeClient := api.NewNodeClient(conn)

// 	// Contact the server and print out its response.
// 	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
// 	defer cancel()

// 	switch *cmd {
// 	case "new":
// 		msg, err := graphClient.New(ctx, &api.Nothing{})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	case "save":
// 		msg, err := graphClient.Save(ctx, &api.Path{Path: path})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	case "load":
// 		msg, err := graphClient.Load(ctx, &api.Path{Path: path})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	case "config":
// 		config, err := graphClient.GetConfig(ctx, &api.Nothing{})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(config))
// 	case "state":
// 		state, err := graphClient.CollectState(ctx, &api.Nothing{})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(state))
// 	case "run-ready":
// 		id, err := graphClient.RunReadyNode(ctx, &api.Nothing{})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		if id.Id == nil {
// 			log.Print("nothing to run")
// 		} else {
// 			log.Print(prototext.Format(id))
// 		}
// 	case "wait":
// 		updates, err := nodeClient.WaitDone(ctx, &api.NodeIdentifier{Id: id})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(updates))
// 	case "connect":
// 		updates, err := graphClient.Connect(ctx, &graph.EdgeConfig{FromNodeId: id, ToNodeId: id2})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(updates))
// 	case "disconnect":
// 		updates, err := graphClient.Disconnect(ctx, &graph.EdgeConfig{FromNodeId: id, ToNodeId: id2})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(updates))
// 	case "stop":
// 		msg, err := nodeClient.Stop(ctx, &api.NodeIdentifier{Id: id})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	case "reset":
// 		updates, err := nodeClient.Reset(ctx, &api.NodeIdentifier{Id: id})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(updates))
// 	case "add":
// 		msg, err := nodeClient.Add(ctx, &nodeConfig)
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	case "edit":
// 		_, err := nodeClient.Edit(ctx, &nodeConfig)
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 	case "delete":
// 		msg, err := nodeClient.Delete(ctx, &api.NodeIdentifier{Id: id})
// 		if err != nil {
// 			log.Fatal(err.Error())
// 		}
// 		log.Print(prototext.Format(msg))
// 	default:
// 		log.Fatalf("invalid case %s", *cmd)
// 	}
// }
