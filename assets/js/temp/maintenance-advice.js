/**
 * Dynamic Status Banner - Continuous Drop Transition
 */
(function () {
    const CONFIG = {
        DELAY: 5000,
        SPEED: 180,
        TTL: 1800000,
        POLL: 60000,
        KEY: "app_banner_system",
        MIN_W: 600,
    };

    if (window.innerWidth < CONFIG.MIN_W || window.__STATUS_BANNER_RUNNING__) return;
    window.__STATUS_BANNER_RUNNING__ = true;

    const script = document.querySelector("script[data-status-bar]");
    const JSON_URL = script ? script.getAttribute("data-status-bar") : "data.json";

    let state = { alerts: [], index: 0, tmr: null, lock: false };

    const store = {
        get: () => {
            try {
                return JSON.parse(localStorage.getItem(CONFIG.KEY)) || {};
            } catch {
                return {};
            }
        },
        set: (d) => localStorage.setItem(CONFIG.KEY, JSON.stringify(d)),
    };

    const getHash = (s) => [...s].reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0).toString(36);

    function injectStyles() {
        if (document.getElementById("sb-s")) return;
        const s = document.createElement("style");
        s.id = "sb-s";
        s.textContent = `
            #status-bar { position:sticky; top:0; left:0; width:100%; height:35px; z-index:99999; background:#FFF2C6; display:none; align-items:center; justify-content:flex-start; overflow:hidden; transition:transform .6s; }
            #status-bar.v { display:flex; transform:translateY(0); }
            #status-link { display:inline-flex; align-items:center; height:100%; padding:0 30px; color:#000!important; text-decoration:none!important; font:500 13.5px sans-serif; cursor:pointer; }
            #status-content { display:flex; align-items:center; gap:10px; }
            
            /* The Outgoing Animation: Slide Down and Fade Out */
            .exit-active { animation: slideOutDown 0.4s forwards cubic-bezier(0.4, 0, 0.2, 1); }
            
            /* The Incoming Animation: Start from above, slide into center */
            .enter-active { animation: slideInFromTop 0.4s forwards cubic-bezier(0.4, 0, 0.2, 1); }

            @keyframes slideOutDown {
                from { transform: translateY(0); opacity: 1; }
                to { transform: translateY(12px); opacity: 0; }
            }

            @keyframes slideInFromTop {
                from { transform: translateY(-12px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }

            .s-a { width:14px; flex-shrink:0; transition: transform 0.3s; }
            #status-link:hover .status-text { text-decoration: underline; }
            #status-link:hover .s-a { transform: translateX(5px); }
        `;
        document.head.appendChild(s);
    }

    function updateUI() {
        const bar = document.getElementById("status-bar");
        const box = document.getElementById("status-content");
        const link = document.getElementById("status-link");

        if (!state.alerts.length || !bar || !box) return bar?.classList.remove("v");

        const cur = state.alerts[state.index % state.alerts.length];
        const text = cur.msg || cur.message;

        const applyContent = () => {
            link.href = cur.link || "#";
            box.innerHTML = `<span class="status-text">${text}</span><svg class="s-a" viewBox="0 0 18 12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12.6 1.27L16.6 5.77L12.6 10.27M1.6 5.77H16.6"/></svg>`;
            bar.classList.add("v");

            link.onclick = () => {
                if (cur.dismissable) {
                    const d = store.get();
                    d.dismissed = d.dismissed || {};
                    d.dismissed[getHash(text)] = Date.now();
                    store.set(d);
                    sync();
                }
            };
        };

        // Transition Logic: Exit Down -> Apply Content -> Enter from Top -> Center
        if (bar.classList.contains("v") && box.textContent.trim() !== "" && state.alerts.length > 1) {
            state.lock = true;
            box.classList.remove("enter-active");
            box.classList.add("exit-active");

            setTimeout(() => {
                applyContent();
                box.classList.remove("exit-active");
                box.classList.add("enter-active");

                setTimeout(() => {
                    state.lock = false;
                    rotate();
                }, 400); // Wait for enter animation
            }, 400); // Wait for exit animation
        } else {
            applyContent();
            rotate();
        }
    }

    function rotate() {
        clearTimeout(state.tmr);
        if (state.alerts.length > 1 && !state.lock) {
            const cur = state.alerts[state.index % state.alerts.length];
            const text = cur.msg || cur.message || "";
            const ms = Math.max(CONFIG.DELAY, (text.split(/\s+/).length / CONFIG.SPEED) * 60000 + 2000);
            state.tmr = setTimeout(() => {
                state.index++;
                updateUI();
            }, ms);
        }
    }

    async function sync(force = false) {
        if (window.innerWidth < CONFIG.MIN_W) return;
        const d = store.get();
        const now = Date.now();

        const process = (raw) => {
            if (!Array.isArray(raw)) return;
            const filtered = raw.filter(
                (i) => i.active && (i.msg || i.message) && !(d.dismissed && d.dismissed[getHash(i.msg || i.message)])
            );

            if (JSON.stringify(filtered) !== JSON.stringify(state.alerts)) {
                state.alerts = filtered;
                if (state.alerts.length) {
                    injectStyles();
                    if (!document.getElementById("status-bar")) {
                        document.body.insertAdjacentHTML(
                            "afterbegin",
                            '<div id="status-bar"><a id="status-link" target="_self" rel="noopener"><div id="status-content"></div></a></div>'
                        );
                    }
                    updateUI();
                } else {
                    document.getElementById("status-bar")?.classList.remove("v");
                }
            }
        };

        if (d.cache) process(d.cache);

        if (force || !d.lastFetch || now - d.lastFetch > CONFIG.TTL) {
            try {

                const r = await fetch(`${JSON_URL}?timestamp=${now}&source=status-bar`);

                if (r.ok) {
                    const fresh = await r.json();
                    d.cache = fresh;
                    d.lastFetch = now;
                    store.set(d);
                    process(fresh);
                }
            } catch (e) {}
        }
    }

    const init = () => {
        sync();
        setInterval(() => sync(), CONFIG.POLL); // Add true in sync() to force loading from server
    };

    if (document.readyState === "complete") init();
    else window.addEventListener("load", init, { once: true });
})();