from PIL import Image

im1 = Image.open('d:/01. AI/MDrawing/mdrawing/scripts/page_1.png')
w, h = im1.size

# Column 1 full: x from 0.04 to 0.35, y from 0.10 to 0.90
im1.crop((int(w * 0.04), int(h * 0.10), int(w * 0.36), int(h * 0.90))).save('d:/01. AI/MDrawing/mdrawing/scripts/col1_full.png')

# Column 2 full: x from 0.35 to 0.67, y from 0.10 to 0.90
im1.crop((int(w * 0.35), int(h * 0.10), int(w * 0.67), int(h * 0.90))).save('d:/01. AI/MDrawing/mdrawing/scripts/col2_full.png')

# Column 3 full: x from 0.66 to 0.98, y from 0.10 to 0.90
im1.crop((int(w * 0.66), int(h * 0.10), int(w * 0.98), int(h * 0.90))).save('d:/01. AI/MDrawing/mdrawing/scripts/col3_full.png')

im2 = Image.open('d:/01. AI/MDrawing/mdrawing/scripts/page_2.png')
w2, h2 = im2.size
# Page 2 column 1: x from 0.04 to 0.36, y from 0.10 to 0.90
im2.crop((int(w2 * 0.04), int(h2 * 0.10), int(w2 * 0.36), int(h2 * 0.90))).save('d:/01. AI/MDrawing/mdrawing/scripts/p2_col1_full.png')

print('All 4 column crops saved!')
