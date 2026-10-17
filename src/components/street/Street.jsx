import { useEffect, useRef } from 'react';
import './Street.scss';

const W = 288;
const H = 288;

/* ---------- yordamchilar ---------- */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
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

const R = (ctx, x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
};
// 3D ko'rinishli quti (yorug' va soya qirralari bilan)
const box = (ctx, x, y, w, h, base, hi, lo) => {
    R(ctx, x, y, w, h, base);
    R(ctx, x, y, w, 1, hi);
    R(ctx, x, y, 1, h, hi);
    R(ctx, x, y + h - 1, w, 1, lo);
    R(ctx, x + w - 1, y, 1, h, lo);
};
// piksel doira
const pc = (ctx, cx, cy, r, col) => {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
        ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
    }
};
// funksiya orqali bo'yaladigan to'rtburchak
const grect = (ctx, x, y, w, h, fn) => {
    for (let j = y; j < y + h; j++) {
        for (let i = x; i < x + w; i++) {
            ctx.fillStyle = fn(i, j);
            ctx.fillRect(i, j, 1, 1);
        }
    }
};
// vertikal gradient (dither bilan)
const vgrad = (stops, n, y0, y1) => {
    const pal = palette(stops, n);
    return (x, y) => pal[clamp(Math.floor(clamp((y - y0) / (y1 - y0), 0, 1) * (n - 1) + bayer(x, y)), 0, n - 1)];
};
// ko'pburchak (scanline)
const poly = (ctx, pts, col) => {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.ceil(Math.min(...ys));
    const y1 = Math.floor(Math.max(...ys));
    for (let y = y0; y <= y1; y++) {
        const xs = [];
        for (let i = 0; i < pts.length; i++) {
            const [ax, ay] = pts[i];
            const [bx, by] = pts[(i + 1) % pts.length];
            if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
            const xa = Math.round(xs[k]);
            const xb = Math.round(xs[k + 1]);
            if (typeof col === 'function') {
                for (let x = xa; x < xb; x++) {
                    ctx.fillStyle = col(x, y);
                    ctx.fillRect(x, y, 1, 1);
                }
            } else {
                ctx.fillStyle = col;
                ctx.fillRect(xa, y, xb - xa, 1);
            }
        }
    }
};
// 5x5 piksel shrift (tabliga)
const GL5 = {
    W: ['10001', '10001', '10101', '10101', '01010'],
    I: ['11111', '00100', '00100', '00100', '11111'],
    N: ['10001', '11001', '10101', '10011', '10001'],
    E: ['11111', '10000', '11110', '10000', '11111'],
    L: ['10000', '10000', '10000', '10000', '11111'],
    A: ['01110', '10001', '11111', '10001', '10001'],
};
const text5 = (ctx, str, x, y, col) => {
    ctx.fillStyle = col;
    [...str].forEach((ch, i) => {
        GL5[ch].forEach((row, ry) => {
            [...row].forEach((bit, rx) => {
                if (bit === '1') ctx.fillRect(x + i * 6 + rx, y + ry, 1, 1);
            });
        });
    });
};
// sim (elektr simlari) chizish
const wire = (ctx, x0, y0, x1, y1, sag, col, wob) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    ctx.fillStyle = col;
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        ctx.fillRect(Math.round(lerp(x0, x1, t)), Math.round(lerp(y0, y1, t) + Math.sin(t * Math.PI) * sag + wob * Math.sin(t * Math.PI)), 1, 1);
    }
};

