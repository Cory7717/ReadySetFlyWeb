export default {
  async fetch(request) {
    if (request.method !== "GET") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Cache-Control": "public, max-age=60",
        },
      });
    }

    try {
      const incoming = new URL(request.url);
      const target = new URL(
        "https://gis.faa.gov/arcgis/rest/services/TFMS/TFR/MapServer/0/query"
      );

      const params = new URLSearchParams(incoming.search);
      if (!params.has("f")) {
        params.set("f", "json");
      }
      target.search = params.toString();

      const upstream = await fetch(target.toString(), {
        headers: {
          "User-Agent": "ReadySetFly-TFR-Proxy",
        },
      });

      const body = await upstream.text();

      return new Response(body, {
        status: upstream.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET",
          "Cache-Control": "public, max-age=60",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: "Proxy request failed",
          details: error?.message || String(error),
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET",
            "Cache-Control": "public, max-age=60",
          },
        }
      );
    }
  },
};
