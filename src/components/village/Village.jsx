import { useEffect, useRef } from 'react';
import './Village.scss';

const W = 384;
const H = 216;
const SKY_H = 96; // osmon balandligi
const REFLECT = 207; // osmon va suvdagi aks o'rtasidagi "oyna chizig'i"

/* ---------- yordamchilar ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => {
    const k = clamp(t, 0, 1);
    return k * k * (3 - 2 * k);
};
const mk = (w, h) => {
    const e = document.createElement('canvas');
    e.width = w;
    e.height = h;
    return e;
};
const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const rgb = (a) => `rgb(${Math.round(a[0])},${Math.round(a[1])},${Math.round(a[2])})`;
const ramp = (stops, t) => {
    for (let i = 1; i < stops.length; i++) {
        if (t <= stops[i][0]) {
            const [p0, c0] = stops[i - 1];
            const [p1, c1] = stops[i];
            const k = (t - p0) / (p1 - p0);
            const A = hex(c0);
            const B = hex(c1);
            return A.map((v, j) => v + (B[j] - v) * k);
        }
    }
    return hex(stops[stops.length - 1][1]);
};
const palette = (stops, n) =>
    Array.from({ length: n }, (_, i) => rgb(ramp(stops, i / (n - 1))));
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x, y) => BAY[((y & 3) << 2) + (x & 3)] / 16;

// piksel doira
const pc = (ctx, cx, cy, r, col) => {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
        ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
    }
};

/* ---------- relyef: ko'lmak, yer, yo'l ---------- */
const POND_TOP = [[0, 136], [80, 134], [150, 135], [200, 140], [245, 150], [280, 162], [303, 176]];
const pondTop = (x) => {
    for (let i = 1; i < POND_TOP.length; i++) {
        if (x <= POND_TOP[i][0]) {
            const a = POND_TOP[i - 1];
            const b = POND_TOP[i];
            return lerp(a[1], b[1], smooth((x - a[0]) / (b[0] - a[0])));
        }
    }
    return 176;
};
const inPond = (x, y) => {
    if (x < 0 || x > 303 || y < pondTop(x)) return false;
    if (y > 176 && x > 303 - (y - 176) * 0.9) return false;
    if ((x / 46) ** 2 + ((y - 218) / 26) ** 2 < 1) return false; // pastki chap qirg'oq
    if (((x - 197) / 22) ** 2 + ((y - 219) / 10) ** 2 < 1) return false; // qamishli orolcha
    return true;
};
const groundTop = (x) =>
    Math.round(88 + 2 * Math.sin(x * 0.04 + 1) + 1.2 * Math.sin(x * 0.13) - 6 * smooth((x - 240) / 90));

// [y, markaz x, kenglik] (y o'sish tartibida)
const PATH = [[97, 311, 4], [102, 292, 4], [111, 270, 5], [122, 246, 6], [134, 226, 7], [146, 212, 8]];
const pathAt = (y) => {
    if (y <= PATH[0][0]) return [PATH[0][1], PATH[0][2]];
    for (let i = 1; i < PATH.length; i++) {
        if (y <= PATH[i][0]) {
            const a = PATH[i - 1];
            const b = PATH[i];
            const k = smooth((y - a[0]) / (b[0] - a[0]));
            return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
        }
    }
    const l = PATH[PATH.length - 1];
    return [l[1], l[2]];
};
const onPath = (x, y, m = 0) => {
    if (y < 97 || y > 147) return false;
    const [cx, w] = pathAt(y);
    return Math.abs(x - cx) < w / 2 + m;
};

// suv ustidagi halqa (ellips chizig'i)
const ring = (ctx, cx, cy, rx, ry) => {
    const n = Math.ceil(2 * Math.PI * Math.max(rx, ry) * 1.3);
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
    }
};

