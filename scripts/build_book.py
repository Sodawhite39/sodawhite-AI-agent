"""Join the edited chapters; images and source links stay repository-local."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
files = sorted((root / "chapters").glob("*.md"))
preface = """# AI Agent 通俗学习全书

苏打白 Dev 学习改写版。原书作者李博杰，来源与许可见 [README](README.md) 和 [NOTICE](NOTICE)。按原书 2.0 十章目录整理，第一章文章与补充分别保留。

英文、公式与代码均提供解释。教学数据不等于真实产品数据，读完或生成教材不代表已经掌握。第一章公众号在线版的最新改动尚未核对，本地稿有版本说明。

## 目录

"""
sections = []
for index, file in enumerate(files, 1):
    body = file.read_text(encoding="utf-8")
    title = body.splitlines()[0][2:].replace("<br>", " ")
    anchor = f"section-{index:02}"
    preface += f"- [{title}](#{anchor})\n"
    def resolve_link(match):
        label, target = match.group(1), match.group(2)
        if target.startswith(("https://", "http://", "#")):
            return match.group(0)
        base, separator, fragment = target.partition("#")
        local = (file.parent / base).resolve().relative_to(root).as_posix()
        return f"[{label}]({local}{separator}{fragment})"
    body = re.sub(r"\[([^\]]*)\]\(([^)]+)\)", resolve_link, body)
    sections.append(f'<a id="{anchor}"></a>\n\n{body}')
(root / "BOOK.md").write_text(preface + "\n---\n\n" + "\n\n---\n\n".join(sections), encoding="utf-8")
print(f"Combined {len(files)} chapter documents into BOOK.md")
