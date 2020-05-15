var canvas : HTMLCanvasElement;
var ctx : CanvasRenderingContext2D;

var imageData : ImageData;
var data;

var editing : boolean = false;
var maxDepth = 16;

var level : Level;
var camera : Camera;
var controls : boolean[] = new Array(6);
var lastDate = Date.now();
var drawRegion : [number, number][];
var fog = 0.75;

interface Camera {
    position: Vec2;
    angle: number;
    radius: number;
    sector: number;
    fov: number;
    height: number;
    yVel: number;
    nSin: number;
    nCos: number;
}

class Color {
    r: number;
    g: number;
    b: number;
    constructor(r = 255, g = 0, b = 255) {
        this.r = r;
        this.g = g;
        this.b = b;
    }
}

class Edge {
    vertA: number;
    vertB: number;
    sector: number;
    isSolid: boolean;
    texture: number;
    texScale: Vec2;

    constructor(vertA: number, vertB: number, sector: number = -1, texture: number = 0, texScale: Vec2 = new Vec2(1, 1)) {
        this.vertA = vertA;
        this.vertB = vertB;
        this.sector = sector;
        this.texture = texture;
        this.texScale = texScale;
        this.isSolid = sector == -1;
    }

    public vector() : Vec2 {
        return Vec2.sub(level.vertices[this.vertB], level.vertices[this.vertA]);
    }

    public projVec(vec: Vec2) : number {
        return Vec2.dot(vec, this.vector().normalized());
    }

    public side(vec: Vec2) : number {
        let vecA = level.vertices[this.vertA];
        let vecB = level.vertices[this.vertB];
        return (vec.x - vecA.x) * (vecB.y - vecA.y) - (vec.y - vecA.y) * (vecB.x - vecA.x);
    }
}

class Sector {
    edges: Edge[];
    floorHeight: number;
    ceilingHeight: number;
    floorTex: number;
    ceilTex: number;
    texScale: number;

    constructor(edges: Edge[], floorTex: number = 0, ceilTex: number = 0, floorHeight: number = 0, ceilingHeight: number = 2.8, texScale: number = 4) {
        this.edges = edges;
        this.floorTex = floorTex;
        this.ceilTex = ceilTex;
        this.floorHeight = floorHeight;
        this.ceilingHeight = ceilingHeight;
        this.texScale = texScale;
    }

    private samplePlane(x: number, y: number, ceil: boolean) : Color {
        let h = ceil ? this.ceilingHeight : this.floorHeight;

        let yc = (y / canvas.height - 0.5) * 2;
        let z = -(h - camera.height) / yc;
        let xc = (x / canvas.width - 0.5) * 2 * z;

        //let pos = new Vec2(xc * z, z).rotate(-camera.angle);
        //pos = Vec2.add(pos, new Vec2(camera.position.y, camera.position.x));
        //pos = pos.scale(this.texScale);
        //let sin = Math.sin(angle);
        //let cos = Math.cos(angle);
        //return new Vec2(this.x * cos - this.y * sin, this.x * sin + this.y * cos);


        let px = (xc * camera.nCos - z * camera.nSin + camera.position.y) * this.texScale;
        let py = (xc * camera.nSin + z * camera.nCos + camera.position.x) * this.texScale;


        const tex = ceil ? this.ceilTex : this.floorTex;
        const w = textures[tex].width;
        let texX = Math.floor(px) & (w - 1);
        let texY = Math.floor(py) & (w - 1);
        return applyFog(textures[tex].pixels[texX + texY * w], z);
    }

