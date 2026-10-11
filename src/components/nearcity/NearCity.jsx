import { useEffect, useRef } from 'react';
import './NearCity.scss';

const W = 384, H = 216;
const BASE = 119; // qishloq poydevor chizig'i
const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// ---------- yordamchilar ----------
const mk = (w, h) => {
    const e = document.createElement('canvas');
    e.width = w;
    e.height = h;
    return e;
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
    const A = hex(a), B = hex(b), k = Math.max(0, Math.min(1, t));
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',') + ')';
};
const R = (ctx, col, x, y, w, h) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
};
const pc = (ctx, cx, cy, r, col) => {
    // piksel doira
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
        ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
    }
};
const pe = (ctx, cx, cy, rx, ry, col) => {
    // piksel ellips
    ctx.fillStyle = col;
    const Y = Math.ceil(ry);
    for (let dy = -Y; dy <= Y; dy++) {
        const k = 1 - (dy * dy) / (ry * ry);
        if (k < 0) continue;
        const w = Math.floor(rx * Math.sqrt(k) + 0.5);
        ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1);
    }
};

// ---------- geometriya ----------
const ridgeY = (x) => 124 - 80 * Math.pow(Math.max(0, (x - 118) / 266), 1.7); // o'ng tepalik qirrasi
const groundTop = (x) => (x < 115 ? Math.round(133 - 12 * Math.pow(x / 115, 0.8)) : 121);
const hillLeft = (y) => 138 + (130 - y) * 3; // uzumzor chap chegarasi
const pathX = (y) => {
    const s = (y - 158) / 58;
    return 318 - s * 40 + 6 * Math.sin(s * 3.5);
};
const pathHW = (y) => 4 + ((y - 158) / 58) * 12;
const inPath = (x, y) => y >= 158 && Math.abs(x - pathX(y)) < pathHW(y) + 2;
const vineTop = (x) => 150 + x * 0.06; // oldingi uzum qatori
const vineBot = (x) => 190 + x * 0.02;
const POSTS = [32, 93, 150, 200, 240, 267, 296];
const postTop = (x) => Math.round(154 + x * 0.02);

