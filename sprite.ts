
class Sprite {

    pos: Vec2;
    yPos: number;
    tex: number;
    size: Vec2;

    constructor(pos: Vec2, yPos: number, tex: number, size: Vec2 = new Vec2(4, 4)) {
        this.pos = pos;
        this.yPos = yPos;
        this.tex = tex;
        this.size = size;
    }

    public draw(windowLeft: number, windowRight: number) {
        let t = this.pos.sub(camera.position).rotate(-camera.angle);

        if (t.x < 0)
            return;

        let x = t.y / t.x;
        let y = (this.yPos - camera.eyePos) / t.x;

        let ox = Math.floor((this.size.x / 2 / t.x) / 2 * canvas.width);

        let bx = Math.floor((x + 1) / 2 * canvas.width);

        let bottomY = Math.floor((1 - y) / 2 * canvas.height);
        let topY = bottomY - Math.floor((this.size.y / t.x) / 2 * canvas.height);

        let y0 = clamp(topY, 0, canvas.height);
        let y1 = clamp(bottomY, 0, canvas.height);

        let leftX = bx - ox;
        let rightX = bx + ox;
        let x0 = clamp(leftX, windowLeft, windowRight);
        let x1 = clamp(rightX, windowLeft, windowRight);

        let tex = textures[this.tex];
        for (let x = x0; x < x1; x++) {
            let xc = (x - leftX) / (rightX - leftX);
            for (let y = y0; y < y1; y++) {
                let yc = (y - topY) / (bottomY - topY);

                if (y < portalRegion[x][0] || y > portalRegion[x][1])
                    continue;

                let tx = Math.floor(xc * tex.width) & (tex.width - 1);
                let ty = Math.floor(yc * tex.height) & (tex.height - 1);
                let col = applyFog(tex.pixels[tx * tex.height + ty], t.x);

                let i = (x + y * canvas.width) * 4;
                data[i]     = col.r;
                data[i + 1] = col.g;
                data[i + 2] = col.b;
            }
        }
    }

}
