


class Sector {
    edges: Edge[];
    floorHeight: number;
    ceilingHeight: number;
    floorTex: number;
    ceilTex: number;
    texScale: number;
    sprites: Sprite[];

    static numDrawnSectors = 0;
    static maxDrawnSectors = 1;

    constructor(edges: Edge[], floorTex: number = 0, ceilTex: number = 0, floorHeight: number = 0, ceilingHeight: number = 6, texScale: number = 4) {
        this.edges = edges;
        this.floorTex = floorTex;
        this.ceilTex = ceilTex;
        this.floorHeight = floorHeight;
        this.ceilingHeight = ceilingHeight;
        this.texScale = texScale;
        this.sprites = new Array();
    }

    private projHorizontalPoint(x: number, y: number, ceil: boolean): Vec2 {
        let h = ceil ? this.ceilingHeight : this.floorHeight;

        let yc = (y / canvas.height - 0.5) * 2;
        let z = -(h - camera.eyePos) / yc;
        let xc = (x / canvas.width - 0.5) * 2 * z;

        let px = (xc * camera.nCos - z * camera.nSin + camera.position.y) * this.texScale;
        let py = (xc * camera.nSin + z * camera.nCos + camera.position.x) * this.texScale;

        return new Vec2(px, py);
    }

    private drawFlat(windowLeft: number, windowRight: number, windowTop: number, windowBottom: number, ceil: boolean, region: [number, number][]) {
        let tex = textures[ceil ? this.ceilTex : this.floorTex];

        for (let y = windowTop; y < windowBottom; y++) {
            let h = ceil ? this.ceilingHeight : this.floorHeight;

            let yc = (y / canvas.height - 0.5) * 2;
            let z = -(h - camera.eyePos) / yc;

            let p0 = this.projHorizontalPoint(windowLeft, y, ceil);
            let p1 = this.projHorizontalPoint(windowRight, y, ceil);

            for (let x = windowLeft; x < windowRight; x++) {
                
                if (y >= region[x - windowLeft][0] && y < region[x - windowLeft][1]) {
                    let complete = (x - windowLeft) / (windowRight - windowLeft);

                    let tx = Math.floor(lerp(p0.x, p1.x, complete)) & (tex.width - 1);
                    let ty = Math.floor(lerp(p0.y, p1.y, complete)) & (tex.width - 1);

                    let color = applyFog(tex.pixels[tx + ty * tex.width], z);
                    let i = (x + y * canvas.width) * 4;
                    data[i]     = color.r;
                    data[i + 1] = color.g;
                    data[i + 2] = color.b;
                }
            }
        }
    }

