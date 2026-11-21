import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { loadPhoto } from "../utils/authImage.js";

// <img> for a photo that needs a login. Shows `fallback` while loading,
// when there is no photo, or when it can't be loaded.
function AuthImage({ image, fallback = null, ...imgProps }) {
    const [src, setSrc] = useState(null);

    useEffect(() => {
        let alive = true;
        let blobUrl = null;
        setSrc(null);
        loadPhoto(image)
            .then((url) => {
                if (url?.startsWith("blob:")) blobUrl = url;
                if (alive) setSrc(url);
                else if (blobUrl) URL.revokeObjectURL(blobUrl);
            })
            .catch(() => alive && setSrc(null));
        return () => {
            alive = false;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [image]);

    if (!src) return fallback;
    return <img src={src} {...imgProps} />;
}

AuthImage.propTypes = {
    image: PropTypes.string,
    fallback: PropTypes.node,
};

export default AuthImage;
