"""Build runtime and source archives without caches, profiles or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'manifest.json').read_text())['version']
assert version == json.loads((root / 'package.json').read_text())['version']
out = root / 'downloads'
out.mkdir(exist_ok=True)
runtime = sorted([*root.glob('*.js'), *root.glob('*.css'), *root.glob('*.html'), root / 'manifest.json', root / 'README.md', root / 'SECURITY_REVIEW.md', root / 'VALIDATION.md'])
source = sorted(set(runtime + [root / name for name in ['package.json', 'package-lock.json', '.gitignore', 'CODEX_HANDOFF.md']] + list((root / 'scripts').glob('*.py')) + list((root / 'tests').glob('*.cjs'))))
for name, files in [(f'LemField-v{version}-firefox.zip', runtime), (f'LemField-v{version}-source.zip', source)]:
    with ZipFile(out / name, 'w', ZIP_DEFLATED) as archive:
        for file in files:
            archive.write(file, file.relative_to(root).as_posix())
    with ZipFile(out / name) as archive:
        assert archive.testzip() is None
    print(name)
archives = sorted(out.glob('*.zip'))
(out / 'SHA256SUMS').write_text(''.join(f'{hashlib.sha256(file.read_bytes()).hexdigest()}  {file.name}\n' for file in archives))
