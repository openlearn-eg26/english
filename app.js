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
    function save() { Store.write(P); if (window.LangCloud) window.LangCloud.push(); }
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
    function arNum(n) { return String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]); }
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
    function mixedEl(tag, cls, text) {
        const n = el(tag, cls); const re = /"[A-Za-z][^"]*"|[A-Za-z][A-Za-z0-9'\u2019,.!?_\-]*(?: [A-Za-z0-9'\u2019,.!?_\-]+)*/g;
        text = String(text); let last = 0, m;
        while ((m = re.exec(text))) { if (m.index > last) n.appendChild(document.createTextNode(text.slice(last, m.index))); n.appendChild(enSpan(m[0])); last = m.index + m[0].length; }
        if (last < text.length) n.appendChild(document.createTextNode(text.slice(last)));
        return n;
    }
    /* ---------- listening: recorded clips first, browser voice as fallback ---------- */
    const AUDIO_MAP = {"Here you are.": "f51fb7f4ea", "I'm flying to Dubai.": "fba9985f9f", "Just this one.": "718ebe2a11", "Boarding pass": "c16dd8a6f9", "Where is the gate?": "d246e3416f", "Good morning! Can I see your passport, please?": "efa4542edb", "Where are you flying to today?": "42c7a293e0", "Do you have any bags to check?": "0a029eba3c", "Here is your boarding pass. Have a nice flight!": "42010ee318", "Have a nice flight!": "e22cf20cba", "I have a reservation.": "791e012b07", "It's under Ahmed.": "64ac694d24", "A wake-up call": "5434ec2f38", "Enjoy your stay!": "ccbbcb66dc", "What time is breakfast?": "d0f534c5da", "Good evening. How can I help you?": "73744ce093", "What's the name, please?": "9240b3b5da", "It's under Ahmed Ali.": "e212f99cc3", "Would you like a wake-up call?": "108b9d8b60", "Breakfast is from 7 to 10. Enjoy your stay!": "45ae85c234", "I'd like": "d2acfb6cf2", "Just water, please.": "4cc32c556c", "That's all.": "c2c9dd9038", "Can I have the bill, please?": "f04323cc8a", "Delicious": "f3351eb697", "Are you ready to order?": "3f3a6b3e04", "I'd like the grilled chicken, please.": "2884c7c38c", "Anything to drink?": "6301001776", "Would you like anything else?": "47315e2bd6", "That's all, thank you.": "0a2d6aa6ca", "Was everything okay?": "0fe6afa89a", "Tell me about yourself.": "27fde5f9e6", "Experience": "5b5aafe6b9", "Strengths": "739a7c874a", "Working hours": "85fd412e40", "I work well with people.": "a06ee9cad1", "I'm an engineer with three years of experience.": "e703849b1e", "Why do you want this job?": "4b99b0cdf5", "I want to grow and learn.": "4762eeecf7", "What are your strengths?": "e966f1207c", "Do you have any questions for us?": "13fb390e5c", "What are the working hours?": "aa5cd2023f", "I have a headache.": "1043137d27", "Fever": "51a83e36ed", "For two days.": "9e41447f19", "I'm allergic to": "e4f972a3ef", "Twice a day": "2eae34aa15", "What seems to be the problem?": "86a71485c8", "I have a headache and a fever.": "a3d92f94fb", "How long have you felt like this?": "d77b1936e5", "Are you allergic to any medicine?": "ba6e10a2c3", "I'm not allergic to anything.": "44402c6209", "Take this medicine twice a day and rest.": "07bee5d908", "I'm looking for": "d3d15e23aa", "What size?": "2f13b9feeb", "How much is it?": "c098beb15f", "Discount": "b524936d7a", "A bag, please.": "9eb9067191", "Can I help you find something?": "3d791b1584", "I'm looking for a shirt.": "c9f4818524", "What size are you?": "353f496063", "Medium, please.": "9ce49160ac", "It's 200 pounds.": "dbcb2b0966", "Can you give me a discount?": "c77de4e50c", "Would you like a bag?": "9d9cfae3a8", "Yes, please.": "202482320f"};
    Object.assign(AUDIO_MAP, {"I'm ready for the trip.": "4845d65797", "Where are you going?": "4a587acda0", "What does this mean?": "5fb6514196", "I agree with you.": "34c7ad2197", "Where can I leave my luggage?": "6c1746d994", "Can you give me some information?": "a003e58e36", "I missed the train.": "9d7378e39e", "It depends on the traffic.": "6b9466b8a6", "I'm allergic to nuts.": "fb091b0c51"});
    Object.assign(AUDIO_MAP, {"Hi! Do you need help?": "6261da455f", "Where is the metro station?": "edd0ab5244", "Go straight, then turn left at the bank.": "c75152c515", "Could you say that again, please?": "8edfd3281a", "You can walk there, or you can take a taxi.": "b22b8593f3", "Is it far from here?": "be50ee3723", "It's about ten minutes on foot. It's next to the pharmacy.": "601b83601e", "Thanks a lot. You have been very helpful!": "7092658c65", "Excuse me.": "471adfc108", "Turn left at the bank.": "27e6dfcc46", "Hello, City Dental Clinic. How can I help you?": "998cc4a392", "I'd like to make an appointment.": "b486a14c8b", "Of course. What day works for you?": "78d85e71d9", "Tuesday morning, if possible.": "69b77eb077", "I'm sorry, we're fully booked on Tuesday. Is Wednesday okay?": "95820722a7", "Wednesday is fine, thank you.": "9099e2a2c5", "One moment, please. I'll check the calendar.": "9fcb87343c", "No problem, I'll hold.": "cc15719609", "Can I speak to Dr. Brown, please?": "ebdd6b4b1f", "Are you looking for anything in particular?": "340a516d19", "Where can I find rice?": "722bf3cecd", "How much would you like?": "24e52ab1d3", "A kilo of tomatoes, please.": "5ce36d7ee0", "That's eighty-five pounds. Cash or card?": "aad22b367a", "Card, please.": "8c1cb78ab4", "Here's your change. Have a nice day!": "46f5be561e", "Thanks, you too!": "74cfa7ad85", "Cash or card?": "d5bd4bff68", "Hi, I'm Tom. Nice to meet you.": "f4e01d195d", "Nice to meet you too.": "83d7668448", "Where are you from?": "7bc5e7f6b5", "I'm from Egypt.": "0d8176934a", "What do you do?": "ace1084b55", "I work in a bank.": "ad09191949", "It was nice talking to you. See you tomorrow!": "644e641d52", "See you! Take care.": "b79df85ac1", "How about you?": "38994793f8"});
    Object.assign(AUDIO_MAP, {"Hello! Where to?": "0a73f14d7f", "To the airport, please.": "c890146ecd", "Are you in a hurry?": "d7495bf146", "I'm in a hurry.": "e18b3d0b71", "We are almost there. Where should I stop?": "6deed15fde", "Here is fine, thank you.": "a2ccd7fdc2", "That's two hundred pounds.": "499ef09635", "Keep the change.": "427f0c2b8d"});
    Object.assign(AUDIO_MAP, {"Hi! How can I help you?": "7bea5480a9", "I'd like something for a headache, please.": "14baa9ff17", "Are you taking any other medicine?": "4e7e21ca61", "I'm not taking anything else.": "5315fa9490", "Take one tablet twice a day, after meals.": "0e8d2b3984", "Twice a day, after meals.": "7cb01168ea", "That's forty-five pounds.": "cb76c200d4", "Can I pay by card?": "164caa75f6", "Do you have anything for a cold?": "cd2f896e2f"});
    Object.assign(AUDIO_MAP, {"Good morning. Where would you like to go?": "bc268761b5", "A ticket to Alexandria, please.": "a762f0ba0c", "One way or return?": "2f3c0adf72", "A return ticket, please.": "fd9ed158af", "Your train leaves at nine thirty.": "f689824683", "Which platform is it?": "c42723a219", "Can I help you?": "a9e5aa3c53", "Is this the train to Alexandria?": "98f3bcf4dd", "What time does it leave?": "4ac0256685"});
    Object.assign(AUDIO_MAP, {"Hello. How can I help you?": "c51e0a0de8", "I'd like to send this package to Cairo.": "fe7d0cfd8e", "Would you like regular or express delivery?": "59e06ddc92", "Express, please.": "459516ee1c", "That will be sixty pounds.": "a0a3afacfe", "How long will it take?": "5c96498eff", "It will arrive in two days. Anything else?": "542af8c9b5", "Can I get a receipt, please?": "53ba284de7", "Where can I buy stamps?": "5e3a892e9e"});
    Object.assign(AUDIO_MAP, {"Hi. What are you looking for?": "395387eeaf", "I'm looking for a phone charger.": "36a9fecea6", "This one is very good.": "ffaa5ab4fb", "How much is it?": "c098beb15f", "It is two hundred pounds.": "9388f632ad", "Does it come with a warranty?": "8ebc0f21eb", "Yes, it has a one year warranty. Would you like it?": "ffcbbaf51b", "Yes, I'll take it.": "0dee7dfe41", "Do you have a phone case?": "c08b086f34"});
    Object.assign(AUDIO_MAP, {"Hello. Can I help you?": "e06fe09c39", "I'd like to borrow this book, please.": "97e9e87a7c", "Do you have a library card?": "21ed1e9ce6", "No, I don't. Can I get one?": "6c21e0038c", "All done. Here is your book.": "9fbb556bce", "When do I have to return it?": "6e71571dae", "Please bring it back in two weeks.": "9d76cdf935", "Can I renew it if I need more time?": "ed426183bb"});
    Object.assign(AUDIO_MAP, {"Welcome. What would you like today?": "3ee621496e", "I'd like a haircut, please.": "5594e9e6e3", "How short would you like it?": "5f6d4d1bcf", "Short on the sides, please.": "9d2cd29312", "All done. How does it look?": "0275435e27", "It looks great, thank you.": "55fba9c364", "Anything else?": "4689b4128b", "How much is it?": "c098beb15f"});
    Object.assign(AUDIO_MAP, {"Hi there. What can I get you?": "8ec0380b45", "Can I have a tea, please?": "ae80a85447", "Small, medium or large?": "11db3f08b5", "Medium, please.": "9ce49160ac", "That is thirty pounds. For here or to go?": "f8cce017e0", "For here, please.": "6ffb06933e", "Here you go. Enjoy!": "d4d3eecd83", "Do you have Wi-Fi?": "3c10ad1fe1"});
    Object.assign(AUDIO_MAP, {"Hi. Are you lost?": "86284892a4", "Where is room two oh four?": "3b695e2d9f", "Go up the stairs and turn left.": "919102c9c8", "Can you say that again, please?": "7383ef6390", "It is on the second floor.": "01755150a5", "What time does the lecture start?": "58d1d776a1", "It starts at ten. Good luck!": "7ffbd50d7a", "Thank you for your help.": "3a7d598b94"});
    Object.assign(AUDIO_MAP, {"Good morning!": "33e8886999", "Good morning! It's a beautiful day.": "cfe100e69c", "Yes, it is a little hot though.": "72c33d86cc", "Yes, it is very hot today.": "284f0eab3c", "I hope it cools down soon.": "f6be1fdf55", "Do you think it will rain tomorrow?": "59396f323e", "Well, I have to go. See you later!": "ea154035a2", "Nice talking to you. Have a good day!": "1218267eec"});
    Object.assign(AUDIO_MAP, {"Hi! Do you need anything?": "f81f711e94", "Yes, could you help me with this, please?": "79623fff3b", "Sure. What is the problem?": "1287bfc657", "The printer is not working.": "bd0038abd7", "Oh, the meeting is today.": "10e7d9fc28", "What time does the meeting start?": "c56ef0dc93", "It should work now.": "30ea88aae8", "Thank you so much. I really appreciate it.": "ad1bf94ebe"});
    Object.assign(AUDIO_MAP, {"Good morning. How can I help you?": "ec5e34c4f8", "I would like to open an account, please.": "8ccffd338b", "Sure. Do you have your ID with you?": "bd7c6d570f", "Yes, here is my ID.": "bc34e930b3", "Your account will be ready today.": "7437ff1ea5", "Will I get a bank card?": "4619f9dd94", "Everything is done. Is there anything else?": "f845fde608", "No, that is all. Thank you for your help.": "981857f376"});
    Object.assign(AUDIO_MAP, {"Hello, Fast Bites. Can I take your order?": "4e704f9d40", "Yes, I would like two chicken sandwiches, please.": "836f697824", "Sure. What is your address?": "be8093a7ea", "It is twelve Nile Street, apartment five.": "b1016847ce", "Your order is confirmed.": "5026344c4b", "It will arrive in about thirty minutes.": "3d05c4363a", "Thank you. I will pay in cash when it arrives.": "a7a071b68a"});
    Object.assign(AUDIO_MAP, {"Welcome to the museum. How many tickets?": "c7d12ca2fa", "Two tickets, please.": "48b0e3a347", "Here you are. Do you need an audio guide?": "0380a2683e", "No, thank you. Where is the main hall?": "d4de07938d", "The hall is on your left.": "f6a0020dba", "Excuse me, can I take photos here?": "76ab1d2e6c", "Yes, but please do not use a flash.": "ba1d476dc8", "Sure, thank you. What time does the museum close?": "db62911b31"});
    Object.assign(AUDIO_MAP, {"Hello, Home Repair. How can I help?": "a25dddd83e", "There is a leak in my kitchen.": "6e3d6ddda3", "I see. When did it start?": "67327e0a1b", "It started this morning.": "30e78a38ec", "We can send someone today.": "d96e789ebf", "Can he come this afternoon?": "33b6a583b9", "Yes, he will be there at four.": "cfc4d4cdf1", "Great, thank you. Please call me when he arrives.": "7cefa09680"});
    Object.assign(AUDIO_MAP, {"I would like to rent a car, please.": "e2d0d9ca59", "Sure. For how many days?": "815f2aef93", "For three days, please.": "a121cd3e1d", "We have small and large cars.": "aeb860b929", "Is insurance included?": "ae43acb178", "Here are the keys. Please return the car by Friday.": "fd5ab87553", "Thank you. I will return it on Friday.": "41aaafa970"});
    Object.assign(AUDIO_MAP, {"I want to return this shirt, please.": "95952be6c9", "Is there a problem with it?": "6a475fc45c", "Yes, it is too small for me.": "6eed06e8fe", "I see. We can exchange it.": "0dfb2ff68e", "Can I have a larger size, please?": "3cc1231d9d", "This one should fit you.": "4901aefb59", "Perfect. Can I try it on?": "3751120bb5"});
    Object.assign(AUDIO_MAP, {"Front desk. How can I help you?": "78f224417f", "The air conditioner in my room is not working.": "730b9bb64a", "I am sorry about that. What is your room number?": "c6159b61cc", "It is room two hundred and five.": "66b701c521", "We will send a technician.": "35e5923bfe", "How soon can he come?": "8e409c078a", "He will be there in ten minutes.": "b7281fc595", "Thank you. I will wait in the room.": "f035dc983b"});
    Object.assign(AUDIO_MAP, {"My suitcase did not arrive.": "c94d1f04c1", "I am sorry. What does it look like?": "2f4aa612c4", "It is a large black suitcase.": "ee5f562cfc", "We will search for it.": "04e126bfb6", "Can you call me when you find it?": "4be74e3b11", "We will deliver it to your hotel.": "30c38b573b", "That is great. Thank you very much.": "065ab2d605"});
    Object.assign(AUDIO_MAP, {"I would like to join the gym.": "c846a5052a", "We have a monthly plan and a yearly plan.": "fa72a50b99", "I would like the monthly plan, please.": "7d506a8754", "Please fill out this form.": "77d372cb75", "Can I see the gym first?": "28fe72c8fe", "Of course. Come with me.": "355e83eaad", "Thank you. What time do you open?": "717bbbc1f9"});
    Object.assign(AUDIO_MAP, {"Hello. Where would you like to go?": "59d41cfe13", "I would like a ticket to Alexandria, please.": "c09b806bdf", "One way or round trip?": "40c2b2a6c1", "Round trip, please.": "cbfb7f994c", "The bus leaves soon.": "57cd73d307", "Which gate does it leave from?": "2fd769a578", "It leaves from the gate on the left.": "21a31e0d19", "Thank you. Is there a restroom here?": "3d5c930a72"});
    Object.assign(AUDIO_MAP, {"Hi. Do you have time to talk?": "6c33d57bde", "Yes. When would you like to meet?": "2f20a12f9a", "Are you free tomorrow morning?": "1de504f537", "Yes, I am free in the morning.": "e46dc46e40", "Let us meet in my office.": "854f65d88e", "Sounds good. See you tomorrow.": "af34eed8c6", "Please bring your laptop.": "a473acb5d5", "Okay. I will bring it.": "9caf11a472"});
    Object.assign(AUDIO_MAP, {"Welcome. How can I help you?": "5fd47a5a76", "I would like to clean this jacket.": "bd0ebeb6cd", "Is there a stain on it?": "e18197e335", "Yes, there is a small stain here.": "b3c227c046", "It will be ready soon.": "93c974c08d", "Can I pick it up tomorrow?": "30bce35519", "Here is your receipt.": "db926e1448", "Thank you. Have a nice day.": "e75424df08"});
    Object.assign(AUDIO_MAP, {"Customer service. How can I help you?": "c78429dd4c", "My internet is not working.": "b46748f956", "I am sorry. Is the router turned on?": "0f776d8428", "Yes, it is turned on.": "67df027069", "Please turn it off and on again.": "40fd7f4464", "I did it, but it still does not work.": "509c3ed47e", "Thank you. When will he come?": "4fe807c593"});
    Object.assign(AUDIO_MAP, {"Hello. Are you looking for something?": "34be24e76a", "Yes, I am looking for an English book.": "5710edfc23", "Do you want a story or a textbook?": "a1a86a9757", "I would like a simple story, please.": "70c1707325", "Here is a good one.": "e99f1b1218", "Does it have pictures?": "96ba2ad914", "Yes, it does. Would you like to buy it?": "21af457a84", "Yes, I will take it.": "baf7b99ee0"});
    Object.assign(AUDIO_MAP, {"Hello. Do you need something?": "a5fcfc68a9", "Can I borrow your ladder, please?": "1de5ccdbf6", "Of course. What do you need it for?": "1aa6959d59", "I need to fix a light.": "06bbd0672f", "Please be careful.": "640e537326", "I will bring it back tomorrow.": "11163c2d0d", "No problem.": "be5b786677", "Thank you. You are very kind.": "147fb58960"});
    Object.assign(AUDIO_MAP, {"Hi! What are you doing today?": "61ce323b68", "I am free. Would you like to have lunch?": "c55dbe3a25", "Yes, I would love to. Where should we go?": "b06e503794", "Let us go to a restaurant near my house.": "f394613082", "That sounds great. When should we meet?": "c731868d94", "Let us meet at noon.": "139154f210", "Perfect. I will see you there.": "ce891a7414", "Great. See you soon.": "ae272c3d75"});
    Object.assign(AUDIO_MAP, {"Hello. Are you looking for a seat?": "98bcb2cb09", "Yes. Is this seat taken?": "9aacf943dd", "No, please sit down.": "1048d2f29a", "Thank you. Where are you going?": "df7ec8db80", "I am going to Alexandria. And you?": "1a71cf7fd7", "I am going to Cairo.": "118c0de45f", "It is a long trip. Would you like some water?": "bbd5925818", "Yes, please. That is very kind.": "7b5233b3dd"});
    Object.assign(AUDIO_MAP, {"Excuse me, where is the rice?": "b08ba34110", "It is in aisle three, on the left.": "389f406b8a", "Thank you. Do you have cooking oil?": "a9bc61d3a0", "Yes, it is next to the rice.": "a991db43e7", "Is there a bag for my shopping?": "9cef7c822a", "Yes, here you are. Anything else?": "70d232b558", "You are welcome. Have a nice day.": "5af54979f2"});
    Object.assign(AUDIO_MAP, {"Excuse me. The station is two streets ahead, on the right.": "192b872c23", "Sorry, I did not understand.": "13813636fa", "Of course. The station is two streets ahead.": "24082dddba", "Could you repeat that, please?": "3406176354", "Two streets ahead, on the right.": "353430935e", "Could you speak more slowly, please?": "9bf689e086", "Sure. Go straight, then turn right.": "362d8c5c51", "Now I understand. Thank you very much.": "6eed86600f"});
    Object.assign(AUDIO_MAP, {"Welcome. Please come in.": "9cac905949", "Thank you for inviting me.": "3e91fb90b4", "Would you like some tea?": "437a817355", "Yes, please. With a little sugar.": "e2c4bf5922", "Please, help yourself.": "773d74d00c", "The food is delicious.": "a282f61b23", "Thank you. Please have some more.": "a9d70eea1c", "I should go now. Thank you for everything.": "2c79eb2025", "You are always welcome.": "50a09df15e"});
    Object.assign(AUDIO_MAP, {"Nice to meet you. What do you do?": "7d85be9172", "I am a student at Cairo University.": "0c043264ff", "What are you studying?": "5bb1bde526", "I am studying computer science.": "b5116c141f", "I work as an engineer.": "61d465ed2d", "Do you like your work?": "7ef84b2b5d", "Yes, I like it very much. Good luck with your studies.": "fbef8bc25d", "Thank you. It was nice to meet you.": "5d89523ae5"});
    Object.assign(AUDIO_MAP, {"What do you do in your free time?": "86cbe77572", "I like to play football with my friends.": "c06e49186d", "That sounds fun. How often do you play?": "3b05fa9452", "I play every Friday.": "7347e5791e", "Would you like to join us this Friday?": "72065faa4f", "Yes, I would love to. What time?": "126896eb72", "We meet at five in the evening.": "01dbd72958", "Great. See you on Friday.": "ce4a21373b"});
    Object.assign(AUDIO_MAP, {"Hello. Who is calling, please?": "e1aada9e97", "Hello, this is Omar. Can I speak to Karim?": "a5d5713bbf", "I am sorry, he is not here right now.": "26c1610dc3", "Can I leave a message?": "bd614c0da9", "Of course. What is the message?": "4b156a75f8", "Please ask him to call me back.": "7d4c7186c8", "I will tell him. Goodbye.": "cd878762be", "Thank you. Goodbye.": "98c18132e1"});
    Object.assign(AUDIO_MAP, {"Good morning. May I see your passport and ticket?": "cde0db57d1", "Here you are. I would like a window seat.": "e76cabcd29", "Yes, I have one suitcase.": "e6c76419a9", "Here is your boarding pass. Your gate is number twelve.": "cd8950f866", "Thank you. What time does boarding start?": "eb83b51f40", "Boarding starts in forty minutes.": "bb3ade3d49"});
    Object.assign(AUDIO_MAP, {"Good morning. What would you like?": "6778285e0c", "I would like one kilo of oranges, please.": "9a8dc7d31a", "Here you are. Anything else?": "c68cf6f9ff", "Are these apples fresh?": "c06cdd7000", "Yes, they are very fresh. They came this morning.": "8dd6c461c4", "How much is it all together?": "0c04c07e41", "It is thirty pounds.": "21b305c464", "Here you are. Thank you.": "6a0a1396b0"});
    Object.assign(AUDIO_MAP, {"I would like to book a table for four.": "cd74ba726f", "For what time?": "c4824532bb", "For eight o'clock, please.": "43bea84d54", "May I have your name?": "eabe264c1a", "My name is Omar.": "8ff280e958", "Your table is ready for eight o'clock. We will see you tonight.": "f03c8c7f4c", "Thank you. See you tonight.": "b3578d3ca7"});
    Object.assign(AUDIO_MAP, {"Excuse me, I am lost. Do you speak English?": "d3e175060c", "Yes, a little. How can I help you?": "994dad85bf", "I am looking for the museum.": "b7edc4535c", "Go straight, then turn left at the corner.": "60fa5b0504", "No, it is about five minutes on foot.": "c4220a1763", "Thank you so much.": "6369bfb911", "You are welcome. Enjoy your visit.": "1a545bf132"});
    Object.assign(AUDIO_MAP, {"What time do you wake up?": "4c4f1cf748", "I wake up at six every morning.": "5df5f72490", "What do you do after that?": "06f1ab4817", "I have breakfast and go to work.": "01957b9746", "What time do you finish work?": "e7f580c42c", "I finish at four in the afternoon.": "c2f1495bd9", "What do you do in the evening?": "b569ebd669", "I study English for one hour.": "82ff1d83c3"});
    Object.assign(AUDIO_MAP, {"Can I have the Wi-Fi password, please?": "ea71837166", "Sure. Which network are you on?": "b0897fced2", "I am on the guest network.": "d01fd048e9", "Is everything working?": "23434e5952", "Yes, but my battery is low.": "f023f9f72b", "Do you need anything else?": "2a5cf22a50", "Is there a place to charge my phone?": "f9500ed17a"});
    Object.assign(AUDIO_MAP, {"What are your plans for the weekend?": "58df252568", "What time are you leaving?": "162b0e6706", "How are you getting there?": "c20f9000da", "When will you be back?": "36e3d02b7d", "I am going to visit my family.": "fa3800d9e6", "I am leaving on Friday after work.": "233133e5cb", "I am taking the train in the morning.": "6b05b80eba", "I will be back on Sunday night.": "48c1635d54"});
    Object.assign(AUDIO_MAP, {"Good morning. Please have a seat.": "f8d33f8e33", "Please tell me about yourself.": "12aa03d789", "Thank you. It is nice to meet you.": "675491c5fc", "I am an accountant with three years of experience.": "0dec783c31", "I want to learn and grow with your company.": "5f3f9edc11", "No, thank you. I hope to hear from you soon.": "98bc5d5002"});
    Object.assign(AUDIO_MAP, {"Yes, it is twenty minutes late.": "b02876621f", "It will arrive at ten fifteen.": "ef75a42928", "It is platform three.": "72b66282ac", "Is the train to Alexandria delayed?": "c4d35cefb0", "What time will it arrive?": "54e51afeb9", "Thank you. I will wait there.": "ca8bac44c9"});
    Object.assign(AUDIO_MAP, {"Welcome. Are you looking for something special?": "0bb708c9b2", "How about this wooden box?": "5690657e89", "It is thirty dollars.": "b58e93fe91", "I can do twenty-five.": "0330eb8bb0", "I am looking for a small gift for my friend.": "0897bf4c14", "It is beautiful. How much is it?": "78438c8075", "Is that your best price?": "b781884764", "That is fine. I will take it.": "db20317ae6"});
    Object.assign(AUDIO_MAP, {"Hello. I just moved into the apartment next to yours.": "6a4a375b9e", "Nice to meet you. How long have you lived here?": "06b37d4086", "Is it a quiet area?": "753441efb6", "Is there a grocery store nearby?": "bdca525610", "Welcome to the building. My name is Omar.": "6f6f3e9285", "I have lived here for five years.": "736900c900", "Yes, it is very quiet and safe.": "93cea4862f", "Yes, there is one on the corner.": "b3c584bc92"});
    Object.assign(AUDIO_MAP, {"Where are you now?": "621cabb486", "We can be there in thirty minutes.": "87ab7ae600", "Do you have a spare tire?": "d9c115e149", "I have a flat tire on the highway.": "3612c8af36", "I am near the Cairo exit.": "a7512d4fb1", "Thank you. Please hurry.": "26624fa293", "Yes, it is in the trunk.": "b2b3e08195"});
    Object.assign(AUDIO_MAP, {"What does it look like?": "692bfd0229", "Where did you lose it?": "fee8c289b8", "Please leave your phone number.": "c9bc4f3721", "I think I lost my wallet.": "582525943d", "It is small and brown.": "fea0ce2f16", "I think I lost it near the food court.": "1ee4061731", "Sure. Please call me if you find it.": "6042d74af1"});
    Object.assign(AUDIO_MAP, {"Guess what? I got a new job!": "5fac7db363", "I start next Sunday at a big company.": "27c9a86250", "I will be a software engineer.": "9a77f387de", "Thank you. Let us celebrate this weekend.": "320fa4429b", "Congratulations! I am so happy for you.": "d47163a311", "That is great news. What will you do there?": "b1f3585fc0", "You deserve it. You worked very hard.": "042d48d818", "Good idea. I would love to.": "0d1a288bcf"});
    Object.assign(AUDIO_MAP, {"Do you want them fresh or from yesterday?": "9d85148508", "That is fifteen pounds.": "c7ad350a01", "I would like six rolls, please.": "bb0160b941", "I want them fresh, please.": "94b884a9d9", "Yes, one loaf of brown bread.": "810f2bd85d", "Here you are. Keep the change.": "c036d1e032"});
    Object.assign(AUDIO_MAP, {"Hi there. Are you interested in a bike?": "8345be631f", "It is ten pounds per hour.": "f4969d17d2", "Yes, please. I will give it back when you return.": "fe3949be1d", "You can adjust it. Please bring it back in two hours.": "ea78d774bd", "Yes, I want to rent a bike for two hours.": "c745686ae2", "Do I need to leave an ID?": "3f4d470841", "Here is my ID. Is the seat comfortable?": "a75370bb2c", "Thank you. I will be back on time.": "349f8b4ec1"});
    Object.assign(AUDIO_MAP, {"Sure. Is it this button?": "dcea34b889", "Do you want the pyramids in the photo?": "a5a474f755", "I took three photos. Are they good?": "943dafd3f3", "Excuse me, can you take a photo of me?": "4a63382fd8", "Yes, just press the big button.": "57a3f1ce68", "Yes, please. I want them behind me.": "5b0b354f8b", "They are perfect. Thank you so much.": "89dd1f90d9"});
    Object.assign(AUDIO_MAP, {"Hi. Can I help you?": "e2f5743ea7", "It is half past four.": "926946ee9d", "Yes, it closes at six.": "3ede1bd963", "Today is the twentieth.": "677094a508", "Excuse me, what time is it?": "efc6ae7a54", "Thank you. Is the shop still open?": "4567760153", "Good. What is the date today?": "2194b3754a", "Thank you. I have to hurry.": "6e091abe7c"});
    Object.assign(AUDIO_MAP, {"Welcome. What would you like?": "585233ea56", "Small or large?": "b6e66515f0", "Here you go. Enjoy.": "64860fc16c", "Hello. I would like a mango juice, please.": "b3bcfc3964", "Large, please. How much is it?": "56b51b802a", "OK. Can I have it without sugar?": "ca4d49f9ad", "Thank you. It looks fresh.": "b32c2cbd24"});
    Object.assign(AUDIO_MAP, {"Hello. Is everything OK?": "0a05a9ff64", "Oh, I am sorry. I did not know.": "eed88715f4", "Should I turn it down?": "baa2b16f88", "Is this better?": "96b11bcc91", "Sorry to bother you. The noise is quite loud.": "d17b0b9ffd", "That is OK. I have to wake up early.": "e3b613a2bd", "Yes, please. Could you turn it down?": "09f604fb3e", "Yes, much better. Thank you very much.": "41ebf4b20c"});
    Object.assign(AUDIO_MAP, {"Good afternoon. How can I help you?": "7488aef792", "Is there a problem?": "d0c1a9c261", "He is doing well, but he forgets his homework.": "3d3aa534c3", "Please check his bag every evening.": "b7edbd62e2", "Good afternoon. I am here about my son.": "4a6b0c7202", "No, no problem. How is he doing in class?": "a95218f489", "I see. What can we do about it?": "c198bece6a", "Of course. Thank you for your time.": "fa90f7715b"});
    Object.assign(AUDIO_MAP, {"Hi. Are you looking for something?": "22ea034131", "Sure. Have you played football before?": "2e894ed810", "Great. Which team do you want to be on?": "406fcd9090", "Good game. Do you want to play again next week?": "fad0eb406b", "Hi. Can I join your game?": "e6970f3358", "Yes, I play every weekend.": "610a545959", "I do not mind. Any team is fine.": "e44798d77e", "Yes, I would love to. See you then.": "3942e9af00"});
    Object.assign(AUDIO_MAP, {"Excuse me. Do you speak English?": "eadda3583b", "I am looking for the museum. Is it far?": "474ac7ee09", "And then? Which way do I go?": "1b66b882b5", "Thank you so much. You are very kind.": "ef4a9a5283", "Yes, a little. How can I help?": "1edc7b4ca2", "No, it is close. Walk two streets.": "89c9a5c1f5", "Then turn right. You will see it.": "644dd00a45"});
    Object.assign(AUDIO_MAP, {"Welcome. How do you want it today?": "16275a40cc", "And the beard?": "5530569c27", "Is this OK for you?": "3f2ad5be4c", "It is eighty pounds in total.": "524bd89edb", "Just a little shorter on the sides, please.": "a660447118", "Please trim it a little. Not too short.": "9204c6307a", "Yes, it looks good. How much is it?": "8e1dbba08b"});
    Object.assign(AUDIO_MAP, {"Good morning. What do you have there?": "40409d5085", "I can clean it. Do you want it ironed too?": "1a8907a7c5", "It will be ready on Thursday afternoon.": "5adb59dcbf", "Of course. Here is your ticket.": "8e785a53ce", "Good morning. I have a shirt with a stain.": "92e12efa96", "Yes, please. When will it be ready?": "c70581f756", "Perfect. Can I pay when I pick it up?": "47cf545dfd", "Thank you. I will bring this ticket on Thursday.": "2c1379dbe9"});
    Object.assign(AUDIO_MAP, {"Good evening. What happened?": "44326011aa", "Is it only your flat, or the whole building?": "d8286aee59", "I will check the main switch. Please wait here.": "286b0d226b", "It is working again. Sorry for the trouble.": "f6a91365d3", "Good evening. The power is out in my flat.": "e4343d36d8", "I think it is the whole building.": "07415b41fa", "OK. How long will it take?": "ae5701cacd", "No problem. Thank you for your help.": "076093812d"});
    Object.assign(AUDIO_MAP, {"Next, please. How can I help you?": "47b3c99eb8", "It weighs two kilos. Do you want it express or normal?": "86fbb8af84", "About three days. It costs forty pounds.": "a376a1d976", "Sure. It is on your receipt.": "bda9ad4194", "I would like to send this parcel to Alexandria.": "b49a7a04b5", "Normal, please. How long will it take?": "d507d5088f", "That is fine. Can I get a tracking number?": "ff4196b00a", "Great. Thank you for your help.": "263f9f973e"});
    Object.assign(AUDIO_MAP, {"Welcome. Are you here to help?": "86fe69571a", "Thank you. What would you like to support?": "d9a70f5719", "We buy the supplies and give them to families.": "4e115ec40b", "Yes, and we will give you a receipt.": "b9aeb34125", "Yes, I would like to make a donation.": "8b6d8f1add", "I want to help children with school supplies.": "a8f633597e", "That sounds good. Can I donate by card?": "75f5a5df22", "Great. I hope it helps many children.": "c1c8b8a9e8"});
    Object.assign(AUDIO_MAP, {"Good afternoon. How much petrol do you need?": "d79d6e990f", "Do you want me to check the tyres too?": "7bfbaa2d2c", "The tyres are fine. That is two hundred pounds.": "a8af89d33c", "Here it is. Drive safely.": "7dada37111", "Please fill it up with regular petrol.": "6f6a0771d5", "Yes, please. Check the front ones first.": "e55ff53558", "Here you are. Can I have a receipt?": "e356066e63"});
    Object.assign(AUDIO_MAP, {"Hello. You look like you need a hand.": "f48850683e", "Where are you going with them?": "53bf0e56f8", "This one is heavy. What is inside?": "595df646b2", "Here is your platform. Have a safe trip.": "2337fe9125", "Yes, please. My bags are very heavy.": "ae67900aa1", "I am going to platform number four.": "2abfd563de", "It is full of books. Thank you for helping.": "2b39c1c203", "Thank you very much. You are very kind.": "ebf4b56819"});
    Object.assign(AUDIO_MAP, {"Do you like the rice? I made it myself.": "3104b5af71", "It is easy. First, I fry the onions.": "410bd9817b", "Then I add the rice and some water.": "0fad0e4816", "About twenty minutes on low heat.": "3a201a62fb", "It is delicious. Can you give me the recipe?": "1a3fb2c536", "And then? What do you add next?": "a73cf03803", "How long do you cook it?": "d187992285", "Thank you. I will try it this weekend.": "e50111136e"});
    Object.assign(AUDIO_MAP, {"Come in. Is it urgent?": "3024566646", "Of course. What can I do for you?": "a2ef08f542", "Is there a reason? We have a busy week.": "4e457c843b", "That is fine. Please send me an email.": "883f390048", "Not really. Do you have a minute?": "b8dbfa8b78", "I would like to take a day off next Monday.": "45c02e2cf9", "I have a family event. I will finish my work before.": "dfd11d0eb2", "Thank you very much. I will send it today.": "9664cd7b48"});
    Object.assign(AUDIO_MAP, {"Hello? Who is calling, please?": "148abced21", "I am sorry. He is in a meeting right now.": "f5aa1bfca1", "Probably in an hour. Do you want to leave a message?": "89bad94459", "Sure. Does he have your number?": "a63d9582f1", "Hello. This is Omar. Can I speak to Karim?": "4b41ae8d96", "That is OK. When will he be free?": "2604232e24", "Yes, please ask him to call me back.": "5efd45d111", "Yes, he does. Thank you for your help.": "e977d01fdd"});
    Object.assign(AUDIO_MAP, {"Good morning. Clinic reception. How can I help?": "7092f197b1", "Of course. What day is your appointment?": "72b5b544b1", "I can move it to Thursday. Is that possible?": "ca9a57036f", "Yes. I will book you at nine thirty.": "9928ea54e5", "Good morning. I need to change my appointment.": "79d960ae16", "It is on Tuesday at ten o'clock.": "f819ed418d", "Yes, Thursday is fine. Is the morning free?": "40fa42fb8c", "Perfect. Thank you for changing it.": "e1c750f0cc"});
    Object.assign(AUDIO_MAP, {"Hey. I have been waiting for twenty minutes.": "46cbc87af6", "It is OK. Did you try to call me?": "ff1a8b3023", "No problem. Let us order something to drink.": "d66cf5ad94", "Thank you. That is very kind of you.": "141e45d829", "I am so sorry. I am late because of the traffic.": "e0d78e2e56", "Yes, but my phone had no battery.": "b00f1077f7", "Good idea. This one is on me.": "923168c22e", "You are welcome. I will not be late again.": "99e594336e"});
    Object.assign(AUDIO_MAP, {"Into Egyptian pounds? Do you have your passport?": "74c9884ec8", "The rate is fifty. You will get five thousand pounds.": "37bdc16a2f", "No commission. Please count the money.": "e7cf588485", "I would like to change a hundred dollars.": "69b483ae8b", "Yes, here it is. What is the exchange rate today?": "1a192ecd2a", "OK. Is there any commission?": "dec58b1bb3", "It is correct. Thank you very much.": "e4eed377aa"});
    Object.assign(AUDIO_MAP, {"Welcome to my home. I am glad you could come.": "c8ae19fad4", "That is very kind. Please sit down and make yourself comfortable.": "45d1ef17d5", "Please help yourself. Would you like some more?": "93ff176789", "Must you go already? Stay a little longer.": "b6c41fd844", "Thank you for inviting me. I brought some sweets.": "9fba33d915", "Thank you. The food smells wonderful.": "627c0b0421", "Yes, please. It is really delicious.": "af84ab175d", "I wish I could, but I have an early start tomorrow.": "e7b8f4acef"});
    Object.assign(AUDIO_MAP, {"Hello. Can I help you find something?": "a50a1acee8", "Yes, I am looking for a small plant.": "924f78cb94", "This one is popular. It grows well indoors.": "b149823c28", "Does it need a lot of sunlight?": "e0a7c242ed", "No, only a little light. Water it once a week.": "2dbc04cb9e", "That is easy. I will take this one, please.": "4886e99ccc", "Would you like a bag or a pot with it?": "b2622f3312", "A pot, please. How much is the total?": "7dc849630a"});
    Object.assign(AUDIO_MAP, {"Good afternoon. What seems to be the problem?": "1d086a1b1c", "The sole of this shoe is coming off.": "6bd358237e", "I can glue it and sew it. It will be strong.": "6e42263cb4", "Great. How long will it take?": "0fd2e6d3e3", "It will be ready in two days.": "bc4bd7999d", "That is fine. How much will it cost?": "3eaba89ed3", "It is a small job. I will give you a fair price.": "00b0d02236", "Thank you. I will come back on Thursday.": "1f663e69c7"});
    Object.assign(AUDIO_MAP, {"I am moving to a new apartment on Saturday. Are you free?": "e594e926b9", "Yes, I can help you move.": "0841f3fc94", "That would be great. What time can you come?": "68c2db2043", "I can be there at nine in the morning.": "6b9422506a", "Thank you for coming. The boxes are in the living room.": "b57d2203c5", "Where should I start? Which box is heavy?": "b0df8b3dc7", "We are done. Thank you so much for your help.": "ee4f6b6c54", "You are welcome. Call me if you need anything.": "984d92cf5c"});
    Object.assign(AUDIO_MAP, {"It is raining hard today. Can I help you?": "282e62d22f", "Yes, I need an umbrella, please.": "86213bf845", "I have a big one and a small one.": "5f6139c62d", "The small one is better. Can I see it?": "86a647883f", "It is light and strong. It is very good for the rain.": "100dc80a61", "It looks good. How much is it?": "7ec522bb38", "It is ten pounds. The rain will stop soon.": "c1a985aff3", "I will take it. Thank you for your help.": "6b7ce3e3c7"});
    Object.assign(AUDIO_MAP, {"Welcome to our bakery. What can I get for you?": "396d6de97f", "I would like a cake for ten people.": "e35e5b5d1b", "We have chocolate and vanilla. Which one do you prefer?": "4cd88a8418", "Vanilla, please. Is it fresh today?": "571e1ebb31", "Yes, we baked it this morning. Would you like a message on it?": "0c4f8252fb", "No, thank you. Can you put it in a box?": "55397fa7d2", "Of course. Here you are. Please carry it carefully.": "c2081f82ec", "I will. Thank you very much.": "217edbed1a"});
    Object.assign(AUDIO_MAP, {"Here is your lunch. Enjoy your meal.": "34f6d652c5", "Excuse me, this is not what I ordered.": "331caa947c", "I am sorry. What did you order?": "157167db63", "I ordered the grilled chicken with rice.": "58b89e1db1", "You are right. It was our mistake. We will fix it now.": "bf1f01635b", "Thank you. I do not mind waiting a little.": "9593c5c8de", "Here is the right dish. Sorry again for the wait.": "48811510b5", "It looks great. Thank you for fixing it.": "ecf7dc7019"});
    Object.assign(AUDIO_MAP, {"Hello. I am your new neighbor. I live on the third floor.": "7232e4e47b", "Nice to meet you. Welcome to the building.": "c9b47dcd0a", "Thank you. Have you lived here for a long time?": "a6cabf03f7", "Yes, for about five years. It is a quiet building.": "c7558351bd", "That is good to hear. Is there a market nearby?": "ea53f5d706", "Yes, there is a small market on the corner.": "540cb5fd6a", "Great, thank you. It was nice talking to you.": "4ff0c19082", "You too. Let me know if you need any help.": "04948b9f2c"});
    Object.assign(AUDIO_MAP, {"Good morning. The park is open until eight tonight.": "fc8816a8bb", "Thank you. Is there a place to sit in the shade?": "7ba58b7ec6", "Yes, there are benches under the big trees.": "ccc2ff2435", "Great. Where can I buy a bottle of water?": "363f686dd2", "There is a small kiosk near the fountain.": "7e0921c4e7", "Thank you. Is the park safe for children?": "bfaebd9756", "Yes, it is. There is a playground and I am here all day.": "de048ecced", "Perfect. Thank you for your help. Have a nice day.": "4b8038b384"});
    Object.assign(AUDIO_MAP, {"I bought this flashlight yesterday, but it does not work.": "7afc40b22c", "I am sorry about that. Do you have the receipt?": "1cfc602005", "Yes, here it is. Can I get a refund, please?": "8d62af070b", "I can give you a refund, or you can choose a new one.": "36a635d242", "I prefer a new one. Can you check that it works?": "2788c1d98f", "Yes, it works well. Here you are.": "a6a3aa29f2", "Thank you for your patience. Have a good evening.": "6aa23e1623"});
    Object.assign(AUDIO_MAP, {"Welcome. What would you like me to do?": "de79aaf96c", "These trousers are too long. Can you shorten them?": "77e748f05e", "Of course. Please stand here. I will measure the length.": "6bfa0f1b10", "Thank you. How many centimeters will you cut?": "dee01ceecd", "About four centimeters. It will look perfect.": "7e34977fe4", "Good. When can I pick them up?": "bb8ae6834d", "They will be ready tomorrow afternoon.": "5e0a0668aa", "Perfect. I will come tomorrow. Thank you.": "780ed03a1e"});
    Object.assign(AUDIO_MAP, {"Good morning. Everything here is fresh today.": "bdd8a0ccff", "Good morning. How much are the tomatoes?": "fd2f0dd607", "They are six pounds for one kilo.": "8ed6dbe005", "That is fine. I would like two kilos, please.": "3f9bfe9acc", "Anything else? The apples are very sweet.": "476db45f22", "Yes, half a kilo of apples, please.": "4f08a79487", "That is twelve pounds for the tomatoes and four for the apples.": "c131636855", "Here you are. Keep the bag, thank you.": "f5504f05cd"});
    Object.assign(AUDIO_MAP, {"I would like to top up my phone credit.": "9d70e9bce7", "Sure. How much credit do you want?": "354d1302e7", "Twenty pounds, please. Can you do it now?": "611d09c3d4", "Of course. What is your phone number?": "d840bf3dcf", "It is on this paper. Please check it carefully.": "7b27493936", "Done. Your credit is twenty pounds now.": "8b0b9395c8", "Great. Can I get a receipt, please?": "bc75ed84a5"});
    Object.assign(AUDIO_MAP, {"Hello, locksmith service. What is the problem?": "2f1ee3b713", "I left my key inside and the door is locked.": "7a5d3c03c0", "I understand. What is your address?": "f975ae486e", "It is building twelve, on the second floor.": "a0d2075d5b", "I can be there in thirty minutes.": "db6df4fb77", "That is fine. Will you damage the door?": "ffa684ca7b", "No, I have a special tool. It will not damage anything.": "29089cdef0", "Good. Please come as soon as you can. Thank you.": "0891756b2b"});
    Object.assign(AUDIO_MAP, {"Good afternoon. Language center. How can I help?": "e4a4e67a58", "I would like to register for an English course.": "c77cdded70", "Certainly. Do you prefer morning or evening classes?": "a958ab6b85", "I prefer evening classes. They start after my work.": "3fbb885011", "We have classes on Sunday and Tuesday at seven.": "25ecc49946", "That works for me. How long is each class?": "9b60e3f928", "Each class is two hours. You can start next week.": "3827476a0c", "Wonderful. I will come to register tomorrow.": "8198c1c358"});
    Object.assign(AUDIO_MAP, {"Hi there. Are you looking for something?": "e0c11f2e1a", "Yes, where can I find the cooking oil?": "acfd1c215b", "It is in aisle four, next to the rice.": "5c1aadb165", "Thank you. Is the large bottle on sale today?": "dd53994df9", "Yes, the large bottle is cheaper this week.": "b8d57814dc", "Good. Which checkout is open, please?": "f2e0eaa45d", "Checkout two is open. There is no line there.": "6cc8b515ee"});
    Object.assign(AUDIO_MAP, {"Welcome. What do you need today?": "b5ac9f048e", "I need ten copies of this paper, please.": "d5da0738e1", "Do you want them in black and white or in color?": "bf8a407011", "Black and white is fine. How much is each copy?": "ebae3847fd", "It is one pound for each copy.": "c22281be1a", "Okay. Can you make them double-sided?": "aeeec3f488", "Of course. Please wait five minutes.": "ef8836ddd7", "No problem. I will wait here. Thank you.": "377b27a47d"});
    Object.assign(AUDIO_MAP, {"Good evening. Can I help you?": "c07cfa3342", "Yes, I left my bag on the metro.": "aacb6cb173", "I am sorry to hear that. What does it look like?": "6ec8216eba", "It is a small black bag with a blue zipper.": "195d83b74a", "Which train were you on, and what time?": "174d719101", "I was on the six o'clock train to Giza.": "6862603dba", "Please leave your phone number. We will call you if we find it.": "42002f62dd", "Of course. Thank you for your help.": "4636194b12"});
    Object.assign(AUDIO_MAP, {"Hello, City Taxi. How can I help you?": "323902a121", "I need a taxi to the train station, please.": "3c24f69195", "Sure. Where are you now?": "8203abc819", "I am in front of the library on Nile Street.": "1e6391ca31", "When do you need the car?": "0b316d4d12", "As soon as possible. How long will it take?": "155d250b5b", "The car will be there in ten minutes.": "7704e46965", "Thank you. I will wait outside.": "5b76bc5ee5"});
    Object.assign(AUDIO_MAP, {"Hello, my friend. I am back from my trip.": "3e4d2416ec", "Welcome back. How was your trip?": "8bcaaf0008", "It was wonderful, but I am a little tired.": "48f5eb4aa8", "I am glad to hear that. Which city did you like most?": "0e159031e2", "I liked Alexandria the most. The sea was beautiful.": "ddbecda730", "That sounds nice. Did you take any photos?": "8a2c2c48a0", "Yes, many. Come to my house tomorrow and I will show you.": "bd475e457f", "I would love to. What time should I come?": "b147191f4e"});
    Object.assign(AUDIO_MAP, {"Welcome to the bookstore. Are you looking for a book?": "64d23c7dd7", "Yes, I want an easy book for learning English.": "12185b7658", "I recommend this one. It has short stories and pictures.": "f938c4a14d", "That looks good. Does it have an audio CD?": "2b1b9b7245", "Yes, it does. The price is forty pounds.": "7ea25c5ba7", "That is a good price. I will take it.": "2bc44c5b6a", "Would you like a bag for it?": "a242e88ff4", "No, thank you. I will carry it. Have a nice day.": "97ed37d0e9"});
    Object.assign(AUDIO_MAP, {"Good morning. How can I help you today?": "b0b42ff7a3", "I have a question about my electricity bill.": "11254f05bb", "Of course. What seems to be the problem?": "c3ecdd6313", "This month it is higher than usual. Why is that?": "98c9f4d829", "Let me check your account. Did you use more air conditioning?": "4dc679a876", "Yes, it was very hot. Can I see the details?": "9e7facb54a", "Here is the list. The use was higher in August.": "3ba55b8ff3", "I understand now. Thank you for explaining.": "11a429e6e6"});
    Object.assign(AUDIO_MAP, {"Reception. How can I help you?": "797b11be97", "Hello. Could I have an extra pillow, please?": "2163d49886", "Of course. Would you like anything else?": "ac8735e84b", "Yes, a blanket too. The room is a little cold.": "a2010f88ad", "I will send them up. What is your room number?": "64973cfb98", "It is room twelve. How long will it take?": "28d52f2ef4", "About ten minutes. Someone will knock on your door.": "cb4b5fc0cb", "Thank you very much. I will wait here.": "a70979ab78"});
    Object.assign(AUDIO_MAP, {"Welcome to the bike shop. What can I do for you?": "7cbd50d25a", "My bike chain is loose. Can you fix it?": "5f92574473", "Yes, I can. It is a small problem.": "7f7acafd9c", "Great. How much will it cost?": "69b00ba75f", "It will be fifty pounds. It takes half an hour.": "3db6f254db", "That is fine. I will come back later.": "7e07abd9bf", "Good. Your bike will be ready at four.": "27a83674b4", "Thank you. See you at four.": "db579fb705"});
    Object.assign(AUDIO_MAP, {"School office. How can I help you?": "dfeb15a1ff", "Hello. What time does school finish today?": "85ddfe8175", "Today it finishes at two o'clock.": "7548f84e5b", "Thank you. I will pick up my son at two.": "6c44f25cde", "What is his name and class, please?": "0a62fa8abf", "His name is Omar. He is in class four.": "d391b90c58", "Good. Please wait at the main gate.": "5103896f4d"});
    Object.assign(AUDIO_MAP, {"Hello. Can I help you with something?": "12fd5bf366", "Yes, I bought this shirt yesterday. It is too small.": "907419cc69", "I see. Do you have the receipt with you?": "2fb67ed237", "Yes, here it is. Can I change it for a bigger size?": "821afc5d83", "Of course. Let me find a large one for you.": "23acdc86e3", "Thank you. Is the price the same?": "63e8cb47da", "Yes, the price is the same. Here you are.": "624689fcd3", "It fits well now. Thank you very much.": "e469a9ed4b"});
    Object.assign(AUDIO_MAP, {"My watch has stopped. Can you check it?": "574d74ea2b", "I think the battery is old. I can change it.": "bcfdd95178", "Yes, please. How long will it take?": "70bdde2dc3", "Only ten minutes. You can wait here.": "a75de7a02d", "Okay. How much is the new battery?": "90470df7dc", "It is thirty pounds. It also has a one year guarantee.": "992e4dfa52", "That sounds good. Please go ahead.": "600f981d9f"});
    Object.assign(AUDIO_MAP, {"Welcome. Are you looking for something?": "6710271ea7", "Yes, I want to grow some herbs on my balcony.": "480edbdbd2", "Mint and basil are easy. Do you get much sun?": "d4f2c068d2", "Yes, the balcony gets sun all morning.": "1cdf331dc4", "Then take these seeds and this small pot.": "5a29f369c6", "Thank you. How often should I water them?": "9f2ca87af8", "Water them every two days. Not too much.": "b4789de24d", "I understand. Thank you for your advice.": "9bc89b64ba"});
    Object.assign(AUDIO_MAP, {"I need passport photos, please.": "e91dd74371", "How many photos do you need?": "109c5c2302", "I need six photos. How much is it?": "e8f3727df3", "It is sixty pounds for six photos. Please sit here.": "efe1a88cc8", "Okay. Should I look at the camera?": "6a59fdf425", "Yes, please. Done. The photos will be ready in ten minutes.": "aa844bb1dd", "Great. I will come back in ten minutes.": "43d982d919"});
    Object.assign(AUDIO_MAP, {"I would like a monthly internet plan for my phone.": "2ed46c0d15", "We have a ten gigabyte plan and a twenty gigabyte plan.": "e6313d7450", "What is the price of the twenty gigabyte plan?": "ab3b958399", "It is one hundred pounds per month.": "e4113b0f70", "That is a little expensive. Is there a cheaper plan?": "1748aea4ab", "Yes, the ten gigabyte plan is sixty pounds.": "2aab0f75a4", "That is better. I will take it, please.": "c3456585da"});
    Object.assign(AUDIO_MAP, {"Excuse me. Can I help you find something?": "abc82e8987", "Yes, I am looking for a toothbrush.": "fc94ce0f13", "They are in aisle five, next to the soap.": "cabac6a5c5", "Thank you. Where is aisle five?": "e9b5e02e16", "It is at the back of the store, on the left.": "cec5145417", "I see. Do you have a small one for travel?": "934a08e42e", "Yes, we do. It is next to the large ones.": "4ddc20b1a3"});
    Object.assign(AUDIO_MAP, {"Hi there. What would you like?": "79c49fe694", "I would like two falafel sandwiches, please.": "1458fb8661", "Sure. Do you want them with salad?": "1d04c02ed4", "Yes, with salad, but no onions, please.": "e91362be4b", "It will be ready in two minutes. Anything to drink?": "aabfdfe1f0", "No, thank you. How much is it altogether?": "6bd9597065", "It is twenty pounds. Here you are.": "d4f75f257a", "Here is the money. Thank you very much.": "372d7efa1c"});
    Object.assign(AUDIO_MAP, {"The cash machine kept my card. Can you help me?": "d3491541a2", "I am sorry to hear that. Which machine was it?": "126c0717b3", "It was the machine outside the bank.": "80f3382272", "Do you have your identity card with you?": "1438d3302f", "Yes, here it is. Can I get my card back?": "fa151cc784", "Yes. Please wait a moment. I will bring it.": "fd28a11f19", "Thank you. I will wait here.": "3a35c225c9"});
    Object.assign(AUDIO_MAP, {"Excuse me. Do you need some help?": "48f625fc9c", "Yes, please. I do not know how to use this machine.": "26f94d6f30", "No problem. Where do you want to go?": "996d6b1306", "I want to go to Tahrir Square. How much is the ticket?": "23dc05c187", "It is eight pounds. Press this button, then put in the money.": "77ed3f5129", "I have pressed it. Where do I put the money?": "9bb27163b0", "Put it here. Then take your ticket and your change.": "07c6e14aad", "I got it. Thank you for your help.": "0aff80b1ec"});
    Object.assign(AUDIO_MAP, {"Welcome. What are you looking for?": "581cb40666", "I am looking for running shoes, size forty-two.": "9733b5dded", "Try these. They are very light and comfortable.": "b6135d8144", "They feel a little tight. Do you have a bigger size?": "614b0a3984", "Here is size forty-three. Please try them on.": "77b0ef1fc3", "These fit well. How much are they?": "76c614b9cf", "They are four hundred pounds. They are on sale today.": "2817835bfd", "That is a good price. I will buy them.": "92f7416294"});
    Object.assign(AUDIO_MAP, {"Hello. What is the problem with your phone?": "92816be5e3", "The screen is broken. Can you repair it today?": "fcee1a2bc4", "Yes, I can. I need to change the whole screen.": "2e3c3fe43c", "How much will it cost? How long will it take?": "239ea85cce", "It will cost five hundred pounds. It takes about one hour.": "c9af6d6bde", "That is fine. Do you give a guarantee?": "7ea3c0bd36", "Yes, we give a three month guarantee on the screen.": "db332066a5", "Good. Please start now. I will wait outside.": "a57fb9252b"});
    Object.assign(AUDIO_MAP, {"Hello. Yes, the apartment is still available.": "30deaae160", "Good. How many rooms does it have?": "786d5c3cab", "It has two bedrooms, a kitchen and a small balcony.": "1bea679a47", "That sounds nice. What is the monthly rent?": "08b95a7116", "It is three thousand pounds a month. Water is included.": "bb1dad6486", "Okay. Can I see the apartment tomorrow?": "2e4d41cb4a", "Yes, of course. Come at five o'clock.": "2d633a8e9a", "Perfect. Please send me the address.": "671db689ce"});
    Object.assign(AUDIO_MAP, {"Good morning. How many tickets do you need?": "4d39c5fb21", "Four tickets, please. Two adults and two children.": "5920aef197", "The adult ticket is two hundred pounds. Children pay half.": "71f765cb84", "Okay. What time do you close today?": "99a13632b1", "We close at five o'clock. The last entry is at four.": "a9a77e6a35", "Thank you. Can we take photos inside?": "ec6a903eec", "Yes, you can take photos, but please do not touch the walls.": "7fe89d8dcf", "Of course. Thank you for telling us.": "ad111e21ba"});
    Object.assign(AUDIO_MAP, {"Hello. Are you the new neighbor?": "1482953176", "Yes, I moved in yesterday. When do they collect the trash?": "12a9d1688a", "They come every morning at eight. Leave the bag outside your door.": "7f7fba6a11", "I see. Is there a place for recycling too?": "4a738d8082", "Yes, there are blue bins behind the building.": "06ea1d15de", "Great. Which bin is for plastic bottles?": "2b4d94cb04", "The bin on the left. Welcome to the building.": "7ea2cc2be2"});
    Object.assign(AUDIO_MAP, {"Hello. What can I get for you?": "dde8889ab5", "A cold bottle of water, please.": "4e72c68b68", "Here you are. Would you like a snack too?": "04552410d4", "Yes, what kinds of chips do you have?": "764f2185a7", "We have cheese, salt and tomato.": "f89f78fc06", "I will take the cheese one. How much is everything?": "f37a9af2d3", "The water is ten pounds and the chips are fifteen. Twenty-five pounds.": "4b791a7d61"});
    Object.assign(AUDIO_MAP, {"Was everything fine with your meal?": "bf5dca73d4", "Yes, it was delicious. Can we have the bill, please?": "e980fd4f08", "Of course. I will bring it now.": "b9390e0a72", "Is the service charge included?": "b894b540f4", "Yes, it is included. The total is three hundred and fifty pounds.": "f70ced9f50", "Yes, of course. I will bring the machine.": "63017e0c9a", "Thank you. The food was very good.": "93b101c104"});
    Object.assign(AUDIO_MAP, {"Hi. You look worried. What is wrong?": "e51ed7093b", "The printer is not working. Can you help me?": "434433d356", "Let me see. There is no paper in the tray.": "21b4dd6a2b", "Oh, I see. Where do you keep the paper?": "4d5090b583", "It is in the cupboard next to the window.": "661134d96a", "Thank you. I will get some now.": "df574955b3", "It is printing now. Is it working?": "f6edb1c647", "Yes, it works. Thank you for your help.": "8cc177afc2"});
    Object.assign(AUDIO_MAP, {"Hotel Nile View. How can I help you?": "99fd52777b", "Hello. Do you have a room for tonight?": "01ad281186", "Yes, we do. Would you like a single or a double room?": "7d78ca1906", "A double room, please. How much is it per night?": "bf8403c663", "It is one thousand two hundred pounds, with breakfast.": "3271f17ef1", "That is fine. Is there a pool or a gym?": "a203ed447e", "There is a small gym. May I have your name, please?": "5622342736", "My name is Karim. I will arrive at eight.": "c6892a48a7"});
    Object.assign(AUDIO_MAP, {"Not yet. What do you recommend?": "73bd83787f", "The grilled chicken is very popular. It comes with rice.": "61829516b1", "That sounds good. Is it spicy?": "60fbc9e4fe", "No, it is not spicy. It is very mild.": "25577a6eca", "Perfect. I will have the chicken, please.": "dd58a53552", "Would you like something to drink with it?": "f843c44b3e", "Just water, please. Thank you.": "951f7247af"});
    Object.assign(AUDIO_MAP, {"Hi. Do you need something?": "503cb5e9bb", "Yes. Do you have a phone charger?": "baca8b7e09", "Yes, I do. What kind of phone do you have?": "ad19f79b54", "It is a small Android phone.": "d94b4cc03e", "Here you go. You can use it at my desk.": "19408f3e3d", "Thank you. Can I use it for twenty minutes?": "4fc9c0b1c5", "Of course. Take your time.": "615dad082d", "That is very kind of you. Thanks again.": "2f69510e98"});
    Object.assign(AUDIO_MAP, {"Is this the right street?": "8246ea69a1", "Yes. Please stop near the green gate.": "a2cd723584", "Here? Or a little further?": "f8f3f38e5d", "A little further, please. After the bakery.": "f95562517d", "We are here. The fare is forty pounds.": "a26a1ee616", "Thank you. Have a good day.": "6511bf5839", "Thank you. You too. Goodbye.": "f0d66a54c0"});
    const Speech = (function () {
        const synth = 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
        const ok = true;
        let voice = null, current = null, clip = null;
        function pick() {
            try {
                const vs = speechSynthesis.getVoices();
                voice = vs.find((v) => /^en[-_]US/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
            } catch (e) { voice = null; }
        }
        if (synth) { pick(); try { speechSynthesis.addEventListener('voiceschanged', pick); } catch (e) { /* older engines */ } }
        const msg = el('p', 'audio-msg'); msg.setAttribute('aria-live', 'polite'); msg.hidden = true;
        document.body.appendChild(msg);
        let mt = 0;
        function say(t) { msg.textContent = t; msg.hidden = false; clearTimeout(mt); mt = setTimeout(() => { msg.hidden = true; }, 4500); }
        function noVoice() { try { return speechSynthesis.getVoices().length > 0 && !voice; } catch (e) { return true; } }
        function clean(t) { return String(t).replace(/\.\.\.|\u2026/g, '').replace(/\s+/g, ' ').trim(); }
        function done(button) { if (button) button.classList.remove('playing'); if (current === button) current = null; }
        function stop() {
            if (clip) { try { clip.pause(); } catch (e) { /* ignore */ } clip = null; }
            if (synth) { try { speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
            if (current) { current.classList.remove('playing'); current = null; }
        }
        function synthSpeak(text, slow, button) {
            if (!synth) { say('ماقدرناش نشغّل الصوت على الجهاز ده.'); return; }
            if (noVoice()) { say('جهازك مفيهوش صوت إنجليزي. جرب متصفح تاني أو نزّل صوت إنجليزي من إعدادات الجهاز.'); return; }
            try {
                const u = new SpeechSynthesisUtterance(clean(text));
                u.lang = 'en-US'; if (voice) u.voice = voice; u.rate = slow ? 0.55 : 0.9;
                u.onstart = () => { if (button) { button.classList.add('playing'); current = button; } };
                u.onend = () => done(button);
                u.onerror = (e) => { done(button); if (e && e.error && e.error !== 'canceled' && e.error !== 'interrupted') say('ماقدرناش نشغّل الصوت على الجهاز ده.'); };
                speechSynthesis.speak(u);
            } catch (e) { say('ماقدرناش نشغّل الصوت على الجهاز ده.'); }
        }
        function speak(text, slow, button) {
            const was = current === button && button.dataset.rate === (slow ? 's' : 'n');
            stop(); if (was) return;
            if (button) button.dataset.rate = slow ? 's' : 'n';
            const id = AUDIO_MAP[clean(text)];
            if (!id) { synthSpeak(text, slow, button); return; }
            try {
                const a = new Audio('audio/' + id + (slow ? '-s' : '-n') + '.mp3');
                clip = a; current = button; if (button) button.classList.add('playing');
                a.addEventListener('ended', () => { if (clip === a) clip = null; done(button); });
                a.addEventListener('error', () => { if (clip === a) clip = null; done(button); synthSpeak(text, slow, button); });
                const pr = a.play();
                if (pr && pr.catch) pr.catch(() => { if (clip === a) { clip = null; done(button); synthSpeak(text, slow, button); } });
            } catch (e) { done(button); synthSpeak(text, slow, button); }
        }
        return { ok: ok, speak: speak, stop: stop };
    })();
    function speakBtn(text, slow) {
        if (!Speech.ok) return null;
        const b = el('button', 'speak' + (slow ? ' slow' : ''));
        b.type = 'button';
        b.setAttribute('aria-label', slow ? 'اسمع الجملة ببطء' : 'اسمع الجملة بالإنجليزي');
        b.title = slow ? 'ببطء' : 'اسمع';
        b.innerHTML = slow
            ? '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 14h3l4 3V7L7 10H4z" fill="currentColor"/><path d="M15 9l5 6M20 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg><span>ببطء</span>'
            : '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/></svg>';
        b.addEventListener('click', () => Speech.speak(text, !!slow, b));
        return b;
    }
    function phraseLine(p) {
        const row = el('div', 'phrase-line');
        row.appendChild(enSpan(p.en));
        const sb = speakBtn(p.en); if (sb) row.appendChild(sb);
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
            if (steps.length > 1) flow.appendChild(bar(((index + 1) / steps.length) * 100));
            if (step.tag && opts.showTag) flow.appendChild(el('p', 'tag', step.tag));
            flow.appendChild(mixedEl('p', 'scene', step.scene));
            if (step.them) {
                const bubble = el('div', 'them');
                bubble.appendChild(enSpan(step.them));
                const sbar = el('div', 'speak-bar');
                const s1 = speakBtn(step.them), s2 = speakBtn(step.them, true);
                if (s1) { sbar.appendChild(s1); sbar.appendChild(s2); bubble.appendChild(sbar); }
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
                    add(note, el('p', 'callout-title', ok ? labels.correct : labels.wrong), mixedEl('p', null, step.explain));
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



    /* ---------- common mistakes (Arabic speakers) ---------- */
    const MISTAKES = [{"t": "الفعل to be ناقص", "why": "بالعربي بنقول «أنا جاهز» من غير فعل. في الإنجليزي لازم am / is / are.", "bad": "I ready for the trip.", "good": "I'm ready for the trip."}, {"t": "نسيان a قبل الاسم المفرد", "why": "مفيش في العربي أداة نكرة. في الإنجليزي الاسم المفرد المعدود زي headache بياخد a أو an قبله.", "bad": "I have headache.", "good": "I have a headache."}, {"t": "ترتيب السؤال", "why": "مينفعش نسيب ترتيب الجملة الخبرية ونرفع الصوت بس. لازم فعل مساعد زي are أو does قبل الفاعل.", "bad": "Where you go?", "good": "Where are you going?"}, {"t": "does في السؤال", "why": "لما نسأل عن المعنى بنستخدم does مع this، والفعل mean بيرجع للأصل من غير s.", "bad": "What means this?", "good": "What does this mean?"}, {"t": "agree فعل مش صفة", "why": "«أنا موافق» بالعربي فيها صفة، لكن agree في الإنجليزي فعل لوحده. من غير am.", "bad": "I am agree with you.", "good": "I agree with you."}, {"t": "luggage مفيهاش جمع", "why": "luggage اسم مش معدود. مبنزودش عليه s ومنقولش two luggages. لو عايز العدد قول two bags.", "bad": "Where can I leave my luggages?", "good": "Where can I leave my luggage?"}, {"t": "information مفيهاش جمع", "why": "information كمان اسم مش معدود. مفيش an information ولا informations. نقول some information.", "bad": "Can you give me an information?", "good": "Can you give me some information?"}, {"t": "miss القطر مش lose", "why": "لما توصل متأخر ومتلحقش القطر أو الأتوبيس بتقول miss. منقولش lose the train بالمعنى ده.", "bad": "I lost the train.", "good": "I missed the train."}, {"t": "depend بتتبعها on", "why": "الفعل depend بيتّبع بحرف الجر on. منقولش depend of ولا depend from.", "bad": "It depends from the traffic.", "good": "It depends on the traffic."}, {"t": "allergic صفة بتتبعها to", "why": "بنقول I'm allergic to وبعدها الحاجة. مبنقولش I have allergic.", "bad": "I have allergic to nuts.", "good": "I'm allergic to nuts."}];
    function mistakesView() {
        app.innerHTML = '';
        app.appendChild(pageHead('أخطاء شائعة', 'أغلاط بتحصل كتير لما نترجم من العربي حرفيًا. شوف الغلط والصح والسبب، واسمع الجملة الصح.'));
        const wrap = el('div', 'narrow');
        MISTAKES.forEach((m) => {
            const card = el('section', 'card-box mistake');
            card.appendChild(el('h2', null, m.t));
            const bad = el('p', 'm-bad'); bad.appendChild(el('span', 'm-tag', 'غلط')); bad.appendChild(enSpan(m.bad)); card.appendChild(bad);
            const good = el('p', 'm-good'); good.appendChild(el('span', 'm-tag ok', 'صح')); good.appendChild(enSpan(m.good));
            const a = speakBtn(m.good), b = speakBtn(m.good, true);
            if (a) { good.appendChild(a); good.appendChild(b); }
            card.appendChild(good);
            card.appendChild(mixedEl('p', null, m.why));
            wrap.appendChild(card);
        });
        const acts = el('div', 'actions'); add(acts, link('تمرين رتّب الجملة', '#/build', 'btn primary'), link('رجوع للتدريب', '#/practice', 'btn secondary')); wrap.appendChild(acts);
        app.appendChild(wrap);
    }

    /* ---------- fill in the blank ---------- */
    const FILL_ITEMS = [
        { s: 'I ___ a student.', ar: 'أنا طالب.', c: ['am', 'is', 'are'], a: 0, why: 'مع I بنستخدم am: I am.' },
        { s: 'He ___ a doctor.', ar: 'هو دكتور.', c: ['am', 'is', 'are'], a: 1, why: 'مع he وshe وit بنستخدم is.' },
        { s: 'There ___ two chairs in the room.', ar: 'في كرسيين في الأوضة.', c: ['is', 'are', 'am'], a: 1, why: 'كرسيين يعني جمع، فنقول there are.' },
        { s: 'She ___ coffee every morning.', ar: 'هي بتشرب قهوة كل صباح.', c: ['drink', 'drinks', 'drinking'], a: 1, why: 'في المضارع البسيط مع he وshe وit بنزود s في الفعل: she drinks.' },
        { s: 'I ___ English every day.', ar: 'أنا بذاكر إنجليزي كل يوم.', c: ['study', 'studies', 'studying'], a: 0, why: 'مع I بنستخدم الفعل زي ما هو من غير s: I study.' },
        { s: 'I ___ to the market yesterday.', ar: 'أنا روحت السوق امبارح.', c: ['go', 'went', 'going'], a: 1, why: 'امبارح يعني ماضي، وماضي go هو went.' },
        { s: 'We are ___ the bus stop.', ar: 'إحنا عند موقف الأتوبيس.', c: ['at', 'on', 'in'], a: 0, why: 'للمكان المحدد زي موقف الأتوبيس بنقول at.' },
        { s: 'The shop opens ___ nine o\'clock.', ar: 'المحل بيفتح الساعة تسعة.', c: ['at', 'in', 'on'], a: 0, why: 'قبل الساعة بالظبط بنستخدم at: at nine o\'clock.' },
        { s: 'She is ___ home now.', ar: 'هي في البيت دلوقتي.', c: ['at', 'in', 'to'], a: 0, why: 'التعبير الثابت هو at home.' },
        { s: 'I need ___ umbrella.', ar: 'أنا محتاج شمسية.', c: ['a', 'an', 'two'], a: 1, why: 'umbrella بتبدأ بصوت حرف متحرك، فنستخدم an. وtwo محتاجة اسم جمع (two umbrellas).' },
        { s: 'Can you help ___?', ar: 'ينفع تساعدني؟', c: ['I', 'me', 'my'], a: 1, why: 'بعد الفعل بنستخدم me مش I.' },
        { s: 'How ___ is this?', ar: 'ده بكام؟', c: ['much', 'many', 'any'], a: 0, why: 'للسؤال عن السعر بنقول How much.' }
    ];
    function fillView() {
        app.innerHTML = '';
        app.appendChild(pageHead('كمّل الجملة', 'اختار الكلمة الناقصة في الجملة الإنجليزي. معنى الجملة مكتوب بالعربي تحتها.'));
        const wrap = el('div', 'narrow');
        const box = el('section', 'group card-box');
        wrap.appendChild(box); app.appendChild(wrap);
        function start() {
            const set = shuffle(FILL_ITEMS).slice(0, 8);
            let index = 0, score = 0;
            function render() {
                const it = set[index];
                let firstTry = true, solved = false;
                box.innerHTML = '';
                add(box, el('p', 'counter', 'جملة ' + (index + 1) + ' من ' + set.length));
                const sc = el('p', 'scene'); sc.appendChild(enSpan(it.s)); add(box, sc);
                add(box, el('p', 'caption', it.ar));
                const choicesBox = el('div', 'choices');
                const feedback = el('div', 'feedback'); feedback.setAttribute('aria-live', 'polite'); feedback.style.marginTop = '14px';
                const actions = el('div', 'actions');
                shuffle(it.c.map((_, i) => i)).forEach((oi) => {
                    const b = el('button', 'choice'); b.type = 'button'; b.appendChild(enSpan(it.c[oi]));
                    b.addEventListener('click', () => {
                        if (solved) return;
                        feedback.innerHTML = '';
                        if (oi === it.a) {
                            solved = true; if (firstTry) score++;
                            Array.from(choicesBox.children).forEach((c) => { c.disabled = true; });
                            b.classList.add('is-correct');
                            sc.innerHTML = ''; sc.appendChild(enSpan(it.s.replace('___', it.c[it.a])));
                            const note = el('div', 'callout note'); add(note, el('p', 'callout-title', 'صح'), el('p', null, it.why)); feedback.appendChild(note);
                            const last = index === set.length - 1;
                            const nb = btn(last ? 'شوف النتيجة' : 'الجملة اللي بعدها', 'primary', () => { if (last) finish(); else { index++; render(); } });
                            actions.innerHTML = ''; actions.appendChild(nb); setTimeout(() => nb.focus({ preventScroll: true }), 0);
                        } else {
                            firstTry = false; b.classList.add('is-wrong'); b.disabled = true;
                            const note = el('div', 'callout warning'); add(note, el('p', 'callout-title', 'مش دي'), el('p', null, 'جرب اختيار تاني.')); feedback.appendChild(note);
                        }
                    });
                    choicesBox.appendChild(b);
                });
                add(box, choicesBox, feedback, actions);
            }
            function finish() {
                markDay(); save();
                box.innerHTML = '';
                const pct = Math.round((score / set.length) * 100);
                add(box, el('p', 'group-label', 'النتيجة'), el('h2', null, 'كمّل الجملة: ' + score + ' من ' + set.length));
                const row = el('div', 'result-row');
                add(row, ring(pct, 'النتيجة ' + pct + ' بالمية'), el('p', null, 'ده عدد الجمل اللي جاوبتها صح من أول محاولة. التمرين ده للتدريب ومبيتسجلش في نتايج الاختبارات.'));
                box.appendChild(row);
                const a = el('div', 'actions'); add(a, btn('تمرين جديد', 'primary', start), link('رجوع للتدريب', '#/practice', 'btn secondary')); box.appendChild(a);
            }
            render();
        }
        start();
    }

    /* ---------- listening practice: hear a recorded clip, choose its Arabic meaning ---------- */
    function listenPool() {
        const seen = {}, out = [];
        lessons.forEach((l) => l.steps.forEach((st) => {
            [st.phrase].concat(st.them ? [{ en: st.them, ar: st.themAr }] : []).forEach((p) => {
                if (!p || !p.en || !p.ar || seen[p.en] || !AUDIO_MAP[p.en.replace(/\s+/g, ' ').trim()]) return;
                seen[p.en] = 1; out.push(p);
            });
        }));
        return out;
    }
    function listenView() {
        app.innerHTML = '';
        app.appendChild(pageHead('تمرين السمع', 'اسمع الجملة بالإنجليزي من غير ما تشوفها، واختار معناها بالعربي. اضغط على السماعة تسمعها عادي، أو بالبطيء لو عايز.'));
        const wrap = el('div', 'narrow');
        const box = el('section', 'group card-box');
        wrap.appendChild(box); app.appendChild(wrap);
        const pool = listenPool();
        function start() {
            const set = shuffle(pool).slice(0, 8);
            let index = 0, score = 0;
            function render() {
                const p = set[index];
                const others = shuffle(pool.filter((q) => q.ar !== p.ar)).slice(0, 2);
                const opts = shuffle([p].concat(others));
                let firstTry = true, solved = false;
                box.innerHTML = '';
                add(box, el('p', 'counter', 'جملة ' + (index + 1) + ' من ' + set.length));
                add(box, el('p', 'scene', 'اسمع الجملة واختار معناها:'));
                const sbar = el('div', 'speak-bar');
                const s1 = speakBtn(p.en), s2 = speakBtn(p.en, true);
                if (s1) sbar.appendChild(s1); if (s2) sbar.appendChild(s2);
                box.appendChild(sbar);
                const list = el('div', 'choices');
                const feedback = el('div', 'feedback'); feedback.setAttribute('aria-live', 'polite');
                const actions = el('div', 'actions');
                opts.forEach((o) => {
                    const b = el('button', 'choice', o.ar); b.type = 'button'; b.dir = 'rtl'; b.lang = 'ar'; b.style.textAlign = 'right'; b.addEventListener('click', () => {
                        if (solved) return;
                        if (o === p) {
                            solved = true; if (firstTry) score++;
                            b.classList.add('is-correct');
                            feedback.innerHTML = '';
                            const note = el('div', 'callout note'); add(note, el('p', 'callout-title', 'صح'));
                            feedback.appendChild(note);
                            const keep = el('div', 'keep'); add(keep, el('p', 'keep-label', 'افتكر الجملة دي'), phraseLine(p)); feedback.appendChild(keep);
                            const last = index === set.length - 1;
                            const nb = btn(last ? 'شوف النتيجة' : 'الجملة اللي بعدها', 'primary', () => { if (last) finish(); else { index++; render(); } });
                            actions.appendChild(nb); setTimeout(() => nb.focus({ preventScroll: true }), 0);
                        } else {
                            firstTry = false; b.classList.add('is-wrong');
                            feedback.innerHTML = '';
                            const note = el('div', 'callout warning'); add(note, el('p', 'callout-title', 'مش ده'), el('p', null, 'اسمع تاني وجرب اختيار تاني.'));
                            feedback.appendChild(note);
                        }
                    });
                    list.appendChild(b);
                });
                add(box, list, feedback, actions);
            }
            function finish() {
                markDay(); save();
                box.innerHTML = '';
                const pct = Math.round((score / set.length) * 100);
                add(box, el('p', 'group-label', 'النتيجة'), el('h2', null, 'تمرين السمع: ' + score + ' من ' + set.length));
                const row = el('div', 'result-row');
                add(row, ring(pct, 'النتيجة ' + pct + ' بالمية'), el('p', null, 'ده عدد الجمل اللي فهمتها من أول محاولة. التمرين ده للتدريب ومبيتسجلش في نتايج الاختبارات.'));
                box.appendChild(row);
                const a = el('div', 'actions'); add(a, btn('تمرين جديد', 'primary', start), link('رجوع للتدريب', '#/practice', 'btn secondary')); box.appendChild(a);
            }
            render();
        }
        start();
    }

    /* ---------- word-tile sentence building ---------- */
    function buildPhrases() {
        const seen = {}, out = [];
        lessons.forEach((l) => l.steps.forEach((st) => {
            const p = st.phrase;
            if (!p || !p.en || !p.ar) return;
            const w = p.en.trim().split(/\s+/);
            if (w.length < 3 || w.length > 9 || seen[p.en]) return;
            seen[p.en] = 1; out.push(p);
        }));
        return out;
    }
    function buildView() {
        app.innerHTML = '';
        app.appendChild(pageHead('رتّب الجملة', 'شوف المعنى بالعربي ورتّب الكلمات الإنجليزي بالترتيب الصح. الكلمات اللي بتضغط عليها بتنتقل فوق، واضغط عليها تاني لو عايز ترجعها.'));
        const wrap = el('div', 'narrow');
        const box = el('section', 'group card-box');
        wrap.appendChild(box); app.appendChild(wrap);
        const pool = buildPhrases();
        function start() {
            const set = shuffle(pool).slice(0, 8);
            let index = 0, score = 0;
            function scramble(words) {
                let t, n = 0;
                do { t = shuffle(words.map((_, i) => i)); n++; } while (n < 20 && t.every((v, i) => v === i));
                return t;
            }
            function render() {
                const p = set[index];
                const words = p.en.trim().split(/\s+/);
                const order = scramble(words);
                const chosen = [];
                let firstTry = true, solved = false;
                box.innerHTML = '';
                add(box, el('p', 'counter', 'جملة ' + (index + 1) + ' من ' + set.length));
                add(box, el('p', 'scene', 'رتّب الجملة اللي معناها: ' + p.ar));
                const ans = el('div', 'tile-row tile-ans'); ans.dir = 'ltr'; ans.setAttribute('aria-label', 'جملتك');
                const bank = el('div', 'tile-row tile-bank'); bank.dir = 'ltr'; bank.setAttribute('aria-label', 'الكلمات المتاحة');
                const feedback = el('div', 'feedback'); feedback.setAttribute('aria-live', 'polite');
                const actions = el('div', 'actions');
                const check = btn('تحقق', 'primary', verify);
                function draw() {
                    ans.innerHTML = ''; bank.innerHTML = '';
                    chosen.forEach((wi) => { const t = el('button', 'tile', words[wi]); t.type = 'button'; t.lang = 'en'; t.disabled = solved; t.addEventListener('click', () => { chosen.splice(chosen.indexOf(wi), 1); feedback.innerHTML = ''; draw(); }); ans.appendChild(t); });
                    order.forEach((wi) => { if (chosen.indexOf(wi) >= 0) return; const t = el('button', 'tile', words[wi]); t.type = 'button'; t.lang = 'en'; t.addEventListener('click', () => { chosen.push(wi); feedback.innerHTML = ''; draw(); }); bank.appendChild(t); });
                    ans.classList.toggle('is-empty', !chosen.length);
                    check.disabled = chosen.length !== words.length || solved;
                }
                function verify() {
                    const got = chosen.map((i) => words[i]).join(' ');
                    feedback.innerHTML = '';
                    if (got === words.join(' ')) {
                        solved = true; if (firstTry) score++;
                        draw();
                        const note = el('div', 'callout note');
                        add(note, el('p', 'callout-title', 'صح، الترتيب سليم'));
                        feedback.appendChild(note);
                        const keep = el('div', 'keep'); add(keep, el('p', 'keep-label', 'افتكر الجملة دي'), phraseLine(p)); feedback.appendChild(keep);
                        const last = index === set.length - 1;
                        actions.innerHTML = '';
                        const nb = btn(last ? 'شوف النتيجة' : 'الجملة اللي بعدها', 'primary', () => { if (last) finish(); else { index++; render(); } });
                        actions.appendChild(nb); setTimeout(() => nb.focus({ preventScroll: true }), 0);
                    } else {
                        firstTry = false;
                        const note = el('div', 'callout warning');
                        add(note, el('p', 'callout-title', 'الترتيب مش مظبوط'), el('p', null, 'جرب تغيّر ترتيب الكلمات. ولو محتار اضغط وريني الإجابة.'));
                        feedback.appendChild(note);
                        const show = btn('وريني الإجابة', 'ghost', () => { chosen.length = 0; words.forEach((_, i) => chosen.push(i)); draw(); verify(); });
                        const clear = btn('امسح وابدأ تاني', 'secondary', () => { chosen.length = 0; feedback.innerHTML = ''; draw(); });
                        const row = el('div', 'actions'); add(row, clear, show); feedback.appendChild(row);
                    }
                }
                add(actions, check);
                add(box, ans, bank, feedback, actions);
                draw();
            }
            function finish() {
                markDay(); save();
                box.innerHTML = '';
                const pct = Math.round((score / set.length) * 100);
                add(box, el('p', 'group-label', 'النتيجة'), el('h2', null, 'ترتيب الجمل: ' + score + ' من ' + set.length));
                const row = el('div', 'result-row');
                add(row, ring(pct, 'النتيجة ' + pct + ' بالمية'), el('p', null, 'ده عدد الجمل اللي رتبتها صح من أول محاولة. التمرين ده للتدريب ومبيتسجلش في نتايج الاختبارات.'));
                box.appendChild(row);
                const a = el('div', 'actions'); add(a, btn('تمرين جديد', 'primary', start), link('رجوع للتدريب', '#/practice', 'btn secondary')); box.appendChild(a);
            }
            render();
        }
        start();
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
                if (x.s.them) li.appendChild(enSpan(x.s.them, 'block')); else li.appendChild(mixedEl('span', null, x.s.scene));
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
        const next = nextLesson();
        const cont = el('div', 'continue');
        add(cont, el('p', 'group-label', next ? (st.answered ? 'كمّل من حيث وقفت' : 'ابدأ من هنا') : 'خلصت كل الدروس'),
            el('h2', null, next ? 'الدرس ' + next.number + ': ' + next.title : 'ممتاز، راجع نفسك في الاختبارات'),
            el('p', null, next ? next.subtitle : 'جرب الاختبار الشامل أو راجع أخطاءك في التدريب.'));
        const ca = el('div', 'actions');
        ca.appendChild(next ? link(st.answered ? 'كمّل الدرس' : 'ابدأ الدرس', '#/lesson-' + next.number, 'btn primary') : link('الاختبار الشامل', '#/test-mixed', 'btn primary'));
        ca.appendChild(link('تدريب سريع', '#/practice', 'btn secondary'));
        cont.appendChild(ca);
        main.appendChild(cont);
        const statsRow = el('div', 'stats');
        add(statsRow, stat(st.done + '/' + lessons.length, 'دروس خلصتها'), stat(st.acc === null ? '-' : st.acc + '%', 'دقة الإجابات من أول مرة'), stat(st.fixed, 'أخطاء اتصححت'), stat(st.miss.length, 'أسئلة للمراجعة'));
        if (st.answered) main.appendChild(statsRow);


        const list = section(arNum(lessons.length) + ' مواقف من الحياة اليومية', 'الدروس');
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
        app.appendChild(pageHead('الدروس', arNum(lessons.length) + ' مواقف من الحياة اليومية. كل درس ٤ خطوات، وتقدر تعيده في أي وقت.'));
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
        const mst = btn('أخطاء شائعة', 'secondary', () => { location.hash = '#/mistakes'; });
        const bld = btn('رتّب الجملة', 'secondary', () => { location.hash = '#/build'; });
        const fil = btn('كمّل الجملة', 'secondary', () => { location.hash = '#/fill'; });
        const lis = btn('تمرين السمع', 'secondary', () => { location.hash = '#/listen'; });
        add(actions, mix, mis, lis, bld, fil, mst);
        picker.appendChild(actions);
        picker.appendChild(el('p', 'caption', 'الأسئلة اللي بتغلط فيها من أول مرة بتتسجل هنا، وبتتشال من القائمة لما تجاوبها صح مرتين ورا بعض.'));
        main.insertBefore(picker, holder);
        const info = panel('مفيد تعرف');
        info.appendChild(el('p', null, 'التدريب بيشمل ' + arNum(ITEMS.filter((i) => i.lesson > 0).length) + ' خطوة من الدروس و' + arNum(quiz.length) + ' أسئلة من المراجعة. مفيش وقت محدد ولا ضغط.'));
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
        grid.appendChild(tcard('أخطاء شائعة', '١٠ أغلاط بتتكرر مع الناطقين بالعربي', '#/mistakes', ''));
        grid.appendChild(tcard('تمرين السمع', 'اسمع الجملة واختار معناها بالعربي', '#/listen', ''));
        grid.appendChild(tcard('رتّب الجملة', 'رتّب كلمات الجملة الإنجليزي من المعنى', '#/build', ''));
        grid.appendChild(tcard('كمّل الجملة', 'اختار الكلمة الناقصة في الجملة', '#/fill', ''));
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
        const ph = section('حفظ على هذا المتصفح، ومزامنة مع حسابك', 'الملف الشخصي والنسخة الاحتياطية');
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

        if (window.LangCloud) main.appendChild(window.LangCloud.panel(el, add, btn, window.__lang));
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
        rs.appendChild(el('p', null, 'بيمسح اسمك وتقدمك وأخطاءك من المتصفح ده بس. لو داخل بحساب، البيانات على السيرفر بتفضل ولسه ممكن تنزل تاني بالمزامنة. للحذف النهائي من السيرفر استعمل زرار حذف الحساب.'));
        let armed = false;
        const rb = btn('امسح كل حاجة', 'secondary', () => {
            if (!armed) { armed = true; rb.textContent = 'اضغط تاني للتأكيد'; rb.classList.add('danger'); return; }
            try { localStorage.removeItem(OLD_KEY); localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
            P = normalize({}); save(); route();
        });
        rs.appendChild(rb);
        side.appendChild(rs);
        const tp = panel('جولة تعريفية');
        tp.appendChild(el('p', null, 'عايز تشوف الشرح السريع للموقع تاني؟'));
        tp.appendChild(btn('افتح الجولة', 'secondary', () => showTour()));
        side.appendChild(tp);
        const about = panel('عن بياناتك');
        about.appendChild(el('p', null, 'الموقع مجاني والدخول بحساب. اسمك ونتايجك وأيام مذاكرتك بتتحفظ في متصفحك، وبتتخزن كمان على سيرفرات جوجل (Firebase) مع إيميلك لو الإيميل متأكد. التفاصيل في صفحة الخصوصية. مسح التقدم من هنا بيمسح اللي على المتصفح بس، وحذف الحساب بيمسح اللي على السيرفر.'));
        about.appendChild(el('p', 'caption', 'زراير الاستماع بتشغّل تسجيلات إنجليزي بصوت رجل (صوت مُولَّد بالحاسوب، مش ناطق أصلي، فاعتبره مرجع تقريبي). التسجيلات جزء من الموقع وبتتحمل منه. لو جملة مالهاش تسجيل، المتصفح ممكن يستخدم صوت جهازك، وده ممكن يعتمد على جهازك أو مزود الصوت بتاعه.'));
        side.appendChild(about);
        return cols(main, side);
    }

    /* ---------- router ---------- */
    const navLinks = Array.from(document.querySelectorAll('[data-nav]'));
    (function shortNav() {
        const short = { practice: 'تدريب', progress: 'حسابي' };
        const mq = window.matchMedia ? window.matchMedia('(max-width: 620px)') : null;
        function apply() {
            navLinks.forEach((a) => {
                if (!a.dataset.full) a.dataset.full = a.textContent;
                const s = mq && mq.matches && short[a.dataset.nav];
                a.textContent = s || a.dataset.full;
                if (s) a.setAttribute('aria-label', a.dataset.full); else a.removeAttribute('aria-label');
            });
        }
        apply();
        if (mq) { if (mq.addEventListener) mq.addEventListener('change', apply); else if (mq.addListener) mq.addListener(apply); }
    })();
    /* ---------- first-entry quick tour: consecutive screenshots with Next ---------- */
    const TOUR = [
        { img: 'tour/1.jpg', t: 'أهلاً بيك!', d: 'الموقع بيعلّمك إنجليزي من مواقف حقيقية. هتشوف دلوقتي في ٦ صور سريعة إنت هتعمل إيه وفين. الشريط اللي فوق فيه كل الأقسام.' },
        { img: 'tour/2.jpg', t: 'الدروس: ١٢٦ موقف', d: 'من قسم «الدروس» اختار موقف (مطار، فندق، مطعم...) وابدأ بالترتيب. كل درس بيتحسب ومحفوظ ليك.' },
        { img: 'tour/3.jpg', t: 'جوه الدرس', d: 'بتقرأ الموقف وتسمع الشخص اللي قدامك، وبعدين تختار ردك من ٣ اختيارات. التصحيح بيظهر فورًا مع السبب بالعربي.' },
        { img: 'tour/4.jpg', t: 'التدريب والاختبارات', d: 'من «تدريب واختبارات» جرّب أسئلة متنوعة، تمرين السمع، ترتيب الجملة، وراجع أخطاءك. وفيه اختبار لكل درس.' },
        { img: 'tour/5.jpg', t: 'القاموس', d: 'في «القاموس» كل الجمل الأساسية في مكان واحد، تقدر تسمع نطقها بالعادي أو بالبطيء.' },
        { img: 'tour/6.jpg', t: 'حسابي وتقدمي', d: 'هنا بتشوف نتيجتك وأيام مذاكرتك، وتقدر تغيّر اسمك أو تحذف حسابك وبياناتك. تقدر تفتح الجولة دي تاني من نفس الصفحة.' },
    ];
    function tourKey() { const u = window.LangCloud && window.LangCloud.uid && window.LangCloud.uid(); return u ? 'lang-tour-v1-' + u : null; }
    function tourSeen() { const k = tourKey(); if (!k) return true; if (!(window.LangCloud.isNewSignup && window.LangCloud.isNewSignup())) return true; try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } }
    function tourMark() { const k = tourKey(); if (k) { try { localStorage.setItem(k, '1'); } catch (e) { /* ignore */ } } }
    function showTour() {
        if (document.getElementById('tour')) return;
        const prevFocus = document.activeElement;
        let i = 0;
        const ov = el('div', 'tour'); ov.id = 'tour'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'جولة سريعة في الموقع');
        const card = el('div', 'tour-card');
        ov.appendChild(card);
        function close() { tourMark(); ov.remove(); document.body.classList.remove('tour-open'); if (prevFocus && prevFocus.focus) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ } } }
        function draw() {
            const s = TOUR[i], last = i === TOUR.length - 1;
            card.innerHTML = '';
            const top = el('div', 'tour-top');
            add(top, el('span', 'tour-count', (i + 1) + ' من ' + TOUR.length));
            if (!last) add(top, btn('تخطي', 'ghost', close));
            const fig = el('div', 'tour-fig');
            const im = el('img'); im.src = s.img; im.alt = 'صورة من الموقع: ' + s.t; im.width = 390; im.height = 700; im.decoding = 'async';
            fig.appendChild(im);
            const h = el('h2', 'tour-title', s.t); h.tabIndex = -1;
            const dots = el('div', 'tour-dots'); dots.setAttribute('aria-hidden', 'true');
            TOUR.forEach((_, k) => dots.appendChild(el('span', k === i ? 'on' : '')));
            const row = el('div', 'actions tour-actions');
            if (i > 0) add(row, btn('السابق', 'secondary', () => { i--; draw(); }));
            const nx = btn(last ? 'ابدأ الدروس' : 'التالي', 'primary', () => { if (last) { close(); } else { i++; draw(); } });
            add(row, nx);
            add(card, top, fig, h, el('p', 'tour-text', s.d), dots, row);
            setTimeout(() => nx.focus({ preventScroll: true }), 0);
        }
        ov.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { close(); return; }
            if (e.key === 'Tab') {
                const f = Array.from(ov.querySelectorAll('button')).filter((b) => !b.disabled);
                if (!f.length) return;
                const a = f.indexOf(document.activeElement);
                if (e.shiftKey && a <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
                else if (!e.shiftKey && a === f.length - 1) { e.preventDefault(); f[0].focus(); }
            }
        });
        document.body.classList.add('tour-open');
        document.body.appendChild(ov);
        draw();
    }
    window.__showTour = showTour;

    function gateView() {
        document.body.classList.add('is-gated');
        app.innerHTML = '';
        const st = window.LangCloud.state();
        app.appendChild(pageHead('أهلاً بيك في اتعلم إنجليزي بالمواقف', st === 'out' ? 'سجّل دخولك أو اعمل حساب جديد عشان تبدأ.' : ''));
        const wrap = el('div', 'narrow gate-card');
        if (st === 'out') {
            wrap.appendChild(window.LangCloud.panel(el, add, btn, window.__lang, { title: 'تسجيل الدخول', brief: true }));
        } else if (st === 'error') {
            const box = el('section', 'group card-box');
            add(box, el('p', null, 'مقدرناش نتأكد من حسابك. اتأكد إن النت شغال وجرب تاني.'), btn('جرب تاني', 'primary', () => window.LangCloud.retry()));
            wrap.appendChild(box);
        } else {
            const box = el('section', 'group card-box'); box.setAttribute('role', 'status');
            add(box, el('p', null, 'ثانية واحدة، بنتأكد من حسابك...'));
            wrap.appendChild(box);
        }
        if (st === 'out') {
            const pts = el('ul', 'gate-points');
            ['مواقف حقيقية من الحياة اليومية', 'تصحيح فوري بالعربي مع السبب', 'مجاني ومن غير إعلانات'].forEach(t => pts.appendChild(el('li', null, t)));
            wrap.appendChild(pts);
        }
        app.appendChild(wrap);
        const t = document.getElementById('page-title'); if (t) t.focus({ preventScroll: true });
    }
    function route() {
        Speech.stop();
        if (window.LangCloud && window.LangCloud.state() !== 'in') { gateView(); return; }
        document.body.classList.remove('is-gated');
        if (!tourSeen()) setTimeout(showTour, 0);
        const hash = location.hash.replace(/^#\/?/, '');
        let section = 'home';
        if (hash.startsWith('lesson-')) { section = 'lessons'; lessonView(parseInt(hash.slice(7), 10)); }
        else if (hash === 'lessons') { section = 'lessons'; lessonsView(); }
        else if (hash === 'practice') { section = 'practice'; practiceView(); }
        else if (hash === 'tests') { section = 'practice'; practiceView(); const t = document.getElementById('tests-sec'); if (t) t.scrollIntoView(); return finishRoute(section, true); }
        else if (hash === 'mistakes') { section = 'practice'; mistakesView(); }
        else if (hash === 'build') { section = 'practice'; buildView(); }
        else if (hash === 'listen') { section = 'practice'; listenView(); }
        else if (hash === 'fill') { section = 'practice'; fillView(); }
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
    window.__lang = { tour: () => { if (!tourSeen()) showTour(); }, get: () => P, set: (p) => { P = normalize(p); Store.write(P); }, normalize: normalize, refresh: () => { if (/^#\/(progress|profile)/.test(location.hash)) route(); } };
    if (window.LangCloud) { window.LangCloud.onAuth(() => route()); window.LangCloud.init(window.__lang); }
    route();
})();