/* ---------- sahna ---------- */
function createScene(c) {
    const g = c.getContext('2d');
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const K = RM ? 0.35 : 1;

    let seed = 90210;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    // ----- osmon va bulutlar -----
    const skyC = mk(W, H);
    const sg = skyC.getContext('2d');
    grect(sg, 0, 0, W, 130, vgrad([[0, '#5f9aae'], [0.5, '#86b6c4'], [1, '#b4d0d4']], 10, 0, 130));

    const cloudSprite = (w, h, blobs) => {
        const e = mk(w, h);
        const x = e.getContext('2d');
        const ins = (xx, yy) => blobs.some(([cx, cy, rx, ry]) => ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1);
        for (let yy = 0; yy < h; yy++) {
            for (let xx = 0; xx < w; xx++) {
                if (!ins(xx, yy)) continue;
                x.fillStyle = !ins(xx, yy - 2) ? '#f9cfe0' : !ins(xx, yy + 2) ? '#c47aa8' : '#ef9fc6';
                x.fillRect(xx, yy, 1, 1);
            }
        }
        return e;
    };
    const clouds = [
        { x: 212, y: 3, w: 96, img: cloudSprite(96, 34, [[12, 27, 12, 5], [30, 22, 16, 6], [52, 16, 18, 6], [72, 10, 16, 5], [88, 6, 10, 4], [40, 28, 10, 3]]), sp: 1.1 },
        { x: 224, y: 36, w: 56, img: cloudSprite(56, 16, [[10, 10, 10, 4], [26, 8, 14, 5], [44, 6, 10, 4]]), sp: 0.7 },
    ];

    // ----- tashqi ko'rinish (shisha ortidagi kechki shahar) -----
    const outC = mk(W, H);
    const og = outC.getContext('2d');
    grect(og, 212, 122, 76, 76, vgrad([[0, '#e098c0'], [0.2, '#d8a8c8'], [0.35, '#a8c0d0'], [1, '#8fb4c4']], 12, 122, 198));
    const bl = [
        [213, 9, 22, 0], [221, 7, 30, 1], [227, 11, 18, 0], [237, 8, 26, 1], [246, 12, 32, 2],
        [258, 9, 22, 0], [266, 10, 38, 1], [275, 8, 26, 2], [282, 8, 20, 0],
    ];
    const BCOL = ['#7f8fae', '#68799b', '#a58aa8'];
    const cityWins = [];
    bl.forEach(([x, w, h, s]) => {
        R(og, x, 196 - h, w, h, BCOL[s]);
        R(og, x, 196 - h, w, 1, '#a9b8d0');
        R(og, x + w - 1, 196 - h, 1, h, '#55658a');
        for (let yy = 196 - h + 3; yy < 193; yy += 4) {
            for (let xx = x + 2; xx < x + w - 2; xx += 3) {
                R(og, xx, yy, 1, 2, '#52638a');
                if (rnd() < 0.2) cityWins.push({ x: xx, y: yy, p: rnd() * 6.28, sp: 0.3 + rnd() * 0.8 });
            }
        }
    });
    // vokzal tabloisi
    box(og, 227, 135, 61, 19, '#2b343a', '#4a5860', '#171e22');
    R(og, 230, 138, 55, 13, '#1c2429');
    box(og, 233, 139, 13, 11, '#8a9a50', '#b4c46a', '#5a6a30');
    R(og, 237, 141, 5, 1, '#1c2429');
    R(og, 239, 141, 1, 6, '#1c2429');
    box(og, 262, 139, 14, 11, '#b05a6a', '#d88090', '#7a3040');
    R(og, 266, 142, 6, 5, '#7a3040');
    for (let i = 0; i < 3; i++) R(og, 249, 140 + i * 4, 10, 1, '#788890');
    // yo'lak (platforma)
    grect(og, 212, 196, 76, 40, vgrad([[0, '#bba4ac'], [0.5, '#9c8a94'], [1, '#7c6c78']], 8, 196, 236));
    [203, 212, 223].forEach((y) => R(og, 212, y, 76, 1, '#7a6a76'));
    for (let i = 0; i < 6; i++) {
        for (let y = 196; y < 236; y++) {
            og.fillStyle = '#7a6a76';
            og.fillRect(Math.round(222 + i * 14 + (y - 196) * (i - 2.5) * 0.18), y, 1, 1);
        }
    }
    // binodagi qizil signal chirog'i
    R(og, 270, 156, 1, 1, '#ff4a4a');

    // ----- old qatlam (devor, uskunalar, kirish, pol) -----
    const frontC = mk(W, H);
    const fg = frontC.getContext('2d');

    // devor
    const WP = palette([[0, '#3e505c'], [0.5, '#667c86'], [1, '#8399a1']], 8);
    const wallFn = (x, y) => {
        const t = clamp(0.22 + 0.62 * (x / 150) - 0.1 * (y / 288) + (rnd() - 0.5) * 0.14, 0, 1);
        return WP[clamp(Math.floor(t * 7 + bayer(x, y)), 0, 7)];
    };
    grect(fg, 0, 0, 160, 80, wallFn);
    grect(fg, 0, 80, 124, 208, wallFn);
    [28, 52, 118].forEach((x) => R(fg, x, 0, 1, 252, 'rgba(40,56,66,0.45)'));
    [33, 66, 143].forEach((y) => R(fg, 0, y, 124, 1, 'rgba(40,56,66,0.4)'));

    // quvurlar
    box(fg, 132, 0, 10, 50, '#33404a', '#5a6874', '#1e2830');
    box(fg, 30, 0, 5, 104, '#3a4652', '#5a6874', '#242e38');

    // yuqori-chap qutilar (konditsioner kanallari)
    box(fg, 50, 0, 26, 17, '#9aa6ac', '#c4ced2', '#6c787e');
    for (let i = 0; i < 4; i++) R(fg, 53, 3 + i * 3, 20, 1, '#6c787e');
    box(fg, 82, 12, 22, 18, '#a8b4b8', '#cfd8dc', '#778288');
    box(fg, 105, 4, 26, 22, '#b3bec2', '#dae2e6', '#7d898f');
    for (let i = 0; i < 5; i++) R(fg, 109, 8 + i * 3, 18, 1, '#7d898f');
    R(fg, 108, 28, 22, 3, '#4a5a64');

    // yashil elektr quti va hisoblagichlar
    box(fg, 19, 31, 16, 30, '#3f8a5a', '#6ab882', '#245a38');
    R(fg, 23, 37, 8, 4, '#245a38');
    R(fg, 23, 46, 8, 10, '#2e6e46');
    for (let i = 0; i < 3; i++) {
        box(fg, 2 + i * 11, 78, 10, 20, '#c8d0d4', '#e6ecee', '#8a959b');
        R(fg, 4 + i * 11, 81, 6, 5, '#2a343a');
        R(fg, 4 + i * 11, 90, 6, 4, '#6c787e');
    }
    [0, 1, 2].forEach((i) => R(fg, 3 + i * 11, 65, 9, 1, '#d4dcdf'));

    // katta konditsionerlar
    const acBase = (x, y, w, h) => {
        box(fg, x, y, w, h, '#b9c2c6', '#d6dde0', '#7f8a90');
        R(fg, x + 1, y + 1, w - 2, 5, '#a2adb2');
        R(fg, x + 1, y + h - 5, w - 2, 4, '#98a3a9');
    };
    acBase(57, 41, 62, 57);
    box(fg, 63, 52, 19, 40, '#9ea9af', '#c2cbcf', '#6f7a80');
    R(fg, 66, 56, 12, 10, '#2a343a');
    R(fg, 68, 58, 8, 3, '#4a5a64');
    R(fg, 66, 70, 5, 3, '#d04a3a');
    R(fg, 66, 76, 12, 2, '#6f7a80');
    for (let i = 0; i < 17; i++) R(fg, 91, 62 + i * 2, 22, 1, i % 2 ? '#aeb8bc' : '#6f7a80');
    acBase(57, 99, 62, 43);
    R(fg, 66, 108, 17, 24, '#6f7a80');
    for (let i = 0; i < 6; i++) {
        R(fg, 67, 110 + i * 4, 15, 1, '#a2adb2');
        R(fg, 74, 108, 1, 24, '#8a959b');
    }
    for (let i = 0; i < 15; i++) R(fg, 94, 108 + i * 2, 19, 1, i % 2 ? '#aeb8bc' : '#6f7a80');
    R(fg, 105, 140, 4, 3, '#4a5a64'); // drenaj quvuri

    // kichik konditsioner (aylanuvchi vintilyatorli)
    box(fg, 130, 46, 26, 38, '#a8b4b8', '#cdd6da', '#74808a');
    pc(fg, 143, 64, 10, '#2a343a');
    pc(fg, 143, 64, 8, '#1c262c');
    for (let a = 0; a < 6; a++) {
        for (let r = 2; r < 10; r++) {
            fg.fillStyle = '#46555e';
            fg.fillRect(Math.round(143 + Math.cos(a * 0.5236) * r), Math.round(64 + Math.sin(a * 0.5236) * r), 1, 1);
            fg.fillRect(Math.round(143 - Math.cos(a * 0.5236) * r), Math.round(64 - Math.sin(a * 0.5236) * r), 1, 1);
        }
    }
    R(fg, 133, 50, 4, 2, '#d04a3a');

    // katta vintilyatorli quti
    R(fg, 175, 19, 17, 6, '#3b4650');
    R(fg, 177, 20, 13, 3, '#232c34');
    box(fg, 152, 25, 55, 41, '#3b4650', '#6a7884', '#1e262e');
    grect(fg, 158, 31, 43, 29, (x, y) => (((x >> 1) + (y >> 1)) & 1 ? '#47535e' : '#2a343c'));
    R(fg, 166, 56, 10, 7, '#c04a4a');
    R(fg, 168, 58, 6, 1, '#f0b0b0');

    // plitkalar (to'q ko'k)
    for (let ty = 0; ty < 6; ty++) {
        for (let tx = 0; tx < 4; tx++) {
            const x = 40 + tx * 15;
            const y = 146 + ty * 14;
            R(fg, x, y, 15, 14, '#16202e');
            R(fg, x + 1, y + 1, 13, 12, '#25364d');
            R(fg, x + 1, y + 1, 13, 1, '#3a5070');
            R(fg, x + 1, y + 1, 1, 12, '#33486a');
        }
    }
    R(fg, 62, 170, 8, 3, '#e8c84a');
    R(fg, 74, 182, 6, 4, '#d85a4a');
    R(fg, 48, 196, 7, 3, '#e8e4d8');
    R(fg, 84, 160, 5, 5, '#e8c84a');
    R(fg, 70, 205, 6, 3, '#58a8d8');

    // shamollatish panjaralari
    [[50, 214], [75, 214]].forEach(([x, y]) => {
        box(fg, x, y, 21, 38, '#98a4aa', '#bcc6ca', '#66727a');
        for (let i = 0; i < 9; i++) R(fg, x + 2, y + 3 + i * 4, 17, 2, '#6a767e');
    });

    // devor asosi
    R(fg, 37, 248, 87, 5, '#2c3840');

    // ----- soyabon (kanopi) -----
    poly(fg, [[160, 80], [288, 80], [288, 122], [212, 122], [212, 112], [190, 98], [160, 98]],
        vgrad([[0, '#7f9040'], [0.5, '#a0b458'], [1, '#c4d870']], 10, 80, 122));
    [89, 101, 113].forEach((y) => R(fg, 190, y, 98, 1, '#667830'));
    poly(fg, [[160, 66], [288, 70], [288, 80], [160, 80]], '#5f706c');
    R(fg, 160, 66, 128, 1, '#8a9c98');
    R(fg, 160, 79, 128, 1, '#3c4a48');
    box(fg, 188, 67, 56, 12, '#6e7f7a', '#8a9c98', '#46544f');
    text5(fg, 'WINNELLA', 191, 70, '#8fa09b');
    text5(fg, 'WINNELLA', 190, 69, '#3e4c4a');
    poly(fg, [[212, 119], [288, 119], [288, 123], [212, 123]], '#4a5a40');

    // ----- kirish eshigi -----
    box(fg, 122, 84, 68, 17, '#33473f', '#5a7a70', '#1e2c27');
    R(fg, 122, 92, 68, 1, '#26362f');
    // ichki yorug' xona
    grect(fg, 124, 101, 51, 131, vgrad([[0, '#eef6c8'], [0.35, '#cfe8a0'], [0.7, '#a6d08c'], [1, '#7fb088']], 14, 101, 232));
    R(fg, 124, 101, 51, 14, '#dcefb0');
    for (let i = 0; i < 6; i++) R(fg, 146 + i * 3, 108, 2, 2, '#ffffff');
    R(fg, 124, 101, 3, 131, 'rgba(60,90,70,0.35)');
    // javon (tokchalar)
    box(fg, 158, 150, 17, 52, '#6f9a66', '#98c090', '#456a40');
    for (let i = 0; i < 4; i++) {
        R(fg, 160, 156 + i * 11, 13, 1, '#456a40');
        for (let k = 0; k < 4; k++) R(fg, 161 + k * 3, 150 + i * 11 + 1, 2, 4, ['#e8c84a', '#d85a4a', '#58a8d8', '#e8eef0'][(i + k) % 4]);
    }
    // plakat
    box(fg, 152, 152, 16, 25, '#5a84c8', '#8aaee8', '#3a5a98');
    for (let i = 0; i < 4; i++) R(fg, 155, 156 + i * 4, 10, 1, '#e8f0f8');
    R(fg, 156, 171, 4, 3, '#d85a4a');
    // pol
    R(fg, 124, 205, 51, 27, '#b8d8a8');
    for (let i = 0; i < 4; i++) R(fg, 124, 208 + i * 7, 51, 1, '#98c090');
    box(fg, 150, 209, 22, 23, '#5a7ec0', '#8aaee8', '#3a5a98');
    for (let i = 0; i < 3; i++) R(fg, 152, 214 + i * 6, 18, 2, '#e8f0f0');

    // zaytun rangli avtomat (kirish oldida)
    box(fg, 97, 131, 53, 110, '#7b8868', '#9aa886', '#505c46');
    R(fg, 99, 133, 49, 6, '#6a7658');
    R(fg, 100, 140, 6, 3, '#c8d878');
    box(fg, 103, 160, 20, 17, '#c9c4a0', '#e8e4c8', '#8a8668');
    R(fg, 106, 164, 14, 1, '#6a665a');
    R(fg, 106, 167, 11, 1, '#6a665a');
    R(fg, 106, 170, 13, 1, '#6a665a');
    box(fg, 106, 182, 14, 12, '#d8d4b0', '#f0ecd0', '#8a8668');
    R(fg, 109, 186, 8, 1, '#6a665a');
    R(fg, 104, 198, 8, 4, '#e8c84a');
    R(fg, 114, 200, 7, 4, '#d85a4a');
    box(fg, 134, 143, 15, 80, '#26333a', '#4a5a64', '#141c20');
    const BOT = ['#3a6ac8', '#e8eef0', '#d84a3a', '#e89ab0', '#58a8d8'];
    for (let r = 0; r < 6; r++) {
        for (let k = 0; k < 3; k++) {
            const x = 136 + k * 4;
            const y = 146 + r * 12;
            R(fg, x, y, 3, 9, BOT[(r * 3 + k) % 5]);
            R(fg, x, y, 3, 2, '#e8eef0');
        }
        R(fg, 135, 155 + r * 12, 13, 1, '#4a5a64');
    }
    R(fg, 99, 219, 33, 18, '#4a5648');
    for (let i = 0; i < 5; i++) R(fg, 101, 222 + i * 3, 29, 1, '#6a7658');
    R(fg, 95, 240, 57, 11, '#4a5a56');
    R(fg, 95, 240, 57, 1, '#7a8a84');

    // shisha ustuni va eshik oynasi
    box(fg, 175, 98, 15, 144, '#2b4440', '#4a7a72', '#162622');
    R(fg, 180, 120, 5, 1, '#6a9a90');
    poly(fg, [[190, 98], [212, 112], [212, 236], [190, 242]],
        (x, y) => (((x + y * 0.6) % 14 < 3) ? '#a8d0cc' : (y < 150 ? '#6f9fa6' : '#4a7a80')));
    R(fg, 199, 105, 2, 135, '#2e4a46');
    R(fg, 190, 98, 1, 144, '#1e3632');
    poly(fg, [[191, 110], [198, 114], [198, 230], [191, 233]], 'rgba(184,228,150,0.28)');

    // pol
    poly(fg, [[37, 252], [122, 252], [122, 232], [212, 232], [212, 236], [288, 236], [288, 288], [37, 288]],
        vgrad([[0, '#566e76'], [1, '#2e3e46']], 10, 232, 288));
    [244, 255, 268, 283].forEach((y) => R(fg, 122, y, 166, 1, 'rgba(120,150,156,0.35)'));
    for (let i = 0; i < 8; i++) {
        for (let y = 236; y < 288; y++) {
            fg.fillStyle = 'rgba(120,150,156,0.28)';
            fg.fillRect(Math.round(130 + i * 22 + (y - 236) * (i - 3.5) * 0.35), y, 1, 1);
        }
    }
    [255, 268, 283].forEach((y) => R(fg, 37, y, 85, 1, 'rgba(120,150,156,0.3)'));
    // yashil gilamcha
    poly(fg, [[154, 250], [220, 250], [227, 271], [147, 271]], '#6c8c58');
    poly(fg, [[154, 250], [220, 250], [221, 253], [153, 253]], '#86a870');
    for (let i = 0; i < 6; i++) R(fg, 152 - i, 256 + i * 3, 70 + i * 2, 1, '#57764a');
    // temir panjara
    box(fg, 232, 241, 18, 34, '#2c3a40', '#4a5c64', '#161e22');
    for (let i = 0; i < 8; i++) R(fg, 234, 244 + i * 4, 14, 2, '#566a72');
    // axlat qutisi
    box(fg, 250, 252, 38, 36, '#6a7e8a', '#8aa0aa', '#3e4e58');
    R(fg, 252, 254, 34, 3, '#8aa0aa');
    poly(fg, [[262, 262], [284, 260], [286, 280], [260, 283]], '#e8e4d8');
    for (let i = 0; i < 5; i++) R(fg, 264, 265 + i * 3, 17, 1, '#a8a498');
    R(fg, 262, 274, 5, 5, '#58a8d8');
    // yashil shkaf
    box(fg, 207, 166, 28, 43, '#5f7f52', '#86a678', '#3a5030');
    box(fg, 211, 172, 10, 16, '#c05a6a', '#e08090', '#803040');
    R(fg, 223, 172, 8, 28, '#4a6a42');
    for (let i = 0; i < 6; i++) R(fg, 224, 176 + i * 4, 6, 1, '#6a8a5a');

    // qizil avtomat
    box(fg, 0, 129, 37, 159, '#c4302a', '#e85a4a', '#7a1414');
    R(fg, 2, 131, 33, 8, '#d84a3a');
    R(fg, 3, 133, 20, 3, '#f0a090');
    box(fg, 2, 142, 31, 80, '#2a4a50', '#4a8a90', '#142628');
    grect(fg, 3, 143, 29, 78, vgrad([[0, '#9ae0e4'], [1, '#5ab0b8']], 8, 143, 221));
    const RB = ['#3a8a4a', '#3a6ac8', '#e8eef0', '#d8a030', '#c84a4a', '#58a8d8', '#8a4ac8'];
    for (let r = 0; r < 4; r++) {
        for (let k = 0; k < 5; k++) {
            const x = 5 + k * 6;
            const y = 148 + r * 19;
            const col = RB[(r * 5 + k * 3 + (r & 1)) % 7];
            R(fg, x, y + 3, 4, 11, col);
            R(fg, x + 1, y, 2, 4, col);
            R(fg, x + 1, y, 2, 1, '#e8eef0');
            R(fg, x, y + 6, 4, 2, 'rgba(255,255,255,0.45)');
        }
        R(fg, 3, 163 + r * 19, 29, 2, '#3a7a80');
    }
    box(fg, 0, 240, 26, 36, '#3a5ec8', '#6a8ee8', '#1e3a8a');
    poly(fg, [[3, 262], [12, 254], [20, 262], [20, 270], [3, 270]], '#e8f0f8');
    R(fg, 28, 233, 7, 30, '#2a1a1a');
    R(fg, 29, 237, 5, 3, '#58d8e8');
    R(fg, 29, 244, 5, 3, '#d8c84a');

    // gul tuvaklari
    box(fg, 55, 262, 36, 26, '#8f5a3a', '#b87a54', '#5a3622');
    R(fg, 55, 262, 36, 3, '#a86e48');
    box(fg, 81, 267, 18, 21, '#8f5a3a', '#b87a54', '#5a3622');
    R(fg, 71, 242, 2, 21, '#2a3a28');
    R(fg, 89, 255, 2, 13, '#2a3a28');

    // ----- dinamik elementlar uchun ma'lumotlar -----
    // o'simlik barglari
    const leafCols = ['#1f3a24', '#2f5a34', '#41753f', '#5a8a50'];
    const leaves = [];
    const addCluster = (cx, cy, rx, ry, n, baseY, hh) => {
        for (let i = 0; i < n; i++) {
            const a = rnd() * 6.283;
            const rad = Math.sqrt(rnd());
            const x = cx + Math.cos(a) * rx * rad;
            const y = cy + Math.sin(a) * ry * rad;
            const lit = -((y - cy) / ry) * 0.7 + ((x - cx) / rx) * 0.3;
            const ci = clamp(Math.floor(lit * 2.2 + 1.6 + (rnd() - 0.5) * 1.2), 0, 3);
            leaves.push({ x, y, w: 2 + Math.floor(rnd() * 3), h: 1 + Math.floor(rnd() * 2), c: leafCols[ci], p: rnd() * 6.28, a: clamp((baseY - y) / hh, 0.1, 1) });
        }
    };
    addCluster(72, 244, 19, 17, 90, 262, 38);
    addCluster(89, 257, 10, 8, 30, 268, 20);

    // devorda osilgan o't (ivy)
    const ivy = [];
    const addStrand = (x0, y0, len, drift) => {
        for (let i = 0; i < len; i += 2) {
            const t = i / len;
            const x = x0 + Math.sin(i * 0.18 + x0) * 3 + t * drift;
            for (let k = 0; k < 2; k++) {
                ivy.push({
                    x: x + (rnd() - 0.5) * 6,
                    y: y0 + i + (rnd() - 0.5) * 3,
                    w: 2 + Math.floor(rnd() * 2),
                    c: leafCols[Math.floor(rnd() * 4)],
                    p: rnd() * 6.28,
                    a: 0.3 + t * 1.2,
                });
            }
        }
    };
    [[124, 86, 70, 3], [130, 86, 55, 2], [137, 86, 78, 4], [144, 86, 48, 2], [150, 88, 35, 3],
    [112, 78, 60, -2], [104, 80, 45, -1], [96, 84, 52, -2], [118, 80, 66, 1]].forEach((s) => addStrand(...s));
    [[2, 16, 20, 1], [8, 18, 16, 2], [13, 16, 22, 1]].forEach((s) => addStrand(...s));

    // yer o'tlari
    const tufts = [[46, 279], [100, 277], [141, 277], [245, 236], [218, 283], [60, 258], [128, 246], [36, 285]]
        .map(([x, y]) => ({ x, y, p: rnd() * 6.28 }));

    // kanopi yorug'liklari
    const lights = [
        { x: 192, y: 95, w: 33, p: 0.2 },
        { x: 205, y: 104, w: 35, p: 1.7 },
        { x: 224, y: 114, w: 44, p: 3.1 },
        { x: 271, y: 117, w: 17, p: 4.4 },
    ];

    // yo'lovchi (uzoqdagi odam)
    const walker = { t: -8, wait: 3 };

    /* ---------- chizish ---------- */
    let T = 0;
    const draw = (dt) => {
        g.globalAlpha = 1;
        g.drawImage(skyC, 0, 0);

        // bulutlar
        for (const cl of clouds) {
            const span = W + cl.w;
            const x = ((((cl.x - T * cl.sp * K) % span) + span) % span) - 8;
            g.drawImage(cl.img, Math.round(x), cl.y);
        }

        // simlar
        const wob = Math.sin(T * 0.8 * K);
        wire(g, 160, 8, 288, 44, 4, '#33454f', wob * 0.6);
        wire(g, 196, 0, 214, 40, 1, '#33454f', wob * 0.3);
        wire(g, 160, 26, 205, 40, 2, '#33454f', wob * 0.4);

        // tashqi manzara
        g.drawImage(outC, 0, 0);
        for (const w of cityWins) {
            g.globalAlpha = 0.25 + 0.75 * Math.max(0, Math.sin(T * w.sp * K + w.p));
            g.fillStyle = '#f3e19a';
            g.fillRect(w.x, w.y, 1, 2);
        }
        g.globalAlpha = Math.sin(T * 2.6) > 0.3 ? 1 : 0.15;
        g.fillStyle = '#ff4a4a';
        g.fillRect(270, 156, 1, 1);
        g.globalAlpha = 0.4 * (0.5 + 0.5 * Math.sin(T * 2.6));
        g.fillRect(269, 155, 3, 3);
        g.globalAlpha = 1;
        // tablo belgisi
        g.globalAlpha = 0.5 + 0.5 * Math.sin(T * 1.8 * K);
        g.fillStyle = '#ffd0d8';
        g.fillRect(268, 143, 2, 2);
        g.globalAlpha = 1;
        // yo'lovchi
        if (!RM) {
            walker.t += dt;
            if (walker.t > walker.wait) {
                const u = (walker.t - walker.wait) * 16;
                const x = 214 + u;
                if (x > 292) {
                    walker.t = 0;
                    walker.wait = 14 + rnd() * 14;
                } else {
                    const step = Math.floor(u / 3) % 2;
                    g.fillStyle = '#3a3448';
                    g.fillRect(Math.round(x), 188, 4, 7); // tana
                    g.fillRect(Math.round(x) + 1, 185, 3, 3); // bosh
                    g.fillRect(Math.round(x) + (step ? 0 : 2), 195, 2, 4); // oyoqlar
                    g.fillRect(Math.round(x) + (step ? 2 : 0), 195, 2, 3);
                    g.fillStyle = '#c86a7a';
                    g.fillRect(Math.round(x) + 1, 189, 2, 3);
                }
            }
        }

        // old qatlam
        g.drawImage(frontC, 0, 0);

        // kanopi yorug'liklari (miltillash bilan)
        lights.forEach((l, i) => {
            let f = 0.92 + 0.08 * Math.sin(T * 13 + l.p);
            if (i === 2 && Math.sin(T * 1.7 + 2) * Math.sin(T * 9.1) > 0.86) f = 0.35;
            g.globalAlpha = 0.18 * f;
            g.fillStyle = '#e6fa90';
            g.fillRect(l.x - 3, l.y - 3, l.w + 6, 9);
            g.globalAlpha = f;
            g.fillStyle = '#dff590';
            g.fillRect(l.x, l.y, l.w, 4);
            g.fillStyle = '#fbffe0';
            g.fillRect(l.x + 1, l.y + 1, l.w - 2, 2);
        });
        g.globalAlpha = 1;

        // do'kondan pol ustiga tushadigan yorug'lik
        g.fillStyle = '#d4f09a';
        for (let i = 0; i < 14; i++) {
            g.globalAlpha = 0.13 * (1 - i / 14) * (0.9 + 0.1 * Math.sin(T * 3));
            g.fillRect(124, 232 + i, 88, 1);
        }
        g.globalAlpha = 1;

        // avtomat oynalari nuri
        g.globalAlpha = 0.07 + 0.04 * Math.sin(T * 5.3);
        g.fillStyle = '#ffffff';
        g.fillRect(3, 143, 29, 78);
        g.globalAlpha = 0.06 + 0.04 * Math.sin(T * 4.1 + 1);
        g.fillRect(135, 144, 13, 78);
        g.globalAlpha = 1;

        // LED chiroqlar
        g.fillStyle = '#ff3a3a';
        [0, 1, 2].forEach((i) => {
            g.globalAlpha = Math.sin(T * 2 + i * 1.7) > 0 ? 1 : 0.25;
            g.fillRect(6 + i * 11, 87, 2, 2);
        });
        g.globalAlpha = Math.sin(T * 3.3) > 0.2 ? 1 : 0.3;
        g.fillRect(66, 70, 5, 3);
        g.fillStyle = '#58f08a';
        g.globalAlpha = Math.sin(T * 1.3) > -0.4 ? 1 : 0.3;
        g.fillRect(29, 237, 5, 3);
        g.globalAlpha = 1;

        // aylanuvchi vintilyator
        const ang = T * 7 * K;
        g.fillStyle = '#7a8a94';
        for (let b = 0; b < 3; b++) {
            const a = ang + (b * Math.PI * 2) / 3;
            for (let r = 1; r < 8; r++) {
                g.fillRect(Math.round(143 + Math.cos(a) * r), Math.round(64 + Math.sin(a) * r), 1, 1);
                g.fillRect(Math.round(143 + Math.cos(a + 0.28) * r * 0.9), Math.round(64 + Math.sin(a + 0.28) * r * 0.9), 1, 1);
            }
        }
        g.fillStyle = '#c8d0d4';
        g.fillRect(142, 63, 3, 3);

        // konditsioner tomchilari
        g.fillStyle = '#b6d4e4';
        for (let i = 0; i < 2; i++) {
            const ph = (T * 0.9 * K + i * 0.5) % 1;
            g.globalAlpha = 1 - ph * 0.4;
            g.fillRect(106, Math.round(143 + ph * ph * 22), 1, ph > 0.85 ? 1 : 2);
        }
        g.globalAlpha = 1;

        // o'simlik barglari
        for (const lf of leaves) {
            const dx = Math.sin(T * 0.9 * K + lf.p) * 0.9 * lf.a;
            g.fillStyle = lf.c;
            g.fillRect(Math.round(lf.x + dx), Math.round(lf.y), lf.w, lf.h);
        }

        // osilgan o't (ivy)
        for (const lf of ivy) {
            const dx = Math.sin(T * 0.8 * K + lf.p + lf.y * 0.05) * 1.1 * lf.a;
            g.fillStyle = lf.c;
            g.fillRect(Math.round(lf.x + dx), Math.round(lf.y), lf.w, 2);
        }

        // yer o'tlari
        for (const tf of tufts) {
            const s = Math.sin(T * 1.1 * K + tf.p);
            for (let b = -2; b <= 2; b++) {
                const h = 5 - Math.abs(b);
                g.fillStyle = b % 2 ? '#6a9a4a' : '#4a7a3a';
                g.fillRect(Math.round(tf.x + b + s * 0.6), tf.y - h, 1, h);
            }
        }
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

    draw(0);
    raf = requestAnimationFrame(frame);

    return () => {
        alive = false;
        cancelAnimationFrame(raf);
    };
}

export default function Street() {
    const canvasRef = useRef(null);

    useEffect(() => createScene(canvasRef.current), []);

    return (
        <div className="street">
            <canvas
                ref={canvasRef}
                className="street__canvas"
                width={W}
                height={H}
                aria-label="Kechki ko'cha: avtomatlar, konditsionerlar, yorug' do'kon kirishi va uzoqdagi shahar"
            />
        </div>
    );
}