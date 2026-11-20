const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const EVENT_IMAGES_META_KEY = "meta/event-images.json";
const ASSETS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Upload-Pin",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, DELETE, OPTIONS"
};
const failedPinAttempts = new Map();

function corsJson(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      ...ASSETS_CORS_HEADERS,
      ...extraHeaders
    }
  });
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) {
    diff |= ab[i] ^ bb[i];
  }
  return diff === 0;
}

function normalizeEventKey(title) {
  return String(title || "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sanitizeImageBaseName(raw) {
  const noExt = String(raw || "")
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return noExt || "event";
}

function verifyUploadAuth(request, env, fallbackPin = "") {
  const expectedPin = typeof env?.UPLOAD_PIN === "string" ? env.UPLOAD_PIN.trim() : "";
  if (!expectedPin) {
    return { ok: false, status: 503, error: "UPLOAD_PIN secret is not configured on brt-router." };
  }
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const now = Date.now();
  const entry = failedPinAttempts.get(ip);
  if (entry && now - entry.windowStart < 300000 && entry.count >= 10) {
    return { ok: false, status: 429, error: "Too many failed passcode attempts. Try again in a few minutes." };
  }
  const url = new URL(request.url);
  const providedPin = String(request.headers.get("X-Upload-Pin") || url.searchParams.get("pin") || fallbackPin || "").trim();
  if (!timingSafeEqualStr(providedPin, expectedPin)) {
    const prev = (entry && now - entry.windowStart < 300000) ? entry : { count: 0, windowStart: now };
    prev.count += 1;
    failedPinAttempts.set(ip, prev);
    if (failedPinAttempts.size > 500) {
      for (const [k, v] of failedPinAttempts.entries()) {
        if (now - v.windowStart >= 300000) failedPinAttempts.delete(k);
      }
    }
    return { ok: false, status: 401, error: "Invalid upload passcode." };
  }
  failedPinAttempts.delete(ip);
  return { ok: true };
}

async function readEventImagesMap(env) {
  if (!env?.BRT_ASSETS) return { updatedAt: null, overrides: {} };
  try {
    const obj = await env.BRT_ASSETS.get(EVENT_IMAGES_META_KEY);
    if (!obj) return { updatedAt: null, overrides: {} };
    const parsed = await obj.json();
    const overrides = (parsed && typeof parsed.overrides === "object" && !Array.isArray(parsed.overrides) && parsed.overrides) || {};
    return { updatedAt: parsed.updatedAt || null, overrides };
  } catch (e) {
    return { updatedAt: null, overrides: {} };
  }
}

async function writeEventImagesMap(env, overrides) {
  const payload = {
    updatedAt: new Date().toISOString(),
    overrides: overrides || {}
  };
  await env.BRT_ASSETS.put(EVENT_IMAGES_META_KEY, JSON.stringify(payload), {
    httpMetadata: {
      contentType: "application/json;charset=UTF-8",
      cacheControl: "no-store"
    }
  });
  return payload;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Master Pages URLs
    const brtPages = "https://brt-23f.pages.dev"; 
    const turboSantaPages = "https://turbosanta-app.pages.dev"; 

    // Extract the subdomain early 
    const subdomain = url.hostname.split('.')[0].toLowerCase(); 

    // -------------------------------------------
    // Route 0: Dynamic Donation Redirect
    // -------------------------------------------
    const donatePaths = ["/donate", "/donate/", "/donation", "/donations-form"];
    if (subdomain === "donate" || donatePaths.includes(url.pathname.toLowerCase())) {
      const fallbackUrl = "https://www.zeffy.com/en-GB/donation-form/beverley-round-table-for-our-community";
      let activeDonateUrl = fallbackUrl;

      try {
        const apiRes = await fetch("https://turbosanta-api.beverley247.workers.dev/api/payload?table=beverley", {
          cf: { 
            cacheTtl: 3600, 
            cacheEverything: true 
          }
        });
        
        if (apiRes.ok) {
          const data = await apiRes.json();
          const targetUrl = data.table?.donate_url || data.settings?.donate_url;
          if (targetUrl) {
            activeDonateUrl = targetUrl;
          }
        }
      } catch (err) {
        console.error("D1 lookup failed, using fallback:", err);
      }

      return Response.redirect(activeDonateUrl, 302);
    }

    // -------------------------------------------
    // Route 1: Partner Report & API Proxy
    // -------------------------------------------
    if (subdomain === 'partner-report' || subdomain === 'partner_report') {
      const path = url.pathname;
      
      if (path === '/api' || path.startsWith('/api')) {
        const scriptUrl = new URL("https://script.google.com/macros/s/AKfycbwyAk3IScj--iNDQUn0ddk5wUH99Gfh6kPnCGmxgHhb4dIOoPRGaRwGT1lD-E9jf8dv/exec");
        
        for (const [key, value] of url.searchParams.entries()) {
          scriptUrl.searchParams.set(key, value);
        }

        try {
          const apiRes = await fetch(scriptUrl.toString());
          const dataText = await apiRes.text();
          
          return new Response(dataText, {
            status: apiRes.status,
            headers: {
              'Content-Type': 'application/json;charset=UTF-8',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-store'
            }
          });
        } catch (err) {
          return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { 
              'Content-Type': 'application/json;charset=UTF-8', 
              'Access-Control-Allow-Origin': '*' 
            }
          });
        }
      }

      const REPORT_HTML_URL = `${turboSantaPages}/partner_report.html`;
      try {
        const reportRes = await fetch(REPORT_HTML_URL);
        return new Response(await reportRes.text(), {
          headers: { 
            'Content-Type': 'text/html;charset=UTF-8',
            'Cache-Control': 'public, max-age=60' 
          }
        });
      } catch (e) {
        return new Response('Error loading partner report.', { status: 500 });
      }
    }

    // -------------------------------------------
    // Route 1.5: Santa Site (Custom BRT Santa Page)
    // -------------------------------------------
    if (url.hostname === "santa.beverleyroundtable.co.uk") {
      const path = url.pathname;
      if (path === "/" || path === "") {
        return fetch(`${brtPages}/site/santa`);  // ← santa.html clean URL
      }
      return fetch(`${brtPages}/site/santa${path}`);  // ← subpaths/assets pass through
    }

    // -------------------------------------------
    // Route 1.6: Beraver Site
    // -------------------------------------------
    if (subdomain === "beraver") {
      const path = url.pathname;
      if (path === "/" || path === "") {
        return fetch(`${brtPages}/site/BeRaver`);
      }
      return fetch(`${brtPages}/site/BeRaver${path}`);
    }

    // -------------------------------------------
    // Route 1.7: Jukebox Subdomain
    // -------------------------------------------
    if (subdomain === "jukebox") {
      const path = url.pathname;
      if (path === "/" || path === "") {
        return fetch(`${brtPages}/beraver/jukebox`);
      }
      return fetch(`${brtPages}/beraver/jukebox${path}`);
    }

    // -------------------------------------------
    // Route 1.8: Virtual Fridays (VF)
    // -------------------------------------------
    const vfSubdomains = ["virtualfridays", "virtualfriday", "vf", "fridays"];
    const vfPaths = [
      "/vf", "/vf/", "/vf.html",
      "/virtualfridays", "/virtualfridays/", "/virtualfridays.html",
      "/virtual-fridays", "/virtual-fridays/",
      "/site/vf", "/site/vf/", "/site/vf.html"
    ];

    const isVfSubdomain = vfSubdomains.includes(subdomain);
    const isVfPath = vfPaths.includes(url.pathname.toLowerCase());

    if (isVfSubdomain || isVfPath) {
      const lowerPath = url.pathname.toLowerCase();
      if (lowerPath === "/" || lowerPath === "" || vfPaths.includes(lowerPath)) {
        return fetch(`${brtPages}/site/VF`);
      }
      if (url.pathname.startsWith("/assets/")) {
        return fetch(`${brtPages}${url.pathname}`);
      }
      if (url.pathname.startsWith("/media/")) {
        return fetch(`${brtPages}${url.pathname}`);
      }
      return fetch(`${brtPages}/site/VF${url.pathname}`);
    }
    
    // -------------------------------------------
    // Route 2: Project Sleigh (Turbo Santa)
    // -------------------------------------------
    const sleighSubdomains = ["crew", "tracker", "float", "santatracker", "driver", "lead"];

    if (url.hostname.endsWith(".beverleyroundtable.co.uk") && sleighSubdomains.includes(subdomain)) {
      const isDriver = url.searchParams.get("driver") === "1" || subdomain === "driver";
      const explicitApi = url.searchParams.get("api");

      let targetHtmlUrl = `${turboSantaPages}${url.pathname}`;

      if (url.pathname === "/" || url.pathname === "") {
        if (subdomain === "lead") targetHtmlUrl = `${turboSantaPages}/god_mode.html`;
        else if (subdomain === "driver" || subdomain === "tracker" || subdomain === "santatracker") targetHtmlUrl = `${turboSantaPages}/tracker.html`;
        else targetHtmlUrl = `${turboSantaPages}/${subdomain}.html`;
      }

      const targetUrlObj = new URL(targetHtmlUrl);
      if (!targetUrlObj.searchParams.has("table")) {
        targetUrlObj.searchParams.set("table", "beverley");
      }
      if (isDriver) {
        targetUrlObj.searchParams.set("driver", "1");
      }
      for (const [key, val] of url.searchParams.entries()) {
        targetUrlObj.searchParams.set(key, val);
      }

      if (explicitApi) {
        const htmlRes = await fetch(targetUrlObj.toString());
        const contentType = htmlRes.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) return htmlRes;

        const scriptToInject = `
          <script>
            (function() {
              const _originalGet = URLSearchParams.prototype.get;
              const _originalHas = URLSearchParams.prototype.has;
              const targetApi = ${JSON.stringify(explicitApi).replace(/</g, '\\u003c')};
              const isDriver = ${isDriver ? 'true' : 'false'};

              URLSearchParams.prototype.get = function(name) {
                if (name === 'api') return targetApi;
                if (name === 'driver' && isDriver) return '1';
                return _originalGet.call(this, name);
              };
              URLSearchParams.prototype.has = function(name) {
                if (name === 'api') return true;
                if (name === 'driver' && isDriver) return true;
                return _originalHas.call(this, name);
              };
            })();
          </script>
        `;

        return new HTMLRewriter()
          .on("head", {
            element(el) {
              el.prepend(scriptToInject, { html: true });
            }
          })
          .transform(htmlRes);
      }

      return fetch(targetUrlObj.toString());
    }

    // -------------------------------------------
    // Route 3: Area Socials Redirect
    // -------------------------------------------
    if (subdomain === "areasocials") {
      return Response.redirect(`https://takeover.beverleyroundtable.co.uk${url.pathname}${url.search}`, 301);
    }

    // -------------------------------------------
    // Route 4: Area Socials (Takeover)
    // -------------------------------------------
    if (subdomain === "takeover") {
      if (url.pathname === "/" || url.pathname === "") {
        return fetch(`${brtPages}/takeover/takeover.html`);
      }
      return fetch(`${brtPages}/takeover${url.pathname}`);
    }

    // -------------------------------------------
    // Route 5: Donations & Grants (Requests)
    // -------------------------------------------
    if (subdomain === "requests") {
      let path = url.pathname;
      
      if (path.startsWith("/requests")) {
        path = path.replace("/requests", "");
      }
      
      if (path === "/" || path === "") {
        return fetch(`${brtPages}/requests/index.html`);
      }

      if (path === "/admin" || path === "/admin/") {
        return fetch(`${brtPages}/requests/admin.html`);
      }
      
      return fetch(`${brtPages}/requests${path}`);
    }

    // -------------------------------------------
    // Route 6: Assets & Protected Event Image R2 Studio
    // -------------------------------------------
    if (subdomain === "assets") {
      const path = url.pathname;
      const lowerPath = path.toLowerCase();

      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: ASSETS_CORS_HEADERS });
      }

      if (path === "/" || path === "") {
        return Response.redirect("https://assets.beverleyroundtable.co.uk/upload", 302);
      }

      if (lowerPath === "/upload" || lowerPath === "/upload/" || lowerPath === "/upload.html" || lowerPath === "/assets/upload.html") {
        const upRes = await fetch(`${brtPages}/assets/upload.html`);
        const outHeaders = new Headers(upRes.headers);
        outHeaders.set("Content-Type", "text/html;charset=UTF-8");
        outHeaders.set("X-Robots-Tag", "noindex, nofollow");
        outHeaders.set("Cache-Control", "no-cache");
        return new Response(upRes.body, { status: upRes.status, headers: outHeaders });
      }

      // Public read-only endpoint consumed by site/BRT.html
      if (lowerPath === "/api/event-images" && request.method === "GET") {
        const data = await readEventImagesMap(env);
        const noCache = url.searchParams.has("nocache");
        return corsJson({ ok: true, ...data }, 200, {
          "Cache-Control": noCache ? "no-store" : "public, max-age=30, stale-while-revalidate=60"
        });
      }

      // Verify passcode
      if (lowerPath === "/api/auth-check" && request.method === "POST") {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const auth = verifyUploadAuth(request, env, body.pin);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        return corsJson({ ok: true }, 200, { "Cache-Control": "no-store" });
      }

      // List R2 images (protected)
      if (lowerPath === "/api/assets" && request.method === "GET") {
        const auth = verifyUploadAuth(request, env);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        if (!env?.BRT_ASSETS) return corsJson({ ok: false, error: "BRT_ASSETS R2 binding missing" }, 500);
        const listed = await env.BRT_ASSETS.list({ prefix: "images/", limit: 500 });
        const assets = (listed.objects || [])
          .map(o => {
            const filename = o.key.replace(/^images\//, "");
            return {
              key: o.key,
              filename,
              url: `https://assets.beverleyroundtable.co.uk/images/${filename}`,
              size: o.size,
              uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : null
            };
          })
          .sort((a, b) => String(b.uploaded || "").localeCompare(String(a.uploaded || "")));
        return corsJson({ ok: true, assets }, 200, { "Cache-Control": "no-store" });
      }

      // Upload image to R2 (+ optionally bind straight to an event in meta/event-images.json)
      if (lowerPath === "/api/upload" && request.method === "POST") {
        const auth = verifyUploadAuth(request, env);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        if (!env?.BRT_ASSETS) return corsJson({ ok: false, error: "BRT_ASSETS R2 binding missing" }, 500);

        let form;
        try {
          form = await request.formData();
        } catch (e) {
          return corsJson({ ok: false, error: "Expected multipart/form-data upload" }, 400);
        }

        const file = form.get("file");
        if (!file || typeof file.arrayBuffer !== "function") {
          return corsJson({ ok: false, error: "Missing file field" }, 400);
        }

        const mime = String(file.type || "").toLowerCase();
        const ext = ALLOWED_IMAGE_TYPES[mime];
        if (!ext) {
          return corsJson({ ok: false, error: "Unsupported file type. Allowed: JPEG, PNG, WebP, GIF." }, 400);
        }

        if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
          return corsJson({ ok: false, error: "File must be between 1 byte and 5 MB." }, 400);
        }

        const rawSlug = String(form.get("slug") || "").trim();
        const rawEventTitle = String(form.get("eventTitle") || form.get("assignEvent") || "").trim();
        const base = sanitizeImageBaseName(rawSlug || rawEventTitle || file.name);
        const filename = `${base}_${Date.now().toString(36)}.${ext}`;
        const key = `images/${filename}`;

        await env.BRT_ASSETS.put(key, await file.arrayBuffer(), {
          httpMetadata: {
            contentType: mime,
            cacheControl: "public, max-age=31536000, immutable"
          }
        });

        const publicUrl = `https://assets.beverleyroundtable.co.uk/images/${filename}`;
        let assignedEventKey = null;

        if (rawEventTitle) {
          const eventKey = normalizeEventKey(rawEventTitle);
          if (eventKey) {
            const current = await readEventImagesMap(env);
            const nextOverrides = {
              ...current.overrides,
              [eventKey]: {
                url: publicUrl,
                key,
                title: rawEventTitle,
                updatedAt: new Date().toISOString()
              }
            };
            await writeEventImagesMap(env, nextOverrides);
            assignedEventKey = eventKey;
          }
        }

        return corsJson({
          ok: true,
          key,
          filename,
          url: publicUrl,
          assignedEventKey
        }, 200, { "Cache-Control": "no-store" });
      }

      // Assign or reset an event image override (without re-uploading)
      if (lowerPath === "/api/event-images" && request.method === "POST") {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const auth = verifyUploadAuth(request, env, body.pin);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        if (!env?.BRT_ASSETS) return corsJson({ ok: false, error: "BRT_ASSETS R2 binding missing" }, 500);

        const eventTitle = String(body.eventTitle || body.title || "").trim();
        const targetUrl = String(body.url || "").trim();
        const eventKey = normalizeEventKey(eventTitle || body.eventKey || "");
        if (!eventKey) return corsJson({ ok: false, error: "Missing eventTitle" }, 400);
        if (!/^https:\/\//i.test(targetUrl)) return corsJson({ ok: false, error: "Image URL must start with https://" }, 400);

        const current = await readEventImagesMap(env);
        const nextOverrides = {
          ...current.overrides,
          [eventKey]: {
            url: targetUrl,
            key: body.key ? String(body.key) : "",
            title: eventTitle || eventKey,
            updatedAt: new Date().toISOString()
          }
        };
        const saved = await writeEventImagesMap(env, nextOverrides);
        return corsJson({ ok: true, ...saved }, 200, { "Cache-Control": "no-store" });
      }

      if (lowerPath === "/api/event-images" && request.method === "DELETE") {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const auth = verifyUploadAuth(request, env, body.pin);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        if (!env?.BRT_ASSETS) return corsJson({ ok: false, error: "BRT_ASSETS R2 binding missing" }, 500);

        const eventKey = normalizeEventKey(body.eventTitle || body.title || url.searchParams.get("key") || "");
        if (!eventKey) return corsJson({ ok: false, error: "Missing eventTitle or key" }, 400);

        const current = await readEventImagesMap(env);
        const nextOverrides = { ...current.overrides };
        delete nextOverrides[eventKey];
        const saved = await writeEventImagesMap(env, nextOverrides);
        return corsJson({ ok: true, ...saved }, 200, { "Cache-Control": "no-store" });
      }

      // Delete an uploaded R2 asset + clear any event overrides pointing to it
      if (lowerPath === "/api/assets" && request.method === "DELETE") {
        let body = {};
        try { body = await request.json(); } catch (e) {}
        const auth = verifyUploadAuth(request, env, body.pin);
        if (!auth.ok) return corsJson({ ok: false, error: auth.error }, auth.status);
        if (!env?.BRT_ASSETS) return corsJson({ ok: false, error: "BRT_ASSETS R2 binding missing" }, 500);

        const key = String(body.key || url.searchParams.get("key") || "").trim();
        if (!/^images\/[a-zA-Z0-9._-]+$/.test(key) || key.includes("..")) {
          return corsJson({ ok: false, error: "Invalid asset key" }, 400);
        }

        await env.BRT_ASSETS.delete(key);
        const current = await readEventImagesMap(env);
        const nextOverrides = {};
        let changed = false;
        for (const [k, v] of Object.entries(current.overrides || {})) {
          if (v && v.key === key) {
            changed = true;
          } else {
            nextOverrides[k] = v;
          }
        }
        if (changed) {
          await writeEventImagesMap(env, nextOverrides);
        }
        return corsJson({ ok: true, deleted: key, overrides: nextOverrides }, 200, { "Cache-Control": "no-store" });
      }

      // Serve R2 image first, fallback to Pages /assets/...
      let cleanPath = path;
      if (cleanPath.startsWith("/assets/")) {
        cleanPath = cleanPath.replace("/assets", "");
      } else if (cleanPath.startsWith("/images/")) {
        cleanPath = cleanPath.replace("/images", "");
      }
      const singleName = cleanPath.replace(/^\/+/, "");
      if (env?.BRT_ASSETS && singleName && !singleName.includes("/") && !singleName.includes("..") && (request.method === "GET" || request.method === "HEAD")) {
        const r2Key = `images/${singleName}`;
        const obj = request.method === "HEAD" ? await env.BRT_ASSETS.head(r2Key) : await env.BRT_ASSETS.get(r2Key);
        if (obj) {
          const headers = new Headers();
          headers.set("Content-Type", obj.httpMetadata?.contentType || "application/octet-stream");
          headers.set("Cache-Control", "public, max-age=31536000, immutable");
          headers.set("Access-Control-Allow-Origin", "*");
          headers.set("X-Content-Type-Options", "nosniff");
          if (obj.httpEtag) headers.set("ETag", obj.httpEtag);
          return new Response(request.method === "HEAD" ? null : obj.body, { status: 200, headers });
        }
      }
      return fetch(`${brtPages}/assets${cleanPath}`);
    }

    // -------------------------------------------
    // Route 7: Zeffy Lottery/Draw/Raffle Redirect
    // -------------------------------------------
    const drawSubdomains = ["draw", "raffle"];
    const drawPaths = ["/draw", "/draw/", "/lottery", "/lottery/", "/raffle", "/raffle/"];

    if (drawSubdomains.includes(subdomain) || drawPaths.includes(url.pathname.toLowerCase())) {
      const fallbackUrl = "https://www.beverleyroundtable.co.uk";
      let activeDrawUrl = fallbackUrl;

      try {
        if (env?.RAFFLE_KV) {
          const kvUrl = await env.RAFFLE_KV.get("CURRENT_DRAW_URL");
          if (kvUrl && kvUrl.startsWith("http")) activeDrawUrl = kvUrl;
        }
      } catch (err) {
        console.error("KV lookup failed, falling back to default:", err);
      }

      return Response.redirect(activeDrawUrl, 302); 
    }

    // -------------------------------------------
    // Route 8: Socials Planner & Calendar (socials.beverleyroundtable.co.uk)
    // -------------------------------------------
    if (subdomain === "socials") {
      // Optional: set your deployed Socials Planner Apps Script Web App (/exec) URL
      // via Cloudflare Worker env var SOCIALS_PLANNER_API_URL or paste it below
      // (otherwise socials.html uses DEFAULT_SCRIPT_API_URL or ?api=...).
      const socialsPlannerGasEndpoint = env?.SOCIALS_PLANNER_API_URL || "https://script.google.com/macros/s/AKfycbyOK9b-We-vy3oBYT6xz7glBlWkUoK8JOseHmj7tKpo8uJs-ABg1lxTeMxPRvz3j9g5/exec";
      const apiParam = url.searchParams.get("api") || socialsPlannerGasEndpoint;

      let path = url.pathname;
      if (path.startsWith("/socials")) {
        path = path.replace("/socials", "");
      }

      let targetHtmlUrl = `${brtPages}/socials${path}`;
      if (path === "/" || path === "") {
        targetHtmlUrl = `${brtPages}/socials/socials.html`;
      }

      const htmlRes = await fetch(targetHtmlUrl);
      const contentType = htmlRes.headers.get("content-type") || "";

      if (!contentType.includes("text/html") || !apiParam) {
        return htmlRes;
      }

      const scriptToInject = `
        <script>
          (function() {
            const _originalGet = URLSearchParams.prototype.get;
            const _originalHas = URLSearchParams.prototype.has;
            const targetApi = ${JSON.stringify(apiParam).replace(/</g, '\\u003c')};

            URLSearchParams.prototype.get = function(name) {
              if (name === 'api') return targetApi;
              return _originalGet.call(this, name);
            };
            URLSearchParams.prototype.has = function(name) {
              if (name === 'api') return true;
              return _originalHas.call(this, name);
            };
          })();
        </script>
      `;

      return new HTMLRewriter()
        .on("head", {
          element(el) {
            el.prepend(scriptToInject, { html: true });
          }
        })
        .transform(htmlRes);
    }

    // -------------------------------------------
    // Route 8.1: Social Posts Generator (socialposts.beverleyroundtable.co.uk)
    // -------------------------------------------
    if (subdomain === "socialposts") {
      const socialGasEndpoint = "https://script.google.com/macros/s/AKfycbzSNVYKw0BFib-d9ExtsMp2q_t74yeORr2XjyR947Um3Ns6nR2F0bJx2QRMhwQtah6s/exec"; 
      const apiParam = url.searchParams.get("api") || socialGasEndpoint;

      let path = url.pathname;
      if (path.startsWith("/socials")) {
        path = path.replace("/socials", "");
      }

      let targetHtmlUrl = `${brtPages}/socials${path}`;
      if (path === "/" || path === "") {
        targetHtmlUrl = `${brtPages}/socials/social_posts.html`;
      }
      
      const htmlRes = await fetch(targetHtmlUrl);
      const contentType = htmlRes.headers.get("content-type") || "";

      if (!contentType.includes("text/html")) {
        return htmlRes;
      }

      const scriptToInject = `
        <script>
          (function() {
            const _originalGet = URLSearchParams.prototype.get;
            const _originalHas = URLSearchParams.prototype.has;
            const targetApi = ${JSON.stringify(apiParam).replace(/</g, '\\u003c')};

            URLSearchParams.prototype.get = function(name) {
              if (name === 'api') return targetApi;
              return _originalGet.call(this, name);
            };
            URLSearchParams.prototype.has = function(name) {
              if (name === 'api') return true;
              return _originalHas.call(this, name);
            };
          })();
        </script>
      `;

      return new HTMLRewriter()
        .on("head", {
          element(el) {
            el.prepend(scriptToInject, { html: true });
          }
        })
        .transform(htmlRes);
    }

    // -------------------------------------------
    // Route 8.5: Are You In (Invite, Free Drink, Quiz)
    // -------------------------------------------
    const areYouInSubdomains = ["invite", "freedrink", "quiz", "areyouin"];
    if (areYouInSubdomains.includes(subdomain)) {
      const path = url.pathname;
      
      // Map root of subdomain to matching page under /areyouin/
      if (path === "/" || path === "") {
        const page = (subdomain === "areyouin") ? "invite" : subdomain;
        return fetch(`${brtPages}/areyouin/${page}.html`);
      }
      
      // Pass through subpaths or assets under /areyouin/
      return fetch(`${brtPages}/areyouin${path}`);
    }
    
    // -------------------------------------------
    // Route 9: Main Site Fallback
    // -------------------------------------------
    if (url.hostname.endsWith(".beverleyroundtable.co.uk") || url.hostname === "beverleyroundtable.co.uk") {
      const path = url.pathname;
      if (path === "/" || path === "") {
        return fetch(`${brtPages}/site/BRT`);  // ← root → BRT.html clean URL
      }
      return fetch(`${brtPages}/site/BRT${path}`);  // ← subpaths/assets pass through
    }

    return fetch(request);
  }
};
