import sys
import base64
from PIL import Image

with open("palette", "rb") as f:
    global palette
    palette = f.read()

def find_nearest(rgb):
    closest = -1
    closest_dist = 9999999
    for i in range(256):
        dist_r = rgb[0] - palette[i * 3 + 0]
        dist_g = rgb[1] - palette[i * 3 + 1]
        dist_b = rgb[2] - palette[i * 3 + 2]
        dist = dist_r ** 2 + dist_g ** 2 + dist_b ** 2
        if dist < closest_dist:
            closest = i
            closest_dist = dist
    return closest
    

img = Image.open(sys.argv[1])
input = img.getdata()
output = bytearray(img.width * img.height)
for i in range(img.width * img.height):
    output[i] = find_nearest(input[i])

b64 = base64.b64encode(output)
print(b64.decode())
