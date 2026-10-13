const transport=mode=>mode==='UDP'?'UDP':'TCP';
export function validatePortLinks(ports){
 for(const source of ports){
  if(!source.action)continue;
  if(!['forward','redirect'].includes(source.action))throw new Error('Unknown port action.');
  const targets=ports.filter(port=>port.label===source.targetLabel);
  if(targets.length!==1)throw new Error(`Choose one uniquely labelled target port for ${source.label}. Targets cannot be ranges.`);
  const target=targets[0];if(target===source||target.action)throw new Error('Port links must point directly to a different destination without another link.');
  if(transport(source.mode)!==transport(target.mode))throw new Error('Forwarding cannot convert TCP to UDP or UDP to TCP.');
  if(source.action==='redirect'&&(source.mode!=='HTTP'||target.mode!=='HTTPS'))throw new Error('HTTP-to-HTTPS redirect requires an HTTP source and HTTPS destination. Choose their web behavior under TCP.');
  if(source.action==='forward'&&source.mode!==target.mode)throw new Error('Forwarding requires matching application behavior. Use HTTP-to-HTTPS redirect to switch from HTTP to HTTPS.');
 }
}