    public draw(depth: number, windowLeft: number, windowRight: number, windowTop: number, windowBottom: number) { // , windowRegion: [number, number][]
        // await debugPause();
        if (Sector.numDrawnSectors >= Sector.maxDrawnSectors) {
            return;
        }
        Sector.numDrawnSectors++;

        if (depth >= maxDepth) {
            return;
        }

        var drawCalls : [number, number, number, number, number][] = new Array();

        let ceilLowest = 0;
        let floorHighest = canvas.height;

        let ceilingRegion : [number, number][] = new Array(windowRight - windowLeft);
        let floorRegion : [number, number][] = new Array(windowRight - windowLeft);

        for (let x = 0; x < windowRight - windowLeft; x++) {
            ceilingRegion[x] = [0, 0];
            floorRegion[x]   = [0, 0];

            ceilingRegion[x][0] = portalRegion[windowLeft + x][0];
            ceilingRegion[x][1] = portalRegion[windowLeft + x][1];

            floorRegion[x][0] = portalRegion[windowLeft + x][0];
            floorRegion[x][1] = portalRegion[windowLeft + x][1];
        }

        
        for (var k = 0; k < this.edges.length; k++) {
            let v = this.edges[k];
            // y is x
            // x is z
            let left = level.vertices[v.vertA].sub(camera.position).rotate(-camera.angle);
            let right = level.vertices[v.vertB].sub(camera.position).rotate(-camera.angle);

            const znear = 0.0; //0.001
            if (left.x <= znear && right.x <= znear) {
                continue;
            }

            let leftClipped = left;
            let rightClipped = right;

            let cutLeft = false;
            let leftCutAmount = 0;
            if (left.x <= znear) {
                leftClipped = Vec2.lineIntersection(left, right, new Vec2(znear, -1), new Vec2(znear, 1));
                leftClipped.x += 0.01;
                leftCutAmount = 1 - (leftClipped.x - rightClipped.x) / (left.x - right.x);
                cutLeft = true;
            }
            let cutRight = false;
            let rightCutAmount = 1;
            if (right.x <= znear) {
                rightClipped = Vec2.lineIntersection(left, right, new Vec2(znear, -1), new Vec2(znear, 1));
                rightClipped.x += 0.01;
                rightCutAmount = (rightClipped.x - leftClipped.x) / (right.x - left.x);
                cutRight = true;
            }
            let leftX = (leftClipped.y / (leftClipped.x * camera.hfov) + 1) / 2 * canvas.width;
            let leftXS = Math.floor(leftX);
            let rightX = (rightClipped.y / (rightClipped.x * camera.hfov) + 1) / 2 * canvas.width;
            let rightXS = Math.floor(rightX);

            // tex scale, todo: precompute these
            let horScale = right.sub(left).mag() / 8 * v.texScale.x;
            
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

            const lvz = leftClipped.x * camera.vfov;
            const rvz = rightClipped.x * camera.vfov;

            // for now, use sector heights
            let leftY0  = (1 - (this.ceilingHeight - camera.eyePos) / lvz) / 2 * canvas.height;
            let leftY0S = Math.floor(leftY0);
            let leftY1  = (1 - (this.floorHeight - camera.eyePos) / lvz) / 2 * canvas.height;
            let leftY1S = Math.floor(leftY1);

            let rightY0  = (1 - (this.ceilingHeight - camera.eyePos) / rvz) / 2 * canvas.height;
            let rightY0S = Math.floor(rightY0);
            let rightY1  = (1 - (this.floorHeight - camera.eyePos) / rvz) / 2 * canvas.height;
            let rightY1S = Math.floor(rightY1);

            let x0 = Math.max(leftXS, windowLeft);
            let x1 = Math.min(rightXS, windowRight);

            var color : Color;

            var tex = textures[v.texture];

            if (v.sector == -1) { // ===================== normal wall =====================
                let verScale = (this.ceilingHeight - this.floorHeight) / 8 * v.texScale.y;

                for (var x = x0; x < x1; x++) {
                    let complete = clamp((x - leftX) / (rightX - leftX), 0, 1);
                    let wallStart = Math.floor(lerp(leftY0, rightY0, complete));
                    let floorStart = Math.floor(lerp(leftY1, rightY1, complete));
                    
                    if (wallStart >= 0 && wallStart < canvas.height && wallStart > ceilLowest) ceilLowest = wallStart;
                    if (wallStart < ceilingRegion[x - windowLeft][1]) ceilingRegion[x - windowLeft][1] = wallStart; // dont need to clamp
                    
                    if (floorStart >= 0 && floorStart < canvas.height && floorStart < floorHighest) floorHighest = floorStart;
                    if (floorStart > floorRegion[x - windowLeft][0]) floorRegion[x - windowLeft][0] = floorStart;

                    let z = 1 / lerp(leftZInv, rightZInv, complete);
                    let u = lerp(leftUZ, rightUZ, complete) * z;
                    let texX = Math.floor(u * tex.width) & (tex.width - 1);

                    let y0 = portalRegion[x][0];
                    let y1 = portalRegion[x][1];
                    for (var y = y0; y < y1; y++) {
                        if (y >= wallStart && y < floorStart) {
                            let texY = Math.round((y - wallStart) / (floorStart - wallStart) * tex.height * verScale) & (tex.height - 1);
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);

                            let i = (x + y * canvas.width) * 4;
                            data[i]     = color.r;
                            data[i + 1] = color.g;
                            data[i + 2] = color.b;
                        }
                    }
                }
            } else { // ===================== portal =====================
                let deltaFloor = level.sectors[v.sector].floorHeight - this.floorHeight;
                let deltaCeiling = level.sectors[v.sector].ceilingHeight - this.ceilingHeight;

                let topVerScale = -deltaCeiling / 8 * v.texScale.y;
                let bottomVerScale = deltaFloor / 8 * v.texScale.y;
                
                let leftPortalY0 = leftY0S;
                let rightPortalY0 = rightY0S;

                let leftPortalY1 = leftY1S;
                let rightPortalY1 = rightY1S;

                if (deltaCeiling < 0) {
                    // draw upper wall
                    leftPortalY0  = (this.ceilingHeight + deltaCeiling - camera.eyePos) / lvz;
                    leftPortalY0  = Math.floor((1 - leftPortalY0) / 2 * canvas.height);
                    rightPortalY0 = (this.ceilingHeight + deltaCeiling - camera.eyePos) / rvz;
                    rightPortalY0 = Math.floor((1 - rightPortalY0) / 2 * canvas.height);
                }

                if (deltaFloor > 0) {
                    // draw lower wall
                    rightPortalY1 = (this.floorHeight + deltaFloor - camera.eyePos) / rvz;
                    rightPortalY1 = Math.floor((1 - rightPortalY1) / 2 * canvas.height);
                    leftPortalY1  = (this.floorHeight + deltaFloor - camera.eyePos) / lvz;
                    leftPortalY1  = Math.floor((1 - leftPortalY1) / 2 * canvas.height);
                }

                let nextWindowTop = canvas.height;
                let nextWindowBottom = 0;

                for (var x = x0; x < x1; x++) {
                    let complete = clamp((x - leftX) / (rightX - leftX), 0, 1);
                    let topWallStart    = Math.floor(lerp(leftY0, rightY0, complete));
                    let portalStart     = Math.floor(lerp(leftPortalY0, rightPortalY0, complete));
                    let bottomWallStart = Math.ceil(lerp(leftPortalY1, rightPortalY1, complete));
                    let floorStart      = Math.floor(lerp(leftY1, rightY1, complete));

                    if (portalStart > floorStart) {
                        portalStart = floorStart + 1;
                    }

                    if (topWallStart >= 0 && topWallStart < canvas.height && topWallStart > ceilLowest) ceilLowest = topWallStart;
                    if (topWallStart < ceilingRegion[x - windowLeft][1]) ceilingRegion[x - windowLeft][1] = topWallStart;
                
                    if (floorStart >= 0 && floorStart < canvas.height && floorStart < floorHighest) floorHighest = floorStart;
                    if (floorStart > floorRegion[x - windowLeft][0]) floorRegion[x - windowLeft][0] = floorStart;
                    
                    let clampedPortalStart = clamp(portalStart, 0, canvas.height);
                    if (clampedPortalStart < nextWindowTop) {
                        nextWindowTop = clampedPortalStart;
                    }

                    let clampedBottomWallStart = clamp(bottomWallStart, 0, canvas.height);
                    if (clampedBottomWallStart > nextWindowBottom) {
                        nextWindowBottom = clampedBottomWallStart;
                    }

                    let z = 1 / lerp(leftZInv, rightZInv, complete);
                    let u = lerp(leftUZ, rightUZ, complete) * z;
                    let texX = Math.floor(u * tex.width) & (tex.width - 1);

                    let y0 = portalRegion[x][0];
                    let y1 = portalRegion[x][1];
                    for (var y = y0; y < y1; y++) {
                        let i = (x + y * canvas.width) * 4;
                        if (y >= topWallStart && y < portalStart) {
                            let texY = Math.floor((y - portalStart) / (portalStart - topWallStart) * tex.height * topVerScale) & (tex.height - 1);
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);
                            
                            data[i]     = color.r;
                            data[i + 1] = color.g;
                            data[i + 2] = color.b;
                        }
                        
                        if (y >= bottomWallStart && y < floorStart) {
                            let texY = Math.floor((y - bottomWallStart) / (floorStart - bottomWallStart) * tex.height * bottomVerScale) & (tex.height - 1);
                            color = tex.pixels[texX * tex.height + texY];
                            color = applyFog(color, z);
                            
                            data[i]     = color.r;
                            data[i + 1] = color.g;
                            data[i + 2] = color.b;
                        }

                    }

                    portalRegion[x][0] = clamp(Math.max(portalStart, portalRegion[x][0]), 0, canvas.height);
                    portalRegion[x][1] = clamp(Math.min(bottomWallStart, portalRegion[x][1]), 0, canvas.height);


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

                
                level.sectors[v.sector].draw(depth + 1, leftXS, rightXS, nextWindowTop, nextWindowBottom);
                // drawCalls.push([v.sector, leftXS, rightXS, nextWindowTop, nextWindowBottom]);
            }
        }

