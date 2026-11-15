"""Refresh bundled WOFF2 subsets. Normal npm run build:web is offline and needs no Python."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.request import urlopen

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    dict(family="ZCOOL KuaiLe", source="ZCOOLKuaiLe-Regular.ttf", file="zcool-kuaile.woff2",
         weight="400", folder="zcoolkuaile", commit="6d49995f5d8f1c7d476760a580ffb89ce1e52c5d",
         remote="ZCOOLKuaiLe-Regular.ttf", license="ZCOOL-OFL.txt",
         sha256="812a6fc1fe54b6d73a419245c32dfeba8aa33104d5be90d1cf6af082007cb71d"),
    dict(family="Noto Sans SC", source="NotoSansSC.ttf", file="noto-sans-sc.woff2",
         weight="400 700", folder="notosanssc", commit="a85815a42757630ce188fdad368c2dfc444d4773",
         remote="NotoSansSC%5Bwght%5D.ttf", license="Noto-OFL.txt",
         sha256="a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da"),
]


def unicode_range(points):
    ranges = []
    for point in sorted(points):
        if ranges and point == ranges[-1][1] + 1:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    return ",".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in ranges)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=ROOT / ".cache/fonts")
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    target = ROOT / "assets/fonts"
    target.mkdir(parents=True, exist_ok=True)
    corpus = json.loads(subprocess.check_output(["node", "scripts/font-text.mjs"], cwd=ROOT, encoding="utf-8"))
    points = set(map(ord, corpus["text"]))
    manifest = dict(textSha256=corpus["sha256"], text=corpus["text"], faces=[], licenses=[])
    for spec in SOURCES:
        base = f"https://raw.githubusercontent.com/google/fonts/{spec['commit']}/ofl/{spec['folder']}/"
        source = args.source_dir / spec["source"]
        if not source.exists():
            with urlopen(base + spec["remote"], timeout=120) as response:
                source.write_bytes(response.read())
        if hashlib.sha256(source.read_bytes()).hexdigest() != spec["sha256"]:
            raise ValueError(f"Source checksum mismatch: {source}")
        license_file = args.source_dir / spec["license"]
        if not license_file.exists():
            with urlopen(base + "OFL.txt", timeout=60) as response:
                license_file.write_bytes(response.read())
        (target / spec["license"]).write_bytes(license_file.read_bytes())
        font = TTFont(source, recalcTimestamp=False)
        missing = points - set(font.getBestCmap())
        if any(0x3400 <= p <= 0x9FFF for p in missing):
            raise ValueError(f"Missing Chinese glyphs in {spec['family']}: {sorted(missing)}")
        options = subset.Options()
        options.layout_features = ["*"]  # 包括等宽数字 tnum 与中文标点处理。
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
        options.name_legacy = True
        options.name_languages = [0x409]
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=points - missing)
        subsetter.subset(font)
        if "fvar" in font:
            font = instantiateVariableFont(font, {"wght": (400, 700)}, inplace=True)
        font.flavor = "woff2"
        output = target / spec["file"]
        font.save(output)
        supported = sorted(font.getBestCmap())
        manifest["faces"].append(dict(
            family=spec["family"], file=spec["file"], weight=spec["weight"],
            unicodeRange=unicode_range(supported), codepoints=supported,
            systemFallback="".join(map(chr, sorted(missing))), bytes=output.stat().st_size,
            sourceUrl=base + spec["remote"], sourceSha256=spec["sha256"],
        ))
        manifest["licenses"].append(spec["license"])
        print(f"{spec['file']}: {len(supported)} codepoints, {output.stat().st_size / 1024:.1f} KiB")
    (target / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
