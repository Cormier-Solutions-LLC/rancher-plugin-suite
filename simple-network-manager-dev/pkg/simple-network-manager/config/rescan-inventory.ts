import { boundedRead } from './bounded-read.mjs';

export async function rescanInventory(source: any, preview: boolean, update: (inventory: any) => void, scan: () => { services: number; added: number }) {
  if (!preview) {
    if (source?.kind !== 'rancher') throw new Error('Live discovery is unavailable. Wait for the current Rancher connection.');
    const document = await boundedRead((signal: AbortSignal) => source.reload({ signal }));
    if (!document?.data?.inventory) throw new Error('Live discovery returned no inventory.');
    update(document.data.inventory);
  }
  return { ...scan(), live: !preview };
}
