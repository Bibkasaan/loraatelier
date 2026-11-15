// Слой данных: Supabase, а если ключи не заданы — демо-режим в localStorage.
(function () {
  const C = window.SITE_CONFIG || {};
  const live = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase);
  const sb = live ? window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY) : null;

  const DEMO_KEY = "lora_demo_db_v2";
  const TYPES = ["character", "style", "concept", "other"];
  const norm = (c) => String(c || "").trim().toUpperCase();
  const rndCode = () => "LORA-" + Math.random().toString(16).slice(2, 10).toUpperCase();
  const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0; return (c === "x" ? r : (r & 3) | 8).toString(16);
      });
  const byUpdated = (a, b) => new Date(b.updated_at) - new Date(a.updated_at);
  const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function voterId() {
    let v = lsGet("lora_voter");
    if (!v) { v = uuid(); lsSet("lora_voter", v); }
    return v;
  }

  // ---------- демо-данные ----------
  function demoDb() {
    try {
      const d = JSON.parse(localStorage.getItem(DEMO_KEY));
      if (d && d.requests) return d;
    } catch (e) {}
    const t = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const mk = (i, type, name, src, status, note, h) => ({
      id: "demo" + i, code: "LORA-DEMO000" + i, lora_type: type, character_name: name, source: src,
      requester: "", status, note, created_at: t(h + 24), updated_at: t(h)
    });
    const fake = (n) => Array.from({ length: n }, (_, i) => "seed-" + i);
    const d = {
      requests: [
        mk(1, "character", "Linnea", "Genshin Impact", "done", "", 200),
        mk(2, "character", "Odette", "Genshin Impact", "done", "", 150),
        mk(3, "character", "Ronova", "Genshin Impact", "in_progress", "Задержка: докупаю время GPU, обучение продолжится завтра", 6),
        mk(4, "style", "Акварельный стиль 90-х", "референсы: примеры в ТГ", "in_progress", "", 20),
        mk(5, "concept", "Витилиго", "пятна депигментации на коже", "requested", "", 40),
        mk(6, "character", "Alyosha", "Genshin Impact", "requested", "", 12)
      ],
      posts: [
        { id: "p1", title: "Linnea", lora_type: "character", description: "Персонаж из Genshin Impact.\nТриггер: linneagenshin, вес 0.8–1.0.", civitai_url: "https://civitai.com/", created_at: t(120) },
        { id: "p2", title: "Odette", lora_type: "character", description: "Хорошо работает в портретах и в полный рост.", civitai_url: "https://civitai.com/", created_at: t(60) },
        { id: "p3", title: "Мягкий свет и тени", lora_type: "concept", description: "Концепт: объёмный свет и глубина кадра.", civitai_url: "", created_at: t(30) }
      ],
      post_images: [],
      hearts: { p1: fake(12), p2: fake(5), p3: fake(8) }
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

  // загрузка файла: Supabase Storage или data-URL в демо-режиме
  async function uploadFile(file) {
    if (!live) return fileToDataUrl(file);
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = Date.now() + "-" + Math.random().toString(36).slice(2, 7) + "-" + safe;
    const up = await sb.storage.from("previews").upload(path, file, { contentType: file.type });
    if (up.error) throw up.error;
    return sb.storage.from("previews").getPublicUrl(path).data.publicUrl;
  }
  async function removeStored(url) {
    if (!live) return;
    const m = String(url).split("/previews/")[1];
    if (m) await sb.storage.from("previews").remove([decodeURIComponent(m)]);
  }

  // собрать посты с картинками и сердечками
  function assemble(posts, images) {
    const by = {};
    images.forEach((im) => { (by[im.post_id] = by[im.post_id] || []).push(im); });
    return posts.map((p) => ({
      ...p,
      hearts: p.hearts || 0,
      images: (by[p.id] || []).slice().sort((a, b) => a.position - b.position)
    }));
  }

  const api = {
    live, TYPES, voterId,

    // ---------- публичная часть ----------
    async board() {
      if (!live) return demoDb().requests.filter((r) => r.status !== "cancelled").sort(byUpdated);
      const { data, error } = await sb.from("board").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    async posts() {
      if (!live) {
        const d = demoDb();
        const posts = d.posts.map((p) => ({ ...p, hearts: (d.hearts[p.id] || []).length }));
        return assemble(posts, d.post_images).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      }
      const [p, i] = await Promise.all([
        sb.from("posts_public").select("*").order("created_at", { ascending: false }),
        sb.from("post_images").select("*").order("position", { ascending: true })
      ]);
      if (p.error) throw p.error;
      if (i.error) throw i.error;
      return assemble(p.data, i.data);
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
    async submit(type, character, source, requester) {
      if (!TYPES.includes(type)) type = "character";
      if (!live) {
        const d = demoDb();
        const code = rndCode();
        const now = new Date().toISOString();
        d.requests.push({
          id: uuid(), code, lora_type: type, character_name: character, source, requester,
          status: "requested", note: "", created_at: now, updated_at: now
        });
        demoSave(d);
        return code;
      }
      const { data, error } = await sb.rpc("submit_request", {
        p_type: type, p_character: character, p_source: source, p_requester: requester
      });
      if (error) {
        if (/rate_limit/.test(error.message)) throw new Error("Слишком много заявок за последний час. Попробуй позже.");
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
        if (!live) return demoDb().requests.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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
      async add({ lora_type, character_name, source, status, note }) {
        const row = { code: rndCode(), lora_type, character_name, source: source || null, status, note: note || null };
        if (!live) {
          const d = demoDb();
          const now = new Date().toISOString();
          d.requests.push({ id: uuid(), requester: "", created_at: now, updated_at: now, ...row });
          return demoSave(d);
        }
        const { error } = await sb.from("requests").insert(row);
        if (error) throw error;
      },

      // посты «Готовые LoRA»
      async postCreate(post, items) {
        // post: {title, lora_type, description, civitai_url}; items: [{file, caption}]
        const row = {
          title: post.title, lora_type: post.lora_type,
          description: post.description || null, civitai_url: post.civitai_url || null
        };
        if (!live) {
          const d = demoDb();
          const id = uuid();
          d.posts.push({ id, created_at: new Date().toISOString(), ...row });
          for (let i = 0; i < items.length; i++) {
            d.post_images.push({ id: uuid(), post_id: id, image_url: await fileToDataUrl(items[i].file), caption: items[i].caption || null, position: i });
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
            const r = await sb.from("post_images").insert({ post_id: id, image_url: url, caption: items[i].caption || null, position: i });
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
      async imageAdd(postId, file, caption, position) {
        if (!live) {
          const d = demoDb();
          d.post_images.push({ id: uuid(), post_id: postId, image_url: await fileToDataUrl(file), caption: caption || null, position });
          return demoSave(d);
        }
        const url = await uploadFile(file);
        const { error } = await sb.from("post_images").insert({ post_id: postId, image_url: url, caption: caption || null, position });
        if (error) { try { await removeStored(url); } catch (e) {} throw error; }
      },
      async imageUpdate(id, caption) {
        if (!live) {
          const d = demoDb();
          d.post_images.find((i) => i.id === id).caption = caption || null;
          return demoSave(d);
        }
        const { error } = await sb.from("post_images").update({ caption: caption || null }).eq("id", id);
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
      }
    }
  };

  window.LoraApi = api;
})();
