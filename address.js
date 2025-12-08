function startAddressLookup() {

    /* ================================
       Detect API from URL
    ================================== */
    const params = new URLSearchParams(window.location.search);
    const apiBase = params.get("api");

    if (!apiBase) {
        console.error("❌ No API provided. Use ?api=YOUR_SCRIPT_URL");
        return;
    }

    const LOOKUP_URL = apiBase + "?function=getAddressLookup";

    console.log("ADDRESS LOOKUP → Using API:", LOOKUP_URL);

    /* ================================
       Inject CSS (same as your screenshot)
    ================================== */
    if (!document.getElementById("address-lookup-style")) {
        const style = document.createElement("style");
        style.id = "address-lookup-style";
        style.textContent = `

        /* Wrapper */
        #lookup-wrapper {
            width: 50%;
            margin: 0 auto;
            min-width: 280px;
            padding-top: 10px;
        }

        /* Search bar */
        #lookup-input {
            padding: 12px 16px;
            width: 100%;
            border-radius: 14px;
            border: 1px solid rgba(255,255,255,0.25);
            background: rgba(0,0,0,0.35);
            backdrop-filter: blur(8px);
            color: #fff;
            font-size: 1rem;
            margin-bottom: 14px;
            background-size: 22px;
            background-repeat: no-repeat;
            background-position: 12px center;
            padding-left: 46px;
        }

        #lookup-input::placeholder {
            color: #ccc;
        }

        #lookup-input:focus {
            outline: none;
            box-shadow: 0 0 14px rgba(211, 28, 28, 0.8);
            border: 1px solid rgba(255,255,255,0.4);
        }

        /* Button */
        #lookup-button {
            padding: 12px 20px;
            background: #D31C1C;
            border: none;
            color: white;
            border-radius: 18px;
            cursor: pointer;
            font-weight: 600;
            box-shadow:
                0 0 8px rgba(211, 28, 28, 0.6),
                0 0 16px rgba(211, 28, 28, 0.5);
            transition: transform 0.15s ease, box-shadow 0.2s ease;
        }

        #lookup-button:hover {
            transform: scale(1.04);
            box-shadow:
                0 0 14px rgba(211, 28, 28, 0.8),
                0 0 24px rgba(211, 28, 28, 0.7);
        }

        /* Results */
        .route-card {
            margin: 1rem 0;
            padding: 1rem;
            background: rgba(0,0,0,0.4);
            backdrop-filter: blur(5px);
            border-radius: 15px;
            color: white;
            border: 1px solid rgba(255,255,255,0.2);
            animation: fadeIn 0.4s ease;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }

        `;
        document.head.appendChild(style);
    }

    /* ================================
       Ensure HTML exists
    ================================== */
    function waitForElements() {
        const input = document.getElementById("lookup-input");
        const button = document.getElementById("lookup-button");
        const results = document.getElementById("lookup-results");

        if (!input || !button || !results) {
            return setTimeout(waitForElements, 150);
        }

        setup(input, button, results);
    }

    /* ================================
       Setup search functionality
    ================================== */
    let streets = [];

    function norm(str) {
        return (str || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function setup(input, button, results) {

        /* Load Logo Overlay (icon in the input field) */
        const logo = document.getElementById("lookup-input");
        fetch(apiBase)
            .then(r => r.json())
            .then(json => {
                const icon = json?.settings?.logo_overlay_url;
                if (icon) {
                    logo.style.backgroundImage = `url('${icon}')`;
                }
            });

        /* Load street data */
        fetch(LOOKUP_URL)
            .then(r => r.json())
            .then(data => {
                streets = data;
                console.log("Lookup streets loaded:", streets);
            });

        /* Search function */
        function doSearch() {
            const clean = norm(input.value.trim());
            if (!clean) {
                results.innerHTML = "<p>No matching streets found.</p>";
                return;
            }

            const matches = streets.filter(r =>
                norm(r.street).includes(clean)
            );

            render(matches);
        }

        /* Render results */
        function render(list) {
            results.innerHTML = "";

            if (!list.length) {
                results.innerHTML = "<p>No matching streets found.</p>";
                return;
            }

            list.forEach(item => {
                results.innerHTML += `
                    <div class="route-card">
                        <h3>${item.route} – ${item.day} (${item.date})</h3>
                        <p><strong>📍 ${item.street}</strong></p>
                        ${item.notes ? `<p>📝 ${item.notes}</p>` : ""}
                    </div>
                `;
            });
        }

        button.addEventListener("click", doSearch);
        input.addEventListener("keypress", e => {
            if (e.key === "Enter") doSearch();
        });
    }

    waitForElements();
}

/* Delay for Carrd/WordPress */
setTimeout(startAddressLookup, 100);
