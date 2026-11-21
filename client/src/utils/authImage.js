import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";

// Photos need a login (BUGS S5), so <img src> can't load them directly:
// fetch with the login token, then show the result as a blob: URL.

export const photoUrl = (image) => {
    const path = typeof image === "string" ? image.trim() : "";
    if (!path) return null;
    if (/^(https?:|blob:|data:)/i.test(path)) return path;
    return `${apiUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
};

// Resolves to a URL an <img> can show, or null when there is no photo.
// Call URL.revokeObjectURL on blob: results when done.
export async function loadPhoto(image) {
    const url = photoUrl(image);
    if (!url || !url.startsWith(apiUrl)) return url;
    const res = await axios.get(url, { responseType: "blob" });
    return URL.createObjectURL(res.data);
}
