"""Generate reproducible source-file credits from the development baseline."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASELINE = "3112a134f92917a3d1b9ce8776c41a62bccd405b"
NAMES = {
    "Nador": "Nguyen Thanh Nhan",
    "trgmnh": "Truong Ha Anh Minh",
    "Minh Duy Cao": "Cao Minh Duy",
    "Vetrarbraut": "Nguyen Nhat Minh",
    "Nhat Minh Nguyen": "Nguyen Nhat Minh",
    "Quang Vinh": "Nguyen Dinh Quang Vinh",
    "paracetamol06": "Nguyen Tien Phat",
}


def main():
    history = subprocess.check_output(
        ["git", "log", BASELINE, "--format=AUTHOR:%an", "--name-only", "--no-renames"],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
    )
    files = {}
    author = ""
    for line in history.splitlines():
        if line.startswith("AUTHOR:"):
            alias = line.removeprefix("AUTHOR:")
            author = NAMES.get(alias, alias)
        elif line and Path(line).suffix in {".py", ".ts", ".tsx", ".js", ".mjs", ".sh"}:
            if (ROOT / line).is_file():
                files.setdefault(line, set()).add(author)
    data = {
        "baseline": BASELINE,
        "method": "Distinct Git authors who touched each existing source file; aliases normalised.",
        "note": "Historical file credits, not line ownership or an effort ranking. Final AI-assisted maintenance is described in AUTHORS.md.",
        "files": {p: sorted(names) for p, names in sorted(files.items())},
    }
    (ROOT / "docs/AUTHORSHIP.json").write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
