// ==UserScript==
// @name         Ali System Otomatik Yağma
// @namespace    http://tampermonkey.net/
// @version      1.5.0
// @description  30 dk otomatik + manuel tarama, tam ganimet boşaltmaya göre dinamik asker hesabı, pencere içi yazı boyutu ayarı ve Ali Bilik System imzası.
// @author       Ali Bilik
// @match        *://arkunkut.com/*
// @match        *://*.arkunkut.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
    "use strict";

    console.log("[Ali System] v1.5.0 başlatılıyor...");

    // --- ÖNCEKİ PANEL VE KALINTILARI TEMİZLEME ---
    const oldPanel = document.getElementById("ayb");
    if (oldPanel) oldPanel.remove();
    document.querySelectorAll("style[data-ayb='1']").forEach(s => s.remove());

    if (window.__DEDEYE_SELAM_V1__) {
        return;
    }
    window.__DEDEYE_SELAM_V1__ = true;

    // --- GERÇEK BİRİM VERİTABANI ---
    const UNIT_STATS = {
        "yaya er": { sal: 42, pi: 22, su: 12, hiz: 12, yuk: 55, tip: "piyade" },
        "kalkanlı": { sal: 14, pi: 42, su: 40, hiz: 10.7, yuk: 30, tip: "piyade" },
        "balta çeri": { sal: 95, pi: 26, su: 22, hiz: 20, yuk: 70, tip: "suvari" },
        "gözcü": { sal: 0, pi: 12, su: 8, hiz: 25.3, yuk: 0, tip: "casus" },
        "akan çeri": { sal: 105, pi: 32, su: 45, hiz: 24, yuk: 110, tip: "suvari" },
        "tarkan": { sal: 165, pi: 60, su: 85, hiz: 18.7, yuk: 85, tip: "suvari" },
        "koçbaşı": { sal: 66, pi: 30, su: 70, hiz: 6.7, yuk: 0, tip: "kusatma" },
        "mancınık": { sal: 86, pi: 55, su: 12, hiz: 5.3, yuk: 0, tip: "kusatma" },

        "sü eri": { sal: 32, pi: 38, su: 50, hiz: 6, yuk: 45, tip: "piyade" },
        "kalkanlı alp": { sal: 18, pi: 72, su: 56, hiz: 5, yuk: 25, tip: "piyade" },
        "yalman": { sal: 82, pi: 76, su: 60, hiz: 7, yuk: 55, tip: "piyade" },
        "yelme": { sal: 0, pi: 14, su: 10, hiz: 15, yuk: 0, tip: "casus" },
        "börü atlısı": { sal: 88, pi: 45, su: 60, hiz: 20, yuk: 132, tip: "suvari" },
        "tigin süvarisi": { sal: 145, pi: 75, su: 115, hiz: 11, yuk: 70, tip: "suvari" },

        "alp eri": { sal: 26, pi: 36, su: 34, hiz: 4.8, yuk: 50, tip: "piyade" },
        "mızraklı": { sal: 12, pi: 70, su: 74, hiz: 4.8, yuk: 30, tip: "piyade" },
        "ay teberlisi": { sal: 38, pi: 48, su: 40, hiz: 4.8, yuk: 45, tip: "piyade" },
        "sızıcı": { sal: 0, pi: 12, su: 8, hiz: 11.2, yuk: 0, tip: "casus" },
        "hafif süvari": { sal: 70, pi: 28, su: 32, hiz: 16, yuk: 132, tip: "suvari" },
        "zırhlı süvari": { sal: 100, pi: 85, su: 110, hiz: 8, yuk: 65, tip: "suvari" },
        "ateş mancınığı": { sal: 65, pi: 50, su: 9, hiz: 2.4, yuk: 0, tip: "kusatma" }
    };

    const CHANGELOG = [
        {
            version: "v1.5.0",
            date: "11.10.2026",
            notes: [
                "Yaylak listesi pencerelerine (Tüm Yaylaklar & Yeni Yaylaklar) özel Yazı Boyutu (Font Zoom) ayarı eklendi."
            ]
        },
        {
            version: "v1.4.0",
            date: "11.10.2026",
            notes: [
                "Ek asker alanı kaldırıldı. Asker hesabı doğrudan yaylaktaki TÜM GANİMETİ boşaltacak şekilde otomatikleştirildi.",
                "30 dakikalık otomatik tarama yanında anlık manuel tarama butonu entegre edildi."
            ]
        }
    ];

    const CONFIG = {
        STORAGE_KEY_ARMY: "DEDEYE_FARM_ARMY_V1",
        STORAGE_KEY_SCALE: "DEDEYE_FARM_SCALE_V1",
        STORAGE_KEY_FONT_SIZE: "DEDEYE_FARM_FONT_SIZE_V1",
        STORAGE_KEY_RAID_TIMES: "DEDEYE_FARM_RAID_TIMES_V1",
        STORAGE_KEY_STATS: "DEDEYE_FARM_STATS_V1",
        EXCLUDE_UNITS: new Set(["koçbaşı", "mancınık", "göçmen", "başbuğ", "gözcü", "yaya er", "kalkanlı", "konar", "şad", "buyruk"]),
        REGEN_HOURS: 24,
        AUTO_SCAN_INTERVAL_MS: 30 * 60 * 1000 // 30 Dakika
    };

    const State = {
        res: "hepsi",
        min: 5000,
        minH: 0,
        max: 90,
        scale: 1.0,
        modalFontSize: "11px",
        useKarargah: true,
        autoRaid: false,
        sortBy: "ganimet",
        sortOrder: "desc",
        targets: [],
        newTargets: [],
        knownTargetKeys: new Set(),
        sentTargets: new Set(),
        lastOriginKey: null,
        cdTimer: null,
        isLocked: false,
        autoScanTimer: null
    };

    const Utils = {
        fmt: n => Math.floor(Number(n) || 0).toLocaleString("tr-TR"),
        fmtK: n => {
            const num = Math.floor(Number(n) || 0);
            return num >= 1000 ? (num / 1000).toFixed(1) + "k" : num;
        },
        tm: s => {
            s = Math.round(Number(s) || 0);
            const h = String(Math.floor(s / 3600)).padStart(2, "0");
            const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
            const sec = String(s % 60).padStart(2, "0");
            return `${h}:${m}:${sec}`;
        },
        norm: s => String(s || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim(),
        say: (msg, isError = false) => {
            const el = document.querySelector("#ayb-status-text");
            if (el) {
                el.textContent = msg;
                el.style.color = isError ? "#ff4b4b" : "#ffd43b";
            }
        },
        randomRange: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
        fireEvent: el => {
            if (!el) return;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        }
    };

    const Simulator = {
        getUnitStat(id) {
            const name = Utils.norm(Engine.getUnitName(id));
            const fallback = UNIT_STATS[name] || { sal: 50, pi: 30, su: 30, hiz: 20, yuk: 60, tip: "piyade" };
            try {
                if (typeof UNITS !== "undefined" && UNITS[id]) {
                    const realSpeed = Number(UNITS[id].hiz || UNITS[id].speed);
                    const realCap = Number(UNITS[id].yuk || UNITS[id].kapasite || UNITS[id].capacity);
                    return {
                        ...fallback,
                        hiz: realSpeed > 0 ? realSpeed : fallback.hiz,
                        yuk: realCap > 0 ? realCap : fallback.yuk
                    };
                }
            } catch(e) {}
            return fallback;
        }
    };

    const Engine = {
        getOba() {
            try { if (typeof aktifOba === "function") { const o = aktifOba(); if (o && isFinite(+o.x) && isFinite(+o.y)) return o; } } catch (_) {}
            try { if (typeof HOyuncu !== "undefined" && HOyuncu) return HOyuncu; } catch (_) {}
            return null;
        },

        getObaKey() {
            try {
                const o = this.getOba();
                if (o) return String(o.id ?? o.no ?? o.kod ?? `${Number(o.x)}|${Number(o.y)}`);
            } catch (_) {}
            return "default";
        },

        getOrigins(oba) {
            const obaKey = `${Number(oba.x)}|${Number(oba.y)}`;
            const origins = [{ x: Number(oba.x), y: Number(oba.y), isKarargah: false, ad: "Ana Oba", key: obaKey }];
            if (!State.useKarargah) return origins;

            const originSet = new Set();
            originSet.add(obaKey);
            let karargahCount = 0;

            const addOrigin = (x, y, name) => {
                if (karargahCount >= 1) return;
                const key = `${Number(x)}|${Number(y)}`;
                if (!originSet.has(key) && isFinite(x) && isFinite(y)) {
                    originSet.add(key);
                    origins.push({ x: Number(x), y: Number(y), isKarargah: true, ad: name, key: key });
                    karargahCount++;
                }
            };

            try {
                if (Array.isArray(oba.karargahlar)) {
                    oba.karargahlar.forEach((k, i) => addOrigin(k.x, k.y, k.ad || k.isim || `Karargah ${i+1}`));
                }
                if (typeof S !== "undefined" && Array.isArray(S.obalar)) {
                    const aktifSOba = S.obalar.find(o => Number(o.x) === Number(oba.x) && Number(o.y) === Number(oba.y));
                    if (aktifSOba && Array.isArray(aktifSOba.karargahlar)) {
                        aktifSOba.karargahlar.forEach((k, i) => addOrigin(k.x, k.y, k.ad || k.isim || `Karargah ${i+1}`));
                    }
                }
            } catch (e) {}

            return origins;
        },

        sortTargetsList() {
            const sorter = (a, b) => {
                let res = 0;
                if (State.sortBy === "ganimet") {
                    res = a.totalAmount - b.totalAmount;
                } else if (State.sortBy === "mesafe") {
                    res = a.sec - b.sec;
                } else if (State.sortBy === "konum") {
                    res = a.originKey.localeCompare(b.originKey);
                    if (res === 0) res = a.totalAmount - b.totalAmount;
                } else if (State.sortBy === "haydut") {
                    res = a.h - b.h;
                }
                return State.sortOrder === "desc" ? -res : res;
            };

            State.targets.sort(sorter);
            State.newTargets.sort(sorter);
        },

        scan() {
            if (typeof HK === "undefined" || !HK || typeof HK.values !== "function") {
                Utils.say("⚠ Harita verisi yükleniyor, haritayı açın...", true);
                return;
            }
            if (typeof mesafe !== "function") return;
            const oba = this.getOba();
            if (!oba) return;

            const raidTimes = GM_getValue(CONFIG.STORAGE_KEY_RAID_TIMES, {});
            const now = Date.now();
            const fullRegenMs = CONFIG.REGEN_HOURS * 3600 * 1000;

            const selectedArmyTypes = UI.getSelectedUnitTypes();
            let minSpeed = Infinity;
            selectedArmyTypes.forEach(id => {
                const stat = Simulator.getUnitStat(id);
                if (stat.hiz > 0) minSpeed = Math.min(minSpeed, stat.hiz);
            });
            const armySpeed = isFinite(minSpeed) ? minSpeed : 20;

            let origins = this.getOrigins(oba);
            const allTiles = [...HK.values()];
            const vahas = allTiles.filter(k => k && (k.tur === "vaha" || k.tur === "supervaha"));
            const results = [];
            const seen = new Set();
            const maxDurationSecs = State.max * 60;

            for (const k of vahas) {
                const coordKey = `${k.x}|${k.y}`;
                const id = k.tur === "supervaha" ? `s:${k.no ?? coordKey}` : `v:${coordKey}`;

                if (seen.has(id)) continue;
                seen.add(id);

                if (State.sentTargets.has(coordKey)) continue;
                if (State.res !== "hepsi" && k.kaynak !== State.res) continue;

                const lastRaid = raidTimes[coordKey] || 0;
                const elapsedMs = now - lastRaid;
                if (elapsedMs < 2 * 60 * 60 * 1000) continue;

                try {
                    const isTargetActive = (S?.obalar || []).some(o => (o?.seferler || []).some(m =>
                        m?.yagma === true && Number(m?.hedef?.x) === Number(k.x) && Number(m?.hedef?.y) === Number(k.y)
                    ));
                    if (isTargetActive) continue;
                } catch (_) {}

                try { if (typeof vahaTutuluyorMu === "function" && vahaTutuluyorMu(k)) continue; } catch (_) {}

                let bandits = 0, rawLoot = {};
                try {
                    if (typeof vahaHaydutSayisi === "function") {
                        const z = vahaHaydutSayisi(k) || {};
                        bandits = Number(z.adet ?? z.sayi ?? 0) || 0;
                        rawLoot = z.ganimet || {};
                    } else if (typeof vahaHaydutlari === "function") {
                        bandits = Number(vahaHaydutlari(k)) || 0;
                    } else continue;

                    if (!Object.keys(rawLoot).length && typeof vahaGanimeti === "function") rawLoot = vahaGanimeti(k, bandits) || {};
                } catch (_) { continue; }

                if (bandits < State.minH) continue;

                let regenRatio = Math.min(1, elapsedMs / fullRegenMs);
                if (lastRaid === 0) regenRatio = 1;

                const allLoot = {
                    demir: Math.floor(Number(rawLoot.demir || 0) * regenRatio),
                    tas: Math.floor(Number(rawLoot.tas || 0) * regenRatio),
                    odun: Math.floor(Number(rawLoot.odun || 0) * regenRatio),
                    tahil: Math.floor(Number(rawLoot.tahil || 0) * regenRatio)
                };

                const targetResKey = (State.res === "hepsi") ? (k.kaynak || "demir") : State.res;
                const primaryAmount = allLoot[targetResKey] || 0;
                const totalAmount = Object.values(allLoot).reduce((a, b) => a + b, 0);

                if (primaryAmount < State.min && totalAmount < State.min) continue;

                let dist = Infinity;
                let closestOriginName = "Ana Oba";
                let closestOriginKey = "default";

                for (const orig of origins) {
                    try {
                        let d = Number(mesafe(orig, k));
                        if (orig.isKarargah && d > 30) continue;

                        if (isFinite(d) && d < dist) {
                            dist = d;
                            closestOriginName = orig.ad;
                            closestOriginKey = orig.key;
                        }
                    } catch (_) {}
                }

                if (!isFinite(dist) || dist === Infinity) continue;

                let durationSec;
                try {
                    durationSec = typeof yolSuresiKare === "function" ? Number(yolSuresiKare(dist, armySpeed)) : (dist * 2400) / Math.max(armySpeed, 0.1);
                } catch (_) { durationSec = (dist * 2400) / Math.max(armySpeed, 0.1); }

                if (!isFinite(durationSec) || durationSec < 0 || durationSec > maxDurationSecs) continue;

                let fuzzySec = durationSec + Utils.randomRange(-45, 45);
                let fuzzyLoot = totalAmount + Utils.randomRange(-250, 250);

                results.push({
                    k, x: k.x, y: k.y, coordKey, h: bandits, amount: primaryAmount, totalAmount, allLoot, resType: targetResKey,
                    d: dist, sec: durationSec, speed: armySpeed, regenRatio, origin: closestOriginName, originKey: closestOriginKey,
                    fuzzySec, fuzzyLoot
                });
            }

            const newlyDiscovered = [];
            results.forEach(item => {
                if (!State.knownTargetKeys.has(item.coordKey)) {
                    newlyDiscovered.push(item);
                    State.knownTargetKeys.add(item.coordKey);
                }
            });

            if (State.knownTargetKeys.size === 0) {
                results.forEach(item => State.knownTargetKeys.add(item.coordKey));
            } else if (newlyDiscovered.length > 0) {
                State.newTargets = [...newlyDiscovered, ...State.newTargets];
                UI.updateNewTargetsBadge();
            }

            State.targets = results;
            this.sortTargetsList();

            UI.paintMap();
            UI.renderTargetsList();
            Utils.say(`🔄 Tarama Bitti: ${State.targets.length} yaylak aktif.`);
        },

        getArmyData() {
            let army = null, race = null, ids = [];
            try {
                const oba = this.getOba();
                if (oba && oba.ordu && typeof oba.ordu === "object") army = oba.ordu;
            } catch (_) {}
            try {
                if (!army && typeof S !== "undefined" && S) army = S.ordu || null;
                if (typeof S !== "undefined" && S) race = S.irk || null;
            } catch (_) {}
            try {
                if (typeof IRK_BIRIMLER !== "undefined") {
                    if (race && IRK_BIRIMLER[race]) ids = [...IRK_BIRIMLER[race]];
                    else if (Array.isArray(IRK_BIRIMLER)) ids = [...IRK_BIRIMLER];
                }
                if (!ids.length && typeof irkBirimleri === "function") ids = irkBirimleri() || [];
            } catch (_) {}
            if (!ids.length && army && typeof army === "object") ids = Object.keys(army);
            return { army: army || {}, ids };
        },

        getUnitName(id) {
            try { return (typeof UNITS !== "undefined" && UNITS[id] && (UNITS[id].ad || UNITS[id].name)) || id; } catch (_) { return id; }
        },

        getUnitCount(id, army) {
            try {
                const v = army?.[id];
                if (v && typeof v === "object") return Number(v.adet ?? v.sayi ?? v.count ?? 0) || 0;
                if (v !== undefined) return Number(v) || 0;
            } catch (_) {}
            try { return typeof orduSayi === "function" ? (Number(orduSayi(id)) || 0) : 0; } catch (_) { return 0; }
        }
    };

    const Automation = {
        calculateRaidArmyForTarget(target) {
            const selectedUnitIds = UI.getSelectedUnitTypes();
            const armyData = Engine.getArmyData();
            const calculatedArmy = {};

            const targetBandits = Number(target.h) || 0;
            const targetTotalLoot = Number(target.totalAmount) || 0;

            let remainingBanditCount = targetBandits;
            let currentCarryingCapacity = 0;

            for (const id of selectedUnitIds) {
                const available = Engine.getUnitCount(id, armyData.army);
                if (available <= 0) continue;

                const stat = Simulator.getUnitStat(id);
                const unitCap = stat.yuk || 60;

                let sendForBandit = 0;
                if (remainingBanditCount > 0) {
                    sendForBandit = Math.min(available, remainingBanditCount);
                    remainingBanditCount -= sendForBandit;
                }

                if (sendForBandit > 0) {
                    calculatedArmy[id] = (calculatedArmy[id] || 0) + sendForBandit;
                    currentCarryingCapacity += sendForBandit * unitCap;
                }
            }

            if (remainingBanditCount > 0) return null;

            let remainingLootToCarry = Math.max(0, targetTotalLoot - currentCarryingCapacity);

            if (remainingLootToCarry > 0) {
                for (const id of selectedUnitIds) {
                    if (remainingLootToCarry <= 0) break;

                    const available = Engine.getUnitCount(id, armyData.army);
                    const alreadySent = calculatedArmy[id] || 0;
                    const canSendMore = available - alreadySent;

                    if (canSendMore <= 0) continue;

                    const stat = Simulator.getUnitStat(id);
                    const unitCap = stat.yuk || 60;

                    const neededUnitsForLoot = Math.ceil(remainingLootToCarry / unitCap);
                    const sendExtra = Math.min(canSendMore, neededUnitsForLoot);

                    if (sendExtra > 0) {
                        calculatedArmy[id] = (calculatedArmy[id] || 0) + sendExtra;
                        remainingLootToCarry -= (sendExtra * unitCap);
                    }
                }
            }

            return calculatedArmy;
        },

        fillRaidForm(army) {
            const inputs = [...document.querySelectorAll("input[type='number'], input.kadro-adet")].filter(e => e.offsetParent !== null);
            let filled = 0;
            const used = new Set();

            for (const [id, count] of Object.entries(army)) {
                const wantedName = Utils.norm(Engine.getUnitName(id));
                let bestInput = null;

                for (const inp of inputs) {
                    if (used.has(inp)) continue;
                    const row = inp.closest(".kadro-satir, .birim-satir, .unit-row, li, div");
                    const text = Utils.norm(row?.textContent);
                    if (text && (text.includes(wantedName) || wantedName.includes(text))) {
                        bestInput = inp;
                        break;
                    }
                }

                if (!bestInput) continue;
                const max = Number(bestInput.max);
                let val = Math.max(0, Math.floor(Number(count) || 0));
                if (Number.isFinite(max) && max > 0) val = Math.min(val, max);

                bestInput.value = String(val);
                Utils.fireEvent(bestInput);
                used.add(bestInput);
                filled++;
            }
            return filled;
        },

        findRaidButton() {
            const candidates = [...document.querySelectorAll("button, [role='button'], a, input[type='button']")].filter(e => e.offsetParent !== null);
            return candidates.find(e => {
                const t = Utils.norm(e.textContent || e.value);
                return t === "yağmala" || t === "yağmaya git" || t === "yağmaya çık" || t.includes("yağma") || t.includes("yağmala");
            }) || null;
        },

        closeRaidPopup() {
            try {
                const closeBtns = [...document.querySelectorAll(".popup-kapat, .modal-close, .kapat-btn, button.kapat, .km-kapat, [data-dismiss='modal']")].filter(e => e.offsetParent !== null);
                closeBtns.forEach(btn => { try { btn.click(); } catch (_) {} });

                if (typeof window.kutulariKapat === "function") window.kutulariKapat();
                if (typeof window.kutuKapat === "function") window.kutuKapat();
            } catch (_) {}
        },

        openRaidPopup(target, calculatedArmy) {
            return new Promise((resolve) => {
                this.closeRaidPopup();

                const coordKey = `${target.x}|${target.y}`;
                const raidTimes = GM_getValue(CONFIG.STORAGE_KEY_RAID_TIMES, {});
                raidTimes[coordKey] = Date.now();
                GM_setValue(CONFIG.STORAGE_KEY_RAID_TIMES, raidTimes);

                UI.updateStats(target.allLoot);

                try { if (typeof haritaGit === "function") haritaGit(target.x, target.y); } catch (_) {}

                let tries = 0;
                const waitTile = setInterval(() => {
                    tries++;
                    const tile = document.querySelector(`.karo[data-x="${target.x}"][data-y="${target.y}"]`);
                    if (tile) {
                        clearInterval(waitTile);
                        const rect = tile.getBoundingClientRect();
                        const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;

                        try {
                            ["pointerdown", "mousedown", "pointerup", "mouseup", "click"].forEach(type => {
                                const Ev = type.startsWith("pointer") ? PointerEvent : MouseEvent;
                                tile.dispatchEvent(new Ev(type, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, button: 0, buttons: type === "mousedown" ? 1 : 0 }));
                            });
                        } catch (_) { try { tile.click(); } catch (e) {} }

                        try {
                            const tileKey = target.k || (typeof HK !== "undefined" && typeof kkey === "function" ? HK.get(kkey(target.x, target.y)) : null);
                            if (tileKey && typeof karoMenuAc === "function") setTimeout(() => karoMenuAc(tileKey, target.x, target.y, cx, cy), 30);
                        } catch (_) {}

                        let menuTry = 0;
                        const waitMenu = setInterval(() => {
                            menuTry++;
                            const btn = this.findRaidButton();
                            if (btn) {
                                clearInterval(waitMenu);
                                try { btn.click(); } catch (_) { btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })); }

                                let formTries = 0;
                                const fillTimer = setInterval(() => {
                                    formTries++;
                                    const filled = this.fillRaidForm(calculatedArmy);
                                    const visibleInputs = [...document.querySelectorAll("input[type='number'], input.kadro-adet")].filter(e => e.offsetParent !== null).length;

                                    if (filled > 0 || visibleInputs > 0 || formTries > 40) {
                                        clearInterval(fillTimer);
                                        setTimeout(() => {
                                            this.closeRaidPopup();
                                            resolve();
                                        }, 300);
                                    }
                                }, 100);
                                return;
                            }

                            if (menuTry === 15 && typeof window.vahaKutusuAc === "function") {
                                try {
                                    window.vahaKutusuAc(target.k, target.x, target.y, true);
                                    clearInterval(waitMenu);

                                    let formTries = 0;
                                    const fillTimer = setInterval(() => {
                                        formTries++;
                                        const filled = this.fillRaidForm(calculatedArmy);
                                        const visibleInputs = [...document.querySelectorAll("input[type='number'], input.kadro-adet")].filter(e => e.offsetParent !== null).length;

                                        if (filled > 0 || visibleInputs > 0 || formTries > 40) {
                                            clearInterval(fillTimer);
                                            setTimeout(() => {
                                                this.closeRaidPopup();
                                                resolve();
                                            }, 300);
                                        }
                                    }, 100);
                                    return;
                                } catch (_) {}
                            }

                            if (menuTry > 50) {
                                clearInterval(waitMenu);
                                this.closeRaidPopup();
                                resolve();
                            }
                        }, 100);

                    } else if (tries > 50) {
                        clearInterval(waitTile);
                        this.closeRaidPopup();
                        resolve();
                    }
                }, 100);
            });
        },

        async processNextTarget() {
            if (!State.autoRaid || State.isLocked) return;

            const validTarget = State.targets.find(r => Automation.calculateRaidArmyForTarget(r) !== null);
            if (!validTarget) {
                if (State.targets.length === 0) {
                    Utils.say("Otomatik Mod: Uygun hedef kalmadı.", true);
                } else {
                    Utils.say("Otomatik Mod: Kalan hedefler için ordu yetersiz.", true);
                }
                State.autoRaid = false;
                const toggleBtn = document.querySelector("#ayb-auto-toggle");
                if (toggleBtn) {
                    toggleBtn.textContent = "▶ OTOMATİK MODU BAŞLAT";
                    toggleBtn.style.background = "#ffd43b";
                    toggleBtn.style.color = "#000";
                }
                return;
            }

            const btnList = document.querySelectorAll("#ayb-list .row");
            const targetIndex = State.targets.indexOf(validTarget);
            if (btnList[targetIndex]) {
                btnList[targetIndex].click();
            }
        }
    };

    const UI = {
        updateNewTargetsBadge() {
            const btn = document.querySelector("#ayb-show-new-modal");
            if (btn) {
                const count = State.newTargets.length;
                btn.textContent = `🔔 YENİ YAYLAKLAR (${count})`;
                if (count > 0) {
                    btn.style.borderColor = "#2ecc71";
                    btn.style.color = "#2ecc71";
                } else {
                    btn.style.borderColor = "#ffd43b";
                    btn.style.color = "#ffd43b";
                }
            }
        },

        saveArmySelections() {
            try {
                const box = document.querySelector("#ayb-army");
                if (!box) return;
                const obaKey = Engine.getObaKey();
                const all = GM_getValue(CONFIG.STORAGE_KEY_ARMY, {});
                all[obaKey] = all[obaKey] || {};

                box.querySelectorAll("input[type='checkbox'][data-unit]").forEach(inp => {
                    const id = inp.dataset.unit;
                    all[obaKey][id] = inp.checked;
                });

                GM_setValue(CONFIG.STORAGE_KEY_ARMY, all);
            } catch (_) {}
        },

        updateStats(loot = null) {
            const stats = GM_getValue(CONFIG.STORAGE_KEY_STATS, { count: 0, demir: 0, tas: 0, odun: 0, tahil: 0 });
            if (loot) {
                stats.count += 1;
                stats.demir += loot.demir || 0;
                stats.tas += loot.tas || 0;
                stats.odun += loot.odun || 0;
                stats.tahil += loot.tahil || 0;
                GM_setValue(CONFIG.STORAGE_KEY_STATS, stats);
            }

            const totalRes = stats.demir + stats.tas + stats.odun + stats.tahil;
            const reportEl = document.querySelector("#ayb-stats-details");
            if (reportEl) {
                reportEl.innerHTML = `
                    <div style="font-weight:900; color:#ffd43b; margin-bottom:5px; font-size:11px;">
                       ⚔ TOPLAM KAZANÇ: ${stats.count} Yaylak ( ~ ${Utils.fmtK(totalRes)})
                    </div>
                    <div class="res-details">
                       <span>⛏ ${Utils.fmtK(stats.demir)}</span>
                       <span>🪨 ${Utils.fmtK(stats.tas)}</span>
                       <span>🪵 ${Utils.fmtK(stats.odun)}</span>
                       <span>🌾 ${Utils.fmtK(stats.tahil)}</span>
                    </div>`;
            }
        },

        resetStats() {
            GM_setValue(CONFIG.STORAGE_KEY_STATS, { count: 0, demir: 0, tas: 0, odun: 0, tahil: 0 });
            this.updateStats();
            Utils.say("İstatistikler sıfırlandı.");
        },

        applyScale(scaleVal) {
            const panel = document.querySelector("#ayb");
            if (panel) {
                State.scale = Number(scaleVal) || 1.0;
                if (!panel.classList.contains("collapsed")) {
                    panel.style.transform = `scale(${State.scale})`;
                    panel.style.transformOrigin = "top right";
                }
                GM_setValue(CONFIG.STORAGE_KEY_SCALE, State.scale);
            }
        },

        runCooldown(ms) {
            return new Promise(resolve => {
                const progressBar = document.querySelector("#ayb-cd-progress");
                if (!progressBar) return resolve();

                const start = Date.now();
                const end = start + ms;

                if (State.cdTimer) clearInterval(State.cdTimer);

                State.cdTimer = setInterval(() => {
                    const now = Date.now();
                    const remaining = end - now;

                    if (remaining <= 0) {
                        clearInterval(State.cdTimer);
                        progressBar.style.width = "0%";
                        resolve();
                    } else {
                        const percent = (remaining / ms) * 100;
                        progressBar.style.width = `${percent}%`;
                    }
                }, 50);
            });
        },

        renderArmy() {
            const box = document.querySelector("#ayb-army");
            if (!box) return false;

            const data = Engine.getArmyData();
            if (!data.ids.length) {
                box.innerHTML = "<div class='empty'>Ordu bekleniyor...</div>";
                return false;
            }

            const obaKey = Engine.getObaKey();
            const saved = (GM_getValue(CONFIG.STORAGE_KEY_ARMY, {})[obaKey]) || {};
            box.innerHTML = "";

            data.ids.forEach(id => {
                const unitName = Engine.getUnitName(id);
                if (CONFIG.EXCLUDE_UNITS.has(Utils.norm(unitName))) return;

                const available = Engine.getUnitCount(id, data.army);
                if (available <= 0) return;

                const isChecked = saved[id] !== undefined ? saved[id] : true;

                const row = document.createElement("div");
                row.className = "army-row";
                row.style.display = "flex";
                row.style.justifyContent = "space-between";
                row.style.alignItems = "center";
                row.innerHTML = `
                    <div class="army-name"><b>${unitName}</b><small>Mevcut: ${Utils.fmt(available)}</small></div>
                    <div>
                        <label class="custom-checkbox">
                            <input type="checkbox" data-unit="${id}" ${isChecked ? "checked" : ""}>
                            Kullan
                        </label>
                    </div>`;

                row.querySelector("input[type='checkbox']").addEventListener("change", () => this.saveArmySelections());
                box.appendChild(row);
            });
            return true;
        },

        getSelectedUnitTypes() {
            const selected = [];
            document.querySelectorAll("#ayb-army input[type='checkbox'][data-unit]:checked").forEach(chk => selected.push(chk.dataset.unit));
            return selected;
        },

        clearMarks() {
            document.querySelectorAll(".ayb-mark").forEach(e => e.remove());
            document.querySelectorAll(".ayb-hit").forEach(e => e.classList.remove("ayb-hit"));
        },

        paintMap() {
            this.clearMarks();
            for (const r of State.targets) {
                let coords = [{ x: r.x, y: r.y }];
                try { if (r.k.tur === "supervaha" && typeof svKarolar === "function") coords = svKarolar(r.k) || coords; } catch (_) {}

                for (const c of coords) {
                    const el = document.querySelector(`.karo[data-x="${c.x}"][data-y="${c.y}"]`);
                    if (!el) continue;
                    el.classList.add("ayb-hit");

                    const mark = document.createElement("div");
                    mark.className = "ayb-mark";
                    mark.innerHTML = `<b>💰 ${Utils.fmtK(r.totalAmount)}</b>`;
                    el.appendChild(mark);
                }
            }
        },

        showChangelogModal() {
            const oldModal = document.getElementById("ayb-changelog-modal");
            if (oldModal) oldModal.remove();

            const modal = document.createElement("div");
            modal.id = "ayb-changelog-modal";
            modal.innerHTML = `
                <div class="ayb-modal-content">
                    <div class="ayb-modal-header">
                        <b>📋 Ali System - Güncelleme Notları</b>
                        <button class="ayb-modal-close">×</button>
                    </div>
                    <div class="ayb-modal-body">
                        ${CHANGELOG.map(item => `
                            <div class="changelog-item">
                                <div class="changelog-ver">
                                    <span style="color:#ffd43b; font-size:13px; font-weight:bold;">${item.version}</span>
                                    <span style="color:#ffd43b; font-size:11px; font-weight:bold;">${item.date}</span>
                                </div>
                                <ul>
                                    ${item.notes.map(note => `<li>${note}</li>`).join("")}
                                </ul>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector(".ayb-modal-close").onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
        },

        showNewTargetsModal() {
            const oldModal = document.getElementById("ayb-new-modal");
            if (oldModal) oldModal.remove();

            const modal = document.createElement("div");
            modal.id = "ayb-new-modal";

            let tableRows = "";
            if (State.newTargets.length === 0) {
                tableRows = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#777; font-style:italic;">Son otomatik taramada yeni çıkan bir yaylak yok.</td></tr>`;
            } else {
                State.newTargets.forEach((r, i) => {
                    const reqArmy = Automation.calculateRaidArmyForTarget(r);
                    const reqTotal = reqArmy ? Object.values(reqArmy).reduce((a, b) => a + b, 0) : 0;
                    const isSafe = reqArmy !== null;

                    tableRows += `
                        <tr class="yaylak-table-row" data-index="${i}">
                            <td><b>#${i + 1}</b></td>
                            <td><span style="color:#2ecc71; font-weight:bold;">${r.x} | ${r.y}</span></td>
                            <td><b style="color:#fff;">${r.origin}</b></td>
                            <td>⏱ ${Utils.tm(r.sec)}</td>
                            <td><span style="color:#ff4b4b;">⚔ ${r.h}</span></td>
                            <td>${isSafe ? `<b style="color:#ffd43b;">♞ ${Utils.fmt(reqTotal)}</b>` : `<b style="color:#ff4b4b;">⚠ Yetersiz</b>`}</td>
                            <td>
                                <div style="display:flex; gap:6px; font-size:0.9em; color:#aaa;">
                                    <span>⛏ ${Utils.fmtK(r.allLoot.demir)}</span>
                                    <span>🪨 ${Utils.fmtK(r.allLoot.tas)}</span>
                                    <span>🪵 ${Utils.fmtK(r.allLoot.odun)}</span>
                                    <span>🌾 ${Utils.fmtK(r.allLoot.tahil)}</span>
                                    <b style="color:#ffd43b; margin-left:auto;">∑ ${Utils.fmt(r.totalAmount)}</b>
                                </div>
                            </td>
                            <td>
                                <button class="table-action-btn" data-coord="${r.coordKey}">⚡ Vur</button>
                            </td>
                        </tr>
                    `;
                });
            }

            modal.innerHTML = `
                <div class="ayb-modal-content" style="width:920px; max-width:95vw;">
                    <div class="ayb-modal-header" style="border-color:#2ecc71;">
                        <b style="color:#2ecc71;">🔔 YENİ TESPİT EDİLEN YAYLAKLAR (${State.newTargets.length} Adet)</b>
                        <button class="ayb-modal-close">×</button>
                    </div>
                    <div class="ayb-modal-body" style="padding:10px;">
                        <div class="filter-bar-modal">
                            <label>🔤 Yazı Boyutu:</label>
                            <select id="modal-font-size-select">
                                <option value="9px" ${State.modalFontSize === '9px' ? 'selected' : ''}>%80 (Küçük)</option>
                                <option value="11px" ${State.modalFontSize === '11px' ? 'selected' : ''}>%100 (Normal)</option>
                                <option value="13px" ${State.modalFontSize === '13px' ? 'selected' : ''}>%120 (Büyük)</option>
                                <option value="15px" ${State.modalFontSize === '15px' ? 'selected' : ''}>%140 (Mega)</option>
                            </select>
                        </div>
                        <table class="yaylak-table" style="font-size: ${State.modalFontSize};">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Koordinat</th>
                                    <th>Kaynak Konum</th>
                                    <th>Süre</th>
                                    <th>Haydut</th>
                                    <th>Gönderilecek</th>
                                    <th>Ganimet Dağılımı</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector(".ayb-modal-close").onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            modal.querySelector("#modal-font-size-select").onchange = (e) => {
                State.modalFontSize = e.target.value;
                GM_setValue(CONFIG.STORAGE_KEY_FONT_SIZE, State.modalFontSize);
                modal.querySelector(".yaylak-table").style.fontSize = State.modalFontSize;
            };

            modal.querySelectorAll(".table-action-btn").forEach(btn => {
                btn.onclick = () => {
                    const coordKey = btn.dataset.coord;
                    const targetIndex = State.targets.findIndex(t => t.coordKey === coordKey);
                    const btnList = document.querySelector("#ayb-list .row");
                    if (targetIndex !== -1 && btnList) {
                        modal.remove();
                        const targetBtn = document.querySelectorAll("#ayb-list .row")[targetIndex];
                        if (targetBtn) targetBtn.click();
                    }
                };
            });
        },

        showYaylakListModal() {
            const oldModal = document.getElementById("ayb-yaylak-modal");
            if (oldModal) oldModal.remove();

            const modal = document.createElement("div");
            modal.id = "ayb-yaylak-modal";

            let tableRows = "";
            if (State.targets.length === 0) {
                tableRows = `<tr><td colspan="8" style="text-align:center; padding:20px; color:#777; font-style:italic;">Aktif yaylak bulunamadı. Otomatik tarama bekleniyor...</td></tr>`;
            } else {
                State.targets.forEach((r, i) => {
                    const reqArmy = Automation.calculateRaidArmyForTarget(r);
                    const reqTotal = reqArmy ? Object.values(reqArmy).reduce((a, b) => a + b, 0) : 0;
                    const isSafe = reqArmy !== null;

                    tableRows += `
                        <tr class="yaylak-table-row" data-index="${i}">
                            <td><b>#${i + 1}</b></td>
                            <td><span style="color:#ffd43b; font-weight:bold;">${r.x} | ${r.y}</span></td>
                            <td><b style="color:#fff;">${r.origin}</b></td>
                            <td>⏱ ${Utils.tm(r.sec)}</td>
                            <td><span style="color:#ff4b4b;">⚔ ${r.h}</span></td>
                            <td>${isSafe ? `<b style="color:#ffd43b;">♞ ${Utils.fmt(reqTotal)}</b>` : `<b style="color:#ff4b4b;">⚠ Yetersiz</b>`}</td>
                            <td>
                                <div style="display:flex; gap:6px; font-size:0.9em; color:#aaa;">
                                    <span>⛏ ${Utils.fmtK(r.allLoot.demir)}</span>
                                    <span>🪨 ${Utils.fmtK(r.allLoot.tas)}</span>
                                    <span>🪵 ${Utils.fmtK(r.allLoot.odun)}</span>
                                    <span>🌾 ${Utils.fmtK(r.allLoot.tahil)}</span>
                                    <b style="color:#ffd43b; margin-left:auto;">∑ ${Utils.fmt(r.totalAmount)}</b>
                                </div>
                            </td>
                            <td>
                                <button class="table-action-btn" data-index="${i}">⚡ Vur</button>
                            </td>
                        </tr>
                    `;
                });
            }

            modal.innerHTML = `
                <div class="ayb-modal-content" style="width:920px; max-width:95vw;">
                    <div class="ayb-modal-header">
                        <b>🏹 AKTİF YAYLAK LİSTESİ (${State.targets.length} Hedef)</b>
                        <button class="ayb-modal-close">×</button>
                    </div>
                    <div class="ayb-modal-body" style="padding:10px;">
                        <div class="filter-bar-modal">
                            <label>Sıralama Kriteri:</label>
                            <select id="modal-sort-by">
                                <option value="ganimet" ${State.sortBy === 'ganimet' ? 'selected' : ''}>💰 Ganimete Göre</option>
                                <option value="mesafe" ${State.sortBy === 'mesafe' ? 'selected' : ''}>⏱ Uzaklığa / Süreye Göre</option>
                                <option value="konum" ${State.sortBy === 'konum' ? 'selected' : ''}>📍 Kaynak Konuma Göre</option>
                                <option value="haydut" ${State.sortBy === 'haydut' ? 'selected' : ''}>⚔ Haydut Sayısına Göre</option>
                            </select>

                            <button id="modal-sort-order-btn" title="Sıralama Yönü">
                                ${State.sortOrder === 'desc' ? '⬇ Büyükten Küçüğe' : '⬆ Küçükten Büyüğe'}
                            </button>

                            <label style="margin-left:auto;">🔤 Yazı Boyutu:</label>
                            <select id="modal-font-size-select">
                                <option value="9px" ${State.modalFontSize === '9px' ? 'selected' : ''}>%80 (Küçük)</option>
                                <option value="11px" ${State.modalFontSize === '11px' ? 'selected' : ''}>%100 (Normal)</option>
                                <option value="13px" ${State.modalFontSize === '13px' ? 'selected' : ''}>%120 (Büyük)</option>
                                <option value="15px" ${State.modalFontSize === '15px' ? 'selected' : ''}>%140 (Mega)</option>
                            </select>
                        </div>

                        <table class="yaylak-table" style="font-size: ${State.modalFontSize};">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Koordinat</th>
                                    <th>Kaynak Konum</th>
                                    <th>Süre</th>
                                    <th>Haydut</th>
                                    <th>Gönderilecek</th>
                                    <th>Ganimet Dağılımı</th>
                                    <th>İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRows}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            modal.querySelector(".ayb-modal-close").onclick = () => modal.remove();
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

            modal.querySelector("#modal-font-size-select").onchange = (e) => {
                State.modalFontSize = e.target.value;
                GM_setValue(CONFIG.STORAGE_KEY_FONT_SIZE, State.modalFontSize);
                modal.querySelector(".yaylak-table").style.fontSize = State.modalFontSize;
            };

            modal.querySelector("#modal-sort-by").onchange = (e) => {
                State.sortBy = e.target.value;
                const selectOnPanel = document.querySelector("#ayb-sort-by");
                if (selectOnPanel) selectOnPanel.value = State.sortBy;
                Engine.sortTargetsList();
                this.showYaylakListModal();
                this.renderTargetsList();
            };

            modal.querySelector("#modal-sort-order-btn").onclick = () => {
                State.sortOrder = State.sortOrder === "desc" ? "asc" : "desc";
                const btnOnPanel = document.querySelector("#ayb-sort-order-btn");
                if (btnOnPanel) btnOnPanel.textContent = State.sortOrder === "desc" ? "⬇" : "⬆";
                Engine.sortTargetsList();
                this.showYaylakListModal();
                this.renderTargetsList();
            };

            modal.querySelectorAll(".table-action-btn, .yaylak-table-row").forEach(el => {
                el.onclick = (e) => {
                    const idx = el.dataset.index;
                    const btnList = document.querySelectorAll("#ayb-list .row");
                    if (btnList[idx]) {
                        modal.remove();
                        btnList[idx].click();
                    }
                };
            });
        },

        renderTargetsList() {
            const box = document.querySelector("#ayb-list");
            if (!box) return;
            box.innerHTML = State.targets.length ? "" : "<div class='empty'>Tüm hedefler temizlendi veya menzilde uygun yaylak yok.</div>";

            State.targets.forEach((r, i) => {
                const reqArmy = Automation.calculateRaidArmyForTarget(r);
                const reqTotal = reqArmy ? Object.values(reqArmy).reduce((a, b) => a + b, 0) : 0;
                const isSafe = reqArmy !== null;

                const row = document.createElement("button");
                row.className = "row";

                const capBadge = isSafe
                    ? `<span style="color:#ffd43b; font-weight:bold;">♞ ${Utils.fmt(reqTotal)} Asker (Tam Kapasite)</span>`
                    : `<span style="color:#ff4b4b; font-weight:bold;">⚠ ORDU YETERSİZ</span>`;

                row.innerHTML = `
                    <div style="display:flex; justify-content:space-between; width:100%; border-bottom:1px dashed #333; padding-bottom:5px; margin-bottom:5px;">
                        <b>#${i + 1} Yaylak (${r.x}|${r.y}) <span style="color:#ffd43b; font-weight:normal;">[${r.origin}]</span></b>
                        <span style="color:#aaa; font-size:10px;">${Utils.tm(r.sec)} ⏱</span>
                    </div>
                    <div class="res-details">
                       <span>⛏ ${Utils.fmtK(r.allLoot.demir)}</span>
                       <span>🪨 ${Utils.fmtK(r.allLoot.tas)}</span>
                       <span>🪵 ${Utils.fmtK(r.allLoot.odun)}</span>
                       <span>🌾 ${Utils.fmtK(r.allLoot.tahil)}</span>
                       <span class="total-res" style="margin-left:auto;">∑ ${Utils.fmt(r.totalAmount)}</span>
                    </div>
                    <div style="margin-top:6px; font-size:9px; display:flex; justify-content:space-between;">
                        <span style="color:${isSafe ? '#aaa' : '#ff4b4b'}">⚔ Haydut: ${r.h}</span>
                        ${capBadge}
                    </div>`;

                row.onclick = async () => {
                    if (State.isLocked) {
                        Utils.say("⚠ Güvenlik kalkanı aktif, lütfen sayacın bitmesini bekleyin.", true);
                        return;
                    }

                    if (!isSafe) {
                        Utils.say("Bu yaylaktaki ganimeti boşaltacak veya haydutları kesecek ordu yetersiz.", true);
                        return;
                    }

                    State.isLocked = true;

                    try {
                        const currentOriginKey = r.originKey;
                        const isNewOrigin = State.lastOriginKey && State.lastOriginKey !== currentOriginKey;
                        State.lastOriginKey = currentOriginKey;

                        const coordKey = `${r.x}|${r.y}`;
                        State.sentTargets.add(coordKey);
                        State.targets = State.targets.filter(t => !(t.x === r.x && t.y === r.y));
                        State.newTargets = State.newTargets.filter(t => !(t.x === r.x && t.y === r.y));
                        this.updateNewTargetsBadge();
                        this.paintMap();
                        this.renderTargetsList();

                        if (isNewOrigin) {
                            const waitTime = Utils.randomRange(8500, 13500);
                            Utils.say(`⏱ Tuğ Meydanı > ${r.origin} konumuna geçiliyor...`);
                            await this.runCooldown(waitTime);

                            Utils.say("Hedef vuruluyor...");
                            await Automation.openRaidPopup(r, reqArmy);
                            Utils.say("✅ Askerler yola çıktı. Sıradaki hedef hazırlanıyor...");
                        } else {
                            Utils.say("Hedef vuruluyor...");
                            await Automation.openRaidPopup(r, reqArmy);

                            const randomDelaySec = Utils.randomRange(3, 10);
                            const waitTime = randomDelaySec * 1000;

                            Utils.say(`⏱ Askerler yolda. Dinamik soğuma aktif (${randomDelaySec} sn)...`);
                            await this.runCooldown(waitTime);
                            Utils.say("✅ Sistem Hazır. Sıradaki hedef işleniyor...");
                        }
                    } catch (e) {
                        console.error(e);
                    } finally {
                        State.isLocked = false;
                        Automation.closeRaidPopup();
                        if (State.autoRaid) {
                            setTimeout(() => Automation.processNextTarget(), 800);
                        }
                    }
                };
                box.appendChild(row);
            });
        },

        injectStyles() {
            const css = `
             #ayb { position:fixed; right:22px; top:20px; bottom:20px; width:440px; height:calc(100vh - 40px); max-height:calc(100vh - 40px); box-sizing:border-box; z-index:2147483647; color:#eee; background:#0d0d0d; border:1px solid #ffd43b; border-radius:12px; box-shadow:0 15px 40px rgba(0,0,0,0.9), 0 0 15px rgba(255,212,59,0.1); font:12px "Segoe UI",Arial,sans-serif; overflow:hidden; transition: width 0.2s, height 0.2s, border-radius 0.2s; display:flex; flex-direction:column; }
             #ayb * { box-sizing:border-box; }

             #ayb.collapsed { width:44px!important; height:44px!important; min-width:44px!important; min-height:44px!important; border-radius:50%!important; background:#111!important; border:2px solid #ffd43b!important; padding:0; box-shadow:0 5px 15px rgba(0,0,0,0.8); cursor:pointer; }
             #ayb.collapsed #ayb-body { display:none!important; }
             #ayb.collapsed #ayb-head { height:100%!important; padding:0!important; background:transparent!important; border:none!important; display:flex; align-items:center; justify-content:center; cursor:pointer; width:100%!important; }
             #ayb.collapsed #ayb-title, #ayb.collapsed #ayb-collapse { display:none!important; }
             #ayb.collapsed #ayb-emblem { border:none; width:100%; height:100%; background:transparent; box-shadow:none; display:flex; align-items:center; justify-content:center; font-size:22px; }

             #ayb-head { position:relative; z-index:5; height:46px; min-height:46px; padding:0 12px; display:flex; align-items:center; gap:10px; background:linear-gradient(90deg,#000,#111); border-bottom:1px solid #333; cursor:move; user-select:none; }
             #ayb-emblem { width:26px; height:26px; border:1px solid #ffd43b; border-radius:50%; display:grid; place-items:center; color:#ffd43b; background:rgba(255,212,59,0.1); font-size:14px; box-shadow: 0 0 5px rgba(255,212,59,0.3); }
             #ayb-title { flex:1; min-width:0; }
             #ayb-title b { display:block; color:#ffd43b; font:700 13px "Segoe UI",sans-serif; letter-spacing:0.5px; }
             #ayb-title small { display:block; color:#777; font-size:9px; letter-spacing:1px; margin-top:2px; }
             #ayb-collapse { width:26px; height:26px; border:1px solid #333!important; background:#111!important; color:#ffd43b!important; border-radius:6px!important; font-size:15px; cursor:pointer; transition:all 0.2s; }
             #ayb-collapse:hover { background:#ffd43b!important; color:#000!important; }

             #ayb-body { position:relative; z-index:2; flex:1; height:calc(100% - 46px); overflow:auto; padding:12px; display:flex; flex-direction:column; }
             #ayb-body::-webkit-scrollbar, #ayb-list::-webkit-scrollbar { width:6px; }
             #ayb-body::-webkit-scrollbar-thumb, #ayb-list::-webkit-scrollbar-thumb { background:#ffd43b; border-radius:8px; }

             .ayb-section { border:1px solid #222; background:#111; border-radius:8px; padding:10px; margin-bottom:10px; flex-shrink:0; }
             .ayb-section-title { color:#aaa; font:700 10px "Segoe UI",sans-serif; letter-spacing:0.5px; margin:0 0 8px; padding-bottom:6px; border-bottom:1px dashed #333; }

             #ayb label { display:block; margin:6px 0 2px; font-size:9px; color:#888; letter-spacing:.5px; }
             #ayb input, #ayb select { width:100%; height:30px; padding:5px 8px; background:#000; color:#fff; border:1px solid #333; border-radius:6px; outline:none; transition:border 0.2s; }
             #ayb input:focus, #ayb select:focus { border-color:#ffd43b; }

             .custom-checkbox { display:inline-flex; align-items:center; gap:5px; cursor:pointer; color:#ffd43b; font-weight:bold; margin:0; font-size:10px; }
             .custom-checkbox input { width:16px!important; height:16px!important; margin:0!important; accent-color:#ffd43b; cursor:pointer; }

             .resource-picker { display:grid; grid-template-columns:repeat(5,1fr); gap:4px; margin-top:5px; }
             .res-btn { display:flex!important; align-items:center; justify-content:center; gap:2px; height:34px; padding:2px!important; background:#000!important; color:#888!important; border:1px solid #333!important; border-radius:6px!important; font-size:8px!important; cursor:pointer; transition:all 0.2s; }
             .res-btn.active { background:#ffd43b!important; border-color:#ffd43b!important; color:#000!important; font-weight:bold; }

             .ayb-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }

             #ayb-army { max-height:140px; overflow:auto; padding-right:3px; }
             .army-row { padding:7px 0; border-bottom:1px dashed #222; }
             .army-name { display:flex; justify-content:space-between; color:#eee; font-size:11px; }
             .army-name small { color:#777; font-weight:normal; }

             .auto-btn { width:100%; padding:10px; background:#ffd43b!important; color:#000!important; font-weight:bold; border:none!important; cursor:pointer; border-radius:8px; transition:all 0.2s; flex-shrink:0; }
             .auto-btn:hover { filter:brightness(1.1); }

             .scan-btn { width:100%; margin-top:6px; padding:9px; background:#2ecc71!important; color:#000!important; font-weight:bold; border:none!important; cursor:pointer; border-radius:8px; transition:all 0.2s; flex-shrink:0; }
             .scan-btn:hover { filter:brightness(1.1); }

             .list-view-btn { width:100%; margin-top:6px; padding:8px; background:#1a1a1a!important; color:#ffd43b!important; border:1px solid #ffd43b!important; font-weight:bold; cursor:pointer; border-radius:8px; transition:all 0.2s; flex-shrink:0; }
             .list-view-btn:hover { background:#ffd43b!important; color:#000!important; }

             .new-view-btn { width:100%; margin-top:6px; padding:8px; background:#000!important; color:#ffd43b!important; border:1px solid #ffd43b!important; font-weight:bold; cursor:pointer; border-radius:8px; transition:all 0.2s; flex-shrink:0; }
             .new-view-btn:hover { background:#111!important; }

             .clear { width:100%; margin-top:6px; padding:8px; background:#000!important; color:#777!important; border:1px dashed #333!important; cursor:pointer; border-radius:8px; transition:all 0.2s; flex-shrink:0; }
             .clear:hover { background:#111!important; color:#aaa!important; border-color:#555!important; }

             .changelog-btn { width:100%; margin-top:6px; padding:7px; background:#111!important; color:#ffd43b!important; border:1px solid #333!important; cursor:pointer; border-radius:8px; font-weight:bold; font-size:10px; transition:all 0.2s; flex-shrink:0; }
             .changelog-btn:hover { background:#222!important; border-color:#ffd43b!important; }

             #ayb-status { position:relative; margin:10px 0; padding:10px; min-height:36px; background:#111; border:1px solid #333; color:#ffd43b; font-size:10px; font-weight:bold; border-radius:6px; overflow:hidden; flex-shrink:0; }
             #ayb-cd-progress { position:absolute; bottom:0; left:0; height:3px; background:#ff4b4b; width:0%; transition:width 0.05s linear; }

             .targets-section { margin-top:10px; border:none; background:transparent; padding:0; flex:1; display:flex; flex-direction:column; min-height:150px; overflow:hidden; }
             #ayb-list { flex:1; overflow:auto; padding-right:5px; }
             .row { width:100%; text-align:left; margin-top:6px; padding:10px; background:#0a0a0a!important; color:#eee!important; border:1px solid #333!important; border-radius:8px!important; cursor:pointer; transition:all 0.15s; }
             .row:hover { border-color:#ffd43b!important; background:#111!important; transform:translateX(3px); }
             .row b { display:block; color:#fff; font-size:11px; }

             .res-details { display:flex; gap:6px; margin-top:6px; font-size:9px; color:#888; flex-wrap:wrap; }
             .res-details span { background:#111; border:1px solid #222; padding:3px 6px; border-radius:4px; }
             .res-details .total-res { color:#000; font-weight:bold; background:#ffd43b; border-color:#ffd43b; }

             .empty { padding:15px; color:#555; text-align:center; font-style:italic; }
             .ayb-hit { position:relative!important; box-shadow:inset 0 0 0 3px #ffd43b!important; }
             .ayb-mark { position:absolute!important; top:1px; left:50%; transform:translateX(-50%); z-index:999999; background:#000; border:1px solid #ffd43b; border-radius:4px; padding:2px 5px; color:#ffd43b; font:10px Arial; font-weight:bold; white-space:nowrap; pointer-events:none; box-shadow:0 2px 10px rgba(0,0,0,0.8); }

             #ayb-footer { margin-top:auto; padding-top:10px; text-align:center; border-top:1px solid #222; color:#555; font-size:10px; font-weight:bold; letter-spacing:1px; text-transform:uppercase; flex-shrink:0; }

             /* MODAL & TABLE STYLES */
             #ayb-changelog-modal, #ayb-yaylak-modal, #ayb-new-modal { position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.85); z-index:2147483648; display:flex; align-items:center; justify-content:center; }
             .ayb-modal-content { background:#111; border:1px solid #ffd43b; border-radius:12px; width:480px; max-width:90vw; max-height:85vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.9); }
             .ayb-modal-header { padding:12px 16px; background:#000; border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; color:#ffd43b; font-size:13px; }
             .ayb-modal-header button { background:transparent; border:none; color:#aaa; font-size:20px; cursor:pointer; }
             .ayb-modal-header button:hover { color:#fff; }
             .ayb-modal-body { padding:16px; overflow:auto; color:#ccc; font-size:11px; }

             .filter-bar-modal { display:flex; gap:10px; align-items:center; margin-bottom:12px; background:#000; padding:8px 12px; border-radius:8px; border:1px solid #222; font-size:11px; }
             .filter-bar-modal select { background:#111; color:#ffd43b; border:1px solid #333; border-radius:6px; padding:4px 8px; outline:none; font-size:11px; }
             .filter-bar-modal button { background:#ffd43b; color:#000; font-weight:bold; border:none; border-radius:6px; padding:5px 12px; cursor:pointer; font-size:11px; }

             .changelog-item { margin-bottom:15px; border-bottom:1px dashed #333; padding-bottom:10px; }
             .changelog-ver { display:flex; justify-content:space-between; color:#ffd43b; font-weight:bold; font-size:12px; margin-bottom:6px; }
             .changelog-item ul { margin:0; padding-left:18px; }
             .changelog-item li { margin-bottom:4px; line-height:1.4; color:#eee; }

             .yaylak-table { width:100%; border-collapse:collapse; text-align:left; }
             .yaylak-table th { background:#000; color:#ffd43b; padding:10px 8px; border-bottom:2px solid #333; font-weight:bold; }
             .yaylak-table td { padding:8px; border-bottom:1px solid #222; color:#eee; }
             .yaylak-table-row { transition:background 0.2s; cursor:pointer; }
             .yaylak-table-row:hover { background:#1a1a1a; }
             .table-action-btn { background:#ffd43b; color:#000; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:0.9em; }
             .table-action-btn:hover { background:#fff; }
            `;
            if (typeof GM_addStyle !== "undefined") {
                GM_addStyle(css);
            } else {
                const style = document.createElement("style");
                style.textContent = css;
                document.head.appendChild(style);
            }
        },

        init() {
            this.injectStyles();

            State.modalFontSize = GM_getValue(CONFIG.STORAGE_KEY_FONT_SIZE, "11px");

            const p = document.createElement("div");
            p.id = "ayb";
            p.innerHTML = `
              <div id="ayb-head">
               <div id="ayb-emblem">🐺</div>
               <div id="ayb-title"><b>Ali System Otomatik Yağma</b><small>V1.5.0 BOYDAN MOD</small></div>
               <button id="ayb-collapse" title="Aç / Kapat (K kısayolu)">−</button>
              </div>
              <div id="ayb-body">

               <div class="ayb-section" style="display:flex; justify-content:space-between; align-items:center;">
                  <div id="ayb-stats-details"></div>
                  <div style="display:flex; gap:4px;">
                    <button id="manual-scan-icon-btn" title="Şimdi Taramayı Tetikle" style="background:#000; border:1px solid #ffd43b; color:#ffd43b; width:30px; height:30px; border-radius:6px; cursor:pointer; transition:all 0.2s; font-weight:bold;">⚡</button>
                    <button id="reset-stats-btn" title="Sayacı Sıfırla" style="background:#000; border:1px solid #333; color:#aaa; width:30px; height:30px; border-radius:6px; cursor:pointer; transition:all 0.2s;">🔄</button>
                  </div>
               </div>

               <div class="ayb-section">
                <div class="ayb-section-title">⚔ BİRLİK SEÇİMİ (Kullanılacak türleri seçin)</div>
                <div id="ayb-army"><div class="empty">Ordu verileri bekleniyor...</div></div>
               </div>

               <div class="ayb-section">
                <div class="ayb-section-title">
                    <span>⌖ FİLTRELER & TARAMA AYARLARI</span>
                    <label style="display:inline-flex; align-items:center; gap:5px; margin:0; cursor:pointer; color:#ffd43b;">
                        <input type="checkbox" id="ayb-use-karargah" checked style="width:14px; height:14px; margin:0;"> Karargahlar Dahil
                    </label>
                </div>

                <div class="resource-picker" id="resource-picker">
                  <button type="button" class="res-btn active" data-res="hepsi"><span>🌐 HEPSİ</span></button>
                  <button type="button" class="res-btn" data-res="demir"><span>⛏ DEMİR</span></button>
                  <button type="button" class="res-btn" data-res="tas"><span>🪨 TAŞ</span></button>
                  <button type="button" class="res-btn" data-res="odun"><span>🪵 ODUN</span></button>
                  <button type="button" class="res-btn" data-res="tahil"><span>🌾 TAHIL</span></button>
                </div>
                <input id="r" type="hidden" value="hepsi">

                <div class="ayb-grid" style="margin-top:10px;">
                 <div><label>Min. Toplam Ganimet</label><input id="min" type="number" value="5000"></div>
                 <div><label>Min. Haydut Sayısı</label><input id="minh" type="number" value="0"></div>
                 <div><label>Maks. Mesafe (Dk)</label><input id="max" type="number" value="90"></div>
                </div>

                <div style="margin-top:10px; display:flex; gap:6px; align-items:center;">
                    <div style="flex:1;">
                        <label>Sıralama Ölçütü</label>
                        <select id="ayb-sort-by">
                            <option value="ganimet" selected>💰 Ganimete Göre</option>
                            <option value="mesafe">⏱ Uzaklığa Göre</option>
                            <option value="konum">📍 Kaynak Konuma Göre</option>
                            <option value="haydut">⚔ Haydut Sayısına Göre</option>
                        </select>
                    </div>
                    <div style="width:40px;">
                        <label>Yön</label>
                        <button id="ayb-sort-order-btn" style="width:100%; height:30px; background:#000; color:#ffd43b; border:1px solid #333; border-radius:6px; font-weight:bold; cursor:pointer;" title="Sıralama Yönünü Değiştir">⬇</button>
                    </div>
                    <div style="flex:1;">
                        <label>🔍 Panel Boyutu</label>
                        <select id="ayb-scale">
                            <option value="0.8">%80 (Küçük)</option>
                            <option value="0.9">%90 (Kompakt)</option>
                            <option value="1.0" selected>%100 (Normal)</option>
                            <option value="1.1">%110 (Büyük)</option>
                            <option value="1.2">%120 (Mega)</option>
                        </select>
                    </div>
                </div>

               </div>

               <button class="auto-btn" id="ayb-auto-toggle">▶ OTOMATİK MODU BAŞLAT</button>
               <button class="scan-btn" id="ayb-manual-scan">⚡ ŞİMDİ MANUEL TARAMA YAP</button>
               <button class="new-view-btn" id="ayb-show-new-modal">🔔 YENİ YAYLAKLAR (0)</button>
               <button class="list-view-btn" id="ayb-show-yaylak-modal">📋 TÜM YAYLAK LİSTESİ (PENCERE)</button>
               <button class="changelog-btn" id="ayb-changelog-btn">📋 SÜRÜM NOTLARI / YENİLİKLER</button>
               <button class="clear" id="cl">⌫ LİSTEYİ TEMİZLE</button>

               <div id="ayb-status">
                  <span id="ayb-status-text">Sistem Hazır. 30 Dk. Otomatik + Manuel Tarama Aktif.</span>
                  <div id="ayb-cd-progress"></div>
               </div>

               <div class="ayb-section targets-section">
                <div class="ayb-section-title" style="color:#777; border-color:#222;">🏹 AKTİF YAYLAKLAR</div>
                <div id="ayb-list"></div>
               </div>

               <div id="ayb-footer">Ali Bilik System</div>
              </div>`;

            document.body.appendChild(p);

            const savedScale = GM_getValue(CONFIG.STORAGE_KEY_SCALE, 1.0);
            p.querySelector("#ayb-scale").value = String(savedScale);
            this.applyScale(savedScale);

            p.querySelector("#ayb-scale").onchange = e => {
                this.applyScale(e.target.value);
            };

            p.querySelector("#ayb-use-karargah").onchange = e => {
                State.useKarargah = e.target.checked;
            };

            p.querySelector("#ayb-sort-by").onchange = e => {
                State.sortBy = e.target.value;
                Engine.sortTargetsList();
                this.renderTargetsList();
            };

            p.querySelector("#ayb-sort-order-btn").onclick = e => {
                State.sortOrder = State.sortOrder === "desc" ? "asc" : "desc";
                e.target.textContent = State.sortOrder === "desc" ? "⬇" : "⬆";
                Engine.sortTargetsList();
                this.renderTargetsList();
            };

            const triggerManualScan = () => {
                Utils.say("Harita taranıyor...");
                Engine.scan();
            };

            p.querySelector("#manual-scan-icon-btn").onclick = triggerManualScan;
            p.querySelector("#ayb-manual-scan").onclick = triggerManualScan;

            p.querySelector("#reset-stats-btn").onclick = () => {
                this.resetStats();
            };

            p.querySelector("#ayb-changelog-btn").onclick = () => {
                this.showChangelogModal();
            };

            p.querySelector("#ayb-show-yaylak-modal").onclick = () => {
                this.showYaylakListModal();
            };

            p.querySelector("#ayb-show-new-modal").onclick = () => {
                this.showNewTargetsModal();
            };

            this.updateStats();

            const body = p.querySelector("#ayb-body");
            let isCollapsed = false;

            const toggleCollapse = () => {
                isCollapsed = !isCollapsed;
                p.classList.toggle("collapsed", isCollapsed);

                if (isCollapsed) {
                    p.style.transform = "none";
                } else {
                    this.applyScale(State.scale);
                }
            };

            let dragging = false;
            let isDraggingAction = false;
            let startX = 0, startY = 0, dx = 0, dy = 0;
            const head = p.querySelector("#ayb-head");

            head.addEventListener("pointerdown", e => {
                if (e.target.closest("button") && e.target.id !== "ayb-emblem") return;
                const rect = p.getBoundingClientRect();
                dragging = true;
                isDraggingAction = false;
                startX = e.clientX;
                startY = e.clientY;
                dx = e.clientX - rect.left;
                dy = e.clientY - rect.top;

                p.style.left = `${rect.left}px`;
                p.style.top = `${rect.top}px`;
                p.style.right = "auto";
                p.style.bottom = "auto";
                head.setPointerCapture?.(e.pointerId);
            });

            window.addEventListener("pointermove", e => {
                if (!dragging) return;
                if (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5) {
                    isDraggingAction = true;
                }
                p.style.left = `${Math.max(0, Math.min(innerWidth - p.offsetWidth, e.clientX - dx))}px`;
                p.style.top = `${Math.max(0, Math.min(innerHeight - p.offsetHeight, e.clientY - dy))}px`;
            });

            head.addEventListener("pointerup", e => {
                dragging = false;
                head.releasePointerCapture?.(e.pointerId);

                if (!isDraggingAction && isCollapsed) {
                    toggleCollapse();
                }
            });

            p.querySelector("#ayb-collapse").onclick = e => {
                e.stopPropagation();
                toggleCollapse();
            };

            window.addEventListener("keydown", e => {
                if (e.key.toLowerCase() === "k" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
                    toggleCollapse();
                }
            });

            p.querySelectorAll(".res-btn").forEach(btn => {
                btn.onclick = () => {
                    p.querySelectorAll(".res-btn").forEach(x => x.classList.remove("active"));
                    btn.classList.add("active");
                    p.querySelector("#r").value = btn.dataset.res;
                };
            });

            const autoToggleBtn = p.querySelector("#ayb-auto-toggle");
            autoToggleBtn.onclick = () => {
                State.autoRaid = !State.autoRaid;
                if (State.autoRaid) {
                    autoToggleBtn.textContent = "⏸ OTOMATİK MODU DURDUR";
                    autoToggleBtn.style.background = "#ff4b4b";
                    autoToggleBtn.style.color = "#fff";
                    Utils.say("Otomatik mod aktif. Hedefler sırayla vurulacak.");
                    Automation.processNextTarget();
                } else {
                    autoToggleBtn.textContent = "▶ OTOMATİK MODU BAŞLAT";
                    autoToggleBtn.style.background = "#ffd43b";
                    autoToggleBtn.style.color = "#000";
                    Utils.say("Otomatik mod durduruldu.");
                }
            };

            p.querySelector("#cl").onclick = () => {
                this.clearMarks();
                State.targets = [];
                State.newTargets = [];
                this.updateNewTargetsBadge();
                this.renderTargetsList();
                Utils.say("Liste ve harita temizlendi.");
            };

            let loadTries = 0;
            const timer = setInterval(() => {
                loadTries++;
                if (this.renderArmy() || loadTries > 40) clearInterval(timer);
            }, 500);

            // İlk Tarama & 30 Dakikalık Periyodik Döngü
            setTimeout(() => Engine.scan(), 2500);
            State.autoScanTimer = setInterval(() => {
                Engine.scan();
            }, CONFIG.AUTO_SCAN_INTERVAL_MS);
        }
    };

    const SystemWatcher = {
        init() {
            let lastClick = 0;
            const confirmRaid = () => {
                if (Date.now() - lastClick < 1500) return;

                const btn = [...document.querySelectorAll("button.km-eylem.km-gonder, button, input[type='button'], input[type='submit'], [role='button']")]
                    .filter(e => e.offsetParent !== null && !e.disabled)
                    .find(e => {
                        const txt = Utils.norm(e.textContent || e.value);
                        return txt === "yağmaya çık" || txt === "yağmaya cik";
                    });

                if (!btn || btn.dataset.aybAutoClicked === "1") return;

                const hasSelectedUnits = [...document.querySelectorAll("input[type='number'], input.kadro-adet")]
                    .filter(e => e.offsetParent !== null)
                    .some(e => Number(e.value) > 0);

                if (!hasSelectedUnits) return;

                btn.dataset.aybAutoClicked = "1";
                lastClick = Date.now();
                setTimeout(() => {
                    try {
                        btn.click();
                        setTimeout(() => Automation.closeRaidPopup(), 200);
                    } catch (_) {}
                }, 250);
            };

            new MutationObserver(() => setTimeout(confirmRaid, 80)).observe(document.documentElement, { childList: true, subtree: true });
            setInterval(confirmRaid, 300);

            let lastObaSignature = "";
            setInterval(() => {
                const currentSig = Engine.getObaKey();
                if (currentSig && currentSig !== "default" && lastObaSignature && currentSig !== lastObaSignature) {
                    State.targets = [];
                    State.newTargets = [];
                    State.knownTargetKeys.clear();
                    UI.updateNewTargetsBadge();
                    UI.clearMarks();
                    UI.renderTargetsList();
                    Utils.say("Oba değişti. Otomatik tarama yenilenecek.", true);
                    setTimeout(() => Engine.scan(), 1000);
                }
                if (currentSig && currentSig !== lastObaSignature) {
                    lastObaSignature = currentSig;
                    try { UI.renderArmy(); } catch (_) {}
                }
            }, 500);
        }
    };

    function bootstrap() {
        UI.init();
        SystemWatcher.init();
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        setTimeout(bootstrap, 1000);
    } else {
        window.addEventListener("DOMContentLoaded", () => setTimeout(bootstrap, 1000));
    }

})();
