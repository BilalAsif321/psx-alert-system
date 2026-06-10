_fetchHtml() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: "dps.psx.com.pk",
      path: "/market-watch",
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/html,*/*",
        "Referer": "https://dps.psx.com.pk/"
      },
      timeout: 15000
    }, (res) => {
      let body = "";
      const responseTimer = setTimeout(() => {
        res.destroy();
        reject(new Error("Response body timeout"));
      }, 20000); // 20s max to receive full body
      res.on("data", c => body += c);
      res.on("end", () => {
        clearTimeout(responseTimer);
        resolve(body);
      });
      res.on("error", (err) => {
        clearTimeout(responseTimer);
        reject(err);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    req.end();
  });
}