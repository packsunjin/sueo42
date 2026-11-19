# 앱에 쓰는 글자만 담은 Pretendard 가변 글꼴(굵기 400~800)을 만든다.
# 화면 문구(js/copy.js)나 단어(words.csv)가 바뀌면 다시 돌린다:
#   pip install fonttools brotli
#   npm pack pretendard@1.3.9 && tar xzf pretendard-1.3.9.tgz
#   python tools/font-subset.py package/dist/web/variable/woff2/PretendardVariable.woff2
# 결과: sueo42/vendor/pretendard-variable@1.3.9/Pretendard42.woff2, 그리고 app.css 에 넣을 unicode-range 를 출력.
# 이 파일에 없는 글자(랭킹에 쓴 이름 등)는 같은 폴더의 공식 dynamic-subset 조각이 그때그때 받아 채운다.
import glob, io, sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools import subset

ROOT = os.path.join(os.path.dirname(__file__), "..", "sueo42")
chars = set(chr(c) for c in range(0x20, 0x7F)) | set("·…“”‘’「」『』–—→←↑↓✓•")
for f in glob.glob(os.path.join(ROOT, "**", "*"), recursive=True):
    rel = os.path.relpath(f, ROOT)
    if rel.startswith("vendor") or not f.endswith((".js", ".html", ".csv", ".css")): continue
    chars |= set(io.open(f, encoding="utf-8", errors="ignore").read())
chars = sorted(c for c in chars if ord(c) >= 0x20)

font = TTFont(sys.argv[1], lazy=False)
opt = subset.Options(); opt.layout_features = ["*"]; opt.name_IDs = ["*"]; opt.notdef_outline = True
ss = subset.Subsetter(opt); ss.populate(text="".join(chars)); ss.subset(font)
font = instancer.instantiateVariableFont(font, {"wght": (400, 800)})
font.flavor = "woff2"
out = os.path.join(ROOT, "vendor", "pretendard-variable@1.3.9", "Pretendard42.woff2")
font.save(out)
have = set(font.getBestCmap())
cps = sorted(ord(c) for c in chars if ord(c) in have)
ranges, a = [], cps[0]
for prev, cur in zip(cps, cps[1:] + [None]):
    if cur != prev + 1:
        ranges.append(f"U+{a:x}" if a == prev else f"U+{a:x}-{prev:x}"); a = cur
print(os.path.getsize(out) // 1024, "KB,", len(cps), "글자")
print("unicode-range:", ", ".join(ranges) + ";")