    public async draw(depth: number, windowLeft: number, windowRight: number) {
        await debugPause();

        if (depth >= maxDepth) {
            return;
        }
        
        for (var k = 0; k < this.edges.length; k++) {
            let v = this.edges[k];

            const hfov = Math.tan(camera.fov / 2 * to_rad); 
            const vfov = Math.tan(camera.fov / 2 * to_rad);
            // y is x
            // x is z
            let left = Vec2.sub(level.vertices[v.vertA], camera.position).rotate(-camera.angle);
            let right = Vec2.sub(level.vertices[v.vertB], camera.position).rotate(-camera.angle);

            let draw = true;

            const znear = 0.0; //0.001
            if (left.x <= znear && right.x <= znear) {
                continue;
            }

            
            let leftClipped = left;
            let rightClipped = right;

            let cutLeft = false;
            let leftCutAmount = 0;
            if (left.x <= znear) {
                leftClipped = Vec2.lineIntersection2(left, right, new Vec2(znear, -1), new Vec2(znear, 1));
                leftClipped.x += 0.01;
                leftCutAmount = 1 - (leftClipped.x - rightClipped.x) / (left.x - right.x);
                cutLeft = true;
            }
            let cutRight = false;
            let rightCutAmount = 1;
            if (right.x <= znear) {
                rightClipped = Vec2.lineIntersection2(left, right, new Vec2(znear, -1), new Vec2(znear, 1));
                rightClipped.x += 0.01;
                rightCutAmount = (rightClipped.x - leftClipped.x) / (right.x - left.x);
                cutRight = true;
            }
            let leftX = (leftClipped.y / (leftClipped.x * hfov) + 1) / 2 * canvas.width;
            let leftXS = Math.floor(leftX);
            let rightX = (rightClipped.y / (rightClipped.x * hfov) + 1) / 2 * canvas.width;
            let rightXS = Math.floor(rightX);

            if (cutLeft && cutRight) {
                //leftX = 0;
                //rightX = canvas.width;
            }

            // tex scale, todo: precompute these
            let horScale = Vec2.sub(right, left).mag() / 8 * v.texScale.x;
            
            // for persp correction
            let leftZInv = 1 / leftClipped.x;
            let rightZInv = 1 / rightClipped.x;
            let leftUZ = horScale * leftCutAmount / leftClipped.x;   // u start
            let rightUZ = horScale * rightCutAmount / rightClipped.x; // u end
            
            if (leftXS >= rightXS && depth != 0) { //  && v.sector == -1
                continue;
            }

            if (leftXS >= windowRight || rightXS < windowLeft) {
                continue;
            }

            const lvz = leftClipped.x * vfov;
            const rvz = rightClipped.x * vfov;

            // for now, use sector heights
            let leftY0  = (1 - (this.ceilingHeight - camera.height) / lvz) / 2 * canvas.height;
            let leftY0S = Math.floor(leftY0);
            let leftY1  = (1 - (this.floorHeight - camera.height) / lvz) / 2 * canvas.height;
            let leftY1S = Math.floor(leftY1);

            let rightY0  = (1 - (this.ceilingHeight - camera.height) / rvz) / 2 * canvas.height;
            let rightY0S = Math.floor(rightY0);
            let rightY1  = (1 - (this.floorHeight - camera.height) / rvz) / 2 * canvas.height;
            let rightY1S = Math.floor(rightY1);

            let x0 = Math.max(leftXS, windowLeft);
            let x1 = Math.min(rightXS, windowRight);

            var color : Color;

            var tex = textures[v.texture];

            if (v.sector == -1) { // normal wall
                let verScale = (this.ceilingHeight - this.floorHeight) / 8 * v.texScale.x;

                for (var x = x0; x < x1; x++) {
                    // should use floats here instead
                    let complete = clamp((x - leftX) / (rightX - leftX), 0, 1);
                    let wallStart = Math.floor(lerp(leftY0, rightY0, complete));
                    let floorStart = Math.floor(lerp(leftY1, rightY1, complete));

                    let z = 1 / lerp(leftZInv, rightZInv, complete);
                    let u = lerp(leftUZ, rightUZ, complete) * z;
                    let texX = Math.floor(u * tex.width) & (tex.width - 1);

                    let y0 = drawRegion[x][0];
                    let y1 = drawRegion[x][1];
                    for (var y = y0; y < y1; y++) {
                        if (y < wallStart) {
                            color = this.samplePlane(x, y, true);
                        } else if (y >= floorStart) {
                            //color = this.floorColor;
                            color = this.samplePlane(x, y, false);
                        } else {
                            let texY = Math.round((y - wallStart) / (floorStart - wallStart) * tex.height * verScale) & (tex.height - 1);
                            //color = v.color;
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);
                        }

                        let i = (x + y * canvas.width) * 4;
                        data[i]     = color.r;
                        data[i + 1] = color.g;
                        data[i + 2] = color.b;
                    }
                }
                
                
            } else { // portal                
                let deltaFloor = level.sectors[v.sector].floorHeight - this.floorHeight;
                let deltaCeiling = level.sectors[v.sector].ceilingHeight - this.ceilingHeight;

                let topVerScale = -deltaCeiling / 8 * v.texScale.x;
                let bottomVerScale = deltaFloor / 8 * v.texScale.x;
                
                let leftPortalY0 = leftY0S;
                let rightPortalY0 = rightY0S;

                let leftPortalY1 = leftY1S;
                let rightPortalY1 = rightY1S;

                if (deltaCeiling < 0) {
                    // draw upper wall
                    leftPortalY0  = (this.ceilingHeight + deltaCeiling - camera.height) / lvz;
                    leftPortalY0  = Math.floor((1 - leftPortalY0) / 2 * canvas.height);
                    rightPortalY0 = (this.ceilingHeight + deltaCeiling - camera.height) / rvz;
                    rightPortalY0 = Math.floor((1 - rightPortalY0) / 2 * canvas.height);
                }

                if (deltaFloor > 0) {
                    // draw lower wall
                    rightPortalY1 = (this.floorHeight + deltaFloor - camera.height) / rvz;
                    rightPortalY1 = Math.floor((1 - rightPortalY1) / 2 * canvas.height);
                    leftPortalY1  = (this.floorHeight + deltaFloor - camera.height) / lvz;
                    leftPortalY1  = Math.floor((1 - leftPortalY1) / 2 * canvas.height);
                }

                for (var x = x0; x < x1; x++) {
                    let complete = clamp((x - leftX) / (rightX - leftX), 0, 1);
                    let topWallStart    = Math.floor(lerp(leftY0, rightY0, complete));
                    let portalStart     = Math.floor(lerp(leftPortalY0, rightPortalY0, complete));
                    let bottomWallStart = Math.ceil(lerp(leftPortalY1, rightPortalY1, complete));
                    let floorStart      = Math.floor(lerp(leftY1, rightY1, complete));

                    if (portalStart > floorStart) {
                        portalStart = floorStart + 1;
                    }

                    let z = 1 / lerp(leftZInv, rightZInv, complete);
                    let u = lerp(leftUZ, rightUZ, complete) * z;
                    let texX = Math.floor(u * tex.width) & (tex.width - 1);

                    let y0 = drawRegion[x][0];
                    let y1 = drawRegion[x][1];
                    for (var y = y0; y < y1; y++) {
                        if (y < topWallStart) {
                            color = this.samplePlane(x, y, true);
                        } else if (y < portalStart) {
                            let texY = Math.floor((y - portalStart) / (portalStart - topWallStart) * tex.height * topVerScale) & (tex.height - 1);
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);
                        } else if (y < bottomWallStart) {
                            continue;
                        } else if (y < floorStart) {
                            let texY = Math.floor((y - bottomWallStart) / (floorStart - bottomWallStart) * tex.height * bottomVerScale) & (tex.height - 1);
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);
                        } else {
                            //color = this.floorColor;
                            color = this.samplePlane(x, y, false);
                        }

                        let i = (x + y * canvas.width) * 4;
                        data[i]     = color.r;
                        data[i + 1] = color.g;
                        data[i + 2] = color.b;
                    }

                    drawRegion[x][0] = clamp(Math.max(portalStart, drawRegion[x][0]), 0, canvas.height);
                    drawRegion[x][1] = clamp(Math.min(bottomWallStart, drawRegion[x][1]), 0, canvas.height);

                    //if (drawRegion[x][0] > drawRegion[x][1]) {
                    //    drawRegion[x][0] = drawRegion[x][1];
                    //}
                }
                
