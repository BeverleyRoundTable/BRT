export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Master Pages URL
    const brtPages = "https://brt-23f.pages.dev"; 

    // Extract the subdomain early 
    const subdomain = url.hostname.split('.')[0].toLowerCase(); 

    // -------------------------------------------
    // Route 0: Dynamic Donation Redirect
    // -------------------------------------------
    const donatePaths = ["/donate", "/donate/", "/donation", "/donations-form"];
    if (subdomain === "donate" || donatePaths.includes(url.pathname.toLowerCase())) {
      const fallbackUrl = "https://www.zeffy.com/en-GB/organizations/beverley-round-table";
      let activeDonateUrl = fallbackUrl;

      try {
        // Increased cache to 12 hours (43200 seconds) and forced cache matching
        const apiRes = await fetch("https://script.google.com/macros/s/AKfycbwl88G_1QGwp6uN1JEGV2Abd7FAwQg7Id3_ufSNW_n1e7rsPAw-ZUor5vlqL8_GBfCK/exec", {
          cf: { 
            cacheTtl: 43200, 
            cacheEverything: true 
          }
        });
        
        if (apiRes.ok) {
          const data = await apiRes.json();
          if (data.settings && data.settings.donate_url) {
            activeDonateUrl = data.settings.donate_url;
          }
        }
      } catch (err) {
        console.error("API lookup failed, using fallback");
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

      const REPORT_HTML_URL = `${brtPages}/sleigh/partner_report.html`;
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
    // Route 1.5: Santa Site (no API injection)
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
    // Route 2: Project Sleigh (Turbo Santa)
    // -------------------------------------------
    const sleighSubdomains = ["crew", "tracker", "float", "santatracker", "driver", "lead"];

    if (url.hostname.endsWith(".beverleyroundtable.co.uk") && sleighSubdomains.includes(subdomain)) {
      const defaultGasEndpoint = "https://script.google.com/macros/s/AKfycbwl88G_1QGwp6uN1JEGV2Abd7FAwQg7Id3_ufSNW_n1e7rsPAw-ZUor5vlqL8_GBfCK/exec";
      const apiParam = url.searchParams.get("api") || defaultGasEndpoint;
      const isDriver = url.searchParams.get("driver") === "1" || subdomain === "driver";

      let targetHtmlUrl = `${brtPages}/sleigh${url.pathname}`;

      if (url.pathname === "/" || url.pathname === "") {
        if (subdomain === "lead") targetHtmlUrl = `${brtPages}/sleigh/god_mode.html`;
        else if (subdomain === "driver" || subdomain === "tracker" || subdomain === "santatracker") targetHtmlUrl = `${brtPages}/sleigh/tracker.html`;
        else targetHtmlUrl = `${brtPages}/sleigh/${subdomain}.html`;
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
    // Route 6: Assets (brtpics consolidated under BRT/assets)
    // -------------------------------------------
    if (subdomain === "assets") {
      let cleanPath = url.pathname;
      if (cleanPath.startsWith("/assets/")) {
        cleanPath = cleanPath.replace("/assets", "");
      } else if (cleanPath.startsWith("/images/")) {
        cleanPath = cleanPath.replace("/images", "");
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
    // Route 8: Socials & Social Posts
    // -------------------------------------------
    if (subdomain === "socialposts" || subdomain === "socials") {
      const socialGasEndpoint = "https://script.google.com/macros/s/AKfycbzSNVYKw0BFib-d9ExtsMp2q_t74yeORr2XjyR947Um3Ns6nR2F0bJx2QRMhwQtah6s/exec"; 
      const apiParam = url.searchParams.get("api") || socialGasEndpoint;

      let path = url.pathname;
      if (path.startsWith("/socials")) {
        path = path.replace("/socials", "");
      }

      let targetHtmlUrl = `${brtPages}/socials${path}`;
      if (path === "/" || path === "") {
        if (subdomain === "socialposts") targetHtmlUrl = `${brtPages}/socials/social_posts.html`;
        else if (subdomain === "socials") targetHtmlUrl = `${brtPages}/socials/socials.html`;
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
