// Framework-independent controls shared by every standalone preview.
export function mountPreviewDataEditor(client, { container, beforeEdit = () => true } = {}) {
  const controls = document.createElement('div');
  controls.className = 'suite-mock-controls';
  controls.innerHTML = '<button type="button">Mock Data</button><button type="button" data-export hidden>Download Unsaved Data</button><button type="button" data-reload hidden>Reload Source</button><span role="status" aria-live="polite"></span>';
  (container || document.body).append(controls);
  const status = controls.querySelector('span');
  const update = () => { status.textContent = client.status; status.className = client.error ? 'suite-mock-error' : ''; controls.querySelector('[data-export]').hidden = controls.querySelector('[data-reload]').hidden = !client.error; };
  client.subscribe(update); update();
  const style = document.createElement('style');
  style.textContent = `.suite-mock-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px;font:12px/1.4 sans-serif}.suite-mock-controls button,.suite-mock-dialog button,.suite-mock-dialog select{padding:8px 12px;border:1px solid #526478;border-radius:5px;background:#253449;color:#f3f6fa;cursor:pointer}.suite-mock-controls span{max-width:200px}.suite-mock-error{color:#ffb5b5}.suite-mock-dialog{width:min(1000px,90vw);height:min(760px,90vh);background:#19232e;color:#e4ebf2;border:1px solid #526478;border-radius:8px;padding:20px;font:14px/1.5 sans-serif}.suite-mock-dialog::backdrop{background:#0009}.suite-mock-dialog form{display:flex;flex-direction:column;height:100%;gap:12px}.suite-mock-dialog h2,.suite-mock-dialog p{margin:0}.suite-mock-heading{display:flex;justify-content:space-between;gap:12px;align-items:center}.suite-mock-dialog textarea{flex:1;min-height:0;resize:none;background:#111820;color:#e4ebf2;padding:12px;border:1px solid #526478;font:13px/1.5 Consolas,monospace}.suite-mock-dialog label{display:flex;gap:10px;align-items:center}.suite-mock-dialog .suite-mock-meta{font-size:12px;overflow-wrap:anywhere;color:#bac6d3}.suite-mock-dialog button:focus-visible,.suite-mock-dialog select:focus-visible,.suite-mock-dialog textarea:focus-visible{outline:2px solid #8dc7ff;outline-offset:2px}`;
  document.head.append(style);
  if (!client.capabilities.editableInventory) { controls.querySelector('button').hidden = true; return; }
  controls.querySelector('[data-export]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(client.document, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a'); link.href = url; link.download = `${client.pluginId}-unsaved-mock-data.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  controls.querySelector('[data-reload]').addEventListener('click', async () => {
    if (!confirm('Reload the project source and discard unsaved preview changes? Download Unsaved Data first if you want to keep them.')) return;
    try { await client.reload({ discardPending: true }); location.reload(); } catch (error) { status.textContent = error.message; }
  });
  let dialog;
  controls.querySelector('button').addEventListener('click', async () => {
    if (!beforeEdit()) return;
    try { await client.flush(); } catch { update(); return; }
    if (dialog?.open) return;
    dialog = document.createElement('dialog'); dialog.className = 'suite-mock-dialog';
    dialog.innerHTML = '<form><div class="suite-mock-heading"><h2>Project Mock Data</h2><div><button type="submit">Save And Reload</button> <button type="button" data-close>Cancel</button></div></div><p>Sample data only. Saving updates this project’s source file and reloads the preview.</p><div class="suite-mock-meta"></div><label>Dataset <select aria-label="Mock dataset"></select></label><textarea aria-label="Mock dataset JSON" spellcheck="false"></textarea><div class="suite-mock-error" role="alert"></div></form>';
    document.body.append(dialog);
    const original = client.document;
    const data = original.data;
    const datasets = [...Object.keys(data.inventory).map(key => ({ label: `Inventory · ${key}`, get: () => data.inventory[key], set: value => { data.inventory[key] = value; } })),
      { label: 'Saved preview state / drafts', get: () => data.state, set: value => { data.state = value; } }];
    const select = dialog.querySelector('select'), textarea = dialog.querySelector('textarea'), error = dialog.querySelector('[role=alert]');
    const meta = dialog.querySelector('.suite-mock-meta');
    meta.textContent = `${original.pluginId} · revision ${original.revision} · ${original.source.label} · ${original.source.projectFile}`;
    datasets.forEach((dataset, index) => select.add(new Option(dataset.label, String(index))));
    let index = 0, busy = false;
    textarea.value = JSON.stringify(datasets[0].get(), null, 2);
    const commit = () => { datasets[index].set(JSON.parse(textarea.value)); };
    select.addEventListener('change', () => {
      try { commit(); index = Number(select.value); textarea.value = JSON.stringify(datasets[index].get(), null, 2); error.textContent = ''; }
      catch { select.value = String(index); error.textContent = 'Enter valid JSON before switching datasets.'; }
    });
    const close = () => { if (!busy) { dialog.close(); dialog.remove(); controls.querySelector('button').focus(); } };
    dialog.querySelector('[data-close]').addEventListener('click', close);
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { if (!busy) dialog.remove(); });
    dialog.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault();
      try {
        commit(); busy = true;
        dialog.querySelectorAll('button').forEach(button => { button.disabled = true; });
        textarea.disabled = select.disabled = true;
        // Do not silently overwrite state which changed while the JSON editor was open.
        if (client.document.revision !== original.revision) throw new Error('Preview state changed while editing. Cancel and reopen Mock Data to review the current source.');
        await client.saveData(data);
        location.reload();
      } catch (cause) {
        error.textContent = cause.message; busy = false;
        dialog.querySelectorAll('button').forEach(button => { button.disabled = false; });
        textarea.disabled = select.disabled = false;
      }
    });
    dialog.showModal(); select.focus();
  });
}
