"""Own temporary Redis sessions and verify real gateway HTTPS/WSS workflows."""
import datetime
import json
import pathlib
import secrets
import subprocess
import time
import urllib.error
import urllib.request
import uuid

import websocket

KUBECTL = 'C:/Program Files/Docker/Docker/resources/bin/kubectl.exe'
ROOT = pathlib.Path('.local/manager-installation')
ORIGIN = 'https://gateway.cormierconsulting.io'
WS_URL = 'wss://gateway.cormierconsulting.io/realtime/ws'
PREFIX = 'cormier:realtime:prod'
NS = 'prod-realtime'
nonce = uuid.uuid4().hex
topic = 'manager_acceptance_' + nonce
tenant = 'manager_acceptance_' + nonce
user = 'manager_acceptance_user'
sessions = []
tickets = []
connections = []
started = time.monotonic()


def redis(pod, *args):
    command = [KUBECTL, '-n', NS, 'exec', pod, '-c', 'redis', '--', 'sh', '-c',
               'export REDISCLI_AUTH="$(cat "$REDIS_PASSWORD_FILE")"; exec /opt/bitnami/redis/bin/redis-cli --raw "$@"',
               'manager-acceptance', *args]
    result = subprocess.run(command, capture_output=True, text=True, timeout=15)
    if result.returncode or result.stdout.startswith(('ERR ', 'NOAUTH', 'WRONGPASS')):
        raise RuntimeError('Redis acceptance command failed; credentials remain private')
    return result.stdout.strip()


def request(cookie=None, origin=ORIGIN):
    headers = {'Origin': origin, 'Content-Type': 'application/json'}
    if cookie:
        headers['Cookie'] = 'cormier_session=' + cookie
    try:
        with urllib.request.urlopen(urllib.request.Request(ORIGIN + '/realtime/tickets', data=b'', headers=headers, method='POST'), timeout=15) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        return error.code, None


def envelope(kind, route=None, payload=None, correlation=None):
    return {'version': '1.0', 'type': kind, 'correlationId': correlation or uuid.uuid4().hex,
            'timestamp': datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'route': route or 'topics/' + topic, 'payload': payload or {}}


def receive(connection, correlation, kind):
    # Heartbeat messages can arrive between the command and its response.
    for _ in range(10):
        data = json.loads(connection.recv())
        if data.get('correlationId') == correlation and data.get('type') == kind:
            return data
    raise AssertionError('Expected correlated gateway response was not received')


def send(connection, message, kind='ack'):
    connection.send(json.dumps(message))
    return receive(connection, message['correlationId'], kind)


def connect(ticket, protocols=True):
    try:
        return websocket.create_connection(WS_URL + '?ticket=' + ticket, origin=ORIGIN,
                                           subprotocols=['cormier.realtime.v1'] if protocols else None, timeout=10)
    except websocket.WebSocketBadStatusException as error:
        return error.status_code


masters = [pod for pod in ['prod-realtime-redis-node-0', 'prod-realtime-redis-node-1', 'prod-realtime-redis-node-2']
           if redis(pod, 'ROLE').splitlines()[0] == 'master']
