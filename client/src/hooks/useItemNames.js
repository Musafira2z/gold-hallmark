import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { apiUrl } from "../context/UserContext.jsx";

const sortOptions = (options) => [...options].sort((a, b) => a.label.localeCompare(b.label));

const useItemNames = (type) => {
    const [itemOptions, setItemOptions] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await axios.get(`${apiUrl}/items/${type}`);
            const options = data.map((item) => ({ value: item.name, label: item.name }));
            setItemOptions(sortOptions(options));
        } catch (error) {
            console.error("Failed to load item names:", error);
        } finally {
            setLoading(false);
        }
    }, [type]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const createItem = useCallback(async (inputValue) => {
        const name = (inputValue || "").trim();
        if (!name) {
            return null;
        }

        try {
            const { data } = await axios.post(`${apiUrl}/items`, { name, type });
            const newOption = { value: data.name, label: data.name };
            setItemOptions((prev) => sortOptions([...prev, newOption]));
            return newOption;
        } catch (error) {
            const status = error.response?.status;
            if (status === 409) {
                alert("This item already exists.");
            } else {
                alert("Failed to create item. Please try again.");
            }
            console.error("Failed to create item name:", error);
            return null;
        }
    }, [type]);

    return useMemo(() => ({
        itemOptions,
        loading,
        createItem,
        refresh: fetchItems
    }), [itemOptions, loading, createItem, fetchItems]);
};

export default useItemNames;

