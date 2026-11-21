// Opens the memo tab right away, inside the click, so the browser doesn't
// block it as a popup; the memo is shown there once the order is saved.
// A tab opened later (after the server answers) can be blocked (BUGS F6).
// Plan: plans/13-memo-always-opens.md

export const memoUrl = (orderId) => new URL(`/invoice/${orderId}`, window.location.origin).href;

export function openMemoTab() {
    let tab = null;
    try {
        tab = window.open("", "_blank");
    } catch {
        tab = null;
    }
    if (tab) {
        try {
            tab.document.title = "Memo";
            tab.document.body.innerHTML =
                '<p style="font:16px sans-serif;padding:24px;color:#374151">Saving the order… the memo will open here.</p>';
        } catch {
            // a browser that won't let us write into the tab: the memo still loads later
        }
    }
    return {
        // Shows the memo. Returns false when no tab could be opened at all.
        show(orderId) {
            const url = memoUrl(orderId);
            if (tab && !tab.closed) {
                tab.location.href = url;
                return true;
            }
            return Boolean(window.open(url, "_blank"));
        },
        // The save failed: close the waiting tab.
        cancel() {
            if (tab && !tab.closed) tab.close();
        },
    };
}