export default function NearCity() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const c = canvasRef.current;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = false;
        const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let seed = 20261011;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

        // ---------- 1) OSMON ----------
        const skyC = mk(W, H), sg = skyC.getContext('2d');
        const SKY = Array.from({ length: 10 }, (_, i) => {
            const t = i / 9;
            return t < 0.55
                ? mix('#090511', '#26122f', t / 0.55)
                : mix('#26122f', '#20505f', (t - 0.55) / 0.45);
        });
        for (let y = 0; y < 140; y++) {
            for (let x = 0; x < W; x++) {
                const v = Math.pow(Math.min(1, y / 84), 1.7) * 9;
                const l = Math.min(9, Math.floor(v + BAY[(y & 3) * 4 + (x & 3)] / 16));
                R(sg, SKY[l], x, y, 1, 1);
            }
        }

        // ---------- 2) OY (yarim oy) ----------
        const MX = 193, MY = 30, MR = 12;
        const moonC = mk(MR * 2 + 3, MR * 2 + 3), mg = moonC.getContext('2d');
        for (let y = -MR; y <= MR; y++) {
            for (let x = -MR; x <= MR; x++) {
                const rr = x * x + y * y;
                if (rr > MR * MR) continue;
                const d = Math.hypot(x - 4, y + 3) - 10.5;
                if (d <= 0) continue;
                const col = rr > (MR - 1.4) ** 2 ? '#e8e2b4' : d < 1.4 ? '#d9d3a2' : '#fffbe6';
                R(mg, col, x + MR + 1, y + MR + 1, 1, 1);
            }
        }

        // ---------- 3) YULDUZLAR ----------
        const stars = [];
        for (let i = 0; i < 130; i++) {
            const x = Math.floor(rnd() * W);
            const y = Math.floor(Math.pow(rnd(), 1.15) * 80);
            if ((x - MX) ** 2 + (y - MY) ** 2 < 22 * 22) continue;
            const big = i < 16;
            const cols = ['#ffffff', '#cfdcff', '#fff2cc', '#ffffff'];
            stars.push({
                x, y, big,
                p: rnd() * 6.28,
                sp: 0.7 + rnd() * 2.2,
                c: cols[Math.floor(rnd() * cols.length)],
            });
        }

        // ---------- 4) UCHAYOTGAN YULDUZLAR ----------
        const shots = [];
        let nextShot = 1.5;
        const shoot = () => {
            const dir = rnd() < 0.5 ? -1 : 1, sp = 90 + rnd() * 60;
            shots.push({
                x: rnd() * W, y: rnd() * 30,
                vx: dir * sp * 0.85, vy: sp * 0.45,
                life: 0, max: 0.9 + rnd() * 0.5,
            });
        };

        // ---------- 5) TUMAN ----------
        const mistSprite = (w, h) => {
            const e = mk(w, h), m = e.getContext('2d');
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const dy = (y - h / 2) / (h / 2);
                    const v =
                        Math.exp(-dy * dy * 2.2) *
                        (0.55 + 0.45 * Math.sin(x * 0.09 + y * 0.3 + w)) *
                        Math.min(1, x / 18, (w - x) / 18);
                    if (v * 0.95 > BAY[(y & 3) * 4 + (x & 3)] / 16) R(m, '#4f7488', x, y, 1, 1);
                }
            }
            return e;
        };
        const mists = [
            { x: 0, y: 100, w: 150, h: 14, sp: 2.2 },
            { x: 200, y: 108, w: 190, h: 12, sp: 1.4 },
            { x: 90, y: 114, w: 120, h: 10, sp: 3 },
        ].map((m) => ({ ...m, img: mistSprite(m.w, m.h) }));

        // ---------- 6) TEPALIKLAR, QISHLOQ, CHERKOV ----------
        const landC = mk(W, H), lg = landC.getContext('2d');
        for (let x = 0; x < W; x++) {
            const t1 = Math.round(
                78 + 6 * Math.sin(x * 0.021 + 1.2) + 3 * Math.sin(x * 0.063) + 3 * Math.sin(x * 0.011 + 2)
            );
            R(lg, '#0f1d29', x, t1, 1, 70);
            R(lg, '#1a3243', x, t1, 1, 1); // oy nuri qirrasi
        }
        for (let x = 0; x < W; x++) {
            const t2 = Math.round(96 + 7 * Math.sin(x * 0.013 + 3) + 3 * Math.sin(x * 0.043 + 1));
            R(lg, '#0a1520', x, t2, 1, 50);
        }
        const wins = [];
        let vx = 48;
        while (vx < 122) {
            if (rnd() < 0.22) {
                const r = 2 + Math.floor(rnd() * 2);
                pc(lg, vx + r, BASE - r, r, '#04080d');
                vx += r * 2 + 1;
                continue;
            }
            const w = 4 + Math.floor(rnd() * 4), h = 3 + Math.floor(rnd() * 3);
            R(lg, '#060b11', vx, BASE - h, w, h);
            for (let i = 0; i < Math.ceil(w / 2); i++) R(lg, '#060b11', vx + i, BASE - h - 1 - i, w - 2 * i, 1);
            for (let k = 0; k < 2; k++) {
                if (rnd() < 0.8) {
                    wins.push({
                        x: vx + 1 + Math.floor(rnd() * (w - 2)),
                        y: BASE - h + Math.floor(rnd() * (h - 1)),
                        p: rnd() * 6.28,
                        s: 0.5 + rnd() * 2,
                    });
                }
            }
            vx += w + 1 + Math.floor(rnd() * 2);
        }
        // cherkov
        const CH = '#0a121b';
        R(lg, CH, 66, BASE - 6, 16, 6);
        R(lg, CH, 72, BASE - 12, 5, 12);
        [5, 3, 3, 1, 1, 1].forEach((w, i) => R(lg, CH, 72 + (5 - w) / 2, BASE - 13 - i, w, 1));
        R(lg, CH, 74, BASE - 21, 1, 3);
        R(lg, CH, 73, BASE - 20, 3, 1);
        wins.push(
            { x: 74, y: BASE - 9, p: 0, s: 0.4 },
            { x: 69, y: BASE - 4, p: 2, s: 0.7 },
            { x: 78, y: BASE - 4, p: 4, s: 0.9 }
        );
        // tarqoq shahar chiroqlari
        for (let i = 0; i < 30; i++) {
            wins.push({
                x: 40 + Math.floor(rnd() * 82),
                y: BASE - 8 + Math.floor(rnd() * 11),
                p: rnd() * 6.28,
                s: 0.4 + rnd() * 2,
            });
        }

        // ---------- 7) YER ----------
        const groundC = mk(W, H), gg = groundC.getContext('2d');
        const GC = Array.from({ length: H }, (_, y) =>
            mix('#232d15', '#0a0f07', Math.pow(Math.max(0, (y - 121) / (H - 121)), 0.6))
        );
        for (let x = 0; x < W; x++) {
            for (let y = groundTop(x); y < H; y++) R(gg, GC[y], x, y, 1, 1);
        }
        for (let i = 0; i < 2600; i++) {
            const x = Math.floor(rnd() * W);
            const y = 121 + Math.floor(rnd() * (H - 121));
            if (y < groundTop(x)) continue;
            const n = rnd();
            R(gg, n < 0.35 ? '#34441f' : n < 0.7 ? '#141b0c' : '#2b2412', x, y, 1, 1);
        }
        gg.globalAlpha = 0.07;
        pe(gg, 200, 140, 90, 12, '#8aa05a');
        gg.globalAlpha = 1;
        // so'qmoq
        for (let y = 158; y < H; y++) {
            const cx = pathX(y), hw = pathHW(y);
            for (let x = Math.floor(cx - hw - 2); x <= Math.ceil(cx + hw + 2); x++) {
                if (x < 0 || x >= W) continue;
                const d = Math.abs(x - cx) / hw;
                if (d > 1.1) continue;
                if (d > 1 && rnd() < 0.5) continue;
                let col;
                if (d > 0.93) col = rnd() < 0.5 ? '#2a1f12' : '#33271a';
                else {
                    const n = rnd();
                    col = n < 0.12 ? '#5c4731' : n < 0.3 ? '#3a2a1b' : '#4a3624';
                    if (Math.abs(Math.abs(x - cx) - hw * 0.5) < 0.8) col = '#32241a';
                }
                R(gg, col, x, y, 1, 1);
            }
        }
        // toshchalar
        for (let i = 0; i < 10; i++) {
            const x = Math.floor(rnd() * W), y = 172 + Math.floor(rnd() * 40);
            if (inPath(x, y) || (x <= 300 && y < vineBot(x) + 4)) continue;
            pe(gg, x, y + 1, 2, 1, '#26261f');
            pe(gg, x, y, 2, 1, '#55554c');
            R(gg, '#7b7b70', x - 1, y - 1, 2, 1);
        }

        // ---------- 8) QARAGAYLAR ----------
        const pinesC = mk(W, H), pn = pinesC.getContext('2d');
        const pine = (x, base, h) => {
            for (let r = 0; r < h; r++) {
                const w = Math.floor(r * 0.22) + (r % 5 < 2 ? 1 : 0);
                const y = base - h + r;
                R(pn, '#050d0b', x - w, y, w * 2 + 1, 1);
                if (rnd() < 0.35) R(pn, '#0b1c18', x + w - 1, y, 1, 1);
            }
            R(pn, '#050d0b', x, base, 1, 3);
        };
        [[3, 141, 34], [13, 145, 38], [23, 139, 30], [32, 135, 26],
        [41, 132, 22], [49, 129, 18], [57, 127, 15], [63, 126, 12]].forEach(([x, b, h]) => pine(x, b, h));

        // ---------- 9) POG'ONALI UZUMZOR ----------
        const hillC = mk(W, H), hg = hillC.getContext('2d');
        const HB = 152;
        for (let x = 128; x < W; x++) {
            const r = ridgeY(x), top = Math.ceil(r);
            for (let y = top; y <= HB; y++) {
                const left = hillLeft(y);
                if (x < left) continue;
                if (x < left + 8 && rnd() < (left + 8 - x) / 8) continue;
                if (y > HB - 8 && rnd() < (y - (HB - 8)) / 8) continue;
                R(hg, mix('#0a1009', '#1a2411', (y - r) / 75), x, y, 1, 1);
                if (rnd() < 0.06) R(hg, '#241f10', x, y, 1, 1);
            }
        }
        const offs = [];
        let o = 4;
        for (let k = 0; k < 16; k++) {
            offs.push(o);
            o += 2.6 + k * 0.27;
        }
        offs.forEach((off, k) => {
            const th = Math.max(2, Math.round(1.6 + (off / 62) * 3));
            for (let x = 128; x < W; x++) {
                const y0 = Math.round(ridgeY(x) + off + 0.6 * Math.sin(x * 0.15 + k));
                if (y0 + th > HB - 4) continue;
                if (x < hillLeft(y0) + 4) continue;
                R(hg, '#060a05', x, y0 + th, 1, 1);
                R(hg, '#16220e', x, y0, 1, th);
                R(hg, '#2b3f1d', x, y0, 1, 1);
                if (rnd() < 0.3) R(hg, '#3d5628', x, y0 - 1, 1, 1);
                if (rnd() < 0.25) R(hg, '#1f3114', x, y0 + 1, 1, 1);
                if ((x + k * 5) % 15 === 0) R(hg, '#3a2a18', x, y0 - 2, 1, th + 3);
            }
        });
        // qirradagi daraxtlar
        for (let x = 232; x < W; x += 2 + Math.floor(rnd() * 4)) {
            const r = Math.floor(ridgeY(x)), rad = 2 + Math.floor(rnd() * 3);
            pc(hg, x, r - rad + 2, rad, '#04090a');
        }
        for (let x = 300; x < W; x += 11) pc(hg, x, Math.floor(ridgeY(x)) - 6, 4, '#060e0f');

        // ---------- 10) UYCHA, KO'RPALAR, DARAXT ----------
        const houseC = mk(W, H), hs = houseC.getContext('2d');
        pe(hs, 332, 158, 34, 4, 'rgba(0,0,0,0.45)');
        // devor
        R(hs, '#2a2017', 304, 132, 57, 26);
        for (let row = 0; row < 7; row++) {
            let sx = 304 + (row % 2 ? -3 : 0);
            const y = 132 + row * 4, hh = Math.min(3, 158 - y);
            while (sx < 361) {
                const sw = 5 + Math.floor(rnd() * 4);
                const x0 = Math.max(304, sx), x1 = Math.min(361, sx + sw - 1);
                if (x1 > x0) {
                    const sh = rnd();
                    R(hs, sh < 0.33 ? '#7a6649' : sh < 0.66 ? '#65533d' : '#705d44', x0, y, x1 - x0, hh);
                    R(hs, '#8c7757', x0, y, x1 - x0, 1);
                }
                sx += sw;
            }
        }
        // tom
        for (let r = 0; r < 20; r++) {
            const y = 112 + r, xl = Math.round(309 - r * 0.45), xr = Math.round(356 + r * 0.4);
            R(hs, r % 4 === 3 ? '#4a2810' : r < 3 ? '#8a5a2e' : '#744221', xl, y, xr - xl + 1, 1);
            for (let x = xl + (r % 2 ? 2 : 0); x <= xr; x += 5) R(hs, '#55301a', x, y, 1, 1);
            R(hs, '#92602f', xl + Math.floor(rnd() * (xr - xl)), y, 2, 1);
        }
        R(hs, '#a67340', 308, 111, 49, 1);
        R(hs, '#140d07', 304, 132, 57, 2); // soyabon soyasi
        // mo'ri
        R(hs, '#4c3c2d', 349, 103, 6, 10);
        for (let i = 0; i < 4; i++) R(hs, '#2e241a', 349, 105 + i * 3, 6, 1);
        R(hs, '#2a1f16', 348, 102, 8, 2);
        // eshik va deraza ramkasi
        R(hs, '#2b1a0d', 313, 139, 10, 19);
        R(hs, '#6b5a45', 312, 157, 12, 2);
        R(hs, '#2b1a0d', 342, 138, 10, 10);
        R(hs, '#4a2d17', 340, 138, 2, 10);
        R(hs, '#4a2d17', 352, 138, 2, 10);
        R(hs, '#7a6649', 341, 148, 12, 1);
        // devorga suyalgan asbob
        for (let i = 0; i < 14; i++) R(hs, '#3d2b1a', 358 - Math.floor(i * 0.25), 143 + i, 1, 1);
        R(hs, '#3d2b1a', 354, 143, 6, 1);
        // bochkalar
        const barrel = (x, y, w, h) => {
            for (let i = 0; i < h; i++) {
                const b = Math.round(Math.sin((i / (h - 1)) * Math.PI));
                const xx = x - b, ww = w + b * 2;
                R(hs, '#6a4222', xx, y - h + i, ww, 1);
                R(hs, '#8a5a30', xx, y - h + i, 1, 1);
                R(hs, '#3a2410', xx + ww - 1, y - h + i, 1, 1);
            }
            R(hs, '#2b1a0c', x - 1, y - h + 2, w + 2, 1);
            R(hs, '#2b1a0c', x - 1, y - 3, w + 2, 1);
            R(hs, '#8a5a30', x, y - h, w, 1);
        };
        barrel(333, 157, 9, 10);
        barrel(362, 153, 9, 10);
        // o'ng daraxt
        R(hs, '#1a110a', 371, 120, 5, 52);
        R(hs, '#2a1c10', 371, 120, 1, 52);
        R(hs, '#1a110a', 362, 121, 12, 2);
        const blobs = [[376, 113, 12], [381, 127, 9], [370, 121, 6], [378, 102, 9]];
        blobs.forEach(([x, y, r]) => pc(hs, x, y, r, '#050c07'));
        for (let i = 0; i < 170; i++) {
            const x = 358 + Math.floor(rnd() * 28), y = 92 + Math.floor(rnd() * 46);
            if (blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < (r - 1) ** 2)) {
                R(hs, rnd() < 0.6 ? '#0d1a0e' : '#122313', x, y, 1, 1);
            }
        }

        // ---------- 11) OLDINGI UZUM QATORI ----------
        const vineC = mk(W, H), vg = vineC.getContext('2d');
        for (let x = 0; x <= 296; x++) {
            const top = Math.round(vineTop(x)), bot = Math.round(vineBot(x));
            for (let y = top; y <= bot; y++) R(vg, mix('#1a2a12', '#070c06', (y - top) / (bot - top)), x, y, 1, 1);
            R(vg, 'rgba(0,0,0,0.35)', x, bot + 1, 1, 5);
        }
        for (let x = 2; x <= 296; x += 6 + Math.floor(rnd() * 3)) {
            const r = 3 + Math.floor(rnd() * 3);
            pc(vg, x, Math.round(vineTop(x)) + 1, r, ['#1d3014', '#233819', '#172610'][Math.floor(rnd() * 3)]);
            pc(vg, x + 2, Math.round(vineBot(x)), r, '#0a1208');
        }
        pc(vg, 297, 172, 5, '#16240f');
        pc(vg, 298, 180, 5, '#101b0b');
        for (let i = 0; i < 16; i++) {
            pc(vg, 366 + Math.floor(rnd() * 22), 196 + Math.floor(rnd() * 22), 5 + Math.floor(rnd() * 5),
                ['#0d170a', '#142210', '#1b2e14'][Math.floor(rnd() * 3)]);
        }

        // ustunlar va simlar
        const postC = mk(W, H), pg = postC.getContext('2d');
        [8, 18].forEach((off) => {
            for (let i = 0; i < POSTS.length - 1; i++) {
                const a = POSTS[i], b = POSTS[i + 1];
                for (let x = a; x <= b; x++) {
                    const s = (x - a) / (b - a);
                    R(pg, 'rgba(55,52,40,0.85)', x, Math.round(postTop(x) + off + Math.sin(s * Math.PI) * 2.5), 1, 1);
                }
            }
        });
        POSTS.forEach((px) => {
            const top = postTop(px);
            R(pg, '#3f2a18', px - 2, top, 5, H - top);
            R(pg, '#6a4a2c', px - 2, top, 1, H - top);
            R(pg, '#22140a', px + 2, top, 1, H - top);
            R(pg, '#5a3c22', px - 2, top - 1, 5, 1);
            for (let k = 0; k < 5; k++) R(pg, '#2a190c', px - 1, top + 6 + Math.floor(rnd() * (H - top - 8)), 2, 1);
        });
        R(pg, '#3f2a18', 348, 194, 6, 22);
        R(pg, '#6a4a2c', 348, 194, 1, 22);
        R(pg, '#22140a', 353, 194, 1, 22);
        R(pg, '#5a3c22', 348, 193, 6, 1);

        // uzum barglari (harakatlanadi)
        const nearPost = (x) => POSTS.some((p) => Math.abs(x - p) < 4);
        const leavesBack = [], leavesFront = [];
        for (let i = 0; i < 1300; i++) {
            const x = Math.floor(rnd() * 297), top = vineTop(x), bot = vineBot(x);
            const d = rnd(), y = Math.floor(top - 2 + d * (bot - top));
            const pal = d < 0.28
                ? ['#556f35', '#456030', '#6a8a42']
                : d < 0.62 ? ['#2f4a22', '#3a5a2a', '#274019'] : ['#182812', '#1f3317', '#121d0d'];
            const l = { x, y, w: 1 + Math.floor(rnd() * 2), c: pal[Math.floor(rnd() * 3)], a: 0.4 + 0.9 * (1 - d) };
            (nearPost(x) && rnd() < 0.7 ? leavesFront : leavesBack).push(l);
        }
        for (let i = 0; i < 260; i++) {
            const x = 350 + Math.floor(rnd() * 34), y = 192 + Math.floor(rnd() * 24), d = (y - 192) / 24;
            const pal = d < 0.5 ? ['#2f4a22', '#3a5a2a', '#456030'] : ['#182812', '#1f3317', '#274019'];
            leavesBack.push({ x, y, w: 1 + Math.floor(rnd() * 2), c: pal[Math.floor(rnd() * 3)], a: 0.9 });
        }

        // o't, gullar
        const blades = [];
        let guard = 0;
        while (blades.length < 420 && guard++ < 8000) {
            const x = Math.floor(rnd() * W), y = 170 + Math.floor(Math.pow(rnd(), 0.8) * 45);
            if (x <= 300 && y < vineBot(x) + 4) continue;
            if (inPath(x, y) || (x >= 348 && y >= 190)) continue;
            blades.push({
                x, y,
                h: 2 + Math.floor(rnd() * 3 + ((y - 170) / 45) * 2),
                p: rnd() * 6.28,
                c: ['#34491f', '#44622b', '#1f3015', '#52702f'][Math.floor(rnd() * 4)],
            });
        }
        const flowers = [];
        guard = 0;
        while (flowers.length < 36 && guard++ < 4000) {
            const x = Math.floor(rnd() * W), y = 160 + Math.floor(rnd() * 55);
            if (inPath(x, y) || (x <= 300 && y < vineBot(x) + 4) || (x >= 348 && y >= 190)) continue;
            flowers.push({
                x, y, p: rnd() * 6.28,
                c: ['#7aa2ff', '#7aa2ff', '#dfe8ff', '#ffe08a'][Math.floor(rnd() * 4)],
            });
        }

        // ---------- 12) YALTIROQ QO'NG'IZLAR ----------
        const flies = [];
        for (let i = 0; i < 44; i++) {
            const near = i < 26;
            flies.push({
                cx: near ? 250 + rnd() * 95 : rnd() * 300,
                cy: near ? 118 + rnd() * 45 : 135 + rnd() * 70,
                ax: 6 + rnd() * 14, ay: 4 + rnd() * 8,
                sx: 0.3 + rnd() * 0.7, sy: 0.3 + rnd() * 0.7,
                p1: rnd() * 6.28, p2: rnd() * 6.28,
                b: 0.6 + rnd() * 1.4, pb: rnd() * 6.28,
                c: rnd() < 0.7 ? '#c6ff6e' : '#fff08a',
            });
        }

        // ---------- 13) TUTUN, KO'RSHAPALAKLAR, YARASALAR ----------
        const puffs = [];
        let nextChim = 0.2, nextPipe = 1;
        const bats = [
            { o: 0, sp: 9, y: 36, p: 0 },
            { o: 150, sp: 7, y: 52, p: 2 },
            { o: 300, sp: 11, y: 24, p: 4 },
        ];

        const cat = (x, y, T, ph) => {
            const col = '#b9743a', dk = '#7d4a22', hi = '#d99a56';
            R(g, col, x - 3, y - 4, 6, 4);
            R(g, hi, x - 3, y - 4, 6, 1);
            R(g, col, x - 2, y - 7, 5, 3);
            R(g, dk, x - 2, y - 8, 1, 1);
            R(g, dk, x + 2, y - 8, 1, 1);
            if ((T * 0.8 + ph) % 5 > 0.12) {
                R(g, '#f3ff7a', x - 1, y - 6, 1, 1);
                R(g, '#f3ff7a', x + 1, y - 6, 1, 1);
            }
            for (let i = 0; i < 5; i++) {
                const tx = x + 3 + Math.round(Math.sin(T * 2.4 + ph + i * 0.9) * i * 0.45);
                R(g, dk, tx, y - 2 + i, 1, 1);
            }
        };

        const oldMan = (T) => {
            const bx = 291, by = 157;
            const b = Math.sin(T * 1.4) > 0.55 ? 1 : 0;
            R(g, '#4a2e18', bx - 3, by - 5, 5, 1); // o'rindiq
            R(g, '#3a2410', bx - 3, by - 4, 1, 4);
            R(g, '#3a2410', bx + 1, by - 4, 1, 4);
            R(g, '#3a3028', bx - 3, by - 14 + b, 6, 8); // tana
            R(g, '#554638', bx - 3, by - 14 + b, 1, 8);
            R(g, '#2a2218', bx - 2, by - 7, 7, 2); // son
            R(g, '#2a2218', bx + 4, by - 5, 2, 5); // boldir
            R(g, '#120c08', bx + 4, by - 1, 3, 1); // etik
            R(g, '#3a3028', bx + 2, by - 12 + b, 4, 2); // qo'l
            R(g, '#c89a6a', bx - 2, by - 19 + b, 4, 3); // yuz
            R(g, '#d8d4cc', bx - 2, by - 16 + b, 4, 2); // soqol
            R(g, '#2a1e14', bx - 4, by - 20 + b, 8, 1); // shlyapa
            R(g, '#2a1e14', bx - 2, by - 23 + b, 4, 3);
            R(g, '#3a2410', bx + 2, by - 17 + b, 2, 1); // trubka
            if (Math.sin(T * 2.1) > 0.1) R(g, '#ff8a2a', bx + 4, by - 18 + b, 1, 1);
        };

        // ---------- CHIZISH ----------
        let T = 0;
        const k = RM ? 0.3 : 1;
        const draw = (dt) => {
            g.globalAlpha = 1;
            g.drawImage(skyC, 0, 0);

            // yulduzlar
            for (const s of stars) {
                const a = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(T * s.sp + s.p));
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
                    nextShot = 3 + rnd() * 5;
                }
                for (let i = shots.length - 1; i >= 0; i--) {
                    const s = shots[i];
                    s.life += dt;
                    s.x += s.vx * dt;
                    s.y += s.vy * dt;
                    if (s.life > s.max || s.y > 76) {
                        shots.splice(i, 1);
                        continue;
                    }
                    const fade = 1 - s.life / s.max;
                    for (let j = 0; j < 16; j++) {
                        g.globalAlpha = Math.max(0, fade * (1 - j / 16));
                        g.fillStyle = j < 2 ? '#ffffff' : j < 8 ? '#ffe9b0' : '#9fc4ff';
                        g.fillRect(Math.round(s.x - s.vx * j * 0.008), Math.round(s.y - s.vy * j * 0.008), 1, 1);
                    }
                }
                g.globalAlpha = 1;
            }

            // oy va nuri
            const pulse = 0.85 + 0.15 * Math.sin(T * 0.8);
            [[MR + 14, 0.035], [MR + 9, 0.05], [MR + 5, 0.08], [MR + 2, 0.1]].forEach(([r, a]) => {
                g.globalAlpha = a * pulse;
                pc(g, MX - 1, MY + 1, r, '#d8ecff');
            });
            g.globalAlpha = 1;
            g.drawImage(moonC, MX - MR - 1, MY - MR - 1);

            // yarasalar
            if (!RM) {
                for (const b of bats) {
                    const bx = Math.round(((b.o + T * b.sp) % (W + 60)) - 30);
                    const by = Math.round(b.y + Math.sin(T * 1.6 + b.p) * 6 + Math.sin(T * 0.5 + b.p) * 3);
                    const up = Math.sin(T * 16 + b.p) > 0;
                    const col = '#05070c';
                    R(g, col, bx, by, 1, 2);
                    if (up) {
                        R(g, col, bx - 2, by - 1, 2, 1); R(g, col, bx + 1, by - 1, 2, 1);
                        R(g, col, bx - 3, by - 2, 1, 1); R(g, col, bx + 3, by - 2, 1, 1);
                    } else {
                        R(g, col, bx - 2, by, 2, 1); R(g, col, bx + 1, by, 2, 1);
                        R(g, col, bx - 3, by + 1, 1, 1); R(g, col, bx + 3, by + 1, 1, 1);
                    }
                }
            }

            // tepalik, qishloq, derazalar
            g.drawImage(landC, 0, 0);
            for (const w of wins) {
                const f = 0.65 + 0.35 * Math.sin(T * w.s + w.p) * Math.sin(T * w.s * 2.3 + w.p);
                g.globalAlpha = 0.14 * f;
                R(g, '#ff9a2e', w.x - 1, w.y - 1, 3, 3);
                g.globalAlpha = Math.min(1, 0.6 + 0.4 * f);
                R(g, '#ffd27a', w.x, w.y, 1, 1);
            }

            // tuman
            g.globalAlpha = 0.16;
            for (const m of mists) {
                const span = W + m.w;
                const px = ((((m.x + T * m.sp) % span) + span) % span) - m.w;
                g.drawImage(m.img, Math.round(px), m.y);
            }
            g.globalAlpha = 1;

            g.drawImage(groundC, 0, 0);
            g.drawImage(pinesC, 0, 0);
            g.drawImage(hillC, 0, 0);
            g.drawImage(houseC, 0, 0);

            // uycha nuri
            const fl = 0.86 + 0.08 * Math.sin(T * 7.3) + 0.06 * Math.sin(T * 12.9 + 1.3) * Math.sin(T * 3.1);
            for (let y = 141; y < 157; y++) {
                R(g, mix('#ffe08a', '#ff9a2a', ((y - 141) / 15) * (1.2 - 0.2 * fl)), 314, y, 8, 1);
            }
            R(g, '#ffe9a8', 315, 140, 6, 1);
            R(g, '#7a3f12', 316, 150, 5, 1);
            R(g, '#7a3f12', 316, 151, 1, 6);
            R(g, '#7a3f12', 320, 151, 1, 6);
            const pane = fl > 0.82 ? '#ffc95e' : '#f0b24a';
            [[343, 139], [348, 139], [343, 144], [348, 144]].forEach(([x, y]) => R(g, pane, x, y, 3, 3));

            g.globalAlpha = 0.1 * fl;
            pe(g, 318, 160, 26, 6, '#ffb347');
            g.globalAlpha = 0.12 * fl;
            pe(g, 318, 162, 14, 3, '#ffcf6b');
            g.globalAlpha = 0.07 * fl;
            pe(g, 318, 148, 12, 10, '#ff9a30');
            g.globalAlpha = 0.06 * fl;
            pc(g, 347, 143, 9, '#ffb347');
            g.globalAlpha = 1;

            // tutun
            if (!RM) {
                nextChim -= dt;
                if (nextChim <= 0) {
                    puffs.push({ x: 351.5 + rnd(), y: 101, vx: 2 + rnd() * 3, vy: -(5 + rnd() * 4), life: 0, max: 3.5 + rnd() * 2 });
                    nextChim = 0.55 + rnd() * 0.5;
                }
                nextPipe -= dt;
                if (nextPipe <= 0) {
                    puffs.push({ x: 295, y: 139, vx: 1.5 + rnd() * 2, vy: -(3 + rnd() * 2), life: 0, max: 2 + rnd() });
                    nextPipe = 2.4 + rnd() * 2.5;
                }
                for (let i = puffs.length - 1; i >= 0; i--) {
                    const p = puffs[i];
                    p.life += dt;
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    if (p.life > p.max) {
                        puffs.splice(i, 1);
                        continue;
                    }
                    const sz = Math.round(1 + (p.life / p.max) * 3);
                    g.globalAlpha = 0.32 * (1 - p.life / p.max) * Math.min(1, p.life * 3);
                    R(g, '#9fb0c4', Math.round(p.x), Math.round(p.y), sz, sz);
                }
                g.globalAlpha = 1;
            }

            // mushuklar
            cat(322, 113, T, 0);
            cat(368, 121, T, 2.3);

            // chol va chiroq
            oldMan(T);
            R(g, '#1a1109', 279, 151, 5, 1);
            R(g, '#1a1109', 279, 155, 5, 1);
            R(g, '#1a1109', 281, 149, 1, 2);
            R(g, fl > 0.85 ? '#ffd566' : '#ffc040', 280, 152, 3, 3);
            const lp = 0.85 + 0.15 * Math.sin(T * 6.1);
            [[12, 0.07], [8, 0.1], [4, 0.15]].forEach(([r, a]) => {
                g.globalAlpha = a * lp;
                pc(g, 281, 153, r, '#ffb347');
            });
            g.globalAlpha = 0.12 * lp;
            pe(g, 281, 157, 18, 4, '#ffb347');
            g.globalAlpha = 1;

            // uzum qatori
            g.drawImage(vineC, 0, 0);
            for (const l of leavesBack) {
                const ox = Math.round(Math.sin(T * 1.4 * k + l.x * 0.035 + l.y * 0.05) * l.a);
                R(g, l.c, l.x + ox, l.y, l.w, 1);
            }
            g.drawImage(postC, 0, 0);
            for (const l of leavesFront) {
                const ox = Math.round(Math.sin(T * 1.4 * k + l.x * 0.035 + l.y * 0.05) * l.a);
                R(g, l.c, l.x + ox, l.y, l.w, 1);
            }

            // o't
            for (const b of blades) {
                const off = Math.round(Math.sin(T * 1.8 * k + b.x * 0.07 + b.p) * 0.9);
                R(g, b.c, b.x, b.y - 1, 1, 1);
                R(g, b.c, b.x + off, b.y - b.h, 1, b.h - 1);
            }
            for (const f of flowers) {
                g.globalAlpha = 0.55 + 0.45 * Math.sin(T * 1.2 + f.p);
                R(g, f.c, f.x, f.y, 1, 1);
            }
            g.globalAlpha = 1;

            // yaltiroq qo'ng'izlar
            for (const f of flies) {
                const x = f.cx + Math.sin(T * f.sx * k + f.p1) * f.ax + Math.sin(T * f.sx * 2.3 * k + f.p2) * f.ax * 0.3;
                const y = f.cy + Math.cos(T * f.sy * k + f.p2) * f.ay + Math.sin(T * f.sy * 1.7 * k + f.p1) * f.ay * 0.3;
                const a = Math.pow(Math.max(0, Math.sin(T * f.b + f.pb)), 2);
                if (a < 0.03) continue;
                const rx = Math.round(x), ry = Math.round(y);
                g.globalAlpha = a * 0.22;
                R(g, '#9eff4a', rx - 1, ry - 1, 3, 3);
                if (a > 0.7) {
                    g.globalAlpha = a * 0.12;
                    R(g, '#9eff4a', rx - 2, ry, 5, 1);
                    R(g, '#9eff4a', rx, ry - 2, 1, 5);
                }
                g.globalAlpha = a;
                R(g, f.c, rx, ry, 1, 1);
            }
            g.globalAlpha = 1;
        };

        // ---------- ISHGA TUSHIRISH (~30 kadr/s) ----------
        let raf = 0, last = 0, alive = true;
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
    }, []);

    return (
        <div className="near-city">
            <canvas
                ref={canvasRef}
                className="near-city__canvas"
                width={W}
                height={H}
                aria-label="Tun, yarim oy, uzumzor, qishloq va yorug' uycha"
            />
        </div>
    );
}