assert len(masters) == 1
master = masters[0]
report = None
try:
    assert request()[0] == 401
    assert request('manager-acceptance-invalid-session')[0] == 401
    same_tenant_clients = 6
    for session_tenant in [tenant] * same_tenant_clients + [tenant + '_other']:
        session = 'manager_acceptance_' + secrets.token_urlsafe(24)
        key = PREFIX + ':sessions:' + session
        record = {'tenantId': session_tenant, 'userId': user, 'allowedTopics': [topic],
                  'expiresAt': (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=5)).isoformat(),
                  'revoked': False}
        assert redis(master, 'EXISTS', key) == '0'
        assert redis(master, 'SET', key, json.dumps(record), 'EX', '300', 'NX') == 'OK'
        sessions.append((key, session, record))
        status, response = request(session)
        assert status == 200
        assert response['ticket']
        tickets.append(response['ticket'])
        connection = connect(response['ticket'])
        assert not isinstance(connection, int), 'Valid ticket was rejected'
        connections.append(connection)
        assert send(connection, envelope('subscribe'))['type'] == 'ack'
    assert connect(tickets[0]) == 401
    assert connect('manager_acceptance_invalid_ticket_0123456789') == 401
    assert request(sessions[0][1], 'https://invalid-origin.example')[0] == 401
    assert send(connections[1], envelope('ping'))['type'] == 'ack'
    print(json.dumps({'ticketsAndSubscriptionsVerified': len(connections), 'secondClientResponsiveBeforePublish': True,
                      'secondsUntilPublish': round(time.monotonic() - started, 2)}), flush=True)
    denied = send(connections[0], envelope('subscribe', 'topics/manager_unauthorized_' + nonce), 'error')
    assert denied['error']['code'] == 'unauthorized'
    denied_user = send(connections[0], envelope('subscribe', 'users/another-user/topics/' + topic), 'error')
    assert denied_user['error']['code'] == 'unauthorized'
    ping = envelope('ping')
    assert send(connections[0], ping)['type'] == 'ack'
    published = envelope('publish', payload={'syntheticAcceptance': nonce})
    # Read ack and event in either order on the publisher, then the second client.
    connections[0].send(json.dumps(published))
    received = {}
    for _ in range(10):
        data = json.loads(connections[0].recv())
        if data.get('correlationId') == published['correlationId']:
            received[data['type']] = data
        if 'ack' in received and 'event' in received:
            break
    assert set(received) >= {'ack', 'event'}
    assert received['event']['payload']['syntheticAcceptance'] == nonce
    second = receive(connections[1], published['correlationId'], 'event')
    assert second['payload']['syntheticAcceptance'] == nonce
    for connection in connections[2:same_tenant_clients]:
        assert receive(connection, published['correlationId'], 'event')['payload']['syntheticAcceptance'] == nonce
    # Rotate publishers to exercise publication from every connected gateway.
    publication_count = 30
    for number in range(publication_count):
        publisher_index = number % same_tenant_clients
        message = envelope('publish', payload={'syntheticAcceptance': nonce, 'sequence': number})
        connections[publisher_index].send(json.dumps(message))
        types = set()
        for _ in range(10):
            data = json.loads(connections[publisher_index].recv())
            if data.get('correlationId') == message['correlationId']:
                types.add(data['type'])
                if data['type'] == 'event':
                    assert data['payload']['sequence'] == number
            if types >= {'ack', 'event'}:
                break
        assert types >= {'ack', 'event'}
        for index, connection in enumerate(connections[:same_tenant_clients]):
            if index != publisher_index:
                assert receive(connection, message['correlationId'], 'event')['payload']['sequence'] == number
    connections[-1].settimeout(2)
    isolated = True
    try:
        while True:
            data = json.loads(connections[-1].recv())
            if data.get('type') == 'event':
                isolated = False
                break
    except websocket.WebSocketTimeoutException:
        pass
    assert isolated, 'A different tenant received the synthetic event'
    # Revoke the first session; the connected client must be rejected on its next command.
    key, session, record = sessions[0]
    record['revoked'] = True
    assert redis(master, 'SET', key, json.dumps(record), 'EX', '300', 'XX') == 'OK'
    assert request(session)[0] == 401
    connections[0].send(json.dumps(envelope('ping')))
    revoked = False
    try:
        for _ in range(10):
            raw = connections[0].recv()
            if not raw:
                revoked = True
                break
            data = json.loads(raw)
            if data.get('type') == 'error' and data.get('error', {}).get('code') == 'unauthorized':
                revoked = True
                break
    except websocket.WebSocketConnectionClosedException:
        revoked = True
    assert revoked, 'Connected session revocation was not enforced'
    report = {'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'strictTls': True, 'missingAndInvalidSessionsRejected401': True,
              'realTicketsIssued': len(tickets), 'authenticatedWebSockets': len(connections), 'ticketReplayRejected401': True,
              'invalidTicketRejected401': True, 'invalidOriginRejected401': True,
              'unauthorizedTopicAndOtherUserDenied': True, 'pingAcknowledged': True,
              'publishAckAndTwoSameTenantEventsVerified': True, 'otherTenantEventExcluded': True,
              'rotatingPublisherMessages': publication_count,
              'verifiedSameTenantDeliveries': (publication_count + 1) * same_tenant_clients,
              'liveSessionRevocationEnforced': True, 'productionTopicsChanged': False, 'passed': True}
finally:
    for connection in connections:
        connection.close()
    for key, _, _ in sessions:
        assert redis(master, 'DEL', key) in ['0', '1']
        assert redis(master, 'EXISTS', key) == '0'
    for ticket in tickets:
        key = PREFIX + ':tickets:' + ticket
        assert redis(master, 'DEL', key) in ['0', '1']
        assert redis(master, 'EXISTS', key) == '0'
    if report:
        report['ownedSessionsAndTicketsRemoved'] = True
        ROOT.joinpath('realtime-gateway-tests.json').write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    else:
        print(json.dumps({'ownedSessionsAndTicketsRemoved': True, 'passed': False}))
