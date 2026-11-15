// Настройки сайта. Пока SUPABASE_URL пустой — сайт работает в ДЕМО-режиме
// (данные хранятся только в браузере и никому, кроме тебя, не видны).
window.SITE_CONFIG = {
  SUPABASE_URL: "https://arsybbuzqfvbsjemwmbr.supabase.co/rest/v1/",       // например: https://abcdxyz.supabase.co
  SUPABASE_ANON_KEY: "sb_publishable_bRgEYM0TGxtVd3E0WSfM_w_d0h6lqwK",  // публичный ключ "anon public" (НЕ service_role!)
  TELEGRAM_URL: "https://t.me/CatatonicPsychosis",
  AUTHOR: "CatatonicPsychosis",

  // Необязательно: свои картинки оформления (положи файлы рядом с index.html)
  LOGO_URL: "sitelogo.png",           // логотип вместо встроенного сердца с крыльями, например "logo-dark.png"
  LOGO_URL_LIGHT: "",     // логотип для светлой темы (если пусто — используется LOGO_URL)
  BG_URL: "sitebackground.png"              // фоновая картинка, например "bg.jpg" (она подтемняется/осветляется сама)
};