                if (cutLeft) {
                    leftXS = 0;
                }
                if (cutRight) {
                    rightXS = canvas.width;
                }

                leftXS = Math.max(leftXS, windowLeft);
                rightXS = Math.min(rightXS, windowRight);

                // for when on an edge
                if (v.sector == camera.sector) {
                    continue;
                }

                await level.sectors[v.sector].draw(depth + 1, leftXS, rightXS);
            }
        }
    }

    public checkAndCollideCam(cam: Camera, checkIfOutside: boolean) {
        let totalPush = new Vec2();

        this.edges.forEach((v, i) => {
            let vec = v.vector();
            let localCam = Vec2.sub(cam.position, level.vertices[v.vertA]);
            let proj = v.projVec(localCam);
            if (proj < -camera.radius / 2 || proj > vec.mag() + camera.radius / 2)
                return;
            
            let projVec = vec.normalized().scale(proj);


            let solid = v.sector == -1 || (this.floorHeight - camera.height) > -0.75 || (this.ceilingHeight - camera.height) < 0.2;
            if (solid) {
                let reject = Vec2.sub(localCam, projVec);
                let rejMag = reject.mag();
                if (rejMag < camera.radius) {
                    let push = reject.normalized().scale(camera.radius - rejMag);
                    totalPush = Vec2.add(totalPush, push);
                }
            } else if (checkIfOutside) {
                if (v.side(cam.position) > 0) {
                    changeSector(v.sector);
                }
            }
        });

        camera.position = Vec2.add(camera.position, totalPush);
    }
}

