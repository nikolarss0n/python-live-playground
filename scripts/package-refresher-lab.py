"""Package the local refresher without environments, caches, or mock solutions."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

project = Path(__file__).resolve().parents[1]
source = project / "labs" / "python-refresher"
output = project / "public" / "labs" / "python-refresher.zip"
files = [source / name for name in ("README.md", "pyproject.toml", ".gitignore", "hello.py", "sample-results.json")]
for folder in ("src", "tests"):
    files.extend(path for path in sorted((source / folder).rglob("*.py")) if "__pycache__" not in path.parts)
output.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
    for path in files:
        archive.write(path, Path("python-refresher") / path.relative_to(source))
print(output)
