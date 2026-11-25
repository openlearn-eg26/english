/* app.js - hash router, practice and test modes, progress stored in this browser (localStorage) */
(function () {
    'use strict';
    const KEY = 'lang-progress.v2', OLD_KEY = 'lang-progress.v1';
    const app = document.getElementById('app');

    /* ---------- storage layer (swap this object for a real backend later) ---------- */
    const Store = {
        read() {
            try {
                const raw = localStorage.getItem(KEY);
                if (raw) return normalize(JSON.parse(raw));
                const old = JSON.parse(localStorage.getItem(OLD_KEY) || 'null');
                return normalize(old ? { lessons: pickOld(old), quiz: old.quiz } : {});
            } catch (e) { return normalize({}); }
        },
        write(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* private mode */ } },
    };
    function pickOld(old) {
        const o = {};
        lessons.forEach((l) => { if (old[l.id] && old[l.id].done) o[l.id] = { done: true, score: +old[l.id].score || 0, best: +old[l.id].score || 0 }; });
        return o;
    }
    function num(x) { x = Number(x); return isFinite(x) && x >= 0 ? Math.min(Math.floor(x), 100000) : 0; }
    function normalize(p) {
        p = p && typeof p === 'object' ? p : {};
        const out = { profile: { name: '' }, lessons: {}, quiz: null, tests: {}, answers: {}, days: [], fixed: num(p.fixed) };
        if (p.profile && typeof p.profile.name === 'string') out.profile.name = p.profile.name.slice(0, 30);
        lessons.forEach((l) => {
            const s = p.lessons && p.lessons[l.id];
            if (s && s.done) out.lessons[l.id] = { done: true, score: Math.min(num(s.score), l.steps.length), best: Math.min(num(s.best || s.score), l.steps.length) };
            const t = p.tests && p.tests['lesson-' + l.number];
            if (t) out.tests['lesson-' + l.number] = { best: Math.min(num(t.best), l.steps.length), last: Math.min(num(t.last), l.steps.length) };
        });
        if (p.quiz && p.quiz.done !== false) out.quiz = { score: Math.min(num(p.quiz.score), quiz.length), best: Math.min(num(p.quiz.best || p.quiz.score), quiz.length) };
        if (p.tests && p.tests.mixed) out.tests.mixed = { best: Math.min(num(p.tests.mixed.best), MIXED_N), last: Math.min(num(p.tests.mixed.last), MIXED_N) };
        const valid = new Set(allItems().map((i) => i.key));
        Object.keys(p.answers || {}).forEach((k) => {
            const a = p.answers[k];
            if (valid.has(k) && a) out.answers[k] = { r: num(a.r), w: num(a.w), miss: a.miss !== undefined ? !!a.miss : a.last === false, ok2: Math.min(num(a.ok2), 2) };
        });
        (Array.isArray(p.days) ? p.days : []).forEach((d) => { if (/^\d{4}-\d{2}-\d{2}$/.test(d) && out.days.indexOf(d) < 0) out.days.push(d); });
        out.days = out.days.sort().slice(-120);
        return out;
    }
    let P = Store.read();
    function save() { Store.write(P); }
    function today() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function markDay() { const t = today(); if (P.days.indexOf(t) < 0) P.days.push(t); }

    /* ---------- items ---------- */
    const MIXED_N = 12;
    function allItems() {
        const out = [];
        lessons.forEach((l) => l.steps.forEach((s, i) => out.push(Object.assign({}, s, { key: 'L' + l.number + 'S' + (i + 1), tag: l.title, lesson: l.number }))));
        quiz.forEach((q, i) => out.push({ scene: q.q, choices: q.choices, correct: q.correct, explain: q.explain, key: 'Q' + (i + 1), tag: 'المراجعة', lesson: 0 }));
        return out;
    }
    const ITEMS = allItems();
    const byKey = {}; ITEMS.forEach((i) => { byKey[i.key] = i; });
    function lessonSteps(l) { return ITEMS.filter((i) => i.lesson === l.number); }
    function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

    function recordAnswer(step, ok) {
        if (!step.key) return;
        const a = P.answers[step.key] || { r: 0, w: 0, miss: false, ok2: 0 };
        if (ok) { a.r++; if (a.miss) { a.ok2++; if (a.ok2 >= 2) { a.miss = false; a.ok2 = 0; P.fixed++; } } }
        else { a.w++; a.miss = true; a.ok2 = 0; }
        P.answers[step.key] = a;
        markDay(); save();
    }
    function stats() {
        let r = 0, w = 0, miss = [];
        Object.keys(P.answers).forEach((k) => { r += P.answers[k].r; w += P.answers[k].w; if (P.answers[k].miss) miss.push(k); });
        return {
            done: lessons.filter((l) => P.lessons[l.id]).length,
            acc: r + w ? Math.round((r / (r + w)) * 100) : null,
            answered: r + w, right: r, fixed: P.fixed, days: P.days.length, miss: miss,
        };
    }

    /* ---------- dom helpers ---------- */
    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined && text !== null) n.textContent = text;
        return n;
    }
    function add(parent) { for (let i = 1; i < arguments.length; i++) if (arguments[i]) parent.appendChild(arguments[i]); return parent; }
    function link(text, href, cls) { const a = el('a', cls, text); a.href = href; return a; }
    function btn(text, cls, fn) { const b = el('button', 'btn ' + (cls || 'secondary'), text); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; }
    function enSpan(text, cls) { const s = el('span', 'en' + (cls ? ' ' + cls : ''), text); s.dir = 'ltr'; s.lang = 'en'; return s; }
    function phraseLine(p) {
        const row = el('div', 'phrase-line');
        row.appendChild(enSpan(p.en));
        if (p.pr) row.appendChild(el('span', 'pron', p.pr));
        if (p.ar) row.appendChild(el('span', 'meaning', p.ar));
        return row;
    }
    function section(label, heading) {
        const g = el('section', 'group');
        if (label) g.appendChild(el('p', 'group-label', label));
        if (heading) g.appendChild(el('h2', null, heading));
        return g;
    }
    function pageHead(title, sub) {
        const h = el('header', 'page-head');
        const t = el('h1', null, title); t.id = 'page-title'; t.tabIndex = -1;
        h.appendChild(t);
        if (sub) h.appendChild(el('p', 'page-sub', sub));
        return h;
    }
    function bar(pct) { const b = el('div', 'bar'); const f = el('div', 'bar-fill'); f.style.width = Math.max(0, Math.min(100, pct)) + '%'; b.appendChild(f); return b; }
    function ring(pct, label) { const r = el('div', 'ring'); r.style.setProperty('--p', String(pct)); r.setAttribute('role', 'img'); r.setAttribute('aria-label', label); r.appendChild(el('span', null, pct + '%')); return r; }
    function stat(value, label) { const s = el('div', 'stat'); s.appendChild(el('p', 'stat-v', String(value))); s.appendChild(el('p', 'stat-l', label)); return s; }
    function cols(main, side) { const c = el('div', 'cols'); c.appendChild(main); if (side) c.appendChild(side); return c; }
    function panel(title) { const p = el('aside', 'panel'); if (title) p.appendChild(el('h3', null, title)); return p; }

    /* ---------- step flow (one question at a time, instant correction) ---------- */
    const flowLabels = { next: 'الخطوة اللي بعدها', prev: 'السابق', finish: 'إنهاء الدرس', correct: 'إجابة صحيحة', wrong: 'مش دي، اقرا ليه', retry: 'حاول تاني' };
    function stepFlow(container, steps, labels, opts) {
        opts = opts || {};
        let index = 0;
        const firstTries = [];
        const orders = steps.map((s) => shuffle(s.choices.map((_, i) => i)));
        container.innerHTML = '';
        const flow = el('div', 'flow');
        container.appendChild(flow);

        function render() {
            const step = steps[index];
            let picked = null, showHint = false;
            flow.innerHTML = '';
            if (opts.onStep) opts.onStep(index, steps.length);
            flow.appendChild(el('p', 'counter', 'خطوة ' + (index + 1) + ' من ' + steps.length));
            if (step.tag && opts.showTag) flow.appendChild(el('p', 'tag', step.tag));
            flow.appendChild(el('p', 'scene', step.scene));
            if (step.them) {
                const bubble = el('div', 'them');
                bubble.appendChild(enSpan(step.them));
                if (step.themAr) {
                    const toggle = btn('الترجمة بالعربي', 'translate');
                    toggle.className = 'translate';
                    const hint = el('p', 'them-ar', step.themAr);
                    hint.hidden = true;
                    toggle.addEventListener('click', () => {
                        showHint = !showHint; hint.hidden = !showHint;
                        toggle.textContent = showHint ? 'اخفي الترجمة' : 'الترجمة بالعربي';
                    });
                    add(bubble, toggle, hint);
                }
                flow.appendChild(bubble);
            }
            const choicesBox = el('div', 'choices');
            const feedback = el('div', 'feedback');
            feedback.setAttribute('aria-live', 'polite');
            orders[index].forEach((origIdx) => {
                const b = el('button', 'choice');
                b.type = 'button';
                b.appendChild(enSpan(step.choices[origIdx]));
                b.addEventListener('click', () => {
                    picked = origIdx;
                    if (firstTries[index] === undefined) {
                        firstTries[index] = (origIdx === step.correct);
                        if (opts.onAnswer) opts.onAnswer(step, firstTries[index]);
                    }
                    Array.from(choicesBox.children).forEach((c, j) => {
                        const o = orders[index][j];
                        c.classList.remove('is-correct', 'is-wrong', 'is-idle');
                        if (o === step.correct) c.classList.add('is-correct');
                        else if (o === picked) c.classList.add('is-wrong');
                        else c.classList.add('is-idle');
                        c.disabled = (step.correct === picked);
                    });
                    feedback.innerHTML = '';
                    const ok = picked === step.correct;
                    const note = el('div', 'callout ' + (ok ? 'note' : 'warning'));
                    add(note, el('p', 'callout-title', ok ? labels.correct : labels.wrong), el('p', null, step.explain));
                    feedback.appendChild(note);
                    if (ok && step.phrase && step.phrase.en) {
                        const keep = el('div', 'keep');
                        add(keep, el('p', 'keep-label', 'افتكر الجملة دي'), phraseLine(step.phrase));
                        feedback.appendChild(keep);
                    }
                    const actions = el('div', 'actions');
                    if (ok) {
                        const last = index === steps.length - 1;
                        const nb = btn(last ? labels.finish : labels.next, 'primary', () => {
                            if (last) opts.onFinish && opts.onFinish(firstTries.filter(Boolean).length, firstTries.slice());
                            else { index++; render(); }
                        });
                        actions.appendChild(nb);
                        setTimeout(() => nb.focus({ preventScroll: true }), 0);
                    } else {
                        actions.appendChild(btn(labels.retry, 'secondary', () => {
                            picked = null;
                            Array.from(choicesBox.children).forEach((c) => { c.classList.remove('is-correct', 'is-wrong', 'is-idle'); c.disabled = false; });
                            feedback.innerHTML = '';
                        }));
                    }
                    feedback.appendChild(actions);
                });
                choicesBox.appendChild(b);
            });
            add(flow, choicesBox, feedback);
            if (index > 0) { const nr = el('div', 'actions'); nr.appendChild(btn(labels.prev, 'ghost', () => { index--; render(); })); flow.appendChild(nr); }
        }
        render();
    }

    /* ---------- result screen shared by tests ---------- */
    function resultView(container, title, steps, score, results, again, backHref, backText) {
        container.innerHTML = '';
        const pct = Math.round((score / steps.length) * 100);
        add(container, el('p', 'group-label', 'النتيجة'));
        add(container, el('h2', null, title + ': ' + score + ' من ' + steps.length));
        const row = el('div', 'result-row');
        add(row, ring(pct, 'النتيجة ' + pct + ' بالمية'), el('p', null, 'ده عدد الإجابات الصح من أول مرة. التصحيح بيفضل متاح، والغلطات الجاية بتتحفظ في صفحة تقدمي عشان تراجعها.'));
        container.appendChild(row);
        const wrong = steps.map((s, i) => ({ s: s, ok: results[i] })).filter((x) => !x.ok);
        if (wrong.length) {
            const box = el('div', 'callout warning');
            box.appendChild(el('p', 'callout-title', 'اللي غلطت فيه (' + wrong.length + ')'));
            const ul = el('ul', 'wrong-list');
            wrong.forEach((x) => {
                const li = el('li');
                if (x.s.them) li.appendChild(enSpan(x.s.them, 'block')); else li.appendChild(el('span', null, x.s.scene));
                const ans = el('span', 'meaning'); ans.appendChild(document.createTextNode('الإجابة الصح: ')); ans.appendChild(enSpan(x.s.choices[x.s.correct]));
                li.appendChild(ans);
                ul.appendChild(li);
            });
            box.appendChild(ul);
            container.appendChild(box);
        } else container.appendChild(el('div', 'callout note', 'كل إجاباتك صح من أول مرة.'));
        const actions = el('div', 'actions');
        add(actions, btn('إعادة الاختبار', 'primary', again), link(backText, backHref, 'btn secondary'));
        container.appendChild(actions);
    }

    /* ---------- views ---------- */
    function nextLesson() { return lessons.find((l) => !P.lessons[l.id]) || null; }

    function lessonCard(l) {
        const s = P.lessons[l.id];
        const a = link('', '#/lesson-' + l.number, 'card');
        a.appendChild(el('span', 'card-num', String(l.number)));
        const body = el('span', 'card-body');
        add(body, el('span', 'card-title', l.title), el('span', 'card-sub', l.subtitle));
        if (s) body.appendChild(bar((s.score / l.steps.length) * 100));
        a.appendChild(body);
        a.appendChild(el('span', 'card-state' + (s ? ' is-done' : ''), s ? s.score + '/' + l.steps.length + ' ✓' : 'لم يبدأ'));
        return a;
    }

    function home() {
        const st = stats();
        app.innerHTML = '';
        const name = P.profile.name;
        app.appendChild(pageHead(name ? 'أهلاً يا ' + name : site.title, site.intro));

        const main = el('div', 'main-col');
        const statsRow = el('div', 'stats');
        add(statsRow, stat(st.done + '/' + lessons.length, 'دروس خلصتها'), stat(st.acc === null ? '-' : st.acc + '%', 'دقة الإجابات من أول مرة'), stat(st.fixed, 'أخطاء اتصححت'), stat(st.miss.length, 'أسئلة للمراجعة'));
        main.appendChild(statsRow);

        const next = nextLesson();
        const cont = el('div', 'continue');
        add(cont, el('p', 'group-label', next ? (st.answered ? 'كمّل من حيث وقفت' : 'ابدأ من هنا') : 'خلصت كل الدروس'),
            el('h2', null, next ? 'الدرس ' + next.number + ': ' + next.title : 'ممتاز، راجع نفسك في الاختبارات'),
            el('p', null, next ? next.subtitle : 'جرب الاختبار الشامل أو راجع أخطاءك في التدريب.'));
        const ca = el('div', 'actions');
        ca.appendChild(next ? link('كمّل الدرس', '#/lesson-' + next.number, 'btn primary') : link('الاختبار الشامل', '#/test-mixed', 'btn primary'));
        ca.appendChild(link('تدريب سريع', '#/practice', 'btn secondary'));
        cont.appendChild(ca);
        main.appendChild(cont);

        const list = section('٦ مواقف من الحياة اليومية', 'الدروس');
        const cards = el('div', 'cards');
        lessons.forEach((l) => cards.appendChild(lessonCard(l)));
        list.appendChild(cards);
        main.appendChild(list);

        const side = el('div', 'side-col');
        const demo = panel('جرب على طول');
        const demoFlow = el('div');
        demo.appendChild(demoFlow);
        stepFlow(demoFlow, [ITEMS[0]], Object.assign({}, flowLabels, { finish: 'تمام، ابدأ الدروس' }), { onAnswer: recordAnswer, onFinish: () => { location.hash = '#/lesson-1'; } });
        side.appendChild(demo);
        const how = panel('الطريقة');
        const ol = el('ol', 'method');
        site.method.forEach((m) => ol.appendChild(el('li', null, m)));
        how.appendChild(ol);
        side.appendChild(how);
        app.appendChild(cols(main, side));
    }

    function lessonsView() {
        app.innerHTML = '';
        app.appendChild(pageHead('الدروس', '٦ مواقف من الحياة اليومية. كل درس ٤ خطوات، وتقدر تعيده في أي وقت.'));
        const cards = el('div', 'cards wide');
        lessons.forEach((l) => cards.appendChild(lessonCard(l)));
        app.appendChild(cards);
    }

    function lessonView(num) {
        const lesson = lessons.find((l) => l.number === num);
        if (!lesson) return home();
        const stored = P.lessons[lesson.id];
        app.innerHTML = '';
        app.appendChild(pageHead(lesson.title, 'الدرس ' + lesson.number + ' من ' + lessons.length + ': ' + lesson.subtitle));
        const main = el('div', 'main-col');
        main.appendChild(el('p', 'lead', lesson.intro));
        if (stored) main.appendChild(el('p', 'caption', 'خلصت الدرس ده قبل كده: ' + stored.score + ' من ' + lesson.steps.length + ' صح من أول مرة. تقدر تعيده في أي وقت.'));
        const flowBox = el('section', 'group card-box');
        main.appendChild(flowBox);

        const side = el('div', 'side-col');
        const prog = panel('تقدمك في الدرس');
        const dots = el('div', 'dots');
        const dotEls = lesson.steps.map(() => { const d = el('span', 'dot'); dots.appendChild(d); return d; });
        const dotLabel = el('p', 'caption', '');
        add(prog, dots, dotLabel);
        const keys = el('div', 'panel');
        keys.appendChild(el('h3', null, 'جمل الدرس'));
        const pl = el('div', 'phrases');
        lesson.phrases.forEach((p) => pl.appendChild(phraseLine(p)));
        keys.appendChild(pl);
        keys.appendChild(el('p', 'caption', 'النطق بالحروف العربية تقريبي ومش بديل عن سماع النطق الصحيح.'));
        add(side, prog, keys);

        stepFlow(flowBox, lessonSteps(lesson), flowLabels, {
            onStep: (i, n) => { dotEls.forEach((d, j) => { d.className = 'dot' + (j < i ? ' is-done' : j === i ? ' is-now' : ''); }); dotLabel.textContent = 'خطوة ' + (i + 1) + ' من ' + n; },
            onAnswer: recordAnswer,
            onFinish: (score) => {
                const prev = P.lessons[lesson.id];
                P.lessons[lesson.id] = { done: true, score: score, best: Math.max(score, prev ? prev.best : 0) };
                markDay(); save();
                flowBox.innerHTML = '';
                add(flowBox, el('p', 'group-label', 'النتيجة'), el('h2', null, 'خلصت «' + lesson.title + '»'), el('p', null, 'نتيجتك: ' + score + ' من ' + lesson.steps.length + ' صح من أول مرة.'));
                const note = el('div', 'callout note');
                add(note, el('p', 'callout-title', 'ثبت المعلومة'), el('p', null, 'جمل الدرس في القاموس، وتقدر تختبر نفسك في اختبار الدرس أو في التدريب. إعادة الدرس متاحة في أي وقت.'));
                flowBox.appendChild(note);
                const actions = el('div', 'actions');
                const nx = lessons.find((l) => l.number === lesson.number + 1);
                if (nx) actions.appendChild(link('الدرس اللي بعده: ' + nx.title, '#/lesson-' + nx.number, 'btn primary'));
                add(actions, link('اختبار الدرس', '#/test-lesson-' + lesson.number, 'btn secondary'), link('رجوع للدروس', '#/lessons', 'btn secondary'));
                flowBox.appendChild(actions);
            },
        });
        app.appendChild(cols(main, side));
    }

    function runSet(title, steps, kind, backHref, backText, saveFn) {
        const box = el('section', 'group card-box');
        function start() {
            const set = steps();
            stepFlow(box, set, Object.assign({}, flowLabels, { finish: 'شوف النتيجة', next: 'السؤال اللي بعده' }), {
                showTag: true,
                onAnswer: recordAnswer,
                onFinish: (score, results) => { if (saveFn) saveFn(score); markDay(); save(); resultView(box, title, set, score, results, start, backHref, backText); },
            });
        }
        start();
        return box;
    }

    function practiceView() {
        app.innerHTML = '';
        app.appendChild(pageHead('تدريب واختبارات', 'تدريب بتصحيح فوري ومن غير درجة، واختبارات بنتيجة تتحفظ. الاتنين في مكان واحد.'));
        const st = stats();
        const main = el('div', 'main-col');
        const side = el('div', 'side-col');
        const holder = el('div');
        main.appendChild(holder);
        const picker = el('section', 'group card-box');
        picker.appendChild(el('h2', null, 'اختار نوع التدريب'));
        const actions = el('div', 'actions');
        const mix = btn('١٠ أسئلة متنوعة', 'primary', () => {
            holder.innerHTML = ''; holder.appendChild(runSet('تدريب متنوع', () => shuffle(ITEMS).slice(0, 10), 'practice', '#/practice', 'رجوع للتدريب'));
        });
        const mis = btn('راجع أخطائي (' + st.miss.length + ')', 'secondary', () => {
            holder.innerHTML = '';
            const cur = stats().miss;
            if (!cur.length) { holder.appendChild(el('div', 'callout note', 'مفيش أخطاء متسجلة دلوقتي. جرب تدريب متنوع.')); return; }
            holder.appendChild(runSet('مراجعة الأخطاء', () => shuffle(cur.map((k) => byKey[k])), 'mistakes', '#/practice', 'رجوع للتدريب'));
        });
        add(actions, mix, mis);
        picker.appendChild(actions);
        picker.appendChild(el('p', 'caption', 'الأسئلة اللي بتغلط فيها من أول مرة بتتسجل هنا، وبتتشال من القائمة لما تجاوبها صح مرتين ورا بعض.'));
        main.insertBefore(picker, holder);
        const info = panel('مفيد تعرف');
        info.appendChild(el('p', null, 'التدريب بيشمل ٢٤ خطوة من الدروس و٨ أسئلة من المراجعة. مفيش وقت محدد ولا ضغط.'));
        side.appendChild(info);
        app.appendChild(cols(main, side));
        const ts = section('اختبر نفسك من ذاكرتك', 'الاختبارات');
        ts.id = 'tests-sec';
        ts.style.marginTop = '32px';
        ts.appendChild(testsGrid());
        app.appendChild(ts);
    }

    function testsGrid() {
        const grid = el('div', 'cards wide');
        function tcard(title, sub, href, state) {
            const a = link('', href, 'card');
            const body = el('span', 'card-body');
            add(body, el('span', 'card-title', title), el('span', 'card-sub', sub));
            add(a, body, el('span', 'card-state' + (state ? ' is-done' : ''), state || 'لم يبدأ'));
            return a;
        }
        grid.appendChild(tcard('المراجعة العامة', quiz.length + ' أسئلة من كل المواقف', '#/review', P.quiz ? 'الأفضل ' + P.quiz.best + '/' + quiz.length : ''));
        grid.appendChild(tcard('الاختبار الشامل', MIXED_N + ' سؤال عشوائي من كل الدروس', '#/test-mixed', P.tests.mixed ? 'الأفضل ' + P.tests.mixed.best + '/' + MIXED_N : ''));
        lessons.forEach((l) => { const t = P.tests['lesson-' + l.number]; grid.appendChild(tcard('اختبار الدرس ' + l.number + ': ' + l.title, l.steps.length + ' أسئلة بترتيب عشوائي', '#/test-lesson-' + l.number, t ? 'الأفضل ' + t.best + '/' + l.steps.length : '')); });
        return grid;
    }

    function testView(title, backTitle, get, n, saveFn) {
        app.innerHTML = '';
        app.appendChild(pageHead(title, 'جاوب من ذاكرتك. كل سؤال بيتصحح فورًا، وفي الآخر بتشوف النتيجة والغلطات.'));
        const wrap = el('div', 'narrow');
        wrap.appendChild(runSet(title, get, 'test', '#/tests', backTitle, saveFn));
        app.appendChild(wrap);
    }

    function reviewView() {
        app.innerHTML = '';
        app.appendChild(pageHead('المراجعة', 'أسئلة من كل المواقف اللي درستها. جاوب من ذاكرتك، والتصحيح هيفكرك بالسبب.'));
        const wrap = el('div', 'narrow');
        if (P.quiz) wrap.appendChild(el('p', 'caption', 'آخر نتيجة ليك: ' + P.quiz.score + ' من ' + quiz.length + '. الأفضل: ' + P.quiz.best + '.'));
        wrap.appendChild(runSet('نتيجة المراجعة', () => ITEMS.filter((i) => i.lesson === 0), 'test', '#/tests', 'رجوع للاختبارات', (score) => { P.quiz = { score: score, best: Math.max(score, P.quiz ? P.quiz.best : 0) }; }));
        app.appendChild(wrap);
    }

    function phrasesView() {
        app.innerHTML = '';
        app.appendChild(pageHead('قاموس المواقف', 'أهم الجمل من كل درس، ومعناها. اقراها بصوت عالي. النطق بالحروف العربية تقريبي ومش بديل عن سماع النطق الصحيح.'));
        const tools = el('div', 'tools');
        const input = el('input', 'search'); input.type = 'search'; input.placeholder = 'دوّر على جملة أو معنى'; input.setAttribute('aria-label', 'بحث في القاموس');
        const chips = el('div', 'chips');
        let filter = 0;
        const chipEls = [];
        function chip(text, v) { const c = btn(text, 'chip', () => { filter = v; chipEls.forEach((x) => x.el.setAttribute('aria-pressed', String(x.v === v))); draw(); }); c.setAttribute('aria-pressed', String(v === 0)); chipEls.push({ el: c, v: v }); chips.appendChild(c); }
        chip('كل الدروس', 0);
        lessons.forEach((l) => chip(l.number + '. ' + l.title, l.number));
        add(tools, input, chips);
        app.appendChild(tools);
        const out = el('div', 'phrase-grid');
        app.appendChild(out);
        const empty = el('p', 'caption', 'مفيش نتايج. جرب كلمة تانية.'); empty.hidden = true; app.appendChild(empty);
        function draw() {
            out.innerHTML = '';
            const q = input.value.trim().toLowerCase();
            let n = 0;
            lessons.forEach((l) => {
                if (filter && filter !== l.number) return;
                const items = l.phrases.filter((p) => !q || [p.en, p.ar, p.pr].join(' ').toLowerCase().indexOf(q) >= 0);
                if (!items.length) return;
                const g = el('section', 'card-box');
                g.appendChild(el('p', 'group-label', 'الدرس ' + l.number + ': ' + l.title));
                items.forEach((p) => { g.appendChild(phraseLine(p)); n++; });
                out.appendChild(g);
            });
            empty.hidden = n > 0;
        }
        input.addEventListener('input', draw);
        draw();
    }

    function progressView() {
        const st = stats();
        app.innerHTML = '';
        app.appendChild(pageHead('حسابي وتقدمي', 'ملخص اللي عملته، واسمك، ونسخة احتياطية من تقدمك. كله محفوظ على المتصفح ده.'));
        const main = el('div', 'main-col');
        const row = el('div', 'stats');
        add(row, stat(st.done + '/' + lessons.length, 'دروس خلصتها'), stat(st.acc === null ? '-' : st.acc + '%', 'دقة من أول مرة'), stat(st.right, 'إجابات صح من أول مرة'), stat(st.fixed, 'أخطاء اتصححت'));
        main.appendChild(row);
        const g = section('لكل درس', 'الدروس والاختبارات');
        lessons.forEach((l) => {
            const s = P.lessons[l.id], t = P.tests['lesson-' + l.number];
            const r = el('div', 'prow');
            const head = el('div', 'prow-head');
            add(head, link(l.number + '. ' + l.title, '#/lesson-' + l.number), el('span', 'meaning', (s ? 'الدرس ' + s.score + '/' + l.steps.length : 'لم يبدأ') + (t ? ' · الاختبار ' + t.best + '/' + l.steps.length : '')));
            add(r, head, bar(s ? (s.score / l.steps.length) * 100 : 0));
            g.appendChild(r);
        });
        const rv = el('div', 'prow');
        add(rv, el('div', 'prow-head', ''), bar(P.quiz ? (P.quiz.best / quiz.length) * 100 : 0));
        rv.firstChild.appendChild(link('المراجعة العامة', '#/review'));
        rv.firstChild.appendChild(el('span', 'meaning', P.quiz ? 'الأفضل ' + P.quiz.best + '/' + quiz.length : 'لم يبدأ'));
        g.appendChild(rv);
        main.appendChild(g);

        const side = el('div', 'side-col');
        const mp = panel('أسئلة للمراجعة');
        if (st.miss.length) {
            mp.appendChild(el('p', null, 'عندك ' + st.miss.length + ' سؤال غلطت فيهم من أول مرة.'));
            mp.appendChild(link('راجعهم في التدريب', '#/practice', 'btn primary'));
        } else mp.appendChild(el('p', null, 'مفيش أسئلة متسجلة للمراجعة.'));
        side.appendChild(mp);
        const dp = panel('أيام المذاكرة');
        const days = el('div', 'days');
        for (let i = 13; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const c = el('span', 'day' + (P.days.indexOf(k) >= 0 ? ' on' : '')); c.title = k; c.setAttribute('aria-label', k + (P.days.indexOf(k) >= 0 ? ': ذاكرت' : ': لم تذاكر'));
            days.appendChild(c);
        }
        add(dp, days, el('p', 'caption', 'ده سجل أيام ذاكرت فيها (' + st.days + ' يوم). مفيش عدّاد بيتصفّر، وتقدر ترجع في أي وقت.'));
        side.appendChild(dp);
        app.appendChild(cols(main, side));
        const ph = section('حفظ محلي على هذا المتصفح فقط (بدون حساب سحابي أو تسجيل دخول)', 'الملف الشخصي والنسخة الاحتياطية');
        ph.id = 'profile-sec';
        ph.style.marginTop = '32px';
        ph.appendChild(profileBlock());
        app.appendChild(ph);
    }

    function profileBlock() {
        const main = el('div', 'main-col');
        const g = el('section', 'group card-box');
        const av = el('div', 'avatar', (P.profile.name || '؟').trim().charAt(0) || '؟');
        const nameLab = el('label', 'field-label', 'الاسم اللي يظهر لك'); nameLab.htmlFor = 'pname';
        const name = el('input', 'search'); name.id = 'pname'; name.maxLength = 30; name.value = P.profile.name; name.placeholder = 'اكتب اسمك الأول';
        const msg = el('p', 'caption', ''); msg.setAttribute('aria-live', 'polite');
        const saveB = btn('حفظ الاسم', 'primary', () => { P.profile.name = name.value.trim().slice(0, 30); save(); av.textContent = (P.profile.name || '؟').charAt(0); msg.textContent = 'اتحفظ على المتصفح ده.'; });
        add(g, av, nameLab, name, saveB, msg);
        main.appendChild(g);

        const ex = el('section', 'group card-box');
        add(ex, el('h2', null, 'انقل تقدمك لجهاز تاني'));
        ex.appendChild(el('p', null, 'تقدّمك محفوظ داخل ذاكرة هذا المتصفح فقط، وقد يُحذف لو مسحت بيانات التصفح. نزّل نسخة احتياطية كملف، واستوردها لاستعادتها على نفس الجهاز أو على جهاز تاني.'));
        const act = el('div', 'actions');
        const exMsg = el('p', 'caption', ''); exMsg.setAttribute('aria-live', 'polite');
        const dl = btn('نزّل ملف التقدم', 'secondary', () => {
            const blob = new Blob([JSON.stringify(P, null, 2)], { type: 'application/json' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'english-by-situations-progress.json';
            document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            exMsg.textContent = 'الملف نزل. احتفظ بيه في مكان آمن.';
        });
        const file = el('input'); file.type = 'file'; file.accept = 'application/json,.json'; file.hidden = true; file.id = 'pfile';
        const up = btn('استيراد ملف تقدم', 'secondary', () => file.click());
        file.addEventListener('change', () => {
            const f = file.files && file.files[0];
            if (!f) return;
            if (f.size > 200000) { exMsg.textContent = 'الملف كبير ومش ملف تقدم من الموقع.'; return; }
            const rd = new FileReader();
            rd.onload = () => {
                try {
                    const obj = JSON.parse(String(rd.result));
                    if (!obj || typeof obj !== 'object' || (!obj.lessons && !obj.answers)) throw new Error('shape');
                    P = normalize(obj); save();
                    exMsg.textContent = 'اتستورد التقدم بنجاح. بيستبدل التقدم الحالي.';
                    name.value = P.profile.name; av.textContent = (P.profile.name || '؟').charAt(0);
                } catch (e) { exMsg.textContent = 'الملف مش صالح، ماحصلش أي تغيير.'; }
            };
            rd.readAsText(f);
            file.value = '';
        });
        add(act, dl, up, file);
        add(ex, act, exMsg);
        main.appendChild(ex);

        const side = el('div', 'side-col');
        const rs = panel('مسح التقدم');
        rs.appendChild(el('p', null, 'بيمسح اسمك وتقدمك وأخطاءك من المتصفح ده. مش بيتراجع عنه.'));
        let armed = false;
        const rb = btn('امسح كل حاجة', 'secondary', () => {
            if (!armed) { armed = true; rb.textContent = 'اضغط تاني للتأكيد'; rb.classList.add('danger'); return; }
            try { localStorage.removeItem(OLD_KEY); localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
            P = normalize({}); save(); route();
        });
        rs.appendChild(rb);
        side.appendChild(rs);
        const about = panel('عن بياناتك');
        about.appendChild(el('p', null, 'الموقع مجاني ومفيش تسجيل. اللي بيتحفظ: اسمك لو كتبته، ونتايجك، وأيام مذاكرتك. كله في متصفحك، ومبنبعتوش لأي مكان. لو مسحت بيانات الموقع من المتصفح هيتمسح.'));
        side.appendChild(about);
        return cols(main, side);
    }

    /* ---------- router ---------- */
    const navLinks = Array.from(document.querySelectorAll('[data-nav]'));
    function route() {
        const hash = location.hash.replace(/^#\/?/, '');
        let section = 'home';
        if (hash.startsWith('lesson-')) { section = 'lessons'; lessonView(parseInt(hash.slice(7), 10)); }
        else if (hash === 'lessons') { section = 'lessons'; lessonsView(); }
        else if (hash === 'practice') { section = 'practice'; practiceView(); }
        else if (hash === 'tests') { section = 'practice'; practiceView(); const t = document.getElementById('tests-sec'); if (t) t.scrollIntoView(); return finishRoute(section, true); }
        else if (hash === 'review') { section = 'practice'; reviewView(); }
        else if (hash === 'test-mixed') { section = 'practice'; testView('الاختبار الشامل', 'رجوع للاختبارات', () => shuffle(ITEMS).slice(0, MIXED_N), MIXED_N, (s) => { const p = P.tests.mixed; P.tests.mixed = { last: s, best: Math.max(s, p ? p.best : 0) }; }); }
        else if (hash.startsWith('test-lesson-')) {
            const l = lessons.find((x) => x.number === parseInt(hash.slice(12), 10));
            if (l) { section = 'practice'; testView('اختبار الدرس ' + l.number + ': ' + l.title, 'رجوع للاختبارات', () => shuffle(lessonSteps(l)), l.steps.length, (s) => { const k = 'lesson-' + l.number; const p = P.tests[k]; P.tests[k] = { last: s, best: Math.max(s, p ? p.best : 0) }; }); } else home();
        }
        else if (hash === 'phrases') { section = 'phrases'; phrasesView(); }
        else if (hash === 'progress') { section = 'progress'; progressView(); }
        else if (hash === 'profile') { section = 'progress'; progressView(); const t = document.getElementById('profile-sec'); if (t) t.scrollIntoView(); return finishRoute(section, true); }
        else home();
        finishRoute(section);
    }
    function finishRoute(section, keepScroll) {
        navLinks.forEach((a) => { if (a.dataset.nav === section) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
        document.body.classList.toggle('is-home', section === 'home');
        if (!keepScroll) window.scrollTo(0, 0);
        const t = document.getElementById('page-title');
        if (t) t.focus({ preventScroll: true });
    }
    window.addEventListener('hashchange', route);
    route();
})();