class Level {
    vertices: Vec2[];
    sectors: Sector[];

    constructor(vertices: Vec2[], sectors: Sector[]) {
        this.vertices = vertices;
        this.sectors = sectors;
    }
}

function changeSector(sector: number) {
    camera.sector = sector;
    console.log(sector);
}

function getButtonID(keyCode : number) : number {
    switch (keyCode) {
    case 87:
        return 0;
    case 83:
        return 1;
    case 65:
        return 2;
    case 68:
        return 3;
    case 81:
        return 4;
    case 69:
        return 5;
    }
    return -1;
}

function keyDown(evt : KeyboardEvent) {
    controls[getButtonID(evt.keyCode)] = true;
}

function keyUp(evt : KeyboardEvent) {
    controls[getButtonID(evt.keyCode)] = false;
}

function applyFog(col: Color, z: number) : Color {
    z *= fog;
    if (z < 1)
        z = 1;
    return new Color(col.r / z, col.g / z, col.b / z);
}

function moveAndCol(delta: Vec2) {

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function debugPause(time = 1000) {
    //ctx.putImageData(imageData, 0, 0);
    //await sleep(time);
}

// todo: global collision function
async function draw() {
    //await debugPause();
    let delta = (Date.now() - lastDate) / 1000;
    if (delta > 0.2)
        delta = 0.2;
    lastDate = Date.now();

    let h = Math.sin(Date.now() * 0.001) * 2.5 + 0.5;
    level.sectors[2].floorHeight = h + 0.2;
    level.sectors[2].ceilingHeight = h + 2.6;

    const speed = 6 * delta;
    const turnSpeed = 4 * delta;

    let forward = new Vec2(Math.cos(camera.angle), Math.sin(camera.angle)).scale(speed);
    let right = new Vec2(Math.sin(camera.angle), -Math.cos(camera.angle)).scale(speed);
    
    if (controls[0])
        camera.position = Vec2.add(camera.position, forward);
    if (controls[1])
        camera.position = Vec2.sub(camera.position, forward);
    if (controls[2])
        camera.position = Vec2.add(camera.position, right);
    if (controls[3])
        camera.position = Vec2.sub(camera.position, right);
    if (controls[4])
        camera.angle -= turnSpeed;
    if (controls[5])
        camera.angle += turnSpeed;

    level.sectors[camera.sector].checkAndCollideCam(camera, true);
    level.sectors[camera.sector].edges.forEach((v) => {
        if (v.sector != -1) {
            level.sectors[v.sector].checkAndCollideCam(camera, false);
        }
    });

    camera.height = level.sectors[camera.sector].floorHeight + 1.75;
    for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
            let i = (x + y * canvas.width) * 4;
            data[i]     = 255;
            data[i + 1] = 0;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }

    camera.nSin = Math.sin(-camera.angle);
    camera.nCos = Math.cos(-camera.angle);

    for (var x = 0; x < canvas.width; x++) {
        drawRegion[x] = [0, canvas.height];
    }
    await level.sectors[camera.sector].draw(0, 0, canvas.width);
    await debugPause(1000);

    //texTest();


    //let i = (canvas.width / 2 + canvas.height / 2 * canvas.width) * 4;
    //data[i]     = 255;
    //data[i + 1] = 255;
    //data[i + 2] = 255;

    ctx.putImageData(imageData, 0, 0);

    window.requestAnimationFrame(draw);
}

