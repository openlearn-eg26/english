/* app.js — hash router + interactive flow, progress in localStorage */
(function () {
    'use strict';
    const LS_KEY = 'lang-progress.v1';
    const app = document.getElementById('app');
    const $ = (sel, root) => (root || document).querySelector(sel);

    document.getElementById('site-title').textContent = site.title;
    document.getElementById('site-intro').textContent = site.intro;

    function loadProgress() {
        try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) { return {}; }
    }
    function saveProgress(p) {
        try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch (e) { /* private mode */ }
    }

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
    }
    function en(text) {
        const s = el('span', 'en', text);
        s.dir = 'ltr';
        return s;
    }
    function phraseLine(p) {
        const row = el('div', 'phrase-line');
        row.appendChild(en(p.en));
        if (p.pr) row.appendChild(el('span', 'pron', p.pr));
        if (p.ar) row.appendChild(el('span', 'meaning', p.ar));
        return row;
    }

    function stepFlow(container, steps, labels, onFinish) {
        let index = 0;
        const firstTries = [];
        const orders = steps.map((s) => {
            const idx = s.choices.map((_, i) => i);
            for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
            return idx;
        });
        container.innerHTML = '';

        const flow = el('div', 'flow');
        container.appendChild(flow);

        function render() {
            const step = steps[index];
            let picked = null;
            let showAr = false;
            flow.innerHTML = '';
            flow.appendChild(el('p', 'counter', 'خطوة ' + (index + 1) + ' من ' + steps.length));
            flow.appendChild(el('p', 'scene', step.scene));

            if (step.them) {
                const bubble = el('div', 'them');
                bubble.appendChild(en(step.them));
                if (step.themAr) {
                    const toggle = el('button', 'translate', 'الترجمة بالعربي');
                    toggle.type = 'button';
                    const arP = el('p', 'them-ar', step.themAr);
                    arP.hidden = true;
                    toggle.addEventListener('click', () => {
                        showAr = !showAr;
                        arP.hidden = !showAr;
                        toggle.textContent = showAr ? 'اخفي الترجمة' : 'الترجمة بالعربي';
                    });
                    bubble.appendChild(toggle);
                    bubble.appendChild(arP);
                }
                flow.appendChild(bubble);
            }

            const choicesBox = el('div', 'choices');
            const feedback = el('div', 'feedback');
            orders[index].forEach((origIdx) => {
                const choice = step.choices[origIdx];
                const btn = el('button', 'choice');
                btn.type = 'button';
                btn.appendChild(en(choice));
                btn.addEventListener('click', () => {
                    picked = origIdx;
                    if (firstTries[index] === undefined) firstTries[index] = (origIdx === step.correct);
                    Array.from(choicesBox.children).forEach((b, j) => {
                        const o = orders[index][j];
                        b.classList.remove('is-correct', 'is-wrong', 'is-idle');
                        if (o === step.correct) b.classList.add('is-correct');
                        else if (o === picked) b.classList.add('is-wrong');
                        else b.classList.add('is-idle');
                        b.disabled = (step.correct === picked);
                    });
                    feedback.innerHTML = '';
                    const ok = picked === step.correct;
                    const note = el('div', 'callout ' + (ok ? 'note' : 'warning'));
                    note.appendChild(el('p', 'callout-title', ok ? labels.correct : labels.wrong));
                    note.appendChild(el('p', null, step.explain));
                    feedback.appendChild(note);
                    if (ok && step.phrase && step.phrase.pr) {
                        const keep = el('div', 'keep');
                        keep.appendChild(el('p', 'keep-label', 'افتكر الجملة دي'));
                        keep.appendChild(phraseLine(step.phrase));
                        feedback.appendChild(keep);
                    }
                    const actions = el('div', 'actions');
                    if (ok) {
                        const nextBtn = el('button', 'btn primary', index === steps.length - 1 ? labels.finish : labels.next);
                        nextBtn.type = 'button';
                        nextBtn.addEventListener('click', () => {
                            if (index === steps.length - 1) onFinish(firstTries.filter(Boolean).length);
                            else { index++; render(); window.scrollTo(0, 0); }
                        });
                        actions.appendChild(nextBtn);
                    } else {
                        const retry = el('button', 'btn secondary', labels.retry);
                        retry.type = 'button';
                        retry.addEventListener('click', () => {
                            picked = null;
                            Array.from(choicesBox.children).forEach((b) => { b.classList.remove('is-correct', 'is-wrong', 'is-idle'); b.disabled = false; });
                            feedback.innerHTML = '';
                        });
                        actions.appendChild(retry);
                    }
                    feedback.appendChild(actions);
                });
                choicesBox.appendChild(btn);
            });
            flow.appendChild(choicesBox);
            flow.appendChild(feedback);
            if (index > 0) {
                const navRow = el('div', 'actions');
                const prev = el('button', 'btn ghost', labels.prev);
                prev.type = 'button';
                prev.addEventListener('click', () => { index--; render(); });
                navRow.appendChild(prev);
                flow.appendChild(navRow);
            }
        }
        render();
    }

    const flowLabels = { next: 'الخطوة اللي بعدها', prev: 'السابق', finish: 'إنهاء الدرس', correct: 'إجابة صحيحة', wrong: 'مش دي، اقرا ليه', retry: 'حاول تاني' };
    const quizLabels = Object.assign({}, flowLabels, { next: 'السؤال اللي بعده', finish: 'شوف النتيجة', correct: 'صح', wrong: 'غلط، اقرا ليه' });

    function group(label, heading) {
        const g = el('section', 'group');
        g.appendChild(el('p', 'group-label', label));
        if (heading) g.appendChild(el('h2', null, heading));
        return g;
    }

    function home() {
        const progress = loadProgress();
        app.innerHTML = '';

        const demo = group('جرب على طول', 'موقف تجريبي');
        const demoFlow = el('div');
        demo.appendChild(demoFlow);
        stepFlow(demoFlow, [lessons[0].steps[0]], Object.assign({}, flowLabels, { finish: 'تمام، ابدأ الدروس من تحت' }), () => {});
        app.appendChild(demo);

        const method = group('الطريقة', 'اتعلم من جوّه الموقف');
        const ol = el('ol', 'method');
        site.method.forEach((m) => ol.appendChild(el('li', null, m)));
        method.appendChild(ol);
        app.appendChild(method);

        const list = group('٦ مواقف من الحياة اليومية', 'الدروس');
        const cards = el('div', 'cards');
        lessons.forEach((lesson) => {
            const stored = progress[lesson.id];
            const a = el('a', 'card');
            a.href = '#/lesson-' + lesson.number;
            a.appendChild(el('span', 'card-num', String(lesson.number)));
            const body = el('span', 'card-body');
            body.appendChild(el('span', 'card-title', lesson.title));
            body.appendChild(el('span', 'card-sub', lesson.subtitle));
            a.appendChild(body);
            a.appendChild(el('span', 'card-state' + (stored ? ' is-done' : ''), stored ? stored.score + '/' + lesson.steps.length + ' ✓' : 'لم يبدأ'));
            cards.appendChild(a);
        });
        list.appendChild(cards);
        app.appendChild(list);

        const after = group('بعد الدروس', '');
        const actions = el('div', 'actions');
        const r = el('a', 'btn primary', 'المراجعة: ' + quiz.length + ' أسئلة من كل المواقف');
        r.href = '#/review';
        const ph = el('a', 'btn secondary', 'قاموس المواقف');
        ph.href = '#/phrases';
        actions.appendChild(r); actions.appendChild(ph);
        after.appendChild(actions);
        const note = el('div', 'callout note');
        note.appendChild(el('p', 'callout-title', 'عن الموقع'));
        note.appendChild(el('p', null, 'الموقع مجاني ومفتوح للجميع، ومفيش تسجيل ولا حسابات. تقدمك بيتحفظ على متصفح جهازك بس، ومش بيتنقل بين الأجهزة، وبيتمسح لو مسحت بيانات الموقع. الدروس من غير صور أشخاص أو موسيقى، ومفيش مدرس بشري راجعها، وده الإصدار الأول وبنحسّنه.'));
        after.appendChild(note);
        app.appendChild(after);
    }

    function lessonView(num) {
        const lesson = lessons.find((l) => l.number === num);
        if (!lesson) return home();
        const progress = loadProgress();
        const stored = progress[lesson.id];
        app.innerHTML = '';

        const head = group('الدرس ' + lesson.number + ' من ' + lessons.length, lesson.title);
        head.appendChild(el('p', null, lesson.intro));
        if (stored) head.appendChild(el('p', 'caption', 'خلصت الدرس ده قبل كده: ' + stored.score + ' من ' + lesson.steps.length + ' صح من أول مرة. تقدر تعيده في أي وقت.'));
        app.appendChild(head);

        const flowGroup = group('المحادثة', '');
        stepFlow(flowGroup, lesson.steps, flowLabels, (score) => {
            progress[lesson.id] = { done: true, score: score };
            saveProgress(progress);
            flowGroup.innerHTML = '';
            flowGroup.appendChild(el('p', 'group-label', 'النتيجة'));
            flowGroup.appendChild(el('h2', null, 'خلصت «' + lesson.title + '»'));
            flowGroup.appendChild(el('p', null, 'نتيجتك: ' + score + ' من ' + lesson.steps.length + ' صح من أول مرة.'));
            const note = el('div', 'callout note');
            note.appendChild(el('p', 'callout-title', 'ثبت المعلومة'));
            note.appendChild(el('p', null, 'أهم جمل الدرس موجودة في صفحة القاموس، والمراجعة بترجعلك كل الدروس مع بعض. إعادة الدرس متاحة في أي وقت من غير أي خصم.'));
            flowGroup.appendChild(note);
            const actions = el('div', 'actions');
            const next = lessons.find((l) => l.number === lesson.number + 1);
            if (next) {
                const n = el('a', 'btn primary', 'الدرس اللي بعده: ' + next.title);
                n.href = '#/lesson-' + next.number;
                actions.appendChild(n);
            }
            const rv = el('a', 'btn secondary', 'اختبر نفسك في المراجعة');
            rv.href = '#/review';
            const hm = el('a', 'btn secondary', 'رجوع للدروس');
            hm.href = '#/';
            actions.appendChild(rv); actions.appendChild(hm);
            flowGroup.appendChild(actions);
        });
        app.appendChild(flowGroup);
    }

    function review() {
        const progress = loadProgress();
        app.innerHTML = '';
        let round = 0;
        let totalScore = 0;

        const head = group('بعد الدروس الستة', 'المراجعة');
        head.appendChild(el('p', null, 'أسئلة من كل المواقف اللي درستها. جاوب من ذاكرتك، والتصحيح هيفكرك بالسبب، وتقدر تحاول تاني قبل ما تكمل.'));
        if (progress.quiz) head.appendChild(el('p', 'caption', 'آخر نتيجة ليك: ' + progress.quiz.score + ' من ' + quiz.length + '.'));
        app.appendChild(head);

        const flowGroup = el('section', 'group');
        app.appendChild(flowGroup);

        function renderRound() {
            flowGroup.innerHTML = '';
            flowGroup.appendChild(el('p', 'group-label', 'سؤال ' + (round + 1) + ' من ' + quiz.length));
            stepFlow(flowGroup, [{
                scene: quiz[round].q,
                choices: quiz[round].choices,
                correct: quiz[round].correct,
                explain: quiz[round].explain,
            }], Object.assign({}, quizLabels, { finish: round === quiz.length - 1 ? 'شوف النتيجة' : 'السؤال اللي بعده' }), (score) => {
                totalScore += score;
                if (round < quiz.length - 1) { round++; renderRound(); window.scrollTo(0, 0); }
                else {
                    progress.quiz = { done: true, score: totalScore };
                    saveProgress(progress);
                    flowGroup.innerHTML = '';
                    flowGroup.appendChild(el('p', 'group-label', 'النتيجة'));
                    flowGroup.appendChild(el('h2', null, 'نتيجتك: ' + totalScore + ' من ' + quiz.length));
                    flowGroup.appendChild(el('p', null, 'ده عدد الإجابات الصح من أول مرة.'));
                    const actions = el('div', 'actions');
                    const again = el('button', 'btn primary', 'إعادة المراجعة');
                    again.type = 'button';
                    again.addEventListener('click', () => { round = 0; totalScore = 0; renderRound(); });
                    const hm = el('a', 'btn secondary', 'رجوع للدروس');
                    hm.href = '#/';
                    actions.appendChild(again); actions.appendChild(hm);
                    flowGroup.appendChild(actions);
                }
            });
        }
        renderRound();
    }

    function phrases() {
        app.innerHTML = '';
        const head = group('مرجع سريع', 'قاموس المواقف');
        head.appendChild(el('p', null, 'أهم الجمل من كل درس، بنطقها بالحروف العربية بشكل تقريبي يساعدك تبدأ، ومعناها. النطق بالعربي مش بديل عن سماع النطق الصحيح. اقراها بصوت عالي.'));
        app.appendChild(head);
        lessons.forEach((lesson) => {
            const g = group('الدرس ' + lesson.number + ': ' + lesson.title, '');
            const box = el('div', 'phrases');
            lesson.phrases.forEach((p) => box.appendChild(phraseLine(p)));
            g.appendChild(box);
            app.appendChild(g);
        });
    }

    function route() {
        const hash = location.hash.replace(/^#\/?/, '');
        document.body.classList.toggle('inner', hash !== '');
        if (hash.startsWith('lesson-')) lessonView(parseInt(hash.slice(7), 10));
        else if (hash === 'review') review();
        else if (hash === 'phrases') phrases();
        else home();
    }
    window.addEventListener('hashchange', route);
    route();
})();
