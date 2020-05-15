
const to_rad = Math.PI * 2 / 360;

function lerp(a: number, b: number, val: number): number {
    return a + (b - a) * val;
}

function clamp(val: number, a: number, b: number): number {
    if (val < a)
        return a;
    if (val > b)
        return b;
    return val;
}

class Vec2 {
    public x: number;
    public y: number;

    constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    public add(b: Vec2) : Vec2 {
        return new Vec2(this.x + b.x, this.y + b.y);
    }

    public sub(b: Vec2) : Vec2 {
        return new Vec2(this.x - b.x, this.y - b.y);
    }

    public dot(b: Vec2) : number {
        return this.x * b.x + this.y * b.y;
    }

    public cross(b: Vec2) : number {
        return this.x * b.y - this.y * b.x;
    }

    public normalized() : Vec2 {
        let mag = this.mag();
        return new Vec2(this.x / mag, this.y / mag);
    }

    public scale(m: number) : Vec2 {
        return new Vec2(this.x * m, this.y * m);
    }

    public div(m: number) : Vec2 {
        return new Vec2(this.x / m, this.y / m);
    }

    public mag() : number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public rotate(angle: number) : Vec2 {
        let sin = Math.sin(angle);
        let cos = Math.cos(angle);
        return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);
    }

    static lineIntersection(start, end, oStart, oEnd) : Vec2 {
        let r = end.sub(start);
        let s = oEnd.sub(oStart);
        let t = oStart.sub(start).cross(s.div(r.cross(s)));
        return start.add(r.scale(t));
    }

    /*
    static lineIntersection2(v1, v2, v3, v4) : Vec2 {
        let x = Vec2.cross(v1, v2);
        let y = Vec2.cross(v3, v4);
        let det = Vec2.cross(Vec2.sub(v1, v2), Vec2.sub(v3, v4));
        let a = Vec2.cross(new Vec2(x, v1.x - v2.x), new Vec2(y, v3.x - v4.x)) / det;
        let b = Vec2.cross(new Vec2(x, v1.y - v2.y), new Vec2(y, v3.y - v4.y)) / det;
        return new Vec2(a, b);
    }
    */
}
