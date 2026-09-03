(function () {
    const STORAGE_KEY = "digital-cafe-state";
    const QUOTES = [
        "The quieter you become, the more you are able to hear.",
        "Small steps every day.",
        "A calm mind turns ordinary mornings into clear beginnings.",
        "Do the next right thing, gently.",
        "Simplicity is the quiet after the important choices are made.",
        "Let the day be deep, not loud.",
    ];

    const DEFAULT_LINKS = [
        { title: "GitHub", url: "https://github.com", icon: "github" },
        { title: "ChatGPT", url: "https://chatgpt.com", icon: "bot" },
        { title: "Gmail", url: "https://mail.google.com", icon: "mail" },
        { title: "LinkedIn", url: "https://linkedin.com", icon: "linkedin" },
        { title: "Spotify", url: "https://open.spotify.com", icon: "music" },
        { title: "YouTube", url: "https://youtube.com", icon: "youtube" },
        { title: "Notion", url: "https://notion.so", icon: "notebook-tabs" },
        { title: "Drive", url: "https://drive.google.com", icon: "hard-drive" },
        { title: "Kalender", url: "https://calendar.google.com", icon: "calendar-days" },
    ];

    const DEFAULT_STATE = {
        name: "Marius",
        accent: "#6C9A8B",
        scene: "auto",
        city: "Berlin",
        units: "metric",
        motion: "on",
        searchEngine: "google",
        focus: "",
        todos: [],
        links: DEFAULT_LINKS,
        sound: "rain",
        volume: 0.34,
        music: "lofi",
    };

    const SOUND_OPTIONS = [
        { id: "rain", label: "Regen" },
        { id: "fire", label: "Kamin" },
        { id: "ocean", label: "Meer" },
        { id: "forest", label: "Wald" },
        { id: "wind", label: "Wind" },
        { id: "cafe", label: "Cafe" },
        { id: "birds", label: "Voegel" },
    ];

    const MUSIC_EMBEDS = {
        lofi: '<iframe loading="lazy" src="https://www.youtube.com/embed/jfKfPfyJRdk" title="Lofi Girl Livestream" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
        spotify: '<iframe loading="lazy" src="https://open.spotify.com/embed/playlist/37i9dQZF1DX4sWSpwq3LiO?utm_source=generator" title="Spotify Embed" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>',
        youtube: '<iframe loading="lazy" src="https://www.youtube.com/embed/5qap5aO4i9A" title="YouTube Music Ambient" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>',
    };

    let state = loadState();
    let draggedIndex = null;
    let activeWeather = "Clear";
    let audioEngine = null;
    let ambient = null;

    const $ = (selector) => document.querySelector(selector);

    function loadState() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
            return {
                ...DEFAULT_STATE,
                ...saved,
                links: Array.isArray(saved.links) && saved.links.length ? saved.links : DEFAULT_LINKS,
                todos: Array.isArray(saved.todos) ? saved.todos : [],
            };
        } catch {
            return { ...DEFAULT_STATE };
        }
    }

    function saveState() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function renderIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function dayOfYear(date) {
        const start = new Date(date.getFullYear(), 0, 0);
        return Math.floor((date - start) / 86400000);
    }

    function currentScene(hour) {
        if (state.scene !== "auto") return state.scene;
        if (hour < 6 || hour >= 22) return "night";
        if (hour < 11) return "morning";
        if (hour < 17) return "day";
        return "evening";
    }

    function updateClock() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const scene = currentScene(hour);
        document.body.dataset.scene = scene;
        document.body.dataset.motion = state.motion;

        $("#digital-clock").textContent = now.toLocaleTimeString("de-DE", {
            hour: "2-digit",
            minute: "2-digit",
        });

        $("#date-line").textContent = now.toLocaleDateString("de-DE", {
            weekday: "long",
            day: "numeric",
            month: "long",
        });

        const greeting = hour < 11 ? "Guten Morgen" : hour < 17 ? "Guten Nachmittag" : hour < 22 ? "Guten Abend" : "Gute Nacht";
        $("#greeting").textContent = greeting;
        $("#welcome").textContent = `Willkommen zurueck, ${state.name}.`;
        $("#day-progress").textContent = `Tag ${dayOfYear(now)} des Jahres`;

        const hourAngle = ((hour % 12) + minute / 60) * 30;
        const minuteAngle = minute * 6;
        $("#hour-hand").style.transform = `rotate(${hourAngle}deg)`;
        $("#minute-hand").style.transform = `rotate(${minuteAngle}deg)`;

        if (ambient) ambient.setMode(resolveAmbientMode(scene, activeWeather));
    }

    function resolveAmbientMode(scene, weather) {
        const normalized = String(weather || "").toLowerCase();
        if (normalized.includes("rain") || normalized.includes("drizzle") || normalized.includes("thunder")) return "rain";
        if (normalized.includes("snow")) return "snow";
        if (scene === "night") return "fireflies";
        if (scene === "morning") return "steam";
        return "leaves";
    }

    function setWeatherFallback(message) {
        $("#weather-place").textContent = state.city || "Berlin";
        $("#weather-temp").textContent = "--";
        $("#weather-description").textContent = message;
        $("#weather-range").textContent = "OpenWeather bereit";
        $("#weather-humidity").textContent = "Key via .env";
        activeWeather = "Clear";
    }

    function unitSuffix() {
        return state.units === "imperial" ? "F" : "C";
    }

    async function loadWeather() {
        const params = new URLSearchParams({ units: state.units, city: state.city || "Berlin" });
        const fetchWeather = async (position) => {
            if (position) {
                params.set("lat", position.coords.latitude);
                params.set("lon", position.coords.longitude);
            }

            const response = await fetch(`/api/weather?${params.toString()}`);
            const data = await response.json();
            if (!data.configured) {
                setWeatherFallback("OPENWEATHER_API_KEY fehlt");
                return;
            }
            if (!response.ok || data.error) {
                setWeatherFallback("Wetter gerade nicht erreichbar");
                return;
            }

            const suffix = unitSuffix();
            activeWeather = data.condition || "Clear";
            $("#weather-place").textContent = [data.city, data.country].filter(Boolean).join(", ");
            $("#weather-temp").textContent = `${Math.round(data.temperature)}°${suffix}`;
            $("#weather-description").textContent = data.description || "Klar";
            $("#weather-range").textContent = `H ${Math.round(data.high)}° / T ${Math.round(data.low)}°`;
            $("#weather-humidity").textContent = `${data.humidity}% Luft`;

            const icon = $("#weather-icon");
            if (data.icon) {
                icon.src = `https://openweathermap.org/img/wn/${data.icon}@2x.png`;
                icon.hidden = false;
            }
            if (ambient) ambient.setMode(resolveAmbientMode(currentScene(new Date().getHours()), activeWeather));
        };

        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => fetchWeather(position).catch(() => setWeatherFallback("Wetter gerade nicht erreichbar")),
                () => fetchWeather(null).catch(() => setWeatherFallback("Wetter gerade nicht erreichbar")),
                { timeout: 5000, maximumAge: 600000 }
            );
        } else {
            fetchWeather(null).catch(() => setWeatherFallback("Wetter gerade nicht erreichbar"));
        }
    }

    function renderQuote() {
        $("#quote-text").textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }

    function renderCalendar() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = (firstDay.getDay() + 6) % 7;
        const calendar = $("#calendar");
        const weekdays = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

        $("#calendar-title").textContent = now.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
        calendar.innerHTML = "";

        weekdays.forEach((day) => {
            const cell = document.createElement("span");
            cell.className = "weekday";
            cell.textContent = day;
            calendar.append(cell);
        });

        for (let i = 0; i < startOffset; i += 1) {
            calendar.append(document.createElement("span"));
        }

        for (let day = 1; day <= lastDay.getDate(); day += 1) {
            const cell = document.createElement("span");
            cell.textContent = day;
            if (day === now.getDate()) cell.classList.add("today");
            calendar.append(cell);
        }
    }

    function renderTodos() {
        const list = $("#todo-list");
        list.innerHTML = "";

        state.todos.forEach((todo, index) => {
            const item = document.createElement("li");
            item.className = `todo-item${todo.done ? " done" : ""}`;
            item.innerHTML = `
                <input type="checkbox" ${todo.done ? "checked" : ""} aria-label="Aufgabe erledigt">
                <span>${escapeHtml(todo.text)}</span>
                <button class="delete-todo" type="button" aria-label="Aufgabe loeschen">
                    <i data-lucide="x"></i>
                </button>
            `;
            item.querySelector("input").addEventListener("change", (event) => {
                state.todos[index].done = event.target.checked;
                saveState();
                renderTodos();
            });
            item.querySelector("button").addEventListener("click", () => {
                state.todos.splice(index, 1);
                saveState();
                renderTodos();
            });
            list.append(item);
        });

        renderIcons();
    }

    function escapeHtml(value) {
        const div = document.createElement("div");
        div.textContent = value;
        return div.innerHTML;
    }

    function renderQuickLinks() {
        const container = $("#quick-links");
        container.innerHTML = "";

        state.links.forEach((link, index) => {
            const item = document.createElement("div");
            item.className = "quick-link";
            item.draggable = true;
            item.tabIndex = 0;
            item.setAttribute("role", "link");
            item.setAttribute("aria-label", link.title);
            item.innerHTML = `
                <i data-lucide="${escapeHtml(link.icon || "globe")}"></i>
                <span>${escapeHtml(link.title)}</span>
                <button class="link-remove" type="button" aria-label="${escapeHtml(link.title)} entfernen">
                    <i data-lucide="x"></i>
                </button>
            `;

            item.addEventListener("click", (event) => {
                if (event.target.closest("button")) return;
                window.open(link.url, "_blank", "noopener");
            });
            item.addEventListener("keydown", (event) => {
                if (event.key === "Enter") window.open(link.url, "_blank", "noopener");
            });
            item.addEventListener("dragstart", () => {
                draggedIndex = index;
            });
            item.addEventListener("dragover", (event) => {
                event.preventDefault();
            });
            item.addEventListener("drop", () => {
                if (draggedIndex === null || draggedIndex === index) return;
                const [moved] = state.links.splice(draggedIndex, 1);
                state.links.splice(index, 0, moved);
                draggedIndex = null;
                saveState();
                renderQuickLinks();
                renderCommands();
            });
            item.querySelector(".link-remove").addEventListener("click", () => {
                state.links.splice(index, 1);
                saveState();
                renderQuickLinks();
                renderCommands();
            });
            container.append(item);
        });

        renderIcons();
    }

    function renderMusic() {
        $("#music-frame-wrap").innerHTML = MUSIC_EMBEDS[state.music] || MUSIC_EMBEDS.lofi;
    }

    function renderSoundOptions() {
        const container = $("#sound-options");
        container.innerHTML = "";
        SOUND_OPTIONS.forEach((sound) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `sound-chip${state.sound === sound.id ? " active" : ""}`;
            button.textContent = sound.label;
            button.addEventListener("click", () => {
                state.sound = sound.id;
                saveState();
                renderSoundOptions();
                if (audioEngine && audioEngine.playing) audioEngine.play(state.sound, state.volume);
            });
            container.append(button);
        });
    }

    class CafeAudio {
        constructor() {
            this.ctx = null;
            this.master = null;
            this.nodes = [];
            this.playing = false;
            this.birdTimer = null;
        }

        ensureContext() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
                this.master = this.ctx.createGain();
                this.master.connect(this.ctx.destination);
            }
        }

        play(sound, volume) {
            this.stop();
            this.ensureContext();
            this.playing = true;
            this.master.gain.value = volume;

            const noise = this.createNoise();
            const filter = this.ctx.createBiquadFilter();
            const gain = this.ctx.createGain();
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(this.master);

            const configs = {
                rain: ["bandpass", 1400, 0.8],
                fire: ["highpass", 500, 0.45],
                ocean: ["lowpass", 420, 0.75],
                forest: ["bandpass", 900, 0.34],
                wind: ["lowpass", 300, 0.58],
                cafe: ["bandpass", 650, 0.5],
                birds: ["highpass", 1200, 0.16],
            };
            const [type, frequency, localGain] = configs[sound] || configs.rain;
            filter.type = type;
            filter.frequency.value = frequency;
            gain.gain.value = localGain;
            noise.start();
            this.nodes.push(noise, filter, gain);

            if (sound === "birds" || sound === "forest") this.startBirds();
        }

        setVolume(volume) {
            if (this.master) this.master.gain.value = volume;
        }

        createNoise() {
            const length = this.ctx.sampleRate * 2;
            const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i += 1) {
                data[i] = Math.random() * 2 - 1;
            }
            const source = this.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            return source;
        }

        startBirds() {
            this.birdTimer = window.setInterval(() => {
                if (!this.playing || !this.ctx) return;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = "sine";
                osc.frequency.value = 1600 + Math.random() * 1200;
                gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.08, this.ctx.currentTime + 0.03);
                gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.22);
                osc.connect(gain);
                gain.connect(this.master);
                osc.start();
                osc.stop(this.ctx.currentTime + 0.24);
            }, 1800 + Math.random() * 1200);
        }

        stop() {
            if (this.birdTimer) {
                window.clearInterval(this.birdTimer);
                this.birdTimer = null;
            }
            this.nodes.forEach((node) => {
                try {
                    if (node.stop) node.stop();
                    if (node.disconnect) node.disconnect();
                } catch {
                    // Audio nodes can already be stopped after quick toggles.
                }
            });
            this.nodes = [];
            this.playing = false;
        }
    }

    class AmbientCanvas {
        constructor(canvas) {
            this.canvas = canvas;
            this.ctx = canvas.getContext("2d");
            this.mode = "leaves";
            this.particles = [];
            this.resize = this.resize.bind(this);
            this.draw = this.draw.bind(this);
            window.addEventListener("resize", this.resize);
            this.resize();
            requestAnimationFrame(this.draw);
        }

        resize() {
            const ratio = window.devicePixelRatio || 1;
            this.width = window.innerWidth;
            this.height = window.innerHeight;
            this.canvas.width = this.width * ratio;
            this.canvas.height = this.height * ratio;
            this.canvas.style.width = `${this.width}px`;
            this.canvas.style.height = `${this.height}px`;
            this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
            this.seed();
        }

        setMode(mode) {
            if (this.mode === mode) return;
            this.mode = mode;
            this.seed();
        }

        seed() {
            const count = this.mode === "rain" ? 100 : this.mode === "snow" ? 76 : 34;
            this.particles = Array.from({ length: count }, () => this.createParticle(true));
        }

        createParticle(randomY) {
            return {
                x: Math.random() * this.width,
                y: randomY ? Math.random() * this.height : -20,
                size: 1 + Math.random() * 3,
                speed: 0.25 + Math.random() * 1.4,
                drift: -0.45 + Math.random() * 0.9,
                alpha: 0.24 + Math.random() * 0.55,
            };
        }

        draw() {
            this.ctx.clearRect(0, 0, this.width, this.height);
            if (document.body.dataset.motion === "off") {
                requestAnimationFrame(this.draw);
                return;
            }

            this.particles.forEach((particle, index) => {
                if (this.mode === "rain") this.drawRain(particle);
                if (this.mode === "snow") this.drawSnow(particle);
                if (this.mode === "fireflies") this.drawFirefly(particle);
                if (this.mode === "steam") this.drawSteam(particle);
                if (this.mode === "leaves") this.drawLeaf(particle);

                if (particle.y > this.height + 40 || particle.x < -60 || particle.x > this.width + 60) {
                    this.particles[index] = this.createParticle(false);
                }
            });

            requestAnimationFrame(this.draw);
        }

        drawRain(particle) {
            this.ctx.strokeStyle = `rgba(210, 230, 232, ${particle.alpha * 0.45})`;
            this.ctx.lineWidth = 1;
            this.ctx.beginPath();
            this.ctx.moveTo(particle.x, particle.y);
            this.ctx.lineTo(particle.x - 8, particle.y + 18);
            this.ctx.stroke();
            particle.x -= 0.8;
            particle.y += 7 + particle.speed * 3;
        }

        drawSnow(particle) {
            this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            particle.x += Math.sin(particle.y * 0.02) * 0.4;
            particle.y += 0.8 + particle.speed;
        }

        drawFirefly(particle) {
            this.ctx.fillStyle = `rgba(236, 214, 144, ${0.18 + Math.sin(Date.now() / 700 + particle.x) * 0.16})`;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
            this.ctx.fill();
            particle.x += particle.drift * 0.3;
            particle.y -= 0.18 + particle.speed * 0.1;
            if (particle.y < -20) particle.y = this.height + 20;
        }

        drawSteam(particle) {
            this.ctx.strokeStyle = `rgba(245, 245, 245, ${particle.alpha * 0.16})`;
            this.ctx.lineWidth = particle.size;
            this.ctx.beginPath();
            this.ctx.moveTo(particle.x, particle.y);
            this.ctx.bezierCurveTo(particle.x + 14, particle.y - 18, particle.x - 12, particle.y - 34, particle.x + 8, particle.y - 54);
            this.ctx.stroke();
            particle.x += Math.sin(particle.y * 0.02) * 0.2;
            particle.y -= 0.8 + particle.speed * 0.5;
            if (particle.y < -40) particle.y = this.height + 20;
        }

        drawLeaf(particle) {
            this.ctx.fillStyle = `rgba(172, 142, 88, ${particle.alpha * 0.38})`;
            this.ctx.save();
            this.ctx.translate(particle.x, particle.y);
            this.ctx.rotate(Math.sin(particle.y * 0.03));
            this.ctx.fillRect(-particle.size, -particle.size / 2, particle.size * 4, particle.size);
            this.ctx.restore();
            particle.x += particle.drift;
            particle.y += 0.4 + particle.speed * 0.55;
        }
    }

    function handleSearch(event) {
        event.preventDefault();
        const query = $("#search-input").value.trim();
        if (!query) return;
        const encoded = encodeURIComponent(query);
        const looksLikeUrl = /^https?:\/\//.test(query) || /^[\\w.-]+\\.[a-z]{2,}/i.test(query);
        if (looksLikeUrl) {
            window.location.href = query.startsWith("http") ? query : `https://${query}`;
            return;
        }

        const urls = {
            google: `https://www.google.com/search?q=${encoded}`,
            duckduckgo: `https://duckduckgo.com/?q=${encoded}`,
            perplexity: `https://www.perplexity.ai/search?q=${encoded}`,
            chatgpt: `https://chatgpt.com/?q=${encoded}`,
        };
        window.location.href = urls[state.searchEngine] || urls.google;
    }

    function applySettingsToUI() {
        document.documentElement.style.setProperty("--accent", state.accent);
        document.body.dataset.motion = state.motion;
        $("#setting-name").value = state.name;
        $("#setting-accent").value = state.accent;
        $("#setting-scene").value = state.scene;
        $("#setting-units").value = state.units;
        $("#setting-city").value = state.city;
        $("#setting-motion").value = state.motion;
        $("#search-engine").value = state.searchEngine;
        $("#focus-input").value = state.focus;
        $("#volume-range").value = state.volume;
        $("#music-source").value = state.music;
    }

    function bindSettings() {
        $("#settings-button").addEventListener("click", () => $("#settings-modal").showModal());
        $("#reset-button").addEventListener("click", () => {
            localStorage.removeItem(STORAGE_KEY);
            window.location.reload();
        });

        [
            ["setting-name", "name"],
            ["setting-accent", "accent"],
            ["setting-scene", "scene"],
            ["setting-units", "units"],
            ["setting-city", "city"],
            ["setting-motion", "motion"],
        ].forEach(([id, key]) => {
            $(`#${id}`).addEventListener("input", (event) => {
                state[key] = event.target.value;
                saveState();
                applySettingsToUI();
                updateClock();
                if (key === "units" || key === "city") loadWeather();
            });
        });
    }

    function renderCommands() {
        const list = $("#command-list");
        const commands = [
            { title: "Einstellungen", icon: "settings", action: () => $("#settings-modal").showModal() },
            { title: "Fokus bearbeiten", icon: "sparkles", action: () => $("#focus-input").focus() },
            { title: "Neue Aufgabe", icon: "check-circle-2", action: () => $("#todo-input").focus() },
            ...state.links.map((link) => ({
                title: link.title,
                icon: link.icon || "globe",
                action: () => window.open(link.url, "_blank", "noopener"),
            })),
        ];
        const query = $("#command-input").value.trim().toLowerCase();
        list.innerHTML = "";

        commands
            .filter((command) => command.title.toLowerCase().includes(query))
            .forEach((command) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "command-item";
                button.innerHTML = `<i data-lucide="${escapeHtml(command.icon)}"></i><span>${escapeHtml(command.title)}</span>`;
                button.addEventListener("click", () => {
                    closeCommands();
                    command.action();
                });
                list.append(button);
            });
        renderIcons();
    }

    function openCommands() {
        $("#command-palette").hidden = false;
        renderCommands();
        $("#command-input").focus();
    }

    function closeCommands() {
        $("#command-palette").hidden = true;
        $("#command-input").value = "";
    }

    function bindEvents() {
        $("#search-form").addEventListener("submit", handleSearch);
        $("#search-engine").addEventListener("change", (event) => {
            state.searchEngine = event.target.value;
            saveState();
        });
        $("#focus-input").addEventListener("input", (event) => {
            state.focus = event.target.value;
            saveState();
        });
        $("#todo-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const input = $("#todo-input");
            const text = input.value.trim();
            if (!text) return;
            state.todos.push({ text, done: false });
            input.value = "";
            saveState();
            renderTodos();
        });
        $("#music-source").addEventListener("change", (event) => {
            state.music = event.target.value;
            saveState();
            renderMusic();
        });
        $("#volume-range").addEventListener("input", (event) => {
            state.volume = Number(event.target.value);
            saveState();
            if (audioEngine) audioEngine.setVolume(state.volume);
        });
        $("#sound-toggle").addEventListener("click", () => {
            if (!audioEngine) audioEngine = new CafeAudio();
            if (audioEngine.playing) {
                audioEngine.stop();
                $("#sound-toggle").innerHTML = '<i data-lucide="play"></i><span>Play</span>';
            } else {
                audioEngine.play(state.sound, state.volume);
                $("#sound-toggle").innerHTML = '<i data-lucide="pause"></i><span>Pause</span>';
            }
            renderIcons();
        });
        $("#add-link-button").addEventListener("click", () => $("#link-modal").showModal());
        $("#link-form").addEventListener("submit", (event) => {
            event.preventDefault();
            const title = $("#link-title").value.trim();
            const url = $("#link-url").value.trim();
            const icon = $("#link-icon").value.trim() || "globe";
            if (!title || !url) return;
            state.links.push({ title, url, icon });
            saveState();
            $("#link-form").reset();
            $("#link-modal").close();
            renderQuickLinks();
            renderCommands();
        });
        $("#command-button").addEventListener("click", openCommands);
        $("#command-input").addEventListener("input", renderCommands);
        $("#command-palette").addEventListener("click", (event) => {
            if (event.target.id === "command-palette") closeCommands();
        });
        window.addEventListener("keydown", (event) => {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                openCommands();
            }
            if (event.key === "Escape" && !$("#command-palette").hidden) closeCommands();
        });
        window.addEventListener("mousemove", (event) => {
            if (state.motion === "off") return;
            const x = (event.clientX / window.innerWidth - 0.5) * 10;
            const y = (event.clientY / window.innerHeight - 0.5) * 10;
            $("#cafe-backdrop").style.transform = `scale(1.04) translate(${x}px, ${y}px)`;
        });
    }

    function registerServiceWorker() {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/digital-cafe-sw.js").catch(() => {});
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        applySettingsToUI();
        renderQuote();
        renderCalendar();
        renderTodos();
        renderQuickLinks();
        renderMusic();
        renderSoundOptions();
        bindSettings();
        bindEvents();
        updateClock();
        loadWeather();
        ambient = new AmbientCanvas($("#ambient-canvas"));
        renderIcons();
        registerServiceWorker();
        window.setInterval(updateClock, 1000);
    });
})();
