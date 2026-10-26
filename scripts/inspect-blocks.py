import pymupdf

doc = pymupdf.open('C:/Users/N16/.gemini/antigravity/brain/1cda2f0a-77b8-45f7-bfcf-3901dcf6e83c/.user_uploaded/media_1793002460792_0f1dd525.pdf')

for pno in range(len(doc)):
    page = doc[pno]
    print(f"\n====================== PAGE {pno+1} ======================")
    # get text as blocks
    blocks = page.get_text("blocks")
    for b in blocks:
        # b: (x0, y0, x1, y1, text, block_no, block_type)
        txt = b[4].strip().replace('\n', ' -- ')
        if txt:
            print(f"[{b[5]}] ({b[0]:.1f}, {b[1]:.1f}, {b[2]:.1f}, {b[3]:.1f}): {txt}")
