
class Texture {
    width: number;
    height: number;
    pixels: Color[];
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.pixels = new Array(width * height);
    }
}

var textures : Texture[];
const paletteSize = 256;
var palette : Color[];

function loadPaletteAndTextures() {
    textures = new Array(2);
    loadTex(0, 32, 32, tex0b64);
    loadTex(1, 16, 16, tex1b64);
}

function loadTex(tex, w, h, b64) {
    textures[tex] = new Texture(w, h);
    let bin = atob(b64);

    for (var y = 0; y < h; y++) {
        for (var x = 0; x < w; x++) {
            let i = (x + y * w) * 3;
            let r = bin.charCodeAt(i + 0);
            let g = bin.charCodeAt(i + 1);
            let b = bin.charCodeAt(i + 2);
            textures[tex].pixels[x * h + y] = new Color(r, g, b);
            //textures[0].pixels[x + y * textures[0].width] = (x * 4 ^ Math.floor(Math.random() * y)) & 0xFF;
        }
    }
    // free memory
    bin = null;
    b64 = null;
}
