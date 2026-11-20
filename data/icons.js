/* RO Survivors — 風格 A「盧恩羊皮紙公會手冊」自製向量 SVG 圖示庫（嚴格零 Emoji） */
(function (global) {
  "use strict";

  const svg = (body, vb = "0 0 24 24") =>
    `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

  global.RO_ICONS = {
    /* 品牌與導覽 */
    crest: svg('<path d="M12 2L4 5.8v5.5c0 5.3 3.4 9.6 8 10.9 4.6-1.3 8-5.6 8-10.9V5.8L12 2z"/><path d="M12 6.8v10.4M8.5 11.2L12 7.8l3.5 3.4"/><circle cx="12" cy="14.5" r="1.2" fill="currentColor" stroke="none"/>'),
    builds: svg('<path d="M5 19L19 5M14.5 4.5H19.5V9.5M8.5 11.5l4 4M4 16l4 4"/><path d="M15 15l5 5M17.5 13.5l-2 2"/>'),
    stages: svg('<polygon points="3 6 9 3.5 15 6.5 21 4 21 18 15 20.5 9 17.5 3 20"/><line x1="9" y1="3.5" x2="9" y2="17.5"/><line x1="15" y1="6.5" x2="15" y2="20.5"/>'),
    scroll: svg('<path d="M6 4h11a3 3 0 0 1 3 3v1H8a2 2 0 0 0-2 2v8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M8 8v9a3 3 0 0 0 3 3h7a2 2 0 0 0 2-2V8"/><path d="M11 12h6M11 15h4"/>'),
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    check: svg('<path d="M20 6L9 17l-5-5"/>'),
    warning: svg('<path d="M12 3L2.5 19.5h19L12 3z"/><path d="M12 9.2v4.6"/><circle cx="12" cy="16.8" r="0.9" fill="currentColor" stroke="none"/>'),
    lock: svg('<rect x="4.5" y="11" width="15" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'),
    spark: svg('<path d="M12 2.5l2.2 6.3 6.3 2.2-6.3 2.2L12 19.5l-2.2-6.3-6.3-2.2 6.3-2.2L12 2.5z"/>'),
    star: svg('<polygon points="12 2.8 14.9 8.6 21.2 9.5 16.6 14 17.7 20.3 12 17.3 6.3 20.3 7.4 14 2.8 9.5 9.1 8.6 12 2.8"/>'),
    search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.8-3.8"/>'),
    chevron: svg('<path d="M6 9l6 6 6-6"/>'),
    crown: svg('<path d="M3 17.5L5 7l5 4.5L12 5l2 6.5L19 7l2 10.5H3z"/><path d="M4 20h16"/>'),
    skull: svg('<circle cx="12" cy="10.5" r="6.5"/><path d="M9 17v3h6v-3"/><circle cx="9.8" cy="10.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.2" cy="10.2" r="1.2" fill="currentColor" stroke="none"/><path d="M12 12.5v1.5"/>'),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/>'),
    compass: svg('<circle cx="12" cy="12" r="9"/><polygon points="15.5 8.5 13.4 13.4 8.5 15.5 10.6 10.6 15.5 8.5"/>'),
    tree: svg('<circle cx="12" cy="5" r="2.3"/><circle cx="6" cy="18.5" r="2.3"/><circle cx="18" cy="18.5" r="2.3"/><path d="M12 7.3V12M12 12H6v4.2M12 12h6v4.2"/>'),
    info: svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r="0.9" fill="currentColor" stroke="none"/>'),
    seal: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5" stroke-dasharray="2.2 2.2"/><path d="M9.5 12l1.8 1.8 3.5-3.6"/>'),
    book: svg('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),

    /* 紅綠燈自製徽章（取代 emoji 圓點） */
    light_go: svg('<path d="M12 2.5l7.5 3.2v5.8c0 4.6-3.1 8.5-7.5 9.8-4.4-1.3-7.5-5.2-7.5-9.8V5.7L12 2.5z"/><path d="M8.8 12.2l2.2 2.2 4.4-4.6"/>'),
    light_mid: svg('<polygon points="12 3 21 12 12 21 3 12 12 3"/><path d="M12 8.5v4.2"/><circle cx="12" cy="15.8" r="0.9" fill="currentColor" stroke="none"/>'),
    light_stop: svg('<circle cx="12" cy="12" r="8.8"/><path d="M6.4 6.4l11.2 11.2"/>'),

    /* 裝備與卡片部位圖示 */
    slot_weapon: svg('<path d="M5 19L19 5M14.5 4.5H19.5V9.5M8.5 11.5l4 4M4 16l4 4"/>'),
    slot_shield: svg('<path d="M12 3l7 3v5c0 5-3 8.8-7 10-4-1.2-7-5-7-10V6l7-3z"/><path d="M12 7v9"/>'),
    slot_head_top: svg('<path d="M4 15.5c0-4.4 3.6-8 8-8s8 3.6 8 8"/><path d="M3 16h18v2.5H3z"/><path d="M12 4.5v3"/>'),
    slot_head_mid: svg('<rect x="3" y="9" width="7.5" height="6" rx="2"/><rect x="13.5" y="9" width="7.5" height="6" rx="2"/><path d="M10.5 12h3"/>'),
    slot_head_low: svg('<path d="M5 13c2.5 3 11.5 3 14 0"/><path d="M7 10.5h10M9 17.5h6"/>'),
    slot_armor: svg('<path d="M8 4l4 2.5L16 4l4 3-2 4v9H6v-9L4 7l4-3z"/><path d="M12 6.5V20"/>'),
    slot_garment: svg('<path d="M8 4h8l4 16-8-3-8 3 4-16z"/><path d="M9.5 4l2.5 5 2.5-5"/>'),
    slot_shoes: svg('<path d="M6 5v9.5c0 1.4 1.1 2.5 2.5 2.5H20v-3.2c0-1.1-.8-2-1.9-2.2l-4.6-.9L11.5 5H6z"/>'),
    slot_acc: svg('<circle cx="12" cy="13" r="6"/><path d="M9.5 6.8L12 4l2.5 2.8"/>'),
    slot_pet: svg('<circle cx="7.5" cy="9.5" r="1.8"/><circle cx="16.5" cy="9.5" r="1.8"/><circle cx="10.2" cy="6" r="1.6"/><circle cx="13.8" cy="6" r="1.6"/><path d="M7.5 16.5c0-2.6 2-4.5 4.5-4.5s4.5 1.9 4.5 4.5a3 3 0 0 1-3 3h-3a3 3 0 0 1-3-3z"/>'),
    card_gem: svg('<polygon points="12 3 19.5 12 12 21 4.5 12 12 3"/><polygon points="12 7.5 15.5 12 12 16.5 8.5 12 12 7.5"/>'),

    /* 技能快捷鍵圖示 */
    sk_basic: svg('<path d="M6 18L18 6M13 6h5v5"/><path d="M7 13l4 4"/>'),
    sk_fire: svg('<path d="M12 3c2.5 3 5.5 5.6 5.5 9.6A5.5 5.5 0 0 1 6.5 12.6c0-2.1 1-4.1 2.3-5.6.2 1.7 1.2 2.7 2.2 3-.3-2.5.4-4.8 1-7z"/>'),
    sk_ice: svg('<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M10 5l2 2 2-2M10 19l2-2 2 2"/>'),
    sk_wind: svg('<path d="M13 2.5L5.5 13h6l-1 8.5L18.5 11h-6l.5-8.5z"/>'),
    sk_holy: svg('<path d="M12 3v18M6.5 9h11"/><circle cx="12" cy="9" r="5" stroke-opacity="0.45"/>'),
    sk_melee: svg('<path d="M4.5 19.5L16 8"/><path d="M13 4.5l6.5 6.5-2.5 2.5-6.5-6.5L13 4.5z"/><path d="M4 15.5l4.5 4.5"/>'),
    sk_bow: svg('<path d="M17.5 4c2.8 4.2 2.8 11.8 0 16"/><path d="M6 20L17.5 4"/><path d="M4.5 12h15M16.5 9l3 3-3 3"/>'),
    sk_poison: svg('<path d="M9 3h6M10 3v4.5l-4.8 8.8A2.4 2.4 0 0 0 7.3 20h9.4a2.4 2.4 0 0 0 2.1-3.7L14 7.5V3"/><path d="M7.5 14.5h9"/>'),
    sk_buff: svg('<path d="M12 4l2.4 4.8L20 10l-4 3.8.9 5.5L12 16.6 7.1 19.3 8 13.8 4 10l5.6-1.2L12 4z"/>'),
    sk_aoe: svg('<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
    sk_coin: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10M9.5 9.5h3.5a1.5 1.5 0 0 1 0 3h-2a1.5 1.5 0 0 0 0 3h3.5"/>'),
    sk_gun: svg('<circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2"/><path d="M12 2.5v3.5M12 18v3.5M2.5 12H6M18 12h3.5"/>'),
    sk_shuriken: svg('<path d="M12 2.5l2.3 7.2L21.5 12l-7.2 2.3L12 21.5l-2.3-7.2L2.5 12l7.2-2.3L12 2.5z"/><circle cx="12" cy="12" r="1.8"/>'),

    /* 16 職業紋章 */
    knight: svg('<path d="M5 19L19 5M14 4h6v6M9 11l4 4M4 16l4 4M3 21l2-2"/>'),
    crusader: svg('<path d="M12 2.5L4 6v5.5c0 5.3 3.4 9.5 8 10.5 4.6-1 8-5.2 8-10.5V6l-8-3.5z"/><path d="M12 7v10M8.5 11.5h7"/>'),
    wizard: svg('<path d="M14.5 4l5.5 5.5-11.5 11.5H3v-5.5L14.5 4z"/><path d="M12 6.5l5.5 5.5"/><circle cx="6" cy="6" r="1.5"/>'),
    sage: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v16H6.5A2.5 2.5 0 0 0 4 21V5.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v16h5.5a2.5 2.5 0 0 1 2.5 2V5.5z"/>'),
    hunter: svg('<path d="M18 4c2.8 4.2 2.8 11.8 0 16"/><path d="M6 20L18 4"/><path d="M5 12h15M17 9l3 3-3 3"/>'),
    bard: svg('<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>'),
    priest: svg('<path d="M12 3v18M6.5 9h11"/><circle cx="12" cy="9" r="5.5" stroke-opacity="0.45"/>'),
    monk: svg('<circle cx="12" cy="12" r="8"/><path d="M8.5 11.5h7v4a3.5 3.5 0 0 1-7 0v-4z"/><path d="M9.5 11.5V9M12 11.5V8.5M14.5 11.5V9"/>'),
    assassin: svg('<path d="M4 20l7-7M20 20l-7-7"/><path d="M11 13L5 4l9 5M13 13l6-9-9 5"/>'),
    rogue: svg('<path d="M12 3l7 5-2 10H7L5 8l7-5z"/><path d="M8.5 11.5l2 1 3-1"/><path d="M12 15v3"/>'),
    blacksmith: svg('<path d="M3 10l4-4 5 5-4 4-5-5z"/><path d="M10 13l8 8"/><path d="M14 5h6v4h-3"/>'),
    alchemist: svg('<path d="M9 3h6M10 3v5l-5 9.5A2.2 2.2 0 0 0 6.9 21h10.2a2.2 2.2 0 0 0 1.9-3.5L14 8V3"/><path d="M7.5 15h9"/>'),
    star_gladiator: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22M4.9 4.9l2.5 2.5M16.6 16.6l2.5 2.5M19.1 4.9l-2.5 2.5M7.4 16.6l-2.5 2.5"/>'),
    soul_linker: svg('<circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/><path d="M12 6.5a5.5 5.5 0 0 1 0 11 5.5 5.5 0 0 1 0-11z"/>'),
    ninja: svg('<path d="M12 2l2.4 7.6L22 12l-7.6 2.4L12 22l-2.4-7.6L2 12l7.6-2.4L12 2z"/><circle cx="12" cy="12" r="2"/>'),
    gunslinger: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.2"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>')
  };
})(typeof window !== "undefined" ? window : globalThis);
