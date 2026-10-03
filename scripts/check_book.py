"""Read-only checks for the Markdown book, images and teaching Python examples."""
import ast
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
errors = []
stats = []
blocks = []
expected = ["01-introduction.md", "01-supplement.md", "02-context.md", "03-memory.md", "04-tools.md", "05-coding.md", "06-interaction.md", "07-evaluation.md", "08-training.md", "09-evolution.md", "10-multi-agent.md"]
for name in expected:
    if not (root / "chapters" / name).is_file():
        errors.append(f"Missing chapter: {name}")
for chapter in sorted((root / "chapters").glob("*.md")):
    body = chapter.read_text(encoding="utf-8")
    images = re.findall(r"!\[[^\]]*\]\(([^)]+)\)", body)
    for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", body):
        if target.startswith(("http://", "https://", "#")):
            continue
        local = target.split("#", 1)[0]
        if not (chapter.parent / local).exists():
            errors.append(f"Missing link: {chapter.name} -> {target}")
    if len(re.findall(r"^```", body, re.M)) % 2:
        errors.append(f"Unbalanced code fences: {chapter.name}")
    for index, code in enumerate(re.findall(r"```python\n(.*?)\n```", body, re.S), 1):
        try:
            ast.parse(code)
        except SyntaxError as exc:
            errors.append(f"Python syntax: {chapter.name} block {index}: {exc}")
        blocks.append((chapter.name, index, code))
    stats.append({"file":chapter.name,"chinese_characters":len(re.findall(r"[\u4e00-\u9fff]", body)),"characters":len(body),"images":len(images)})
    if chapter.name[:2] not in ("01",) and len(images) < 3:
        errors.append(f"Expected three illustrations: {chapter.name}")
for document in list(root.glob("*.md")) + list((root / "coverage").glob("*.md")):
    if document.name == "editorial-brief.md":
        continue
    body = document.read_text(encoding="utf-8")
    for target in re.findall(r"!?\[[^\]]*\]\(([^)]+)\)", body):
        if target.startswith(("http://", "https://", "#")):
            continue
        if not (document.parent / target.split("#", 1)[0]).exists():
            errors.append(f"Missing link: {document.name} -> {target}")
for filename in sorted((root / "illustrations").glob("ch*.json")):
    try:
        data = json.loads(filename.read_text(encoding="utf-8"))
        for fig in data:
            for ext in ("png", "svg"):
                if not (root / "assets" / (fig["filename"] + "." + ext)).is_file():
                    errors.append(f"Missing diagram: {fig['filename']}.{ext}")
    except (ValueError, KeyError) as exc:
        errors.append(f"Diagram data: {filename.name}: {exc}")
print(json.dumps({"chapters":stats,"python_blocks":len(blocks),"errors":errors}, ensure_ascii=False, indent=2))
if "--run-examples" in sys.argv:
    # Each reviewed teaching snippet runs in its own process. No general eval of
    # webpage content, no auto execution of shell/API/robot examples.
    for name, index, code in blocks:
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=8, cwd="/tmp")
        print(f"{name} block {index}: exit {result.returncode}\n{result.stdout.rstrip()}")
        if result.returncode:
            errors.append(f"Example failed: {name} block {index}: {result.stderr}")
if errors:
    print("\n".join(errors))
    raise SystemExit(1)
