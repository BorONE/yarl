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
	"pipegraph/server/api"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/encoding/prototext"
)

var (
	cmd  = flag.String("cmd", "", "")
	node = flag.Bool("node", false, "")
	id   = flag.Uint64("id", 0, "")
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
	nodeClient := api.NewNodeClient(conn)

	// Contact the server and print out its response.
	ctx, cancel := context.WithTimeout(context.Background(), time.Second*5)
	defer cancel()

	switch *cmd {
	case "config":
		info, err := graphClient.GetConfig(ctx, &api.Nothing{})
		if err != nil {
			log.Fatalf("could not get info: %v", err)
		}
		log.Println(prototext.Format(info))
	case "state":
		state, err := graphClient.GetState(ctx, &api.Nothing{})
		if err != nil {
			log.Fatalf("could not get state: %v", err)
		}
		log.Println(prototext.Format(state))
	case "run":
		if id != nil {
			_, err = nodeClient.Run(ctx, &api.NodeIdentifier{Id: id})
			if err != nil {
				log.Fatalf("could not run: %v", err)
			}
		} else {
			_, err = graphClient.Run(ctx, &api.Nothing{})
			if err != nil {
				log.Fatalf("could not run: %v", err)
			}
		}
	case "arts":
		artifacts, err := nodeClient.GetArtifacts(ctx, &api.NodeIdentifier{Id: id})
		if err != nil {
			log.Fatalf("could not get artifacts: %v", err)
		}
		log.Printf("arts:\n%v", prototext.Format(artifacts))
	case "reset":
		_, err := nodeClient.Reset(ctx, &api.NodeIdentifier{Id: id})
		if err != nil {
			log.Fatalf("could not reste: %v", err)
		}
	default:
		log.Fatalf("invalid case %s", *cmd)
	}
}
