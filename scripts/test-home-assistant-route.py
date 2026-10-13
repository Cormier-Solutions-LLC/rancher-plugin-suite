"""Authenticated, read-only Home Assistant acceptance through the cluster route."""
import collections
import concurrent.futures
import datetime
import json
import os
import pathlib
import socket
import urllib.error
import urllib.request

import websocket

ROOT = pathlib.Path('.local/manager-installation')
ROUTE = 'https://home-assistant.cormierconsulting.io'
TOKEN = os.environ['HA_TOKEN']


def rest(base, path, authenticated=True):
    headers = {'Authorization': 'Bearer ' + TOKEN} if authenticated else {}
    with urllib.request.urlopen(urllib.request.Request(base.rstrip('/') + path, headers=headers), timeout=20) as response:
        return json.load(response)


def ws_read(base, invalid=False):
    url = ('wss://' if base.startswith('https://') else 'ws://') + base.split('://', 1)[1].rstrip('/') + '/api/websocket'
    connection = websocket.create_connection(url, timeout=20)
    try:
        assert json.loads(connection.recv())['type'] == 'auth_required'
        connection.send(json.dumps({'type': 'auth', 'access_token': 'manager-acceptance-invalid-token' if invalid else TOKEN}))
        auth = json.loads(connection.recv())
        if invalid:
            assert auth['type'] == 'auth_invalid'
            return {'invalidTokenRejected': True}
        assert auth['type'] == 'auth_ok'
        results = {}
        for request_id, command in enumerate(['ping', 'get_config', 'get_states', 'get_services', 'config/entity_registry/list', 'config_entries/get'], 1):
            connection.send(json.dumps({'id': request_id, 'type': command}))
            while True:
                response = json.loads(connection.recv())
                if response.get('id') == request_id:
                    break
            if command == 'ping':
                assert response['type'] == 'pong'
                results[command] = True
            else:
                assert response.get('success'), command
                results[command] = response['result']
        return results
    finally:
        connection.close()


def probe(target):
    host, port = target
    try:
        with socket.create_connection((host, port), timeout=4):
            return {'host': host, 'port': port, 'connected': True}
    except OSError as error:
        return {'host': host, 'port': port, 'connected': False, 'errorType': type(error).__name__}


local = ws_read(ROUTE)
cloud = ws_read(os.environ['HA_URL'])
assert {entry['entity_id'] for entry in local['config/entity_registry/list']} == {entry['entity_id'] for entry in cloud['config/entity_registry/list']}
assert {entry['entry_id'] for entry in local['config_entries/get']} == {entry['entry_id'] for entry in cloud['config_entries/get']}
assert local['get_config']['version'] == cloud['get_config']['version']
assert rest(ROUTE, '/api/')['message'] == 'API running.'
try:
    rest(ROUTE, '/api/', False)
    raise AssertionError('Anonymous REST access unexpectedly succeeded')
except urllib.error.HTTPError as error:
    assert error.code == 401
assert ws_read(ROUTE, True)['invalidTokenRejected']
entries = local['config_entries/get']
retry = [entry for entry in entries if entry['state'] == 'setup_retry']
targets = [('10.99.11.1', 80), ('10.99.0.16', 80), ('10.99.0.16', 8123), ('10.99.0.28', 80), ('10.99.0.49', 5555)]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:
    probes = list(pool.map(probe, targets))
report = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'route': ROUTE,
          'strictTls': True, 'authenticatedRest': True, 'authenticatedWebSocketCommands': 6,
          'pingPong': True, 'cloudAndClusterRegistryIdentityMatch': True,
          'anonymousRestRejected401': True, 'invalidWebSocketTokenRejected': True,
          'version': local['get_config']['version'], 'states': len(local['get_states']),
          'registeredEntities': len(local['config/entity_registry/list']), 'serviceDomains': len(local['get_services']),
          'entryStates': dict(collections.Counter(entry['state'] for entry in entries)),
          'retryDomains': dict(collections.Counter(entry['domain'] for entry in retry)),
          'unavailableStates': sum(entry['state'] == 'unavailable' for entry in local['get_states']),
          'deviceConnectivityProbesFromWorkstation': probes, 'resourceWrites': 0,
          'clusterRoutePassed': True, 'allDeviceIntegrationsPassed': not retry}
ROOT.joinpath('home-assistant-route-tests.json').write_text(json.dumps(report, indent=2))
print(json.dumps(report))
