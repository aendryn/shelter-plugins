(function() {

"use strict";

//#region plugins/GameActivityHider/index.js
(() => {
	let injectedButton = null;
	const { flux: { storesFlat }, plugin: { scoped } } = shelter;
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
		function rdv(a, i$1) {
			let v = 0, s = 0, b;
			do {
				b = a[i$1++];
				v |= (b & 127) << s;
				s += 7;
			} while (b & 128);
			return [v, i$1];
		}
		function wrv(v) {
			const r = [];
			while (v > 127) {
				r.push(v & 127 | 128);
				v >>>= 7;
			}
			return [...r, v];
		}
		const bytes = [...Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))];
		const SCG = value ? [
			26,
			2,
			8,
			1
		] : [
			26,
			2,
			8,
			0
		];
		let i = 0;
		while (i < bytes.length) {
			const tagAt = i;
			let [tag, i1] = rdv(bytes, i);
			i = i1;
			if ((tag & 7) === 2) {
				let [len, i2] = rdv(bytes, i);
				i = i2;
				const end = i + len;
				if (tag === 90) {
					const inner = bytes.slice(i, end);
					let out = [], si = 0, found = false;
					while (si < inner.length) {
						const pre = si;
						let [st, si1] = rdv(inner, si);
						si = si1;
						if ((st & 7) === 2) {
							let [sl, si2] = rdv(inner, si);
							si = si2;
							if (st === 26) {
								found = true;
								out.push(...SCG);
								si += sl;
							} else out.push(...wrv(st), ...wrv(sl), ...inner.slice(si, si += sl));
						} else if ((st & 7) === 0) {
							let [sv, si2] = rdv(inner, si);
							si = si2;
							out.push(...wrv(st), ...wrv(sv));
						} else {
							out.push(...inner.slice(pre));
							break;
						}
					}
					if (!found) out.push(...SCG);
					return btoa(String.fromCharCode(...[
						...bytes.slice(0, tagAt),
						90,
						...wrv(out.length),
						...out,
						...bytes.slice(end)
					]));
				}
				i = end;
			} else if ((tag & 7) === 0) {
				let [, i2] = rdv(bytes, i);
				i = i2;
			} else if ((tag & 7) === 1) i += 8;
else if ((tag & 7) === 5) i += 4;
else break;
		}
		return btoa(String.fromCharCode(...[
			...bytes,
			90,
			...wrv(SCG.length),
			...SCG
		]));
	}
	async function setShowCurrentGame(value) {
		await shelter.http.ready;
		const state = storesFlat["UserSettingsProtoStore"]?.getState();
		const raw = state?.["1"]?.proto;
		if (!raw) return;
		const blob = typeof raw === "string" ? raw : btoa(String.fromCharCode(...raw));
		await shelter.http.patch({
			url: "/users/@me/settings-proto/1",
			body: { settings: patchBlob(blob, value) }
		}).catch(() => {});
	}
	let localEnabled = getShowCurrentGame();
	function applyState(btn, inner, enabled) {
		btn.setAttribute("aria-checked", String(!enabled));
		btn.setAttribute("aria-label", enabled ? "Disable Game Activity" : "Enable Game Activity");
		btn.classList.toggle("gat-disabled", !enabled);
		inner.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" style="display:flex;width:20px;height:20px">
            <path fill="currentColor"${enabled ? "" : " mask=\"url(#gat-mask)\""}
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
	function injectButton(buttonsEl) {
		if (document.getElementById("gat-btn")) return;
		const settingsBtn = buttonsEl.querySelector("[aria-label=\"User Settings\"]");
		const btn = document.createElement("button");
		btn.id = "gat-btn";
		btn.type = "button";
		btn.setAttribute("role", "switch");
		btn.className = settingsBtn?.className ?? "";
		const inner = document.createElement("div");
		inner.className = settingsBtn?.querySelector("[class*=\"contents_\"]")?.className ?? "";
		btn.appendChild(inner);
		applyState(btn, inner, localEnabled);
		btn.onclick = () => {
			localEnabled = !localEnabled;
			applyState(btn, inner, localEnabled);
			setShowCurrentGame(localEnabled);
		};
		buttonsEl.prepend(btn);
		injectedButton = btn;
	}
	const styleEl = document.createElement("style");
	styleEl.textContent = `
        #gat-btn.gat-disabled { color: var(--status-danger) !important; }
        #gat-btn [class*="contents_"] { display: flex; align-items: center; justify-content: center; }
    `;
	document.head.appendChild(styleEl);
	function tryInject() {
		const muteBtn = document.querySelector("[aria-label=\"Mute\"], [aria-label=\"Unmute\"]");
		const buttonsEl = muteBtn?.closest("[class*=\"buttons_\"]");
		if (buttonsEl) injectButton(buttonsEl);
	}
	tryInject();
	scoped.observeDom("[aria-label=\"Mute\"]:not([data-gat]), [aria-label=\"Unmute\"]:not([data-gat])", (el) => {
		el.dataset.gat = "1";
		const buttonsEl = el.closest("[class*=\"buttons_\"]");
		if (buttonsEl) injectButton(buttonsEl);
	});
	scoped.flux.subscribe("CONNECTION_OPEN", () => {
		localEnabled = getShowCurrentGame();
		tryInject();
	});
	return { onUnload() {
		injectedButton?.remove();
		styleEl.remove();
		document.querySelectorAll("[data-gat]").forEach((el) => delete el.dataset.gat);
	} };
})();

//#endregion
})();