        this.drawFlat(windowLeft, windowRight, 0, canvas.height, true, ceilingRegion);
        this.drawFlat(windowLeft, windowRight, 0, canvas.height, false, floorRegion);
        this.visualizeRegion(windowLeft, ceilingRegion, new Color(255, 0, 0));

        // this.drawFlat(windowLeft, windowRight, windowTop, ceilLowest, true, ceilingRegion);
        // this.drawFlat(windowLeft, windowRight, floorHighest, windowBottom, false, floorRegion);

        // drawCalls.forEach(c => {
        //     level.sectors[c[0]].draw(depth + 1, c[1], c[2], c[3], c[4]);
        // });
        
        //this.drawSprites(windowLeft, windowRight);
    }

    public drawSprites(windowLeft: number, windowRight: number) {
        this.sprites.forEach(s => {
            s.draw(windowLeft, windowRight);
        });
    }

    public checkAndCollideCam(cam: Camera, checkIfOutside: boolean) {
        let totalPush = new Vec2();

        this.edges.forEach((v, i) => {
            let vec = v.vector();
            let localCam = cam.position.sub(level.vertices[v.vertA]);
            let proj = v.projVec(localCam);
            if (proj < -camera.radius / 2 || proj > vec.mag() + camera.radius / 2)
                return;
            
            let projVec = vec.normalized().scale(proj);

            let solid = v.sector == -1 || (this.floorHeight - camera.yPos) > 0.75 || (this.ceilingHeight - camera.eyePos) < 0.2;
            if (solid) {
                let reject = localCam.sub(projVec);
                let rejMag = reject.mag();
                if (rejMag < camera.radius) {
                    let push = reject.normalized().scale(camera.radius - rejMag);
                    totalPush = totalPush.add(push);
                }
            } else if (checkIfOutside) {
                if (v.side(cam.position) > 0) {
                    changeSector(v.sector);
                }
            }
        });

        camera.position = camera.position.add(totalPush);
    }

    private visualizeRegion(left: number, region: [number, number][], color: Color) {
        for (let x = 0; x < region.length; x++) {
            for (let y = 0; y < 2; y++) {
                let i = (left + x + region[x][y] * canvas.width) * 4;
                data[i]     = color.r;
                data[i + 1] = color.g;
                data[i + 2] = color.b;
            }
        }
    }
}
