(() => {
    const { flux: { storesFlat }, plugin: { scoped }, solid, ui } = shelter;
    let localEnabled = true;
    let disposeTooltip;

    function getShowCurrentGame() {
        try {
            const v = storesFlat["UserSettingsProtoStore"]?.settings?.status?.showCurrentGame?.value;
            if (v !== undefined) return !!v;
        } catch (_) {}
        try {
            const s = storesFlat["UserSettingsStore"];
            if (s) return s.showCurrentGame !== false;
        } catch (_) {}
        return true;
    }

    function patchBlob(b64, value) {
        function rdv(a, i) {
            let v = 0, s = 0, b;
            do { b = a[i++]; v |= (b & 0x7f) << s; s += 7; } while (b & 0x80);
            return [v, i];
        }
        function wrv(v) {
            const r = [];
            while (v > 127) { r.push((v & 0x7f) | 0x80); v >>>= 7; }
            return [...r, v];
        }

        const bytes = [...Uint8Array.from(atob(b64), c => c.charCodeAt(0))];
        const SCG = value ? [0x1a, 0x02, 0x08, 0x01] : [0x1a, 0x02, 0x08, 0x00];

        let i = 0;
        while (i < bytes.length) {
            const tagAt = i;
            let [tag, i1] = rdv(bytes, i); i = i1;
            if ((tag & 7) === 2) {
                let [len, i2] = rdv(bytes, i); i = i2;
                const end = i + len;
                if (tag === 0x5a) {
                    const inner = bytes.slice(i, end);
                    let out = [], si = 0, found = false;
                    while (si < inner.length) {
                        const pre = si;
                        let [st, si1] = rdv(inner, si); si = si1;
                        if ((st & 7) === 2) {
                            let [sl, si2] = rdv(inner, si); si = si2;
                            if (st === 0x1a) { found = true; out.push(...SCG); si += sl; }
                            else { out.push(...wrv(st), ...wrv(sl), ...inner.slice(si, si += sl)); }
                        } else if ((st & 7) === 0) {
                            let [sv, si2] = rdv(inner, si); si = si2;
                            out.push(...wrv(st), ...wrv(sv));
                        } else { out.push(...inner.slice(pre)); break; }
                    }
                    if (!found) out.push(...SCG);
                    return btoa(String.fromCharCode(...[
                        ...bytes.slice(0, tagAt), 0x5a, ...wrv(out.length), ...out, ...bytes.slice(end)
                    ]));
                }
                i = end;
            } else if ((tag & 7) === 0) { let [, i2] = rdv(bytes, i); i = i2; }
            else if ((tag & 7) === 1) i += 8;
            else if ((tag & 7) === 5) i += 4;
            else break;
        }
        return btoa(String.fromCharCode(...[...bytes, 0x5a, ...wrv(SCG.length), ...SCG]));
    }

    async function setShowCurrentGame(value) {
        await shelter.http.ready;
        const state = storesFlat["UserSettingsProtoStore"]?.getState();
        const raw = state?.["1"]?.proto;
        if (!raw) return;
        const blob = typeof raw === "string" ? raw : btoa(String.fromCharCode(...raw));
        await shelter.http.patch({
            url: "/users/@me/settings-proto/1",
            body: { settings: patchBlob(blob, value) },
        }).catch(() => {});
    }

    function applyState(btn, inner, enabled) {
        btn.setAttribute("aria-checked", String(!enabled));
        btn.setAttribute("aria-label", enabled ? "Disable Game Activity" : "Enable Game Activity");
        btn.classList.toggle("gat-disabled", !enabled);
        inner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="display:flex;width:20px;height:20px">
            <path fill="currentColor"${enabled ? "" : ' mask="url(#gat-mask)"'}
                d="M3.06 20.4q-1.53 0-2.37-1.065T.06 16.74l1.26-9q.27-1.8 1.605-2.97T6.06 3.6h11.88q1.8 0 3.135
                1.17t1.605 2.97l1.26 9q.21 1.53-.63 2.595T20.94 20.4q-.63 0-1.17-.225T18.78 19.5l-2.7-2.7H7.92l-2.7
                2.7q-.45.45-.99.675t-1.17.225Zm14.94-7.2q.51 0 .855-.345T19.2 12q0-.51-.345-.855T18 10.8q-.51
                0-.855.345T16.8 12q0 .51.345.855T18 13.2Zm-2.4-3.6q.51 0 .855-.345T16.8 8.4q0-.51-.345-.855T15.6
                7.2q-.51 0-.855.345T14.4 8.4q0 .51.345.855T15.6 9.6ZM6.9 13.2h1.8v-2.1h2.1v-1.8h-2.1v-2.1h-1.8v2.1h-2.1v1.8h2.1v2.1Z"/>
            ${enabled ? "" : `
            <path fill="currentColor" d="M22.7 2.7a1 1 0 0 0-1.4-1.4l-20 20a1 1 0 1 0 1.4 1.4Z"/>
            <defs><mask id="gat-mask">
                <rect fill="white" width="24" height="24"/>
                <path fill="black" d="M23.27 4.73 19.27.73-.27 20.27 3.73 24.27Z"/>
            </mask></defs>`}
        </svg>`;
    }

    function injectButton(buttonsEl, muteBtn) {
        if (document.getElementById("gat-btn")) return;
        const refBtn = buttonsEl.querySelector('[aria-label="User Settings"]') ?? muteBtn;
        const btn = document.createElement("button");
        btn.id = "gat-btn"; btn.type = "button";
        btn.setAttribute("role", "switch");
        btn.className = refBtn?.className ?? "";
        const inner = document.createElement("div");
        inner.className = refBtn?.querySelector('[class*="contents_"]')?.className ?? "";
        btn.appendChild(inner);
        applyState(btn, inner, localEnabled);
        btn.onclick = () => {
            localEnabled = !localEnabled;
            applyState(btn, inner, localEnabled);
            setShowCurrentGame(localEnabled);
        };
        buttonsEl.prepend(btn);

        disposeTooltip?.();
        solid.createRoot(dispose => {
            disposeTooltip = dispose;
            ui.tooltip(btn, () => localEnabled ? "Disable Game Activity" : "Enable Game Activity");
        });
    }

    function findAccountButtons() {
        for (const b of document.querySelectorAll('[class*="buttons_"]')) {
            if (b.querySelectorAll("button").length < 3) continue;
            if (b.closest('[data-list-id^="chat-messages"]')) continue;
            let p = b.parentElement;
            for (let i = 0; i < 4 && p && p !== document.body; i++, p = p.parentElement)
                if (p.querySelector('[class*="avatar"]') && p.querySelectorAll('[class*="buttons_"]').length === 1)
                    return b;
        }
        const mute = document.querySelector('[aria-label="Mute"], [aria-label="Unmute"]');
        return mute?.closest('[class*="buttons_"]') ?? null;
    }

    function tryInject() {
        const b = findAccountButtons();
        if (b) injectButton(b, b.querySelector("button"));
    }

    return {
        onLoad() {
            scoped.ui.injectCss(`
                #gat-btn.gat-disabled { color: var(--status-danger) !important; }
                #gat-btn [class*="contents_"] { display: flex; align-items: center; justify-content: center; }
            `);

            localEnabled = getShowCurrentGame();
            tryInject();
            scoped.observeDom('[class*="buttons_"]', () => {
                if (!document.getElementById("gat-btn")) tryInject();
            });
            scoped.flux.subscribe("CONNECTION_OPEN", () => {
                localEnabled = getShowCurrentGame();
                const btn = document.getElementById("gat-btn");
                if (btn) applyState(btn, btn.firstElementChild, localEnabled);
                else tryInject();
            });
        },
        onUnload() {
            disposeTooltip?.();
            document.getElementById("gat-btn")?.remove();
        }
    };
})()
