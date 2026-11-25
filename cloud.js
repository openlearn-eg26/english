/* Cloud account. Sign-in is required to enter the site: the Firebase SDK loads at page start to check who is signed in. Stores one document per user: progress JSON + timestamp. */
(function () {
    'use strict';
    var CFG = { apiKey: 'AIzaSyB8eoL2yaHeoeIqOQMjvIBSsVm4dHlGmeo', authDomain: 'english-learn-eg26.firebaseapp.com', projectId: 'english-learn-eg26', appId: '1:642884386219:web:5232b1b1eb11dbf4ff66ee', messagingSenderId: '642884386219' };
    var V = '10.14.1', BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';
    var FLAG = 'lang-cloud.v1';
    var sdk = null, user = null, listeners = [], authListeners = [], timer = null, status = '', state = 'pending', lastKey = '';
    function flagGet() { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } }
    function flagSet(v) { try { if (v) localStorage.setItem(FLAG, '1'); else localStorage.removeItem(FLAG); } catch (e) { /* ignore */ } }
    function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } }); }
    function load() {
        if (sdk) return sdk;
        sdk = Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]).then(function (m) {
            var app = m[0].initializeApp(CFG);
            var auth = m[1].getAuth(app); auth.languageCode = 'ar';
            var db = m[2].getFirestore(app);
            return { app: app, auth: auth, db: db, A: m[1], F: m[2] };
        });
        sdk.catch(function () { sdk = null; });
        return sdk;
    }
    function maxN(a, b) { return Math.max(+a || 0, +b || 0); }
    function merge(a, b, norm) {
        a = norm(a); b = norm(b);
        var o = norm({});
        o.profile.name = a.profile.name || b.profile.name;
        Object.keys(Object.assign({}, a.lessons, b.lessons)).forEach(function (k) {
            var x = a.lessons[k], y = b.lessons[k];
            o.lessons[k] = { done: true, score: maxN(x && x.score, y && y.score), best: maxN(x && x.best, y && y.best) };
        });
        if (a.quiz || b.quiz) o.quiz = { score: maxN(a.quiz && a.quiz.score, b.quiz && b.quiz.score), best: maxN(a.quiz && a.quiz.best, b.quiz && b.quiz.best) };
        Object.keys(Object.assign({}, a.tests, b.tests)).forEach(function (k) {
            var x = a.tests[k], y = b.tests[k];
            o.tests[k] = { best: maxN(x && x.best, y && y.best), last: maxN(x && x.last, y && y.last) };
        });
        Object.keys(Object.assign({}, a.answers, b.answers)).forEach(function (k) {
            var x = a.answers[k], y = b.answers[k];
            if (!x || !y) { o.answers[k] = Object.assign({}, x || y); return; }
            o.answers[k] = { r: maxN(x.r, y.r), w: maxN(x.w, y.w), miss: x.miss && y.miss, ok2: Math.min(maxN(x.ok2, y.ok2), 2) };
        });
        o.fixed = maxN(a.fixed, b.fixed);
        o.days = a.days.concat(b.days.filter(function (d) { return a.days.indexOf(d) < 0; })).sort().slice(-120);
        return norm(o);
    }
    function docRef(s) { return s.F.doc(s.db, 'users', s.auth.currentUser.uid); }
    function pull(app) {
        return load().then(function (s) {
            return s.F.getDoc(docRef(s)).then(function (snap) {
                var cloud = null;
                var raw = snap.exists() ? snap.data().progress : null;
                if (typeof raw === 'string' && raw.length < 60000) { try { cloud = JSON.parse(raw); } catch (e) { cloud = null; } }
                if (cloud && (typeof cloud !== 'object' || Array.isArray(cloud))) cloud = null;
                var merged = cloud ? merge(app.get(), cloud, app.normalize) : app.get();
                app.set(merged);
                return s.F.setDoc(docRef(s), { progress: JSON.stringify(merged), updatedAt: Date.now() });
            });
        });
    }
    function push() {
        if (!user || !user.emailVerified) return;
        clearTimeout(timer);
        timer = setTimeout(function () {
            load().then(function (s) {
                if (!s.auth.currentUser || !s.auth.currentUser.emailVerified) return;
                return s.F.getDoc(docRef(s)).then(function (snap) {
                    var cur = window.__lang.get(), cl = null;
                    var rw = snap.exists() ? snap.data().progress : null;
                    if (typeof rw === 'string' && rw.length < 60000) { try { cl = JSON.parse(rw); } catch (e) { cl = null; } }
                    if (cl && (typeof cl !== 'object' || Array.isArray(cl))) cl = null;
                    var out = cl ? merge(cur, cl, window.__lang.normalize) : cur;
                    return s.F.setDoc(docRef(s), { progress: JSON.stringify(out), updatedAt: Date.now() });
                });
            }).then(function () { status = 'اتحفظ في حسابك.'; emit(); }, function () { status = 'ماقدرناش نحفظ في الحساب دلوقتي. تقدمك لسه محفوظ على المتصفح.'; emit(); });
        }, 1500);
    }
    function errText(e) {
        var c = e && e.code || '';
        if (/invalid-email/.test(c)) return 'شكل الإيميل مش صحيح.';
        if (/weak-password/.test(c)) return 'كلمة السر ضعيفة، لازم ٦ حروف على الأقل.';
        if (/email-already-in-use/.test(c)) return 'الإيميل ده مسجل قبل كده. جرب تسجيل الدخول.';
        if (/invalid-credential|wrong-password|user-not-found|invalid-login/.test(c)) return 'الإيميل أو كلمة السر مش صح.';
        if (/too-many-requests/.test(c)) return 'محاولات كتير. استنى شوية وجرب تاني.';
        if (/network/.test(c)) return 'مفيش اتصال بالإنترنت.';
        if (/permission-denied/.test(c)) return 'ماحصلش حفظ: الصلاحيات.';
        return 'حصلت مشكلة. جرب تاني بعد شوية.';
    }
    function cooldown(b, secs) {
        var label = b.textContent, n = secs; b.disabled = true;
        var iv = setInterval(function () { n--; if (n <= 0) { clearInterval(iv); b.disabled = false; b.textContent = label; } else { b.textContent = label + ' (' + n + ')'; } }, 1000);
    }
    function setState(u) {
        user = u || null;
        state = user ? 'in' : 'out';
        var key = state + ':' + (user ? user.uid : '');
        if (key !== lastKey) { lastKey = key; authListeners.forEach(function (f) { try { f(state); } catch (e) { /* ignore */ } }); }
    }
    function restore(app) {
        var done = false;
        var t = setTimeout(function () { if (!done && state === 'pending') { state = 'error'; authListeners.forEach(function (f) { try { f(state); } catch (e) { /* ignore */ } }); } }, 12000);
        load().then(function (s) {
            s.A.onAuthStateChanged(s.auth, function (u) {
                done = true; clearTimeout(t);
                setState(u);
                if (u && !u.emailVerified) { emit(); }
                else if (u) { pull(app).then(function () { status = 'متزامن مع حسابك.'; emit(); if (app.refresh) app.refresh(); }, function () { status = ''; emit(); }); }
                else { emit(); }
            });
        }, function () { done = true; clearTimeout(t); state = 'error'; authListeners.forEach(function (f) { try { f(state); } catch (e) { /* ignore */ } }); });
    }
    function retry(app) { state = 'pending'; lastKey = ''; sdk = null; authListeners.forEach(function (f) { try { f(state); } catch (e) { /* ignore */ } }); restore(app); }
    var cloud = {
        init: function (app) { cloud._app = app; restore(app); },
        onChange: function (f) { listeners.push(f); },
        onAuth: function (f) { authListeners.push(f); },
        state: function () { return state; },
        retry: function () { retry(cloud._app); },
        push: push,
        merge: merge,
        panel: function (el, add, btn, app, opts) {
            opts = opts || {};
            var box = el('section', 'group card-box'); box.id = 'cloud-box';
            var h = el('h2', null, opts.title || 'حسابك');
            var note = el('p', null, 'التسجيل مطلوب عشان تدخل الموقع. بنخزن إيميلك وتقدمك (نتايجك وإجاباتك وأيام المذاكرة واسمك) على سيرفرات جوجل (Firebase)، عشان تكمل من أي جهاز. مفيش إعلانات ولا تتبع ولا بيع بيانات، وإنت اللي بتمسح حسابك وبياناتك بزرار واحد من صفحة حسابي. تأكيد الإيميل مش شرط للدخول، لكن من غيره مش بنحفظ تقدمك على السيرفر.');
            var pl = el('a', null, 'سياسة الخصوصية وطريقة حذف بياناتك'); pl.href = 'privacy.html';
            var body = el('div');
            var msg = el('p', 'caption', ''); msg.setAttribute('aria-live', 'polite');
            if (opts.brief) { note.textContent = 'مجاني ومن غير إعلانات. بنحفظ إيميلك وتقدمك عشان تكمل من أي جهاز، وتقدر تمسحهم بزرار واحد من صفحة حسابي. تأكيد الإيميل مش شرط للدخول.'; add(box, h, body, msg, note, pl); } else add(box, h, note, pl, body, msg);
            if (opts.hideNoteTitle) h.hidden = true;
            function say(t) { msg.textContent = t || ''; }
            function field(label, id, type, ac) {
                var l = el('label', 'field-label', label); l.htmlFor = id;
                var i = el('input', 'search'); i.id = id; i.type = type; i.autocomplete = ac; i.dir = 'ltr'; i.maxLength = 120;
                return [l, i];
            }
            function draw() {
                body.innerHTML = '';
                if (user && !user.emailVerified) {
                    var w0 = el('p', null, 'الحساب لسه مش مؤكد: ' ); var e0 = el('span', null, user.email || ''); e0.dir = 'ltr'; w0.appendChild(e0);
                    var w1 = el('p', null, 'بعتنا رابط تأكيد على الإيميل ده. افتحه وبعدين اضغط «أكدت الإيميل». لحد التأكيد مش بنحفظ تقدمك على السيرفر، وتقدر تكمل التعلم عادي على المتصفح.');
                    var a0 = el('div', 'actions');
                    var chk = btn('أكدت الإيميل', 'primary', function () {
                        say('بنتأكد...');
                        load().then(function (s) { return s.auth.currentUser.reload().then(function () { return s.auth.currentUser.getIdToken(true); }).then(function () { user = s.auth.currentUser; if (!user.emailVerified) throw { code: 'not-verified' }; return pull(app); }); })
                            .then(function () { say('اتأكد الإيميل واتزامن تقدمك.'); draw(); app.refresh && app.refresh(); }, function (e) { say(e && e.code === 'not-verified' ? 'لسه مش متأكد. افتح الرابط اللي وصلك على الإيميل (شوف الرسائل غير المرغوبة كمان).' : errText(e)); });
                    });
                    var rs = btn('ابعت الرابط تاني', 'secondary', function () { cooldown(rs, 60); load().then(function (s) { return s.A.sendEmailVerification(s.auth.currentUser); }).then(function () { say('بعتنا الرابط تاني.'); }, function (e) { say(errText(e)); }); });
                    var so0 = btn('تسجيل خروج', 'secondary', function () { load().then(function (s) { return s.A.signOut(s.auth); }).then(function () { setState(null); flagSet(false); say('خرجت.'); draw(); }, function (e) { say(errText(e)); }); });
                    add(a0, chk, rs, so0);
                    var pw0 = field('كلمة السر (للتأكيد قبل حذف الحساب)', 'cdelpw0', 'password', 'current-password');
                    var d0 = el('div', 'actions'); var arm0 = false;
                    var db0 = btn('احذف الحساب ده', 'secondary', function () {
                        if (!arm0) { arm0 = true; db0.textContent = 'اضغط تاني للتأكيد'; db0.classList.add('danger'); return; }
                        load().then(function (s) {
                            var u = s.auth.currentUser; if (!pw0[1].value) throw { code: 'need-password' };
                            return s.A.reauthenticateWithCredential(u, s.A.EmailAuthProvider.credential(u.email, pw0[1].value)).then(function () { return s.A.deleteUser(u); });
                        }).then(function () { setState(null); flagSet(false); say('اتحذف الحساب.'); draw(); }, function (e) { arm0 = false; db0.textContent = 'احذف الحساب ده'; db0.classList.remove('danger'); say(e && e.code === 'need-password' ? 'اكتب كلمة السر الأول.' : errText(e)); });
                    });
                    add(d0, db0);
                    add(body, w0, w1, a0, pw0[0], pw0[1], d0);
                } else if (user) {
                    var who = el('p', null, 'داخل بحساب: '); var em = el('span', null, user.email || ''); em.dir = 'ltr'; who.appendChild(em);
                    var a = el('div', 'actions');
                    var sync = btn('زامن الآن', 'primary', function () { say('بنزامن...'); pull(app).then(function () { say('اتزامن.'); app.refresh && app.refresh(); }, function (e) { say(errText(e)); }); });
                    var out = btn('تسجيل خروج', 'secondary', function () { load().then(function (s) { return s.A.signOut(s.auth); }).then(function () { setState(null); flagSet(false); say('خرجت. تقدمك لسه على المتصفح ده.'); draw(); }, function (e) { say(errText(e)); }); });
                    add(a, sync, out);
                    var del = el('div', 'actions'); var armed = false;
                    var pw = field('كلمة السر (للتأكيد قبل الحذف)', 'cdelpw', 'password', 'current-password');
                    var db = btn('احذف حسابي وبياناتي من السيرفر', 'secondary', function () {
                        if (!armed) { armed = true; db.textContent = 'اضغط تاني للتأكيد'; db.classList.add('danger'); say('ده بيمسح الحساب وتقدمه من السيرفر نهائيًا. تقدمك على المتصفح ده مش هيتمسح.'); return; }
                        say('بنحذف...');
                        load().then(function (s) {
                            var u = s.auth.currentUser; var p = pw[1].value;
                            if (!p) throw { code: 'need-password' };
                            return s.A.reauthenticateWithCredential(u, s.A.EmailAuthProvider.credential(u.email, p)).then(function () { return s.F.deleteDoc(docRef(s)); }).then(function () { return s.A.deleteUser(u); });
                        }).then(function () { setState(null); flagSet(false); say('اتحذف حسابك وبياناتك من السيرفر.'); draw(); }, function (e) { armed = false; db.textContent = 'احذف حسابي وبياناتي من السيرفر'; db.classList.remove('danger'); say(e && e.code === 'need-password' ? 'اكتب كلمة السر الأول.' : errText(e)); });
                    });
                    add(del, db);
                    add(body, who, a, pw[0], pw[1], del);
                    if (status) say(status);
                } else {
                    var e1 = field('الإيميل', 'cemail', 'email', 'email'), p1 = field('كلمة السر (٦ حروف على الأقل)', 'cpass', 'password', 'current-password');
                    var ac = el('div', 'actions');
                    function go(create) {
                        var email = e1[1].value.trim(), pass = p1[1].value;
                        if (!email || !pass) { say('اكتب الإيميل وكلمة السر.'); return; }
                        say(create ? 'بنعمل الحساب...' : 'بندخل...');
                        load().then(function (s) {
                            return (create ? s.A.createUserWithEmailAndPassword(s.auth, email, pass) : s.A.signInWithEmailAndPassword(s.auth, email, pass)).then(function (r) {
                                user = r.user; flagSet(true);
                                setState(r.user);
                                if (create) return s.A.sendEmailVerification(r.user).then(function () { return 'unverified'; });
                                return user.emailVerified ? pull(app) : 'unverified';
                            });
                        })
                        .then(function (r) { say(r === 'unverified' ? (create ? 'اتعمل الحساب. بعتنا رابط تأكيد على إيميلك.' : 'الإيميل لسه مش متأكد. افتح رابط التأكيد.') : 'دخلت وتقدمك اتزامن.'); draw(); app.refresh && app.refresh(); }, function (e) { say(errText(e)); });
                    }
                    var b1 = btn('تسجيل دخول', 'primary', function () { go(false); });
                    var b2 = btn('عمل حساب جديد', 'secondary', function () { go(true); });
                    var b3 = btn('نسيت كلمة السر', 'ghost', function () {
                        var email = e1[1].value.trim(); if (!email) { say('اكتب الإيميل الأول.'); return; }
                        cooldown(b3, 60);
                        load().then(function (s) { return s.A.sendPasswordResetEmail(s.auth, email); }).then(function () { say('لو الإيميل مسجل هيوصله رابط لتغيير كلمة السر.'); }, function (e) { say(errText(e)); });
                    });
                    add(ac, b1, b2, b3);
                    add(body, e1[0], e1[1], p1[0], p1[1], ac);
                }
            }
            listeners.push(function () { if (document.body.contains(box)) draw(); });
            draw();
            return box;
        },
    };
    window.LangCloud = cloud;
})();
