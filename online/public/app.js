// Owner's phone app (Plan 19): install the offline page. The pages work without this.
if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("/owner/sw.js", { scope: "/owner/" }).catch(() => {});
    });
}
