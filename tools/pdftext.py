# -*- coding: utf-8 -*-
"""Pull the text out of a simple PDF without a PDF library: inflate every
stream, then take the strings the text operators draw."""
import re, sys, zlib

TEXT = re.compile(r"\(((?:\\.|[^()\\])*)\)", re.S)
ESC = {'n': '\n', 'r': '\r', 't': '\t', 'b': '', 'f': '', '(': '(', ')': ')', '\\': '\\'}


def unescape(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            n = s[i + 1]
            if n in '01234567':
                j = i + 1
                while j < len(s) and j < i + 4 and s[j] in '01234567':
                    j += 1
                out.append(chr(int(s[i + 1:j], 8))); i = j; continue
            out.append(ESC.get(n, n)); i += 2; continue
        out.append(c); i += 1
    return ''.join(out)


def text(path):
    d = open(path, 'rb').read()
    chunks = []
    for m in re.finditer(rb'stream\r?\n', d):
        s = m.end()
        e = d.find(b'endstream', s)
        if e < 0:
            continue
        try:
            chunks.append(zlib.decompress(d[s:e]))
        except Exception:
            chunks.append(d[s:e])
    blob = b'\n'.join(chunks).decode('latin-1')
    # keep line structure: TJ/Tj arrays on one line, ET/Td as breaks
    out = []
    for line in blob.split('\n'):
        frags = [unescape(m.group(1)) for m in TEXT.finditer(line)]
        if frags:
            out.append(''.join(frags))
    return '\n'.join(out)


if __name__ == '__main__':
    print(text(sys.argv[1]))
