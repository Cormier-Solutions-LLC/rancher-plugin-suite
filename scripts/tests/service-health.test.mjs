import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectApplicationHealth } from '../lib/service-health.mjs';

test('accepts a fully healthy Harbor response', () => {
  assert.deepEqual(
    inspectApplicationHealth('harbor.cormierconsulting.io', JSON.stringify({
      status: 'healthy',
      components: [{ name: 'registry', status: 'healthy' }],
    })),
    { applicationHealthy: true, applicationStatus: 'healthy', unhealthyComponents: [] },
  );
});

test('rejects Harbor HTTP 200 payloads with unhealthy components', () => {
  assert.deepEqual(
    inspectApplicationHealth('harbor.cormierconsulting.io', JSON.stringify({
      status: 'unhealthy',
      components: [
        { name: 'core', status: 'healthy' },
        { name: 'registry', status: 'unhealthy' },
        { name: 'registryctl', status: 'unhealthy' },
      ],
    })),
    {
      applicationHealthy: false,
      applicationStatus: 'unhealthy',
      unhealthyComponents: ['registry', 'registryctl'],
    },
  );
});

test('rejects an invalid Harbor health payload', () => {
  assert.deepEqual(
    inspectApplicationHealth('harbor.cormierconsulting.io', '<html>not health json</html>'),
    {
      applicationHealthy: false,
      applicationStatus: 'invalid',
      unhealthyComponents: ['health payload'],
    },
  );
});
