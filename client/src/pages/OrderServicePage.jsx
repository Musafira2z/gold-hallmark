import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import PropTypes from "prop-types";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { CgRemove } from "react-icons/cg";
import { FaCamera } from "react-icons/fa";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import useItemNames from "../hooks/useItemNames.js";
import { formatContactForDisplay } from "../utils/formatContact.js";
import { companyText } from "../utils/customerSearch.js";

const MAX_CUSTOMER_OPTIONS = 50;

// Customer box: one search for ID, phone, name or shop.
// Order: exact ID, ID starting with it, phone, name starting with it, name/shop containing it.
const rankCustomers = (customers, input) => {
    const text = (input || "").trim().toLowerCase();
    const newestFirst = (a, b) => Number(b.customerID) - Number(a.customerID);
    if (!text) return [...customers].sort(newestFirst).slice(0, MAX_CUSTOMER_OPTIONS);
    const digits = text.replace(/\D/g, "");
    const isPhoneLike = /^[\d\s+-]+$/.test(text); // only digits (and spaces/dashes) count as a phone search
    const scored = [];
    customers.forEach((c) => {
        const id = String(c.customerID);
        const name = String(c.name || "").toLowerCase();
        const shops = companyText(c.company).toLowerCase();
        const phone = formatContactForDisplay(c.contact).replace(/\D/g, "");
        let score = -1;
        if (id === text) score = 0;
        else if (digits === text && id.startsWith(text)) score = 1;
        else if (isPhoneLike && digits.length >= 3 && phone.includes(digits)) score = 2;
        else if (name.startsWith(text)) score = 3;
        else if (name.includes(text) || shops.includes(text)) score = 4;
        if (score >= 0) scored.push({ c, score });
    });
    scored.sort((a, b) => a.score - b.score || newestFirst(a.c, b.c));
    return scored.slice(0, MAX_CUSTOMER_OPTIONS).map((s) => s.c);
};

const customerLabel = (c) =>
    [c.customerID, c.name, companyText(c.company), formatContactForDisplay(c.contact)].filter(Boolean).join(" · ");

// Item box: exact name first, then names starting with the text, then the rest.
const rankItems = (options, input) => {
    const text = (input || "").trim().toLowerCase();
    if (!text) return options;
    const clean = (s) => s.toLowerCase().replace(/^[^a-z0-9]+/, "");
    const scored = [];
    options.forEach((o) => {
        const label = String(o.label).toLowerCase();
        let score = -1;
        if (label === text || clean(label) === text) score = 0;
        else if (label.startsWith(text) || clean(label).startsWith(text)) score = 1;
        else if (label.includes(text)) score = 2;
        if (score >= 0) scored.push({ o, score });
    });
    scored.sort((a, b) => a.score - b.score || a.o.label.length - b.o.label.length || a.o.label.localeCompare(b.o.label));
    return scored.map((s) => s.o);
};

// A typed number ("2", "2.5") is a quantity, never a new item name (U4 / D10).
const isNumberLike = (text) => /^\s*\d+([.,]\d+)?\s*$/.test(text || "");

// Field order for Enter. The last one adds the item.
const FIELD_ORDER = ["quantity", "rate", "weight", "weightUnit", "xray"];
const focusField = (index, field) => {
    const el = document.querySelector(`[data-field="${index}-${field}"]`);
    if (el) {
        el.focus();
        if (typeof el.select === "function" && el.tagName === "INPUT") el.select();
    }
};

// Fields start empty. (They used to start with the words "Quantity", "Rate",
// "Weight" as real values; an untouched Weight was sent as "Weight" and the
// server refused the whole order - BUGS F7.)
const createItemState = (prefilledItem = "") => ({
    item: prefilledItem,
    quantity: "",
    rate: "",
    weight: "",
    amount: "",
    weightUnite: "gm",
    xray: "",
});

const createInitialFormData = (serviceType) => ({
    name: "",
    customerID: "",
    company: "",
    item: "",
    type: serviceType,
    quantity: "",
    weight: "",
    weightUnite: "gm",
    rate: "",
    amount: "",
    customerFrom: new Date().toISOString().split("T")[0],
    image: null,
    contact: "",
    address: "",
});

const flattenItems = (groups = []) => groups.flat();

