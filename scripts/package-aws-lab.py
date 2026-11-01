"""Bundle only lab source and documentation, never local environments or secrets."""

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def package_lab() -> Path:
    project = Path(__file__).resolve().parents[1]
    source = project / "labs" / "aws-genai"
    output = project / "public" / "labs" / "aws-genai.zip"
    files = [source / "README.md", source / "pyproject.toml", source / ".gitignore"]
    for folder in ("src", "tests"):
        files.extend(sorted((source / folder).rglob("*.py")))
    files = [path for path in files if "__pycache__" not in path.parts]
    for path in files:
        if not path.is_file():
            raise FileNotFoundError(f"Required lab source is missing: {path}")
    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, Path("aws-genai") / path.relative_to(source))
    return output


if __name__ == "__main__":
    print(package_lab())
