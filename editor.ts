
enum EditorMode {
    VERTEX,
    SECTOR,
}

interface Editor {
    zoom: number;
    editing: boolean;
    offset: Vec2;
    mode: EditorMode;
    movingVert: number;
    creatingSectorVerts: number[];
    lastMousePos: Vec2;
}

var editor : Editor = {
    zoom: 5.0,
    editing: false,
    offset: new Vec2(-50, -50),
    mode: EditorMode.VERTEX,
    movingVert: -1,
    creatingSectorVerts: [],
    lastMousePos: new Vec2(),
};

function editorTransform(v) : Vec2 {
    return v.scale(editor.zoom).sub(editor.offset);
}

function editorUntransform(v) : Vec2 {
    return v.add(editor.offset).scale(1 / editor.zoom);
}

function editorPickVertex(pos : Vec2) : number {
    const dist = 0.75;

    for (var i = 0; i < level.vertices.length; i++) {
        let v = level.vertices[i];
        if (v.sub(pos).mag() < dist) {
            return i;
        }
    }

    return -1;
}

function editorFrame(delta: number) {
    const speed = editor.zoom * 25 * delta;

    if (controls[0])
        editor.offset.y -= speed;
    if (controls[1])
        editor.offset.y += speed;
    if (controls[2])
        editor.offset.x -= speed;
    if (controls[3])
        editor.offset.x += speed;
    
    if (editor.movingVert != -1) {
        let pos = editorUntransform(editor.lastMousePos);
        level.vertices[editor.movingVert] = pos;
    }

    ctx.fillStyle = "#222034";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#9badb7";
    ctx.fillText(editor.mode == EditorMode.VERTEX ? "VERTEX MODE" : "SECTOR MODE", 5, canvas.height - 6);

    level.sectors.forEach(s => {
        for (var i = 0; i < s.edges.length; i++) {
            let e = s.edges[i];
            var v0 = editorTransform(level.vertices[e.vertA]);

            if (i == 0) {
                ctx.beginPath();
                ctx.moveTo(v0.x, v0.y);
            } else {
                ctx.lineTo(v0.x, v0.y);
            }

            if (i == s.edges.length - 1) {
                ctx.closePath();
                ctx.strokeStyle = "#FFFFFF";
                ctx.stroke();
                ctx.fillStyle = "#d9a066";
                ctx.fill();   
            }
        }
    });

    for (var i = 0; i < editor.creatingSectorVerts.length; i++) {
        let v = level.vertices[editor.creatingSectorVerts[i]];
        var v0 = editorTransform(v);

        if (i == 0) {
            ctx.beginPath();
            ctx.moveTo(v0.x, v0.y);
        } else {
            ctx.lineTo(v0.x, v0.y);
        }

        if (i == editor.creatingSectorVerts.length - 1) {
            ctx.strokeStyle = "#FFFFFF";
            ctx.stroke();
        }
    }

    level.vertices.forEach(v => {
        let tv = editorTransform(v);
        
        ctx.fillStyle = "#df7126";
        ctx.fillRect(tv.x - 1, tv.y - 1, 2, 2);
    });

    let tv = editorTransform(camera.position);
    ctx.fillStyle = "#bf1111";
    ctx.fillRect(tv.x - 2, tv.y - 2, 4, 4);
}

function findSector(vertA, vertB) : [number, number] {
    for (let i = 0; i < level.sectors.length; i++) {
        for (let j = 0; j < level.sectors[i].edges.length; j++) {
            let e = level.sectors[i].edges[j];
            if ((e.vertA == vertA && e.vertB == vertB) || (e.vertA == vertB && e.vertB == vertA))
                return [i, j];
        }
    }
    return [-1, -1];
}

function editorCreateSector() {
    let edges = [];
    const len = editor.creatingSectorVerts.length;

    // clockwiseness check
    let sum = 0;
    for (let i = 0; i < len; i++) {
        let vertA = level.vertices[editor.creatingSectorVerts[i]];
        let vertB = level.vertices[editor.creatingSectorVerts[(i + 1) % len]];
        sum += (vertB.x - vertA.x) * (vertB.y + vertA.y);
    }

    if (sum > 0) {
        editor.creatingSectorVerts = editor.creatingSectorVerts.reverse();
    }

    for (let i = 0; i < len; i++) {
        let vertA = editor.creatingSectorVerts[i];
        let vertB = editor.creatingSectorVerts[(i + 1) % len];
        let result = findSector(vertA, vertB);
        if (result[0] != -1) {
            level.sectors[result[0]].edges[result[1]].sector = level.sectors.length;
        }
        let edge = new Edge(vertA, vertB, result[0]);
        edges.push(edge);
    }

    let sector = new Sector(edges, 1, 1);
    level.sectors.push(sector);
    editor.creatingSectorVerts = [];
}

function editorMouseEvent(evt : MouseEvent, state: boolean) {
    const rect = canvas.getBoundingClientRect();
    const mpos = new Vec2(evt.clientX - rect.left, evt.clientY - rect.top).scale(canvas.width / rect.width);
    const pos = editorUntransform(mpos);

    if (editor.mode == EditorMode.VERTEX) {
        if (evt.button == 0) {
            if (state) {
                let vi = editorPickVertex(pos);

                if (vi != -1) {
                    editor.movingVert = vi;
                } else {
                    level.vertices.push(pos);
                }
            } else {
                if (editor.movingVert != -1)
                    editor.movingVert = -1;
            }
        } else if (evt.button == 1) {
            if (state) {
                let vi = editorPickVertex(pos);

                if (vi != -1) {
                    // remove vert. fucks everything up
                }
            }
        }
    } else {
        if (evt.button == 0 && state) {
            let vi = editorPickVertex(pos);

            if (vi != -1) {
                if (editor.creatingSectorVerts.length != 0) {
                    if (vi == editor.creatingSectorVerts[0]) {
                        editorCreateSector();
                        return;
                    }
                }
                editor.creatingSectorVerts.push(vi);
            }
        }
    }
}

function editorSwitchModes() {
    editor.mode = editor.mode == EditorMode.VERTEX ? EditorMode.SECTOR : EditorMode.VERTEX;
    editor.movingVert = -1;
    editor.creatingSectorVerts = [];
}

function editorToggle() {
    editor.editing = !editor.editing;
    editor.movingVert = -1;
    editor.creatingSectorVerts = [];
}
