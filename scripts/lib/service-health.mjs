export function inspectApplicationHealth(host, body) {
  if (host !== 'harbor.cormierconsulting.io') {
    return { applicationHealthy: true, applicationStatus: null, unhealthyComponents: [] };
  }

  try {
    const health = JSON.parse(body);
    const components = Array.isArray(health.components) ? health.components : [];
    const unhealthyComponents = components
      .filter(component => component?.status !== 'healthy')
      .map(component => component?.name || 'unknown');
    return {
      applicationHealthy: health.status === 'healthy' && unhealthyComponents.length === 0,
      applicationStatus: health.status || 'unknown',
      unhealthyComponents,
    };
  } catch {
    return {
      applicationHealthy: false,
      applicationStatus: 'invalid',
      unhealthyComponents: ['health payload'],
    };
  }
}
