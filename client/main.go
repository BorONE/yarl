/*
 *
 * Copyright 2015 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

// Package main implements a client for Greeter service.
package main

import (
	"context"
	"flag"
	"log"
	"pipegraph/api"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/encoding/prototext"
)

var (
	cmd = flag.String("cmd", "", "")
	id  = flag.Uint64("id", 0, "")
)

func main() {
	flag.Parse()

	// Set up a connection to the server.
	conn, err := grpc.NewClient(":9000", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("did not connect: %v", err)
	}
	defer conn.Close()

	graphClient := api.NewGraphClient(conn)

	// Contact the server and print out its response.
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	switch *cmd {
	case "state":
		state, err := graphClient.GetGlobalState(ctx, &api.Nothing{})
		if err != nil {
			log.Fatal(err.Error())
		}
		log.Print(prototext.Format(state))
	case "run-ready":
		id, err := graphClient.RunReadyNode(ctx, &api.Nothing{})
		if err != nil {
			log.Fatal(err.Error())
		}
		if id.Id == nil {
			log.Print("nothing to run")
		} else {
			log.Print(prototext.Format(id))
		}
	case "wait":
		updates, err := graphClient.WaitRunEnd(ctx, &api.NodeIdentifier{Id: id})
		if err != nil {
			log.Fatal(err.Error())
		}
		log.Print(prototext.Format(updates))
	default:
		log.Fatalf("invalid case %s", *cmd)
	}
}
