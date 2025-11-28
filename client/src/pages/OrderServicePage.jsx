import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import { CgRemove } from "react-icons/cg";
import { FaCamera } from "react-icons/fa";
import { apiUrl, UserContext } from "../context/UserContext.jsx";
import useItemNames from "../hooks/useItemNames.js";

const createItemState = (prefilledItem = "", withPlaceholders = false) => ({
    item: prefilledItem,
    quantity: withPlaceholders ? "Quantity" : "",
    rate: withPlaceholders ? "Rate" : "",
    weight: withPlaceholders ? "Weight" : "",
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

const OrderServicePage = ({
    serviceType,
    heading,
    description,
    noteLabel,
    retainItemNameOnAdd = false,
}) => {
    const { customers } = useContext(UserContext);
    const { itemOptions, loading: itemLoading, createItem } = useItemNames(serviceType);

    const [ordersData, setOrdersData] = useState([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [selectedCustomerId, setSelectedCustomerId] = useState("");
    const [selectedCompany, setSelectedCompany] = useState("");
    const [items, setItems] = useState([createItemState("", true)]);
    const [formData, setFormData] = useState(createInitialFormData(serviceType));
    const [addedItems, setAddedItems] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [cameraStream, setCameraStream] = useState(null);
    const [capturedImage, setCapturedImage] = useState(null);
    const [imageName, setImageName] = useState("");

    const customerOptions = useMemo(() => customers.map((customer) => ({
        value: customer.customerID,
        label: `${customer.customerID} (${customer.contact})`,
        contact: customer.contact,
    })), [customers]);

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

    const handleCreateItemOption = async (index, inputValue) => {
        const newOption = await createItem(inputValue);
        if (newOption) {
            handleItemChange(index, "item", newOption.value);
        }
    };

    const handleKeyPress = (index, field, event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();

        const fieldOrder = ["quantity", "weight", "rate", "xray"];
        const currentFieldIndex = fieldOrder.indexOf(field);

        if (currentFieldIndex < fieldOrder.length - 1) {
            const nextField = fieldOrder[currentFieldIndex + 1];
            const nextInput = document.querySelector(`input[data-field="${index}-${nextField}"]`);
            nextInput?.focus();
            return;
        }

        const currentItem = items[index];
        if (currentItem.item && currentItem.quantity && currentItem.rate) {
            addItem();
            setTimeout(() => {
                const nextItemInput = document.querySelector(`input[data-field="${index + 1}-quantity"]`);
                nextItemInput?.focus();
            }, 100);
        }
    };

    const addItem = () => {
        const newItemGroup = items.map((item) => ({ ...item }));
        const updatedItems = [...addedItems, newItemGroup];
        setAddedItems(updatedItems);

        const nextItemName = retainItemNameOnAdd ? items[0]?.item || "" : "";
        setItems([createItemState(nextItemName, false)]);
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

    const filterOption = (option, inputValue) => {
        if (!inputValue?.trim()) return true;

        const { contact, value } = option;
        const inputDigits = inputValue.trim().replace(/\D/g, "");
        const inputLength = inputDigits.length;

        if (inputLength === 0) return true;

        const customerIDStr = value ? String(value).replace(/\D/g, "") : "";
        let phoneStr = "";
        if (contact !== null && contact !== undefined) {
            const contactStr = String(contact);
            phoneStr = contactStr.replace(/\D/g, "");
        }

        if (inputLength <= 2) {
            return customerIDStr && (customerIDStr.startsWith(inputDigits) || customerIDStr === inputDigits);
        }

        if (inputLength >= 3) {
            return phoneStr && (phoneStr.startsWith(inputDigits) || phoneStr.includes(inputDigits));
        }

        return false;
    };

    const handleCustomerSelect = (selectedOption) => {
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
        }
    };

    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setFormData((prev) => ({
            ...prev,
            company: event.target.value,
        }));
    };

    const generateVoucher = () => Math.floor(100000 + Math.random() * 900000).toString();

    const handleSubmit = async (event) => {
        event.preventDefault();
        const allItems = [...addedItems];

        if (items[0].item && items[0].quantity && items[0].rate) {
            allItems.push(items);
        }

        if (allItems.length === 0 || flattenItems(allItems).length === 0) {
            alert("Please add at least one product/item before submitting.");
            return;
        }

        const hasValidItems = flattenItems(allItems).some(
            (item) => item.item && item.quantity && item.rate,
        );
        if (!hasValidItems) {
            alert("Please fill in all required product fields (Item, Quantity, Rate) before submitting.");
            return;
        }

        const calculatedTotalAmount = totalAmount;
        const payload = new FormData();
        Object.entries(formData).forEach(([key, formValue]) => {
            if (formValue) {
                payload.append(key, formValue);
            }
        });

        payload.append("items", JSON.stringify(flattenItems(allItems)));
        payload.append("totalAmount", calculatedTotalAmount);
        payload.append("voucher", generateVoucher());

        try {
            const response = await axios.post(`${apiUrl}/orders`, payload, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            setOrdersData((prevData) => [...prevData, response.data]);
            setImageName("");
            setCapturedImage(null);
            setAddedItems([]);
            setItems([createItemState("", false)]);
            setTotalAmount(0);
            setFormData((prevData) => ({ ...prevData, image: null }));

            const invoiceUrl = `/invoice/${response.data._id}`;
            const newTab = window.open(invoiceUrl, "_blank");
            if (!newTab) {
                alert("Failed to open new tab. Please allow popups for this site.");
            }
        } catch (error) {
            console.error("Error uploading data:", error);
        }
    };

    useEffect(() => {
        const fetchOrderData = async () => {
            try {
                const response = await axios.get(`${apiUrl}/orders`);
                setOrdersData(response.data || []);
            } catch (error) {
                console.error("Error fetching order data:", error);
            }
        };
        fetchOrderData();
    }, []);

    const _newOrderData = ordersData.filter((order) => order.type === serviceType);
    // _newOrderData is retained for potential future use such as dashboards or summaries

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

    const preventCustomerEnterSubmit = (event) => {
        if (event.key !== "Enter") return;

        const allItems = [...addedItems];
        if (items[0].item && items[0].quantity && items[0].rate) {
            allItems.push(items);
        }

        if (allItems.length === 0 || flattenItems(allItems).length === 0) {
            event.preventDefault();
            return;
        }

        const target = event.target;
        if (
            target.id === "customerID" ||
            target.id === "name" ||
            target.id === "company" ||
            target.closest(".css-1pahdxg-control") ||
            target.closest(".css-1hwfws3")
        ) {
            event.preventDefault();
        }
    };

    const companyOptions = customers.find(
        (customer) => customer.customerID === selectedCustomerId,
    )?.company || [];

    return (
        <div className="min-h-screen">
            <div className="card-modern w-full">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                        {heading}
                    </h1>
                    <p className="text-gray-500">{description}</p>
                </div>
                <form onSubmit={handleSubmit} onKeyDown={preventCustomerEnterSubmit}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="card-modern bg-gradient-to-br from-gray-50 to-white">
                            <div className="space-y-5">
                                <div>
                                    <label htmlFor="customerID" className="block text-sm font-semibold text-gray-700 mb-2">
                                        Customer ID or Phone Number
                                    </label>
                                    <Select
                                        id="customerID"
                                        options={customerOptions}
                                        value={customerOptions.find((option) => option.value === selectedCustomerId) || null}
                                        onChange={handleCustomerSelect}
                                        filterOption={filterOption}
                                        isClearable
                                        isSearchable
                                        placeholder="Search by ID or phone number..."
                                        onKeyDown={(event) => event.key === "Enter" && event.preventDefault()}
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
                                                id={`${serviceType}-item-${index}`}
                                                className="w-full border-b border-gray-300 p-2"
                                                value={item.item ? { value: item.item, label: item.item } : null}
                                                options={itemOptions}
                                                isClearable
                                                isLoading={itemLoading}
                                                onChange={(selectedOption) => handleItemChange(index, "item", selectedOption?.value || "")}
                                                onCreateOption={(inputValue) => handleCreateItemOption(index, inputValue)}
                                                placeholder="Select or add item..."
                                                formatCreateLabel={(inputValue) => `Add "${inputValue}"`}
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
                                                    onKeyPress={(event) => handleKeyPress(index, "quantity", event)}
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
                                                    onKeyPress={(event) => handleKeyPress(index, "rate", event)}
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
                                                    onKeyPress={(event) => handleKeyPress(index, "weight", event)}
                                                    onWheel={(event) => {
                                                        event.target.blur();
                                                        event.preventDefault();
                                                    }}
                                                />
                                            </div>
                                            <select
                                                className="w-1/3 border-b border-gray-300 p-2"
                                                value={item.weightUnite}
                                                onChange={(event) => handleItemChange(index, "weightUnite", event.target.value)}
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
                                                onKeyPress={(event) => handleKeyPress(index, "xray", event)}
                                            />
                                        </div>
                                    </div>
                                ))}
                                <button type="button" className="btn-primary w-full" onClick={addItem}>
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
                                                <td colSpan="4" className="text-right">
                                                    Total:
                                                </td>
                                                <td className="text-blue-600">{totalAmount.toFixed(2)}</td>
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
                                <button type="submit" className="btn-primary w-full lg:w-auto">
                                    Submit &amp; Print
                                </button>
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

export default OrderServicePage;

