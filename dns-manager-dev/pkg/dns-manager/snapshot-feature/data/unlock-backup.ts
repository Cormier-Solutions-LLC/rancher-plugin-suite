import { createApp } from 'vue';
import BackupPassword from '../pages/BackupPassword.vue';
export function askBackupPassword(): Promise<string> {
  return new Promise((resolve, reject) => {
    const node = document.createElement('div'); document.body.appendChild(node);
    const done = (password?: string) => { app.unmount(); node.remove(); password ? resolve(password) : reject(new Error('Backup unlock cancelled.')); };
    const app = createApp(BackupPassword, { open: true, unlock: true, onConfirm: done, onCancel: () => done() }); app.mount(node);
  });
}

export function askSnapshotOptions(requireSecrets = false, signal?: AbortSignal): Promise<{includeSecrets:boolean,password:string}> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Snapshot cancelled.'));
    const node = document.createElement('div'); document.body.appendChild(node);
    let settled = false;
    const done = (value?: {includeSecrets:boolean,password:string}) => {
      if (settled) return; settled = true; signal?.removeEventListener('abort', cancel);
      app.unmount(); node.remove(); value ? resolve(value) : reject(new Error('Snapshot cancelled.'));
    };
    const cancel = () => done();
    const app = createApp(BackupPassword, {open:true,capture:true,requireSecrets,onConfirm:done,onCancel:cancel});
    signal?.addEventListener('abort',cancel,{once:true}); app.mount(node);
  });
}

