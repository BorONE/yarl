#!/bin/python3

import hashlib
import os
import socket
import subprocess
import sys
import yaml

from pathlib import Path


def consistent_hash(key):
    hash_object = hashlib.sha256(key.encode())
    hash_digest = hash_object.hexdigest()
    return int(hash_digest, 16)


def find_free_port(label=''):
    init_port = 1030 + consistent_hash(os.getlogin() + label) % 870 * 10
    for port in range(init_port, 2**16):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            res = sock.connect_ex(('localhost', port))
            if res != 0:
                return port
    assert False, 'could not find free port'


class Docker():
    def check(self):
        subprocess.run('docker --help > /dev/null', shell=True, check=True)

    def install(self):
        subprocess.run('sudo ./install_docker.sh', shell=True, check=True)

    def compose_up(self):
        subprocess.run('sudo docker compose up --detach', shell=True, check=True)

    def compose_down(self):
        subprocess.run('sudo docker compose down', shell=True, check=True)


class Yarl():
    def __init__(self):
        self.docker = Docker()

    def _patch_config(self, path: Path, patches: dict):
        with open(path, 'r') as file:
            config = yaml.safe_load(file)

        for key, value in patches.items():
            local_config = config
            for field in key[:-1]:
                local_config = local_config[field]
            local_config[key[-1]] = value

        with open(path, 'w') as file:
            yaml.dump(config, file)

    def run(self, local_port=8000, local=False):
        backend_port = find_free_port('yarl-backend')
        proxy_port = 8080 if local else find_free_port('yarl-proxy')
        frontend_port = 8000 if local else find_free_port('yarl-frontend')
        
        self._patch_config('envoy.yaml', {
            ('static_resources', 'clusters', 0, 'load_assignment', 'endpoints', 0, 'lb_endpoints', 0, 'endpoint', 'address', 'socket_address'): {
                'address': 'host.docker.internal',
                'port_value': backend_port,
            }
        })

        self._patch_config('compose.yaml', {
            ('services', 'frontend', 'ports'): [
                f'{frontend_port}:80'
            ],
            ('services', 'envoy', 'ports'): [
                f'{proxy_port}:8080'
            ],
        })

        self.docker.compose_up()

        if local:
            self.msg(f'connect to http://localhost:{local_port}')
        else:
            self.msg('forward ports on your local machine via')
            print(f'  ssh -L {local_port}:localhost:{frontend_port} -L 8080:localhost:{proxy_port} {socket.getfqdn()}')
            self.msg(f'then connect to http://localhost:{local_port}')

        try:
            subprocess.run(f'go run cmd/server/main.go --port {backend_port}', shell=True, cwd='backend')
        except KeyboardInterrupt:
            pass

        self.docker.compose_down()

    def msg(self, text):
        print('\033[0;1m' + text + '\033[0m')


def main():
    args = sys.argv[1:]
    if len(args) != 1 or args[0] not in {'local', 'remote'}:
        print('usage:')
        print(f'  {sys.argv[0]} local   -- to run on default ports')
        print(f'  {sys.argv[0]} remote  -- to find free ports')
        exit(len(args) == 0)
    
    yarl = Yarl()
    yarl.run(local=args[0] == 'local')


if __name__ == '__main__':
    main()
