from PIL import Image

im = Image.open('d:/01. AI/MDrawing/mdrawing/scripts/page_1.png')
w, h = im.size
print('Image size:', w, h)

# Let's crop around column 1, from y=15% to 40%, x=0% to 40%
crop1 = im.crop((int(w * 0.05), int(h * 0.15), int(w * 0.40), int(h * 0.42)))
crop1.save('d:/01. AI/MDrawing/mdrawing/scripts/crop_col1_rows5_15.png')
print('Saved crop_col1_rows5_15.png')
