


class Sector {
    edges: Edge[];
    floorHeight: number;
    ceilingHeight: number;
    floorTex: number;
    ceilTex: number;
    texScale: number;

    constructor(edges: Edge[], floorTex: number = 0, ceilTex: number = 0, floorHeight: number = 0, ceilingHeight: number = 6, texScale: number = 4) {
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

    public draw(depth: number, windowLeft: number, windowRight: number) {
        // await debugPause();

        if (depth >= maxDepth) {
            return;
        }
        
        for (var k = 0; k < this.edges.length; k++) {
            let v = this.edges[k];

            const hfov = Math.tan(camera.fov / 2 * to_rad); 
            const vfov = Math.tan(camera.fov / 2 * to_rad);
            // y is x
            // x is z
            let left = level.vertices[v.vertA].sub(camera.position).rotate(-camera.angle);
            let right = level.vertices[v.vertB].sub(camera.position).rotate(-camera.angle);

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
            let leftX = (leftClipped.y / (leftClipped.x * hfov) + 1) / 2 * canvas.width;
            let leftXS = Math.floor(leftX);
            let rightX = (rightClipped.y / (rightClipped.x * hfov) + 1) / 2 * canvas.width;
            let rightXS = Math.floor(rightX);

            if (cutLeft && cutRight) {
                //leftX = 0;
                //rightX = canvas.width;
            }

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

                level.sectors[v.sector].draw(depth + 1, leftXS, rightXS);
            }
        }
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


            let solid = v.sector == -1 || (this.floorHeight - camera.height) > -0.75 || (this.ceilingHeight - camera.height) < 0.2;
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
}
