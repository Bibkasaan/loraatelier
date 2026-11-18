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

  const DEMO_KEY = "lora_demo_db_v6";
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
      settings: { alt_password: "secret1" },
      gallery: [
        { id: "g1", post_id: "p1", image_url: placeholder("Linnea · фан-арт 1", "#46506b", "#1c2236"), caption: "Первый тест от подписчицы", uploader: "", status: "approved", created_at: t(40) },
        { id: "g2", post_id: "p1", image_url: placeholder("Linnea · фан-арт 2", "#6b4650", "#2a1620"), caption: "С другим костюмом", uploader: "", status: "approved", created_at: t(30) },
        { id: "g3", post_id: "p2", image_url: placeholder("Odette · пример", "#4a6b50", "#14261a"), caption: "", uploader: "", status: "approved", created_at: t(20) },
        { id: "g4", post_id: "p1", image_url: placeholder("ждёт проверки", "#6b6446", "#262214"), caption: "Новая картинка на проверке", uploader: "@guest", status: "pending", created_at: t(2) },
        { id: "g5", post_id: "p4", image_url: placeholder("бета · скрытый пост", "#2f6fe0", "#0a1a40"), caption: "Галерея скрытого поста", uploader: "", status: "approved", created_at: t(6) }
      ],
      ghearts: { g1: fake(7), g2: fake(2) }
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
        const code = rndCode();
        const now = new Date().toISOString();
        d.requests.push({
          id: uuid(), code, lora_type: type, character_name: character, source, requester,
          status: "requested", note: "", audience: secret ? "alt" : "all", created_at: now, updated_at: now
        });
        demoSave(d);
        return code;
      }
      const { data, error } = secret
        ? await sb.rpc("submit_request_alt", { p_password: altPassword, p_type: type, p_character: character, p_source: source, p_requester: requester })
        : await sb.rpc("submit_request", { p_type: type, p_character: character, p_source: source, p_requester: requester });
      if (error) {
        if (/rate_limit/.test(error.message)) throw new Error("Слишком много заявок за последний час. Попробуй позже.");
        if (/locked/.test(error.message)) throw new Error("Слишком много неверных попыток. Подожди 10 минут.");
        throw error;
      }
      return data;
    },
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