/* ---------- sahna ---------- */
function createScene(c) {
    const g = c.getContext('2d');
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const K = RM ? 0.35 : 1;

    let seed = 424242;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    // ko'lmak niqobi (aks faqat suv ichida ko'rinadi)
    const pondMask = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) pondMask[y * W + x] = inPond(x, y) ? 1 : 0;
    const inP = (x, y) => x >= 0 && x < W && y >= 0 && y < H && pondMask[y * W + x] === 1;
    const maskC = mk(W, H);
    const mc = maskC.getContext('2d');
    mc.fillStyle = '#fff';
    for (let y = 0; y < H; y++) {
        let x = 0;
        while (x < W) {
            if (!inP(x, y)) { x++; continue; }
            let e = x;
            while (e < W && inP(e, y)) e++;
            mc.fillRect(x, y, e - x, 1);
            x = e;
        }
    }

    // ----- osmon -----
    const skyC = mk(W, H);
    const sg = skyC.getContext('2d');
    const SKY = palette(
        [[0, '#05070c'], [0.4, '#0b1017'], [0.72, '#161d25'], [1, '#27313a']],
        12
    );
    for (let y = 0; y < SKY_H; y++) {
        for (let x = 0; x < W; x++) {
            const v = Math.pow(y / SKY_H, 1.5);
            sg.fillStyle = SKY[clamp(Math.floor(v * 11 + bayer(x, y)), 0, 11)];
            sg.fillRect(x, y, 1, 1);
        }
    }

    // ----- yarim oy, nur va suvdagi aksi -----
    const MX = 231, MY = 31, MR = 11;
    const moonC = mk(MR * 2 + 3, MR * 2 + 3);
    const mg = moonC.getContext('2d');
    for (let y = -MR; y <= MR; y++) {
        for (let x = -MR; x <= MR; x++) {
            if (x * x + y * y > MR * MR) continue;
            const d2 = (x - 4) ** 2 + (y + 2) ** 2;
            if (d2 <= 10 * 10) continue;
            mg.fillStyle = d2 < 12 * 12 ? '#d6dba0' : '#f1f4c6';
            mg.fillRect(x + MR + 1, y + MR + 1, 1, 1);
        }
    }
    const moonRef = mk(MR * 2 + 3, MR * 2 + 3);
    const mrg = moonRef.getContext('2d');
    mrg.translate(0, moonRef.height);
    mrg.scale(1, -1);
    mrg.drawImage(moonC, 0, 0);

    const haloC = mk(70, 70);
    const hl = haloC.getContext('2d');
    for (let y = 0; y < 70; y++) {
        for (let x = 0; x < 70; x++) {
            const d = Math.hypot(x - 35, y - 35);
            if (d > 32) continue;
            const v = Math.pow(1 - d / 32, 1.6);
            if (d < 17 || v > bayer(x, y) * 0.7) {
                hl.fillStyle = d < 17 ? '#2f524a' : '#44766a';
                hl.fillRect(x, y, 1, 1);
            }
        }
    }

    // ----- yulduzlar -----
    const stars = [];
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(rnd() * W);
        const y = Math.floor(Math.pow(rnd(), 1.3) * 74);
        if ((x - MX) ** 2 + (y - MY) ** 2 < 15 * 15) continue;
        const big = i < 7;
        const cols = ['#ffffff', '#dfe9ff', '#f4f0cf'];
        stars.push({
            x, y, big,
            p: rnd() * 6.28,
            sp: 0.8 + rnd() * 2.2,
            c: cols[Math.floor(rnd() * cols.length)],
        });
    }

    // ----- uchayotgan yulduzlar -----
    const shots = [];
    let nextShot = 1;
    const shoot = (x = 150 + rnd() * 230, y = 5 + rnd() * 30) => {
        const sp = 80 + rnd() * 30;
        shots.push({ x, y, vx: -sp * 0.85, vy: sp * 0.5, life: 0, max: 1 + rnd() * 0.5 });
    };
    const drawShot = (ctx, s, mirror, mul) => {
        const fade = 1 - s.life / s.max;
        for (let k = 0; k < 30; k++) {
            ctx.globalAlpha = Math.max(0, fade * (1 - k / 30)) * mul;
            ctx.fillStyle = k < 3 ? '#ffffff' : k < 12 ? '#d8f0ea' : '#8fb8b4';
            const x = Math.round(s.x - s.vx * k * 0.011);
            const y = Math.round(s.y - s.vy * k * 0.011);
            ctx.fillRect(x, mirror ? REFLECT - y : y, 1, 1);
        }
    };

    // ----- daraxt va buta chizish -----
    const TREE_PAL = ['#142218', '#1f3426', '#2c4631', '#3f5e43'];
    const FAR_PAL = ['#0b140f', '#101c14', '#17271c', '#223629'];
    const BUSH_PAL = ['#0a130d', '#101d14', '#192b1d', '#27402c'];
    const leafy = (ctx, cx, cy, rx, ry, pal) => {
        ctx.fillStyle = pal[0];
        for (let y = -ry; y <= ry; y++) {
            const w = Math.round(rx * Math.sqrt(1 - (y / ry) ** 2));
            ctx.fillRect(cx - w, cy + y, 2 * w + 1, 1);
        }
        const n = Math.round(rx * ry * 0.25);
        for (let i = 0; i < n; i++) {
            const a = rnd() * 6.283;
            const rad = Math.sqrt(rnd());
            const x = cx + Math.cos(a) * rx * rad;
            const y = cy + Math.sin(a) * ry * rad;
            const lit = ((x - cx) / rx) * 0.8 - ((y - cy) / ry) * 0.9;
            const col = lit > 0.5 ? pal[3] : lit > 0.1 ? pal[2] : lit > -0.35 ? pal[1] : pal[0];
            pc(ctx, Math.round(x), Math.round(y), 1 + Math.floor(rnd() * 3), col);
        }
    };

    // ----- orqa qatlam -----
    const backC = mk(W, H);
    const bg = backC.getContext('2d');

    // yer
    const GR = palette(
        [[0, '#060a08'], [0.4, '#101a13'], [0.7, '#1f2d22'], [1, '#35493a']],
        9
    );
    for (let x = 0; x < W; x++) {
        for (let y = groundTop(x); y < H; y++) {
            const d = clamp((y - 88) / 128, 0, 1);
            let b = 0.1 + 0.62 * Math.pow(1 - d, 1.25);
            b += 0.16 * Math.exp(-(((x - 300) ** 2) / 9000 + ((y - 100) ** 2) / 600));
            b += (rnd() - 0.5) * 0.08;
            bg.fillStyle = GR[clamp(Math.floor(b * 8 + bayer(x, y)), 0, 8)];
            bg.fillRect(x, y, 1, 1);
        }
    }
    // uzoqdagi daraxtlar chizig'i
    for (let x = 0; x < W; x += 4 + Math.floor(rnd() * 6)) {
        pc(bg, x, groundTop(x) + 1, 2 + Math.floor(rnd() * 3), '#09100c');
    }

    // tuproq yo'l
    const PP = ['#1f241c', '#2c3026', '#3a3d30', '#4a4b3a', '#5c5a46'];
    for (let y = 96; y < 148; y++) {
        const [cx, w] = pathAt(y);
        for (let x = Math.floor(cx - w / 2 - 1); x <= Math.ceil(cx + w / 2 + 1); x++) {
            const d = Math.abs(x - cx) / (w / 2);
            if (d > 1 || inP(x, y)) continue;
            if (d > 0.88 && rnd() < 0.45) continue;
            const b = 0.62 - d * 0.4 + (rnd() - 0.5) * 0.3;
            bg.fillStyle = PP[clamp(Math.floor(b * 4 + bayer(x, y)), 0, 4)];
            bg.fillRect(x, y, 1, 1);
        }
    }

    // uy orqasidagi daraxtlar
    leafy(bg, 293, 76, 8, 7, FAR_PAL);
    leafy(bg, 351, 67, 12, 10, FAR_PAL);
    leafy(bg, 373, 73, 9, 9, FAR_PAL);
    leafy(bg, 247, 79, 5, 5, FAR_PAL);
    leafy(bg, 137, 80, 6, 6, FAR_PAL);
    bg.fillStyle = '#0d0f0c';
    bg.fillRect(136, 85, 2, 6);
    bg.fillRect(246, 83, 2, 6);

    // yog'och uy (statik qism)
    const wins = [
        { x: 322, y: 87, w: 5, h: 5, p: 0.4, s: 0.7 },
        { x: 335, y: 87, w: 5, h: 5, p: 2.0, s: 0.5 },
    ];
    (() => {
        bg.fillStyle = '#2e2a28'; // mo'ri
        bg.fillRect(331, 58, 4, 9);
        bg.fillStyle = '#4a4542';
        bg.fillRect(331, 58, 1, 9);
        for (let y = 84; y < 97; y++) { // devor (bo'rtmalar)
            bg.fillStyle = (y - 84) % 2 ? '#4a3629' : '#3a2a20';
            bg.fillRect(303, y, 40, 1);
        }
        for (let y = 84; y < 97; y += 2) { // burchak bo'rtmalari
            bg.fillStyle = '#5a4434';
            bg.fillRect(301, y, 3, 2);
            bg.fillRect(342, y, 3, 2);
        }
        for (let i = 0; i < 19; i++) { // tom
            const l = 299 + Math.round(i * 0.75);
            const r = 347 - Math.round(i * 0.75);
            bg.fillStyle = i === 18 ? '#4a4038' : i % 3 === 2 ? '#2b211b' : '#1f1814';
            bg.fillRect(l, 83 - i, r - l, 1);
            bg.fillStyle = '#5c4e44';
            bg.fillRect(l, 83 - i, 1, 1);
        }
        bg.fillStyle = '#2a1a12'; // eshik
        bg.fillRect(309, 88, 5, 9);
        bg.fillStyle = '#6b5a2a';
        bg.fillRect(310, 90, 3, 3);
        wins.forEach((w) => {
            bg.fillStyle = '#1e140e';
            bg.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
        });
    })();

    // chap katta daraxt va butalar
    leafy(bg, 18, 56, 27, 23, TREE_PAL);
    bg.fillStyle = '#1a1511';
    bg.fillRect(14, 72, 6, 32);
    bg.fillStyle = '#2a2119';
    bg.fillRect(14, 72, 1, 32);
    leafy(bg, 50, 114, 17, 11, BUSH_PAL);
    leafy(bg, 92, 117, 19, 12, BUSH_PAL);
    leafy(bg, 6, 117, 14, 9, BUSH_PAL);
    leafy(bg, 133, 97, 9, 4, BUSH_PAL);
    leafy(bg, 183, 97, 17, 5, BUSH_PAL);
    leafy(bg, 348, 98, 7, 4, BUSH_PAL);

    // suv
    const WT = palette([[0, '#04070a'], [0.5, '#0b1317'], [1, '#1d3236']], 8);
    for (let y = 120; y < H; y++) {
        for (let x = 0; x < 304; x++) {
            if (!inP(x, y)) continue;
            let b = 0.1 + 0.32 * Math.exp(-(((x - 231) / 40) ** 2 + ((y - 176) / 26) ** 2));
            b += (rnd() - 0.5) * 0.07;
            bg.fillStyle = WT[clamp(Math.floor(b * 7 + bayer(x, y)), 0, 7)];
            bg.fillRect(x, y, 1, 1);
        }
    }
    for (let i = 0; i < 70; i++) { // suvdagi qora chiziqlar
        const x = Math.floor(rnd() * 300);
        const y = 140 + Math.floor(rnd() * 74);
        if (!inP(x, y) || !inP(x + 6, y)) continue;
        bg.fillStyle = '#0d1a1e';
        bg.fillRect(x, y, 4 + Math.floor(rnd() * 8), 1);
    }

    // qirg'oq: tuproq chegara va o't lablari
    for (let y = 120; y < H; y++) {
        for (let x = 0; x < 308; x++) {
            if (inP(x, y)) {
                if (!inP(x, y - 1) || !inP(x + 1, y) || !inP(x - 1, y)) {
                    bg.fillStyle = '#2a211b';
                    bg.fillRect(x, y, 1, 1);
                }
            } else if ((inP(x, y + 1) || inP(x - 1, y) || inP(x + 1, y)) && rnd() < 0.7) {
                bg.fillStyle = '#41543a';
                bg.fillRect(x, y, 1, 1);
            }
        }
    }

    // suvdagi qora akslar (daraxt, butalar, to'siq)
    const blob = (cx, cy, rx, ry) => {
        bg.fillStyle = '#030605';
        for (let y = cy - ry; y <= cy + ry; y++) {
            for (let x = cx - rx; x <= cx + rx; x++) {
                if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && inP(x, y) && rnd() > 0.1) {
                    bg.fillRect(x, y, 1, 1);
                }
            }
        }
    };
    blob(16, 150, 26, 15);
    blob(52, 143, 15, 6);
    blob(92, 145, 18, 6);
    blob(14, 172, 26, 13);
    bg.fillStyle = '#04070a';
    for (let x = 130; x < 304; x++) {
        const t = Math.round(pondTop(x));
        if (x % 14 < 11 && inP(x, t + 4)) bg.fillRect(x, t + 4, 1, 1);
        if (x % 18 < 13 && inP(x, t + 9)) bg.fillRect(x, t + 9, 1, 1);
    }

    // o'ng pastdagi katta qorong'i buta
    leafy(bg, 360, 128, 30, 18, BUSH_PAL);

    // ----- o'tloq elementlari -----
    const GP = [
        ['#1b2a1e', '#34503a'], ['#24382a', '#45664d'], ['#2f4a35', '#58805f'],
        ['#3b5c42', '#6f9a76'], ['#49704f', '#89b38f'],
    ];
    const items = [];
    const free = (x, by) => {
        if (by < groundTop(x) + 2 || by >= H) return false;
        if (inP(Math.floor(x), by)) return false;
        if (onPath(x, by, 0)) return false;
        if (x > 296 && x < 350 && by < 98) return false;
        if (x > 8 && x < 26 && by < 105) return false;
        if (x < 112 && by < 128) return false;
        if (x > 123 && x < 143 && by < 100) return false;
        if (x > 172 && x < 195 && by < 101) return false;
        if (x > 316 && by > 108 && by < 148) return false;
        return true;
    };

    for (let i = 0; i < 2300; i++) {
        const x = rnd() * W;
        const by = Math.floor(90 + Math.pow(rnd(), 1.05) * 126);
        if (!free(x, by)) continue;
        const t = (by - 90) / 126;
        const idx = clamp(Math.floor(t * 4 + (rnd() - 0.5) * 1.6), 0, 4);
        items.push({
            k: 0, x, by, t,
            h: Math.round(2 + t * 6 * (0.5 + 0.9 * rnd())),
            amp: 0.5 + t * 1.8,
            lean: rnd() - 0.5,
            p: rnd() * 6.28,
            c0: GP[idx][0],
            c1: GP[idx][1],
        });
    }

    // gullar
    const FC = ['#e8f0e0', '#e8a0be', '#f4e8a0', '#c8b0f0'];
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(rnd() * W);
        const by = Math.floor(118 + rnd() * 96);
        if (!free(x, by)) continue;
        items.push({ k: 4, x, by, p: rnd() * 6.28, big: rnd() < 0.3, c: FC[Math.floor(rnd() * 4)] });
    }

    // qamishlar (orolcha va chap-pastki qirg'oqda)
    const reed = (x, h, cat, pink, cols) => {
        items.push({
            k: 5, x, by: 214 + Math.floor(rnd() * 2), h,
            amp: 2.2, lean: (rnd() - 0.5) * 2, p: rnd() * 6.28,
            c0: cols[0], c1: cols[1], cat, pink,
        });
    };
    for (let i = 0; i < 12; i++) {
        reed(180 + Math.floor(rnd() * 34), 14 + Math.floor(rnd() * 18), i % 5 === 0, false, ['#4f7a4a', '#8fbf86']);
    }
    for (let i = 0; i < 10; i++) {
        reed(2 + Math.floor(rnd() * 38), 12 + Math.floor(rnd() * 12), false, i % 3 === 0, ['#2d4a35', '#5a8a66']);
    }

    // tosh
    items.push({ k: 3, x: 303, by: 193, w: 10, h: 4 });

    // to'siq
    const posts = [140, 171, 205, 245, 287, 325].map((x) => ({
        k: 1, x,
        by: Math.round(123 + (x - 120) * 0.09),
        h: Math.round(13 + (x - 120) * 0.03),
        w: 3,
    }));
    posts.forEach((p, i) => {
        p.next = posts[i + 1] || null;
        items.push(p);
    });

    items.sort((a, b) => a.by - b.by);

    // ----- o't pashshalari -----
    const flies = Array.from({ length: 80 }, (_, i) => {
        const cluster = i < 48;
        return {
            bx: cluster ? 200 + rnd() * 170 : rnd() * W,
            by: cluster ? 92 + rnd() * 60 : 100 + rnd() * 105,
            ax: 6 + rnd() * 14,
            ay: 3 + rnd() * 8,
            sx: 0.2 + rnd() * 0.5,
            sy: 0.3 + rnd() * 0.6,
            p: rnd() * 6.28,
            q: rnd() * 6.28,
            blink: 0.6 + rnd() * 1.2,
        };
    });

    // ----- tutun va suv elementlari -----
    const smoke = Array.from({ length: 16 }, (_, i) => ({ t: i / 16 }));
    const shimmer = Array.from({ length: 46 }, () => ({
        x: rnd() * 300,
        y: 140 + rnd() * 72,
        w: 4 + rnd() * 10,
        p: rnd() * 6.28,
        sp: 0.3 + rnd() * 0.5,
    }));

    // aks qatlami
    const reflC = mk(W, H);
    const rg = reflC.getContext('2d');

    /* ---------- chizish yordamchilari ---------- */
    const drawRock = (it) => {
        for (let r = 0; r < it.h; r++) {
            const rw = Math.max(2, it.w - 2 * (it.h - 1 - r));
            g.fillStyle = r === 0 ? '#7e8288' : r < it.h - 1 ? '#5d6066' : '#3c3f45';
            g.fillRect(Math.round(it.x - rw / 2), it.by - it.h + 1 + r, rw, 1);
        }
    };

    const drawPost = (p) => {
        const hw = p.w >> 1;
        g.fillStyle = '#3c2a1c';
        g.fillRect(p.x - hw, p.by - p.h, p.w, p.h);
        g.fillStyle = '#5e432b';
        g.fillRect(p.x - hw, p.by - p.h, 1, p.h);
        g.fillStyle = '#2a1c12';
        g.fillRect(p.x - hw, p.by - p.h, p.w, 1);
        const n = p.next;
        if (!n) return;
        const clear = [0.2, 0.5, 0.8].every((f) => !onPath(lerp(p.x, n.x, f), lerp(p.by, n.by, f), 1));
        if (!clear) return;
        [0.78, 0.38].forEach((f) => {
            const thick = p.h > 16 ? 2 : 1;
            for (let s = 0; s <= n.x - p.x; s++) {
                const u = s / (n.x - p.x);
                const y = lerp(p.by - p.h * f, n.by - n.h * f, u);
                g.fillStyle = '#40301f';
                g.fillRect(p.x + s, Math.round(y), 1, thick);
                if (thick === 2) {
                    g.fillStyle = '#5e432b';
                    g.fillRect(p.x + s, Math.round(y), 1, 1);
                }
            }
        });
    };

    const drawStalk = (it, T) => {
        const wind =
            Math.sin(T * 0.9 * K + it.x * 0.03 - it.by * 0.015) * 0.6 +
            Math.sin(T * 0.4 * K + it.x * 0.011) * 0.4 +
            0.3;
        const top = wind * it.amp + it.lean * (it.k === 5 ? 3 : 1.6);
        g.fillStyle = wind > 0.95 ? it.c1 : it.c0;
        let runStart = 0;
        let curX = Math.round(it.x);
        for (let i = 1; i <= it.h; i++) {
            let nx = null;
            if (i < it.h) {
                const u = i / it.h;
                nx = Math.round(it.x + top * u * u + Math.sin(T * 2.4 * K + it.p + i * 0.5) * 0.2 * u);
            }
            if (nx !== curX) {
                g.fillRect(curX, it.by - i + 1, 1, i - runStart);
                runStart = i;
                curX = nx;
            }
        }
        const u2 = (it.h - 1) / it.h;
        const tx = Math.round(it.x + top * u2 * u2);
        g.fillStyle = it.c1;
        g.fillRect(tx, it.by - it.h + 1, 1, 1);
        if (it.cat) {
            g.fillStyle = '#5a3a24';
            g.fillRect(tx, it.by - it.h - 2, 1, 3);
        }
        if (it.pink) {
            g.fillStyle = '#f08ab0';
            g.fillRect(tx, it.by - it.h - 1, 2, 2);
        }
    };

    /* ---------- asosiy chizish ---------- */
    let T = 0;
    const draw = (dt) => {
        g.globalAlpha = 1;
        g.drawImage(skyC, 0, 0);

        // yulduzlar
        for (const s of stars) {
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * s.sp + s.p));
            g.globalAlpha = a;
            g.fillStyle = s.c;
            g.fillRect(s.x, s.y, 1, 1);
            if (s.big) {
                const L = a > 0.8 ? 2 : 1;
                g.fillRect(s.x - L, s.y, L, 1);
                g.fillRect(s.x + 1, s.y, L, 1);
                g.fillRect(s.x, s.y - L, 1, L);
                g.fillRect(s.x, s.y + 1, 1, L);
            }
        }
        g.globalAlpha = 1;

        // uchayotgan yulduzlar
        if (!RM) {
            nextShot -= dt;
            if (nextShot <= 0) {
                shoot();
                nextShot = 4 + rnd() * 6;
            }
            for (let i = shots.length - 1; i >= 0; i--) {
                const s = shots[i];
                s.life += dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                if (s.life > s.max || s.y > 78 || s.x < -4) {
                    shots.splice(i, 1);
                    continue;
                }
                drawShot(g, s, false, 1);
            }
            g.globalAlpha = 1;
        }

        // oy va nur
        g.globalAlpha = 0.3 * (0.85 + 0.15 * Math.sin(T * 0.7));
        g.drawImage(haloC, MX - 35, MY - 35);
        g.globalAlpha = 1;
        g.drawImage(moonC, MX - MR - 1, MY - MR - 1);

        // orqa qatlam
        g.drawImage(backC, 0, 0);

        // suvdagi aks (faqat ko'lmak ichida)
        rg.globalCompositeOperation = 'source-over';
        rg.clearRect(0, 0, W, H);
        rg.globalAlpha = 0.2;
        rg.drawImage(haloC, MX - 35, REFLECT - MY - 35);
        const mh = moonRef.height;
        const my0 = REFLECT - MY - MR - 1;
        rg.globalAlpha = 0.8;
        for (let r = 0; r < mh; r++) {
            const dx = Math.round(Math.sin(T * 1.6 * K + r * 0.9) * 1.4);
            rg.drawImage(moonRef, 0, r, mh, 1, MX - MR - 1 + dx, my0 + r, mh, 1);
        }
        for (const s of stars) {
            const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(T * s.sp + s.p));
            const y = REFLECT - s.y;
            rg.globalAlpha = 0.5 * a;
            rg.fillStyle = s.c;
            rg.fillRect(s.x + Math.round(Math.sin(T * 2 * K + y * 0.6) * 0.8), y, 1, 1);
        }
        for (const s of shots) drawShot(rg, s, true, 0.5);
        rg.fillStyle = '#3a5c60';
        for (const s of shimmer) {
            rg.globalAlpha = 0.12 + 0.14 * Math.sin(T * 1.2 * K + s.p);
            rg.fillRect(Math.round(s.x + Math.sin(T * s.sp * K + s.p) * 6), Math.round(s.y), Math.round(s.w), 1);
        }
        rg.globalAlpha = 1;
        rg.globalCompositeOperation = 'destination-in';
        rg.drawImage(maskC, 0, 0);
        rg.globalCompositeOperation = 'source-over';
        g.drawImage(reflC, 0, 0);

        // favvora / to'lqinlar
        const fx = 159, fy = 173;
        g.fillStyle = '#9fd0d4';
        for (let k = 0; k < 3; k++) {
            const ph = (T * 0.35 * K + k / 3) % 1;
            g.globalAlpha = 0.75 * (1 - ph) * (ph < 0.1 ? ph * 10 : 1);
            ring(g, fx, fy, 3 + ph * 21, 1 + ph * 5);
        }
        const jh = Math.round(26 * (0.75 + 0.25 * Math.sin(T * 2.2 * K)));
        g.globalAlpha = 0.85;
        g.fillStyle = '#7fb4bc';
        g.fillRect(fx, fy - jh, 1, jh);
        g.fillStyle = '#bfe6e8';
        g.fillRect(fx, fy - jh, 1, 2);
        g.fillStyle = '#d0f0f2';
        for (let i = 0; i < 10; i++) {
            const u = (T * 0.9 * K + i / 10) % 1;
            const vx = (i % 2 ? 1 : -1) * (2 + (i % 5));
            g.globalAlpha = 0.9 * (1 - u * 0.5);
            g.fillRect(Math.round(fx + vx * u), Math.round(fy - jh - 24 * u * (1 - u) + jh * u * u), 1, 1);
        }
        g.globalAlpha = 0.25;
        g.fillStyle = '#7fb4bc';
        g.fillRect(fx, fy + 4, 1, 12);
        g.globalAlpha = 1;

        // yog'och uy: derazalar, tutun va mushuk
        for (const w of wins) {
            const f = 0.8 + 0.2 * Math.sin(T * w.s + w.p) * Math.sin(T * w.s * 2.7 + w.p);
            g.globalAlpha = 0.12 * f;
            g.fillStyle = '#b8c850';
            g.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
            g.globalAlpha = 1;
            g.fillStyle = f > 0.9 ? '#eee48a' : '#e3dd7a';
            g.fillRect(w.x, w.y, w.w, w.h);
            g.fillStyle = '#3a2a14';
            g.fillRect(w.x + (w.w >> 1), w.y, 1, w.h);
        }
        smoke.forEach((s) => {
            s.t = (s.t + dt * 0.1 * K) % 1;
            g.globalAlpha = 0.75 * Math.pow(1 - s.t, 0.8);
            g.fillStyle = '#a0a6aa';
            const sz = s.t > 0.45 ? 2 : 1;
            g.fillRect(Math.round(333 + Math.sin(s.t * 8 + T * 0.9 * K) * 2.5 * s.t + s.t * 5), Math.round(57 - s.t * 40), sz, sz);
        });
        g.globalAlpha = 1;
        // mushuk (tomda o'tirgan)
        const cx = 320, sw = Math.round(Math.sin(T * 2.1 * K) * 1.2);
        g.fillStyle = '#d9812f';
        g.fillRect(cx - 3, 61, 5, 4); // tana
        g.fillRect(cx + 1, 58, 4, 3); // bosh
        g.fillRect(cx + 1, 57, 1, 1); // quloqlar
        g.fillRect(cx + 4, 57, 1, 1);
        g.fillRect(cx - 4, 63, 1, 2); // dum
        g.fillRect(cx - 5, 62, 1, 1);
        g.fillRect(cx - 5 + sw, 61, 1, 1);
        g.fillRect(cx - 4 + sw, 60, 1, 1);
        g.fillStyle = '#a85a1c';
        g.fillRect(cx - 1, 62, 1, 1);
        g.fillRect(cx + 1, 62, 1, 1);
        if (Math.floor((T * K) / 2) % 3 !== 0 || (T * K) % 2 > 0.15) {
            g.fillStyle = '#2b1a0e';
            g.fillRect(cx + 3, 59, 1, 1);
        }

        // o'tloq, to'siq, qamish, toshlar (uzoqdan yaqinga)
        for (const it of items) {
            switch (it.k) {
                case 0:
                case 5:
                    drawStalk(it, T);
                    break;
                case 1:
                    drawPost(it);
                    break;
                case 3:
                    drawRock(it);
                    break;
                default:
                    g.globalAlpha = 0.55 + 0.45 * Math.sin(T * 1.5 * K + it.p);
                    g.fillStyle = it.c;
                    g.fillRect(it.x, it.by, 1, 1);
                    if (it.big) {
                        g.fillRect(it.x - 1, it.by, 1, 1);
                        g.fillRect(it.x + 1, it.by, 1, 1);
                        g.fillRect(it.x, it.by - 1, 1, 1);
                    }
                    g.globalAlpha = 1;
            }
        }
        g.globalAlpha = 1;

        // o't pashshalari
        for (const f of flies) {
            const x = Math.round(f.bx + Math.sin(T * f.sx * K + f.p) * f.ax);
            const y = Math.round(f.by + Math.cos(T * f.sy * K + f.q) * f.ay);
            const a = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(T * f.blink + f.p * 3)), 2);
            g.globalAlpha = 0.09 * a;
            pc(g, x, y, 3, '#b6e03a');
            g.globalAlpha = 0.2 * a;
            pc(g, x, y, 2, '#b6e03a');
            g.globalAlpha = 0.5 * a;
            pc(g, x, y, 1, '#c8f050');
            g.globalAlpha = a;
            g.fillStyle = '#f0ff90';
            g.fillRect(x, y, 1, 1);
        }
        g.globalAlpha = 1;
    };

    /* ---------- ishga tushirish (~30 kadr/s) ---------- */
    let raf = 0;
    let last = 0;
    let alive = true;
    const frame = (ts) => {
        if (!alive) return;
        raf = requestAnimationFrame(frame);
        if (ts - last < 33) return;
        const dt = Math.min((ts - last) / 1000, 0.1);
        last = ts;
        T += dt;
        draw(dt);
    };
    const onPointerDown = () => {
        if (!RM) shoot();
    };
    c.addEventListener('pointerdown', onPointerDown);

    draw(0);
    raf = requestAnimationFrame(frame);

    return () => {
        alive = false;
        cancelAnimationFrame(raf);
        c.removeEventListener('pointerdown', onPointerDown);
    };
}

export default function Village() {
    const canvasRef = useRef(null);

    useEffect(() => createScene(canvasRef.current), []);

    return (
        <div className="village">
            <canvas
                ref={canvasRef}
                className="village__canvas"
                width={W}
                height={H}
                aria-label="Tungi qishloq: yarim oy, ko'lmak, yog'och uy va o't pashshalari"
            />
        </div>
    );
}