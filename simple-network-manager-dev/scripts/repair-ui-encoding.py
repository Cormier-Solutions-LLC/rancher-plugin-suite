from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'pkg' / 'simple-network-manager'
symbols = ['…', '·', '’', '‘', '“', '”', '—', '–', '→', '▸', '▾', '＋']
repairs = {}
for symbol in symbols:
    broken = symbol
    for _ in range(3):
        try:
            broken = broken.encode('utf-8').decode('cp1252')
        except UnicodeDecodeError:
            break
        repairs[broken] = symbol
for path in root.rglob('*'):
    if path.suffix not in ('.vue', '.ts'):
        continue
    source = path.read_text(encoding='utf-8')
    fixed = source
    for broken, symbol in sorted(repairs.items(), key=lambda pair: -len(pair[0])):
        fixed = fixed.replace(broken, symbol)
    if fixed != source:
        path.write_text(fixed, encoding='utf-8')
        print(path.name)
