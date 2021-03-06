var canvas : HTMLCanvasElement;
var ctx : CanvasRenderingContext2D;

var imageData : ImageData;
var data;

var maxDepth = 16;

var level : Level;
var camera : Camera;
var controls : boolean[] = new Array(6);
var jump : boolean;
var lastDate = Date.now();
var fog = 0.1;

interface Camera {
    position: Vec2;
    yPos: number;
    eyePos: number;
    height: number;
    angle: number;
    radius: number;
    sector: number;
    fov: number;
    hfov: number;
    vfov: number;
    yVel: number;
    nSin: number;
    nCos: number;
    onGround: boolean;
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
        return level.vertices[this.vertB].sub(level.vertices[this.vertA]);
    }

    public projVec(vec: Vec2) : number {
        return vec.dot(this.vector().normalized());
    }

    public side(vec: Vec2) : number {
        let vecA = level.vertices[this.vertA];
        let vecB = level.vertices[this.vertB];
        return (vec.x - vecA.x) * (vecB.y - vecA.y) - (vec.y - vecA.y) * (vecB.x - vecA.x);
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
    //console.log(sector);
}

function keyEvent(keyCode, state) {
    console.log(keyCode);
    switch (keyCode) {
    case 87: // W
        controls[0] = state;
        break;
    case 83: // S
        controls[1] = state;
        break;
    case 65: // A
        controls[2] = state;
        break;
    case 68: // D
        controls[3] = state;
        break;
    case 81: // Q
        if (editor.editing && state) {
            editorSwitchModes();
        } else {
            controls[4] = state;
        }
        break;
    case 69: // E
        if (editor.editing && state) {
            camera.position = editorUntransform(editor.lastMousePos);
        } else {
            controls[5] = state;
        }
        break;
    case 77: // M
        if (state)
            editorToggle();
        break;
    case 32: // Space
        if (state)
            jump = true;
        break;
    case 38: // Up Arrow
        if (!state)
            break;
        if (Sector.maxDrawnSectors++ > 100)
            Sector.maxDrawnSectors = 100;
        break;
    case 40: // Down Arrow
        if (!state)
            break;
        if (Sector.maxDrawnSectors-- < 0)
            Sector.maxDrawnSectors = 0;
        break;
    }
}

function keyDown(evt : KeyboardEvent) {
    keyEvent(evt.keyCode, true);
}

function keyUp(evt : KeyboardEvent) {
    keyEvent(evt.keyCode, false);
}

function mouseDown(evt : MouseEvent) {
    if (editor.editing) {
        editorMouseEvent(evt, true);
    }
}

function mouseUp(evt : MouseEvent) {
    if (editor.editing) {
        editorMouseEvent(evt, false);
    }
}

function mouseMove(evt : MouseEvent) {
    if (editor.editing) {
        const rect = canvas.getBoundingClientRect();
        const pos = new Vec2(evt.clientX - rect.left, evt.clientY - rect.top).scale(canvas.width / rect.width);
        editor.lastMousePos = pos;
    }
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

function gameFrame(delta: number) {
    let h = Math.sin(Date.now() * 0.001) * 2.5 + 0.5;
    level.sectors[2].floorHeight = h + 0.2;
    level.sectors[2].ceilingHeight = h + 2.6;

    const speed = 6 * delta;
    const turnSpeed = 4 * delta;

    let forward = new Vec2(Math.cos(camera.angle), Math.sin(camera.angle)).scale(speed);
    let right = new Vec2(Math.sin(camera.angle), -Math.cos(camera.angle)).scale(speed);

    if (controls[0])
        camera.position = camera.position.add(forward);
    if (controls[1])
        camera.position = camera.position.sub(forward);
    if (controls[2])
        camera.position = camera.position.add(right);
    if (controls[3])
        camera.position = camera.position.sub(right);
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

    let floor = level.sectors[camera.sector].floorHeight;
    let ceiling = level.sectors[camera.sector].ceilingHeight;
    
    if (!camera.onGround) {
        camera.yVel -= 50 * delta;
        camera.yPos += camera.yVel * delta;
        if (camera.yPos < floor) {
            camera.onGround = true;
            camera.yVel = 0;
        }
        if (camera.yPos + camera.height + 0.2 > ceiling) {
            camera.yVel = -5;
            camera.yPos = ceiling - camera.height - 0.2;
        }
    }

    if (camera.onGround) {
        camera.yPos = floor;
    }

    if (jump) {
        jump = false;
        if (camera.onGround) {
            camera.onGround = false;
            camera.yVel = 15;
        }
    }
    
    camera.eyePos = camera.yPos + camera.height;

    
    for (var y = 0; y < canvas.height; y++) {
        for (var x = 0; x < canvas.width; x++) {
            let i = (x + y * canvas.width) * 4;
            data[i]     = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
            data[i + 3] = 255;
        }
    }
    
    camera.nSin = Math.sin(-camera.angle);
    camera.nCos = Math.cos(-camera.angle);

    let windowTop : number[] = new Array(canvas.width).fill(0);
    let windowBottom : number[] = new Array(canvas.width).fill(canvas.height);

    Sector.numDrawnSectors = 0;
    level.sectors[camera.sector].draw(0, 0, canvas.width, 0, canvas.height, windowTop, windowBottom);
    
    //let i = (canvas.width / 2 + canvas.height / 2 * canvas.width) * 4;
    //data[i]     = 255;
    //data[i + 1] = 255;
    //data[i + 2] = 255;

    ctx.putImageData(imageData, 0, 0);
}

// todo: global collision function
function frame() {
    let delta = (Date.now() - lastDate) / 1000;
    if (delta > 0.2)
        delta = 0.2;
    lastDate = Date.now();

    if (!editor.editing) {
        gameFrame(delta);
    } else {
        editorFrame(delta);
    }

    window.requestAnimationFrame(frame);
}

function run() {
    camera = {
        position: new Vec2(10.7, 3.48),
        yPos: 0,
        eyePos: 0,
        radius: 0.5,
        angle: 0.0439999,
        sector: 0,
        fov: 90,
        hfov: 0,
        vfov: 0,
        yVel: 0,
        nSin: 0,
        nCos: 0,
        height: 1.75,
        onGround: false,
    };
    
    camera.hfov = Math.tan(camera.fov / 2 * to_rad); 
    camera.vfov = Math.tan(camera.fov / 2 * to_rad);

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

    window.addEventListener("keydown", keyDown, false);
    window.addEventListener("keyup", keyUp, false);
    window.addEventListener("mousedown", mouseDown);
    window.addEventListener("mouseup", mouseUp);
    window.addEventListener("mousemove", mouseMove);

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
            new Edge(0, 1, -1, 1, new Vec2(5, 2)),
            new Edge(1, 5, 1,  1, new Vec2(5, 2)),
            new Edge(5, 4, -1, 1, new Vec2(5, 2)),
            new Edge(4, 0, 3,  1, new Vec2(5, 2)),
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
        ],1, 0, -0.2, 5),
    ];
    sectors[1].sprites.push(new Sprite(new Vec2(16.31107418243344, 5.244499713824594), 0.5, 0));

    level = new Level(verts, sectors);

    window.requestAnimationFrame(frame);
}
