// Слой данных: Supabase, а если ключи не заданы — демо-режим в localStorage.
(function () {
  const C = window.SITE_CONFIG || {};
  // чиним типичные ошибки в адресе проекта: слэш в конце, /rest/v1, адрес из панели управления
  function cleanUrl(u) {
    u = String(u || "").trim();
    const m = u.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
    if (m) return "https://" + m[1] + ".supabase.co";
    return u.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  }
  const SB_URL = cleanUrl(C.SUPABASE_URL);
  const SB_KEY = String(C.SUPABASE_ANON_KEY || "").trim();
  const live = !!(SB_URL && SB_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(SB_URL, SB_KEY) : null;

  const DEMO_KEY = "lora_demo_db_v8";
  const TYPES = ["character", "style", "concept", "other"];
  const AUD = ["all", "alt"];
  const norm = (c) => String(c || "").trim().toUpperCase();
  const rndCode = () => "LORA-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
  const byUpdated = (a, b) => new Date(b.updated_at) - new Date(a.updated_at);
  const byCreated = (a, b) => new Date(b.created_at) - new Date(a.created_at);
  const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const aud = (v) => (v === "alt" ? "alt" : "all");
  const boardRow = (r) => ({ id: r.id, character_name: r.character_name, source: r.source, status: r.status, note: r.note, created_at: r.created_at, updated_at: r.updated_at, lora_type: r.lora_type, audience: aud(r.audience) });

  function voterId() {
    let v = lsGet("lora_voter");
    if (!v) { v = uuid(); lsSet("lora_voter", v); }
    return v;
  }

  // ---------- неделя (для лимита заявок): календарная, с понедельника 00:00 UTC ----------
  function weekInfo() {
    const n = new Date();
    const dow = (n.getUTCDay() + 6) % 7;
    const start = new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() - dow));
    return { start, reset: new Date(start.getTime() + 7 * 864e5) };
  }
  const fmtWhen = (iso) => new Date(iso).toLocaleString("ru-RU", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const demoPid = (voter, key) => {
    let h = 5381; const t = String(voter) + String(key);
    for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
    return h.toString(16).padStart(8, "0").slice(0, 7);
  };
  const demoLimit = (d) => { const n = parseInt(d.settings && d.settings.request_limit, 10); return Number.isFinite(n) ? n : 3; };
  const BAD_WORDS_NAME = /(catatonic|^автор$|^admin$|^админ$)/i;

  // сообщения сервера -> понятный текст
  function qaErr(error) {
    const m = String((error && error.message) || error || "");
    let r = m.match(/banned\|([^|]*)\|([\s\S]*)/);
    if (r) {
      const e = new Error("Ты заблокирован(а) " + (r[1] === "forever" ? "навсегда" : "до " + fmtWhen(r[1])) + (r[2] ? ". Причина: " + r[2] : "") + ".");
      e.banned = true; return e;
    }
    const map = {
      too_fast: "Не так быстро: подожди 15 секунд между сообщениями.",
      rate_limit: "Слишком много сообщений за последний час. Попробуй позже.",
      too_long: "Текст слишком длинный.",
      empty: "Напиши сообщение или добавь картинку.",
      need_subject: "Укажи тему вопроса.",
      name_reserved: "Этот ник занят, выбери другой.",
      thread_not_found: "Этот вопрос больше не существует.",
      not_allowed: "Не узнаю тебя. Войди заново, нажав на логотип.",
      locked: "Слишком много неверных попыток. Подожди 10 минут.",
      thread_full: "В этом вопросе уже слишком много ответов.",
      bad_image: "Картинка не загрузилась, попробуй ещё раз.",
      bad_voter: "Не получилось определить устройство. Обнови страницу."
    };
    for (const k in map) if (m.indexOf(k) >= 0) return new Error(map[k]);
    return error instanceof Error ? error : new Error(m);
  }

  // ---------- демо-данные ----------
  function placeholder(text, c1, c2) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="600" height="800" fill="url(#g)"/><text x="300" y="410" font-size="44" font-family="Georgia,serif" fill="#ffffff" fill-opacity=".85" text-anchor="middle">${text}</text></svg>`;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }
  function demoDb() {
    try {
      const d = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (d && d.requests) return d;
    } catch (e) {}
    const t = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const mk = (i, type, name, src, status, note, h) => ({
      id: "demo" + i, code: "LORA-DEMO000" + i, lora_type: type, character_name: name, source: src,
      requester: "", status, note, audience: "all", created_at: t(h + 24), updated_at: t(h)
    });
    const fake = (n) => Array.from({ length: n }, (_, i) => "seed-" + i);
    const im = (id, post, text, c1, c2, cap, a, pos) => ({ id, post_id: post, image_url: placeholder(text, c1, c2), caption: cap, position: pos, audience: a });
    const d = {
      requests: [
        mk(1, "character", "Linnea", "Genshin Impact", "done", "", 200),
        mk(2, "character", "Odette", "Genshin Impact", "done", "", 150),
        mk(3, "character", "Ronova", "Genshin Impact", "in_progress", "Задержка: докупаю время GPU, обучение продолжится завтра", 6),
        mk(4, "style", "Акварельный стиль 90-х", "референсы: примеры в ТГ", "in_progress", "", 20),
        mk(5, "concept", "Витилиго", "пятна депигментации на коже", "requested", "", 40),
        mk(6, "character", "Alyosha", "Genshin Impact", "requested", "", 12),
        { ...mk(7, "style", "Секретный стиль (бета)", "референсы только для своих", "requested", "", 5), audience: "alt" }
      ],
      posts: [
        { id: "p1", title: "Linnea", lora_type: "character", audience: "all", description: "Персонаж из Genshin Impact.\nТриггер: linneagenshin, вес 0.8–1.0.", alt_note: "Для своих: рекомендую Euler a, 28 шагов, CFG 5.", civitai_url: "https://civitai.com/", created_at: t(120) },
        { id: "p2", title: "Odette", lora_type: "character", audience: "all", description: "Хорошо работает в портретах и в полный рост.", alt_note: "", civitai_url: "https://civitai.com/", created_at: t(60) },
        { id: "p3", title: "Мягкий свет и тени", lora_type: "concept", audience: "all", description: "Концепт: объёмный свет и глубина кадра.", alt_note: "", civitai_url: "", created_at: t(30) },
        { id: "p4", title: "Бета: ранний чекпойнт Mitya", lora_type: "character", audience: "alt", description: "Закрытый пост: ранний тест, до публичного релиза.", alt_note: "", civitai_url: "", created_at: t(10) }
      ],
      post_images: [
        im("i1", "p1", "Linnea · портрет", "#46506b", "#1c2236", "Портрет", "all", 0),
        im("i2", "p1", "только для своих", "#1d4fcf", "#0b1f55", "Промпт и настройки (видно только своим)", "alt", 1),
        im("i3", "p2", "Odette", "#6b4650", "#2a1620", "В полный рост", "all", 0),
        im("i4", "p4", "Mitya · бета", "#2f6fe0", "#0a1a40", "Ранний тест", "alt", 0)
      ],
      hearts: { p1: fake(12), p2: fake(5), p3: fake(8), p4: fake(3) },
      settings: { alt_password: "secret1", request_limit: 3, qa_premod: false },
      gallery: [
        { id: "g1", post_id: "p1", image_url: placeholder("Linnea · фан-арт 1", "#46506b", "#1c2236"), caption: "Первый тест от подписчицы", uploader: "", status: "approved", created_at: t(40) },
        { id: "g2", post_id: "p1", image_url: placeholder("Linnea · фан-арт 2", "#6b4650", "#2a1620"), caption: "С другим костюмом", uploader: "", status: "approved", created_at: t(30) },
        { id: "g3", post_id: "p2", image_url: placeholder("Odette · пример", "#4a6b50", "#14261a"), caption: "", uploader: "", status: "approved", created_at: t(20) },
        { id: "g4", post_id: "p1", image_url: placeholder("ждёт проверки", "#6b6446", "#262214"), caption: "Новая картинка на проверке", uploader: "@guest", status: "pending", created_at: t(2) },
        { id: "g5", post_id: "p4", image_url: placeholder("бета · скрытый пост", "#2f6fe0", "#0a1a40"), caption: "Галерея скрытого поста", uploader: "", status: "approved", created_at: t(6) }
      ],
      ghearts: { g1: fake(7), g2: fake(2) },
      qa: (() => {
        const mkq = (num, thread, name, subject, body, img, voter, h, admin) => ({
          id: "q" + num, num, thread_id: thread, name, subject, body, image_url: img, voter_id: voter, ip_hash: "",
          poster_id: demoPid(voter, thread || ("q" + num)), is_admin: !!admin, status: "approved", audience: "all",
          bumped_at: t(h), created_at: t(h)
        });
        return [
          mkq(1, null, "Аня", "Как запустить LoRA в ComfyUI?", "Скачала файл с Civitai, куда его класть? Триггер-слово писать в промпт?\nНа картинке то, что у меня получается.", placeholder("вопрос Ани", "#46506b", "#1c2236"), "seed-a", 30),
          mkq(2, "q1", "", null, ">>1\nПоложи файл в папку models/loras и подключи нодой Load LoRA.\n>триггер-слово обязательно, да", null, "seed-b", 28),
          mkq(3, "q1", "Mitya", null, "Вес лучше начинать с 0.8, дальше по вкусу.", null, "seed-c", 26),
          mkq(4, null, "", "Какой вес ставить для стилей?", "Стили сильно «перебивают» персонажей. С какого веса начинать?", null, "seed-d", 8),
          mkq(5, "q4", "CatatonicPsychosis", null, "Для стилей обычно хватает 0.5–0.7.", null, "admin", 5, true),
          { ...mkq(6, null, "", "Секретный вопрос (бета)", "Этот вопрос видят только свои.", null, "seed-e", 3), audience: "alt" },
          { ...mkq(7, "q6", "", null, "И ответ тоже только для своих.", null, "seed-f", 2), audience: "alt" }
        ];
      })(),
      qaNum: 7,
      qaBans: [],
      qaWarn: []
    };
    localStorage.setItem(DEMO_KEY, JSON.stringify(d));
    return d;
  }
  function demoSave(d) {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(d)); }
    catch (e) { throw new Error("Хранилище демо-режима переполнено"); }
  }
  const fileToDataUrl = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

  // сжать картинку перед загрузкой: JPEG, ограничение по длинной стороне и размеру файла (до ~2.8 МБ)
  async function prepareImage(file, maxSide, startQuality) {
    if (!file || !/^image\//.test(file.type)) throw new Error("Это не картинка");
    let bmp;
    try { bmp = await createImageBitmap(file); }
    catch (e) { throw new Error("Не удалось прочитать картинку: формат не поддерживается"); }
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    let q = startQuality, blob = null;
    for (let i = 0; i < 6; i++) {
      blob = await new Promise((res) => cv.toBlob(res, "image/jpeg", q));
      if (blob && blob.size <= 2.8 * 1024 * 1024) break;
      q -= 0.12;
    }
    if (!blob || blob.size > 2.9 * 1024 * 1024) throw new Error("Картинка слишком тяжёлая, уменьши её");
    return blob;
  }
  const galUrl = (path) => sb.storage.from("gallery").getPublicUrl(path).data.publicUrl;
  const mapGal = (g) => ({ ...g, image_url: g.image_url || galUrl(g.image_path), hearts: g.hearts || 0 });
  const qaUrl = (path) => sb.storage.from("qa").getPublicUrl(path).data.publicUrl;
  const mapQa = (p) => ({ ...p, image_url: p.image_path ? qaUrl(p.image_path) : null });
  const qaPublic = (p) => ({ id: p.id, num: p.num, thread_id: p.thread_id, name: p.name, subject: p.subject, body: p.body, image_url: p.image_url || null,
    poster_id: p.poster_id, is_admin: p.is_admin, created_at: p.created_at, bumped_at: p.bumped_at, audience: p.audience === "alt" ? "alt" : "all" });
  const newest = (a, b) => new Date(b.created_at) - new Date(a.created_at);

  // загрузка файла: Supabase Storage (длинное случайное имя) или data-URL в демо-режиме
  async function uploadFile(file) {
    if (!live) return fileToDataUrl(file);
    const ext = ((file.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") || "png").slice(0, 5);
    const path = uuid() + "." + ext;
    const up = await sb.storage.from("previews").upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    return sb.storage.from("previews").getPublicUrl(path).data.publicUrl;
  }
  async function removeStored(url) {
    if (!live) return;
    const m = String(url).split("/previews/")[1];
    if (m) await sb.storage.from("previews").remove([decodeURIComponent(m)]);
  }

  // собрать посты с картинками
  function assemble(posts, images) {
    const by = {};
    images.forEach((im) => { (by[im.post_id] = by[im.post_id] || []).push(im); });
    return posts.map((p) => ({
      ...p,
      audience: aud(p.audience),
      hearts: p.hearts || 0,
      images: (by[p.id] || []).map((i) => ({ ...i, audience: aud(i.audience) })).sort((a, b) => a.position - b.position)
    }));
  }

  const api = {
    live, TYPES, voterId,

    // ---------- публичная часть ----------
    async board() {
      if (!live) return demoDb().requests.filter((r) => r.status !== "cancelled" && aud(r.audience) === "all").map(boardRow).sort(byUpdated);
      const { data, error } = await sb.from("board").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    // таблица закрытой версии: все заявки, включая секретные; неверный пароль -> null
    async altBoard(password) {
      if (!live) {
        const d = demoDb();
        if (!password || password !== (d.settings && d.settings.alt_password)) return null;
        return d.requests.filter((r) => r.status !== "cancelled").map(boardRow).sort(byUpdated);
      }
      const { data, error } = await sb.rpc("alt_board", { p_password: password });
      if (error) {
        if (/locked/.test(error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
        throw error;
      }
      return data == null ? null : data.map((r) => ({ ...r, audience: aud(r.audience) })).sort(byUpdated);
    },
    // обычные посты: ничего закрытого
    async posts() {
      if (!live) {
        const d = demoDb();
        const posts = d.posts.filter((p) => aud(p.audience) === "all").map((p) => ({
          id: p.id, title: p.title, lora_type: p.lora_type, description: p.description,
          civitai_url: p.civitai_url, created_at: p.created_at, hearts: (d.hearts[p.id] || []).length
        }));
        const imgs = d.post_images.filter((i) => aud(i.audience) === "all");
        return assemble(posts, imgs).sort(byCreated);
      }
      const [p, i] = await Promise.all([
        sb.from("posts_public").select("*").order("created_at", { ascending: false }),
        sb.from("post_images_public").select("*").order("position", { ascending: true })
      ]);
      if (p.error) throw p.error;
      if (i.error) throw i.error;
      return assemble(p.data, i.data);
    },
    // закрытая версия: все посты, если пароль верный; неверный пароль -> null
    async altPosts(password) {
      if (!live) {
        const d = demoDb();
        if (!password || password !== (d.settings && d.settings.alt_password)) return null;
        const posts = d.posts.map((p) => ({ ...p, hearts: (d.hearts[p.id] || []).length }));
        return assemble(posts, d.post_images).sort(byCreated);
      }
      const { data, error } = await sb.rpc("alt_content", { p_password: password });
      if (error) {
        if (/locked/.test(error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
        throw error;
      }
      if (data == null) return null;
      return data.map((p) => ({
        ...p, audience: aud(p.audience), hearts: p.hearts || 0,
        images: (p.images || []).map((i) => ({ ...i, audience: aud(i.audience) })).sort((a, b) => a.position - b.position)
      }));
    },
    async myHearts() {
      if (!live) {
        const d = demoDb(), v = voterId();
        return Object.keys(d.hearts).filter((id) => d.hearts[id].includes(v));
      }
      const { data, error } = await sb.rpc("my_hearts", { p_voter: voterId() });
      if (error) throw error;
      return data || [];
    },
    async toggleHeart(postId) {
      if (!live) {
        const d = demoDb(), v = voterId();
        const arr = (d.hearts[postId] = d.hearts[postId] || []);
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        demoSave(d);
        return { hearted: i < 0, hearts: arr.length };
      }
      const { data, error } = await sb.rpc("toggle_heart", { p_post: postId, p_voter: voterId() });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      return { hearted: !!r.hearted, hearts: r.hearts };
    },
    // ---------- галерея LoRA ----------
    prepareImage,
    async gallery(postId, altPassword) {
      if (!live) {
        const d = demoDb();
        const post = d.posts.find((p) => p.id === postId);
        if (!post) return [];
        if (aud(post.audience) === "alt" && altPassword !== (d.settings && d.settings.alt_password)) return [];
        return d.gallery.filter((g) => g.post_id === postId && g.status === "approved")
          .map((g) => ({ id: g.id, post_id: g.post_id, image_url: g.image_url, caption: g.caption, created_at: g.created_at, hearts: (d.ghearts[g.id] || []).length }))
          .sort(newest);
      }
      if (altPassword) {
        const r = await sb.rpc("alt_gallery", { p_password: altPassword, p_post: postId });
        if (r.error) {
          if (/locked/.test(r.error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
          throw r.error;
        }
        if (r.data != null) return r.data.map(mapGal).sort(newest);
      }
      const { data, error } = await sb.from("gallery_public").select("*").eq("post_id", postId).order("created_at", { ascending: false });
      if (error) throw error;
      return data.map(mapGal);
    },
    async myGalleryHearts(postId) {
      if (!live) {
        const d = demoDb(), v = voterId();
        const ids = new Set(d.gallery.filter((g) => g.post_id === postId).map((g) => g.id));
        return Object.keys(d.ghearts).filter((id) => ids.has(id) && d.ghearts[id].includes(v));
      }
      const { data, error } = await sb.rpc("my_gallery_hearts", { p_voter: voterId(), p_post: postId });
      if (error) throw error;
      return data || [];
    },
    async toggleGalleryHeart(imageId) {
      if (!live) {
        const d = demoDb(), v = voterId();
        const arr = (d.ghearts[imageId] = d.ghearts[imageId] || []);
        const i = arr.indexOf(v);
        if (i >= 0) arr.splice(i, 1); else arr.push(v);
        demoSave(d);
        return { hearted: i < 0, hearts: arr.length };
      }
      const { data, error } = await sb.rpc("toggle_gallery_heart", { p_image: imageId, p_voter: voterId() });
      if (error) throw error;
      const r = Array.isArray(data) ? data[0] : data;
      return { hearted: !!r.hearted, hearts: r.hearts };
    },
    // предложить картинку в галерею поста (уйдёт на проверку); false = неверный пароль для скрытого поста
    async submitGalleryImage(postId, file, caption, uploader, altPassword) {
      if (!live) {
        const d = demoDb();
        const post = d.posts.find((p) => p.id === postId);
        if (!post) throw new Error("Пост не найден");
        if (aud(post.audience) === "alt" && altPassword !== (d.settings && d.settings.alt_password)) return false;
        const blob = await prepareImage(file, 900, 0.8);
        d.gallery.push({ id: uuid(), post_id: postId, image_url: await fileToDataUrl(blob), caption: caption || null, uploader: uploader || null, status: "pending", created_at: new Date().toISOString() });
        demoSave(d);
        return true;
      }
      const blob = await prepareImage(file, 1600, 0.86);
      const path = uuid() + ".jpg";
      const up = await sb.storage.from("gallery").upload(path, blob, { contentType: "image/jpeg" });
      if (up.error) {
        if (/row-level security|policy|403|Unauthorized/i.test(up.error.message || "")) throw new Error("Сейчас загружают слишком много картинок. Попробуй позже.");
        throw up.error;
      }
      const { data, error } = await sb.rpc("submit_gallery_image", { p_post: postId, p_path: path, p_caption: caption || null, p_uploader: uploader || null, p_password: altPassword || null });
      if (error) {
        if (/rate_limit/.test(error.message)) throw new Error("Слишком много картинок ждут проверки. Попробуй позже.");
        if (/locked/.test(error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
        if (/not_found/.test(error.message)) throw new Error("Пост не найден");
        throw error;
      }
      return !!data;
    },

    // altPassword: если передан, заявка отправляется как секретная (видна только закрытой версии); неверный пароль -> null
    async submit(type, character, source, requester, altPassword) {
      if (!TYPES.includes(type)) type = "character";
      const secret = !!altPassword;
      if (!live) {
        const d = demoDb();
        if (secret && altPassword !== (d.settings && d.settings.alt_password)) return null;
        const w = weekInfo();
        const used = d.requests.filter((r) => r.voter_id === voterId() && new Date(r.created_at) >= w.start).length;
        if (used >= demoLimit(d)) throw new Error("Лимит заявок на этой неделе исчерпан. Лимит сбросится: " + fmtWhen(w.reset) + ".");
        const code = rndCode();
        const now = new Date().toISOString();
        d.requests.push({
          id: uuid(), voter_id: voterId(), code, lora_type: type, character_name: character, source, requester,
          status: "requested", note: "", audience: secret ? "alt" : "all", created_at: now, updated_at: now
        });
        demoSave(d);
        return code;
      }
      const { data, error } = secret
        ? await sb.rpc("submit_request_alt", { p_password: altPassword, p_type: type, p_character: character, p_source: source, p_requester: requester, p_voter: voterId() })
        : await sb.rpc("submit_request", { p_type: type, p_character: character, p_source: source, p_requester: requester, p_voter: voterId() });
      if (error) {
        const wl = String(error.message || "").match(/weekly_limit\|(\S+)/);
        if (wl) throw new Error("Лимит заявок на этой неделе исчерпан. Лимит сбросится: " + fmtWhen(wl[1]) + ".");
        if (/rate_limit/.test(error.message)) throw new Error("Слишком много заявок за последний час. Попробуй позже.");
        if (/locked/.test(error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
        throw error;
      }
      return data;
    },
    // сколько заявок осталось на этой неделе: { limit, used, reset }
    async quota() {
      const v = voterId();
      if (!live) {
        const d = demoDb(), w = weekInfo();
        const used = d.requests.filter((r) => r.voter_id === v && new Date(r.created_at) >= w.start).length;
        return { limit: demoLimit(d), used, reset: w.reset.toISOString() };
      }
      const { data, error } = await sb.rpc("request_quota", { p_voter: v });
      if (error) throw error;
      return data;
    },
    fmtWhen,
    async check(code) {
      if (!live) return demoDb().requests.find((r) => r.code === norm(code)) || null;
      const { data, error } = await sb.rpc("check_request", { p_code: code });
      if (error) throw error;
      return (data && data[0]) || null;
    },
    async cancel(code) {
      if (!live) {
        const d = demoDb();
        const r = d.requests.find((x) => x.code === norm(code));
        if (!r) return "not_found";
        if (r.status !== "requested") return "not_cancellable";
        r.status = "cancelled";
        r.updated_at = new Date().toISOString();
        demoSave(d);
        return "ok";
      }
      const { data, error } = await sb.rpc("cancel_request", { p_code: code });
      if (error) throw error;
      return data;
    },

    // ---------- Вопрос-ответ ----------
    async qaThreads() {
      if (!live) {
        const d = demoDb();
        return d.qa.filter((p) => !p.thread_id && p.status === "approved" && p.audience !== "alt")
          .map((p) => ({ ...qaPublic(p), reply_count: d.qa.filter((r) => r.thread_id === p.id && r.status === "approved" && r.audience !== "alt").length }))
          .sort((a, b) => new Date(b.bumped_at) - new Date(a.bumped_at));
      }
      const { data, error } = await sb.from("qa_public").select("*").is("thread_id", null).order("bumped_at", { ascending: false }).limit(60);
      if (error) throw error;
      return (data || []).map(mapQa);
    },
    async qaThread(id) {
      if (!live) {
        const d = demoDb();
        const op = d.qa.find((p) => p.id === id && !p.thread_id && p.status === "approved" && p.audience !== "alt");
        if (!op) return null;
        const replies = d.qa.filter((r) => r.thread_id === id && r.status === "approved" && r.audience !== "alt").sort((a, b) => a.num - b.num).map(qaPublic);
        return { op: qaPublic(op), replies };
      }
      const [o, r] = await Promise.all([
        sb.from("qa_public").select("*").eq("id", id).is("thread_id", null).maybeSingle(),
        sb.from("qa_public").select("*").eq("thread_id", id).order("created_at", { ascending: true }).limit(400)
      ]);
      if (o.error) throw o.error;
      if (r.error) throw r.error;
      return o.data ? { op: mapQa(o.data), replies: (r.data || []).map(mapQa) } : null;
    },
    // закрытая версия: все вопросы, включая секретные. Неверный пароль -> null
    async altQaThreads(password) {
      if (!live) {
        const d = demoDb();
        if (password !== (d.settings && d.settings.alt_password)) return null;
        return d.qa.filter((p) => !p.thread_id && p.status === "approved")
          .map((p) => ({ ...qaPublic(p), reply_count: d.qa.filter((r) => r.thread_id === p.id && r.status === "approved").length }))
          .sort((a, b) => new Date(b.bumped_at) - new Date(a.bumped_at));
      }
      const { data, error } = await sb.rpc("alt_qa_threads", { p_password: password });
      if (error) throw error;
      return data ? data.map(mapQa) : null;
    },
    async altQaThread(password, id) {
      if (!live) {
        const d = demoDb();
        if (password !== (d.settings && d.settings.alt_password)) return null;
        const op = d.qa.find((p) => p.id === id && !p.thread_id && p.status === "approved");
        return { op: op ? qaPublic(op) : null, replies: d.qa.filter((r) => r.thread_id === id && r.status === "approved").sort((a, b) => a.num - b.num).map(qaPublic) };
      }
      const { data, error } = await sb.rpc("alt_qa_thread", { p_password: password, p_id: id });
      if (error) throw error;
      if (!data) return null;
      return { op: data.op ? mapQa(data.op) : null, replies: (data.replies || []).map(mapQa) };
    },
    // thread = id вопроса или null для нового вопроса; secret + password = секретный вопрос; возвращает { num, pending }
    async qaPost({ thread, name, subject, body, file, secret, password }) {
      const v = voterId();
      if (!live) {
        const d = demoDb();
        const ban = d.qaBans.find((b) => b.kind === "voter" && b.value === v && (!b.until || new Date(b.until) > new Date()));
        if (ban) throw qaErr(new Error("banned|" + (ban.until || "forever") + "|" + (ban.reason || "")));
        name = String(name || "").trim(); subject = String(subject || "").trim(); body = String(body || "").trim();
        if (name.length > 40 || subject.length > 100 || body.length > 3000) throw qaErr(new Error("too_long"));
        if (!body && !file) throw qaErr(new Error("empty"));
        if (!thread && !subject) throw qaErr(new Error("need_subject"));
        if (name && BAD_WORDS_NAME.test(name)) throw qaErr(new Error("name_reserved"));
        const parent = thread ? d.qa.find((p) => p.id === thread && !p.thread_id && p.status === "approved") : null;
        if (thread && !parent) throw qaErr(new Error("thread_not_found"));
        const aud = parent ? (parent.audience === "alt" ? "alt" : "all") : (secret ? "alt" : "all");
        if (aud === "alt" && password !== (d.settings && d.settings.alt_password)) throw new Error("Не узнаю тебя. Войди заново, нажав на логотип.");
        const img = file ? await fileToDataUrl(await prepareImage(file, 900, 0.8)) : null;
        const num = (d.qaNum = (d.qaNum || 0) + 1);
        const id = uuid();
        const status = d.settings && d.settings.qa_premod ? "pending" : "approved";
        const now = new Date().toISOString();
        d.qa.push({ id, num, thread_id: thread || null, name: name || null, subject: thread ? null : subject, body, image_url: img,
          voter_id: v, ip_hash: "", poster_id: demoPid(v, thread || id), is_admin: false, status, audience: aud, bumped_at: now, created_at: now });
        if (thread && status === "approved") d.qa.find((p) => p.id === thread).bumped_at = now;
        demoSave(d);
        return { num, pending: status === "pending" };
      }
      let path = null;
      if (file) {
        const blob = await prepareImage(file, 1600, 0.85);
        path = uuid() + ".jpg";
        const up = await sb.storage.from("qa").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) {
          if (/row-level security|policy|403|Unauthorized/i.test(up.error.message || "")) throw new Error("Сейчас загружают слишком много картинок. Попробуй позже.");
          throw up.error;
        }
      }
      const { data, error } = await sb.rpc("qa_post", { p_voter: v, p_thread: thread || null, p_name: name || null, p_subject: subject || null, p_body: body || "", p_image: path, p_secret: !!secret, p_password: password || null });
      if (error) {
        if (path) { try { await sb.storage.from("qa").remove([path]); } catch (e) {} }
        throw qaErr(error);
      }
      return data;
    },
    // бан и непрочитанные предупреждения этого устройства
    async qaStatus() {
      const v = voterId();
      if (!live) {
        const d = demoDb();
        const ban = d.qaBans.find((b) => b.kind === "voter" && b.value === v && (!b.until || new Date(b.until) > new Date()));
        return { banned: !!ban, until: ban ? (ban.until || "forever") : null, reason: ban ? ban.reason : null,
          warnings: d.qaWarn.filter((w) => w.voter_id === v && !w.seen_at).map((w) => ({ id: w.id, text: w.text, post_num: w.post_num, created_at: w.created_at })) };
      }
      const { data, error } = await sb.rpc("qa_status", { p_voter: v });
      if (error) throw error;
      return data;
    },
    async qaAck() {
      const v = voterId();
      if (!live) {
        const d = demoDb();
        d.qaWarn.forEach((w) => { if (w.voter_id === v && !w.seen_at) w.seen_at = new Date().toISOString(); });
        return demoSave(d);
      }
      const { error } = await sb.rpc("qa_ack", { p_voter: v });
      if (error) throw error;
    },
    qaVoter: voterId,

    // ---------- админка ----------
    admin: {
      async session() {
        if (!live) return true;
        const { data } = await sb.auth.getSession();
        return !!data.session;
      },
      async login(email, password) {
        if (!live) return;
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Не удалось войти: проверь почту и пароль");
      },
      async logout() { if (live) await sb.auth.signOut(); },

      // заявки
      async list() {
        if (!live) return demoDb().requests.slice().sort(byCreated);
        const { data, error } = await sb.from("requests").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data;
      },
      async update(id, patch) {
        if (!live) {
          const d = demoDb();
          const r = d.requests.find((x) => x.id === id);
          Object.assign(r, patch, { updated_at: new Date().toISOString() });
          return demoSave(d);
        }
        const { error } = await sb.from("requests").update(patch).eq("id", id);
        if (error) throw error;
      },
      async remove(id) {
        if (!live) {
          const d = demoDb();
          d.requests = d.requests.filter((x) => x.id !== id);
          return demoSave(d);
        }
        const { error } = await sb.from("requests").delete().eq("id", id);
        if (error) throw error;
      },
      async add({ lora_type, character_name, source, status, note, audience }) {
        const row = { code: rndCode(), lora_type, character_name, source: source || null, status, note: note || null, audience: aud(audience) };
        if (!live) {
          const d = demoDb();
          const now = new Date().toISOString();
          d.requests.push({ id: uuid(), requester: "", created_at: now, updated_at: now, ...row });
          return demoSave(d);
        }
        const { error } = await sb.from("requests").insert(row);
        if (error) throw error;
      },

      // все посты, включая закрытые (для админки)
      async posts() {
        if (!live) {
          const d = demoDb();
          const posts = d.posts.map((p) => ({ ...p, hearts: (d.hearts[p.id] || []).length }));
          return assemble(posts, d.post_images).sort(byCreated);
        }
        const [p, i, h] = await Promise.all([
          sb.from("posts").select("*").order("created_at", { ascending: false }),
          sb.from("post_images").select("*").order("position", { ascending: true }),
          sb.rpc("admin_hearts")
        ]);
        if (p.error) throw p.error;
        if (i.error) throw i.error;
        const cnt = {};
        ((h.data) || []).forEach((r) => { cnt[r.post_id] = r.cnt; });
        return assemble(p.data.map((x) => ({ ...x, hearts: cnt[x.id] || 0 })), i.data);
      },
      async postCreate(post, items) {
        // post: {title, lora_type, description, civitai_url, audience, alt_note}; items: [{file, caption, audience}]
        const row = {
          title: post.title, lora_type: post.lora_type, audience: aud(post.audience),
          description: post.description || null, alt_note: post.alt_note || null, civitai_url: post.civitai_url || null
        };
        if (!live) {
          const d = demoDb();
          const id = uuid();
          d.posts.push({ id, created_at: new Date().toISOString(), ...row });
          for (let i = 0; i < items.length; i++) {
            d.post_images.push({ id: uuid(), post_id: id, image_url: await fileToDataUrl(items[i].file), caption: items[i].caption || null, position: i, audience: aud(items[i].audience) });
          }
          return demoSave(d);
        }
        const ins = await sb.from("posts").insert(row).select("id").single();
        if (ins.error) throw ins.error;
        const id = ins.data.id;
        const uploaded = [];
        try {
          for (let i = 0; i < items.length; i++) {
            const url = await uploadFile(items[i].file);
            uploaded.push(url);
            const r = await sb.from("post_images").insert({ post_id: id, image_url: url, caption: items[i].caption || null, position: i, audience: aud(items[i].audience) });
            if (r.error) throw r.error;
          }
        } catch (err) {
          await sb.from("posts").delete().eq("id", id);
          for (const u of uploaded) { try { await removeStored(u); } catch (e) {} }
          throw err;
        }
      },
      async postUpdate(id, patch) {
        if (!live) {
          const d = demoDb();
          Object.assign(d.posts.find((p) => p.id === id), patch);
          return demoSave(d);
        }
        const { error } = await sb.from("posts").update(patch).eq("id", id);
        if (error) throw error;
      },
      async postDelete(post) {
        if (!live) {
          const d = demoDb();
          d.posts = d.posts.filter((p) => p.id !== post.id);
          d.post_images = d.post_images.filter((i) => i.post_id !== post.id);
          delete d.hearts[post.id];
          return demoSave(d);
        }
        const { error } = await sb.from("posts").delete().eq("id", post.id);
        if (error) throw error;
        for (const im of post.images || []) { try { await removeStored(im.image_url); } catch (e) {} }
      },
      async imageAdd(postId, file, caption, position, audience) {
        if (!live) {
          const d = demoDb();
          d.post_images.push({ id: uuid(), post_id: postId, image_url: await fileToDataUrl(file), caption: caption || null, position, audience: aud(audience) });
          return demoSave(d);
        }
        const url = await uploadFile(file);
        const { error } = await sb.from("post_images").insert({ post_id: postId, image_url: url, caption: caption || null, position, audience: aud(audience) });
        if (error) { try { await removeStored(url); } catch (e) {} throw error; }
      },
      async imageUpdate(id, patch) {
        // patch: {caption, audience}
        const row = { caption: patch.caption || null, audience: aud(patch.audience) };
        if (!live) {
          const d = demoDb();
          Object.assign(d.post_images.find((i) => i.id === id), row);
          return demoSave(d);
        }
        const { error } = await sb.from("post_images").update(row).eq("id", id);
        if (error) throw error;
      },
      async imageRemove(img) {
        if (!live) {
          const d = demoDb();
          d.post_images = d.post_images.filter((i) => i.id !== img.id);
          return demoSave(d);
        }
        const { error } = await sb.from("post_images").delete().eq("id", img.id);
        if (error) throw error;
        try { await removeStored(img.image_url); } catch (e) {}
      },

      // галерея LoRA: модерация и загрузка
      async galleryList() {
        if (!live) {
          const d = demoDb();
          return d.gallery.map((g) => ({ ...g, hearts: (d.ghearts[g.id] || []).length })).sort(newest);
        }
        const [g, h] = await Promise.all([
          sb.from("gallery_images").select("*").order("created_at", { ascending: false }),
          sb.rpc("admin_gallery_hearts")
        ]);
        if (g.error) throw g.error;
        const cnt = {};
        ((h.data) || []).forEach((r) => { cnt[r.image_id] = r.cnt; });
        return g.data.map((x) => mapGal({ ...x, hearts: cnt[x.id] || 0 }));
      },
      async galleryApprove(id) {
        if (!live) {
          const d = demoDb();
          d.gallery.find((g) => g.id === id).status = "approved";
          return demoSave(d);
        }
        const { error } = await sb.from("gallery_images").update({ status: "approved" }).eq("id", id);
        if (error) throw error;
      },
      async galleryUpdate(id, caption) {
        if (!live) {
          const d = demoDb();
          d.gallery.find((g) => g.id === id).caption = caption || null;
          return demoSave(d);
        }
        const { error } = await sb.from("gallery_images").update({ caption: caption || null }).eq("id", id);
        if (error) throw error;
      },
      async galleryDelete(img) {
        if (!live) {
          const d = demoDb();
          d.gallery = d.gallery.filter((g) => g.id !== img.id);
          delete d.ghearts[img.id];
          return demoSave(d);
        }
        const { error } = await sb.from("gallery_images").delete().eq("id", img.id);
        if (error) throw error;
        if (img.image_path) { try { await sb.storage.from("gallery").remove([img.image_path]); } catch (e) {} }
      },
      async galleryAdd(postId, file, caption) {
        // админ загружает сразу в одобренные
        if (!live) {
          const d = demoDb();
          const blob = await prepareImage(file, 1000, 0.85);
          d.gallery.push({ id: uuid(), post_id: postId, image_url: await fileToDataUrl(blob), caption: caption || null, uploader: null, status: "approved", created_at: new Date().toISOString() });
          return demoSave(d);
        }
        const blob = await prepareImage(file, 2000, 0.9);
        const path = uuid() + ".jpg";
        const up = await sb.storage.from("gallery").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const { error } = await sb.from("gallery_images").insert({ post_id: postId, image_path: path, caption: caption || null, status: "approved" });
        if (error) { try { await sb.storage.from("gallery").remove([path]); } catch (e) {} throw error; }
      },

      // ---------- Вопрос-ответ: модерация ----------
      async qaList() {
        if (!live) return demoDb().qa.slice().sort((a, b) => b.num - a.num);
        const { data, error } = await sb.from("qa_posts").select("*").order("num", { ascending: false }).limit(400);
        if (error) throw error;
        return (data || []).map(mapQa);
      },
      async qaApprove(id) {
        if (!live) { const d = demoDb(); const p = d.qa.find((x) => x.id === id); p.status = "approved"; return demoSave(d); }
        const { error } = await sb.from("qa_posts").update({ status: "approved" }).eq("id", id);
        if (error) throw error;
      },
      // удалить сообщение (если это вопрос, уходят и все ответы)
      async qaDelete(post) {
        if (!live) {
          const d = demoDb();
          d.qa = d.qa.filter((x) => x.id !== post.id && x.thread_id !== post.id);
          return demoSave(d);
        }
        const paths = post.image_path ? [post.image_path] : [];
        if (!post.thread_id) {
          const r = await sb.from("qa_posts").select("image_path").eq("thread_id", post.id);
          (r.data || []).forEach((x) => x.image_path && paths.push(x.image_path));
        }
        const { error } = await sb.from("qa_posts").delete().eq("id", post.id);
        if (error) throw error;
        if (paths.length) { try { await sb.storage.from("qa").remove(paths); } catch (e) {} }
      },
      // удалить все сообщения одного анонимного ID
      async qaDeleteByVoter(voterIdValue) {
        if (!live) {
          const d = demoDb();
          const ids = d.qa.filter((x) => x.voter_id === voterIdValue).map((x) => x.id);
          d.qa = d.qa.filter((x) => !ids.includes(x.id) && !ids.includes(x.thread_id));
          return demoSave(d);
        }
        const r = await sb.from("qa_posts").select("image_path").eq("voter_id", voterIdValue);
        const paths = (r.data || []).map((x) => x.image_path).filter(Boolean);
        const { error } = await sb.from("qa_posts").delete().eq("voter_id", voterIdValue);
        if (error) throw error;
        if (paths.length) { try { await sb.storage.from("qa").remove(paths); } catch (e) {} }
      },
      // ответ от автора (с плашкой «Автор»)
      async qaReply(threadId, body, file) {
        body = String(body || "").trim();
        if (!body && !file) throw new Error("Напиши ответ или добавь картинку");
        if (!live) {
          const d = demoDb();
          const num = (d.qaNum = (d.qaNum || 0) + 1);
          const now = new Date().toISOString();
          d.qa.push({ id: uuid(), num, thread_id: threadId, audience: (d.qa.find((x) => x.id === threadId) || {}).audience === "alt" ? "alt" : "all", name: C.AUTHOR || "Автор", subject: null, body,
            image_url: file ? await fileToDataUrl(await prepareImage(file, 1000, 0.85)) : null,
            voter_id: "admin", ip_hash: "", poster_id: "admin", is_admin: true, status: "approved", bumped_at: now, created_at: now });
          d.qa.find((x) => x.id === threadId).bumped_at = now;
          return demoSave(d);
        }
        let path = null;
        if (file) {
          const blob = await prepareImage(file, 2000, 0.9);
          path = uuid() + ".jpg";
          const up = await sb.storage.from("qa").upload(path, blob, { contentType: "image/jpeg" });
          if (up.error) throw up.error;
        }
        const par = await sb.from("qa_posts").select("audience").eq("id", threadId).maybeSingle();
        const { error } = await sb.from("qa_posts").insert({ thread_id: threadId, name: C.AUTHOR || "Автор", body, image_path: path,
          voter_id: "admin", is_admin: true, status: "approved", audience: par.data && par.data.audience === "alt" ? "alt" : "all" });
        if (error) { if (path) { try { await sb.storage.from("qa").remove([path]); } catch (e) {} } throw error; }
      },
      async qaWarn(voter, text, postNum) {
        text = String(text || "").trim();
        if (!text) throw new Error("Напиши текст предупреждения");
        if (!live) {
          const d = demoDb();
          d.qaWarn.push({ id: Date.now(), voter_id: voter, text, post_num: postNum || null, created_at: new Date().toISOString(), seen_at: null });
          return demoSave(d);
        }
        const { error } = await sb.from("qa_warnings").insert({ voter_id: voter, text: text.slice(0, 500), post_num: postNum || null });
        if (error) throw error;
      },
      // бан по ID устройства (и по адресу, если указан ipHash); days = 0 -> навсегда
      async qaBan({ voter, ipHash, reason, days, byIp }) {
        const until = days > 0 ? new Date(Date.now() + days * 864e5).toISOString() : null;
        const rows = [{ kind: "voter", value: voter, reason: reason || null, until }];
        if (byIp && ipHash) rows.push({ kind: "ip", value: ipHash, reason: reason || null, until });
        if (!live) {
          const d = demoDb();
          rows.forEach((r) => {
            d.qaBans = d.qaBans.filter((b) => !(b.kind === r.kind && b.value === r.value));
            d.qaBans.push({ id: Date.now() + Math.random(), ...r, created_at: new Date().toISOString() });
          });
          return demoSave(d);
        }
        const { error } = await sb.from("qa_bans").upsert(rows, { onConflict: "kind,value" });
        if (error) throw error;
      },
      async qaBans() {
        if (!live) return demoDb().qaBans.slice().sort(byCreated);
        const { data, error } = await sb.from("qa_bans").select("*").order("created_at", { ascending: false });
        if (error) throw error;
        return data || [];
      },
      async qaUnban(id) {
        if (!live) { const d = demoDb(); d.qaBans = d.qaBans.filter((b) => b.id !== id); return demoSave(d); }
        const { error } = await sb.from("qa_bans").delete().eq("id", id);
        if (error) throw error;
      },
      // настройки: "request_weekly_limit" (число), "qa_premod" ("0"/"1")
      async settingGet(key) {
        if (!live) {
          const d = demoDb();
          return key === "qa_premod" ? (d.settings && d.settings.qa_premod ? "1" : "0") : String(demoLimit(d));
        }
        const { data, error } = await sb.rpc("admin_setting_get", { p_key: key });
        if (error) throw error;
        return data;
      },
      async settingSet(key, value) {
        if (!live) {
          const d = demoDb(); d.settings = d.settings || {};
          if (key === "qa_premod") d.settings.qa_premod = value === "1";
          else d.settings.request_limit = parseInt(value, 10);
          return demoSave(d);
        }
        const { error } = await sb.rpc("admin_setting_set", { p_key: key, p_value: String(value) });
        if (error) throw error;
      },

      // пароль закрытой версии
      async altPasswordSet() {
        if (!live) { const d = demoDb(); return !!(d.settings && d.settings.alt_password); }
        const { data, error } = await sb.rpc("alt_password_is_set");
        if (error) throw error;
        return !!data;
      },
      async setAltPassword(pw) {
        if (String(pw || "").length < 6) throw new Error("Пароль должен быть не короче 6 символов");
        if (!live) {
          const d = demoDb();
          d.settings = d.settings || {};
          d.settings.alt_password = pw;
          return demoSave(d);
        }
        const { error } = await sb.rpc("set_alt_password", { p_password: pw });
        if (error) throw error;
      }
    }
  };

  window.LoraApi = api;
})();
