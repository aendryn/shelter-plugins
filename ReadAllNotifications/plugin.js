(function() {

"use strict";

//#region plugins/ReadAllNotifications/index.js
(() => {
	let injectedButton = null;
	function readAll() {
		const { GuildStore, GuildChannelStore, ActiveJoinedThreadsStore, ReadStateStore, GuildScheduledEventStore } = shelter.flux.storesFlat;
		const channels = [];
		Object.values(GuildStore.getGuilds()).forEach((guild) => {
			GuildChannelStore.getChannels(guild.id).SELECTABLE.concat(GuildChannelStore.getChannels(guild.id).VOCAL).concat(Object.values(ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guild.id)).flatMap((threadChannels) => Object.values(threadChannels))).forEach((c) => {
				if (!ReadStateStore.hasUnread(c.channel.id)) return;
				channels.push({
					channelId: c.channel.id,
					messageId: ReadStateStore.lastMessageId(c.channel.id),
					readStateType: 0
				});
			});
			const events = GuildScheduledEventStore.getGuildScheduledEventsForGuild(guild.id);
			if (events?.length) {
				const newest = events.reduce((a, b) => BigInt(a.id) > BigInt(b.id) ? a : b);
				shelter.flux.dispatcher.dispatch({
					type: "GUILD_FEATURE_ACK",
					id: guild.id,
					ackType: 1,
					ackedId: newest.id
				});
			}
		});
		shelter.flux.dispatcher.dispatch({
			type: "BULK_ACK",
			context: "APP",
			channels
		});
	}
	function injectButton(serverListEl) {
		if (document.getElementById("read-all-btn")) return;
		const btn = document.createElement("button");
		btn.id = "read-all-btn";
		btn.title = "Mark all as read";
		btn.textContent = "✓";
		btn.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        border: none;
        background: var(--background-secondary);
        color: var(--interactive-normal);
        font-size: 18px;
        cursor: pointer;
        margin: 4px auto;
        transition: background 0.15s, border-radius 0.15s;
        `;
		btn.onmouseenter = () => {
			btn.style.background = "var(--brand-experiment)";
			btn.style.borderRadius = "30%";
			btn.style.color = "white";
		};
		btn.onmouseleave = () => {
			btn.style.background = "var(--background-secondary)";
			btn.style.borderRadius = "50%";
			btn.style.color = "var(--interactive-normal)";
		};
		btn.onclick = readAll;
		serverListEl.prepend(btn);
		injectedButton = btn;
	}
	const { scoped } = shelter.plugin;
	const unobserve = scoped.observeDom("[aria-label=\"Servers\"]", (el) => {
		unobserve();
		injectButton(el);
	});
	const existing = document.querySelector("[aria-label=\"Servers\"]");
	if (existing) injectButton(existing);
	scoped.flux.subscribe("CONNECTION_OPEN", () => {
		const el = document.querySelector("[aria-label=\"Servers\"]");
		if (el) injectButton(el);
	});
	return { onUnload() {
		injectedButton?.remove();
		injectedButton = null;
	} };
})();

//#endregion
})();