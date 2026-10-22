"""Build a reproducible academic source archive without runtime data or secrets.

Authors: CHRONO Group 27; AI-assisted final handover tooling (see AUTHORS.md).
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import zipfile
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[2]
BASELINE = "3112a134f92917a3d1b9ce8776c41a62bccd405b"
DIRECTORIES = {"backend", "frontend", "packages", "assets", "tools", "supabase", "docs", ".github"}
ROOT_FILES = {
    "README.md",
    "AUTHORS.md",
    "CONTRIBUTING.md",
    "THIRD_PARTY_NOTICES.md",
    "STACK.md",
    ".dockerignore",
    ".gitignore",
    ".prettierignore",
    ".prettierrc.json",
    ".env.example",
    ".env.production.example",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "eslint.config.js",
    "render.yaml",
    "vercel.json",
    "docker-compose.yml",
    "docker-compose.prod.yml",
}
SKIP_DIRS = {
    ".git",
    "node_modules",
    ".next",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".ruff_cache",
    ".pnpm-store",
    ".expo",
    ".expo-shared",
    "uploads",
    "test-results",
    "coverage",
    "dist",
    "web-build",
    "artifacts",
    "tmp",
    "submission-dist",
}
SKIP_SUFFIXES = {".log", ".pyc", ".pyo", ".tsbuildinfo", ".docx", ".pdf", ".zip"}
SECRET_PATTERNS = (
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"AIza[0-9A-Za-z_-]{35}"),
    re.compile(rb"gh[pousr]_[A-Za-z0-9]{30,}"),
)


def allowed(name):
    path = PurePosixPath(name)
    if not path.parts or path.is_absolute() or ".." in path.parts:
        return False
    if path.parts[0] not in DIRECTORIES and name not in ROOT_FILES:
        return False
    if any(part in SKIP_DIRS for part in path.parts):
        return False
    if path.name.startswith("~$") or path.name in {"next-env.d.ts", "Thumbs.db", ".DS_Store"}:
        return False
    if path.suffix in SKIP_SUFFIXES:
        return False
    if path.name.startswith(".env") and not path.name.endswith(".example"):
        return False
    return True


def candidates(root):
    try:
        top = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], cwd=root, text=True
        ).strip()
        if Path(top).resolve() != root.resolve():
            raise FileNotFoundError("Extracted source is inside another repository")
        output = subprocess.check_output(
            ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
            cwd=root,
        )
        return sorted(set(output.decode("utf-8").strip("\0").split("\0")))
    except (subprocess.CalledProcessError, FileNotFoundError):
        result = []
        for directory, dirs, files in os.walk(root):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for file in files:
                result.append((Path(directory) / file).relative_to(root).as_posix())
        return sorted(result)


def git_value(root, *args):
    try:
        top = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], cwd=root, text=True
        ).strip()
        if Path(top).resolve() != root.resolve():
            return None
        return subprocess.check_output(["git", *args], cwd=root, text=True).strip()
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def build(root, output):
    payload = {}
    for name in candidates(root):
        path = root / name
        if not allowed(name) or not path.is_file():
            continue
        if path.is_symlink():
            raise ValueError(f"Symlink requires explicit review: {name}")
        data = path.read_bytes()
        if any(pattern.search(data) for pattern in SECRET_PATTERNS):
            raise ValueError(f"Credential-like content requires review: {name}")
        payload[name] = data
    required = [
        "README.md",
        "AUTHORS.md",
        ".github/workflows/ci.yml",
        "pnpm-lock.yaml",
        "backend/api/uv.lock",
        "backend/api/alembic.ini",
        "frontend/web/package.json",
        "frontend/web/lib/server/api-proxy.ts",
        ".env.production.example",
        "docs/FINAL_VALIDATION.md",
        "docs/AUTHORSHIP.json",
    ]
    missing = [name for name in required if name not in payload]
    if missing:
        raise ValueError(f"Missing required source files: {missing}")
    info = {
        "product": "CHRONO",
        "team": "CSIT321 Group 27",
        "prepared_utc": datetime.now(UTC).isoformat(),
        "development_baseline": BASELINE,
        "release_commit": git_value(root, "rev-parse", "HEAD"),
        "branch": git_value(root, "branch", "--show-current"),
        "working_tree_changes": git_value(root, "status", "--porcelain") or "",
        "validation": "docs/FINAL_VALIDATION.md",
        "exclusions": "Dependencies, secrets, logs, runtime uploads, build caches, unrelated reports and temporary files.",
    }
    payload["SUBMISSION_INFO.json"] = (json.dumps(info, indent=2) + "\n").encode()
    manifest = {
        "algorithm": "SHA-256",
        "note": "Every archive payload file except this self-describing manifest.",
        "files": {
            name: {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for name, data in sorted(payload.items())
        },
    }
    payload["SOURCE_MANIFEST.json"] = (json.dumps(manifest, indent=2) + "\n").encode()
    output.parent.mkdir(parents=True, exist_ok=True)
    # Fixed ZIP timestamps/order avoid machine-specific archive entries.
    with zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in sorted(payload.items()):
            entry = zipfile.ZipInfo("CHRONO-Source/" + name, date_time=(2026, 10, 22, 0, 0, 0))
            entry.compress_type = zipfile.ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)
    verify(output)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(".zip.sha256").write_text(f"{digest}  {output.name}\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "archive": str(output),
                "files": len(payload),
                "bytes": output.stat().st_size,
                "sha256": digest,
            }
        )
    )


def verify(output):
    with zipfile.ZipFile(output) as archive:
        if archive.testzip():
            raise ValueError("Archive CRC check failed")
        names = archive.namelist()
        if len(names) != len(set(names)):
            raise ValueError("Duplicate archive entries")
        manifest = json.loads(archive.read("CHRONO-Source/SOURCE_MANIFEST.json"))
        expected = {"CHRONO-Source/" + name for name in manifest["files"]}
        if set(names) != expected | {"CHRONO-Source/SOURCE_MANIFEST.json"}:
            raise ValueError("Archive contains unmanifested entries")
        for name, metadata in manifest["files"].items():
            full = "CHRONO-Source/" + name
            if not allowed(name) and name != "SUBMISSION_INFO.json":
                raise ValueError(f"Excluded path found in archive: {name}")
            data = archive.read(full)
            if (
                len(data) != metadata["bytes"]
                or hashlib.sha256(data).hexdigest() != metadata["sha256"]
            ):
                raise ValueError(f"Manifest mismatch: {name}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output", type=Path, default=ROOT / "submission-dist/CHRONO-A5-Source.zip"
    )
    parser.add_argument("--verify", type=Path, help="Verify an existing archive without rebuilding")
    args = parser.parse_args()
    if args.verify:
        verify(args.verify.resolve())
        print("Archive CRC, paths, inventory and SHA-256 manifest verified.")
    else:
        build(ROOT, args.output.resolve())
