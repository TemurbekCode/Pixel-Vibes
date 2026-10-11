import { useEffect, useRef } from 'react';
import './Meadow.scss';

const W = 384;
const H = 216;
const GTOP = 104; // yer (o'tloq) boshlanadigan taxminiy chiziq
const SKY_H = 104; // osmon balandligi

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

// archa
const pine = (ctx, x, base, h, col) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, base - 2, 1, 3);
    for (let i = 0; i < h; i++) {
        const w = Math.round((1 - i / h) * h * 0.32) + (i % 4 < 2 ? 1 : 0);
        ctx.fillRect(x - w, base - 2 - i, 2 * w + 1, 1);
    }
};

// 3x5 piksel shrift (ko'rsatkich taxtalari uchun)
const GLYPH = {
    H: ['101', '101', '111', '101', '101'],
    O: ['111', '101', '101', '101', '111'],
    M: ['101', '111', '111', '101', '101'],
    E: ['111', '100', '110', '100', '111'],
    T: ['111', '010', '010', '010', '010'],
    W: ['101', '101', '111', '111', '101'],
    N: ['111', '101', '101', '101', '101'],
};
const pixText = (ctx, str, x, y, col) => {
    ctx.fillStyle = col;
    [...str].forEach((ch, i) => {
        GLYPH[ch].forEach((row, ry) => {
            [...row].forEach((bit, rx) => {
                if (bit === '1') ctx.fillRect(x + i * 4 + rx, y + ry, 1, 1);
            });
        });
    });
};

/* ---------- relyef va yo'l ---------- */
const leftTop = (x) => 76 + 24 * smooth(x / 235);
const leftBot = (x) => lerp(113, 102, clamp(x / 235, 0, 1));
const rightTop = (x) => {
    if (x < 120) return 106;
    if (x < 310) return lerp(106, 94, smooth((x - 120) / 190));
    return lerp(94, 90, smooth((x - 310) / 74));
};

// [y, markaz x, kenglik]
const PATH = [
    [103, 316, 7], [108, 300, 9], [114, 281, 12], [121, 263, 16], [131, 264, 24],
    [142, 276, 36], [152, 288, 48], [165, 262, 70], [180, 226, 96], [196, 198, 116],
    [216, 172, 140],
];
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
    if (y < 103) return false;
    const [cx, w] = pathAt(y);
    return Math.abs(x - cx) < w / 2 + m;
};

