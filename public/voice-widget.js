// public/voice-widget.js
(function () {
  function init() {
    var scripts = document.querySelectorAll(
      'script[src*="voice-widget.js"][data-tenant-widget-key]'
    );
    if (!scripts.length) return;

    scripts.forEach(function (script) {
      var key = script.getAttribute("data-tenant-widget-key");
      if (!key) return;

      fetch(
        "https://chaotic.ngrok.io/api/public/widget/bootstrap?key=" +
          encodeURIComponent(key),
        {
          credentials: "omit",
        }
      )
        .then(function (res) {
          return res.json();
        })
        .then(function (json) {
          if (!json || !json.ok) {
            console.warn(
              "[SM Voice Widget] bootstrap failed:",
              json && json.error
            );
            return;
          }

          var tenantId = json.tenantId;
          var displayName = json.displayName || "our team";
          var token = json.widgetSessionToken;
          var primaryColor =
            (json.branding && json.branding.primaryColor) || "#2563eb";

          // Create floating button
          var btn = document.createElement("button");
          btn.textContent = "Talk to " + displayName;
          btn.style.position = "fixed";
          btn.style.right = "16px";
          btn.style.bottom = "16px";
          btn.style.zIndex = "999999";
          btn.style.background = primaryColor;
          btn.style.color = "#fff";
          btn.style.padding = "10px 16px";
          btn.style.borderRadius = "9999px";
          btn.style.border = "none";
          btn.style.cursor = "pointer";
          btn.style.boxShadow =
            "0 10px 15px -3px rgba(15,23,42,0.3),0 4px 6px -4px rgba(15,23,42,0.2)";

          btn.addEventListener("click", function () {
            var msg = window.prompt("Ask a question for " + displayName + ":");
            if (!msg) return;

            fetch("https://chaotic.ngrok.io/api/voice/session", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({ message: msg }),
            })
              .then(function (res) {
                return res.json();
              })
              .then(function (resJson) {
                if (!resJson.ok) {
                  window.alert(
                    "Sorry, I had trouble answering that. (" +
                      (resJson.error || "unknown error") +
                      ")"
                  );
                  return;
                }
                window.alert(resJson.reply || "No reply.");
              })
              .catch(function (err) {
                console.error("[SM Voice Widget] session error", err);
                window.alert("Sorry, something went wrong.");
              });
          });

          document.body.appendChild(btn);
        })
        .catch(function (err) {
          console.error("[SM Voice Widget] bootstrap error", err);
        });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