// "2.5" -> 2.5, "" / "abc" -> null. Weight may be left empty.
const toNumberOrNull = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

// Numbers as numbers before sending, so the server never sees words.
const cleanItem = (item) => ({
    ...item,
    item: String(item.item || "").trim(),
    quantity: toNumberOrNull(item.quantity),
    rate: toNumberOrNull(item.rate),
    weight: toNumberOrNull(item.weight),
    amount: toNumberOrNull(item.amount) ?? 0,
});

// First problem with an item, or "" if it is fine. Quantity and Rate are required.
const itemProblem = (item, position) => {
    const label = `Item ${position}${item.item ? ` (${item.item})` : ""}`;
    if (!String(item.item || "").trim()) return `${label}: choose the item name.`;
    const quantity = toNumberOrNull(item.quantity);
    if (quantity === null || quantity <= 0) return `${label}: enter Quantity.`;
    const rate = toNumberOrNull(item.rate);
    if (rate === null || rate < 0) return `${label}: enter Rate.`;
    return "";
};

const OrderServicePage = ({
    serviceType,
    heading,
    description,
    noteLabel,
    retainItemNameOnAdd = false,
}) => {
    const { customers, loading: customersLoading } = useContext(UserContext);
    const [searchParams] = useSearchParams();
    const prefillCustomerID = searchParams.get("customer");
    const prefillDone = useRef(false);
    const { itemOptions, loading: itemLoading, createItem } = useItemNames(serviceType);

    const formRef = useRef(null);
    const customerSelectRef = useRef(null);
    const itemSelectRefs = useRef({});
    const customerMenuOpen = useRef(false);
    const itemMenuOpen = useRef(false);

    const [totalAmount, setTotalAmount] = useState(0);
    const [customerInput, setCustomerInput] = useState("");
    const [itemInput, setItemInput] = useState("");
    const [saving, setSaving] = useState(false);
    // "Paid now": empty = the full amount (BUGS U13).
    const [paidInput, setPaidInput] = useState("");
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("");
    const [items, setItems] = useState([createItemState("")]);
    const [formData, setFormData] = useState(createInitialFormData(serviceType));
    const [addedItems, setAddedItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [imageName, setImageName] = useState("");

    const customerOptions = useMemo(
        () => rankCustomers(customers, customerInput).map((c) => ({ value: c.customerID, label: customerLabel(c) })),
        [customers, customerInput]
    );
    const selectedCustomerOption = useMemo(() => {
        const c = customers.find((x) => x.customerID === selectedCustomerId);
        return c ? { value: c.customerID, label: customerLabel(c) } : null;
    }, [customers, selectedCustomerId]);
    // Old mistakes saved item names like "2" or "220" (BUGS D10). Hide them here so
    // a typed quantity can't pick one; the database itself is not touched.
    const rankedItemOptions = useMemo(
        () => rankItems(itemOptions.filter((o) => !isNumberLike(o.label)), itemInput),
        [itemOptions, itemInput]
    );

    const focusItemName = (index = 0) => {
        itemSelectRefs.current[index]?.focus();
    };

    const calculateTotal = (pendingItems = []) =>
        pendingItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    const updateTotals = (workingItems) => {
        const combinedItems = flattenItems(addedItems).concat(workingItems);
        const newTotalAmount = calculateTotal(combinedItems);
        setTotalAmount(newTotalAmount);
        setFormData((prev) => ({ ...prev, amount: newTotalAmount }));
    };

    const handleItemChange = (index, field, value) => {
        setItems((prevItems) => {
            const newItems = [...prevItems];
            newItems[index] = { ...newItems[index], [field]: value };

            if (field === "quantity" || field === "rate") {
                const quantity = parseFloat(newItems[index].quantity) || 0;
                const rate = parseFloat(newItems[index].rate) || 0;
                newItems[index].amount = (quantity * rate || 0).toFixed(2);
            }

            updateTotals(newItems);
            return newItems;
        });
    };

    const handleItemSelected = (index, value) => {
        handleItemChange(index, "item", value);
        setItemInput("");
        // Focus right away (not after a delay), so fast typing lands in Quantity.
        if (value) focusField(index, "quantity");
    };

    const handleCreateItemOption = async (index, inputValue) => {
        if (isNumberLike(inputValue)) return; // a number is a quantity, not an item name
        const newOption = await createItem(inputValue);
        if (newOption) {
            handleItemSelected(index, newOption.value);
        }
    };

    // Enter moves to the next box; Enter in the last box adds the item.
    const handleKeyPress = (index, field, event) => {
        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
        event.preventDefault();
        const next = FIELD_ORDER[FIELD_ORDER.indexOf(field) + 1];
        if (next) {
            focusField(index, next);
            return;
        }
        tryAddItem();
    };

    // Which box to send the cursor to for an item problem.
    const fieldForProblem = (item) => {
        if (!String(item.item || "").trim()) return "item";
        if (toNumberOrNull(item.quantity) === null || toNumberOrNull(item.quantity) <= 0) return "quantity";
        return "rate";
    };

    const tryAddItem = () => {
        const current = items[0];
        const problem = itemProblem(current, flattenItems(addedItems).length + 1);
        if (problem) {
            toast.warn(problem);
            const field = fieldForProblem(current);
            if (field === "item") focusItemName(0);
            else focusField(0, field);
            return;
        }
        addItem();
        // Hallmark keeps the item name for the next item, so go straight to Quantity.
        if (retainItemNameOnAdd && current.item) focusField(0, "quantity");
        else focusItemName(0);
    };

    const addItem = () => {
        const newItemGroup = items.map((item) => ({ ...item }));
        const updatedItems = [...addedItems, newItemGroup];
        setAddedItems(updatedItems);

        const nextItemName = retainItemNameOnAdd ? items[0]?.item || "" : "";
        setItems([createItemState(nextItemName)]);
        setTotalAmount(calculateTotal(flattenItems(updatedItems)));
    };

    const deleteItem = (index) => {
        setAddedItems((prevItems) => {
            const updated = [...prevItems];
            updated.splice(index, 1);
            setTotalAmount(calculateTotal(flattenItems(updated)));
            return updated;
        });
    };

    const handleInputChange = (event) => {
        const { id, value, files } = event.target;

        if (id === "image" && files?.length) {
            const file = files[0];
            setFormData((prevData) => ({
                ...prevData,
                image: file,
            }));
            setImageName(file.name);
            setCapturedImage(URL.createObjectURL(file));
            return;
        }

        if (id === "quantity" || id === "rate") {
            const parsedValue = parseFloat(value) || 0;
            setFormData((prevData) => {
                const nextData = { ...prevData, [id]: parsedValue };
                if (nextData.quantity && nextData.rate) {
                    nextData.amount = (parseFloat(nextData.quantity) * parseFloat(nextData.rate)).toFixed(2);
                }
                return nextData;
            });
            return;
        }

        setFormData((prevData) => ({
            ...prevData,
            [id]: value,
        }));
    };

    const handleCustomerSelect = (selectedOption) => {
        setCustomerInput("");
        if (!selectedOption) {
            setSelectedCustomerId("");
            setSelectedCompany("");
            setFormData((prev) => ({
                ...prev,
                customerID: "",
                name: "",
                company: "",
                contact: "",
                address: "",
            }));
            return;
        }

        setSelectedCustomerId(selectedOption.value);
        const selectedCustomer = customers.find(
            (customer) => customer.customerID === selectedOption.value,
        );
        if (selectedCustomer) {
            const initialCompany = selectedCustomer.company?.[0] || "";
            setSelectedCompany(initialCompany);
            setFormData((prev) => ({
                ...prev,
                customerID: selectedCustomer.customerID,
                name: selectedCustomer.name,
                company: initialCompany,
                contact: selectedCustomer.contact,
                address: selectedCustomer.address,
            }));
            focusItemName(0);
        }
    };

    // Opened from a customer profile (/hallmark?customer=214): select that customer once.
    useEffect(() => {
        if (!prefillCustomerID || prefillDone.current || customers.length === 0) return;
        const match = customers.find((c) => String(c.customerID) === prefillCustomerID);
        prefillDone.current = true;
        if (match) handleCustomerSelect({ value: match.customerID });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [prefillCustomerID, customers]);

    // Page opened without a customer: put the cursor in the customer box
    // as soon as the customer list has loaded (the box is disabled until then).
    useEffect(() => {
        if (!customersLoading && !prefillCustomerID) customerSelectRef.current?.focus();
    }, [customersLoading, prefillCustomerID]);

    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setFormData((prev) => ({
            ...prev,
            company: event.target.value,
        }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (saving) return; // a second click while saving must not make a second order

        if (!formData.customerID) {
            toast.warn("Choose the customer first.");
            setTimeout(() => customerSelectRef.current?.focus(), 0);
            return;
        }

        const allItems = [...addedItems];

        if (items[0].item && items[0].quantity && items[0].rate) {
            allItems.push(items);
        }

        if (allItems.length === 0 || flattenItems(allItems).length === 0) {
            toast.warn("Add at least one item first.");
            focusItemName(0);
            return;
        }

        const problem = flattenItems(allItems)
            .map((item, i) => itemProblem(item, i + 1))
            .find(Boolean);
        if (problem) {
            toast.warn(problem);
            return;
        }

        if (paidInput !== "") {
            const paid = Number(paidInput);
            if (!Number.isFinite(paid) || paid < 0) {
                toast.warn("Paid now must be 0 or more.");
                return;
            }
            if (paid > Math.round(totalAmount * 100) / 100) {
                toast.warn(`Paid now (${paid}) can't be more than the total (${totalAmount.toFixed(2)}).`);
                return;
            }
        }

        setSaving(true);

        const calculatedTotalAmount = totalAmount;
        const payload = new FormData();
        Object.entries(formData).forEach(([key, formValue]) => {
            if (formValue) {
                payload.append(key, formValue);
            }
        });

        payload.append("items", JSON.stringify(flattenItems(allItems).map(cleanItem)));
        payload.append("totalAmount", calculatedTotalAmount);
        // The memo number is given by the server (1000001, 1000002, ...).
        if (paidInput !== "") payload.append("paidAmount", String(Number(paidInput)));

        try {
            const response = await axios.post(`${apiUrl}/orders`, payload, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setImageName("");
            setCapturedImage(null);
            setAddedItems([]);
            setItems([createItemState("")]);
            setTotalAmount(0);
            setPaidInput("");
            setFormData((prevData) => ({ ...prevData, image: null }));

            const invoiceUrl = `/invoice/${response.data._id}`;
            const newTab = window.open(invoiceUrl, "_blank");
            if (!newTab) {
                alert("Failed to open new tab. Please allow popups for this site.");
            }
            toast.success("Order saved.");
            focusItemName(0);
        } catch (error) {
            console.error("Error uploading data:", error);
            toast.error("Order was NOT saved. Please try again.");
        } finally {
            setSaving(false);
        }
    };


    const openCamera = () => {
        setIsModalOpen(true);
        navigator.mediaDevices
            .getUserMedia({ video: true }, { aspectRatio: 1.777777778 })
            .then((stream) => {
                setCameraStream(stream);
            })
            .catch((err) => console.error("Error accessing camera: ", err));
    };

    const closeCamera = () => {
        if (cameraStream) {
            cameraStream.getTracks().forEach((track) => track.stop());
        }
        setCameraStream(null);
        setIsModalOpen(false);
    };

    const captureImage = () => {
        const video = document.getElementById("camera-video");
        if (!video) return;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob((blob) => {
            if (!blob) return;
            const file = new File([blob], "captured-image.png", { type: "image/png" });
            setCapturedImage(URL.createObjectURL(blob));
            setImageName("captured-image.png");
            setFormData((prevData) => ({
                ...prevData,
                image: file,
            }));
        }, "image/png");

        closeCamera();
    };

    // Ctrl+Enter (or Cmd+Enter) anywhere = Submit & Print.
    // A plain Enter never submits the form by itself; each box decides what Enter does.
    const handleFormKeyDown = (event) => {
        if (event.key !== "Enter") return;
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
            return;
        }
        if (event.target.type !== "submit" && event.target.tagName !== "BUTTON") {
            event.preventDefault();
        }
    };

    // Enter on the customer box after a customer is chosen: go to the item.
    const handleCustomerKeyDown = (event) => {
        if (event.key === "Enter" && !event.ctrlKey && !event.metaKey && !customerMenuOpen.current && selectedCustomerId) {
            event.preventDefault();
            focusItemName(0);
        }
    };

    // Enter on the item box after an item is chosen: go to Quantity.
    const handleItemKeyDown = (index, event) => {
        if (event.key !== "Enter" || event.ctrlKey || event.metaKey) return;
        if (!itemMenuOpen.current && items[index]?.item) {
            event.preventDefault();
            focusField(index, "quantity");
        }
    };

    const companyOptions = customers.find(
        (customer) => customer.customerID === selectedCustomerId,
    )?.company || [];

    return (
        <div className="min-h-screen">
            <div className="card-modern w-full">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">
                        {heading}
                    </h1>
                    <p className="text-gray-500">{description}</p>
                    <p className="mt-2 text-xs text-gray-500" aria-label="Keyboard shortcuts">
                        <kbd className="rounded border border-gray-300 bg-gray-50 px-1">Enter</kbd> next box ·{" "}
                        <kbd className="rounded border border-gray-300 bg-gray-50 px-1">Enter</kbd> in the last box adds the item ·{" "}
                        <kbd className="rounded border border-gray-300 bg-gray-50 px-1">Ctrl</kbd>+
                        <kbd className="rounded border border-gray-300 bg-gray-50 px-1">Enter</kbd> Submit &amp; Print
                    </p>
                </div>
                <form ref={formRef} onSubmit={handleSubmit} onKeyDown={handleFormKeyDown}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card-modern bg-gradient-to-br from-gray-50 to-white">
                            <div className="space-y-5">
                                <div>
                                    <label htmlFor="customerID" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Customer
                                    </label>
                                    <Select
                                        ref={customerSelectRef}
                                        inputId="customerID"
                                        options={customerOptions}
                                        value={selectedCustomerOption}
                                        onChange={handleCustomerSelect}
                                        inputValue={customerInput}
                                        onInputChange={(value, meta) => {
                                            if (meta.action === "input-change") setCustomerInput(value);
                                            if (meta.action === "menu-close") setCustomerInput("");
                                        }}
                                        filterOption={() => true}
                                        onMenuOpen={() => { customerMenuOpen.current = true; }}
                                        onMenuClose={() => { customerMenuOpen.current = false; }}
                                        onKeyDown={handleCustomerKeyDown}
                                        isClearable
                                        isSearchable
                                        isLoading={customersLoading}
                                        isDisabled={customersLoading}
                                        placeholder={customersLoading ? "Loading customers…" : "Type ID, phone, name or shop, then Enter"}
                                        noOptionsMessage={() => (customerInput ? `No customer matches "${customerInput}"` : "No customers")}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Customer Name
                                    </label>
                                    <input
                                        id="name"
                                        type="text"
                                        readOnly
                                        className="input-modern bg-gray-50"
                                        value={formData.name}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="company" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Company
                                    </label>
                                    <select
                                        id="company"
                                        className="input-modern"
                                        value={selectedCompany}
                                        onChange={handleCompanyChange}
                                    >
                                        {companyOptions.map((companyName) => (
                                            <option key={companyName} value={companyName}>
                                                {companyName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-10 mb-6">
                                {items.map((item, index) => (
                                    <div key={index} className="flex flex-col gap-y-3 p-2 rounded">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Item Name</label>
                                            <CreatableSelect
                                                ref={(el) => { itemSelectRefs.current[index] = el; }}
                                                inputId={`${serviceType}-item-${index}`}
                                                className="w-full border-b border-gray-300 p-2"
                                                value={item.item ? { value: item.item, label: item.item } : null}
                                                options={rankedItemOptions}
                                                inputValue={itemInput}
                                                onInputChange={(value, meta) => {
                                                    if (meta.action === "input-change") setItemInput(value);
                                                    if (meta.action === "menu-close") setItemInput("");
                                                }}
                                                filterOption={() => true}
                                                onMenuOpen={() => { itemMenuOpen.current = true; }}
                                                onMenuClose={() => { itemMenuOpen.current = false; }}
                                                onKeyDown={(event) => handleItemKeyDown(index, event)}
                                                isClearable
                                                isLoading={itemLoading}
                                                onChange={(selectedOption) => handleItemSelected(index, selectedOption?.value || "")}
                                                onCreateOption={(inputValue) => handleCreateItemOption(index, inputValue)}
                                                isValidNewOption={(inputValue, _value, options) =>
                                                    Boolean(inputValue.trim()) &&
                                                    !isNumberLike(inputValue) &&
                                                    !options.some((o) => String(o.label).toLowerCase() === inputValue.trim().toLowerCase())
                                                }
                                                placeholder="Type item name, then Enter"
                                                formatCreateLabel={(inputValue) => `Add new item "${inputValue}"`}
                                                noOptionsMessage={() =>
                                                    isNumberLike(itemInput) ? "A number is a quantity, not an item name" : "No items"
                                                }
                                            />
                                        </div>
                                        <div className="flex gap-x-5">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Quantity</label>
                                                <input
                                                    className="input-modern"
                                                    type="number"
                                                    placeholder="Quantity"
                                                    value={item.quantity}
                                                    data-field={`${index}-quantity`}
                                                    onChange={(event) => handleItemChange(index, "quantity", event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            handleKeyPress(index, "quantity", event);
                                                        }
                                                    }}
                                                    onWheel={(event) => {
                                                        event.target.blur();
                                                        event.preventDefault();
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Rate (BDT)</label>
                                                <input
                                                    className="input-modern"
                                                    type="number"
                                                    placeholder="Rate"
                                                    value={item.rate}
                                                    data-field={`${index}-rate`}
                                                    onChange={(event) => handleItemChange(index, "rate", event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            handleKeyPress(index, "rate", event);
                                                        }
                                                    }}
                                                    onWheel={(event) => {
                                                        event.target.blur();
                                                        event.preventDefault();
                                                    }}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex space-x-2">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-2">Weight and Unit</label>
                                                <input
                                                    type="number"
                                                    className="w-2/3 input-modern"
                                                    placeholder="Weight"
                                                    value={item.weight}
                                                    data-field={`${index}-weight`}
                                                    onChange={(event) => handleItemChange(index, "weight", event.target.value)}
                                                    onKeyDown={(event) => {
                                                        if (event.key === "Enter") {
                                                            handleKeyPress(index, "weight", event);
                                                        }
                                                    }}
                                                    onWheel={(event) => {
                                                        event.target.blur();
                                                        event.preventDefault();
                                                    }}
                                                />
                                            </div>
                                            <select
                                                className="w-1/3 border-b border-gray-300 p-2"
                                                value={item.weightUnite}
                                                data-field={`${index}-weightUnit`}
                                                onChange={(event) => handleItemChange(index, "weightUnite", event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        handleKeyPress(index, "weightUnit", event);
                                                    }
                                                }}
                                            >
                                                <option value="gm">gm</option>
                                                <option value="ana">ana</option>
                                                <option value="point">point</option>
                                                <option value="vori/tola">vori/tola</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">Total (BDT)</label>
                                            <input
                                                className="input-modern bg-gray-50"
                                                type="text"
                                                placeholder="Amount"
                                                value={item.amount}
                                                readOnly
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                                {noteLabel}
                                            </label>
                                            <input
                                                type="text"
                                                className="input-modern"
                                                value={item.xray}
                                                data-field={`${index}-xray`}
                                                onChange={(event) => handleItemChange(index, "xray", event.target.value)}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        handleKeyPress(index, "xray", event);
                                                    }
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="btn-primary w-full" onClick={tryAddItem}>
                                    Add Item
                                </button>
                            </div>
                        </div>

                        <div className="card-modern space-y-6">
                            <div className="space-y-4 items-list">
                                <div className="table-modern">
                                    <table className="w-full">
                                        <thead>
                                            <tr>
                                                <th>Item</th>
                                                <th>Quantity</th>
                                                <th>Rate</th>
                                                <th>Weight</th>
                                                <th>{noteLabel}</th>
                                                <th>Amount</th>
                                                <th>Delete</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {flattenItems(addedItems).map((item, index) => (
                                                <tr key={`${item.item}-${index}`}>
                                                    <td>{item.item}</td>
                                                    <td>{item.quantity}</td>
                                                    <td>{item.rate}</td>
                                                    <td>
                                                        {item.weight} {item.weightUnite}
                                                    </td>
                                                    <td>{item.xray}</td>
                                                    <td>{item.amount}</td>
                                                    <td className="text-center">
                                                        <button
                                                            type="button"
                                                            className="text-red-500 hover:text-red-700 text-xl transition-colors"
                                                            onClick={() => deleteItem(index)}
                                                        >
                                                            <CgRemove />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-gray-50 font-semibold">
                                                <td colSpan="5" className="text-right">
                                                    Total:
                                                </td>
                                                <td className="text-blue-600">{totalAmount.toFixed(2)}</td>
                                                <td />
                                            </tr>
                                            <tr>
                                                <td colSpan="5" className="text-right align-middle">
                                                    <label htmlFor="paidNow">Paid now:</label>
                                                </td>
                                                <td>
                                                    <input
                                                        id="paidNow"
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        value={paidInput}
                                                        placeholder={totalAmount.toFixed(2)}
                                                        onChange={(event) => setPaidInput(event.target.value)}
                                                        onWheel={(event) => event.target.blur()}
                                                        className="w-28 rounded border border-gray-300 px-2 py-1 text-right"
                                                        aria-describedby="paidNowHelp"
                                                    />
                                                </td>
                                                <td />
                                            </tr>
                                            <tr>
                                                <td colSpan="5" className="text-right text-xs text-gray-500" id="paidNowHelp">
                                                    {paidInput === "" ? "Empty = fully paid" : "Due (baki):"}
                                                </td>
                                                <td className={paidInput !== "" && Number(paidInput) < totalAmount ? "font-semibold text-red-700" : ""}>
                                                    {paidInput === "" ? "" : Math.max(0, totalAmount - Number(paidInput || 0)).toFixed(2)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="flex flex-col gap-5">
                                <div>
                                    <label htmlFor="customerFrom" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Delivery Date
                                    </label>
                                    <input
                                        id="customerFrom"
                                        type="date"
                                        className="input-modern"
                                        value={formData.customerFrom}
                                        onChange={handleInputChange}
                                        readOnly
                                        required
                                    />
                                </div>
                                <div>
                                    <label htmlFor="image" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Upload Image
                                    </label>
                                    {capturedImage && (
                                        <div className="mb-2 text-green-500">
                                            <img src={capturedImage} alt={imageName} className="my-4 max-h-36" />
                                        </div>
                                    )}
                                    {!capturedImage && (
                                        <input
                                            id="image"
                                            type="file"
                                            className="w-full border-b border-gray-300 p-2"
                                            onChange={handleInputChange}
                                        />
                                    )}
                                    <button
                                        type="button"
                                        onClick={openCamera}
                                        className="btn-secondary w-full lg:w-1/2 my-3 flex text-center justify-center items-center gap-2"
                                    >
                                        <FaCamera />
                                        Open Camera
                                    </button>
                                </div>
                            </div>
                            <div>
                                <button type="submit" className="btn-primary w-full lg:w-auto" disabled={saving}>
                                    {saving ? "Saving…" : "Submit & Print"}
                                </button>
                                <span className="ml-3 text-xs text-gray-500">or Ctrl+Enter</span>
                            </div>
                        </div>
                    </div>
                </form>

                {isModalOpen && (
                    <div className="modal-overlay fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-10">
                        <div className="bg-white p-4 rounded-md">
                            <h2 className="text-lg font-semibold mb-4">Capture Image</h2>
                            <video
                                id="camera-video"
                                width="100%"
                                height="auto"
                                autoPlay
                                playsInline
                                ref={(video) => {
                                    if (video) {
                                        video.srcObject = cameraStream;
                                    }
                                }}
                                style={{ aspectRatio: "16/9" }}
                            />
                            <div className="mt-4 flex justify-center">
                                <button onClick={captureImage} className="bg-blue-500 text-white px-4 py-2 rounded mr-2">
                                    Capture
                                </button>
                                <button onClick={closeCamera} className="bg-gray-500 text-white px-4 py-2 rounded">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

OrderServicePage.propTypes = {
    serviceType: PropTypes.oneOf(["hallmark", "xray"]).isRequired,
    heading: PropTypes.string.isRequired,
    description: PropTypes.string,
    noteLabel: PropTypes.string,
    retainItemNameOnAdd: PropTypes.bool,
};

export default OrderServicePage;

