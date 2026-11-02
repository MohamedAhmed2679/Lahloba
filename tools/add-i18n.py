"""Appends keys to packages/i18n/src/en.ts and ar.ts. Input: JSON file {key: [en, ar]}.
Existing keys are replaced in place. Usage: python3 tools/add-i18n.py keys.json"""
import json, re, sys
root = __file__.rsplit('/tools/', 1)[0]
data = json.load(open(sys.argv[1], encoding='utf8'))
for lang, idx, marker in (('en', 0, '} as const;'), ('ar', 1, '};')):
    p = f'{root}/packages/i18n/src/{lang}.ts'
    s = open(p, encoding='utf8').read()
    add = []
    for k, v in data.items():
        line = f"  '{k}': {json.dumps(v[idx], ensure_ascii=False)},"
        pat = re.compile(rf"^  '{re.escape(k)}': .*,$", re.M)
        if pat.search(s): s = pat.sub(lambda m: line, s)
        else: add.append(line)
    i = s.rindex(marker)
    s = s[:i] + ('\n'.join(add) + '\n' if add else '') + s[i:]
    open(p, 'w', encoding='utf8').write(s)
print(f'{len(data)} keys')
