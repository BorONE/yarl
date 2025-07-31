import { createClient } from "@connectrpc/connect";
import { createGrpcWebTransport } from "@connectrpc/connect-web";

import * as api from './gen/internal/api/api_pb'

const transport = createGrpcWebTransport({
  baseUrl: "http://localhost:8080",
});

console.log('client init')

export const graph = createClient(api.Graph, transport)
export const node = createClient(api.Node, transport)