/* ---------- sahna ---------- */
function createScene(c) {
    const g = c.getContext('2d');
    const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const K = RM ? 0.35 : 1;

    let seed = 7771993;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

    // ----- osmon (dither bilan) -----
    const skyC = mk(W, H);
    const sg = skyC.getContext('2d');
    const SKY = palette(
        [[0, '#080615'], [0.38, '#150e2d'], [0.62, '#2b1c47'], [0.84, '#1f4659'], [1, '#2f6c6e']],
        16
    );
    for (let y = 0; y < SKY_H + 6; y++) {
        for (let x = 0; x < W; x++) {
            const v = Math.pow(Math.min(1, y / SKY_H), 1.25);
            sg.fillStyle = SKY[clamp(Math.floor(v * 15 + bayer(x, y)), 0, 15)];
            sg.fillRect(x, y, 1, 1);
        }
    }

    // ----- yarim oy va nur -----
    const MX = 113, MY = 38, MR = 13;
    const moonC = mk(MR * 2 + 3, MR * 2 + 3);
    const mg = moonC.getContext('2d');
    for (let y = -MR; y <= MR; y++) {
        for (let x = -MR; x <= MR; x++) {
            if (x * x + y * y > MR * MR) continue;
            const dx = x - 6;
            const dy = y + 3;
            const d2 = dx * dx + dy * dy;
            if (d2 <= 12 * 12) continue; // o'yilgan qism
            mg.fillStyle = d2 < 14 * 14 ? '#e4ddae' : '#f7f2d2';
            mg.fillRect(x + MR + 1, y + MR + 1, 1, 1);
        }
    }
    const haloC = mk(80, 80);
    const hl = haloC.getContext('2d');
    for (let y = 0; y < 80; y++) {
        for (let x = 0; x < 80; x++) {
            const d = Math.hypot(x - 40, y - 40);
            if (d > 36) continue;
            const v = Math.pow(1 - d / 36, 1.5);
            if (d < 22 || v > bayer(x, y) * 0.7) {
                hl.fillStyle = d < 22 ? '#2f8296' : '#4aa3b4';
                hl.fillRect(x, y, 1, 1);
            }
        }
    }

    // ----- yulduzlar -----
    const stars = [];
    for (let i = 0; i < 170; i++) {
        const x = Math.floor(rnd() * W);
        const y = Math.floor(Math.pow(rnd(), 1.4) * 88);
        if ((x - MX) ** 2 + (y - MY) ** 2 < 17 * 17) continue;
        const big = i < 10;
        const cols = big ? ['#fff2c8', '#ffffff'] : ['#ffffff', '#e8f0ff', '#fff2c8'];
        stars.push({
            x, y, big,
            p: rnd() * 6.28,
            sp: 0.8 + rnd() * 2.5,
            c: cols[Math.floor(rnd() * cols.length)],
        });
    }

    // ----- uchayotgan yulduzlar -----
    const shots = [];
    let nextShot = 2;
    const shoot = (x = rnd() * W, y = rnd() * 40) => {
        const dir = rnd() < 0.5 ? -1 : 1;
        const sp = 90 + rnd() * 60;
        shots.push({ x, y, vx: dir * sp * 0.85, vy: sp * 0.45, life: 0, max: 0.9 + rnd() * 0.5 });
    };

    // ----- bulutlar -----
    const cloudSprite = (w, h) => {
        const e = mk(w, h);
        const x = e.getContext('2d');
        for (let i = 0; i < 7; i++) {
            const cx = w * (0.1 + 0.8 * rnd());
            const cy = h * (0.45 + 0.3 * rnd());
            const rx = Math.max(4, w * (0.1 + 0.14 * rnd()));
            const ry = Math.max(1.5, h * (0.3 + 0.25 * rnd()));
            for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
                if (y < 0 || y >= h) continue;
                const dx = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
                x.fillStyle = y < h * 0.4 ? '#3a2658' : '#1b1230';
                x.fillRect(Math.floor(cx - dx), y, Math.ceil(dx * 2), 1);
            }
        }
        return e;
    };
    const clouds = [
        [0, 52, 96, 8, 0.7], [130, 57, 110, 7, 0.5], [240, 50, 100, 9, 0.9],
        [330, 60, 80, 7, 0.6], [40, 70, 70, 6, 0.8], [250, 74, 80, 6, 0.4],
    ].map(([x, y, w, h, sp]) => ({ x, y, w, h, sp, img: cloudSprite(w, h) }));

    // ----- orqa qatlam: yer, daraxtlar, uy, tepalik, yo'l -----
    const backC = mk(W, H);
    const bg = backC.getContext('2d');

    // yer (oy nurida yoritilgan o'tloq)
    const GR = palette(
        [[0, '#0a1511'], [0.35, '#1b3228'], [0.68, '#34574a'], [1, '#6c9886']],
        10
    );
    for (let x = 0; x < W; x++) {
        const top = Math.round(rightTop(x));
        for (let y = top; y < H; y++) {
            const d = clamp((y - 100) / 116, 0, 1);
            let b = 0.28 + 0.6 * Math.pow(1 - d, 1.3);
            b *= 0.5 + 0.5 * smooth((x - 10) / 280);
            b += (rnd() - 0.5) * 0.07;
            if (y === top && x > 150) b = Math.max(b, 0.85);
            bg.fillStyle = GR[clamp(Math.floor(b * 9 + bayer(x, y)), 0, 9)];
            bg.fillRect(x, y, 1, 1);
        }
    }

    // uy orqasidagi archalar
    [[243, 14], [251, 10], [262, 8], [336, 18], [345, 24], [358, 14], [372, 22], [380, 28]].forEach(
        ([x, h]) => pine(bg, x, Math.round(rightTop(x)) + 2, h, '#0b1b1d')
    );

    // derazalar (statik ramkalar, yorug'lik dinamik chiziladi)
    const wins = [
        { x: 289, y: 91, w: 4, h: 5, p: 0.3, s: 0.9 },
        { x: 297, y: 91, w: 4, h: 5, p: 1.7, s: 0.6 },
        { x: 305, y: 91, w: 4, h: 5, p: 3.1, s: 1.1 },
        { x: 314, y: 94, w: 5, h: 9, p: 2.2, s: 0.5, door: true },
    ];

    // uy
    (() => {
        const HX = 283, HB = 103;
        bg.fillStyle = '#3b2a24'; // mo'ri
        bg.fillRect(313, 62, 4, 14);
        bg.fillStyle = '#54403a';
        bg.fillRect(313, 62, 1, 14);
        for (let x = 0; x < 44; x++) { // devor
            bg.fillStyle = x % 4 === 0 ? '#4f2f19' : x % 4 === 3 ? '#6f4426' : '#633b20';
            bg.fillRect(HX + 1 + x, HB - 16, 1, 16);
        }
        for (let i = 0; i < 15; i++) { // tom
            const l = HX - 2 + Math.round(i * 0.95);
            const r = HX + 49 - Math.round(i * 0.95);
            bg.fillStyle = i === 14 ? '#6a4630' : i % 3 === 2 ? '#3a251a' : '#2c1b13';
            bg.fillRect(l, HB - 17 - i, r - l, 1);
            bg.fillStyle = '#5a3a2a';
            bg.fillRect(l, HB - 17 - i, 1, 1);
        }
        bg.fillStyle = '#57341c'; // yon qo'shimcha bino
        bg.fillRect(328, 94, 10, 9);
        bg.fillStyle = '#2c1b13';
        bg.fillRect(326, 91, 14, 3);
        bg.fillStyle = '#6a4630';
        bg.fillRect(327, 91, 12, 1);
        for (let r = 0; r < 3; r++) { // o'tin g'aramasi
            for (let k = 0; k < 4; k++) {
                bg.fillStyle = (r + k) % 2 ? '#a06a3a' : '#7a4c28';
                bg.fillRect(330 + k * 2, 98 + r * 2, 2, 2);
                bg.fillStyle = '#c89058';
                bg.fillRect(330 + k * 2, 98 + r * 2, 1, 1);
            }
        }
        wins.forEach((w) => {
            bg.fillStyle = '#24150d';
            bg.fillRect(w.x - 1, w.y - 1, w.w + 2, w.h + 2);
        });
    })();

    // chap tomondagi qorong'i tepalik, butalar va archalar
    for (let x = 0; x < 235; x++) {
        const t = Math.round(leftTop(x));
        const b = Math.round(leftBot(x));
        bg.fillStyle = '#0a1814';
        bg.fillRect(x, t, 1, b - t);
        for (let k = 0; k < 6; k++) {
            if (bayer(x, b + k) < 1 - k / 6) bg.fillRect(x, b + k, 1, 1);
        }
    }
    for (let x = 0; x < 232; x += 3 + Math.floor(rnd() * 4)) {
        pc(bg, x, Math.round(leftTop(x)) + 1, 2 + Math.floor(rnd() * 3), '#07110d');
    }
    [[4, 20], [12, 14], [22, 22], [31, 16], [40, 12]].forEach(([x, h]) =>
        pine(bg, x, Math.round(leftTop(x)) + 4, h, '#06100d')
    );

    // tuproq yo'l
    const PP = ['#2a1d15', '#3a291d', '#4c3625', '#5e452f', '#735a3d', '#8a6d4b'];
    for (let y = 103; y < H; y++) {
        const [cx, w] = pathAt(y);
        for (let x = Math.floor(cx - w / 2 - 1); x <= Math.ceil(cx + w / 2 + 1); x++) {
            const d = Math.abs(x - cx) / (w / 2);
            if (d > 1) continue;
            if (d > 0.9 && rnd() < 0.45) continue; // qirralik
            let b = 0.78 - d * 0.5 - ((y - 103) / 113) * 0.18 + (rnd() - 0.5) * 0.28;
            if (d > 0.3 && d < 0.42 && y > 140) b -= 0.12; // g'ildirak izi
            if (rnd() < 0.015) b += 0.3; // mayda toshlar
            bg.fillStyle = PP[clamp(Math.floor(b * 5 + bayer(x, y)), 0, 5)];
            bg.fillRect(x, y, 1, 1);
        }
    }

    // ----- o'tloq elementlari (uzoqdan yaqinga tartiblanadi) -----
    const GP = [
        ['#355f4d', '#5f8f78'], ['#3d6a55', '#77a58d'], ['#2c5042', '#5a8770'],
        ['#22443a', '#4d7a64'], ['#1a362b', '#3f6a55'],
    ];
    const items = [];
    const free = (x, by) => {
        if (by < rightTop(x) + 3) return false;
        if (x < 235 && by < leftBot(x) + 2) return false;
        return !onPath(x, by, -1);
    };

    for (let i = 0; i < 2800; i++) {
        const x = rnd() * W;
        const by = Math.floor(GTOP + 3 + Math.pow(rnd(), 1.05) * (H - GTOP + 3));
        if (!free(x, by)) continue;
        const t = (by - GTOP) / (H - GTOP);
        const idx = clamp(Math.floor(lerp(0, 3.2, t) + (rnd() - 0.5) * 2.2), 0, 4);
        items.push({
            k: 0, x, by, t,
            h: Math.round(3 + t * 11 * (0.5 + 0.8 * rnd())),
            lean: rnd() - 0.5,
            p: rnd() * 6.28,
            c0: GP[idx][0],
            c1: GP[idx][1],
        });
    }

    // gullar
    const FC = ['#e8ecff', '#ffe4f0', '#fff1b8'];
    for (let i = 0; i < 90; i++) {
        const x = Math.floor(rnd() * W);
        const by = Math.floor(GTOP + 6 + rnd() * (H - GTOP - 8));
        if (!free(x, by)) continue;
        items.push({ k: 4, x, by, p: rnd() * 6.28, big: rnd() < 0.3, c: FC[Math.floor(rnd() * 3)] });
    }

    // toshlar va ko'rsatkich
    items.push({ k: 3, x: 137, by: 195, w: 9, h: 4 });
    items.push({ k: 3, x: 303, by: 210, w: 12, h: 5 });
    items.push({ k: 2, x: 193, by: 158 });

    // to'siq
    const posts = [];
    for (let x = 150; x < 392; x += 6 + (x - 150) * 0.045) {
        const by = Math.round(106 + (x - 150) * 0.125);
        posts.push({ k: 1, x: Math.round(x), by, h: Math.round(6 + (by - 106) * 0.5), w: by > 120 ? 3 : 2 });
    }
    posts.forEach((p, i) => {
        p.next = posts[i + 1] || null;
    });
    posts.filter((p) => !onPath(p.x, p.by, 1)).forEach((p) => items.push(p));

    items.sort((a, b) => a.by - b.by);

    // ----- o't pashshalari -----
    const flies = Array.from({ length: 40 }, () => ({
        bx: rnd() * W,
        by: 112 + rnd() * 100,
        ax: 6 + rnd() * 14,
        ay: 3 + rnd() * 8,
        sx: 0.2 + rnd() * 0.5,
        sy: 0.3 + rnd() * 0.6,
        p: rnd() * 6.28,
        q: rnd() * 6.28,
        blink: 0.6 + rnd() * 1.2,
    }));

    // ----- old plandagi qora o'tlar -----
    const fgBlades = [];
    const clump = (x0, x1, n) => {
        const cx = (x0 + x1) / 2;
        const half = (x1 - x0) / 2;
        for (let i = 0; i < n; i++) {
            const bx = x0 + rnd() * (x1 - x0);
            fgBlades.push({
                bx,
                h: 30 + rnd() * 35 + 28 * (1 - Math.abs(bx - cx) / half),
                lean: ((bx - cx) / half) * 16 + (rnd() - 0.5) * 14,
                w: 2 + Math.floor(rnd() * 2),
                hl: rnd() < 0.3,
            });
        }
    };
    clump(-4, 84, 30);
    clump(318, 388, 24);

    // ----- tutun (mo'ridan) -----
    const smoke = Array.from({ length: 9 }, (_, i) => ({ t: i / 9 }));

    // ----- yorug' / qorong'i shamol tovlanishlari -----
    const streaks = Array.from({ length: 36 }, () => ({
        y: GTOP + 2 + Math.floor(rnd() * (H - GTOP - 2)),
        x: rnd() * W,
        w: 10 + rnd() * 30,
        sp: 4 + rnd() * 6,
        light: rnd() < 0.55,
    }));

    /* ---------- chizish yordamchilari ---------- */
    const drawBoard = (x0, y0, label, dir) => {
        g.fillStyle = '#a9804f';
        g.fillRect(x0, y0, 19, 8);
        g.fillStyle = '#c79a63';
        g.fillRect(x0, y0, 19, 1);
        g.fillStyle = '#6e4a2a';
        g.fillRect(x0, y0 + 7, 19, 1);
        g.fillStyle = '#a9804f';
        if (dir > 0) {
            g.fillRect(x0 + 19, y0 + 1, 1, 6);
            g.fillRect(x0 + 20, y0 + 2, 1, 4);
            g.fillRect(x0 + 21, y0 + 3, 1, 2);
        } else {
            g.fillRect(x0 - 1, y0 + 1, 1, 6);
            g.fillRect(x0 - 2, y0 + 2, 1, 4);
            g.fillRect(x0 - 3, y0 + 3, 1, 2);
        }
        pixText(g, label, x0 + (dir > 0 ? 2 : 3), y0 + 2, '#2b1a0e');
    };

    const drawSign = (it) => {
        g.fillStyle = '#4a2f1a';
        g.fillRect(it.x - 1, it.by - 36, 2, 36);
        g.fillStyle = '#7a502c';
        g.fillRect(it.x - 1, it.by - 36, 1, 36);
        drawBoard(it.x + 1, it.by - 34, 'HOME', 1);
        drawBoard(it.x - 20, it.by - 25, 'TOWN', -1);
    };

    const drawRock = (it) => {
        for (let r = 0; r < it.h; r++) {
            const rw = Math.max(2, it.w - 2 * (it.h - 1 - r));
            g.fillStyle = r === 0 ? '#8a8a92' : r < it.h - 1 ? '#6b6b73' : '#46464e';
            g.fillRect(Math.round(it.x - rw / 2), it.by - it.h + 1 + r, rw, 1);
        }
    };

    const drawPost = (p) => {
        const hw = p.w >> 1;
        g.fillStyle = '#4e3019';
        g.fillRect(p.x - hw, p.by - p.h, p.w, p.h);
        g.fillStyle = '#7a4f2b';
        g.fillRect(p.x - hw, p.by - p.h, 1, p.h);
        g.fillStyle = '#3a2210';
        g.fillRect(p.x - hw, p.by - p.h, p.w, 1);
        const n = p.next;
        if (!n) return;
        const clear = [0.15, 0.5, 0.85].every((f) =>
            !onPath(lerp(p.x, n.x, f), lerp(p.by, n.by, f), 1)
        );
        if (!clear) return;
        [0.78, 0.38].forEach((f) => {
            const thick = p.h > 11 ? 2 : 1;
            for (let s = 0; s <= n.x - p.x; s++) {
                const u = s / (n.x - p.x);
                const y = lerp(p.by - p.h * f, n.by - n.h * f, u);
                g.fillStyle = '#5a381d';
                g.fillRect(p.x + s, Math.round(y), 1, thick);
                if (thick === 2) {
                    g.fillStyle = '#7d5530';
                    g.fillRect(p.x + s, Math.round(y), 1, 1);
                }
            }
        });
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
                nextShot = 3 + rnd() * 6;
            }
            for (let i = shots.length - 1; i >= 0; i--) {
                const s = shots[i];
                s.life += dt;
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                if (s.life > s.max || s.y > 80) {
                    shots.splice(i, 1);
                    continue;
                }
                const fade = 1 - s.life / s.max;
                for (let k = 0; k < 16; k++) {
                    g.globalAlpha = Math.max(0, fade * (1 - k / 16));
                    g.fillStyle = k < 2 ? '#ffffff' : k < 8 ? '#ffeec0' : '#ffc070';
                    g.fillRect(
                        Math.round(s.x - s.vx * k * 0.008),
                        Math.round(s.y - s.vy * k * 0.008),
                        1, 1
                    );
                }
            }
            g.globalAlpha = 1;
        }

        // oy nuri va oy
        g.globalAlpha = 0.34 * (0.85 + 0.15 * Math.sin(T * 0.7));
        g.drawImage(haloC, MX - 40, MY - 40);
        g.globalAlpha = 1;
        g.drawImage(moonC, MX - MR - 1, MY - MR - 1);

        // bulutlar
        g.globalAlpha = 0.9;
        for (const cl of clouds) {
            const span = W + cl.w;
            const px = ((((cl.x + T * cl.sp * K) % span) + span) % span) - cl.w;
            g.drawImage(cl.img, Math.round(px), cl.y);
        }
        g.globalAlpha = 1;

        // orqa qatlam
        g.drawImage(backC, 0, 0);

        // uy derazalari, yorug'lik va tutun
        for (const w of wins) {
            const f = 0.8 + 0.2 * Math.sin(T * w.s + w.p) * Math.sin(T * w.s * 2.7 + w.p);
            g.globalAlpha = 0.1 * f;
            g.fillStyle = '#ffa83a';
            g.fillRect(w.x - 3, w.y - 3, w.w + 6, w.h + 6);
            g.globalAlpha = 1;
            g.fillStyle = f > 0.9 ? '#ffd27a' : '#ffb347';
            g.fillRect(w.x, w.y, w.w, w.h);
            if (!w.door) {
                g.fillStyle = '#3a2414';
                g.fillRect(w.x + (w.w >> 1), w.y, 1, w.h);
            } else {
                g.globalAlpha = 0.07 * f;
                g.fillStyle = '#ffb347';
                for (let k = 0; k < 9; k++) g.fillRect(w.x - 2 - k, 103 + k, w.w + 4 + 2 * k, 1);
                g.globalAlpha = 1;
            }
        }
        g.globalAlpha = 1;
        smoke.forEach((s, i) => {
            s.t = (s.t + dt * 0.12 * K) % 1;
            const sz = 1 + Math.floor(s.t * 3);
            g.globalAlpha = 0.26 * (1 - s.t);
            g.fillStyle = '#9fb0b8';
            g.fillRect(Math.round(315 + Math.sin(T * 0.8 + i) * 2 + s.t * 8), Math.round(61 - s.t * 26), sz, sz);
        });
        g.globalAlpha = 1;

        // oy nuri tovlanishlari
        g.globalAlpha = 0.1;
        for (const s of streaks) {
            const span = W + s.w * 2;
            const x = ((s.x + T * s.sp * K) % span) - s.w;
            g.fillStyle = s.light ? '#a9d8c0' : '#06100c';
            g.fillRect(Math.round(x), s.y, Math.round(s.w), 1);
        }
        g.globalAlpha = 1;

        // o'tloq, to'siq, ko'rsatkich, toshlar (uzoqdan yaqinga)
        for (const it of items) {
            switch (it.k) {
                case 0: {
                    const wind =
                        Math.sin(T * 0.9 * K + it.x * 0.03 - it.by * 0.015) * 0.6 +
                        Math.sin(T * 0.4 * K + it.x * 0.011) * 0.4 +
                        0.3;
                    const top = wind * (0.8 + it.t * 2.2) + it.lean * 1.6;
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
                    g.fillStyle = it.c1;
                    g.fillRect(Math.round(it.x + top * u2 * u2), it.by - it.h + 1, 1, 1);
                    break;
                }
                case 1:
                    drawPost(it);
                    break;
                case 2:
                    drawSign(it);
                    break;
                case 3:
                    drawRock(it);
                    break;
                default: {
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
        }
        g.globalAlpha = 1;

        // o't pashshalari
        for (const f of flies) {
            const x = Math.round(f.bx + Math.sin(T * f.sx * K + f.p) * f.ax);
            const y = Math.round(f.by + Math.cos(T * f.sy * K + f.q) * f.ay);
            const a = 0.25 + 0.75 * Math.pow(Math.max(0, Math.sin(T * f.blink + f.p * 3)), 2);
            g.fillStyle = '#9fe03a';
            g.globalAlpha = 0.08 * a;
            g.fillRect(x - 2, y - 2, 5, 5);
            g.globalAlpha = 0.18 * a;
            g.fillRect(x - 1, y - 1, 3, 3);
            g.globalAlpha = a;
            g.fillStyle = '#e2ff7a';
            g.fillRect(x, y, 1, 1);
        }
        g.globalAlpha = 1;

        // old plandagi qora o't barglari
        for (const b of fgBlades) {
            const sway = (Math.sin(T * 0.9 * K + b.bx * 0.03) * 0.7 + 0.3) * 3.2;
            g.fillStyle = b.hl ? '#0c1c14' : '#050d09';
            for (let u = 0; u < b.h; u++) {
                const t = u / b.h;
                const x = b.bx + (b.lean + sway) * t * t;
                const w = Math.max(1, Math.round(b.w * (1 - t) + 0.4));
                g.fillRect(Math.round(x - w / 2), H + 1 - u, w, 1);
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

export default function Meadow() {
    const canvasRef = useRef(null);

    useEffect(() => createScene(canvasRef.current), []);

    return (
        <div className="meadow">
            <canvas
                ref={canvasRef}
                className="meadow__canvas"
                width={W}
                height={H}
                aria-label="Tungi o'tloq: yarim oy, ferma uyi, yo'l va o't pashshalari"
            />
        </div>
    );
}