function run() {
    camera = {
        position: new Vec2(10.704444467088216, 3.4822864841785632),
        radius: 0.5,
        angle: 2.7,
        sector: 0,
        fov: 90,
        height: 1.75,
        yVel: 0,
        nSin: 0,
        nCos: 0,
    };

    canvas = document.getElementById('game') as HTMLCanvasElement;
    ctx = canvas.getContext('2d');
    imageData = ctx.createImageData(canvas.width, canvas.height);
    data = imageData.data;

    loadPaletteAndTextures();

    for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
            let i = (x + y * canvas.width) * 4;
            data[i]     = 255;
            data[i + 1] = 0;
            data[i + 2] = 255;
            data[i + 3] = 255;
        }
    }

    drawRegion = new Array(canvas.width);
    //debugCanvas = document.getElementById('debug') as HTMLCanvasElement;
    //debugCtx = debugCanvas.getContext('2d');

    window.addEventListener("keydown", keyDown, false);
    window.addEventListener("keyup", keyUp, false);

    /*
    let verts = [
        new Vec2(4, 2),
        new Vec2(8, 2),
        new Vec2(8, 5),
        new Vec2(5, 6),
        new Vec2(2, 5),
        new Vec2(2, 9),
    ];

    // todo: put edges in separate array and index them
    // problem: cant maintain clockwiseness per sector then

    // MUST BE CLOCKWISE
    let sectors = [
        new Sector([
            new Edge(0, 1, -1, {r: 255, g: 0, b: 255}),
            new Edge(1, 2, -1, {r: 255, g: 255, b: 255}, 0, 5),
            new Edge(2, 3, -1, {r: 0, g: 0, b: 255}),
            new Edge(3, 0,  1),
        ], {r: 100, g: 50, b: 50}, {r: 127, g: 182, b: 255}),
        new Sector([
            new Edge(0, 3, 0),
            new Edge(3, 4, 2),
            new Edge(4, 0, -1, {r: 0, g: 255, b: 255}),
        ], {r: 50, g: 100, b: 50}),
        new Sector([
            new Edge(4, 3, 1),
            new Edge(5, 4, -1, {r: 255, g: 255, b: 255}),
            new Edge(3, 5, -1, {r: 255, g: 255, b: 255}, 0, 0.5),
        ], {r: 50, g: 50, b: 100}),
    ];
    */

    let verts = [
        new Vec2(1, 1),
        new Vec2(20, -5),
        new Vec2(20, 15),
        new Vec2(1, 10),
        new Vec2(4, 4),
        new Vec2(6, 4),
        new Vec2(6, 6),
        new Vec2(4, 6),
    ];

    // todo: optimize sectors to lists of vertices
    let sectors = [
        new Sector([
            new Edge(0, 1, -1, 1, new Vec2(2, 2)),
            new Edge(1, 5, 1,  1, new Vec2(2, 2)),
            new Edge(5, 4, -1, 1, new Vec2(2, 2)),
            new Edge(4, 0, 3,  1, new Vec2(2, 2)),
        ], 1, 1, 0.5, 6),
        new Sector([
            new Edge(6, 5, -1),
            new Edge(5, 1, 0),
            new Edge(1, 2, -1),
            new Edge(2, 6, 2),
        ], 1, 1, 0.5, 6),
        new Sector([
            new Edge(7, 6, -1),
            new Edge(6, 2, 1),
            new Edge(2, 3, -1),
            new Edge(3, 7, 3),
        ], 0, 0, 0.1, 10),
        new Sector([
            new Edge(4, 7, -1),
            new Edge(7, 3, 2),
            new Edge(3, 0, -1),
            new Edge(0, 4, 0),
        ],1, 0, -0.4, 5),
    ];

    level = new Level(verts, sectors);

    window.requestAnimationFrame(draw);
}
