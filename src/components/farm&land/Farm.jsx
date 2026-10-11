import { useEffect, useRef } from 'react';
import './Farm.scss';

const W = 384, H = 216, HOR = 128; // kanvas o'lchami va ufq chizig'i

// ---------- yordamchilar ----------
const mk = (w, h) => {
    const e = document.createElement('canvas');
    e.width = w;
    e.height = h;
    return e;
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')';
};
const pc = (ctx, cx, cy, r, col) => {
    // piksel doira
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
        const w = Math.floor(Math.sqrt(r * r - dy * dy + 0.5));
        ctx.fillRect(cx - w, cy + dy, 2 * w + 1, 1);
    }
};

export default function Farm() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const c = canvasRef.current;
        const g = c.getContext('2d');
        const RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        let seed = 20261009;
        const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;

        // ---------- 1) OSMON (dither bilan) ----------
        const skyC = mk(W, H), sg = skyC.getContext('2d');
        const SKY = [...Array(8)].map((_, i) => mix('#02030a', '#123a63', i / 7));
        const BAY = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        for (let y = 0; y <= HOR + 2; y++) {
            for (let x = 0; x < W; x++) {
                const v = Math.pow(Math.min(1, y / HOR), 2.6) * 7;
                const l = Math.min(7, Math.floor(v + BAY[(y & 3) * 4 + (x & 3)] / 16));
                sg.fillStyle = SKY[l];
                sg.fillRect(x, y, 1, 1);
            }
        }

        // ---------- 2) OY ----------
        const MX = 100, MY = 67, MR = 14;
        const moonC = mk(MR * 2 + 3, MR * 2 + 3), mg = moonC.getContext('2d');
        const craters = [[-5, -4, 4], [5, 3, 5], [-1, 7, 3], [6, -7, 3], [-9, 4, 2], [2, -2, 2]];
        for (let y = -MR; y <= MR; y++) {
            for (let x = -MR; x <= MR; x++) {
                if (x * x + y * y > MR * MR) continue;
                const lit = (-x - y) / (MR * 1.6);
                let col = lit > 0.35 ? '#f8efbd' : lit < -0.45 ? '#d4c47f' : '#ebdc98';
                for (const [cx, cy, r] of craters) {
                    if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) {
                        col = (x - cx) + (y - cy) < -r * 0.4 ? '#bba96a' : '#cdbb7c';
                        break;
                    }
                }
                mg.fillStyle = col;
                mg.fillRect(x + MR + 1, y + MR + 1, 1, 1);
            }
        }

        // ---------- 3) YULDUZLAR ----------
        const stars = [];
        for (let i = 0; i < 320; i++) {
            const x = Math.floor(rnd() * W);
            const y = Math.floor(Math.pow(rnd(), 1.3) * (HOR - 12));
            if ((x - MX) ** 2 + (y - MY) ** 2 < 19 * 19) continue;
            const big = i < 32;
            const cols = big
                ? ['#ffd9a3', '#ffb866', '#ffffff']
                : ['#ffffff', '#fff1c9', '#ffd9a3', '#a9bdff'];
            stars.push({
                x, y, big,
                p: rnd() * 6.28,
                sp: 0.8 + rnd() * 2.5,
                c: cols[Math.floor(rnd() * cols.length)],
            });
        }

        // ---------- 4) UCHAYOTGAN YULDUZLAR ----------
        const shots = [];
        let nextShot = 1.2;
        const shoot = (x = rnd() * W, y = rnd() * H * 0.35) => {
            const dir = rnd() < 0.5 ? -1 : 1, sp = 90 + rnd() * 60;
            shots.push({ x, y, vx: dir * sp * 0.85, vy: sp * 0.45, life: 0, max: 0.9 + rnd() * 0.5 });
        };

        // ---------- 5) BULUTLAR ----------
        const cloudSprite = (w, h) => {
            const e = mk(w, h), x = e.getContext('2d');
            for (let i = 0; i < 6; i++) {
                const cx = w * (0.15 + 0.7 * rnd()), cy = h * (0.45 + 0.35 * rnd());
                const rx = Math.max(3, w * (0.12 + 0.14 * rnd()));
                const ry = Math.max(2, h * (0.22 + 0.22 * rnd()));
                for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
                    const dx = rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2));
                    x.fillStyle = y < h * 0.5 ? '#173a63' : '#0d2342';
                    x.fillRect(Math.floor(cx - dx), y, Math.ceil(dx * 2), 1);
                }
            }
            return e;
        };
        const clouds = [
            [0, 92, 64, 13, 1.2], [30, 110, 56, 9, 0.8], [300, 88, 80, 15, 0.9],
            [250, 108, 70, 11, 1.3], [170, 116, 50, 7, 0.6],
        ].map(([x, y, w, h, sp]) => ({ x, y, w, h, sp, img: cloudSprite(w, h) }));

        // ---------- 6) TEPALIKLAR + QISHLOQ ----------
        const landC = mk(W, H), lg = landC.getContext('2d');
        for (let x = 0; x < W; x++) {
            // uzoqdagi tepalik
            const e = Math.abs(x - W / 2) / (W / 2);
            const h = Math.round(5 + 8 * Math.pow(e, 1.4) + 2 * Math.sin(x * 0.05));
            lg.fillStyle = '#08121f';
            lg.fillRect(x, HOR - h, 1, h + 3);
        }
        for (let x = 0; x < W; x++) {
            // yaqindagi tepalik
            const e = Math.abs(x - W / 2) / (W / 2);
            const h = Math.round(
                2 + 8 * Math.pow(e, 1.4) + 2 * Math.sin(x * 0.07) + 1.5 * Math.sin(x * 0.19 + 1)
            );
            lg.fillStyle = '#050b16';
            lg.fillRect(x, HOR - h, 1, h + 3);
        }
        const BASE = HOR + 1, wins = [];
        let vx = 92;
        while (vx < 166) {
            if (rnd() < 0.28) {
                // daraxt
                const r = 2 + Math.floor(rnd() * 2);
                pc(lg, vx + r, BASE - r, r, '#050a14');
                vx += r * 2 + 1;
                continue;
            }
            const w = 4 + Math.floor(rnd() * 4), h = 3 + Math.floor(rnd() * 3);
            lg.fillStyle = '#050912';
            lg.fillRect(vx, BASE - h, w, h);
            for (let i = 0; i < Math.ceil(w / 2); i++) {
                lg.fillRect(vx + i, BASE - h - 1 - i, w - 2 * i, 1);
            }
            for (let k = 0; k < 2; k++) {
                if (rnd() < 0.75) {
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
        lg.fillStyle = '#050912'; // cherkov
        lg.fillRect(123, BASE - 6, 12, 6);
        lg.fillRect(128, BASE - 14, 4, 14);
        [[4, 128], [2, 129], [2, 129], [1, 129], [1, 129], [1, 129]].forEach(([w, x], i) =>
            lg.fillRect(x, BASE - 15 - i, w, 1)
        );
        wins.push(
            { x: 129, y: BASE - 10, p: 0, s: 0.4 },
            { x: 126, y: BASE - 4, p: 2, s: 0.7 },
            { x: 132, y: BASE - 4, p: 4, s: 0.9 }
        );

        // ---------- 7) DALA ----------
        const fieldC = mk(W, H), fg = fieldC.getContext('2d');
        for (let y = HOR; y < H; y++) {
            fg.fillStyle = mix('#e8a424', '#552507', Math.pow((y - HOR) / (H - HOR), 0.7));
            fg.fillRect(0, y, W, 1);
        }
        const streaks = [];
        for (let i = 0; i < 46; i++) {
            streaks.push({
                y: HOR + 1 + Math.floor(rnd() * (H - HOR)),
                x: rnd() * W,
                w: 14 + rnd() * 50,
                sp: 6 + rnd() * 14,
                light: rnd() < 0.55,
            });
        }

        const PAL = [
            ['#f3ae2c', '#ffcf55'], ['#ffd45c', '#ffe58a'], ['#e08f1c', '#f5a82e'],
            ['#ffeb94', '#fff3b8'], ['#a85a10', '#c27418'], ['#7a3d0a', '#9a5210'],
        ];
        const stalks = [];
        for (let i = 0; i < 2400; i++) {
            const by = Math.floor(HOR + 2 + Math.pow(rnd(), 0.85) * (H - HOR + 2));
            const t = (by - HOR) / (H - HOR);
            const pal = rnd() < 0.1 + t * 0.3
                ? PAL[4 + Math.floor(rnd() * 2)]
                : PAL[Math.floor(rnd() * 4)];
            stalks.push({
                x: rnd() * W, by, t,
                h: Math.round(3 + t * 17 * (0.55 + 0.7 * rnd())),
                lean: rnd() - 0.5,
                p: rnd() * 6.28,
                col: pal[0],
                lcol: pal[1],
            });
        }
        stalks.sort((a, b) => a.by - b.by);

        const flies = [];
        for (let i = 0; i < 46; i++) {
            flies.push({
                x: rnd() * W,
                y: HOR + 10 + rnd() * (H - HOR - 10),
                vx: (rnd() - 0.5) * 4,
                vy: -2 - rnd() * 4,
                p: rnd() * 6.28,
                sp: 1 + rnd() * 2,
            });
        }

        // ---------- 8) QO'RQOQ ----------
        const SCX = 263, SCT = 130, SC_FRONT = 176;
        const scarecrow = (T) => {
            const sw = Math.sin(T * 1.1) * 0.9, o = Math.round(sw), col = '#150904';
            const R = (x, y, w, h) => {
                g.fillStyle = col;
                g.fillRect(SCX + x, SCT + y, w, h);
            };
            R(-1, 34, 2, 18); // tayoq
            for (let r = 0; r < 22; r++) {
                // tana
                const w = Math.min(14, 10 + Math.floor(r / 6) * 2);
                const bo = Math.round(sw * (1 - r / 22));
                R(-Math.floor(w / 2) + bo, 16 + r, w, 1);
            }
            [3, 1, 4, 2, 4, 1, 3].forEach((h, i) => R(-7 + i * 2, 38, 2, h)); // yirtiq etak
            for (let i = 0; i < 18; i++) {
                // qo'llar
                const fl = Math.round(Math.sin(T * 2.2 + i) * 0.6) * (i > 12 ? 1 : 0);
                R(6 + i, 17 - Math.floor(i / 7) + fl, 1, 3);
                R(-6 - i, 17 + Math.floor(i / 9) + fl, 1, 3);
            }
            for (let j = 0; j < 4; j++) {
                // somon uchlari
                R(23 + j, 18, 1, 2 + ((j * 3) % 4));
                R(-24 - j, 20, 1, 2 + ((j * 3) % 4));
            }
            R(-1 + o, 15, 2, 2); // bo'yin
            R(-3 + o, 8, 6, 7); // bosh
            R(-7 + o, 6, 14, 2); // shlyapa qirg'og'i
            R(-3 + o, 2, 6, 4);
            R(-2 + o, 0, 4, 2);
            R(2 + o, -1, 3, 2); // egilgan uchi
            R(4 + o, 0, 2, 2);
        };

        // ---------- CHIZISH ----------
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
                    nextShot = 2.5 + rnd() * 4;
                }
                for (let i = shots.length - 1; i >= 0; i--) {
                    const s = shots[i];
                    s.life += dt;
                    s.x += s.vx * dt;
                    s.y += s.vy * dt;
                    if (s.life > s.max || s.y > HOR - 8) {
                        shots.splice(i, 1);
                        continue;
                    }
                    const fade = 1 - s.life / s.max;
                    for (let k = 0; k < 16; k++) {
                        g.globalAlpha = Math.max(0, fade * (1 - k / 16));
                        g.fillStyle = k < 2 ? '#ffffff' : k < 8 ? '#ffe9b0' : '#ffb866';
                        g.fillRect(
                            Math.round(s.x - s.vx * k * 0.008),
                            Math.round(s.y - s.vy * k * 0.008),
                            1, 1
                        );
                    }
                }
                g.globalAlpha = 1;
            }

            // oy va uning nuri
            const pulse = 0.8 + 0.2 * Math.sin(T * 0.8);
            [[MR + 9, 0.05], [MR + 6, 0.07], [MR + 3, 0.1]].forEach(([r, a]) => {
                g.globalAlpha = a * pulse;
                pc(g, MX, MY, r, '#fff0b0');
            });
            g.globalAlpha = 1;
            g.drawImage(moonC, MX - MR - 1, MY - MR - 1);

            // bulutlar
            g.globalAlpha = 0.85;
            for (const cl of clouds) {
                const span = W + cl.w;
                const px = ((((cl.x + T * cl.sp) % span) + span) % span) - cl.w;
                g.drawImage(cl.img, Math.round(px), cl.y);
            }
            g.globalAlpha = 1;

            // tepalik va qishloq
            g.drawImage(landC, 0, 0);
            for (const w of wins) {
                const f = 0.65 + 0.35 * Math.sin(T * w.s + w.p) * Math.sin(T * w.s * 2.3 + w.p);
                g.globalAlpha = 0.14 * f;
                g.fillStyle = '#ff9a2e';
                g.fillRect(w.x - 1, w.y - 1, 3, 3);
                g.globalAlpha = Math.min(1, 0.6 + 0.4 * f);
                g.fillStyle = '#ffd27a';
                g.fillRect(w.x, w.y, 1, 1);
            }
            g.globalAlpha = 1;

            // dala tagligi + shamol tovlanishi
            g.drawImage(fieldC, 0, 0);
            g.globalAlpha = 0.22;
            for (const s of streaks) {
                const span = W + s.w * 2;
                const x = ((s.x + T * s.sp) % span) - s.w;
                g.fillStyle = s.light ? '#ffd25e' : '#3a1503';
                g.fillRect(Math.round(x), s.y, Math.round(s.w), s.y > HOR + 40 ? 2 : 1);
            }
            g.globalAlpha = 1;

            // bug'doy boshoqlari (qo'rqoq o'rtada chiziladi)
            let sc = false;
            const k = RM ? 0.35 : 1;
            for (const s of stalks) {
                if (!sc && s.by >= SC_FRONT) {
                    scarecrow(T);
                    sc = true;
                }
                const wind =
                    Math.sin(T * 1.3 * k + s.x * 0.035 - s.by * 0.02) * 0.55 +
                    Math.sin(T * 0.55 * k + s.x * 0.012) * 0.45 +
                    0.35;
                const amp = 1.2 + s.t * 3.2;
                const top = wind * amp + s.lean * 1.5;
                g.fillStyle = wind > 0.9 ? s.lcol : s.col;
                for (let i = 0; i < s.h; i++) {
                    const u = i / s.h;
                    const off = top * u * u + Math.sin(T * 3 * k + s.p + i * 0.4) * 0.25 * u;
                    g.fillRect(Math.round(s.x + off), s.by - i, 1, 1);
                }
                const tx = Math.round(s.x + top);
                g.fillStyle = '#fff0a8';
                g.fillRect(tx, s.by - s.h - 1, 1, 2);
                g.fillRect(tx + (s.lean > 0 ? 1 : -1), s.by - s.h, 1, 1);
            }
            if (!sc) scarecrow(T);

            // o't pashshalari (uchqunlar)
            for (const f of flies) {
                f.x += (f.vx + Math.sin(T + f.p) * 3) * dt;
                f.y += f.vy * dt;
                if (f.y < HOR + 4) {
                    f.y = H + 2;
                    f.x = rnd() * W;
                }
                if (f.x < -2) f.x = W + 2;
                if (f.x > W + 2) f.x = -2;
                const a = 0.3 + 0.7 * Math.max(0, Math.sin(T * f.sp + f.p));
                g.globalAlpha = a * 0.2;
                g.fillStyle = '#ffcf6b';
                g.fillRect(Math.round(f.x) - 1, Math.round(f.y) - 1, 3, 3);
                g.globalAlpha = a;
                g.fillStyle = '#ffe9a0';
                g.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
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
        <div className="farm">
            <canvas
                ref={canvasRef}
                className="farm__canvas"
                width={W}
                height={H}
                aria-label="Tun, oy nuri, bug'doyzor va qo'rqoq"
            />
        </div>
    );
}   