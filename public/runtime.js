/**
 * GitBlast Universal Living Architecture Runtime
 * Embeddable directly into any website, internal dashboard, Docusaurus, or GitHub PR.
 * Usage: <script src="https://gitblast.vercel.app/runtime.js" data-repo="owner/repo"></script>
 */
(function () {
  console.log("⚡ GitBlast Planetary Runtime: Ingesting host architecture...");

  var hostScript = document.currentScript;
  var repoName = (hostScript && hostScript.getAttribute("data-repo")) || "active/workspace";

  var widgetContainer = document.createElement("div");
  widgetContainer.id = "gitblast-ambient-widget";
  widgetContainer.style.position = "fixed";
  widgetContainer.style.bottom = "20px";
  widgetContainer.style.right = "20px";
  widgetContainer.style.zIndex = "999999";
  widgetContainer.style.width = "48px";
  widgetContainer.style.height = "48px";
  widgetContainer.style.borderRadius = "24px";
  widgetContainer.style.background = "#030712";
  widgetContainer.style.border = "1.5px solid #38bdf8";
  widgetContainer.style.boxShadow = "0 0 20px rgba(56, 189, 248, 0.4)";
  widgetContainer.style.cursor = "pointer";
  widgetContainer.style.display = "flex";
  widgetContainer.style.alignItems = "center";
  widgetContainer.style.justifyContent = "center";
  widgetContainer.style.transition = "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)";

  widgetContainer.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m12 6 4 6-4 6-4-6z"/></svg>';

  widgetContainer.onclick = function () {
    var workspaceUrl = "https://gitblast.vercel.app/?inspect=" + encodeURIComponent(repoName);
    window.open(workspaceUrl, "_blank");
  };

  document.body.appendChild(widgetContainer);
})();
